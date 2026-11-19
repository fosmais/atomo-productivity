# PR #60 — Plano de reconciliação com a branch de destino (19/11/2026)

## Evidência verificada
- Base: `feat/mvp2-professora-journey-myra-26` @ `16bc2f571470d732ca568a27eb18212755ee0a63`.
- Integração: `test/mvp2-journey-security-integration-57-59` @ `6193c4d44d46fececb6a768475ae5cf34d9d5b84`.
- GitHub: `mergeable=false`, `mergeable_state=dirty`; compare `diverged`, 32 commits à frente e 64 atrás.
- Não há confirmação de CI quality/regression no HEAD; apenas Vercel Preview Comments.
- Arquivos modificados em ambos os lados incluem `src/app/api/journeys/feedback/route.ts`, `src/lib/supabase/admin.ts`, `src/app/api/journeys/[journeyId]/route.ts`, `src/app/login/page.tsx`.

## Procedimento seguro
1. Criar uma branch de reconciliação a partir da base atual, preservando a PR #60 e o histórico original.
2. Revisar diferenças por função, não copiar arquivos inteiros. Preservar as mudanças recentes da base (especialmente lógica de aulas/avaliação).
3. Reaplicar somente controles de segurança comprovados da PR #60, incluindo owner-scoped writes, bloqueio de DELETE físico, exercício oficial canônico, vínculo obrigatório de sessão, aceite legal e guard de staging Preview.
4. Conferir compatibilidade das migrations e evitar executar SQL candidato fora de `supabase/migrations`.
5. Executar testes unitários, qualidade, regressão e E2E com duas contas autenticadas no staging. Resolver falhas antes de atualizar PR ou preparar release.
6. Verificar `mergeable=true` e CI no SHA final antes de solicitar aprovação. Sem merge/deploy PROD ou DDL sem autorização explícita.

## Gate de release
**Bloqueado.** Emissor POST oficial ainda não implementado. Staging e PROD possuem drift de schema; grants e concorrência de versões exigem revisão. Pagamentos reais permanecem desabilitados.
