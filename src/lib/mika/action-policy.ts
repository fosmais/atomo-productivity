/**
 * MIKA Agente action authorization policy.
 * This module only decides whether an action is eligible for execution.
 * It does not execute actions or persist approvals.
 */
export type MikaActionKind = "read_daily_plan" | "reserve_focus" | "create_task" | "create_event" | "external_booking" | "payment";
export type MikaActionDecision = { allowed: boolean; reason: "read_only" | "approved" | "approval_required" | "approval_expired" | "approval_mismatch" | "blocked_external_action" };
export type MikaActionRequest = {
  kind: MikaActionKind;
  userId: string;
  actionId: string;
  payloadDigest: string;
  approval?: { userId: string; actionId: string; payloadDigest: string; expiresAt: string; approved: boolean };
};
export function authorizeMikaAction(request: MikaActionRequest, now = Date.now()): MikaActionDecision {
  if (request.kind === "read_daily_plan") return { allowed: true, reason: "read_only" };
  if (request.kind === "payment" || request.kind === "external_booking") return { allowed: false, reason: "blocked_external_action" };
  const approval = request.approval;
  if (!approval?.approved) return { allowed: false, reason: "approval_required" };
  if (!request.userId || !request.actionId || !/^[a-f0-9]{64}$/i.test(request.payloadDigest) ||
      approval.userId !== request.userId || approval.actionId !== request.actionId || approval.payloadDigest !== request.payloadDigest) {
    return { allowed: false, reason: "approval_mismatch" };
  }
  const expires = Date.parse(approval.expiresAt);
  if (!Number.isFinite(expires) || expires <= now || expires > now + 15 * 60_000) {
    return { allowed: false, reason: "approval_expired" };
  }
  return { allowed: true, reason: "approved" };
}
