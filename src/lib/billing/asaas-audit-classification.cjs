"use strict";

/** Pure classification, shared by the sandbox audit and Node tests. */
function classifyAsaasOperation(op, now) {
  const states = ["reserved", "remote_created", "completed", "needs_recovery"];
  const unknownState = !states.includes(op.state);
  const updatedAt = Date.parse(op.updated_at);
  const stalled = op.state !== "completed" &&
    (!Number.isFinite(updatedAt) || now - updatedAt > 15 * 60_000);
  const completedWithoutProviderId = op.state === "completed" && !op.provider_id;
  const remoteCreatedWithoutProviderId = op.state === "remote_created" && !op.provider_id;
  return {
    unknownState,
    stalled,
    completedWithoutProviderId,
    remoteCreatedWithoutProviderId,
    requiresReview: unknownState || op.state === "needs_recovery" || stalled ||
      completedWithoutProviderId || remoteCreatedWithoutProviderId,
  };
}

module.exports = { classifyAsaasOperation };
