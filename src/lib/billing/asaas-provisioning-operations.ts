import "server-only";
import { createHash, randomUUID } from "node:crypto";
import { createSupabaseAdmin } from "@/lib/supabase/admin";

type Admin = ReturnType<typeof createSupabaseAdmin>;
type OperationType = "customer" | "subscription";
type OperationState = "reserved" | "remote_created" | "completed" | "needs_recovery";

function fingerprint(userId: string, type: OperationType, context: string) {
  return createHash("sha256").update(JSON.stringify({ userId, type, context })).digest("hex");
}

/**
 * Reserve a provider operation before any outbound Asaas POST.
 * Repeated requests return the same operation and must never blindly repeat
 * a remote POST when state is reserved/remote_created/needs_recovery.
 */
export async function reserveAsaasSandboxOperation(
  admin: Admin, input: { userId: string; type: OperationType; context: string;
    customerId?: string; planId?: "pro" | "premium"; amountCents?: number },
) {
  if (!/^[0-9a-f-]{36}$/i.test(input.userId) || !input.context || input.context.length > 256) {
    throw new Error("Contexto de provisionamento inválido.");
  }
  if (input.type === "subscription" && (!/^cus_[A-Za-z0-9]+$/.test(input.customerId ?? "") ||
      (input.planId !== "pro" && input.planId !== "premium") ||
      !Number.isInteger(input.amountCents) || (input.amountCents ?? 0) <= 0)) {
    throw new Error("Assinatura de provisionamento inválida.");
  }
  const requestFingerprint = fingerprint(input.userId, input.type, input.context);
  const { data: existing, error: lookupError } = await admin
    .from("asaas_provisioning_operations")
    .select("id,state,provider_id,operation_key")
    .eq("user_id", input.userId).eq("operation_type", input.type)
    .eq("request_fingerprint", requestFingerprint).maybeSingle();
  if (lookupError) throw new Error("Falha ao consultar operação Asaas.");
  if (existing) return { ...existing, isNew: false as const };
  const operationKey = randomUUID();
  const { data, error } = await admin.from("asaas_provisioning_operations")
    .insert({
      user_id: input.userId, operation_type: input.type,
      operation_key: operationKey, request_fingerprint: requestFingerprint,
      state: "reserved",
      ...(input.type === "subscription" ? {
        expected_customer_id: input.customerId,
        expected_plan_id: input.planId,
        expected_amount_cents: input.amountCents,
      } : {}),
    })
    .select("id,state,provider_id,operation_key").single();
  if (error || !data) {
    const { data: concurrent, error: concurrentError } = await admin
      .from("asaas_provisioning_operations")
      .select("id,state,provider_id,operation_key")
      .eq("user_id", input.userId).eq("operation_type", input.type)
      .eq("request_fingerprint", requestFingerprint).maybeSingle();
    if (!concurrentError && concurrent) return { ...concurrent, isNew: false as const };
    throw new Error("Operação Asaas já existente ou indisponível para reserva.");
  }
  return { ...data, isNew: true as const };
}

export async function recordAsaasSandboxOperation(
  admin: Admin, input: { operationId: string; state: OperationState; providerId?: string },
) {
  const { data, error } = await admin.from("asaas_provisioning_operations")
    .update({
      state: input.state,
      ...(input.providerId ? { provider_id: input.providerId } : {}),
      updated_at: new Date().toISOString(),
    })
    .eq("id", input.operationId)
    .select("id").maybeSingle();
  if (error || !data) throw new Error("Falha ao registrar resultado Asaas; reconciliação manual necessária.");
}
