PHASE 2.5.1 — OVERALL RIVALRY SERIES

Replace these 3 files in your project:

src/components/RivalriesExplorer.jsx
src/components/RecordBook.jsx
src/domain/rivalryMetrics.js

Changes:
- Rivalry browser rows now summarize the OVERALL series (regular season + meaningful playoffs).
  Example: 5-0 regular season + 1-0 playoffs now displays "Manager leads 6-0".
- The regular/playoff meeting counts on the right remain split out for context.
- "Tightest Series" now uses the overall rivalry W/L, including meaningful playoff meetings.
- Tightest Series qualification/tiebreaking now uses total meetings rather than regular-season meetings.
- Rivalry Records displays the overall Tightest Series result and the regular/playoff meeting breakdown.

No dossier structure was changed. The dossier continues to explicitly separate Regular-Season Series and Playoff Series while preserving overall rivalry metrics/receipts.
