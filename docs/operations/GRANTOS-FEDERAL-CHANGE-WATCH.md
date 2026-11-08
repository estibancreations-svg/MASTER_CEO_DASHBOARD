# GrantOS federal change watch

This ledger records official changes that could affect GrantOS. The app reads `public/grantos/federal-change-watch.json` for its Federal Updates view. A repository update becomes visible after the app deploys the commit.

## Evidence and state

- `confirmed_change` states only what the linked federal source says.
- `likely_impact` is an assessment, often conditional on an integration that may not exist yet.
- `implementation_state: unverified` means the repository entry is recorded, not that GrantOS code or configuration has been changed.
- An inactive federal notice can remain here for historical reconciliation. It is not a current outage.
- Do not treat Contract Awards (procurement) as a grants opportunity or submission source.

## Key changes recorded through November 7, 2026

| Change | Effective date | GrantOS check | Official source |
| --- | --- | --- | --- |
| SAM.gov role requests currently fail with an error; active incident, no restoration estimate | No effective date published; alert published November 6, 2026 | For affected applicants, check the active alert before retrying SAM.gov role requests. This is not a GrantOS identity/authentication outage; no SAM role connector was found in the reviewed dashboard source. | [SAM.gov active Error alert](https://sam.gov/alerts/sam-role-requests-not-functioning) |
| SAM.gov and api.sam.gov certificates renew automatically on the announced November 10 rotation | November 10, 2026 | Before the date, inventory direct clients, certificate pinning, custom CA bundles, TLS inspection and proxies; verify the real network path. The notice does not specify a new issuer, chain, fingerprint or TLS setting. | [SAM.gov homepage announcement (Nov 3)](https://sam.gov/); [standing certificate notice](https://sam.gov/announcements/sam-site-certificates-validity-and-renewal-updates) |
| SAM.gov site certificates renew automatically under 100-day validity | March 15, 2027 | Inventory certificate pinning, bundled trust material, and proxy behavior for any SAM client | [SAM.gov announcement](https://sam.gov/announcements/sam-site-certificates-validity-and-renewal-updates) |
| Contract Awards report delay affecting dates from October 18, now marked inactive | October 18, 2026 | If imported, replay and reconcile the affected period | [SAM.gov alert](https://sam.gov/alerts/contract-awards-data-delayed-0) |
| Entity Management extracts posted seven days a week | September 6, 2026 | If an extract scheduler exists, verify Sunday/Monday processing | [SAM.gov alert](https://sam.gov/alerts/entity-management-extract-publishing-schedule-change) |
| Contract Awards API adds `publicDeltaDate` and optional commercial-product/service fields | August 25, 2026 | If a connector exists, test parser tolerance and reveal-date synchronization | [GSA API documentation](https://open.gsa.gov/api/contract-awards/) |
| SAM.gov higher-education certification under EO 14400 | October 28, 2026 | If higher-education applicants are in scope, verify threshold screening and applicant attestation; no SAM/entity-registration connector found in reviewed dashboard source | [SAM.gov announcement](https://sam.gov/announcements/new-certification-higher-education-institutions-now-available); [GSA FSD guidance](https://www.fsd.gov/gsafsd_sp/en/entity-registration-what-is-required-to-comply-with-the-save-college-sports?id=kb_article_view&sysparm_article=KB0106985) |

## Update procedure

1. Review Grants.gov, SAM.gov, GSA, and directly responsible federal sources. Compare with the prior ledger by stable `id` and source URL; ignore duplicate, routine funding, and unchanged notices.
2. Add only changes that could affect code, configuration, data mapping, security, integration, or workflow. Record a concrete effective date or `null` if the source does not give one. Do not invent publication dates.
3. Set the source fact, conditional impact, affected component, urgency, action type, and next verification or implementation step separately. State whether the actual connector and implementation have been verified.
4. Commit the JSON and any related code/config changes with a source-linked pull request. Validate JSON, the GrantOS view, and the project's release gates before merge. If verification fails, keep a reviewable PR and report the blocker.
5. For certificate-renewal notices, do not infer a new CA, chain, fingerprint, or TLS protocol from a generic renewal announcement. Verify actual dependencies and the deployed network path; never disable TLS verification.
6. For active service-status incidents, record the official publication/last-updated date, active state, and any stated end date separately from an effective date. Describe applicant workflow impact as conditional when no connector exists; do not conflate an external SAM.gov role issue with GrantOS authentication. Recheck the official alert before advising a retry.
7. Once implemented, revise the entry's implementation state with a commit or runtime evidence. Do not mark a source notice as deployed merely because it appears in this ledger.

The repository is the change record. Runtime integration and production readiness require separate evidence.
