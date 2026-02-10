# SOP: Geolocation Telemetry

## Goal
Identify the physical location (City, Region, Country) of users interacting with the app to build marketplace statistics.

## Inputs
- User's IP address (detected via `ip-api.com`).

## Workflow
1. On application seed/initial load, trigger a call to a secure HTTPS geolocation API (e.g., `https://ipapi.co/json/`).
2. Fallback to secondary HTTPS provider if the primary fails (Self-healing).
3. Extract `city`, `region`, `country`, and `ip`.
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
