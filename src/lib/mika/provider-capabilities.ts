/**
 * MIKA provider capability contract.
 *
 * A deep link is never evidence of an API integration. Only a provider adapter
 * backed by user authorization can claim a connected capability.
 */
export type MikaProviderCapability =
  | "open_app"
  | "read_data"
  | "create_draft"
  | "execute_action";

export type MikaConnectionState =
  | "not_configured"
  | "authorization_required"
  | "connected"
  | "expired"
  | "revoked";

export type MikaProviderAction = {
  providerId: string;
  capability: MikaProviderCapability;
  state: MikaConnectionState;
  /** The adapter must verify the grant server-side; client claims are not trusted. */
  authorizedUserId?: string;
  /** Explicit approval of the exact action, not a blanket account authorization. */
  confirmedByUser?: boolean;
  /** A stable unique key prevents retrying non-idempotent remote writes. */
  idempotencyKey?: string;
};

export type MikaActionDecision = {
  allowed: boolean;
  code:
    | "OPEN_ONLY"
    | "NOT_CONFIGURED"
    | "AUTHORIZATION_REQUIRED"
    | "CONNECTION_EXPIRED"
    | "CONNECTION_REVOKED"
    | "USER_MISMATCH"
    | "CONFIRMATION_REQUIRED"
    | "IDEMPOTENCY_REQUIRED"
    | "ADAPTER_REQUIRED";
};

/**
 * Fail closed: this policy never executes a provider operation.
 * The caller must separately validate the provider's server-side grant,
 * supported scopes, target resource and API adapter.
 */
export function evaluateMikaProviderAction(
  action: MikaProviderAction,
  authenticatedUserId: string,
): MikaActionDecision {
  if (action.capability === "open_app") {
    return { allowed: false, code: "OPEN_ONLY" };
  }
  if (action.state === "not_configured") return { allowed: false, code: "NOT_CONFIGURED" };
  if (action.state === "authorization_required") return { allowed: false, code: "AUTHORIZATION_REQUIRED" };
  if (action.state === "expired") return { allowed: false, code: "CONNECTION_EXPIRED" };
  if (action.state === "revoked") return { allowed: false, code: "CONNECTION_REVOKED" };
  if (!authenticatedUserId || action.authorizedUserId !== authenticatedUserId) {
    return { allowed: false, code: "USER_MISMATCH" };
  }
  if (action.capability === "execute_action") {
    if (action.confirmedByUser !== true) return { allowed: false, code: "CONFIRMATION_REQUIRED" };
    if (!action.idempotencyKey || action.idempotencyKey.trim().length < 16) {
      return { allowed: false, code: "IDEMPOTENCY_REQUIRED" };
    }
  }
  // The integration must still prove a real server-side adapter exists.
  return { allowed: false, code: "ADAPTER_REQUIRED" };
}
