# Requisitos e validação acadêmica

## Problema e delimitação

O histórico do PI descreve solicitações dispersas em WhatsApp e contatos diretos com o síndico do Happening Ipiranga. O CondoChamados centraliza registro, classificação, direcionamento e acompanhamento. A empresa de referência é ANSERV GERAL – Portaria 360º. Não substitui sistemas financeiros ou toda a administração condominial.

| Necessidade | Implementação | Evidência a produzir |
|---|---|---|
| Identificar usuários e unidades | Login, perfil e campo torre/apartamento | Tela de acesso e cadastro com dados fictícios |
| Registrar problemas | Formulário com foto e protocolo | Abertura de ocorrência de teste |
| Acompanhar evolução | Status, histórico e consulta individual | Sequência completa de atendimento |
| Organizar atendimento | Prioridade, responsável, observação/solução | Demonstração do painel administrativo |
| Apoiar gestão | Contadores por status, filtros e busca | Tela de indicadores |
| Banco, JavaScript, framework e API | SQLite, JS, Flask e REST | Código e documentação técnica |
| Nuvem e versionamento | Código no GitHub; implantação documentada | URL hospedada ainda a obter |
| Acessibilidade e responsividade | Labels, foco visível, dialog nativo, mensagens e CSS responsivo | Testes humanos de teclado, leitor de tela e celular |

## Testes automatizados

`python -m pytest -q` verifica abertura com foto, fluxo até conclusão, histórico, persistência em nova instância, isolamento entre moradores, restrição administrativa, CSRF, limitação de tentativas, cadastro duplicado, imagem inválida e encerramento de sessão. Os dados são fictícios e o banco temporário é isolado.

## Roteiro com comunidade externa — ainda não executado

1. Criar um administrador e dois moradores fictícios.
2. Abrir chamado de vazamento com foto no perfil do primeiro morador.
3. Conferir protocolo e verificar que o segundo morador não o acessa.
4. Na administração, classificar prioridade, atribuir equipe e mudar status.
5. Concluir com descrição da solução; conferir o histórico pelo morador.
6. Buscar o protocolo, filtrar categoria e conferir os contadores.
7. Repetir em celular e usando somente teclado; avaliar leitura, contraste e mensagens.
8. Coletar feedback real do síndico/administradora e moradores, com os consentimentos aplicáveis.

Registrar data, participante autorizado, tarefa, resultado observado, dificuldade, sugestão e ação de melhoria. Capturas devem ocultar dados pessoais. Não apresentar feedback, aceitação, hospedagem ou resultados de usabilidade como realizados antes da execução.

Para o relatório: relacionar empresa → problema → requisitos → solução → testes → feedback → melhorias. Inserir capturas reais e o link da versão/commit avaliado. A nota 9,7 mencionada no histórico se refere ao relatório parcial, não à validação deste software.
