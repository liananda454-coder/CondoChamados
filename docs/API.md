# API REST

Todas as respostas usam JSON, exceto fotos. Autenticação por cookie de sessão. Consulte `GET /api/session` e envie o campo `csrf` no cabeçalho `X-CSRF-Token` em POST/PATCH. Após login, consulte a sessão novamente: o token é renovado. Datas em ISO 8601 UTC; a interface converte ao fuso do navegador.

| Método | Rota | Uso |
|---|---|---|
| GET | /api/session | Usuário atual, token e opções de categoria/status/prioridade |
| POST | /api/login | JSON: email, password |
| POST | /api/logout | Encerrar sessão |
| GET | /api/tickets | Lista autorizada: todos para admin; próprios para morador |
| POST | /api/tickets | multipart/form-data: title, description, category, location, photo opcional |
| GET | /api/tickets/{id} | Dados e histórico autorizados |
| GET | /api/tickets/{id}/photo | Foto JPEG, exige mesma autorização do chamado |
| PATCH | /api/tickets/{id} | Admin: JSON status, priority, assignee, note |
| GET | /api/users | Admin: acessos sem senhas |
| POST | /api/users | Admin: JSON name, email, password, unit, role (resident/admin) |
| GET | /health | Verificação simples de disponibilidade |

Cadastro de chamado retorna 201 com `id` e `protocol`. Cadastro de usuário retorna 201. Erros retornam `{"error":"mensagem"}` com 400 (validação), 401 (não autenticado), 403 (permissão/CSRF), 404 (inexistente ou não autorizado), 409 (e-mail duplicado), 413 (envio acima do limite) ou 429 (tentativas de login).

Conclusão exige responsável e solução. Alterações e observações são gravadas na mesma transação do histórico. Reabertura limpa `closed_at`, mantendo o registro histórico. Indicadores e filtros são calculados na interface sobre os registros autorizados; esta versão é destinada ao volume de um condomínio.
