export type ExternalActionRequest = {
  connector: string;
  action: string;
  requiredScopes: string[];
  grantedScopes: string[];
  providerSupportsAction: boolean;
  userConfirmed: boolean;
};

export type ExternalActionPreflight =
  | { status: "invalid" | "handoff_only" | "authorization_required" | "confirmation_required"; canExecute: false; completed: false }
  | { status: "ready_to_execute"; canExecute: true; completed: false };

const SENSITIVE_ACTIONS = new Set(["purchase", "payment", "booking", "send_message", "publish", "delete"]);

/** No external action is executed here. A provider receipt is required for completion. */
export function preflightExternalAction(input: ExternalActionRequest): ExternalActionPreflight {
  if (!input || typeof input.connector !== "string" || !input.connector.trim() ||
      typeof input.action !== "string" || !input.action.trim()) {
    return { status: "invalid", canExecute: false, completed: false };
  }
  if (input.providerSupportsAction !== true) {
    return { status: "handoff_only", canExecute: false, completed: false };
  }
  if (!Array.isArray(input.requiredScopes) || !Array.isArray(input.grantedScopes) ||
      input.requiredScopes.some(scope => typeof scope !== "string" || !input.grantedScopes.includes(scope))) {
    return { status: "authorization_required", canExecute: false, completed: false };
  }
  if (SENSITIVE_ACTIONS.has(input.action) && input.userConfirmed !== true) {
    return { status: "confirmation_required", canExecute: false, completed: false };
  }
  return { status: "ready_to_execute", canExecute: true, completed: false };
}
