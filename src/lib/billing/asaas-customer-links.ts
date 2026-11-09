import "server-only";
import { createSupabaseAdmin } from "@/lib/supabase/admin";

/** Trusted server-side Asaas customer mapping; never accept userId from browser input. */
const userIdPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const customerIdPattern = /^cus_[A-Za-z0-9_-]{3,96}$/;

export async function findAsaasCustomerForUser(userId: string): Promise<string | null> {
  if (!userIdPattern.test(userId)) throw new Error("Identificador de usuário inválido.");
  const { data, error } = await createSupabaseAdmin()
    .from("billing_asaas_customer_links")
    .select("provider_customer_id")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw new Error("Falha ao consultar vínculo de cliente Asaas.");
  if (!data) return null;
  if (typeof data.provider_customer_id !== "string" ||
      !customerIdPattern.test(data.provider_customer_id)) {
    throw new Error("Vínculo de cliente Asaas inconsistente.");
  }
  return data.provider_customer_id;
}

/**
 * Insert-only association: a customer cannot be silently reassigned to another
 * user, and an existing user's customer cannot be overwritten by an upsert.
 * Database unique constraints provide the final concurrency protection.
 */
export async function registerAsaasSandboxCustomerLink(userId: string, customerId: string): Promise<void> {
  if (process.env.ASAAS_ENVIRONMENT !== "sandbox" ||
      process.env.ASAAS_SANDBOX_PROVISIONING_ENABLED !== "true") {
    throw new Error("Registro de clientes Asaas Sandbox desabilitado.");
  }
  if (!userIdPattern.test(userId) || !customerIdPattern.test(customerId)) {
    throw new Error("Referências de cliente inválidas.");
  }
  const admin = createSupabaseAdmin();
  const { error } = await admin.from("billing_asaas_customer_links")
    .insert({ user_id: userId, provider: "asaas", provider_customer_id: customerId });
  if (!error) return;

  // Concurrent retries may find the same immutable link. Other conflicts fail closed.
  const existing = await findAsaasCustomerForUser(userId);
  if (existing === customerId) return;
  throw new Error("Conflito no vínculo de cliente Asaas; requer conciliação manual.");
}

/**
 * Server-side orchestration for an authenticated user. The caller must pass
 * the user ID and email returned by Supabase Auth, never browser-supplied IDs.
 * A duplicate remote customer can be created if persistence fails; in that
 * case fail closed and reconcile manually rather than creating a subscription.
 */
export async function ensureAsaasSandboxCustomerForAuthenticatedUser(user: {
  id: string;
  email: string;
  name: string;
}): Promise<string> {
  if (process.env.ASAAS_ENVIRONMENT !== "sandbox" ||
      process.env.ASAAS_SANDBOX_PROVISIONING_ENABLED !== "true") {
    throw new Error("Provisionamento Sandbox desabilitado.");
  }
  if (!userIdPattern.test(user.id)) throw new Error("Usuário inválido.");
  const existing = await findAsaasCustomerForUser(user.id);
  if (existing) return existing;

  const { createAsaasSandboxCustomer } = await import("@/lib/billing/asaas");
  const customerId = await createAsaasSandboxCustomer({
    name: user.name,
    email: user.email,
    externalReference: user.id,
  });
  await registerAsaasSandboxCustomerLink(user.id, customerId);
  return customerId;
}
