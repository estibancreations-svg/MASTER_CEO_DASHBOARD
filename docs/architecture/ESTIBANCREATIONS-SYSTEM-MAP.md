# Estibancreations System Map
## Canonical Authority

- Architect: Estibancreations
- Authority model: The Architect has final approval over execution, deployment, provider credentials, data migrations, and destructive actions.
- Canonical display name: Estibancreations
- Canonical GitHub handle: estibancreations-svg
- Canonical operational email currently verified across GitHub, Vercel, Lovable, and Supabase: estibancreations@gmail.com
- Do not treat alternate connected emails as separate Architects.
- Do not change account email addresses without explicit Architect approval.

## Verified Platform Map

| System | Source / Project | Runtime | Data / Auth | Status |
|---|---|---|---|---|
| CEO Dashboard | GitHub: estibancreations-svg/MASTER_CEO_DASHBOARD | Vercel: master-ceo-dashboard; production domain master-ceo-dashboard.vercel.app | Supabase: Master Dashboard, ref yqealeekngxooyoemfba | Live deployment verified; OTP access blocked for unprovisioned emails |
| VisionWeaver | MASTER_CEO_DASHBOARD source and release documentation | Same Vercel production project | Same Supabase project; provider credentials remain deployment configuration | Source and production path present; needs authenticated end-to-end run |
| THELMA AI | Master-System-Buildout governance and training materials; workflow references in MASTER_CEO_DASHBOARD | Runtime target: n8n / controlled serverless functions | Supabase system of record planned; no separate production runtime verified here | Mapped conceptually; production runtime not verified |
| GrantOS | Master-System-Buildout specifications and system-library material | No separate Vercel production project verified | Supabase schema/runtime not separately verified | Staged; repository/runtime mapping required |
| LandWeaver | Master-System-Buildout specifications and CEO Dashboard/Lovable system registry references | No separate Vercel production project verified | Supabase schema/runtime not separately verified | Staged; repository/runtime mapping required |

## Connected Account Inventory

- GitHub: Estiban Creations, estibancreations-svg, estibancreations@gmail.com; admin access verified.
- Vercel: Estibancreations team, estibancreations101, Hobby plan; production project and domains verified.
- Supabase: Estibancreations' Org; active project Master Dashboard verified.
- Lovable: Estiban's Lovable workspace; owner Estiban Creations / estibancreations@gmail.com; published project Estiban Command Nexus at https://csuite-command.lovable.app.
- Figma: connected account handle Steven Henry, seniorestibancreations@gmail.com, view seat. The Architect display identity remains Estibancreations; account-level rename/email alignment requires action in Figma and was not changed automatically.

## Launch Checklist

- [x] Confirm canonical Architect label and operational identity.
- [x] Confirm GitHub source repositories and permissions.
- [x] Confirm Vercel team, project, production domain, and latest deployment state.
- [x] Confirm Supabase project health and recent auth logs.
- [x] Confirm Lovable workspace and published command-center project.
- [ ] Provision the intended executive email in Supabase Auth or sign in with the existing provisioned account.
- [ ] Configure Google OAuth with a registered client ID/secret and callback URL.
- [ ] Configure Apple OAuth with Apple Developer credentials and callback URL.
- [ ] Complete authenticated smoke tests for CEO Dashboard and VisionWeaver.
- [ ] Map separate production repositories/projects for THELMA, GrantOS, and LandWeaver.
- [ ] Attach Figma source files and grant edit access where needed.
- [ ] Consolidate duplicate/legacy dashboard deployments after review.

## Current Blockers

1. Supabase Auth currently returns `422: Signups not allowed for otp` for unprovisioned email addresses.
2. OAuth provider credentials are not present in the connected management surfaces.
3. THELMA, GrantOS, and LandWeaver do not yet have independently verified production deployment targets.
4. The workspace does not contain local source code; source changes must go through the connected repositories.

_Last verified: 2026-08-30._
