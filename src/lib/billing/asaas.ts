import "server-only";

export function asaasSandboxReady() {
  return process.env.ASAAS_ENVIRONMENT === "sandbox" &&
    Boolean(process.env.ASAAS_API_KEY) &&
    Boolean(process.env.ASAAS_WEBHOOK_TOKEN) &&
    process.env.BILLING_ENTITLEMENTS_ENABLED === "true";
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
