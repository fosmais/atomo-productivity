/**
 * Server-controlled registry of external application capabilities.
 * A public handoff URL does not imply an authorized API integration.
 * Do not store OAuth tokens or user permissions in this file.
 */
export type ExternalAppCapability = {
  id: string;
  label: string;
  handoffUrl: string;
  apiExecutionEnabled: false;
};

export const EXTERNAL_APP_CAPABILITIES: readonly ExternalAppCapability[] = [
  { id: "uber", label: "Uber", handoffUrl: "https://m.uber.com/looking", apiExecutionEnabled: false },
  { id: "99", label: "99", handoffUrl: "https://99app.com/", apiExecutionEnabled: false },
  { id: "spotify", label: "Spotify", handoffUrl: "https://open.spotify.com/", apiExecutionEnabled: false },
  { id: "whatsapp", label: "WhatsApp", handoffUrl: "https://wa.me/", apiExecutionEnabled: false },
  { id: "google-maps", label: "Google Maps", handoffUrl: "https://www.google.com/maps", apiExecutionEnabled: false },
  { id: "youtube", label: "YouTube", handoffUrl: "https://www.youtube.com/", apiExecutionEnabled: false },
  { id: "google-calendar", label: "Google Calendar", handoffUrl: "https://calendar.google.com/", apiExecutionEnabled: false },
  { id: "waze", label: "Waze", handoffUrl: "https://www.waze.com/live-map/", apiExecutionEnabled: false },
] as const;

export function getExternalAppCapability(id: string): ExternalAppCapability | null {
  return EXTERNAL_APP_CAPABILITIES.find(app => app.id === id) ?? null;
}
