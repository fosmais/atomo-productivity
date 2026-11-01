/** Display-only subscription state mapping. Never grants entitlements. */
export type BillingLifecycleState =
  | "active" | "trialing" | "past_due" | "canceled" | "unpaid" | "incomplete" | "unknown";

export function normalizeBillingState(value: unknown): BillingLifecycleState {
  switch (value) {
    case "active":
    case "trialing":
    case "past_due":
    case "canceled":
    case "unpaid":
    case "incomplete":
      return value;
    default:
      return "unknown";
  }
}

export function billingStateLabel(value: unknown): string {
  switch (normalizeBillingState(value)) {
    case "active": return "Ativa";
    case "trialing": return "Em teste";
    case "past_due": return "Pagamento pendente";
    case "canceled": return "Cancelada";
    case "unpaid": return "Não paga";
    case "incomplete": return "Aguardando confirmação";
    default: return "Não confirmada";
  }
}
