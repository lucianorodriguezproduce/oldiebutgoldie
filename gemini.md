# Gemini: Project Constitution

## 1. Data Schemas

### Lead (Collection Profile)
```json
{
  "uid": "string",
  "displayName": "string",
  "location": "string",
  "collectionItemCount": "number",
  "genres": ["string"],
  "topArtists": ["string"],
  "lastUpdated": "iso-date",
  "contacted": "boolean"
}
```

### Product (Sale Item)
```json
{
  "id": "string",
  "title": "string",
  "artist": "string",
  "price": "number",
  "currency": "ARS",
  "condition": "string",
  "stock": "number",
  "discogsId": "string"
}
```

### Interaction (Analytics)
```json
{
  "id": "string",
  "uid": "string | null",
  "timestamp": "iso-date",
  "action": "view | click | collect",
  "resourceId": "string",
  "location": {
    "city": "string",
    "region": "string",
    "country": "string",
    "ip": "string"
  }
}
```

## 2. Behavioral Rules
- Deterministic logic prioritized over probabilistic outputs.
- Separation of concerns through 3-layer A.N.T. architecture.
- Documentation must precede implementation (SOP first).

## 3. Architectural Invariants
- Frontend: React + Vite + Tailwind CSS (Glassmorphic UX).
- Backend: Firebase (Auth + Firestore).
- Communication: System-level networking via Discogs API.

## 4. Maintenance Log
- **2026-02-10**: System Pilot initialized. B.L.A.S.T. protocol activated.
