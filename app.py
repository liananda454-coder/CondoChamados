import io
import os
import secrets
import sqlite3
from datetime import datetime, timezone
from functools import wraps
from pathlib import Path

import click
from flask import Flask, abort, g, jsonify, render_template, request, send_file, session
from PIL import Image, UnidentifiedImageError
from werkzeug.security import check_password_hash, generate_password_hash

STATUSES = ['Aberto', 'Em análise', 'Em atendimento', 'Concluído']
CATEGORIES = ['Elétrica', 'Hidráulica', 'Elevadores', 'Portões', 'Iluminação', 'Limpeza', 'Áreas comuns', 'Segurança', 'Jardim e poda', 'Outros']
PRIORITIES = ['Baixa', 'Normal', 'Alta', 'Urgente']


def create_app(test_config=None):
    app = Flask(__name__, instance_relative_config=True)
    app.config.update(SECRET_KEY=os.environ.get('SECRET_KEY'), DATABASE=os.environ.get('DATABASE_PATH', str(Path(app.instance_path) / 'condo.sqlite')),
                      MAX_CONTENT_LENGTH=6 * 1024 * 1024, SESSION_COOKIE_HTTPONLY=True,
                      SESSION_COOKIE_SAMESITE='Lax', SESSION_COOKIE_SECURE=os.environ.get('COOKIE_SECURE') == '1')
    if test_config:
        app.config.update(test_config)
    if not app.config['SECRET_KEY']:
        raise RuntimeError('Defina SECRET_KEY com um valor aleatório antes de iniciar.')
    Path(app.config['DATABASE']).parent.mkdir(parents=True, exist_ok=True)

    def db():
        if 'db' not in g:
            g.db = sqlite3.connect(app.config['DATABASE'])
            g.db.row_factory = sqlite3.Row
            g.db.execute('PRAGMA foreign_keys=ON')
        return g.db

    @app.teardown_appcontext
    def close_db(error=None):
        if 'db' in g:
            g.pop('db').close()

    with app.app_context():
        db().executescript(Path(__file__).with_name('schema.sql').read_text())

    def now():
        return datetime.now(timezone.utc).isoformat()

    def user():
        return db().execute('SELECT id,name,email,role,unit FROM users WHERE id=?', (session.get('uid'),)).fetchone()

    def secured(fn):
        @wraps(fn)
        def wrapped(*args, **kwargs):
            g.user = user()
            if not g.user:
                abort(401, 'Entre na sua conta para continuar.')
            return fn(*args, **kwargs)
        return wrapped

    def ticket(tid):
        row = db().execute('SELECT t.*,u.name AS author,u.unit FROM tickets t JOIN users u ON u.id=t.user_id WHERE t.id=?', (tid,)).fetchone()
        if not row or (g.user['role'] != 'admin' and row['user_id'] != g.user['id']):
            abort(404, 'Chamado não encontrado.')
        return row

    def value(data, key, minimum=1, maximum=200):
        raw = data.get(key, '')
        if not isinstance(raw, str) or not minimum <= len(raw.strip()) <= maximum:
            abort(400, f'Confira o campo {key}: entre {minimum} e {maximum} caracteres.')
        return raw.strip()

    @app.before_request
    def csrf():
        if request.path.startswith('/api/') and request.method in ('POST', 'PATCH', 'DELETE'):
            token = session.get('csrf')
            if not token or not secrets.compare_digest(token, request.headers.get('X-CSRF-Token', '')):
                abort(403, 'Sessão expirada. Atualize a página.')

    @app.after_request
    def headers(response):
        response.headers['X-Content-Type-Options'] = 'nosniff'
        response.headers['X-Frame-Options'] = 'DENY'
        response.headers['Referrer-Policy'] = 'same-origin'
        response.headers['Content-Security-Policy'] = "default-src 'self'; img-src 'self' blob:; style-src 'self'; script-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'"
        if request.path.startswith('/api/'):
            response.headers['Cache-Control'] = 'no-store'
        return response

    from werkzeug.exceptions import HTTPException
    @app.errorhandler(HTTPException)
    def error(exc):
        return jsonify(error=exc.description), exc.code

    @app.get('/')
    def home():
        return render_template('index.html')

    @app.get('/health')
    def health():
        return jsonify(status='ok')

    @app.get('/api/session')
    def get_session():
        session.setdefault('csrf', secrets.token_urlsafe(32))
        current = user()
        return jsonify(user=dict(current) if current else None, csrf=session['csrf'], statuses=STATUSES, categories=CATEGORIES, priorities=PRIORITIES)

    @app.post('/api/login')
    def login():
        data = request.get_json() or {}
        email = value(data, 'email', maximum=254).lower()
        password = value(data, 'password', maximum=128)
        # Limit repeated attempts by account, persisted across workers.
        cutoff = datetime.now(timezone.utc).timestamp() - 900
        db().execute('DELETE FROM login_attempts WHERE occurred < ?', (cutoff,))
        count = db().execute('SELECT count(*) FROM login_attempts WHERE email=?', (email,)).fetchone()[0]
        if count >= 10:
            abort(429, 'Muitas tentativas. Aguarde 15 minutos.')
        row = db().execute('SELECT * FROM users WHERE email=?', (email,)).fetchone()
        if not row or not check_password_hash(row['password'], password):
            db().execute('INSERT INTO login_attempts VALUES (?,?)', (email, datetime.now(timezone.utc).timestamp()))
            db().commit()
            abort(401, 'E-mail ou senha incorretos.')
        db().execute('DELETE FROM login_attempts WHERE email=?', (email,))
        db().commit()
        session.clear()
        session.update(uid=row['id'], csrf=secrets.token_urlsafe(32))
        return jsonify(ok=True)

    @app.post('/api/logout')
    @secured
    def logout():
        session.clear()
        return jsonify(ok=True)

    @app.get('/api/tickets')
    @secured
    def list_tickets():
        rows = db().execute('SELECT t.id,t.protocol,t.title,t.category,t.location,t.priority,t.status,t.assignee,t.created_at,t.updated_at,u.name AS author,u.unit FROM tickets t JOIN users u ON u.id=t.user_id WHERE (?=\'admin\' OR t.user_id=?) ORDER BY t.id DESC', (g.user['role'], g.user['id'])).fetchall()
        return jsonify(tickets=[dict(r) for r in rows])

    @app.post('/api/tickets')
    @secured
    def create_ticket():
        data = request.form
        title = value(data, 'title', 5, 120)
        description = value(data, 'description', 10, 4000)
        location = value(data, 'location', 2, 160)
        category = value(data, 'category')
        if category not in CATEGORIES:
            abort(400, 'Categoria inválida.')
        photo = None
        upload = request.files.get('photo')
        if upload and upload.filename:
            try:
                with Image.open(upload.stream) as img:
                    if img.format not in ('JPEG', 'PNG', 'WEBP') or img.width * img.height > 20000000:
                        abort(400, 'Use uma foto JPG, PNG ou WebP de até 20 megapixels.')
                    img.thumbnail((1600, 1600))
                    output = io.BytesIO()
                    img.convert('RGB').save(output, format='JPEG', quality=85)
                    photo = output.getvalue()
            except (UnidentifiedImageError, OSError, Image.DecompressionBombError):
                abort(400, 'O arquivo não é uma imagem válida.')
        stamp = now()
        with db():
            cur = db().execute('INSERT INTO tickets (user_id,title,description,location,category,photo,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?)', (g.user['id'], title, description, location, category, photo, stamp, stamp))
            tid = cur.lastrowid
            protocol = f'CC-{datetime.now(timezone.utc).year}-{tid:05d}'
            db().execute('UPDATE tickets SET protocol=? WHERE id=?', (protocol, tid))
            db().execute('INSERT INTO history (ticket_id,actor_id,note,created_at) VALUES (?,?,?,?)', (tid, g.user['id'], 'Chamado aberto.', stamp))
        return jsonify(id=tid, protocol=protocol), 201

    @app.get('/api/tickets/<int:tid>')
    @secured
    def detail(tid):
        row = dict(ticket(tid))
        row['has_photo'] = row.pop('photo') is not None
        history = db().execute('SELECT h.note,h.created_at,u.name AS actor FROM history h JOIN users u ON u.id=h.actor_id WHERE ticket_id=? ORDER BY h.id', (tid,)).fetchall()
        return jsonify(ticket=row, history=[dict(r) for r in history])

    @app.get('/api/tickets/<int:tid>/photo')
    @secured
    def photo(tid):
        row = ticket(tid)
        if not row['photo']:
            abort(404)
        return send_file(io.BytesIO(row['photo']), mimetype='image/jpeg', download_name='foto.jpg')

    @app.patch('/api/tickets/<int:tid>')
    @secured
    def update(tid):
        if g.user['role'] != 'admin':
            abort(403, 'Apenas a administração pode alterar o atendimento.')
        row = ticket(tid)
        data = request.get_json() or {}
        status = value(data, 'status')
        priority = value(data, 'priority')
        assignee = value(data, 'assignee', 0, 120)
        note = value(data, 'note', 0, 2000)
        if status not in STATUSES or priority not in PRIORITIES:
            abort(400, 'Status ou prioridade inválidos.')
        if status in ('Em atendimento', 'Concluído') and not assignee:
            abort(400, 'Informe o responsável pelo atendimento.')
        if status == 'Concluído' and not note:
            abort(400, 'Descreva a solução para concluir o chamado.')
        changes = [f'{label}: {row[key]} → {new}' for key, label, new in [('status','Status',status),('priority','Prioridade',priority),('assignee','Responsável',assignee)] if row[key] != new]
        if not changes and not note:
            abort(400, 'Nenhuma alteração informada.')
        if note:
            changes.append(note)
        stamp = now()
        with db():
            db().execute('UPDATE tickets SET status=?,priority=?,assignee=?,updated_at=?,closed_at=? WHERE id=?', (status, priority, assignee, stamp, (row['closed_at'] or stamp) if status == 'Concluído' else None, tid))
            db().execute('INSERT INTO history (ticket_id,actor_id,note,created_at) VALUES (?,?,?,?)', (tid, g.user['id'], '\n'.join(changes), stamp))
        return jsonify(ok=True)

    @app.get('/api/users')
    @secured
    def users():
        if g.user['role'] != 'admin':
            abort(403)
        return jsonify(users=[dict(r) for r in db().execute('SELECT id,name,email,unit,role FROM users ORDER BY name')])

    def add_user(data):
        name = value(data, 'name', 2, 100)
        email = value(data, 'email', 3, 254).lower()
        if '@' not in email or '.' not in email.split('@')[-1]:
            abort(400, 'E-mail inválido.')
        password = value(data, 'password', 12, 128)
        unit = value(data, 'unit', 1, 80)
        role = data.get('role', 'resident')
        if role not in ('admin', 'resident'):
            abort(400, 'Perfil inválido.')
        try:
            with db():
                db().execute('INSERT INTO users (name,email,password,unit,role) VALUES (?,?,?,?,?)', (name, email, generate_password_hash(password), unit, role))
        except sqlite3.IntegrityError:
            abort(409, 'E-mail já cadastrado.')

    @app.post('/api/users')
    @secured
    def create_user():
        if g.user['role'] != 'admin':
            abort(403)
        add_user(request.get_json() or {})
        return jsonify(ok=True), 201

    @app.cli.command('create-admin')
    @click.option('--name', prompt='Nome')
    @click.option('--email', prompt='E-mail')
    @click.password_option(confirmation_prompt=True)
    def admin_command(name, email, password):
        add_user(dict(name=name, email=email, password=password, unit='Administração', role='admin'))
        click.echo('Administrador criado. Entre pela interface e cadastre os moradores.')

    return app
