# Implantação e operação

O repositório contém uma aplicação Flask real. GitHub Pages não executa Python nem armazena o banco. A publicação em nuvem **ainda não foi realizada**.

Use um servidor/container Python com HTTPS e volume persistente. Configure:

- `SECRET_KEY`: segredo aleatório exclusivo (mínimo recomendado: 32 bytes); nunca versionar.
- `DATABASE_PATH`: caminho no volume persistente, por exemplo `/data/condo.sqlite`.
- `COOKIE_SECURE=1`: cookies somente por HTTPS; no desenvolvimento HTTP, deixe desativado.

Instale `requirements.txt` e inicie em Linux com:

```bash
python -m gunicorn 'app:create_app()' --bind 0.0.0.0:8000 --workers 1 --threads 4
```

Execute `python -m flask --app app:create_app create-admin` uma única vez no mesmo ambiente/volume. O comando solicita uma senha sem exibi-la. Use o painel para cadastrar apenas moradores autorizados. Não há integração automática com a ANSERV ou serviços externos.

## Backup e dados

Banco e fotos ficam juntos no SQLite. Faça backups consistentes usando a API `sqlite3.Connection.backup` e teste a restauração. Não copie o arquivo durante escrita sem um mecanismo consistente. Não use volume temporário: reinícios de plataformas efêmeras podem apagar todos os chamados. Use uma única instância nesta versão; para escalar, planeje migração para PostgreSQL e armazenamento de objetos.

## Antes de receber dados reais

Validar com a administração quem pode acessar, finalidade e prazo de retenção dos dados; definir responsável por suporte e exclusão; fornecer aviso de privacidade. Não subir banco, fotos, senhas ou dados pessoais no GitHub público. Efetuar teste de HTTPS, persistência após reinício e restauração de backup. Não há autoatendimento de redefinição de senha nesta versão: suporte deve ser realizado por operador autorizado, sem compartilhar senhas entre usuários.
