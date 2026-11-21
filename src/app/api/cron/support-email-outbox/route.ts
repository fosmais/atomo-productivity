import { NextResponse } from "next/server";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { sendSupportEmail } from "@/lib/support/email";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`)
    return NextResponse.json({ error: "Não autorizado." }, { status: 401, headers: { "Cache-Control": "no-store" } });
  if (process.env.MIKA_EMAIL_ENABLED !== "true" || !process.env.RESEND_API_KEY)
    return NextResponse.json({ processed: 0, disabled: true }, { headers: { "Cache-Control": "no-store" } });

  try {
    const admin = createSupabaseAdmin();
    const { data: pending, error } = await admin.from("support_email_outbox")
      .select("id,event_type,source_id,recipient,subject,payload,attempts")
      .eq("status", "pending").order("created_at", { ascending: true }).limit(10);
    if (error) throw error;

    let sent = 0, failed = 0, skipped = 0;
    for (const item of pending ?? []) {
      const nextAttempt = Number(item.attempts ?? 0) + 1;
      // Compare-and-set claim prevents two concurrent workers from sending the same row.
      const { data: claimed, error: claimError } = await admin.from("support_email_outbox")
        .update({ status: "processing", attempts: nextAttempt, last_error: null })
        .eq("id", item.id).eq("status", "pending").select("id").maybeSingle();
      if (claimError) { failed++; continue; }
      if (!claimed) { skipped++; continue; }

      const payload = item.payload && typeof item.payload === "object" ? item.payload as Record<string, unknown> : {};
      const message = typeof payload.message === "string" ? payload.message : "Novo registro de suporte na MYRYRA.";
      const ticketId = String(item.source_id);
      const recipient = process.env.SUPPORT_INBOX_EMAIL || "support@myryra.com";
      const result = await sendSupportEmail({
        to: recipient,
        subject: typeof item.subject === "string" ? item.subject.slice(0, 180) : "[MYRYRA] Novo atendimento",
        ticketId,
        message: [
          "Tipo: " + String(item.event_type),
          "Protocolo: " + ticketId,
          "Categoria: " + String(payload.category ?? "geral"),
          "Assunto: " + String(payload.subject ?? item.subject ?? "Suporte"),
          "Usuário: " + String(payload.user_id ?? "não identificado"),
          "",
          message.slice(0, 1500)
        ].join("\n")
      });
      if (result.sent) {
        const { error: updateError } = await admin.from("support_email_outbox")
          .update({ status: "sent", sent_at: new Date().toISOString(), last_error: null })
          .eq("id", item.id).eq("status", "processing");
        if (updateError) failed++; else sent++;
      } else {
        const terminal = nextAttempt >= 5;
        const reason = (result.reason ?? "Falha no envio").slice(0, 300);
        const { error: updateError } = await admin.from("support_email_outbox")
          .update({ status: terminal ? "failed" : "pending", last_error: reason })
          .eq("id", item.id).eq("status", "processing");
        if (updateError) failed++; else failed++;
      }
    }
    return NextResponse.json({ processed: sent + failed + skipped, sent, failed, skipped }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "Fila de e-mail indisponível." }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
