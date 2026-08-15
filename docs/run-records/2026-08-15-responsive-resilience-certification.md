# Responsive and resilience certification — 2026-08-15

## Scope

Certification branch: `agent/certify-responsive-resilience`

This run covers the builder-mode dashboard and attached workspaces. It does not activate authentication, external providers, or protected production writes.

## Corrected boundary

Attached workspaces were rendered as the only child of a two-column legacy shell, placing the workspace in the 260 px sidebar column. The shell now declares `workspace-only`, expands the main/content boundary to the full viewport, preserves a 1600 px content maximum, and adds narrow-screen spacing and tab safeguards.

## Browser viewport evidence

| Profile | Requested frame | Browser client width | Page scroll width | Result |
| --- | ---: | ---: | ---: | --- |
| iPhone | 390 × 844 | 373 px | 373 px | Pass |
| Android | 412 × 915 | 395 px | 395 px | Pass |
| iPad | 768 × 1024 | 751 px | 751 px | Pass |
| Desktop | 1366 × 900 | 1349 px | 1349 px | Pass |

The client widths reflect the browser frame scrollbar. Every profile rendered non-empty dashboard content without page-level horizontal overflow.

VisionWeaver was opened inside the phone and desktop frames. Phone workspace/main/content widths were 373 px, its content surface was 345 px, and only the intentional horizontal tab strip scrolled. Desktop workspace/main/content widths were 1349 px and the VisionWeaver grid expanded to 1289 px.

Phone navigation opened and closed through labeled controls. Keyboard traversal produced a visible `3px solid #2f74ff` focus outline with a 2 px offset. Reduced-motion CSS disables animation, transition, and smooth scrolling.

## Interaction and contrast evidence

Mobile dashboard system actions and operating-queue icon actions were raised to at least 44 px. Header/menu icon controls were raised to 44 × 44 px.

Inspected foreground/background contrast ratios:

- briefing copy on workspace background: 6.59:1
- active workspace tab: 5.47:1
- return-to-dashboard control: 4.65:1

All inspected samples meet WCAG AA for normal text.

## Resilience evidence

- Builder disclosure visibly distinguishes seeded, read-only data from live operations.
- EC Fabric preview visibly distinguishes active, staged, deferred, and not-configured connectors.
- Empty module and activity states have explicit messages.
- Governed loading and failure states use status/alert semantics.
- Failure state exposes an explicit retry action; retry resets error/loading state and re-runs organization-scoped reads.
- EC Fabric surfaces bounded retries, safe dead letters, traceability, human override, and ASK-before-execution.
- The current production deployment is READY and recorded by Vercel as a rollback candidate. Previous READY production deployments provide additional application rollback points.
- Internal workflow certification previously proved synthetic transaction rollback with zero persisted test rows.

## Remaining before production certification

- Run a database backup/restore drill when the production data and authentication gate are enabled.
- Perform a physical-device spot check; this run certifies exact browser viewports, not hardware devices.
- Restore authentication and complete authenticated lifecycle, audit, and realtime tests.
