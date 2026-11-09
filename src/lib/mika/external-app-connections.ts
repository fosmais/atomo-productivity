import { EXTERNAL_APP_CAPABILITIES } from "@/lib/mika/external-app-registry";

export type ExternalAppConnectionState =
  | "available_to_open"
  | "not_connected"
  | "authorization_required"
  | "connected";

/**
 * Presentation-only view of app capabilities.
 * Never infer an OAuth connection from an app being listed or from a handoff URL.
 */
export function listExternalAppConnections(
  verifiedConnections: ReadonlyArray<{ appId: string; authorized: boolean }> = [],
) {
  return EXTERNAL_APP_CAPABILITIES.map((app) => {
    const verified = verifiedConnections.find((item) => item.appId === app.id);
    const status: ExternalAppConnectionState = app.apiExecutionEnabled
      ? verified?.authorized === true
        ? "connected"
        : verified
          ? "authorization_required"
          : "not_connected"
      : "available_to_open";

    return {
      id: app.id,
      label: app.label,
      status,
      handoffUrl: app.handoffUrl,
      canExecute: app.apiExecutionEnabled && status === "connected",
    };
  });
}
