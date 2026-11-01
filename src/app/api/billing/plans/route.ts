import { NextResponse } from "next/server";
import { BILLING_PLANS } from "@/lib/billing/plans";

/** Public catalogue. Prices are informative until checkout is explicitly enabled. */
export async function GET() {
  const checkoutEnabled = process.env.BILLING_CHECKOUT_ENABLED === "true" &&
    process.env.BILLING_ENTITLEMENTS_ENABLED === "true" &&
    Boolean(process.env.MERCADOPAGO_ACCESS_TOKEN);
  return NextResponse.json({
    provider: "mercadopago",
    checkoutEnabled,
    plans: Object.values(BILLING_PLANS).map((plan) => ({
      id: plan.id, name: plan.name, currency: plan.currency,
      monthlyPriceCents: plan.monthlyPriceCents,
      aiMessagesPerDay: plan.aiMessagesPerDay, features: plan.features,
    })),
  }, { headers: { "Cache-Control": "public, max-age=60" } });
}
