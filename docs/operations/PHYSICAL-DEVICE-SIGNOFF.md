# Physical-device release sign-off

Browser viewport certification has passed. This record is for real hardware only and must not be pre-checked by an emulator.

## Devices

| Device | Minimum operating check | Status |
| --- | --- | --- |
| iPhone | Safari, portrait and landscape | Awaiting physical sign-off |
| iPad | Safari, portrait and landscape, keyboard if available | Awaiting physical sign-off |
| Android phone | Chrome, portrait and landscape | Awaiting physical sign-off |
| Desktop/laptop | Chrome plus keyboard-only pass | Browser-certified; physical spot check optional |

## Five-minute device path

For each device:

- [ ] Open https://master-ceo-dashboard.vercel.app
- [ ] Confirm the builder disclosure appears and no login is required.
- [ ] Open and close navigation.
- [ ] Open VisionWeaver, LandWeaver, GrantOS, THELMA, CMGIO/MAP and EC Integration Fabric.
- [ ] Confirm each workspace uses the full screen and no page scrolls sideways.
- [ ] Scroll the horizontal workspace tabs; the page itself must remain fixed horizontally.
- [ ] Open Ask THELMA and close it with the visible control.
- [ ] Rotate portrait ↔ landscape and confirm content remains reachable.
- [ ] Increase browser text size one step and confirm controls remain usable.
- [ ] Confirm buttons are easy to tap without hitting neighboring controls.
- [ ] Capture only defect screenshots; never capture credentials or private data.

## Keyboard and assistive checks

On iPad with a keyboard or desktop:

- [ ] Tab order follows visible reading order.
- [ ] Every focused control has a visible blue outline.
- [ ] Enter/Space activates focused buttons.
- [ ] Escape closes Ask THELMA.
- [ ] Browser zoom at 200% keeps primary controls reachable.

## Sign-off record

| Field | Entry |
| --- | --- |
| Tester | |
| Date/time and timezone | |
| Device/model | |
| OS/browser version | |
| Result | Pass / Fail |
| Defect reference | |
| Notes | |

A physical-device failure reopens the responsive gate. A pass does not activate login, provider execution or protected writes.
