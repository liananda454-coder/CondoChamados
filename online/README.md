# CondoChamados — versão online privada

Central de chamados do Happening Ipiranga, com referência à ANSERV GERAL – Portaria 360º. Adaptação da aplicação Flask para hospedagem Sites (Vinext/TypeScript, D1 e R2).

## Acesso

Abra o endereço publicado e clique em **Entrar com ChatGPT**, usando a mesma conta proprietária. A plataforma autentica o visitante; a aplicação não recebe nem armazena senhas. Na primeira entrada, o único visitante permitido pelo site privado assume o perfil de administração, registrado atomicamente no banco. Não compartilhe o site antes de fazer esse primeiro acesso.

Moradores cadastrados precisam ter o e-mail de sua conta ChatGPT autorizado na aplicação e também acesso concedido na política de compartilhamento do site. Cadastrar alguém na aplicação não envia convites e não altera o compartilhamento. O site permanece privado à proprietária nesta entrega.

## Funcionalidades

Cadastro administrativo de membros, chamados com protocolo e foto, prioridades, responsável, quatro status, solução, histórico, filtros e indicadores. Morador acessa apenas seus registros; a administração vê todos. Atualizações concorrentes usam número de versão para evitar sobrescrita silenciosa. Fotos ficam no R2 e são entregues apenas após autorização. O servidor valida assinatura e tamanho; diferentemente da versão Flask, não reprocessa a imagem e não remove seus metadados.

## Arquitetura

- `lib/api.ts`: API autenticada e consultas ao D1.
- `lib/rules.ts`: validações e regras de autorização.
- `db/schema.ts`, `drizzle/`: schema e migrações do banco persistente.
- `lib/markup.ts`, `public/static/`: interface responsiva reaproveitada.
- `app/chatgpt-auth.ts`: autenticação da plataforma.
- `.openai/hosting.json`: identidade da hospedagem e bindings DB/BUCKET.

Esta versão online usa login ChatGPT; a versão Python no repositório original mantém o login por e-mail e senha. Não é integração com a ANSERV nem homologação do projeto.

## Validação

```bash
node node_modules/typescript/bin/tsc --noEmit
node node_modules/typescript/bin/tsc lib/rules.ts --outDir .sites-runtime/test-build --module ES2022 --target ES2022 --skipLibCheck
node --test tests/rules.test.mjs
node --experimental-vm-modules --test tests/integration.test.mjs
```

A integração roda o código real da API com SQLite em memória e identidade/R2 simulados. Verifica cadastro, foto, permissões, conclusão, histórico e concorrência. Não substitui validação humana com moradores, nem teste da autenticação real após publicação.

O banco de teste local é separado do banco publicado. Nenhum dado de demonstração é semeado em produção. Os chamados começam vazios. A autenticação real deverá ser concluída pela proprietária em seu primeiro acesso.
