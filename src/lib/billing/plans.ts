/**
 * MYRYRA MVP 1 — catálogo comercial e limites.
 * Configuração compartilhada: NÃO concede acesso por si só.
 * O servidor deve consultar uma assinatura verificada e aplicar as cotas
 * antes de executar chamadas pagas à IA.
 */
export const BILLING_PLANS = {
  free: {
    id: "free",
    name: "Free",
    monthlyPriceCents: 0,
    currency: "BRL",
    aiMessagesPerDay: 10,
    features: ["agenda", "tasks", "calendar_basic", "what_now_basic"],
  },
  pro: {
    id: "pro",
    name: "Pro",
    monthlyPriceCents: 2990,
    currency: "BRL",
    aiMessagesPerDay: 100,
    features: ["agenda", "tasks", "smart_calendar", "what_now", "daily_briefing", "autopilot", "weekly_intelligence"],
  },
  premium: {
    id: "premium",
    name: "Premium",
    monthlyPriceCents: 4990,
    currency: "BRL",
    aiMessagesPerDay: 250,
    features: ["agenda", "tasks", "smart_calendar", "what_now", "daily_briefing", "autopilot", "weekly_intelligence", "advanced_insights", "goals"],
  },
} as const;

export type BillingPlanId = keyof typeof BILLING_PLANS;
export type BillingFeature = (typeof BILLING_PLANS)[BillingPlanId]["features"][number];

export function isBillingPlanId(value: unknown): value is BillingPlanId {
  return typeof value === "string" && Object.prototype.hasOwnProperty.call(BILLING_PLANS, value);
}

export function getBillingPlan(value: unknown) {
  return BILLING_PLANS[isBillingPlanId(value) ? value : "free"];
}

/** Never use a plan supplied by the browser for authorization. */
export function hasBillingFeature(plan: BillingPlanId, feature: string): boolean {
  return (BILLING_PLANS[plan].features as readonly string[]).includes(feature);
}
