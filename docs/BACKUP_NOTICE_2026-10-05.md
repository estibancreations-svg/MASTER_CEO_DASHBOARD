# BACKUP NOTICE: Supabase data snapshot, 2026-10-05

**Repo:** MASTER_CEO_DASHBOARD (primary system). The same notice is in every repo under `estibancreations-svg`.

## WHAT THIS IS
A one-time **logical snapshot of the data** in the Supabase project named **"Master Dashboard"**, taken on **2026-10-05** before the "Fresh Build" (blank-slate) reset.

## WHERE IT IS
- Supabase project: **Master Dashboard**
- Schema: **`backup_20261005`**
- Contents: **123 table copies + `_manifest`**. The manifest lists each table, its row count and the time taken. **2,488 rows** in total.
- Verified: every copy's row count was compared to the live table and matched exactly (0 differences).

## WARNINGS (READ BEFORE RELYING ON THIS)
1. **Same project, not disaster recovery.** The snapshot lives inside the same Supabase project as the live data. If the project is deleted, paused-and-purged, or the database is lost, **the snapshot is lost with it**. It protects against bad edits and accidental deletes only. For real disaster recovery, use Supabase's own project backups and/or export the schema to an external location.
2. **Data only.** It has no primary keys, foreign keys, indexes, policies, triggers or functions. It is a safety copy, not a drop-in restore. Restore by copying rows back (`INSERT ... SELECT`) into the live tables.
3. **Credentials excluded on purpose.** `social_connections` and `oauth_flow_state` were NOT copied. They hold connection credentials and must never be duplicated.
4. **Snapshot of one moment.** Anything created after 2026-10-05 is not in it. It does not update itself.
5. **Locked down.** Row-level security is on and access is revoked for `anon` and `authenticated`. Only the service/admin role can read it. Do not expose this schema through the public API.
6. **Includes sample and test rows.** Much of the data is demo/test content (placeholder modules, "QA" projects, mock land parcels). A copy is not proof that any row is real.
7. **Repos are public.** This notice deliberately contains no keys, IDs or URLs. Never paste secrets into repos, issues or docs.
8. **Not production-certified.** The dashboard is a builder release. The existence of a backup does not change its release status.

## FRESH BUILD (RELATED)
The design set called "Fresh Build" (25 blank pages, 5 blank themes) and a draft reset script exist so the system can start blank and fill in as it is used. **The reset script has NOT been run.** Any run is a dry run (ends in ROLLBACK) until a person changes it to COMMIT. Do not run it without confirming this backup exists first.

## HOW TO CHECK THE BACKUP
In the Supabase SQL editor: `select * from backup_20261005._manifest order by table_name;`

*Created 2026-10-05 with Claude (Anthropic) at the request of the owner.*
