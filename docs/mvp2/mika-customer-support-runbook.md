# MYRYRA MIKA Customer Support — release runbook

## Runtime flags

The support intake is authenticated and creates a ticket before attempting any AI response.

Required server-side Vercel environment variables:
- `RESEND_API_KEY`: Resend API key (never expose to client).
- `MIKA_EMAIL_ENABLED=true`: explicitly enables outbox delivery.
- `SUPPORT_INBOX_EMAIL`: optional; defaults to `support@myryra.com`.
- `CRON_SECRET`: secret used by Vercel Cron to authenticate the worker.
- `OPENAI_API_KEY`: existing server-side OpenAI key.
- `MIKA_SUPPORT_AI_ENABLED=true`: explicitly enables MIKA's support triage/reply.
- `MIKA_SUPPORT_MODEL`: optional; defaults to `gpt-4.1-mini`.

Keep the AI flag disabled until the isolated Preview passes the acceptance suite. The AI path additionally requires the authenticated user to have current legal acceptance. When the AI feature is disabled, consent is missing, the model fails, or the issue is outside the approved knowledge scope, the ticket remains open for human support.

## Delivery

Vercel Cron calls `/api/cron/support-email-outbox` every five minutes. The endpoint:
- requires `Authorization: Bearer <CRON_SECRET>`;
- is disabled unless `MIKA_EMAIL_ENABLED=true` and `RESEND_API_KEY` are present;
- claims pending rows with a compare-and-set status update;\n- recovers claims abandoned for more than ten minutes using a processing timestamp;
- retries provider failures up to five attempts;
- records sent/failed status without logging message contents or credentials.

## Safety and privacy

- Customer tickets are created server-side from the authenticated session; client-supplied user IDs are rejected.
- The support throttle is independent from MIKA/Concierge AI quotas (5 tickets/hour and 10/day).
- The AI is restricted to basic product guidance. Account, security, billing, refunds, personal-data and out-of-scope cases are escalated.
- The AI receives ticket text only after checking current legal acceptance.
- No production environment flags should be enabled until Preview verification is complete.

## Operational validation

1. Submit a synthetic ticket in Preview.
2. Confirm one `support_tickets` row and one `ticket_created` outbox row.
3. Call the cron endpoint with a synthetic secret and verify unauthorized requests return 401.
4. With email disabled, verify the worker reports disabled and does not mutate the queue.
5. With a valid Resend test key, verify one email, one sent row, and no duplicate on the next run.
6. Enable MIKA AI only in isolated Preview and test a known FAQ, an out-of-scope billing request, missing consent, and provider timeout.
7. Verify cross-user reads are denied and production flags remain unchanged.
