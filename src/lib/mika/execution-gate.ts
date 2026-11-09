import { mikaActionDigest } from "./action-digest";
import { authorizeMikaAction, type MikaActionKind } from "./action-policy";
import { transitionMikaProposal, type MikaProposalStatus } from "./proposal-lifecycle";

type JsonValue = null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue };
/** A trusted, server-loaded proposal. Never populate this object from request JSON. */
export type StoredMikaProposal = {
  userId: string;
  actionId: string;
  kind: MikaActionKind;
  payload: JsonValue;
  payloadDigest: string;
  status: MikaProposalStatus;
  approvedBy: string | null;
  approvedAt: string | null;
  expiresAt: string;
};
export type MikaExecutionGate = { allowed: true; actionId: string } | {
  allowed: false;
  reason: "not_approved" | "approval_invalid" | "approval_expired" | "payload_mismatch" | "blocked_action";
};
/**
 * Pure preflight for a server-owned transaction. Caller must also atomically
 * claim the proposal (approved -> executing) under RLS before any mutation.
 * This check alone does NOT prevent races or replay.
 */
export function checkStoredMikaExecution(
  proposal: StoredMikaProposal, authenticatedUserId: string, now = Date.now()
): MikaExecutionGate {
  if (!authenticatedUserId || proposal.userId !== authenticatedUserId || proposal.approvedBy !== authenticatedUserId) {
    return { allowed: false, reason: "approval_invalid" };
  }
  if (proposal.status !== "approved" || !transitionMikaProposal(proposal.status, "start").ok) {
    return { allowed: false, reason: "not_approved" };
  }
  let digest: string;
  try {
    digest = mikaActionDigest(proposal);
  } catch {
    return { allowed: false, reason: "payload_mismatch" };
  }
  if (digest !== proposal.payloadDigest) return { allowed: false, reason: "payload_mismatch" };
  const decision = authorizeMikaAction({
    userId: proposal.userId,
    actionId: proposal.actionId,
    kind: proposal.kind,
    payloadDigest: digest,
    approval: {
      userId: proposal.approvedBy,
      actionId: proposal.actionId,
      payloadDigest: proposal.payloadDigest,
      expiresAt: proposal.expiresAt,
      approved: Boolean(proposal.approvedAt && Number.isFinite(Date.parse(proposal.approvedAt)) && Date.parse(proposal.approvedAt) <= now),
    },
  }, now);
  if (decision.allowed) return { allowed: true, actionId: proposal.actionId };
  if (decision.reason === "blocked_external_action") return { allowed: false, reason: "blocked_action" };
  if (decision.reason === "approval_expired") return { allowed: false, reason: "approval_expired" };
  return { allowed: false, reason: "approval_invalid" };
}
