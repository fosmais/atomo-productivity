# MYRYRA MVP1 — Google OAuth + MFA

Implemented:
- Google OAuth PKCE initiation from the existing login page.
- Fixed same-origin callback `/auth/oauth-callback` exchanges the authorization code.
- Callback checks the authenticated user and MFA assurance level.
- Users requiring aal2 return to the existing TOTP challenge flow.
- No arbitrary `next` redirect accepted; errors return to login.

External configuration still required in Supabase:
1. Enable Google provider and configure its OAuth client ID/secret securely.
2. Add the exact provider callback URL in Google Cloud and configure Supabase Auth redirect allowlist for each Preview/production origin.
3. Test first-time signup, existing-account linking behavior, email verification, blocked user and MFA enrolled account.
4. Test denial/cancel, expired code, repeated callback, and session refresh.
5. Review login rate limits and recovery before launch.

No provider credentials were created or changed. The approved MYKA/login background and image are preserved.
