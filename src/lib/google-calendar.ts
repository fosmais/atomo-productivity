import "server-only";
import { google } from "googleapis";

export const GOOGLE_CALENDAR_SCOPES = [
  // Required for user-authorized MYRYRA task reminder creation and updates.
  "https://www.googleapis.com/auth/calendar.events",
  "https://www.googleapis.com/auth/calendar.calendarlist.readonly",
  "https://www.googleapis.com/auth/tasks.readonly",
];

export function createGoogleOAuthClient() {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  // Dedicated callback avoids legacy GOOGLE_REDIRECT_URI collisions across Preview scopes.
  const redirectUri = process.env.GOOGLE_CALENDAR_OAUTH_REDIRECT_URI || process.env.GOOGLE_REDIRECT_URI;

  if (!clientId || !clientSecret || !redirectUri) {
    throw new Error("Credenciais OAuth do Google não configuradas.");
  }

  return new google.auth.OAuth2(
    clientId,
    clientSecret,
    redirectUri
  );
}