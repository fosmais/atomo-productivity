import { NextResponse } from "next/server";
import { BILLING_PLANS } from "@/lib/billing/plans";

/** Public catalogue. Never grants entitlements or initiates charges. */
export async function GET() {
  return NextResponse.json({
    provider: "asaas",
    checkoutEnabled: false,
    plans: Object.values(BILLING_PLANS).map((plan) => ({
      id: plan.id, name: plan.name, currency: plan.currency,
      monthlyPriceCents: plan.monthlyPriceCents,
      aiMessagesPerDay: plan.aiMessagesPerDay, features: plan.features,
    })),
  }, { headers: { "Cache-Control": "public, max-age=60" } });
}
