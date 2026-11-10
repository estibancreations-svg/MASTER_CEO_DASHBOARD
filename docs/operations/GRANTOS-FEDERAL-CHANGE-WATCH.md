# GrantOS federal change watch

This ledger records official changes that could affect GrantOS. The app reads `public/grantos/federal-change-watch.json` for its Federal Updates view. A repository update becomes visible after the app deploys the commit.

## Evidence and state

- `confirmed_change` states only what the linked federal source says.
- `likely_impact` is an assessment, often conditional on an integration that may not exist yet.
- `implementation_state: unverified` means the repository entry is recorded, not that GrantOS code or configuration has been changed.
- An inactive federal notice can remain here for historical reconciliation. It is not a current outage.
- Do not treat Contract Awards (procurement) as a grants opportunity or submission source.

## Key changes recorded through November 9, 2026

| Change | Effective date | GrantOS check | Official source |
| --- | --- | --- | --- |
| SAM.gov role requests largely restored; rare error-message wording remains under correction; active Warning last updated November 8, 2026 | No effective date published; alert published November 6 and last updated November 8, 2026 | Requests are processing again correctly. If a user still sees an unexpected message, verify the actual role/request state in SAM.gov before retrying to avoid duplicates. This is not a GrantOS identity/authentication outage; no SAM role connector was found in the reviewed dashboard source. The ledger retains the November 6 Error state in `status_history`. | [SAM.gov active Warning](https://sam.gov/alerts/sam-role-requests-not-functioning) |
| SAM.gov Contract Awards data delay affecting report ranges on or after November 6; active Warning published November 9 | No separate effective date stated; November 6 is the affected report-range start | If a consumer exists, treat affected reports as incomplete/outdated until SAM.gov removes the warning, then re-fetch and reconcile. No direct Contract Awards connector or active ingestion was found in the reviewed dashboard source. This is procurement data, not a grant-opportunity/submission feed. | [SAM.gov active Warning](https://sam.gov/alerts/contract-awards-data-delayed-1) |
| SAM.gov and api.sam.gov certificates renew automatically on the announced November 10 rotation | November 10, 2026 | Before the date, inventory direct clients, certificate pinning, custom CA bundles, TLS inspection and proxies; verify the real network path. The notice does not specify a new issuer, chain, fingerprint or TLS setting. | [SAM.gov homepage announcement (Nov 3)](https://sam.gov/); [standing certificate notice](https://sam.gov/announcements/sam-site-certificates-validity-and-renewal-updates) |
| SAM.gov site certificates renew automatically under 100-day validity | March 15, 2027 | Inventory certificate pinning, bundled trust material, and proxy behavior for any SAM client | [SAM.gov announcement](https://sam.gov/announcements/sam-site-certificates-validity-and-renewal-updates) |
| Contract Awards report delay affecting dates from October 18, now marked inactive | October 18, 2026 | If imported, replay and reconcile the affected period | [SAM.gov alert](https://sam.gov/alerts/contract-awards-data-delayed-0) |
| Entity Management extracts posted seven days a week | September 6, 2026 | If an extract scheduler exists, verify Sunday/Monday processing | [SAM.gov alert](https://sam.gov/alerts/entity-management-extract-publishing-schedule-change) |
| Contract Awards API adds `publicDeltaDate` and optional commercial-product/service fields | August 25, 2026 | If a connector exists, test parser tolerance and reveal-date synchronization | [GSA API documentation](https://open.gsa.gov/api/contract-awards/) |
| SAM.gov higher-education certification under EO 14400 | October 28, 2026 | If higher-education applicants are in scope, verify threshold screening and applicant attestation; no SAM/entity-registration connector found in reviewed dashboard source | [SAM.gov announcement](https://sam.gov/announcements/new-certification-higher-education-institutions-now-available); [GSA FSD guidance](https://www.fsd.gov/gsafsd_sp/en/entity-registration-what-is-required-to-comply-with-the-save-college-sports?id=kb_article_view&sysparm_article=KB0106985) |


### November 8 status reconciliation

SAM.gov last updated the role-request alert on November 8, 2026 and changed its title/type from an Error notice to an active Warning: role requests are processing again correctly, but rare unexpected error-message wording remains under correction. The ledger updates the existing stable ID rather than creating a duplicate and preserves the November 6 failure state in `status_history`. Applicants who still see a message should verify the actual role/request state in SAM.gov before retrying; the message wording alone is not proof that processing failed. This remains an external SAM.gov service-status issue, not a GrantOS authentication defect.

### November 9 data-quality alert

SAM.gov published an active Warning on November 9, 2026 for a delay in Contract Awards Management and Data Bank. Reports covering date ranges on or after November 6, 2026 may be incomplete or outdated; the warning will be removed after the data refresh is completed. The source gives no separate effective date. This is a new incident distinct from the October 18 Contract Awards delay, which remains historically recorded as inactive. Repository searches found no direct SAM.gov Contract Awards client or active ingestion in the reviewed dashboard source. Keep the impact conditional; do not confuse procurement Contract Awards with assistance opportunities or grant submissions. If a consumer is discovered, flag the affected report range, wait for the official warning to clear, then re-fetch and reconcile before using the data for decisions.

## Update procedure

1. Review Grants.gov, SAM.gov, GSA, and directly responsible federal sources. Compare with the prior ledger by stable `id` and source URL; ignore duplicate, routine funding, and unchanged notices.
2. Add only changes that could affect code, configuration, data mapping, security, integration, or workflow. Record a concrete effective date or `null` if the source does not give one. Do not invent publication dates.
3. Set the source fact, conditional impact, affected component, urgency, action type, and next verification or implementation step separately. State whether the actual connector and implementation have been verified.
4. Commit the JSON and any related code/config changes with a source-linked pull request. Validate JSON, the GrantOS view, and the project's release gates before merge. If verification fails, keep a reviewable PR and report the blocker.
5. For certificate-renewal notices, do not infer a new CA, chain, fingerprint, or TLS protocol from a generic renewal announcement. Verify actual dependencies and the deployed network path; never disable TLS verification.
6. For service-status alerts, keep `source_status` aligned to the official Active/Inactive/Expired/Scheduled state; record Error/Warning/Informational separately in `source_alert_type`, and record incident recovery separately in `resolution_state`. When an alert changes, append a dated `status_history` observation under the same stable ID rather than deleting the prior state. Record publication/last-updated dates and any stated end date separately from an effective date. Describe applicant workflow impact as conditional when no connector exists; do not conflate an external SAM.gov role issue with GrantOS authentication. Recheck the official alert before advising a retry.
7. Once implemented, revise the entry's implementation state with a commit or runtime evidence. Do not mark a source notice as deployed merely because it appears in this ledger.

The repository is the change record. Runtime integration and production readiness require separate evidence.
