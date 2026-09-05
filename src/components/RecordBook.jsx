import { useMemo, useState } from "react";
import {
  buildRecordBook,
  formatPct,
  formatRecord,
} from "../domain/recordBookMetrics";
import {
  buildRivalryMetrics,
  seriesLeaderLabel,
} from "../domain/rivalryMetrics";

function points(value) {
  return Number(value || 0).toFixed(2);
}

function signedPoints(value) {
  const n = Number(value || 0);
  return `${n > 0 ? "+" : ""}${n.toFixed(2)}`;
}

function equalNumber(a, b) {
  return Math.abs(Number(a || 0) - Number(b || 0)) < 1e-9;
}

function tiedMax(items, getter) {
  if (!items.length) return [];
  const best = Math.max(...items.map((item) => Number(getter(item) || 0)));
  return items.filter((item) => equalNumber(getter(item), best));
}

function tiedMin(items, getter) {
  if (!items.length) return [];
  const best = Math.min(...items.map((item) => Number(getter(item) || 0)));
  return items.filter((item) => equalNumber(getter(item), best));
}

function unique(values) {
  return [...new Set(values.filter(Boolean))];
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

function singleGameOwner(entry) {
  if (!entry) return null;
  return (
    <>
      <strong>{entry.managerName}</strong>
      <span>{entry.teamName}</span>
    </>
  );
}

function tiedGameOwners(entries, selector = (entry) => entry) {
  const names = unique(entries.map((entry) => selector(entry)?.managerName));
  return (
    <>
      <strong>{names.join(" · ") || "Multiple games"}</strong>
      <span>
        {entries.length} tied game{entries.length === 1 ? "" : "s"}
      </span>
    </>
  );
}

function entryResult(entry) {
  if (!entry) return "—";

  if (entry.outcome === "T") {
    return `${entry.managerName} tied ${entry.opponentManagerName} ${points(
      entry.points
    )}–${points(entry.opponentPoints)}`;
  }

  if (entry.outcome === "W") {
    return `${entry.managerName} def. ${entry.opponentManagerName} ${points(
      entry.points
    )}–${points(entry.opponentPoints)}`;
  }

  return `${entry.opponentManagerName} def. ${entry.managerName} ${points(
    entry.opponentPoints
  )}–${points(entry.points)}`;
}

function entryReceipt(entry) {
  if (!entry) return "—";
  const stage = entry.stage !== "Regular Season" ? ` · ${entry.stage}` : "";
  return `${entry.season} W${entry.week}${stage} — ${entryResult(entry)}`;
}

function matchupResult(game) {
  if (!game) return "—";

  if (game.isTie) {
    return `${game.teamA.managerName} tied ${game.teamB.managerName} ${points(
      game.teamA.points
    )}–${points(game.teamB.points)}`;
  }

  return `${game.winner.managerName} def. ${game.loser.managerName} ${points(
    game.winner.points
  )}–${points(game.loser.points)}`;
}

function matchupReceipt(game) {
  if (!game) return "—";
  const stage = game.stage !== "Regular Season" ? ` · ${game.stage}` : "";
  return `${game.season} W${game.week}${stage} — ${matchupResult(game)}`;
}

function GameRecords({ data }) {
  const decidedGames = data.matchupGames.filter((game) => !game.isTie);
  const losingEntries = data.teamGames.filter((entry) => entry.outcome === "L");
  const winningEntries = data.teamGames.filter((entry) => entry.outcome === "W");

  const highestScore = tiedMax(data.teamGames, (entry) => entry.points);
  const lowestScore = tiedMin(data.teamGames, (entry) => entry.points);
  const biggestBlowout = tiedMax(decidedGames, (game) => game.margin);
  const closestWin = tiedMin(decidedGames, (game) => game.margin);
  const highestLosing = tiedMax(losingEntries, (entry) => entry.points);
  const lowestWinning = tiedMin(winningEntries, (entry) => entry.points);
  const highestCombined = tiedMax(
    data.matchupGames,
    (game) => game.combinedPoints
  );
  const lowestCombined = tiedMin(
    data.matchupGames,
    (game) => game.combinedPoints
  );

  const sideCard = (label, entries, valueFormatter) => {
    const entry = entries[0];
    return (
      <RecordCard
        label={label}
        value={entry ? valueFormatter(entry) : "—"}
        owner={
          entries.length === 1
            ? singleGameOwner(entry)
            : entries.length > 1
              ? tiedGameOwners(entries)
              : null
        }
        detail={
          entries.length === 1
            ? entryReceipt(entry)
            : entries.length > 1
              ? "Tied record"
              : null
        }
      />
    );
  };

  const matchupCard = (label, entries, valueFormatter, ownerSelector) => {
    const game = entries[0];
    return (
      <RecordCard
        label={label}
        value={game ? valueFormatter(game) : "—"}
        owner={
          game && ownerSelector
            ? entries.length === 1
              ? singleGameOwner(ownerSelector(game))
              : tiedGameOwners(entries, ownerSelector)
            : entries.length > 1
              ? (
                  <>
                    <strong>{entries.length} games</strong>
                    <span>Tied record</span>
                  </>
                )
              : null
        }
        detail={
          entries.length === 1
            ? matchupReceipt(game)
            : entries.length > 1
              ? "Tied record"
              : null
        }
      />
    );
  };

  return (
    <>
      <div className="record-card-grid record-card-grid-primary">
        {sideCard("Highest Weekly Score", highestScore, (entry) => points(entry.points))}
        {matchupCard(
          "Biggest Blowout",
          biggestBlowout,
          (game) => `${points(game.margin)} pts`,
          (game) => game.winner
        )}
        {matchupCard(
          "Closest Win",
          closestWin,
          (game) => `${points(game.margin)} pts`,
          (game) => game.winner
        )}
        {sideCard(
          "Highest Losing Score",
          highestLosing,
          (entry) => points(entry.points)
        )}
      </div>

      <div className="record-card-grid">
        {sideCard("Lowest Weekly Score", lowestScore, (entry) => points(entry.points))}
        {sideCard(
          "Lowest Winning Score",
          lowestWinning,
          (entry) => points(entry.points)
        )}
        {matchupCard(
          "Highest Combined Score",
          highestCombined,
          (game) => points(game.combinedPoints),
          null
        )}
        {matchupCard(
          "Lowest Combined Score",
          lowestCombined,
          (game) => points(game.combinedPoints),
          null
        )}
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
                    <td className="record-book-number">{points(entry.points)}</td>
                    <td>{entryResult(entry)}</td>
                    <td>
                      {entry.season} W{entry.week}
                      {entry.stage !== "Regular Season" && <span>{entry.stage}</span>}
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
              <h3>Top 10 Highest-Scoring Losses</h3>
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
                {data.badBeats.map((entry, index) => (
                  <tr key={entry.id}>
                    <td className="rank-cell">{index + 1}</td>
                    <td>
                      <strong>{entry.managerName}</strong>
                      <span>{entry.teamName}</span>
                    </td>
                    <td className="record-book-number">{points(entry.points)}</td>
                    <td>{entryResult(entry)}</td>
                    <td>
                      {entry.season} W{entry.week}
                      {entry.stage !== "Regular Season" && <span>{entry.stage}</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <p className="standings-footnote record-book-footnote">
        Game records include regular-season games, championship-path playoff
        games and the official 3rd-place game. Lower placement games are excluded.
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

function SeasonRecordOwners({ entries }) {
  if (!entries.length) return null;
  if (entries.length === 1) return <SeasonRecordOwner entry={entries[0]} />;

  return (
    <>
      <strong>
        {entries
          .map((entry) => `${entry.managerLineage} (${entry.season})`)
          .join(" · ")}
      </strong>
      <span>{entries.length}-way tie</span>
    </>
  );
}

function SeasonRecords({ data }) {
  const seasons = data.seasons;
  const bestRecord = tiedMax(seasons, (entry) => entry.winPct);
  const mostWins = tiedMax(seasons, (entry) => entry.h2h.wins);
  const mostPoints = tiedMax(seasons, (entry) => entry.h2h.pointsFor);
  const bestPointDiff = tiedMax(seasons, (entry) => entry.pointDiff);
  const worstRecord = tiedMin(seasons, (entry) => entry.winPct);
  const fewestPoints = tiedMin(seasons, (entry) => entry.h2h.pointsFor);
  const worstPointDiff = tiedMin(seasons, (entry) => entry.pointDiff);
  const noTitle = seasons.filter((entry) => !entry.champion);
  const mostPointsWithoutTitle = tiedMax(noTitle, (entry) => entry.h2h.pointsFor);

  const seasonCard = ({ label, entries, value, detail }) => (
    <RecordCard
      label={label}
      value={entries[0] ? value(entries[0]) : "—"}
      owner={<SeasonRecordOwners entries={entries} />}
      detail={
        entries.length === 1
          ? detail?.(entries[0]) || null
          : entries.length > 1
            ? "Tied record"
            : null
      }
    />
  );

  return (
    <>
      {data.hasLeagueMedianSeasons && (
        <div className="notice compact-notice record-book-notice">
          <strong>Season records use actual H2H games.</strong> League-median
          bonus results are excluded here so different eras remain comparable.
          Sleeper&apos;s official record remains available in Season Explorer.
        </div>
      )}

      <div className="record-card-grid record-card-grid-primary">
        {seasonCard({
          label: "Best H2H Record",
          entries: bestRecord,
          value: (entry) => `${formatRecord(entry.h2h)} • ${formatPct(entry.winPct)}`,
          detail: (entry) => entry.finish,
        })}
        {seasonCard({
          label: "Most H2H Wins",
          entries: mostWins,
          value: (entry) => entry.h2h.wins,
          detail: (entry) => `${formatRecord(entry.h2h)} • ${entry.finish}`,
        })}
        {seasonCard({
          label: "Most Points For",
          entries: mostPoints,
          value: (entry) => points(entry.h2h.pointsFor),
          detail: (entry) =>
            `${points(entry.h2h.pointsFor / Math.max(1, entry.h2h.games))} PF/G • ${entry.finish}`,
        })}
        {seasonCard({
          label: "Best Point Differential",
          entries: bestPointDiff,
          value: (entry) => signedPoints(entry.pointDiff),
          detail: (entry) =>
            `${points(entry.h2h.pointsFor)} PF • ${points(entry.h2h.pointsAgainst)} PA`,
        })}
      </div>

      <div className="record-card-grid">
        {seasonCard({
          label: "Worst H2H Record",
          entries: worstRecord,
          value: (entry) => `${formatRecord(entry.h2h)} • ${formatPct(entry.winPct)}`,
          detail: (entry) => entry.finish,
        })}
        {seasonCard({
          label: "Fewest Points For",
          entries: fewestPoints,
          value: (entry) => points(entry.h2h.pointsFor),
          detail: (entry) =>
            `${points(entry.h2h.pointsFor / Math.max(1, entry.h2h.games))} PF/G`,
        })}
        {seasonCard({
          label: "Worst Point Differential",
          entries: worstPointDiff,
          value: (entry) => signedPoints(entry.pointDiff),
          detail: (entry) =>
            `${points(entry.h2h.pointsFor)} PF • ${points(entry.h2h.pointsAgainst)} PA`,
        })}
        {seasonCard({
          label: "Most Points Without a Title",
          entries: mostPointsWithoutTitle,
          value: (entry) => points(entry.h2h.pointsFor),
          detail: (entry) => entry.finish,
        })}
      </div>

      <p className="standings-footnote record-book-footnote">
        Season records use completed seasons and actual opponent H2H results.
        The complete all-time season standings now live in Season Explorer.
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

function CareerOwners({ managers, detail }) {
  if (!managers.length) return null;
  if (managers.length === 1) {
    return <CareerOwner manager={managers[0]} detail={detail(managers[0])} />;
  }

  return (
    <>
      <strong>{managers.map((manager) => manager.displayName).join(" · ")}</strong>
      <span>{managers.length}-way tie</span>
    </>
  );
}

function ManagerRecords({ data }) {
  const managers = data.managers;
  const mostTitles = tiedMax(managers, (manager) => manager.championships);
  const mostRegularWins = tiedMax(managers, (manager) => manager.regular.wins);
  const bestWinPool = managers.filter(
    (manager) => manager.regular.games >= data.bestWinPctMinimumGames
  );
  const bestWinPct = tiedMax(bestWinPool, (manager) => manager.winPct);
  const mostCareerPF = tiedMax(managers, (manager) => manager.regular.pointsFor);
  const mostPlayoffWins = tiedMax(managers, (manager) => manager.playoffs.wins);
  const mostFinals = tiedMax(managers, (manager) => manager.finals);
  const mostPlayoffAppearances = tiedMax(
    managers,
    (manager) => manager.playoffAppearances
  );

  const careerCard = ({ label, entries, value, detail, context }) => (
    <RecordCard
      label={label}
      value={entries[0] ? value(entries[0]) : "—"}
      owner={
        <CareerOwners
          managers={entries}
          detail={detail || (() => "")}
        />
      }
      context={context}
      detail={entries.length > 1 ? "Tied record" : null}
    />
  );

  return (
    <>
      {data.hasLeagueMedianSeasons && (
        <div className="notice compact-notice record-book-notice">
          <strong>Career W/L is H2H only.</strong> League-median bonus results
          never enter manager career records. Playoff W/L is tracked separately.
        </div>
      )}

      <div className="record-card-grid record-card-grid-primary">
        {careerCard({
          label: "Most Championships",
          entries: mostTitles,
          value: (manager) => manager.championships,
          detail: (manager) =>
            `${manager.finals} finals • ${manager.playoffAppearances} playoff appearances`,
        })}
        {careerCard({
          label: "Most Regular-Season Wins",
          entries: mostRegularWins,
          value: (manager) => manager.regular.wins,
          detail: (manager) =>
            `${formatRecord(manager.regular)} • ${formatPct(manager.winPct)}`,
        })}
        {careerCard({
          label: "Best Career Win %",
          entries: bestWinPct,
          value: (manager) => formatPct(manager.winPct),
          detail: (manager) =>
            `${formatRecord(manager.regular)} • ${manager.regular.games} games`,
          context: `${data.bestWinPctMinimumGames}-game minimum`,
        })}
        {careerCard({
          label: "Most Career Points",
          entries: mostCareerPF,
          value: (manager) => points(manager.regular.pointsFor),
          detail: (manager) => `${points(manager.pointsPerGame)} PF/G`,
        })}
      </div>

      <div className="record-card-grid record-card-grid-three">
        {careerCard({
          label: "Most Playoff Wins",
          entries: mostPlayoffWins,
          value: (manager) => manager.playoffs.wins,
          detail: (manager) => `${formatRecord(manager.playoffs)} playoff record`,
        })}
        {careerCard({
          label: "Most Finals",
          entries: mostFinals,
          value: (manager) => manager.finals,
          detail: (manager) => `${manager.championships} championships`,
        })}
        {careerCard({
          label: "Most Playoff Appearances",
          entries: mostPlayoffAppearances,
          value: (manager) => manager.playoffAppearances,
          detail: (manager) => `${manager.finals} finals`,
        })}
      </div>

      <p className="standings-footnote record-book-footnote">
        Manager records follow reconciled tenures. A replacement owner inherits
        the franchise, not the previous manager&apos;s career statistics. The full
        career standings live in Managers.
      </p>
    </>
  );
}

function pairName(pair) {
  return pair ? `${pair.managerAName} vs. ${pair.managerBName}` : "—";
}

function RivalryOwners({ pairs }) {
  if (!pairs.length) return null;
  if (pairs.length === 1) {
    return (
      <>
        <strong>{pairName(pairs[0])}</strong>
        <span>League rivalry record</span>
      </>
    );
  }

  return (
    <>
      <strong>{pairs.map(pairName).join(" · ")}</strong>
      <span>{pairs.length}-way tie</span>
    </>
  );
}

function RivalryRecords({ data }) {
  const mostMeetings = tiedMax(data.rivalries, (pair) => pair.all.games);
  const playoffPairs = data.rivalries.filter((pair) => pair.playoffs.games > 0);
  const mostPlayoffMeetings = tiedMax(
    playoffPairs,
    (pair) => pair.playoffs.games
  );
  const tightest = data.closestSeries;

  return (
    <>
      <div className="record-card-grid record-card-grid-three rivalry-record-grid">
        <RecordCard
          label="Most Meetings"
          value={mostMeetings[0]?.all.games ?? "—"}
          owner={<RivalryOwners pairs={mostMeetings} />}
          detail={mostMeetings.length > 1 ? "Tied record" : null}
        />

        <RecordCard
          label="Tightest Series"
          value={tightest ? seriesLeaderLabel(tightest, tightest.all) : "—"}
          owner={
            tightest ? (
              <>
                <strong>{pairName(tightest)}</strong>
                <span>
                  {tightest.all.games} total meeting
                  {tightest.all.games === 1 ? "" : "s"} • {tightest.regular.games} regular • {tightest.playoffs.games} playoff
                </span>
              </>
            ) : null
          }
        />

        <RecordCard
          label="Most Playoff Meetings"
          value={mostPlayoffMeetings[0]?.playoffs.games ?? "—"}
          owner={<RivalryOwners pairs={mostPlayoffMeetings} />}
          detail={mostPlayoffMeetings.length > 1 ? "Tied record" : null}
        />
      </div>

      <p className="standings-footnote record-book-footnote">
        Rivalry records use actual manager-vs-manager games. Playoff meetings
        include championship-path games and the official 3rd-place game.
      </p>
    </>
  );
}

export default function RecordBook({ almanac }) {
  const data = useMemo(() => buildRecordBook(almanac), [almanac]);
  const rivalryData = useMemo(() => buildRivalryMetrics(almanac), [almanac]);
  const [tab, setTab] = useState("games");

  return (
    <section className="panel record-book">
      <div className="section-heading record-book-heading">
        <div>
          <p className="eyebrow">Record book</p>
          <h2>League Records & Milestones</h2>
        </div>
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

        <button
          className={tab === "rivalries" ? "active" : ""}
          onClick={() => setTab("rivalries")}
        >
          RIVALRY RECORDS
        </button>
      </div>

      <div className="record-book-body">
        {tab === "games" && <GameRecords data={data.games} />}
        {tab === "seasons" && <SeasonRecords data={data.seasons} />}
        {tab === "careers" && <ManagerRecords data={data.careers} />}
        {tab === "rivalries" && <RivalryRecords data={rivalryData} />}
      </div>
    </section>
  );
}
