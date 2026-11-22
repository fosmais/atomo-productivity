# MIKA — integração de aplicativos: inventário verificado

Verificado no projeto Supabase ativo `atomo-productivity` em 2026-11-09, somente leitura.

## Tabelas existentes

- `public.google_calendar_connections`: `user_id`, `google_account_id`, `encrypted_access_token`, `encrypted_refresh_token`, `token_expires_at`, timestamps. RLS habilitada.
- `public.todoist_connections`: `user_id`, `encrypted_access_token`, timestamps. RLS habilitada.

Essas tabelas já existem: não criar tabelas duplicadas de conexão para Google Calendar ou Todoist.

## Regras para a próxima implementação

1. Verificar autenticação no servidor e identificar `user_id` pelo usuário autenticado, nunca por parâmetro enviado pelo navegador.
2. Exibir apenas metadados de conexão; nunca enviar tokens criptografados ou chaves ao cliente.
3. Não considerar uma linha no banco prova suficiente de acesso válido: conferir expiração, escopos e resposta do provedor antes de marcar uma operação como executável.
4. Manter a diferença entre `handoff` (abrir link), `connected` (autorização validada) e `executed` (confirmação verificável do provedor).
5. Aplicar isolamento por usuário e RLS. Revogação local não deve ser descrita como revogação no provedor sem chamada de revogação confirmada.
6. Não aplicar alterações diretamente ao banco de produção durante a implementação da UI.
7. Reutilizar os fluxos OAuth existentes; revisar cada um antes de acrescentar qualquer nova permissão.

## Pendências

- Inspecionar rotas OAuth e política RLS das tabelas existentes.
- Criar endpoint autenticado que retorne somente estado e capacidades seguras.
- Vincular a UI ao endpoint, preservando `available_to_open` quando não houver execução habilitada.
- Testar ausência de vazamento de credenciais e acesso entre usuários.
