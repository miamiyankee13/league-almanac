League Almanac — Phase 2.5 Polish Pass
======================================

This patch is based on the current GitHub main state that already includes:
- Phase 2.3 ownership evidence handling
- Phase 2.4 Managers / Manager Records cleanup + null-fragment fix
- restored detailed Rivalry dossier

REPLACE / ADD THESE FILES
-------------------------
src/App.jsx
src/components/SeasonExplorer.jsx
src/components/ManagersExplorer.jsx
src/components/ManagerProfileModal.jsx
src/components/RivalriesExplorer.jsx
src/components/RivalryProfileModal.jsx
src/components/RecordBook.jsx
src/domain/managerMetrics.js
src/polish.css   <-- NEW FILE

WHAT CHANGED
------------
Top of app
- FRONT OFFICE TERMINAL -> LEAGUE ALMANAC
- SYNC CURRENT -> REFRESH LEAGUE
- FORCE RESYNC -> FULL RESYNC
- clearer Full Resync tooltip
- summary strip reduced to Seasons / Managers / Games
- Hall of Champions eyebrow -> Championship History
- resolved championships -> championship seasons

Season Explorer
- completed/current metadata wording cleaned up
- Standings Leader -> Regular-Season Leader / Current Leader
- Highest Weekly Score, Closest Game and Biggest Blowout now use only regular-season + meaningful playoff games
- ties excluded from Closest Game because the card is presented as a winner/loser receipt
- Closest Game / Biggest Blowout use compact Receipts wording
- Roster # removed from standings
- standings methodology text shortened
- Final Round -> Championship Round
- playoff cards now show manager under team name
- year tabs scroll horizontally for long league histories
- All-Time Season Leaderboard moved here from Record Book

Managers
- header count simplified to X managers
- Career H2H -> H2H Record
- manager profile Franchise / Team -> Team
- franchise number removed from visible season timeline
- Most-Faced Opponent replaced by Toughest Matchup + Best Matchup
- matchup qualification: prefer 3+ meetings, fall back to 2+, otherwise no result
- manager profile methodology shortened

Rivalries browser
- removed Most Meetings / Tightest Series / Most Playoff Meetings cards
- removed Featured tab and featured ranking formula from UI
- defaults to Current Owners
- tabs are Current Owners / Playoff History / All
- selecting a manager automatically switches to All so their complete rivalry archive is shown
- selected manager is always displayed first in every pairing
- rows simplified to pairing, series, meeting counts and latest receipt
- latest meeting now uses Winner def. Loser receipt wording

Rivalry dossier
- preserves restored detailed dossier
- follows selected-manager orientation from the browser
- removed asymmetric [Manager] Playoff H2H card
- Total Points -> Point Differential
- 5 distinct KPI cards; no filler sixth card
- story cards use Receipts wording
- season points orient to the dossier manager order
- Every Meeting team context follows winner/loser result order
- regular-season stage label shortened to Regular
- methodology shortened

Record Book
- technical header counters removed
- added Rivalry Records tab
- moved Most Meetings / Tightest Series / Most Playoff Meetings there
- simple record categories are tie-aware; tied holders are shown instead of manufacturing one winner via secondary sorting
- game record cards use Receipts wording
- redundant Regular Season stage text hidden; playoff stages remain
- Top 10 Highest Losing Scores -> Top 10 Highest-Scoring Losses
- Most PF Without a Title -> Most Points Without a Title
- All-Time Season Leaderboard removed from Season Records and moved to Season Explorer
- Manager Records remain the seven record-holder cards already approved
- methodology notes shortened

INTENTIONALLY NOT INCLUDED YET
------------------------------
Ownership Reconciliation remains in its current main-page location for now.
The agreed move into an Admin destination is intentionally deferred until the navigation pass, since the final top-level nav (including future Moves and Drafts) has not been locked yet. All ownership reconciliation functionality remains intact.

VALIDATION PERFORMED
--------------------
- all JS/JSX files parsed successfully with the TypeScript parser
- new CSS parsed successfully
- relative imports validated
- manager/record/rivalry domain logic executed successfully against the exported Degens Unite Almanac JSON
- Season Explorer, Managers, Rivalries, Record Book, Manager Profile and Rivalry Dossier all completed a stubbed runtime render against that real normalized export

INSTALL
-------
1. Extract this ZIP.
2. Copy the included league-almanac/src files over the matching files in your local repo.
3. Make sure the NEW src/polish.css file is included.
4. Run your normal local check/build.
5. Then commit and push.

Suggested commit:
  Polish almanac sections and add rivalry records

Commands:
  git add .
  git commit -m "Polish almanac sections and add rivalry records"
  git push
