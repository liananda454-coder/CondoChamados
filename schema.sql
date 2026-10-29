PRAGMA foreign_keys=ON;
CREATE TABLE IF NOT EXISTS users (
 id INTEGER PRIMARY KEY, name TEXT NOT NULL, email TEXT NOT NULL UNIQUE,
 password TEXT NOT NULL, unit TEXT NOT NULL, role TEXT NOT NULL CHECK(role IN ('admin','resident'))
);
CREATE TABLE IF NOT EXISTS tickets (
 id INTEGER PRIMARY KEY, protocol TEXT UNIQUE, user_id INTEGER NOT NULL REFERENCES users(id),
 title TEXT NOT NULL, description TEXT NOT NULL, category TEXT NOT NULL, location TEXT NOT NULL,
 priority TEXT NOT NULL DEFAULT 'Normal' CHECK(priority IN ('Baixa','Normal','Alta','Urgente')),
 status TEXT NOT NULL DEFAULT 'Aberto' CHECK(status IN ('Aberto','Em análise','Em atendimento','Concluído')),
 assignee TEXT NOT NULL DEFAULT '', photo BLOB, created_at TEXT NOT NULL, updated_at TEXT NOT NULL, closed_at TEXT
);
CREATE INDEX IF NOT EXISTS tickets_user ON tickets(user_id);
CREATE TABLE IF NOT EXISTS history (
 id INTEGER PRIMARY KEY, ticket_id INTEGER NOT NULL REFERENCES tickets(id), actor_id INTEGER NOT NULL REFERENCES users(id),
 note TEXT NOT NULL, created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS history_ticket ON history(ticket_id);
CREATE TABLE IF NOT EXISTS login_attempts (email TEXT NOT NULL, occurred REAL NOT NULL);
