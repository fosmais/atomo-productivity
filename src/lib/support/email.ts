const FROM = "MYRYRA Support <support@myryra.com>";
type SupportNotice = { to: string; subject: string; ticketId: string; message: string; idempotencyKey?: string };

export async function sendSupportEmail(notice: SupportNotice): Promise<{ sent: boolean; reason?: string }> {
  // Preview must never send customer-facing mail using inherited provider credentials.
  // Explicitly allow only dedicated test recipients, even when email delivery is enabled.
  if (process.env.VERCEL_ENV === "preview") {
    const allowed = (process.env.MIKA_SUPPORT_TEST_RECIPIENTS ?? "")
      .split(",").map((email) => email.trim().toLowerCase()).filter(Boolean);
    if (!allowed.includes(notice.to.trim().toLowerCase()))
      return { sent: false, reason: "Destinatário não autorizado para homologação" };
  }
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return { sent: false, reason: "RESEND_API_KEY não configurada" };
  // Transactional emails must never link customers to a Preview deployment.
  const url = "https://myryra.com";
  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json", ...(notice.idempotencyKey ? { "Idempotency-Key": notice.idempotencyKey } : {}) },
      body: JSON.stringify({
        from: FROM,
        to: [notice.to],
        subject: notice.subject,
        text: `${notice.message}\n\nProtocolo: ${notice.ticketId.slice(0, 8).toUpperCase()}\nAcompanhe seu chamado entrando na MYRYRA: ${url}\n\nEsta mensagem não solicita dados bancários ou senhas.`
      }),
      signal: AbortSignal.timeout(10000)
    });
    if (!response.ok) return { sent: false, reason: `Provedor retornou HTTP ${response.status}` };
    return { sent: true };
  } catch {
    // Never expose provider credentials or raw network errors to the caller.
    return { sent: false, reason: "Falha de comunicação com o provedor de e-mail" };
  }
}
