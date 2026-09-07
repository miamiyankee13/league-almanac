import { useMemo, useState } from "react";
import {
  getMeaningfulPlayoffNodes,
  getPostseasonFinishForRoster,
} from "../domain/playoffUtils";
import { getMeaningfulCompetitiveGames } from "../domain/gameUtils";
import {
  buildRecordBook,
  formatPct,
  formatRecord,
} from "../domain/recordBookMetrics";

function managerName(almanac, managerId) {
  if (!managerId) return null;
  return (
    almanac.managers.find((manager) => manager.managerId === managerId)
      ?.displayName || managerId
  );
}

function teamForRoster(almanac, season, rosterId) {
  return almanac.seasonTeams.find(
    (team) => team.season === season && team.rosterId === String(rosterId)
  );
}

function teamNameForRoster(almanac, season, rosterId) {
  if (rosterId == null) return "TBD";
  return (
    teamForRoster(almanac, season, rosterId)?.teamName ||
    `Roster ${rosterId}`
  );
}

function ownershipLabel(almanac, team) {
  const issue = almanac.ownershipIssues.find(
    (candidate) =>
      candidate.season === team.season && candidate.rosterId === team.rosterId
  );

  if (!issue) {
    return managerName(almanac, team.ownerSnapshot.primaryManagerId) || "Unknown";
  }

  const previous =
    managerName(almanac, issue.previousManagerId) || "VACANT / NO OWNER";
  const current =
    managerName(almanac, issue.currentManagerId) || "VACANT / NO OWNER";

  if (issue.status !== "resolved") {
    return `${previous} → ${current} • review needed`;
  }

  if (Number(issue.effectiveWeek) === 1) {
    return issue.currentManagerId ? current : "Vacant all season";
  }

  const season = almanac.seasons.find((s) => s.season === team.season);
  if (Number(issue.effectiveWeek) > Number(season?.lastScoredLeg || 0)) {
    return previous;
  }

  return `${previous} → ${current} • W${issue.effectiveWeek}`;
}

function buildHeadToHeadRecords(almanac, seasonYear) {
  const records = new Map();

  const ensure = (rosterId) => {
    if (!records.has(rosterId)) {
      records.set(rosterId, {
        wins: 0,
        losses: 0,
        ties: 0,
        pointsFor: 0,
        pointsAgainst: 0,
      });
    }
    return records.get(rosterId);
  };

  for (const game of almanac.games) {
    if (game.season !== seasonYear || game.phase !== "regular_season") continue;

    const a = ensure(game.teamA.rosterId);
    const b = ensure(game.teamB.rosterId);
    const aPoints = Number(game.teamA.points || 0);
    const bPoints = Number(game.teamB.points || 0);

    a.pointsFor += aPoints;
    a.pointsAgainst += bPoints;
    b.pointsFor += bPoints;
    b.pointsAgainst += aPoints;

    if (aPoints > bPoints) {
      a.wins += 1;
      b.losses += 1;
    } else if (bPoints > aPoints) {
      b.wins += 1;
      a.losses += 1;
    } else {
      a.ties += 1;
      b.ties += 1;
    }
  }

  return records;
}

function pct(record) {
  const total = record.wins + record.losses + record.ties;
  return total ? (record.wins + record.ties * 0.5) / total : 0;
}

function recordText(record) {
  if (!record) return "0-0";
  return record.ties
    ? `${record.wins}-${record.losses}-${record.ties}`
    : `${record.wins}-${record.losses}`;
}

function playoffResult(almanac, seasonYear, rosterId) {
  return getPostseasonFinishForRoster(almanac, seasonYear, rosterId);
}

function manualPostseasonLabel(team) {
  if (!team) return "—";
  if (team.manualFinish) return team.manualFinish;
  if (team.manualPlayoffAppearance) return "Playoff Qualifier";
  return "—";
}

function seasonCompetitiveGames(almanac, seasonYear) {
  return getMeaningfulCompetitiveGames(almanac).filter(
    (game) => game.season === seasonYear
  );
}

function highestScore(almanac, seasonYear) {
  const sides = seasonCompetitiveGames(almanac, seasonYear).flatMap((game) =>
    [game.teamA, game.teamB].map((side) => ({
      ...side,
      week: game.week,
      phase: game.phase,
      game,
    }))
  );

  if (!sides.length) return null;

  return sides.reduce((best, side) =>
    Number(side.points || 0) > Number(best.points || 0) ? side : best
  );
}

function marginRecord(almanac, seasonYear, mode) {
  const games = seasonCompetitiveGames(almanac, seasonYear).filter(
    (game) => Number(game.teamA.points) !== Number(game.teamB.points)
  );

  if (!games.length) return null;

  return games.reduce((best, game) => {
    const margin = Math.abs(
      Number(game.teamA.points || 0) - Number(game.teamB.points || 0)
    );

    if (!best) return { game, margin };

    if (mode === "min") {
      return margin < best.margin ? { game, margin } : best;
    }

    return margin > best.margin ? { game, margin } : best;
  }, null);
}

function winnerLoser(game) {
  if (!game) return { winner: null, loser: null, isTie: false };

  const aPoints = Number(game.teamA.points);
  const bPoints = Number(game.teamB.points);

  if (aPoints === bPoints) {
    return { winner: game.teamA, loser: game.teamB, isTie: true };
  }

  if (aPoints > bPoints) {
    return { winner: game.teamA, loser: game.teamB, isTie: false };
  }

  return { winner: game.teamB, loser: game.teamA, isTie: false };
}

function sideManagerLabel(almanac, seasonYear, side) {
  if (!side) return "—";
  return (
    managerName(almanac, side.managerId) ||
    teamNameForRoster(almanac, seasonYear, side.rosterId)
  );
}

function matchupReceipt(almanac, seasonYear, game) {
  if (!game) return "—";

  const { winner, loser, isTie } = winnerLoser(game);

  if (isTie) {
    return `Week ${game.week} — ${sideManagerLabel(
      almanac,
      seasonYear,
      game.teamA
    )} tied ${sideManagerLabel(almanac, seasonYear, game.teamB)} ${formatScore(
      game.teamA.points
    )}–${formatScore(game.teamB.points)}`;
  }

  return `Week ${game.week} — ${sideManagerLabel(
    almanac,
    seasonYear,
    winner
  )} def. ${sideManagerLabel(almanac, seasonYear, loser)} ${formatScore(
    winner.points
  )}–${formatScore(loser.points)}`;
}

function playoffGameFromNode(almanac, season, node) {
  if (!season?.playoffWeekStart || !node?.round) return null;

  const week = Number(season.playoffWeekStart) + Number(node.round) - 1;
  const rosterIds = [node.team1RosterId, node.team2RosterId].filter(Boolean);

  if (rosterIds.length !== 2) return null;

  return almanac.games.find(
    (game) =>
      game.season === season.season &&
      Number(game.week) === week &&
      rosterIds.includes(game.teamA.rosterId) &&
      rosterIds.includes(game.teamB.rosterId)
  );
}

function roundLabel(round, maxRound) {
  if (Number(round) === Number(maxRound)) return "Championship Round";
  if (Number(round) === Number(maxRound) - 1) return "Semifinals";
  if (Number(round) === 1) return "Opening Round";
  return `Round ${round}`;
}

function playoffMatchLabel(node, maxRound) {
  if (Number(node.placement) === 1) return "Championship";
  if (Number(node.placement) === 3) return "Third Place";
  return `${roundLabel(node.round, maxRound)} • Match ${node.bracketMatch}`;
}

function scoreForRoster(game, rosterId) {
  if (!game || rosterId == null) return null;
  if (game.teamA.rosterId === String(rosterId)) return Number(game.teamA.points);
  if (game.teamB.rosterId === String(rosterId)) return Number(game.teamB.points);
  return null;
}

function managerForRosterInGame(almanac, game, rosterId) {
  if (!game || rosterId == null) return null;
  const side = [game.teamA, game.teamB].find(
    (candidate) => candidate.rosterId === String(rosterId)
  );
  return side ? managerName(almanac, side.managerId) : null;
}

function formatScore(value) {
  return value == null || Number.isNaN(Number(value))
    ? "—"
    : Number(value).toFixed(2);
}

function signedPoints(value) {
  const n = Number(value || 0);
  return `${n > 0 ? "+" : ""}${n.toFixed(2)}`;
}

export default function SeasonExplorer({ almanac, onReviewOwnership }) {
  const completed = almanac.seasons.filter((season) => season.status === "complete");
  const defaultSeason =
    completed.at(-1)?.season || almanac.seasons.at(-1)?.season;

  const [selectedSeason, setSelectedSeason] = useState(defaultSeason);

  const season = almanac.seasons.find((item) => item.season === selectedSeason);
  const teams = almanac.seasonTeams.filter(
    (team) => team.season === selectedSeason
  );

  const seasonArchive = useMemo(
    () => buildRecordBook(almanac).seasons.leaderboard,
    [almanac]
  );

  const h2hByRoster = useMemo(
    () => buildHeadToHeadRecords(almanac, selectedSeason),
    [almanac, selectedSeason]
  );

  const rows = useMemo(() => {
    return teams
      .map((team) => ({
        team,
        official: team.officialRecordSnapshot,
        h2h: team.historicalOnly
          ? {
              wins: Number(team.officialRecordSnapshot?.wins || 0),
              losses: Number(team.officialRecordSnapshot?.losses || 0),
              ties: Number(team.officialRecordSnapshot?.ties || 0),
              pointsFor: 0,
              pointsAgainst: 0,
            }
          : h2hByRoster.get(team.rosterId) || {
              wins: 0,
              losses: 0,
              ties: 0,
              pointsFor: 0,
              pointsAgainst: 0,
            },
      }))
      .sort((a, b) => {
        if (a.team.historicalOnly || b.team.historicalOnly) {
          return Number(a.team.historicalRank || 999) - Number(b.team.historicalRank || 999);
        }

        const aPct = pct(a.official);
        const bPct = pct(b.official);
        if (bPct !== aPct) return bPct - aPct;
        if (b.official.wins !== a.official.wins) {
          return b.official.wins - a.official.wins;
        }
        if (b.official.pointsFor !== a.official.pointsFor) {
          return b.official.pointsFor - a.official.pointsFor;
        }
        return Number(a.team.rosterId) - Number(b.team.rosterId);
      });
  }, [teams, h2hByRoster]);

  const median = Boolean(season?.recordFormat?.leagueMedianGameEnabled);
  const manual = Boolean(season?.historicalOnly);

  const unresolved = almanac.ownershipIssues.filter(
    (issue) =>
      issue.season === selectedSeason && issue.status !== "resolved"
  );

  const champion = almanac.champions.find(
    (item) => item.season === selectedSeason
  );

  const standingsLeader = rows[0] || null;
  const pointsRows = rows.filter((row) => row.official?.pointsFor != null);
  const pointsLeader =
    pointsRows.length > 0
      ? pointsRows.reduce((best, row) =>
          Number(row.official.pointsFor || 0) >
          Number(best.official.pointsFor || 0)
            ? row
            : best
        )
      : null;

  const highScore = highestScore(almanac, selectedSeason);
  const closest = marginRecord(almanac, selectedSeason, "min");
  const blowout = marginRecord(almanac, selectedSeason, "max");

  const playoffNodes = getMeaningfulPlayoffNodes(almanac, selectedSeason);
  const manualKnownPlayoffGame = (almanac.manualPlayoffGames || []).find(
    (game) => game.season === selectedSeason
  ) || null;

  const maxRound = playoffNodes.length
    ? Math.max(...playoffNodes.map((node) => Number(node.round || 0)))
    : 0;

  const isComplete = season?.status === "complete";

  return (
    <section className="panel season-explorer">
      <div className="section-heading season-heading">
        <div>
          <p className="eyebrow">Season explorer</p>
          <h2>{selectedSeason} Season</h2>
        </div>

        <div className="season-tabs" aria-label="Season">
          {almanac.seasons.map((item) => (
            <button
              key={item.season}
              className={item.season === selectedSeason ? "active" : ""}
              onClick={() => setSelectedSeason(item.season)}
            >
              {item.season}
            </button>
          ))}
        </div>
      </div>

      <div className="season-meta-row">
        <span>{isComplete ? "Complete" : "In progress"}</span>
        {manual ? (
          <>
            <span>{season?.sourcePlatform || "Historical"}</span>
            <span className="median-chip">Commissioner entered</span>
            {season?.playoffFieldSize ? (
              <span>{season.playoffFieldSize}-team playoff field</span>
            ) : (
              <span>Playoff field unknown</span>
            )}
            <span>Partial matchup coverage</span>
          </>
        ) : (
          <>
            <span>
              Playoffs {isComplete ? "began" : "begin"} Week {season?.playoffWeekStart || "—"}
            </span>
            {!isComplete && (
              <span>Last scored Week {season?.lastScoredLeg || 0}</span>
            )}
            {median && <span className="median-chip">League median enabled</span>}
          </>
        )}
      </div>

      {manual && (
        <div className="notice compact-notice manual-history-active-note">
          <strong>Commissioner-entered historical season.</strong>{" "}
          Standings, regular-season record, team/manager mapping and known podium
          finishes feed season/career/title history. A configured playoff field credits
          appearances. Podium finishes also contribute the minimum playoff W/L their
          finish proves, while only the exact Champion + Runner-up final is used for
          rivalry H2H. Missing regular-season matchups, additional playoff opponents/rounds,
          scores, margins and streaks are not reconstructed.
          {season?.historicalNote && (
            <span className="history-source-note">Source note: {season.historicalNote}</span>
          )}
        </div>
      )}

      {median && (
        <div className="notice compact-notice">
          <strong>Official and H2H records are separated.</strong> Sleeper&apos;s
          official standings may include the extra median game; H2H counts only
          actual opponent matchups.
        </div>
      )}

      {unresolved.length > 0 && (
        <div className="ownership-inline-warning ownership-review-picker">
          <div className="ownership-warning-copy">
            <strong>
              {unresolved.length} ownership handoff
              {unresolved.length === 1 ? "" : "s"} unresolved.
            </strong>
            <span>
              Team standings remain valid, but manager career credit is withheld
              for ambiguous weeks. Choose the exact handoff you want to review:
            </span>
          </div>

          <div className="ownership-review-buttons">
            {unresolved.map((issue) => {
              const previous =
                managerName(almanac, issue.previousManagerId) ||
                "VACANT / NO OWNER";
              const current =
                managerName(almanac, issue.currentManagerId) ||
                "VACANT / NO OWNER";

              return (
                <button
                  key={issue.ownershipIssueId}
                  onClick={() => onReviewOwnership?.(issue.ownershipIssueId)}
                >
                  {previous} → {current}
                </button>
              );
            })}
          </div>
        </div>
      )}

      <div className="season-highlight-grid">
        <div className="season-highlight">
          <span>Champion</span>
          <strong>
            {champion
              ? managerName(almanac, champion.winner.managerId) ||
                champion.winner.teamName
              : isComplete
                ? "Unresolved"
                : "TBD"}
          </strong>
          <small>
            {champion
              ? champion.winner.points == null || champion.runnerUp.points == null
                ? `${champion.winner.teamName} • ${season?.sourcePlatform || "Historical"} history`
                : `${champion.winner.teamName} • ${formatScore(
                    champion.winner.points
                  )}-${formatScore(champion.runnerUp.points)}`
              : isComplete
                ? "No champion entered"
                : "Season still in progress"}
          </small>
        </div>

        <div className="season-highlight">
          <span>
            {manual
              ? "Historical Standings Leader"
              : isComplete
                ? "Regular-Season Leader"
                : "Current Leader"}
          </span>
          <strong>
            {standingsLeader
              ? ownershipLabel(almanac, standingsLeader.team)
              : "—"}
          </strong>
          <small>
            {standingsLeader
              ? `${standingsLeader.team.teamName} • ${
                  manual && !standingsLeader.official?.recordKnown
                    ? "Record unavailable"
                    : recordText(standingsLeader.official)
                }`
              : "No standings yet"}
          </small>
        </div>

        <div className="season-highlight">
          <span>Most Points For</span>
          <strong>
            {manual ? "Unavailable" : pointsLeader ? ownershipLabel(almanac, pointsLeader.team) : "—"}
          </strong>
          <small>
            {manual
              ? "No historical scoring data entered"
              : pointsLeader
                ? `${pointsLeader.team.teamName} • ${Number(
                    pointsLeader.official.pointsFor || 0
                  ).toFixed(2)} PF`
                : "No scoring yet"}
          </small>
        </div>

        <div className="season-highlight">
          <span>Highest Weekly Score</span>
          <strong>
            {manual
              ? "Unavailable"
              : highScore
                ? managerName(almanac, highScore.managerId) ||
                  teamNameForRoster(almanac, selectedSeason, highScore.rosterId)
                : "—"}
          </strong>
          <small>
            {manual
              ? "No matchup data"
              : highScore
                ? `${formatScore(highScore.points)} • Week ${highScore.week}`
                : "No completed games"}
          </small>
        </div>
      </div>

      <div className="season-record-strip">
        <div>
          <span>Closest Game</span>
          {closest ? (
            <>
              <strong>{closest.margin.toFixed(2)} pts</strong>
              <small className="record-game-result receipt-line">
                {matchupReceipt(almanac, selectedSeason, closest.game)}
              </small>
            </>
          ) : (
            <strong>—</strong>
          )}
        </div>

        <div>
          <span>Biggest Blowout</span>
          {blowout ? (
            <>
              <strong>{blowout.margin.toFixed(2)} pts</strong>
              <small className="record-game-result receipt-line">
                {matchupReceipt(almanac, selectedSeason, blowout.game)}
              </small>
            </>
          ) : (
            <strong>—</strong>
          )}
        </div>
      </div>

      <div className="subsection-heading">
        <div>
          <p className="eyebrow">Standings</p>
          <h3>Regular Season</h3>
        </div>
        <span className="muted">
          {manual
            ? "Commissioner-entered standings"
            : median
              ? "Official + H2H records separated"
              : "Sleeper record snapshot"}
        </span>
      </div>

      <div className="table-wrap">
        <table className="standings-table">
          <thead>
            <tr>
              <th>#</th>
              <th>Team</th>
              <th>Manager</th>
              <th>{median ? "Official" : "Record"}</th>
              {median && <th>H2H</th>}
              <th>PF</th>
              <th>PA</th>
              <th>Postseason</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ team, official, h2h }, index) => (
              <tr key={team.seasonTeamId}>
                <td className="rank-cell">
                  {manual ? team.historicalRank || index + 1 : index + 1}
                </td>
                <td>
                  <strong className="team-cell-name">{team.teamName}</strong>
                </td>
                <td
                  className={
                    almanac.ownershipIssues.some(
                      (issue) =>
                        issue.season === team.season &&
                        issue.rosterId === team.rosterId
                    )
                      ? "manager-history-cell"
                      : ""
                  }
                >
                  {ownershipLabel(almanac, team)}
                </td>
                <td className="record-cell">
                  {manual && !official?.recordKnown ? "—" : recordText(official)}
                </td>
                {median && <td className="record-cell">{recordText(h2h)}</td>}
                <td>
                  {official.pointsFor == null
                    ? "—"
                    : Number(official.pointsFor).toFixed(2)}
                </td>
                <td>
                  {official.pointsAgainst == null
                    ? "—"
                    : Number(official.pointsAgainst).toFixed(2)}
                </td>
                <td>
                  {manual
                    ? manualPostseasonLabel(team)
                    : playoffResult(almanac, selectedSeason, team.rosterId)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="standings-footnote">
        {manual
          ? `Historical standings use commissioner-entered rank and regular-season record. ${season?.playoffFieldSize ? `Ranks 1–${season.playoffFieldSize} are credited with a playoff appearance. ` : "Playoff appearances are credited only where a known top-three finish proves participation until a playoff field size is entered. "}Team names remain separate from mapped manager identity.`
          : "Standings are ordered by record, then points for. Historical playoff seeding may differ where league-specific tiebreakers applied."}
      </p>

      <div className="subsection-heading playoff-heading">
        <div>
          <p className="eyebrow">Postseason</p>
          <h3>Playoff History</h3>
        </div>
        <span className="muted">
          {playoffNodes.length
            ? `${playoffNodes.filter((node) => node.isResolved).length} meaningful playoff games`
            : manualKnownPlayoffGame
              ? "1 known championship result"
              : "No opponent-specific playoff result available"}
        </span>
      </div>

      {playoffNodes.length > 0 ? (
        <div className="playoff-rounds">
          {Array.from(new Set(playoffNodes.map((node) => Number(node.round)))).map(
            (round) => {
              const roundNodes = playoffNodes.filter(
                (node) => Number(node.round) === round
              );

              return (
                <div className="playoff-round" key={round}>
                  <div className="playoff-round-title">
                    {roundLabel(round, maxRound)}
                  </div>

                  <div className="playoff-game-list">
                    {roundNodes.map((node) => {
                      const actualGame = playoffGameFromNode(almanac, season, node);
                      const roster1 = node.team1RosterId;
                      const roster2 = node.team2RosterId;
                      const score1 = scoreForRoster(actualGame, roster1);
                      const score2 = scoreForRoster(actualGame, roster2);
                      const manager1 = managerForRosterInGame(
                        almanac,
                        actualGame,
                        roster1
                      );
                      const manager2 = managerForRosterInGame(
                        almanac,
                        actualGame,
                        roster2
                      );

                      const team1Won =
                        node.isResolved &&
                        String(node.winnerRosterId) === String(roster1);
                      const team2Won =
                        node.isResolved &&
                        String(node.winnerRosterId) === String(roster2);

                      return (
                        <article
                          className={`playoff-game-card ${
                            Number(node.placement) === 1
                              ? "championship-game-card"
                              : ""
                          }`}
                          key={node.playoffGameId}
                        >
                          <div className="playoff-game-label">
                            {playoffMatchLabel(node, maxRound)}
                          </div>

                          <div
                            className={`playoff-team-row ${team1Won ? "winner" : ""}`}
                          >
                            <div className="playoff-team-identity">
                              <span>
                                {teamNameForRoster(almanac, selectedSeason, roster1)}
                              </span>
                              {manager1 && <small>{manager1}</small>}
                            </div>
                            <strong>{formatScore(score1)}</strong>
                          </div>

                          <div
                            className={`playoff-team-row ${team2Won ? "winner" : ""}`}
                          >
                            <div className="playoff-team-identity">
                              <span>
                                {teamNameForRoster(almanac, selectedSeason, roster2)}
                              </span>
                              {manager2 && <small>{manager2}</small>}
                            </div>
                            <strong>{formatScore(score2)}</strong>
                          </div>

                          {!node.isResolved && (
                            <div className="playoff-pending">Not yet resolved</div>
                          )}
                        </article>
                      );
                    })}
                  </div>
                </div>
              );
            }
          )}
        </div>
      ) : manualKnownPlayoffGame ? (
        <div className="playoff-rounds">
          <div className="playoff-round">
            <div className="playoff-round-title">Known Championship Result</div>
            <div className="playoff-game-list">
              <article className="playoff-game-card championship-game-card">
                <div className="playoff-game-label">
                  Championship · Commissioner entered
                </div>

                <div className="playoff-team-row winner">
                  <div className="playoff-team-identity">
                    <span>{manualKnownPlayoffGame.winner.teamName}</span>
                    {manualKnownPlayoffGame.winner.managerId && (
                      <small>
                        {managerName(
                          almanac,
                          manualKnownPlayoffGame.winner.managerId
                        )}
                      </small>
                    )}
                  </div>
                  <strong>WIN</strong>
                </div>

                <div className="playoff-team-row">
                  <div className="playoff-team-identity">
                    <span>{manualKnownPlayoffGame.loser.teamName}</span>
                    {manualKnownPlayoffGame.loser.managerId && (
                      <small>
                        {managerName(
                          almanac,
                          manualKnownPlayoffGame.loser.managerId
                        )}
                      </small>
                    )}
                  </div>
                  <strong>LOSS</strong>
                </div>

                <div className="playoff-pending">Final score unavailable</div>
              </article>
            </div>
          </div>
        </div>
      ) : (
        <div className="empty-state">
          {manual
            ? "No opponent-specific playoff result is known for this commissioner-entered season. Known playoff appearances and top-three finishes are still preserved above."
            : "No meaningful playoff bracket returned for this season."}
        </div>
      )}

      {(playoffNodes.length > 0 || manualKnownPlayoffGame) && (
        <p className="standings-footnote playoff-footnote">
          {manualKnownPlayoffGame && !playoffNodes.length
            ? "The champion and runner-up prove one exact championship meeting and its winner. Manager playoff totals may also include minimum opponent-unknown outcomes proven by the podium finish, but additional opponents and rounds are not invented."
            : "Playoff history includes championship-path games plus the official 3rd-place game. Lower placement games are excluded."}
        </p>
      )}

      <div className="subsection-heading season-archive-heading">
        <div>
          <p className="eyebrow">All-time seasons</p>
          <h3>Season Leaderboard</h3>
        </div>
        <span className="muted">Completed seasons • sorted by regular-season win %</span>
      </div>

      <div className="table-wrap">
        <table className="record-book-table season-record-table">
          <thead>
            <tr>
              <th>#</th>
              <th>Season</th>
              <th>Team</th>
              <th>Manager</th>
              <th>H2H</th>
              <th>Win %</th>
              <th>PF</th>
              <th>PA</th>
              <th>Diff</th>
              <th>Finish</th>
            </tr>
          </thead>
          <tbody>
            {seasonArchive.map((entry, index) => (
              <tr key={entry.id}>
                <td className="rank-cell">{index + 1}</td>
                <td>
                  <strong>{entry.season}</strong>
                  {entry.historicalOnly && (
                    <span className="manual-source-chip manual-source-chip-inline">Manual</span>
                  )}
                </td>
                <td>{entry.teamName}</td>
                <td>{entry.managerLineage}</td>
                <td className="record-cell">{formatRecord(entry.h2h)}</td>
                <td>{formatPct(entry.winPct)}</td>
                <td>{entry.pointsKnown ? formatScore(entry.h2h.pointsFor) : "—"}</td>
                <td>{entry.pointsKnown ? formatScore(entry.h2h.pointsAgainst) : "—"}</td>
                <td
                  className={
                    entry.pointDiff > 0
                      ? "positive-record"
                      : entry.pointDiff < 0
                        ? "negative-record"
                        : ""
                  }
                >
                  {entry.pointsKnown ? signedPoints(entry.pointDiff) : "—"}
                </td>
                <td>
                  <span
                    className={
                      entry.finish === "Champion"
                        ? "title-finish"
                        : entry.finish === "3rd Place"
                          ? "podium-finish"
                          : ""
                    }
                  >
                    {entry.finish}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="standings-footnote">
        All-time season rankings use completed regular-season records. Commissioner-
        entered aggregate W/L can extend the archive without creating fictional games;
        PF/PA and matchup-derived fields remain blank where historical scoring data is unavailable.
      </p>
    </section>
  );
}
