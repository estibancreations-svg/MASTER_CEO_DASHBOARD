# VisionWeaver v3 — Canonical UI Reference

**Date:** 2026-10-08  
**Authority:** The Architect / Estiban Creations  
**Status:** LOCKED VISUAL TARGET

## Canonical visual
Attached review image: `270763FC-5732-4CDF-B66A-87E9FDC2DC8E.jpeg`  
SHA-256: `f9156dd3dfb8df394f23f686ad750c608b51322367fb0e5053f105814a6f68fb`

This image is the acceptance target for the VisionWeaver production UI. The system is correct only when the deployed VisionWeaver workspace follows this visual language and page architecture.

## Required shell
- VisionWeaver brand: dark navy/black creative-production OS.
- Persistent left navigation.
- Sidebar collapse control.
- Search centered/top.
- `Create` button, no decorative plus sign.
- Notification bell.
- User/account block in sidebar immediately above THELMA AI.
- No CEO/Master Dashboard wrapper around the VisionWeaver workspace.
- No notebook/legal-pad/yellow-paper theme.
- Purple/blue/cyan primary accents with restrained green/pink/orange status accents.
- Alternate visual views are selected only from Settings > Visual Views.

## Locked page defaults visible in the reference
- Home Dashboard — V1.
- Vision Builder — V1.
- Strategic Planner — V1.
- Initiatives — V2.
- Programs & Projects — V2.
- AI Co-Pilot — V2.
- CMI — V1.
- Directors Guild — V2.
- Teams & C-Suite — V1.
- Assets & Knowledge — V2.
- Resources — V2.
- IT & Security — V2.
- Finance & Accounting — V1.
- Reports & Insights — V2.
- Settings — V2.
- Avatar Engineering — V2.

The broader navigation remains available for Book Creation, Worlds & Locations, Design Studio, Design & Commercial, Scene & Production, Post Production, Distribution & Growth, and Quality & Audit using their previously locked primary views.

## Runtime ownership
The production route is:
`https://master-ceo-dashboard.vercel.app/systems/visionweaver`

Runtime source of truth:
`MASTER_CEO_DASHBOARD/src/components/VisionWeaverWorkspace.tsx`

The old parallel Director Studio/hosted-shell implementation is no longer the production launch target. It may remain as historical/reference material, but it must not be presented as the canonical VisionWeaver system UI.

The `visionweaver-design-studio.vercel.app` root must route users to the canonical production workspace. The standalone Design Studio subsection remains at `/design-studio/`.

## Acceptance
A deployment that still shows the former generation-launcher/legacy workspace, CEO wrapper, or stale Director Studio shell does **not** satisfy this UI lock.
