import "server-only";
import { createHash } from "node:crypto";
import { createSupabaseAdmin } from "@/lib/supabase/admin";

type Kind = "customer" | "subscription";
type State = "reserved" | "remote_created" | "completed" | "needs_recovery";

/**
 * Unique DB reservation prevents concurrent duplicate provider writes.
 * An uncertain provider outcome must be reconciled manually before retrying.
 */
export async function reserveAsaasOperation(userId: string, kind: Kind, input: string, expected?: { customerId: string; planId: "pro" | "premium"; billingType: "PIX" | "CREDIT_CARD"; amountCents: number }) {
  const admin = createSupabaseAdmin();
  const fingerprint = createHash("sha256").update(input).digest("hex");
  const operationKey = `${kind}:${userId}:${fingerprint}`;
  const { data, error } = await admin.from("asaas_provisioning_operations")
    .insert({
      user_id: userId,
      operation_type: kind,
      operation_key: operationKey,
      request_fingerprint: fingerprint,
      state: "reserved",
      ...(expected ? { expected_customer_id: expected.customerId, expected_plan_id: expected.planId, expected_billing_type: expected.billingType, expected_amount_cents: expected.amountCents } : {}),
    })
    .select("id").single();
  if (error || !data) {
    throw new Error("Operação existente ou indisponível: reconciliação necessária antes de repetir.");
  }
  return data.id as string;
}

export async function updateAsaasOperation(id: string, state: State, providerId?: string) {
  const admin = createSupabaseAdmin();
  const { error } = await admin.from("asaas_provisioning_operations")
    .update({
      state,
      ...(providerId ? { provider_id: providerId } : {}),
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);
  if (error) throw new Error("Falha no registro de operação Asaas: requer reconciliação.");
}
