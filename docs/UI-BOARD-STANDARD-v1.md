# Estiban Creations UI Board Standard v1.2

Status: LOCKED DESIGN STANDARD
Effective: 2026-10-07

## Board model
Every first-class system page has its own board sheet and supports three approved visual compositions:
- Version 1 — alternate
- Version 2 — primary when explicitly selected
- Version 3 — alternate
The active primary is the default runtime composition. Alternates remain switchable and must not be deleted merely because a primary is selected.

## Global top command bar — REQUIRED ON EVERY PAGE
- Global search field at the page-center/top area.
- "Create" action at the page-center/top area.
- Notification bell at the page-center/top area.
- Do NOT render user profile, login, logout, account identity, or Architect identity in the top bar.

## Persistent side navigation
The left system rail is mandatory on every board and every composition.
- Desktop/tablet landscape: expanded by default.
- A visible sidebar toggle/collapse control lives at the top of the rail/header boundary (two-line/menu-bubble treatment).
- Collapsing the rail produces a compact icon rail; it does not remove navigation.
- Expanding restores labels and section groupings.
- Mobile/narrow layouts use the same control to open/close a drawer.
- Active page is visibly highlighted.
- Navigation structure, order, labels, THELMA access, and Architect/system-owner access remain consistent across V1/V2/V3.
- Sidebar state should persist per user/device when implemented.
- Accessibility: keyboard operable, focus visible, aria label announces Expand/Collapse navigation.

## VisionWeaver navigation baseline
Home; Vision Builder; Strategic Planner; Initiatives; Programs & Projects; AI Co-Pilot; CMI; Directors Guild; Teams; C-Suite.
Create & Produce: Book Creation; Avatar Engineering; Worlds & Locations; Design Studio; Design & Commercial; Scene & Production; Post Production; Distribution & Growth.
Manage & Govern: Quality & Audit; Finance & Accounting; IT & Security; Resources; Assets & Knowledge; Reports & Insights; Settings.
Sidebar footer order is LOCKED: user/profile/account control immediately above THELMA AI; THELMA remains the bottom assistant block.
Do not duplicate the user/profile/login control in the top bar.

## Worlds & Locations board lock
- Version 2 — PRIMARY / active.
- Version 1 — retained alternate.
- Version 3 — retained alternate.
Primary emphasis: interactive global map, filters, real + custom worlds, popular locations, World Building Tools, Location Packs, recent map activity.
All three versions retain the persistent side rail and collapse/expand control.

## Design Studio board lock
- Version 2 — PRIMARY / active.
- Version 1 — retained selectable alternate.
- Version 3 — retained selectable alternate.
- Search, Create, and notification bell use the global top command bar.
- User/account control is in the sidebar above THELMA, never in the top bar.

## Inheritance
These shell requirements apply to every existing page and every newly designed page across Estiban Creations systems.

## Change control
Do not replace an approved primary with an older shell or mockup. New boards inherit this standard automatically. A primary change requires explicit Architect approval. Runtime wiring and connection claims remain separately verified; visual approval does not certify a live integration.


## Settings: Visual Views & Color Schemes — LOCKED
- Settings exposes thumbnail selectors for approved Version 1, Version 2, and Version 3 page views; users may switch views and choose a default without deleting alternates.
- Settings exposes system-appropriate color schemes with preview swatches and accessible contrast.
- Strategic Notepad / Legal Pad / notebook-paper styling is permanently retired: not selectable, not a fallback, and not generated going forward. Existing notebook concepts migrate to the owning system's current visual language.

## Design & Commercial board lock
- Version 1 — PRIMARY / active.
- Version 2 — retained selectable alternate.
- Version 3 — retained selectable alternate.
- Global command label is Create (no decorative plus symbol).
