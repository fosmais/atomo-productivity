# MYRYRA Android — MVP1 foundation

Expo / React Native app scaffold, isolated from the Next.js web app.

## Local development

```powershell
cd apps/mobile
npm install
npx expo start
```

The Android application ID `com.myryra.app` is provisional; verify availability and ownership before publishing.
No login, push notifications, billing, calendar synchronization, or Play Store release is implemented in this scaffold.
Do not embed service-role keys or OpenAI secrets in the mobile app. Use user-scoped Supabase authentication and protected backend APIs.
Production release requires signing, privacy disclosures, store listing, Play Billing review, and device tests.
