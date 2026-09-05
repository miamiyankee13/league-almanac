import { useMemo, useState } from "react";
import {
  buildRecordBook,
  formatPct,
  formatRecord,
} from "../domain/recordBookMetrics";

function points(value) {
  return Number(value || 0).toFixed(2);
}

function signedPoints(value) {
  const n = Number(value || 0);
  return `${n > 0 ? "+" : ""}${n.toFixed(2)}`;
}

function gameOwner(entry) {
  if (!entry) return "—";

  return (
    <>
      <strong>{entry.managerName}</strong>
      <span>{entry.teamName}</span>
    </>
  );
}

function gameContext(entry) {
  if (!entry) return "No record available";

  return `${entry.season} • Week ${entry.week} • ${entry.stage}`;
}

function scoreResult(entry) {
  if (!entry) return "—";

  return `${entry.outcome} ${points(entry.points)}–${points(
    entry.opponentPoints
  )} vs ${entry.opponentManagerName}`;
}

function matchupResult(game) {
  if (!game) return "—";

  if (game.isTie) {
    return `${game.teamA.managerName} tied ${game.teamB.managerName} ${points(
      game.teamA.points
    )}–${points(game.teamB.points)}`;
  }

  return `${game.winner.managerName} def. ${
    game.loser.managerName
  } ${points(game.winner.points)}–${points(game.loser.points)}`;
}

function RecordCard({ label, value, owner, context, detail }) {
  return (
    <article className="record-card">
      <span className="record-card-label">{label}</span>
      <strong className="record-card-value">{value}</strong>
      {owner && <div className="record-card-owner">{owner}</div>}
      {context && <small>{context}</small>}
      {detail && <small className="record-card-detail">{detail}</small>}
    </article>
  );
}

function GameRecords({ data }) {
  return (
    <>
      <div className="record-card-grid record-card-grid-primary">
        <RecordCard
          label="Highest Weekly Score"
          value={data.highestScore ? points(data.highestScore.points) : "—"}
          owner={data.highestScore ? gameOwner(data.highestScore) : null}
          context={gameContext(data.highestScore)}
          detail={
            data.highestScore
              ? scoreResult(data.highestScore)
              : null
          }
        />

        <RecordCard
          label="Biggest Blowout"
          value={
            data.biggestBlowout
              ? `${points(data.biggestBlowout.margin)} pts`
              : "—"
          }
          owner={
            data.biggestBlowout
              ? gameOwner(data.biggestBlowout.winner)
              : null
          }
          context={
            data.biggestBlowout
              ? `${data.biggestBlowout.season} • Week ${
                  data.biggestBlowout.week
                } • ${data.biggestBlowout.stage}`
              : null
          }
          detail={
            data.biggestBlowout
              ? matchupResult(data.biggestBlowout)
              : null
          }
        />

        <RecordCard
          label="Closest Win"
          value={
            data.closestWin
              ? `${points(data.closestWin.margin)} pts`
              : "—"
          }
          owner={
            data.closestWin
              ? gameOwner(data.closestWin.winner)
              : null
          }
          context={
            data.closestWin
              ? `${data.closestWin.season} • Week ${
                  data.closestWin.week
                } • ${data.closestWin.stage}`
              : null
          }
          detail={
            data.closestWin
              ? matchupResult(data.closestWin)
              : null
          }
        />

        <RecordCard
          label="Highest Losing Score"
          value={
            data.highestLosingScore
              ? points(data.highestLosingScore.points)
              : "—"
          }
          owner={
            data.highestLosingScore
              ? gameOwner(data.highestLosingScore)
              : null
          }
          context={gameContext(data.highestLosingScore)}
          detail={
            data.highestLosingScore
              ? scoreResult(data.highestLosingScore)
              : null
          }
        />
      </div>

      <div className="record-card-grid">
        <RecordCard
          label="Lowest Weekly Score"
          value={data.lowestScore ? points(data.lowestScore.points) : "—"}
          owner={data.lowestScore ? gameOwner(data.lowestScore) : null}
          context={gameContext(data.lowestScore)}
          detail={
            data.lowestScore
              ? scoreResult(data.lowestScore)
              : null
          }
        />

        <RecordCard
          label="Lowest Winning Score"
          value={
            data.lowestWinningScore
              ? points(data.lowestWinningScore.points)
              : "—"
          }
          owner={
            data.lowestWinningScore
              ? gameOwner(data.lowestWinningScore)
              : null
          }
          context={gameContext(data.lowestWinningScore)}
          detail={
            data.lowestWinningScore
              ? scoreResult(data.lowestWinningScore)
              : null
          }
        />

        <RecordCard
          label="Highest Combined Score"
          value={
            data.highestCombined
              ? points(data.highestCombined.combinedPoints)
              : "—"
          }
          context={
            data.highestCombined
              ? `${data.highestCombined.season} • Week ${
                  data.highestCombined.week
                } • ${data.highestCombined.stage}`
              : null
          }
          detail={
            data.highestCombined
              ? matchupResult(data.highestCombined)
              : null
          }
        />

        <RecordCard
          label="Lowest Combined Score"
          value={
            data.lowestCombined
              ? points(data.lowestCombined.combinedPoints)
              : "—"
          }
          context={
            data.lowestCombined
              ? `${data.lowestCombined.season} • Week ${
                  data.lowestCombined.week
                } • ${data.lowestCombined.stage}`
              : null
          }
          detail={
            data.lowestCombined
              ? matchupResult(data.lowestCombined)
              : null
          }
        />
      </div>

      <div className="record-book-table-grid">
        <div>
          <div className="subsection-heading">
            <div>
              <p className="eyebrow">Scoring leaderboard</p>
              <h3>Top 10 Weekly Scores</h3>
            </div>
          </div>

          <div className="table-wrap">
            <table className="record-book-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Manager / Team</th>
                  <th>Score</th>
                  <th>Result</th>
                  <th>When</th>
                </tr>
              </thead>
              <tbody>
                {data.topScores.map((entry, index) => (
                  <tr key={entry.id}>
                    <td className="rank-cell">{index + 1}</td>
                    <td>
                      <strong>{entry.managerName}</strong>
                      <span>{entry.teamName}</span>
                    </td>
                    <td className="record-book-number">
                      {points(entry.points)}
                    </td>
                    <td>
                      {entry.outcome} vs {entry.opponentManagerName}
                      <span>
                        {points(entry.points)}–{points(entry.opponentPoints)}
                      </span>
                    </td>
                    <td>
                      {entry.season} W{entry.week}
                      <span>{entry.stage}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div>
          <div className="subsection-heading">
            <div>
              <p className="eyebrow">Pain index</p>
              <h3>Top 10 Highest Losing Scores</h3>
            </div>
          </div>

          <div className="table-wrap">
            <table className="record-book-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Manager / Team</th>
                  <th>Score</th>
                  <th>Lost To</th>
                  <th>When</th>
                </tr>
              </thead>
              <tbody>
                {data.badBeats.map((entry, index) => (
                  <tr key={entry.id}>
                    <td className="rank-cell">{index + 1}</td>
                    <td>
                      <strong>{entry.managerName}</strong>
                      <span>{entry.teamName}</span>
                    </td>
                    <td className="record-book-number">
                      {points(entry.points)}
                    </td>
                    <td>
                      {entry.opponentManagerName}
                      <span>
                        {points(entry.points)}–{points(entry.opponentPoints)}
                      </span>
                    </td>
                    <td>
                      {entry.season} W{entry.week}
                      <span>{entry.stage}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <p className="standings-footnote record-book-footnote">
        Single-game records use regular-season matchups plus meaningful playoff
        games: the championship path and official 3rd-place game. Lower
        placement games such as 5th-place and 7th-place matchups are excluded.
      </p>
    </>
  );
}

function SeasonRecordOwner({ entry }) {
  if (!entry) return null;

  return (
    <>
      <strong>{entry.managerLineage}</strong>
      <span>
        {entry.teamName} • {entry.season}
      </span>
    </>
  );
}

function SeasonRecords({ data }) {
  return (
    <>
      {data.hasLeagueMedianSeasons && (
        <div className="notice compact-notice record-book-notice">
          <strong>Season records use actual H2H games.</strong> Seasons that
          used an extra game against the league median are normalized to their
          opponent-only record here so different eras remain comparable.
          Sleeper&apos;s official record remains available in Season Explorer.
        </div>
      )}

      <div className="record-card-grid record-card-grid-primary">
        <RecordCard
          label="Best H2H Record"
          value={
            data.bestRecord
              ? `${formatRecord(data.bestRecord.h2h)} • ${formatPct(
                  data.bestRecord.winPct
                )}`
              : "—"
          }
          owner={
            data.bestRecord ? (
              <SeasonRecordOwner entry={data.bestRecord} />
            ) : null
          }
          detail={data.bestRecord?.finish}
        />

        <RecordCard
          label="Most H2H Wins"
          value={data.mostWins ? data.mostWins.h2h.wins : "—"}
          owner={
            data.mostWins ? (
              <SeasonRecordOwner entry={data.mostWins} />
            ) : null
          }
          detail={
            data.mostWins
              ? `${formatRecord(data.mostWins.h2h)} • ${data.mostWins.finish}`
              : null
          }
        />

        <RecordCard
          label="Most Points For"
          value={
            data.mostPoints
              ? points(data.mostPoints.h2h.pointsFor)
              : "—"
          }
          owner={
            data.mostPoints ? (
              <SeasonRecordOwner entry={data.mostPoints} />
            ) : null
          }
          detail={
            data.mostPoints
              ? `${points(
                  data.mostPoints.h2h.pointsFor /
                    Math.max(1, data.mostPoints.h2h.games)
                )} PF/G • ${data.mostPoints.finish}`
              : null
          }
        />

        <RecordCard
          label="Best Point Differential"
          value={
            data.bestPointDiff
              ? signedPoints(data.bestPointDiff.pointDiff)
              : "—"
          }
          owner={
            data.bestPointDiff ? (
              <SeasonRecordOwner entry={data.bestPointDiff} />
            ) : null
          }
          detail={
            data.bestPointDiff
              ? `${points(data.bestPointDiff.h2h.pointsFor)} PF • ${points(
                  data.bestPointDiff.h2h.pointsAgainst
                )} PA`
              : null
          }
        />
      </div>

      <div className="record-card-grid">
        <RecordCard
          label="Worst H2H Record"
          value={
            data.worstRecord
              ? `${formatRecord(data.worstRecord.h2h)} • ${formatPct(
                  data.worstRecord.winPct
                )}`
              : "—"
          }
          owner={
            data.worstRecord ? (
              <SeasonRecordOwner entry={data.worstRecord} />
            ) : null
          }
          detail={data.worstRecord?.finish}
        />

        <RecordCard
          label="Fewest Points For"
          value={
            data.fewestPoints
              ? points(data.fewestPoints.h2h.pointsFor)
              : "—"
          }
          owner={
            data.fewestPoints ? (
              <SeasonRecordOwner entry={data.fewestPoints} />
            ) : null
          }
          detail={
            data.fewestPoints
              ? `${points(
                  data.fewestPoints.h2h.pointsFor /
                    Math.max(1, data.fewestPoints.h2h.games)
                )} PF/G`
              : null
          }
        />

        <RecordCard
          label="Worst Point Differential"
          value={
            data.worstPointDiff
              ? signedPoints(data.worstPointDiff.pointDiff)
              : "—"
          }
          owner={
            data.worstPointDiff ? (
              <SeasonRecordOwner entry={data.worstPointDiff} />
            ) : null
          }
          detail={
            data.worstPointDiff
              ? `${points(data.worstPointDiff.h2h.pointsFor)} PF • ${points(
                  data.worstPointDiff.h2h.pointsAgainst
                )} PA`
              : null
          }
        />

        <RecordCard
          label="Most PF Without a Title"
          value={
            data.mostPointsWithoutTitle
              ? points(data.mostPointsWithoutTitle.h2h.pointsFor)
              : "—"
          }
          owner={
            data.mostPointsWithoutTitle ? (
              <SeasonRecordOwner entry={data.mostPointsWithoutTitle} />
            ) : null
          }
          detail={
            data.mostPointsWithoutTitle
              ? data.mostPointsWithoutTitle.finish
              : null
          }
        />
      </div>

      <div className="subsection-heading">
        <div>
          <p className="eyebrow">Team-season archive</p>
          <h3>All-Time Season Leaderboard</h3>
        </div>
        <span className="muted">
          Completed seasons only • sorted by H2H win %
        </span>
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
            {data.leaderboard.map((entry, index) => (
              <tr key={entry.id}>
                <td className="rank-cell">{index + 1}</td>
                <td>
                  <strong>{entry.season}</strong>
                </td>
                <td>{entry.teamName}</td>
                <td>{entry.managerLineage}</td>
                <td className="record-cell">
                  {formatRecord(entry.h2h)}
                </td>
                <td>{formatPct(entry.winPct)}</td>
                <td>{points(entry.h2h.pointsFor)}</td>
                <td>{points(entry.h2h.pointsAgainst)}</td>
                <td
                  className={
                    entry.pointDiff > 0
                      ? "positive-record"
                      : entry.pointDiff < 0
                        ? "negative-record"
                        : ""
                  }
                >
                  {signedPoints(entry.pointDiff)}
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

      <p className="standings-footnote record-book-footnote">
        Season records deliberately exclude incomplete seasons. Team-season
        accomplishments remain attached to the franchise season even when
        ownership changed; the manager column shows the reconciled ownership
        lineage for that year.
      </p>
    </>
  );
}

function CareerOwner({ manager, detail }) {
  if (!manager) return null;

  return (
    <>
      <strong>{manager.displayName}</strong>
      <span>{detail}</span>
    </>
  );
}

function ManagerRecords({ data }) {
  return (
    <>
      {data.hasLeagueMedianSeasons && (
        <div className="notice compact-notice record-book-notice">
          <strong>Career W/L is H2H only.</strong> League-median bonus results
          never enter manager career records. Playoff W/L is tracked
          separately.
        </div>
      )}

      <div className="record-card-grid record-card-grid-primary">
        <RecordCard
          label="Most Championships"
          value={data.mostTitles?.championships ?? "—"}
          owner={
            data.mostTitles ? (
              <CareerOwner
                manager={data.mostTitles}
                detail={`${data.mostTitles.finals} finals • ${data.mostTitles.playoffAppearances} playoff appearances`}
              />
            ) : null
          }
        />

        <RecordCard
          label="Most Regular-Season Wins"
          value={data.mostRegularWins?.regular.wins ?? "—"}
          owner={
            data.mostRegularWins ? (
              <CareerOwner
                manager={data.mostRegularWins}
                detail={`${formatRecord(
                  data.mostRegularWins.regular
                )} • ${formatPct(data.mostRegularWins.winPct)}`}
              />
            ) : null
          }
        />

        <RecordCard
          label="Best Career Win %"
          value={
            data.bestWinPct
              ? formatPct(data.bestWinPct.winPct)
              : "—"
          }
          owner={
            data.bestWinPct ? (
              <CareerOwner
                manager={data.bestWinPct}
                detail={`${formatRecord(
                  data.bestWinPct.regular
                )} • ${data.bestWinPct.regular.games} games`}
              />
            ) : null
          }
          context={`${data.bestWinPctMinimumGames}-game minimum`}
        />

        <RecordCard
          label="Most Career Points"
          value={
            data.mostCareerPF
              ? points(data.mostCareerPF.regular.pointsFor)
              : "—"
          }
          owner={
            data.mostCareerPF ? (
              <CareerOwner
                manager={data.mostCareerPF}
                detail={`${points(
                  data.mostCareerPF.pointsPerGame
                )} PF/G`}
              />
            ) : null
          }
        />
      </div>

      <div className="record-card-grid record-card-grid-three">
        <RecordCard
          label="Most Playoff Wins"
          value={data.mostPlayoffWins?.playoffs.wins ?? "—"}
          owner={
            data.mostPlayoffWins ? (
              <CareerOwner
                manager={data.mostPlayoffWins}
                detail={`${formatRecord(
                  data.mostPlayoffWins.playoffs
                )} playoff record`}
              />
            ) : null
          }
        />

        <RecordCard
          label="Most Finals"
          value={data.mostFinals?.finals ?? "—"}
          owner={
            data.mostFinals ? (
              <CareerOwner
                manager={data.mostFinals}
                detail={`${data.mostFinals.championships} championships`}
              />
            ) : null
          }
        />

        <RecordCard
          label="Most Playoff Appearances"
          value={data.mostPlayoffAppearances?.playoffAppearances ?? "—"}
          owner={
            data.mostPlayoffAppearances ? (
              <CareerOwner
                manager={data.mostPlayoffAppearances}
                detail={`${data.mostPlayoffAppearances.finals} finals`}
              />
            ) : null
          }
        />

      </div>

      <p className="standings-footnote record-book-footnote">
        Manager records follow reconciled tenures. A replacement owner inherits
        the franchise, not the previous manager&apos;s wins, points, titles or
        playoff results. The complete career standings live in the Managers
        section.
      </p>
    </>
  );
}

export default function RecordBook({ almanac }) {
  const data = useMemo(() => buildRecordBook(almanac), [almanac]);
  const [tab, setTab] = useState("games");

  return (
    <section className="panel record-book">
      <div className="section-heading record-book-heading">
        <div>
          <p className="eyebrow">Record book</p>
          <h2>League Records & Milestones</h2>
        </div>

        <span className="muted">
          {data.games.matchupGames.length} competitive games •{" "}
          {data.seasons.seasons.length} completed team-seasons •{" "}
          {data.careers.managers.length} primary managers
        </span>
      </div>

      <div className="record-book-tabs" role="tablist" aria-label="Record book">
        <button
          className={tab === "games" ? "active" : ""}
          onClick={() => setTab("games")}
        >
          GAME RECORDS
        </button>

        <button
          className={tab === "seasons" ? "active" : ""}
          onClick={() => setTab("seasons")}
        >
          SEASON RECORDS
        </button>

        <button
          className={tab === "careers" ? "active" : ""}
          onClick={() => setTab("careers")}
        >
          MANAGER RECORDS
        </button>
      </div>

      <div className="record-book-body">
        {tab === "games" && <GameRecords data={data.games} />}
        {tab === "seasons" && <SeasonRecords data={data.seasons} />}
        {tab === "careers" && <ManagerRecords data={data.careers} />}
      </div>
    </section>
  );
}
