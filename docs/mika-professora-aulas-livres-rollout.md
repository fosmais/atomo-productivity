# MIKA Professora — aulas livres (#19)

## Sequência segura

1. Criar migração versionada, com `mika_teacher_sessions.journey_id` anulável. Preservar a FK existente e os registros já criados. A política INSERT deve exigir `owner_id = auth.uid()` e permitir `journey_id IS NULL` **ou** jornada ativa do próprio usuário. Manter políticas SELECT, UPDATE e DELETE restritas ao proprietário. Verificar grants e advisors.
2. Adaptar API de sessões para modo livre e modo Journey, sem relaxar autenticação/MFA, limites de entrada e filtros por proprietário.
3. Na API de chat, autorizar sempre por `sessionId` e `owner_id`; obter tópico, nível e jornada da sessão armazenada, e nunca confiar em identificadores ou instruções de autorização do cliente.
4. Atualizar proposta de aula e UI: escolha entre `Aula livre` e `Minha Journey`; assunto obrigatório; listar, retomar, reagendar e excluir aulas de ambos os modos.
5. Validar em ambiente de homologação: usuário A não lê/edita sessões de B; sessão livre; sessão vinculada; chat e correção; persistência; retomada; reagendamento; mobile; casos 401/403/404; regressões.
6. Somente após testes funcionais autenticados e aprovação das pipelines, preparar publicação em produção com rollback.

## Atenções

- A alteração isolada de `NOT NULL` **não** habilita aulas livres; APIs e RLS precisam ser implantadas de forma coordenada.
- Não aplicar migração em produção antes da aplicação estar preparada e homologada.
- Agendamento de aula ainda não equivale a criação de evento no Google Calendar nem a envio de lembretes.
- Não misturar esta feature com a correção do PR #18.
