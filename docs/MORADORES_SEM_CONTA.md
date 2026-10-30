# Moradores sem conta

A página inicial oferece registro de problema e consulta por protocolo e código privado. Nome e unidade são informados no chamado; não há criação de credencial para o morador. O código aleatório de 192 bits é exibido apenas na confirmação e pode ser salvo em comprovante. No banco persiste somente seu SHA-256. A consulta exige ambos os valores via POST e não publica nome/unidade nem fotos. A administração autenticada visualiza os dados e o anexo.

As tabelas adicionais são criadas de forma aditiva ao iniciar o aplicativo; chamados e usuários anteriores são preservados. Um registro interno não autenticável representa a origem pública, com nome e unidade de cada solicitante registrados separadamente. A API permanece compatível com moradores cadastrados anteriormente.

Proteções: CSRF, validação e tratamento de imagens, limite de 20 tentativas de abertura e 120 consultas por hora por endereço de rede, campo antispam e código aleatório. A limitação usa remote_addr, sem confiar em cabeçalhos arbitrários. Em hospedagens com proxy compartilhado pode atingir vários usuários; validar a configuração antes de adoção em escala.

Não há recuperação automática do código privado. Quem o perde deve procurar a administração. Quem possui protocolo e código pode visualizar o chamado correspondente; guardar o comprovante em local privado.

## Publicação no PythonAnywhere

No console Bash, depois de sair de qualquer prompt de senha com Ctrl+C:

```bash
cd ~/CondoChamados
git pull --ff-only origin feat/condochamados-mvp
```

Na aba Web, clicar Reload. O ambiente e o WSGI já configurados continuam válidos. Realizar backup consistente do SQLite antes de atualizar um ambiente com dados reais.

## Conta administrativa

Criar, se ainda não existir:

```bash
~/condo-venv/bin/python -m flask --app /var/www/lianandaunivesp_pythonanywhere_com_wsgi.py create-admin --name 'Livia Lima' --email 'liananda454@gmail.com'
```

Se já existir e a senha tiver sido esquecida:

```bash
~/condo-venv/bin/python -m flask --app /var/www/lianandaunivesp_pythonanywhere_com_wsgi.py set-admin-password --email 'liananda454@gmail.com'
```

O titular digita e confirma a senha diretamente no console; não enviar por chat. O formulário administrativo fica em Área da administração, na página inicial.

## Validação

Oito testes automatizados passaram localmente, incluindo criação pública, acompanhamento em outra sessão, rejeição de código incorreto, separação entre chamados, bloqueio de gestão e fotos sem autenticação, atualização pelo administrador, persistência após reinício, CSRF e limitação de solicitações. Publicação e inspeção visual desta versão ainda precisam ser verificadas no servidor.
