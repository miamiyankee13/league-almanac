# League Almanac

Standalone React/Vite project for the fantasy league history / record book / lore application.

## Phase 1.1

This build now includes the first production foundation:

### Faster history loading
- All 18 weekly matchup + transaction requests are fetched concurrently within each season.
- Completed Sleeper seasons are cached in IndexedDB for 7 days.
- The current/in-season league always refreshes from Sleeper.
- `FORCE RESYNC` bypasses the cache when you intentionally want to rebuild all historical data.

### Ownership reconciliation
- Cross-season `owner_id` changes are treated as review candidates, not as automatic historical truth.
- Transaction creator IDs and draft `picked_by` IDs are analyzed for takeover clues.
- Each ownership issue can be opened and assigned an effective week.
- Decisions are saved separately in the commissioner layer in localStorage.
- Raw Sleeper data is never edited.
- Confirmed decisions rebuild `ManagerTenure` and game-level manager attribution.

### Hall of Champions
- Championship nodes are derived from the Sleeper winners bracket.
- The championship matchup is matched to the correct playoff week and H2H score.
- Champion and runner-up manager attribution uses the same tenure engine.

### League-median edge case
Sleeper leagues can use an "extra game against league median."

The Almanac deliberately separates:
- **Head-to-head games** (`Game.gameType = "head_to_head"`)
- **Official Sleeper standings record** (`SeasonTeam.officialRecordSnapshot`)

Each season includes:

```js
recordFormat: {
  leagueMedianGameEnabled,
  headToHeadGamesStoredSeparately: true
}
```

This prevents a median win/loss from being mistaken for a real opponent matchup in future manager career records or rivalry records.

We have **not yet built the median-result reconstruction engine**. That should be added before the final standings/career-record module for any league that uses the setting.

## Run

```bash
npm install
npm run dev
```

Enter the current Sleeper league ID.

## Suggested test flow

1. Load the same league twice.
   - First load should be much faster than the original sequential build.
   - Second load should use completed-season cache.
2. Click each ownership review.
3. Verify the automatic evidence.
4. Save only the handoffs you are comfortable confirming.
5. Confirm Hall of Champions looks correct.
6. Use `FORCE RESYNC` if you want to bypass the historical cache during development.

## Next planned modules

1. Season Explorer / standings
2. Manager career pages
3. Rivalry engine
4. Record Book
5. Manual history + provenance
6. Lore Vault
7. Content Studio


## Phase 1.2

- Ownership timing now relies on completed transaction activity, not draft `picked_by` as an ownership signal. Draft picks remain available for draft attribution only.
- Midseason handoffs expose an evidence window plus a suggested effective week.
- Low/insufficient-confidence cases no longer silently default to an offseason takeover.
- Added the first Season Explorer with season switching, regular-season standings, postseason result labels, and explicit separation of official vs head-to-head record when league-median scoring is enabled.

## Phase 1.3 ownership-review UX

- Ownership Reconciliation is again a dedicated section before Season Explorer.
- Every ownership-change row is individually clickable.
- When the selected season has multiple unresolved handoffs, Season Explorer shows one button for each specific manager transition instead of opening only the first item in the queue.


## Phase 1.4

- Removes stale draft-selection language from ownership reconciliation.
- When all detected ownership changes are resolved, the UI now treats the
  reconciliation layer as complete while keeping each decision editable.
- Expands Season Explorer into a year-by-year history page with:
  - champion
  - standings leader
  - points-for leader
  - highest weekly score
  - closest game
  - biggest blowout
  - regular-season standings
  - league-median record separation
  - historical winners-bracket display with scores where available
- The standings rank remains an Almanac deterministic sort, not an asserted
  Sleeper historical seed until season-specific tiebreakers are modeled.


## Phase 1.5

- Closest Game and Biggest Blowout now use the same full matchup presentation.
- Both records identify the winner, both teams, and the final score.
- Tie handling is explicit rather than arbitrarily assigning a winner.

## Phase 1.6 — Managers

Adds the first tenure-aware manager career module.

- Primary-manager career leaderboard
- Regular-season H2H record and win percentage
- Career PF and PF/game
- Playoff appearances, finals, championships and playoff record
- Clickable manager profiles
- Season-by-season tenure history, including partial-season ownership ranges
- Best/worst season
- Most-faced regular-season opponent
- League-median bonus games intentionally excluded from manager H2H records
- Co-owner-only identities stay preserved but are excluded from primary-manager rankings by default


## Phase 1.7 — Rivalries

Adds a tenure-aware manager rivalry engine and UI.

### Rivalry rules

- Regular-season rivalry records use actual opponent games only.
- League-median bonus wins/losses never enter manager-vs-manager H2H.
- Playoff meetings are kept separate from the regular-season series.
- Only resolved winners-bracket games count as playoff rivalry meetings.
  Consolation/losers-bracket games are intentionally excluded.
- Games without reliable manager attribution are withheld rather than assigned
  to the wrong manager.

### Rivalry archive

The Rivalries section includes:

- most meetings
- tightest regular-season series
- most playoff meetings
- regular-season series record
- total regular-season points scored by each manager
- average margin
- playoff series
- latest meeting

### Rivalry dossier

Clicking a pairing opens a full rivalry profile with:

- regular-season series
- all competitive meetings
- total points
- average margin
- playoff series
- current winning streak
- closest game
- biggest blowout
- highest-scoring meeting
- season-by-season series history
- every historical meeting with winner, score, stage and margin


## Phase 1.8 — Vacant-roster ownership reconciliation

Fixes a historical attribution edge case where a manager leaves during a season
and Sleeper's archived season finishes with `owner_id: null` because the roster
is not filled until the next renewal.

### New ownership lifecycle handling

The reconciliation engine now distinguishes:

- `owner_change` — previous owner -> different owner
- `vacated_roster` — previous owner -> no owner in the historical season snapshot
- `filled_vacancy` — prior season ended vacant -> current season has an owner
  after games have already been scored

For a vacated historical roster, the commissioner chooses the **first week the
roster should be treated as vacant**. The previous manager receives game credit
through the prior week; vacant weeks receive no manager credit.

Example:

- effective vacancy Week 17 -> previous manager receives Weeks 1-16
- effective vacancy Week 18 / after season -> previous manager receives the full
  competitive season

A current season that fills a prior vacancy before any games have been scored
does not create an unnecessary review. Once games exist, a vacancy-fill review
is created so the new manager cannot accidentally inherit earlier vacant weeks.


## Phase 1.9 — Vacant roster team-name fallback

When a historical season ends with a vacant roster (`owner_id: null`), the
normalized season team now falls back to the most recent prior-season team name
for that same roster line/lineage before defaulting to `Roster X`.

This prevents vacant seasons from showing placeholder names like `User ?` while
still keeping manager attribution separate from franchise/team labeling.


## Phase 1.10 — Meaningful playoff record filtering

Sleeper's `winners_bracket` includes placement games in addition to the actual
championship path. For example, a six-team bracket can include a Week 16
5th-place game between the two Round 1 losers and a Week 17 3rd-place game
between semifinal losers.

Those games no longer count toward:

- manager playoff W/L
- season-level manager playoff W/L
- rivalry playoff series
- rivalry playoff meeting counts

The Season Explorer playoff view also now shows only the championship path.

The filter traces backward from the `p: 1` championship node using Sleeper's
winner-source bracket links when available, with a resolved-history fallback
that follows earlier game winners into later championship-path participants.
This avoids relying on hard-coded match IDs or a specific 4/6/8-team bracket
shape.


## Phase 1.11 — Preserve the official 3rd-place game

Phase 1.10 filtered too broadly by removing every post-elimination placement
game. The intended rule is narrower.

A game now counts as a meaningful playoff game when it is either:

1. on the path to the league championship, or
2. the official `p: 3` third-place matchup.

Lower placement games such as 5th-place and 7th-place games remain excluded.

This applies consistently to:

- manager playoff W/L
- season-level manager playoff W/L
- rivalry playoff H2H
- rivalry playoff meeting counts
- Season Explorer playoff history

The third-place game therefore remains visible in championship week and can
determine the league's official third-place finisher without allowing earlier
lower-placement games to distort playoff records.


## Phase 1.12 — Precise postseason finishes

The generic `Playoffs` finish label has been removed from completed postseason
history.

Resolved winners-bracket results now produce:

- Champion
- Runner-up
- 3rd Place
- 4th Place
- Semifinals
- First Round
- Round N only when a less-common bracket shape cannot be expressed more
  naturally

The official `p:3` third-place game determines 3rd and 4th place.

The same finish resolver is used by both:

- Season Explorer → Standings → Postseason
- Manager Profile → Season by Season → Finish

Manager profiles resolve the finish against the manager who actually controlled
that franchise at the relevant postseason game, preventing a prior owner from
inheriting a later owner's final placement.


## Phase 2.0 — Record Book

Adds a dedicated Record Book with three views.

### Game Records

Uses regular-season games plus meaningful playoff games only
(championship path + official 3rd-place matchup). Lower placement games are
excluded.

Initial records:

- highest weekly score
- lowest weekly score
- biggest blowout
- closest win
- highest losing score
- lowest winning score
- highest combined score
- lowest combined score
- top 10 weekly scores
- top 10 highest losing scores

Team/game records remain valid even when historical manager attribution is
unknown. In that case the team/franchise result remains in league history and
the manager is labeled unresolved.

### Season Records

Completed seasons only. To avoid the extra-game-against-median problem,
cross-era season comparisons use reconstructed opponent-only H2H records rather
than Sleeper's official standings W/L.

Initial records:

- best H2H record
- most H2H wins
- most points for
- best point differential
- worst H2H record
- fewest points for
- worst point differential
- most points for without a championship
- all-time completed team-season leaderboard

Team-season records belong to the franchise season. If ownership changed during
the year, the reconciled manager lineage is shown rather than assigning the
entire team season to one manager.

### Career Records

Uses the existing tenure-aware Manager Metrics engine.

Initial records:

- most championships
- most regular-season H2H wins
- best career H2H win percentage
- most career points
- most playoff wins
- most finals
- most playoff appearances
- most seasons managed
- full manager career record table

Career win percentage uses a 10-game minimum when at least one manager meets
that threshold. League-median bonus games never enter career H2H records.


## Phase 2.1 — Shared competitive-game count + title badge fix

The summary-strip `Games` metric now uses the same meaningful competitive-game
definition as Record Book:

- all regular-season H2H games
- championship-path playoff games
- official 3rd-place game
- excludes 5th-place, 7th-place and other lower placement matchups

This removes the previous mismatch where the summary counted every normalized
Sleeper matchup while Record Book correctly filtered lower placement games.

A shared `gameUtils.js` helper now owns that definition so the two sections
cannot silently drift apart again.

Also fixes the Career Records `Titles` pill. A generic Record Book table CSS
rule was overriding `.manager-title-badge`; the badge now renders the same way
it does in the Managers leaderboard.


## Phase 2.2 — Rivalries cleanup

Rivalries was redesigned around browse-first / drill-down-second navigation.

### Main Rivalries section

Instead of rendering every historical pairing as a wide table by default:

- Featured shows up to 10 high-signal rivalries.
- Current Owners shows pairings where both managers currently own a roster.
- Playoff History shows only pairings with meaningful playoff meetings.
- All exposes the full archive.
- Manager dropdown instantly isolates one manager's rivalry history.

The archive rows were reduced to the information needed to choose a rivalry:

- manager pairing
- regular-season series leader
- regular-season meeting count
- playoff meeting count
- latest meeting

Detailed point totals, margins and game-level history moved into the dossier.

Featured ranking favors established series, meaningful playoff history and
pairings between current owners. It is an organization/display score only; it
does not create a formal "rivalry rating" in the historical data model.

### Rivalry dossier

The modal is much shorter by default:

- compact head-to-head scoreboard
- average margin
- current streak
- playoff series
- closest game
- biggest blowout
- highest-scoring meeting
- five most recent meetings

Deep history is available on demand:

- Show All Meetings
- expandable Season-by-Season Breakdown

This prevents long-running leagues and leagues with multiple replacement owners
from producing extremely tall rivalry pages while preserving every historical
receipt.
