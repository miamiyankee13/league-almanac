League Almanac — Phase 5: Manual History / Pre-Sleeper Era

Replace / add the files in this ZIP using the included league-almanac/... paths.

FILES
Replace:
- src/App.jsx
- src/main.jsx
- src/services/commissionerStore.js
- src/domain/managerMetrics.js
- src/domain/recordBookMetrics.js
- src/components/SeasonExplorer.jsx
- src/components/ManagersExplorer.jsx
- src/components/ManagerProfileModal.jsx
- src/components/RecordBook.jsx

Add:
- src/domain/manualHistory.js
- src/components/ManualHistoryAdmin.jsx
- src/manualHistory.css

WHAT THIS ADDS
Admin -> Manual History now supports:
- Create pre-Sleeper historical seasons (ESPN by default; platform is editable)
- Enter historical standings rank
- Enter historical team name
- Map each historical team to an existing Sleeper-era manager
- Create Historical Managers for owners who never had a Sleeper identity
- Leave ownership unresolved when you are not yet sure
- Enter regular-season W/L/T
- Enter Champion / Runner-up / 3rd Place
- Add an optional source note
- Edit/delete historical seasons and historical managers
- Manual history is persisted in the existing per-league commissioner localStorage layer
- Manual history is included in the Almanac EXPORT JSON

IDENTITY RULE
Team name and manager identity remain separate.
Manual historical managers do not need a Sleeper user ID.
No cross-platform franchise continuity is invented.

WHAT MANUAL HISTORY CAN AFFECT
When the entered data supports it:
- Season count / completed-season count
- Manager count once a historical owner is mapped
- Season standings and all-time Season Leaderboard
- Manager seasons managed
- Manager regular-season W/L/T and career win %
- Best/Worst manager seasons
- Best/Worst season record and Most H2H Wins record cards
- Hall of Champions
- Championships
- Finals
- Known top-three finish shown in season/manager history
- Most Championships / Most Finals / Most Regular-Season Wins / Best Career Win %

WHAT MANUAL HISTORY DOES NOT AFFECT
Because no matchup/score data exists:
- Weekly score records
- Highest/lowest score
- Closest game / biggest blowout
- Highest-scoring loss
- Combined-score records
- Rivalry H2H / Most Meetings / Tightest / Lopsided / playoff rivalry records
- Playoff W/L
- Playoff-appearance record (kept matchup-data only in this phase)
- Points For / point differential record cards
- Career points record (shown as "Most Recorded Career Points" when manual history is active)

TRANSPARENCY / UI NOTES
The app now explicitly explains this coverage in:
- Admin -> Manual History
- Overview when manual history is active
- Historical Season Explorer pages
- Managers
- Manager profiles
- Record Book notes/footnotes

Historical seasons are marked Commissioner Entered / Manual.
PF/PA and matchup-derived fields remain blank where the source data cannot support them.
No fake games are generated from aggregate standings.

SAFETY / VALIDATION
- Manual History is reserved for years before this league's earliest Sleeper season.
- It will not overwrite a Sleeper season.
- Only one Champion, Runner-up, and 3rd Place can be saved per historical season.
- Deleting a historical manager leaves linked historical team rows unresolved rather than silently remapping them.

PERSISTENCE NOTE
Manual history currently lives in this league's local commissioner state for the site/browser.
It is included in EXPORT JSON, so keep an export as a backup before clearing site data or moving devices.

QA PERFORMED
- All JS/JSX files passed TypeScript JSX syntax transpilation checks.
- Manual-history domain QA was run against the supplied Fantasy Fucking Football Almanac export:
  - manual pre-Sleeper season merged correctly
  - historical manager with no Sleeper ID was created correctly
  - manual W/L aggregated into career record
  - title/finals credit flowed correctly
  - manual season record entered the season-record layer
  - points-based and playoff-W/L coverage stayed excluded

Suggested commit:
git add .
git commit -m "Add commissioner-entered pre-Sleeper history"
git push
