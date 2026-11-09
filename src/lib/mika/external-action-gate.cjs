"use strict";

/**
 * Universal external-app action gate.
 * A link handoff is never evidence of a completed external action.
 * Connector integrations must provide verified server-side authorization.
 */
const SENSITIVE_ACTIONS = new Set(["purchase", "payment", "booking", "send_message", "publish", "delete"]);

function evaluateExternalAction({ connector, action, scopes = [], grantedScopes = [], providerSupportsAction = false, userConfirmed = false } = {}) {
  if (typeof connector !== "string" || !connector.trim() || typeof action !== "string" || !action.trim()) {
    return { status: "invalid", canExecute: false, completed: false, reason: "connector_and_action_required" };
  }
  if (!providerSupportsAction) {
    return { status: "handoff_only", canExecute: false, completed: false, reason: "provider_action_unavailable" };
  }
  if (!Array.isArray(scopes) || !Array.isArray(grantedScopes) || scopes.some((scope) => typeof scope !== "string" || !grantedScopes.includes(scope))) {
    return { status: "authorization_required", canExecute: false, completed: false, reason: "missing_scopes" };
  }
  if (SENSITIVE_ACTIONS.has(action) && !userConfirmed) {
    return { status: "confirmation_required", canExecute: false, completed: false, reason: "explicit_confirmation_required" };
  }
  // This preflight gate never marks actions complete. Only a verified provider response may do that in an executor.
  return { status: "ready_to_execute", canExecute: true, completed: false, reason: "awaiting_provider_result" };
}

module.exports = { evaluateExternalAction };
