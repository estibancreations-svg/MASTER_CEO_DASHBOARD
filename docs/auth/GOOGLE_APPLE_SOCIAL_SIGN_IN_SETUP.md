# Google and Apple sign-in setup

This app already uses Supabase Auth's `signInWithOAuth()` flow and returns users to `/dashboard`. Google and Apple are deliberately gated by the provider-enabled flags returned by Supabase Auth. Their credentials are not stored in this repository or in frontend environment variables.

## Supabase project

Project ref: `yqealeekngxooyoemfba`

In Supabase Dashboard → Authentication → URL Configuration:

- Set Site URL to `https://master-ceo-dashboard.vercel.app`.
- Add `https://master-ceo-dashboard.vercel.app/dashboard` to Redirect URLs.
- For local Vite development, add `http://localhost:5173/dashboard`.

The app sets `redirectTo: ${location.origin}/dashboard`. Keep the list exact for production; only add preview URLs if they are needed for testing.

Provider callback URI (register this with both identity providers):

```
https://yqealeekngxooyoemfba.supabase.co/auth/v1/callback
```

## Google

1. In Google Cloud Console, create/select a project and configure the OAuth consent screen.
2. Create an OAuth client ID with application type **Web application**.
3. Add the Supabase callback URI above under **Authorized redirect URIs**.
4. In Supabase Dashboard → Authentication → Sign In / Providers → Google, enable Google and enter the Google OAuth client ID and client secret. Save.
5. Do not place the secret in Vite variables, GitHub, tickets, or chat.

Google’s provider setup guide: https://supabase.com/docs/guides/auth/social-login/auth-google

## Apple

1. In Apple Developer, enable **Sign in with Apple** for an App ID.
2. Create/configure a **Services ID** for web sign-in. Register the production domain and the Supabase callback URI above as the Return URL.
3. Create a Sign in with Apple key. Keep the downloaded private key secure.
4. Configure the Apple provider in Supabase with the Services ID as the client ID and a valid Apple client-secret JWT generated from the Apple Team ID, Key ID, and private key. Never commit the private key or JWT.
5. Enable Apple in Supabase Authentication → Sign In / Providers and save.

Apple and Supabase setup references:

- https://supabase.com/docs/guides/auth/social-login/auth-apple
- https://developer.apple.com/documentation/signinwithapple/configuring-your-environment-for-sign-in-with-apple

## Verify

1. Confirm Google and Apple are enabled in Supabase's provider settings.
2. Open the production login screen. The app reads `/auth/v1/settings`; each button changes from “setup required” to an enabled “Continue with …” action only when Supabase reports that provider as enabled.
3. Test Google and Apple separately in a private browser window. Confirm each returns to `/dashboard`.
4. Use an account with an active `ceo_organization_memberships` row. OAuth proves identity, but it does not grant CEO workspace authorization; the existing active-membership check remains in force.
5. Confirm the existing email-link login still works.

## Per-user memory is separate

OAuth provides a stable Supabase user ID and a session. It does not automatically save conversation context, preferences, drafts, or project history. This database currently has shared system memory, not a private per-user memory feature. Do not store private user context in shared memory. A later memory feature should have explicit user/org ownership, row-level security, retention/export/delete behavior, and UI controls for what is remembered.

## Current blocker

Provider setup is not complete until the Google OAuth client credentials and Apple Services ID/client-secret JWT are created and entered directly in Supabase's provider settings. No secrets are needed in GitHub. Until then, the app keeps the secure email sign-in link available and shows both social providers as setup-required.
