/**
 * Deterministic MIKA proposal lifecycle. Pure state machine, not persistence.
 * A database transaction with a unique actionId and server-verified approval
 * must enforce these transitions before an executor is connected.
 */
export type MikaProposalStatus = "proposed" | "approved" | "executing" | "succeeded" | "failed" | "rejected" | "expired";
export type MikaProposalEvent = "approve" | "reject" | "start" | "succeed" | "fail" | "expire";
export type MikaTransitionResult = { ok: true; status: MikaProposalStatus } | { ok: false; reason: "invalid_transition" };
const transitions: Record<MikaProposalStatus, Partial<Record<MikaProposalEvent, MikaProposalStatus>>> = {
  proposed: { approve: "approved", reject: "rejected", expire: "expired" },
  approved: { start: "executing", reject: "rejected", expire: "expired" },
  executing: { succeed: "succeeded", fail: "failed" },
  succeeded: {}, failed: {}, rejected: {}, expired: {}
};
export function transitionMikaProposal(status: MikaProposalStatus, event: MikaProposalEvent): MikaTransitionResult {
  const next = transitions[status]?.[event];
  return next ? { ok: true, status: next } : { ok: false, reason: "invalid_transition" };
}
