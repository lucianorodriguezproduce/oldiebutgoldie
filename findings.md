# Findings: Scaling Research

## Discovery (Argentina Lead Gen)
- **Goal:** Identify potential buyers in Argentina by analyzing public Discogs collections.
- **Integration:** Mercado Pago (Future Phase).
- **Hosting/DB:** Firebase (Cost: $0).
- **Constraint:** Discogs API user search is limited; need a strategy to find "Argentina" based profiles.

## Geolocation Strategy ($0 Cost)
- **Option A:** `ipapi.co` (Free tier: 1000 requests/day).
- **Option B:** `ip-api.com` (Free for non-commercial, no API key).
- **Option C:** Browser `navigator.geolocation` (Requires user permission - less ideal for telemetry).
- **Verdict:** Use `ipapi.co` for silent telemetry on initial load/critical actions.
