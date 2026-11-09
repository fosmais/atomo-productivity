import "server-only";

export function asaasSandboxReady() {
  return process.env.ASAAS_ENVIRONMENT === "sandbox" &&
    Boolean(process.env.ASAAS_API_KEY) &&
    Boolean(process.env.ASAAS_WEBHOOK_TOKEN);
}

export async function asaasSandboxGet(path: string): Promise<unknown> {
  if (!asaasSandboxReady() || !/^\/[a-zA-Z0-9/_-]+$/.test(path)) {
    throw new Error("Asaas Sandbox não configurado.");
  }
  const response = await fetch(`https://api-sandbox.asaas.com/v3${path}`, {
    headers: { access_token: process.env.ASAAS_API_KEY!, accept: "application/json", "User-Agent": "MYRYRA/1.0" },
    cache: "no-store",
    signal: AbortSignal.timeout(10000),
  });
  if (!response.ok) throw new Error("Falha na consulta ao Asaas.");
  return response.json();
}

/** Server-only Sandbox write. Requires an explicit separate provisioning flag. */
export async function asaasSandboxPost(path: string, body: Record<string, unknown>): Promise<unknown> {
  if (!asaasSandboxReady() ||
      process.env.ASAAS_SANDBOX_PROVISIONING_ENABLED !== "true" ||
      !/^\/(customers|subscriptions)$/.test(path)) {
    throw new Error("Provisionamento Asaas Sandbox desabilitado.");
  }
  const response = await fetch(`https://api-sandbox.asaas.com/v3${path}`, {
    method: "POST",
    headers: {
      access_token: process.env.ASAAS_API_KEY!,
      accept: "application/json",
      "Content-Type": "application/json",
      "User-Agent": "MYRYRA/1.0",
    },
    body: JSON.stringify(body),
    cache: "no-store",
    signal: AbortSignal.timeout(15000),
  });
  if (!response.ok) throw new Error("Falha no provisionamento Asaas Sandbox.");
  return response.json();
}

/**
 * Fetch the authoritative payment state from Asaas Sandbox rather than trusting
 * webhook payloads. This helper does NOT activate a subscription.
 */
export async function getVerifiedAsaasSandboxPayment(paymentId: string): Promise<{
  id: string;
  status: string;
  subscription: string | null;
  customer: string;
  value: number;
  externalReference: string | null;
}> {
  if (!/^pay_[a-zA-Z0-9_-]{3,96}$/.test(paymentId)) {
    throw new Error("Referência de pagamento inválida.");
  }
  const response = await asaasSandboxGet(`/payments/${paymentId}`);
  if (!response || typeof response !== "object" || Array.isArray(response)) {
    throw new Error("Resposta inválida do Asaas.");
  }
  const payment = response as Record<string, unknown>;
  if (payment.id !== paymentId ||
      typeof payment.status !== "string" ||
      typeof payment.customer !== "string" ||
      typeof payment.value !== "number" ||
      !Number.isFinite(payment.value) ||
      payment.value <= 0 ||
      (payment.subscription != null && typeof payment.subscription !== "string") ||
      (payment.externalReference != null && typeof payment.externalReference !== "string")) {
    throw new Error("Dados de pagamento inconsistentes no Asaas.");
  }
  return {
    id: paymentId,
    status: payment.status,
    customer: payment.customer,
    subscription: typeof payment.subscription === "string" ? payment.subscription : null,
    value: payment.value,
    externalReference: typeof payment.externalReference === "string" ? payment.externalReference : null,
  };
}
