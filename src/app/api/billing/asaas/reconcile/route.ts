import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { asaasSandboxReady } from "@/lib/billing/asaas";
import { verifyLinkedAsaasSandboxPayment } from "@/lib/billing/asaas-reconciliation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function authorized(request: NextRequest): boolean {
  const secret = process.env.ASAAS_RECONCILIATION_WORKER_SECRET;
  if (!secret || secret.length < 32) return false;
  const supplied = request.headers.get("authorization");
  if (!supplied?.startsWith("Bearer ")) return false;
  const a = Buffer.from(supplied.slice(7));
  const b = Buffer.from(secret);
  return a.length === b.length && timingSafeEqual(a, b);
}

/**
 * Single-job, sandbox-only reconciliation. Intentionally never grants entitlements.
 * Disabled by default until operational credentials and sandbox test are approved.
 */
export async function POST(request: NextRequest) {
  if (!authorized(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!asaasSandboxReady() || process.env.ASAAS_RECONCILIATION_WORKER_ENABLED !== "true") {
    return NextResponse.json({ error: "Worker disabled" }, { status: 503 });
  }
  try {
    const admin = createSupabaseAdmin();
    const { data: claimed, error: claimError } = await admin.rpc("claim_asaas_reconciliation_job", {
      p_lease_seconds: 120,
    });
    if (claimError) throw claimError;
    const job = Array.isArray(claimed) ? claimed[0] : null;
    if (!job) return NextResponse.json({ processed: 0, entitlementGranted: false });

    let state: "verified" | "rejected" | "retry" = "retry";
    let errorCode: string | null = null;
    try {
      if (typeof job.provider_payment_id !== "string" || !job.provider_payment_id) {
        state = "rejected";
        errorCode = "missing_payment_id";
      } else {
        const result = await verifyLinkedAsaasSandboxPayment(job.provider_payment_id, admin);
        if (!result.verified) {
          // Unlinked events may arrive before provisioning; keep retryable.
          state = result.reason === "unlinked_subscription" ? "retry" : "rejected";
          errorCode = result.reason;
        } else if (result.paymentStatus === "CONFIRMED" || result.paymentStatus === "RECEIVED") {
          // Evidence is verified; activation is a separate, currently disabled workflow.
          state = "verified";
        } else {
          state = "rejected";
          errorCode = "payment_not_settled";
        }
      }
    } catch {
      state = "retry";
      errorCode = "provider_or_database_unavailable";
    }
    const attempts = (Number(job.attempts) || 0) + 1;
    if (state === "retry" && attempts >= 8) {
      state = "rejected";
      errorCode = "retry_limit_exceeded";
    }
    const nextAttempt = new Date(Date.now() + Math.min(3600, 30 * 2 ** Math.min(attempts, 7)) * 1000).toISOString();
    const { data: completed, error: completionError } = await admin.rpc("complete_asaas_reconciliation_job", {
      p_job_id: job.id,
      p_expected_locked_until: job.locked_until,
      p_state: state,
      p_attempts: attempts,
      p_next_attempt_at: nextAttempt,
      p_error_code: errorCode,
    });
    if (completionError || completed !== true) throw completionError ?? new Error("Lease changed");
    return NextResponse.json({ processed: 1, state, entitlementGranted: false });
  } catch {
    return NextResponse.json({ error: "Reconciliation temporarily unavailable" }, { status: 503 });
  }
}
