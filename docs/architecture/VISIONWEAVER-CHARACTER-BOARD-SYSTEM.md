# VisionWeaver Character Identity Board Contract

**Expanded specification — October 3, 2026:** The [Avatar State/animation integration](VISIONWEAVER-AVATAR-STATE-ANIMATION-INTEGRATION.md) links the current full contract and children's extension. It adds the configured 64-slot full-height profile, performance/learning/event dependencies and AS/CA acceptance. Exact camera calibration and runtime enforcement remain unresolved; the historical 32/16 rules below do not certify full coverage.

**Status:** Approved production standard · 2026-09-30
**Owner:** Estiban Creations / VisionWeaver
**Applies to:** MASTER_CEO_DASHBOARD, VisionWeaver, Runway reference generation, connected production records, and scene/cast workflows.

## Purpose

This contract keeps character identity stable while allowing scene-specific appearance changes. The dashboard may display and route board records, but the canonical production standard is maintained in VisionWeaver.

## Required board hierarchy

### A Cast Board

Scene-level, multi-character board. It remains the scene-fallout board and lists the characters actually present, their active state IDs, wardrobe, hair, makeup, injuries, props, expression, voice/accent, shot range, and continuity notes.

Example active states include Marcus Reynolds in a brown suit, blue suit, robe, unshaven, black eye, broken nose, or shadow beard.

### Character Detail Specifications Board

Canonical character detail source. It includes identity anchors, face geometry, skin texture, hair, facial hair, body, physical marks, injuries, wardrobe components, accessories, voice/accent, allowed variations, prohibited drift, provenance, and approvals.

### 360 View Board

Individual character board for generation anchoring and camera continuity.

## View-count rules

### Default: 32-view master

New characters and materially changed appearances use 32 views:

- 8 eye-level azimuth views;
- 8 high-oblique views;
- 8 low-oblique views;
- 8 extreme-oblique views.

High and low views are oblique. Do not require a direct top-of-head or direct underside view. The same character state, scale, light, backdrop, and wardrobe are maintained across the board. Detail insets cover face, eyes, skin, hair, hands, facial hair, injuries, wardrobe, accessories, and signature props.

### Controlled variant: 16-view state board

Use 16 views when identity and physical features remain unchanged and the production change is limited to clothing, an accessory, a scene prop, or a controlled expression/posture. It contains 8 eye-level views and 8 controlled oblique high/low views.

If the face, hair, facial hair, skin texture, body, or injury changes, the state requires a 32-view master or revised 32-view master.

## State and lock model

Use stable IDs in the form:

    <CHARACTER_ID>__<SCENE_OR_STATE>__v<NUMBER>

The Cast Board points to the active state. The active state points to the Detail Specifications Board and the 32-view master or 16-view state board. Approved prior states remain available for continuity and rollback.

## System behavior

- VisionWeaver generates and stores the board assets and source references.
- Runway receives the approved reference assets for image/video generation.
- The CEO Dashboard displays the board chain, approval state, active scene state, and provenance.
- Scene and shot records call the active state rather than recreating a character from a text-only prompt.
- Any change affecting identity anchors requires an approval gate before key frames or motion.
- 32-view masters can be exported as four 8-panel carousel cards plus detail cards.

## User-facing names

- A Cast Board
- Character Detail Specifications Board
- 360 View Board

See the canonical VisionWeaver standard at [standards/character-board-system-v1.md](https://github.com/estibancreations-svg/VisionWeaver/blob/main/standards/character-board-system-v1.md).