# CondoChamados

Sistema web de registro e acompanhamento de chamados do **Condomínio Happening Ipiranga**, desenvolvido como Projeto Integrador UNIVESP. Empresa de referência: **ANSERV GERAL – Portaria 360º** ([site informado](https://www.portaria360.com.br)). Projeto acadêmico; não implica homologação pela empresa.

## Versão online

A versão adaptada para Sites está em [`online/`](online/README.md), com autenticação ChatGPT e banco D1/fotos R2. A versão Flask abaixo permanece disponível para execução própria. A publicação e o acesso da versão online são independentes da execução Python.

## O que já funciona

- Login com senha protegida por hash; perfis de morador e administração.
- Cadastro de acessos pela administração, com nome, e-mail, torre/apartamento e perfil.
- Abertura de chamado com protocolo automático, categoria, local, descrição e foto opcional.
- Morador consulta somente os próprios chamados, inclusive as fotos e o histórico.
- Administração consulta todos, define prioridade e responsável, registra observações e solução.
- Fluxo: **Aberto → Em análise → Em atendimento → Concluído**. Permite reabrir/corrigir status, sempre registrando a alteração no histórico.
- Filtros por status/categoria e busca por protocolo, assunto, local ou responsável.
- Indicadores por status, interface responsiva, navegação por teclado e mensagens de erro.
- API REST, SQLite persistente, proteção CSRF, limitação de tentativas de login, validação e reprocessamento de imagens sem metadados originais.

## Executar no computador

Requer Python 3.11 ou superior. No terminal, dentro da pasta do projeto:

```bash
python -m venv .venv
# Windows PowerShell:
.venv\Scripts\Activate.ps1
# macOS/Linux: source .venv/bin/activate
python -m pip install -r requirements.txt
```

Gere um segredo com `python -c "import secrets; print(secrets.token_hex(32))"` e configure-o apenas no seu ambiente:

```powershell
# Windows PowerShell (substitua pelo valor gerado)
$env:SECRET_KEY="SEU_SEGREDO_ALEATORIO"
python -m flask --app app:create_app create-admin
python -m flask --app app:create_app run
```

No macOS/Linux, use `export SECRET_KEY='SEU_SEGREDO_ALEATORIO'` antes dos mesmos comandos Flask.
Abra **http://127.0.0.1:5000**, entre com o administrador criado e cadastre os moradores em **Moradores e acessos**. A senha deve ter pelo menos 12 caracteres. Não há senha padrão nem dados reais incluídos.

O banco é criado em `instance/condo.sqlite`, ignorado pelo Git. Preserve esse arquivo ao reiniciar; não o envie ao repositório público.

## Estrutura

```text
app.py                  Aplicação Flask, autenticação e API
schema.sql              Tabelas e índices
static/app.js           Interação com a API, filtros e indicadores
static/style.css        Layout responsivo
 templates/index.html   Interface de moradores e administração
 tests/test_app.py      Testes de fluxo, autorização e persistência
 docs/                  API, implantação e roteiro de validação
```

## Testar

```bash
python -m pip install -r requirements-dev.txt
python -m pytest -q
```

## Decisões e limites da primeira versão

Foi seguida a proposta mais recente do histórico: HTML/CSS/JavaScript + Python/Flask + banco + API REST. SQLite simplifica execução e demonstração acadêmica. Unidade e categoria são campos validados nesta versão; não existem cadastros separados de unidades/categorias. O responsável é uma pessoa/equipe registrada em texto, sem terceiro perfil de login.

Ainda dependem de operação/validação: hospedagem com HTTPS e disco persistente, política de backup, testes de usabilidade com moradores/administradora e evidências reais para o relatório. Recuperação de senha por e-mail, notificações, cadastro público e integração externa não fazem parte desta versão. Não use os canais de chamados para emergências.

- [API REST](docs/API.md)
- [Hospedagem e operação](docs/IMPLANTACAO.md)
- [Requisitos e validação do PI](docs/VALIDACAO.md)
