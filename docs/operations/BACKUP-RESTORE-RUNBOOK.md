# Backup, restore and continuity runbook

**System:** Master CEO Dashboard  
**Project:** `yqealeekngxooyoemfba`  
**Authority:** The Architect  
**Current mode:** builder release; no production-data restore drill has been claimed

## Recovery objectives

| Asset | Target RPO | Target RTO | Current truth |
| --- | ---: | ---: | --- |
| GitHub source and migration history | 1 hour | 2 hours | Active and verified through merged history |
| Vercel application release | 1 hour | 2 hours | Active and verified through READY rollback candidates |
| Supabase platform database backup | 24 hours | 8 hours | Planned until Dashboard backup availability is confirmed |
| Encrypted logical database export | 24 hours | 8 hours | Script complete; not executed until database connection and operator-controlled destination are approved |
| Supabase Storage objects | 24 hours | 8 hours | Planned separately; database backups include metadata, not deleted objects |

The private `recovery` schema now records policies, backup runs, restore drills and append-only recovery events. Drills cannot name production as their target environment.

## One-time preparation

1. In Supabase Dashboard, open **Master Dashboard → Connect** and copy the Session Pooler connection string.
2. Use the database password only in a local environment variable named `SUPABASE_DB_URL`. Do not commit it.
3. Install the current Supabase CLI, PostgreSQL client tools and `age`.
4. Generate an age identity on a trusted machine. Store the private identity offline in two controlled locations. The public recipient is safe to use when creating backups.
5. Select an operator-controlled encrypted destination. No workflow currently uploads database content to GitHub or another third party.

## Create an encrypted logical backup

Run from a trusted machine:

```bash
export SUPABASE_DB_URL='postgresql://...'
export BACKUP_AGE_RECIPIENT='age1...'
bash scripts/create-supabase-backup.sh /absolute/approved/backup-directory
```

The script:

- dumps roles, schema, data and migration history separately;
- excludes Storage vector tables as recommended by Supabase;
- captures source table, RLS and migration counts;
- encrypts before the artifact leaves its temporary directory;
- writes a SHA-256 checksum;
- removes plaintext temporary files.

Never commit the output, private age identity or connection string.

## Platform backup check

In Supabase Dashboard open **Database → Backups**.

- Pro, Team and Enterprise projects receive plan-dependent daily backups.
- Free projects require regular logical exports.
- Point-in-Time Recovery is an add-on and should not be marked enabled until the Dashboard shows an actual recovery window.
- Record the observed backup timestamp and retention in `recovery.backup_runs`; do not claim platform backup coverage from documentation alone.

## Non-production restore drill

Prefer Supabase **Restore to a new project** or Branching when available because those flows carry the Vault root key. For a manual logical drill:

1. Create a disposable Supabase project or local target.
2. Match required extensions, webhooks and Realtime publications.
3. Confirm the connection string does not contain the production project reference.
4. Run:

```bash
export RESTORE_DB_URL='postgresql://non-production-target'
export AGE_IDENTITY_FILE='/offline/path/age-identity.txt'
export ALLOW_RESTORE_DRILL='YES'
bash scripts/restore-supabase-drill.sh /absolute/path/backup.tar.gz.age
```

5. Verify schema and RLS counts, organization-scoped row counts, policies, functions, Realtime publications, Edge Functions and Storage objects.
6. Verify Vault portability. A manual restore to another project requires the source project encryption root key; do not assume copied ciphertext is readable.
7. Record the drill only after all required checks pass.
8. Destroy the disposable target and decrypted working files.

The restore script refuses the current production project reference and refuses backup files without a checksum.

## Storage continuity

Database backup does not restore deleted Storage objects. Before production assets are accepted:

- inventory every bucket and its access policy;
- choose an encrypted object-export destination;
- preserve object path, bucket, content type, checksum, size and source timestamp;
- run a separate upload/download/restore test;
- record the result in the recovery ledger.

## Emergency recovery order

1. Contain writes and record an incident/correlation ID.
2. Preserve logs and evidence.
3. Determine whether application rollback, database restore, Storage recovery or provider disablement is required.
4. Use the nearest verified recovery point before the fault.
5. Restore into staging first when time permits.
6. Reapply custom role passwords, publications, extensions, Edge Functions and external webhook configuration as required.
7. Run smoke, authorization, RLS, audit and reconciliation tests.
8. Resume writes only with Architect authorization.
9. Create the post-incident record and rotate any credential that may have been exposed.

## Drill schedule

- Application rollback readiness: every release.
- Logical backup verification: monthly during builder mode, daily after production data begins.
- Non-production restore drill: quarterly and before production certification.
- Storage object drill: quarterly after Storage becomes authoritative.
- Provider kill-switch and replay drill: during each connector activation.

## Official references

- [Supabase database backups](https://supabase.com/docs/guides/platform/backups)
- [Backup and restore using the CLI](https://supabase.com/docs/guides/platform/migrating-within-supabase/backup-restore)
- [Supabase Vault key portability](https://supabase.com/docs/guides/database/vault)
