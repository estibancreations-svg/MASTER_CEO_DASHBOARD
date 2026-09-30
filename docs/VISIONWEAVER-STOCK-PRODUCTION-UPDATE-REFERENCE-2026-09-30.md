# VisionWeaver advanced Stock and production update reference

**System:** `SYS-VISION-001`  
**Dashboard relationship:** Attached workspace and governed executive reporting surface  
**Status:** Documentation reference added 2026-09-30; buildout not yet certified as deployed.

## Purpose

This document connects the CEO Dashboard to the current VisionWeaver Stock and advanced-production specification. It is a reference point for executive status, approval, risk, cost and release evidence; it does not declare a new Stock catalog or any external provider integration live.

## Canonical implementation references

- [VisionWeaver advanced README](https://github.com/estibancreations-svg/VisionWeaver/blob/main/README.md)
- [VisionWeaver Stock and Production Buildout Review](https://github.com/estibancreations-svg/VisionWeaver/pull/1) — merge this first; then the stable README and specification paths on `main` become the dashboard's canonical references.
- [VisionWeaver Drive review copy](https://drive.google.com/file/d/1tJEpLVAKNeia4nmZRXwruuW2GqbibFVQ/view?usp=drivesdk)
- [Private conversation and governance record PR](https://github.com/estibancreations-svg/Master-System-Buildout/pull/23)

The private conversation record is intentionally not copied into the public VisionWeaver repository. The associated recordings remain untranscribed; no requirement attributed to their spoken contents should be treated as confirmed until a genuine transcript is attached and reconciled.

## Executive reporting contract

The dashboard should surface:

| Area | Evidence expected |
| --- | --- |
| Project state | approved source, selected canon/character/environment/version locks, current stage and owner |
| Stock/asset state | asset class, internal/external source, rights state, license receipt, restrictions, selected version and scene placement |
| Production state | planned vs. actual runtime, segment/assembly state, provider job receipts, render failures/retries |
| Review state | separate editorial, continuity, technical, rights and release decisions with reviewer and timestamp |
| Cost and risk | credit/usage estimates and actuals, rights expiry, provider exception, missing asset, policy or quality blockers |
| Distribution state | approved target, export manifest, publication handoff/receipt and outstanding destination-specific restriction |

## Guardrails

1. A dashboard status tile does not create a license, rights clearance, provider connection or completed production.
2. “Searchable” or “previewable” stock is not equivalent to acquired or cleared stock.
3. External publishing remains an explicit authorized action with a recorded receipt.
4. Any asset with unresolved rights, attribution, age/audience, commercial-use or territorial restriction blocks only the affected composition/target and must create an actionable exception.
5. Secrets remain in protected server-side configuration; no provider secret belongs in dashboard client code or documentation.
6. Long-form completion is reported from the assembled and inspected master, not from a requested duration or successful individual clip.

## Delivery gates

Before showing the advanced Stock capability as live in the dashboard, verify:

- the deployed VisionWeaver schema and storage support immutable asset/version records, source/rights records, scene placement and lineage;
- tenant/RLS isolation and server-side authorization are proven;
- at least one external provider acquisition/receipt path and one owned-asset path work end-to-end;
- export preflight blocks a known restricted asset and emits a usable manifest for a cleared composition;
- runtime, review, cost and failure telemetry reach the dashboard as real receipts;
- the two audio recordings have a true transcript if their statements are to become requirements.

