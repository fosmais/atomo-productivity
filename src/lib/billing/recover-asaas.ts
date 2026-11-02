import "server-only";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { asaasSandboxGet } from "@/lib/billing/asaas";

type Operation = {
  id: string;
  user_id: string;
  operation_type: "customer" | "subscription";
  state: string;
  provider_id: string | null;
};
type ProviderObject = { id?: unknown; customer?: unknown; externalReference?: unknown };

export async function recoverAsaasProvisioningOperation(id: string): Promise<"completed" | "manual_review"> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) throw new Error("Operação inválida.");
  const admin = createSupabaseAdmin();
  const { data, error } = await admin.from("asaas_provisioning_operations")
    .select("id,user_id,operation_type,state,provider_id").eq("id", id).maybeSingle();
  if (error || !data) throw new Error("Operação não encontrada.");
  const op = data as Operation;
  if (op.state === "completed") return "completed";
  if (!op.provider_id) return "manual_review";

  const isCustomer = op.operation_type === "customer";
  if (!isCustomer && op.operation_type !== "subscription") return "manual_review";
  const pattern = isCustomer ? /^cus_[A-Za-z0-9]+$/ : /^sub_[A-Za-z0-9]+$/;
  if (!pattern.test(op.provider_id)) return "manual_review";

  const remote = await asaasSandboxGet(
    (isCustomer ? "/customers/" : "/subscriptions/") + op.provider_id,
  ) as ProviderObject;
  if (remote.id !== op.provider_id || remote.externalReference !== op.user_id) {
    return "manual_review";
  }

  if (isCustomer) {
    const { data: existing, error: readError } = await admin.from("asaas_customer_links")
      .select("asaas_customer_id").eq("user_id", op.user_id).maybeSingle();
    if (readError || (existing && existing.asaas_customer_id !== op.provider_id)) return "manual_review";
    if (!existing) {
      const { error: writeError } = await admin.from("asaas_customer_links")
        .insert({ user_id: op.user_id, asaas_customer_id: op.provider_id });
      if (writeError) return "manual_review";
    }
  } else {
    // Never infer a paid plan from a remote object or an untrusted webhook.
    // Subscription recovery requires a persisted plan and customer snapshot.
    return "manual_review";
  }

  const { error: completeError } = await admin.from("asaas_provisioning_operations")
    .update({ state: "completed", updated_at: new Date().toISOString(), last_error: null })
    .eq("id", op.id).eq("provider_id", op.provider_id);
  if (completeError) return "manual_review";
  return "completed";
}
