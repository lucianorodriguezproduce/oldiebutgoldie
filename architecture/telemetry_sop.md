# SOP: Geolocation Telemetry

## Goal
Identify the physical location (City, Region, Country) of users interacting with the app to build marketplace statistics.

## Inputs
- User's IP address (detected via `ip-api.com`).

## Workflow
1. On application seed/initial load, trigger a call to `http://ip-api.com/json/`.
2. Extract `city`, `regionName`, `country`, and `query` (IP).
3. Check if the user is authenticated.
4. Log a new entry in the Firestore `interactions` collection with the payload defined in `gemini.md`.

## Data Schema (Ref: gemini.md)
```json
{
  "action": "view",
  "location": {
    "city": "string",
    "region": "string",
    "country": "string",
    "ip": "string"
  }
}
```

## Edge Cases
- **API Failure:** If `ip-api.com` fails, default location to "Unknown". Do not block the UI.
- **Privacy:** Store IP only if necessary for unique counting; prioritize city/region for stats.
