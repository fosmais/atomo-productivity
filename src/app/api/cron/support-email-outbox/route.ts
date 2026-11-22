import { NextResponse } from "next/server";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { sendSupportEmail } from "@/lib/support/email";


export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`)
    return NextResponse.json({ error: "Não autorizado." }, { status: 401, headers: { "Cache-Control": "no-store" } });
  if (process.env.MIKA_EMAIL_ENABLED !== "true" || !process.env.RESEND_API_KEY)
    return NextResponse.json({ processed: 0, disabled: true }, { headers: { "Cache-Control": "no-store" } });

  // In non-production, never claim queued messages without an explicit test-recipient allowlist.
  // Otherwise, rejected messages would consume retries and become permanently failed.
  if (process.env.VERCEL_ENV !== "production" && !(process.env.MIKA_SUPPORT_TEST_RECIPIENTS ?? "").split(",").some((address) => address.trim()))
    return NextResponse.json({ processed: 0, disabled: true, reason: "Test recipients not configured" }, { headers: { "Cache-Control": "no-store" } });

  try {
    const admin = createSupabaseAdmin();
    const testRecipients = (process.env.MIKA_SUPPORT_TEST_RECIPIENTS ?? "")
      .split(",").map((address) => address.trim().toLowerCase()).filter(Boolean);
    let pendingQuery = admin.from("support_email_outbox")
      .select("id,event_type,source_id,recipient,subject,payload,attempts,status,processing_started_at")
      .or(`status.eq.pending,and(status.eq.processing,processing_started_at.lt.${new Date(Date.now() - 10 * 60 * 1000).toISOString()})`);
    // Filter before LIMIT so a backlog of customer addresses cannot starve approved test mail.
    if (process.env.VERCEL_ENV !== "production") pendingQuery = pendingQuery.in("recipient", testRecipients);
    const { data: pending, error } = await pendingQuery.order("created_at", { ascending: true }).limit(10);
    if (error) throw error;

    let sent = 0, failed = 0, skipped = 0;
    for (const item of pending ?? []) {
      // Do not claim or burn retries for customer addresses in non-production.
      // Such messages remain queued until explicitly handled in the correct environment.
      if (process.env.VERCEL_ENV !== "production" &&
          !testRecipients.includes(String(item.recipient ?? "").trim().toLowerCase())) {
        skipped++;
        continue;
      }
      const nextAttempt = Number(item.attempts ?? 0) + 1;
      if (nextAttempt > 5) {
        let exhausted = admin.from("support_email_outbox")
          .update({ status: "failed", processing_started_at: null, last_error: "Limite de tentativas excedido" })
          .eq("id", item.id).eq("status", item.status).eq("attempts", item.attempts);
        if (item.status === "processing" && item.processing_started_at)
          exhausted = exhausted.eq("processing_started_at", item.processing_started_at);
        const { data: exhaustedRow, error: exhaustedError } = await exhausted.select("id").maybeSingle();
        if (exhaustedError) failed++; else if (exhaustedRow) failed++; else skipped++;
        continue;
      }
      // Compare-and-set claim prevents two concurrent workers from sending the same row.
      const leaseStartedAt = new Date().toISOString();
      let claim = admin.from("support_email_outbox")
        .update({ status: "processing", attempts: nextAttempt, processing_started_at: leaseStartedAt, last_error: null })
        .eq("id", item.id).eq("attempts", item.attempts);
      if (item.status === "pending") claim = claim.eq("status", "pending");
      else if (item.status === "processing" && item.processing_started_at)
        claim = claim.eq("status", "processing").eq("processing_started_at", item.processing_started_at);
      else { skipped++; continue; }
      const { data: claimed, error: claimError } = await claim.select("id").maybeSingle();
      if (claimError) { failed++; continue; }
      if (!claimed) { skipped++; continue; }

      const payload = item.payload && typeof item.payload === "object" ? item.payload as Record<string, unknown> : {};
      const message = typeof payload.message === "string" ? payload.message : "Novo registro de suporte na MYRYRA.";
      const ticketId = String(item.source_id);
      const customerAcknowledgement = item.event_type === "ticket_acknowledgement";
      // Deliver to the recipient captured when the event was queued; changing config must not reroute existing notices.
      const recipient = String(item.recipient ?? "");
      const emailMessage = customerAcknowledgement
        ? message.slice(0, 1500)
        : [
            "Tipo: " + String(item.event_type),
            "Protocolo: " + ticketId,
            "Categoria: " + String(payload.category ?? "geral"),
            "Assunto: " + String(payload.subject ?? item.subject ?? "Suporte"),
            "Usuário: " + String(payload.user_id ?? "não identificado"),
            "",
            message.slice(0, 1500)
          ].join("\n");
      // Treat provider/network exceptions as a failed attempt, not as a failure of the whole batch.
      // Keep the same idempotency key on retries, including after an ambiguous provider response.
      let result: { sent: boolean; reason?: string };
      try {
        result = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipient)
          ? await sendSupportEmail({
              to: recipient,
              subject: typeof item.subject === "string" ? item.subject.slice(0, 180) : "[MYRYRA] Novo atendimento",
              ticketId,
              idempotencyKey: `support-outbox/${item.id}`,
              message: emailMessage
            })
          : { sent: false, reason: "Destinatário inválido" };
      } catch {
        result = { sent: false, reason: "Falha temporária do provedor de e-mail" };
      }
      if (result.sent) {
        const { data: completed, error: updateError } = await admin.from("support_email_outbox")
          .update({ status: "sent", sent_at: new Date().toISOString(), processing_started_at: null, last_error: null })
          .eq("id", item.id).eq("status", "processing").eq("processing_started_at", leaseStartedAt)
          .select("id").maybeSingle();
        // A stale worker must not report success after another worker took the lease.
        if (updateError) failed++; else if (!completed) skipped++; else sent++;
      } else {
        const terminal = nextAttempt >= 5;
        const reason = (result.reason ?? "Falha no envio").slice(0, 300);
        const { data: completed, error: updateError } = await admin.from("support_email_outbox")
          .update({ status: terminal ? "failed" : "pending", processing_started_at: null, last_error: reason })
          .eq("id", item.id).eq("status", "processing").eq("processing_started_at", leaseStartedAt)
          .select("id").maybeSingle();
        if (updateError) failed++; else if (!completed) skipped++; else failed++;
      }
    }
    return NextResponse.json({ processed: sent + failed + skipped, sent, failed, skipped }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "Fila de e-mail indisponível." }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
