import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { asaasSandboxGet } from "@/lib/billing/asaas";
import { verifyAsaasSubscriptionLink } from "@/lib/billing/asaas-links";

export const runtime = "nodejs";
const headers = { "Cache-Control": "no-store" };

function authorized(value: string | null, secret: string): boolean {
  if (!value || secret.length < 24) return false;
  const actual = Buffer.from(value, "utf8");
  const expected = Buffer.from(`Bearer ${secret}`, "utf8");
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

type Job = {
  id: number;
  event_type: string;
  provider_payment_id: string | null;
  attempts: number;
  locked_until: string;
};

/** Internal Sandbox-only, audit-only queue worker. Never grants paid access. */
export async function POST(request: Request) {
  if (process.env.ASAAS_ENVIRONMENT !== "sandbox" ||
      process.env.ASAAS_RECONCILIATION_QUEUE_ENABLED !== "true" ||
      !authorized(request.headers.get("authorization"), process.env.ASAAS_RECONCILIATION_SECRET || "")) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401, headers });
  }
  const admin = createSupabaseAdmin();
  let verified = 0;
  let rejected = 0;
  let retried = 0;
  for (let i = 0; i < 5; i++) {
    const { data, error } = await admin.rpc("claim_asaas_reconciliation_job", { p_lease_seconds: 120 });
    if (error) return NextResponse.json({ error: "Falha na reserva da fila." }, { status: 503, headers });
    const job = (data as Job[] | null)?.[0];
    if (!job) break;

    let state: "verified" | "rejected" | "retry" = "retry";
    let reason = "PROVIDER_UNAVAILABLE";
    try {
      if (!job.event_type.startsWith("PAYMENT_") || !job.provider_payment_id ||
          !/^pay_[A-Za-z0-9]+$/.test(job.provider_payment_id)) {
        state = "rejected";
        reason = "INVALID_EVENT";
      } else {
        const payment = await asaasSandboxGet(`/payments/${job.provider_payment_id}`) as Record<string, unknown>;
        if (payment.id !== job.provider_payment_id ||
            typeof payment.subscription !== "string" ||
            typeof payment.customer !== "string" ||
            typeof payment.status !== "string") {
          state = "rejected";
          reason = "INVALID_PAYMENT_DATA";
        } else {
          await verifyAsaasSubscriptionLink(payment.subscription, payment.customer);
          // Only confirmed/received payments may be audit-verified.
          if (payment.status === "CONFIRMED" || payment.status === "RECEIVED") {
            state = "verified";
            reason = "PROVIDER_PAYMENT_CONFIRMED";
          } else if (payment.status === "PENDING" || payment.status === "OVERDUE") {
            state = "retry";
            reason = "PAYMENT_UNCONFIRMED";
          } else {
            state = "rejected";
            reason = "PAYMENT_NOT_ELIGIBLE";
          }
        }
      }
    } catch {
      // A provider outage or an ownership mismatch must never grant access.
      state = "retry";
      reason = "VERIFICATION_FAILED";
    }
    const attempts = job.attempts + 1;
    if (state === "retry" && attempts >= 5) {
      state = "rejected";
      reason = "MAX_RETRIES";
    }
    const nextAttemptAt = new Date(Date.now() + Math.min(3600, 2 ** attempts * 60) * 1000).toISOString();
    const { data: completed, error: completionError } = await admin.rpc("complete_asaas_reconciliation_job", {
      p_job_id: job.id,
      p_expected_locked_until: job.locked_until,
      p_state: state,
      p_attempts: attempts,
      p_next_attempt_at: nextAttemptAt,
      p_error_code: state === "verified" ? null : reason,
    });
    if (completionError || completed !== true) {
      return NextResponse.json({ error: "Falha na finalização da reserva." }, { status: 503, headers });
    }
    if (state === "verified") verified++;
    else if (state === "rejected") rejected++;
    else retried++;
  }
  return NextResponse.json({ verified, rejected, retried, entitlementsActivated: false }, { headers });
}
