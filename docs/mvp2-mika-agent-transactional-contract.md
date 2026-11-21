# MIKA Agente — contrato transacional de propostas (MVP2)

**Status:** especificação para implementação em ambiente isolado. Não aplicar ao Supabase ativo sem homologação e revisão de segurança.

## Entidades

Tabela `public.mika_action_proposals` (RLS habilitado):
- `id uuid` (PK); `user_id uuid not null` (FK auth.users); `kind text not null` (enum lógico restrito: reserve_focus/create_task/create_event);
- `payload jsonb not null`; `payload_digest char(64) not null`; `status text not null default 'proposed'` com CHECK de estados permitidos;
- `approved_by uuid`, `approved_at timestamptz`, `expires_at timestamptz not null`;
- `execution_started_at timestamptz`, `finished_at timestamptz`, `result_ref uuid`, `failure_code text`;
- `created_at timestamptz default now()`, `updated_at timestamptz default now()`.

Tabela `public.mika_action_audit` (somente leitura pelo dono; escrita via funções de transição):
- `id bigint generated always as identity`, `proposal_id uuid`, `user_id uuid`, `transition text`, `occurred_at timestamptz default now()`, `request_id uuid`, `result_code text`.
- Não registrar tokens, dados pessoais dos payloads nem parâmetros secretos.

## Autorização e isolamento

- RLS SELECT: `user_id = (select auth.uid())` para authenticated.
- INSERT de proposta: dono igual a `auth.uid()`, estado `proposed`; porém **não confiar no payload_digest fornecido pelo cliente**. Preferir criação em endpoint autenticado que calcula o digest no servidor.
- Sem UPDATE/DELETE direto para authenticated em propostas ou auditoria. Transições somente via RPC com `SECURITY INVOKER` e grants mínimos; nunca service-role na execução de ações de usuários.
- A aprovação deve ser autenticada no servidor, vinculada ao mesmo `user_id`, ao `id` e ao digest calculado do payload canônico. Rejeitar alteração posterior de payload e digest.
- Consultar e respeitar o consentimento LGPD versionado exigido pela MYRYRA antes de propor ou executar mutações.

## Transação de execução única

1. Usuário solicita execução do `proposal_id` por endpoint autenticado, protegido contra CSRF e com rate limit.
2. RPC `claim_mika_action` valida `auth.uid()`, status `approved`, `approved_by`, validade e digest, e faz **UPDATE condicional** para `executing` com `WHERE status='approved'` e `RETURNING`. Exatamente uma chamada concorrente pode reivindicar.
3. Na mesma transação, gravar auditoria `approved -> executing` e reservar idempotency key única (`proposal_id`, `action_kind`).
4. **Ações internas de banco** devem executar e registrar `succeeded` ou `failed` em transação única sempre que possível. Para integração externa, usar outbox com retry seguro e chave idempotente do provedor; nunca considerar o claim isolado garantia de execução única externa.
5. Falhas e timeouts não devem reexecutar automaticamente uma ação cujo resultado é incerto. Estado `executing` requer reconciliação controlada.
6. Registrar auditoria terminal sem revelar payload. `succeeded`, `failed`, `expired` e `rejected` não podem voltar a `approved`.

## Critérios de aceite antes de PROD

- Testar duas contas autenticadas A/B, tentativa cross-user, sem sessão, aprovação adulterada, expiradas, replay, 20 claims simultâneos e isolamento RLS.
- Testar falha após claim, rollback, timeout e reconciliação; confirmar somente um evento/tarefa persistido por proposta.
- Verificar RLS e privilégios das duas tabelas e RPC, inclusive acesso anon e service-role não exposto no cliente.
- Verificar que cancelamento de UI não faz RPC de escrita.
- Habilitar apenas `reserve_focus`, `create_task`, `create_event` após testes. Pagamentos, Uber e reservas externas continuam bloqueados.
- Migrar primeiro em Supabase de homologação independente, executar testes e revisar CI; migração em PROD somente após autorização de release.
