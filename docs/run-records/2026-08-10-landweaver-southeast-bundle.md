# LandWeaver Southeast operating bundle — 2026-08-10

## Markets

- Florida: Tampa/Hillsborough, Orlando/Orange, Plantation/Broward, Sanford/Seminole
- Georgia: Atlanta/Fulton-DeKalb, Decatur/DeKalb, Augusta/Richmond, Savannah/Chatham, Norcross/Gwinnett
- Alabama Gulf: Mobile/Mobile County and Baldwin County markets Gulf Shores, Orange Beach, Foley, Daphne and Fairhope

## Runtime additions

- 15 market records with centers, county coverage, coastal flags and priority
- 12 provider/API registry entries
- User-owned provider settings containing configuration and secret references—not raw credentials
- 15 clearly labeled synthetic properties for interface and workflow validation
- Canonical Supabase memory for operating scope, data-truth rules and provider configuration
- API Settings view and regional mock portfolio in the CEO Dashboard

## Source strategy

Public adapters include the U.S. Census Geocoder, FEMA National Flood Hazard Layer, Florida Geographic Information Office catalog and Georgia tax-digest context. County parcel sources are registered as manual until their automation terms are verified. Listings/comparables and map services remain user-configurable licensed adapters.

Mock properties assert no real address, owner, parcel, valuation, zoning, hazard or listing fact. When the application is in use, users provide or authorize property-specific data and remain responsible for its accuracy; LandWeaver preserves provenance, timestamps, freshness and human-review requirements.

## Verification

- Supabase migration `landweaver_southeast_bundle_and_memory_20260810`: applied
- Markets: 15
- Providers: 12
- Synthetic portfolio: 15
- Canonical memory: 3 records
- TypeScript lint: passed
- Vite production build: passed
- `SYS-LAND-001`: 92%, healthy, QC passed
