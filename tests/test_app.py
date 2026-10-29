import io
import sqlite3
import pytest
from PIL import Image
from werkzeug.security import generate_password_hash
from app import create_app

@pytest.fixture
def app(tmp_path):
    app = create_app({'TESTING':True,'SECRET_KEY':'test-only-secret','DATABASE':str(tmp_path/'test.sqlite')})
    with sqlite3.connect(app.config['DATABASE']) as db:
        for name,role in [('admin','admin'),('ana','resident'),('bia','resident')]:
            db.execute('INSERT INTO users (name,email,password,unit,role) VALUES (?,?,?,?,?)',(name,name+'@example.test',generate_password_hash('Test-password-123'),'Torre 1 / 101',role))
    return app

def headers(client):
    return {'X-CSRF-Token':client.get('/api/session').json['csrf']}

def login(app, name):
    client=app.test_client()
    assert client.post('/api/login',json={'email':name+'@example.test','password':'Test-password-123'},headers=headers(client)).status_code==200
    return client

def create(client, photo=False):
    data={'title':'Vazamento na garagem','description':'Há água caindo no teto do subsolo.','location':'Garagem','category':'Hidráulica'}
    if photo:
        stream=io.BytesIO();Image.new('RGB',(10,10)).save(stream,'PNG');stream.seek(0)
        data['photo']=(stream,'foto.png')
    return client.post('/api/tickets',data=data,headers=headers(client))

def test_complete_flow_and_history(app):
    resident=login(app,'ana'); admin=login(app,'admin')
    result=create(resident,True);assert result.status_code==201
    tid=result.json['id']
    for status in ['Em análise','Em atendimento','Concluído']:
        response=admin.patch(f'/api/tickets/{tid}',json={'status':status,'priority':'Alta','assignee':'Equipe hidráulica','note':'Reparo efetuado' if status=='Concluído' else 'Verificação em andamento'},headers=headers(admin))
        assert response.status_code==200
    detail=resident.get(f'/api/tickets/{tid}').json
    assert detail['ticket']['status']=='Concluído'
    assert detail['ticket']['closed_at']
    assert len(detail['history'])==4
    assert resident.get(f'/api/tickets/{tid}/photo').mimetype=='image/jpeg'

def test_isolation_and_permissions(app):
    ana=login(app,'ana');bia=login(app,'bia');tid=create(ana,True).json['id']
    assert bia.get('/api/tickets').json['tickets']==[]
    for suffix in ['', '/photo']:
        assert bia.get(f'/api/tickets/{tid}'+suffix).status_code==404
    assert ana.patch(f'/api/tickets/{tid}',json={},headers=headers(ana)).status_code==403
    assert ana.post('/api/users',json={},headers=headers(ana)).status_code==403
    assert ana.get('/api/users').status_code==403
    assert app.test_client().get('/api/tickets').status_code==401

def test_csrf_and_invalid_login(app):
    client=app.test_client()
    assert client.post('/api/login',json={}).status_code==403
    for _ in range(10):
        assert client.post('/api/login',json={'email':'ana@example.test','password':'bad'},headers=headers(client)).status_code==401
    assert client.post('/api/login',json={'email':'ana@example.test','password':'bad'},headers=headers(client)).status_code==429

def test_validation_and_closure(app):
    admin=login(app,'admin');tid=create(admin).json['id']
    for payload in [dict(status='Concluído',priority='Alta',assignee='Equipe',note=''),dict(status='Concluído',priority='Alta',assignee='',note='Reparado'),dict(status='Inexistente',priority='Alta',assignee='',note='')]:
        assert admin.patch(f'/api/tickets/{tid}',json=payload,headers=headers(admin)).status_code==400
    assert admin.post('/api/tickets',data={},headers=headers(admin)).status_code==400
    data={'title':'Portão travado','description':'O portão não está abrindo.','category':'Portões','location':'Entrada','photo':(io.BytesIO(b'<script>bad</script>'),'foto.png')}
    assert admin.post('/api/tickets',data=data,headers=headers(admin)).status_code==400

def test_user_registration_and_logout(app):
    admin=login(app,'admin')
    payload=dict(name='Nova pessoa',email='nova@example.test',unit='Torre 2 / 201',password='Unique-password-123',role='resident')
    assert admin.post('/api/users',json=payload,headers=headers(admin)).status_code==201
    assert admin.post('/api/users',json=payload,headers=headers(admin)).status_code==409
    rows=admin.get('/api/users').json['users'];assert len(rows)==4
    assert all('password' not in row for row in rows)
    assert admin.post('/api/logout',headers=headers(admin)).status_code==200
    assert admin.get('/api/users').status_code==401

def test_page_and_persistence(app):
    client=login(app,'ana');create(client)
    assert b'CondoChamados' in client.get('/').data
    assert 'frame-ancestors' in client.get('/').headers['Content-Security-Policy']
    other=create_app({'TESTING':True,'SECRET_KEY':'test-only-secret','DATABASE':app.config['DATABASE']})
    assert len(login(other,'ana').get('/api/tickets').json['tickets'])==1
