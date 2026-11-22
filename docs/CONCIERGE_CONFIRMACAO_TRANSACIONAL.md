# MYRYRA — Concierge: confirmação transacional segura
Data: 2026-11-04. Status: proposta técnica, NÃO aplicada ao banco ativo.

## Diagnóstico confirmado
A função atual public.myka_confirm_event(p_message_id uuid, p_user_id uuid) bloqueia a linha da proposta com FOR UPDATE, insere um evento e marca a proposta como saved na mesma transação. Isso protege confirmação/cancelamento da mesma proposta, mas não serializa duas propostas diferentes do mesmo usuário que disputem o mesmo horário.
A API /api/myka/proposal verifica conflitos locais antes da chamada RPC; outra confirmação pode ocorrer entre essa consulta e o INSERT (TOCTOU). O parâmetro acknowledgeConflict só é interpretado pela API e não é validado dentro da transação.
A função existente não revalida no banco: período válido, início não vencido, sobreposição com outros eventos ou a autorização para aceitar conflito. A função também não grava location e notes do objeto proposto.

## Contrato desejado (P0, bloqueador de homologação)
1. Autenticar o usuário na API e validar MFA, corpo JSON e ownership da proposta.
2. Confirmar em UMA transação de banco: lock por usuário (pg_advisory_xact_lock ou outra serialização comprovada), lock da proposta FOR UPDATE, status pending, validação de título/período/horário e busca de sobreposição em events com deleted_at IS NULL.
3. Se houver sobreposição e acknowledgeConflict != true, retornar status conflict sem INSERT nem alteração do status da proposta. Se houver confirmação consciente, permitir o conflito e registrar o reconhecimento, mantendo a serialização.
4. Para qualquer proposta vencida, inválida, cancelada ou de outro usuário, não criar evento.
5. Gravar location/notes, event_type e blocks_time segundo a política oficial da Agenda, sem confiar em campos extras do cliente.
6. Idempotência: confirmação repetida de uma proposta saved deve retornar o mesmo eventId, nunca inserir outro evento.
7. Não aceitar chamada RPC diretamente de anon/authenticated; restringir EXECUTE a service_role e conferir permissões. Usar search_path fixo e referências de schema qualificadas.
8. A checagem do Google Calendar é apenas informativa: não há transação distribuída com Google. Se a consulta externa falhar, avisar; não alegar disponibilidade confirmada.
9. Evitar exposição de títulos e dados de outros usuários; consultar somente user_id autenticado.

## Plano de implantação seguro
- Preparar migração versionada a partir do schema real e de um ambiente de staging; não alterar função ativa sem testes.
- Validar assinatura atual, privilégios EXECUTE, estrutura das tabelas e constraints antes de criar ou substituir RPC.
- Testar duas propostas diferentes confirmadas simultaneamente para o mesmo usuário: sem reconhecimento, no máximo uma deve ser salva; com reconhecimento explícito, comportamento definido.
- Testar duas contas, retries, confirmação/cancelamento concorrentes, evento excluído, evento vencido, intervalo invertido, timezone, Google indisponível e dados opcionais.
- Executar advisors de segurança e verificar logs sem PII; homologar rollback e somente depois aplicar à produção mediante autorização.
- Atualizar /api/myka/proposal para passar acknowledgeConflict à RPC atômica e tratar conflict (409), invalid/expired (422), saved (200).
- Só marcar CONCIERGE-01 como homologado com evidências de testes e build aprovado.

## Estado atual
Implementado: verificação local na interface e na API, consulta Google na interface, confirmação explícita.
Pendente: validação atômica dentro da RPC, idempotência com eventId persistido, testes de concorrência e homologação.
