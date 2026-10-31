# Auditoria P0 — RPCs da MYKA e MFA (2026-10-31)

## Evidência verificada diretamente no Supabase
- public.myka_confirm_task_item(uuid,integer) e public.myka_cancel_task_item(uuid,integer) são SECURITY DEFINER com search_path vazio.
- Role authenticated possui EXECUTE nas duas funções; role anon não possui EXECUTE.
- As duas funções verificam auth.uid(), validam índice e pertencimento da mensagem ao usuário.
- **Não há verificação de AAL2 nem de fatores MFA verificados dentro das funções.**
- A função confirm_task_item pode inserir em public.plans e public.tasks usando privilégios do definidor, sem depender de RLS do invocador.
- A interface e a API Next.js podem exigir MFA, mas chamadas diretas à RPC pelo token AAL1 não passam pela verificação da interface.

## Impacto
Para contas com TOTP ativado, uma sessão AAL1 pode potencialmente confirmar ou cancelar propostas de tarefas via Data API. A exploração depende de mensagem válida pertencente ao próprio usuário; não foi constatado acesso entre contas. **Bloqueador P0** para afirmar MFA integral.

## Correção proposta (não aplicada)
1. Implementar função helper SECURITY DEFINER em schema privado não exposto na Data API, com owner e grants restritos, que consulte fatores verificados de auth.mfa_factors e auth.jwt()->>'aal'.
2. Aplicar guard explícito em ambas as RPCs, antes de qualquer SELECT/INSERT: se usuário tiver fator verificado, exigir aal2; se não tiver, aceitar aal1/aal2.
3. Garantir que a helper não exponha dados de fatores e use search_path vazio com nomes qualificados.
4. Testar dentro de transações rollback com sessão JWT real de conta com MFA: AAL1 deve falhar e AAL2 deve passar; conta sem MFA deve funcionar.
5. Aplicar política equivalente nas seis tabelas após teste de permissões. **Não reutilizar** a política que consultava auth.mfa_factors diretamente sob authenticated (causava permission denied).
6. Verificar o fluxo da MYKA e RLS novamente, incluindo concorrência e idempotência.

**Não conceder SELECT direto em auth.mfa_factors ao role authenticated.**
**Não revogar EXECUTE indiscriminadamente**: o frontend utiliza as RPCs e isso quebraria o fluxo de confirmação.

## Critério de liberação
- [ ] RPCs rejeitam token AAL1 de conta com MFA verificado.
- [ ] RPCs aceitam token AAL2 de conta com MFA verificado.
- [ ] Conta sem MFA continua operacional.
- [ ] Nenhuma regressão de permissão nas seis tabelas.
- [ ] Teste com usuário B não acessa mensagens do usuário A.
