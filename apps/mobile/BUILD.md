# Android build checklist (MVP1)

This is an Android scaffold, **not** a release-ready app.

1. From `apps/mobile`, install dependencies and run `npx expo-doctor` and `npm run typecheck`.
2. Configure `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY` for the isolated homologation environment. These are client-public values; never use a service-role key.
3. Create/associate an Expo EAS project using your Expo account (`npx eas-cli init`); this step requires account authorization.
4. For internal Android testing, use `npx eas-cli build --platform android --profile preview` (APK).
5. For Play Store delivery, use `npx eas-cli build --platform android --profile production` (AAB), after confirming Android application ID ownership, signing credentials, store policies, privacy disclosures and billing requirements.

**Not yet implemented:** Google sign-in, MFA challenge, calendar sync, MYKA, push, Google Play Billing and release signing. Do not ship production with these missing.
