# MYRYRA MVP1 — Security and login block

Google OAuth uses the existing PKCE callback and MFA-aware routing.
The login Google button is hidden unless
`NEXT_PUBLIC_MYRYRA_GOOGLE_LOGIN_ENABLED=true` is configured at build time.
This flag does not enable the provider: Google Cloud and Supabase Auth OAuth
configuration are required separately.

`GET /api/auth/security-status` requires an authenticated Supabase user,
returns only verified TOTP factor counts and AAL status, and is no-store.
It never exposes TOTP secrets, session tokens, or recovery codes.

Before launch: test Google first login, existing account, denied consent,
expired callback, aal1/aal2, factor enrollment, lost factor, password recovery,
and Supabase redirect allowlists. Keep the approved login background and MYKA
art unchanged.
