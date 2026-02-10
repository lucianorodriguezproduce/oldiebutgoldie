# SOP: Argentina Lead Harvester

## Goal
Discover and capture Discogs user profiles located in Argentina to build a sales leads database.

## Inputs
- Discogs Search API results for specific terms (e.g., "Argentina" in profile location).

## Workflow
1. **Search Phase:** Search for releases or labels with high "Argentina" affinity to find recent buyers/interactors.
2. **Extraction Phase:** Visit public profile pages of users who have those items in their collection/wantlist.
3. **Filtering Phase:** Verify the `location` field in the Discogs profile contains "Argentina".
4. **Storage Phase:** If valid, save the profile data to Firestore `leads` collection.

## Data Schema (Ref: gemini.md)
```json
{
  "location": "Argentina",
  "collectionItemCount": "number",
  "contacted": false
}
```

## Critical Limits
- Do not exceed 60 requests per minute (Discogs API throttle).
- Respect user privacy (only public data).
