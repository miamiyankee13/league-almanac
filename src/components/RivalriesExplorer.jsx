import { useMemo, useState } from "react";
import {
  buildRivalryMetrics,
  seriesLeaderLabel,
} from "../domain/rivalryMetrics";
import RivalryProfileModal from "./RivalryProfileModal";

const FEATURED_LIMIT = 10;

function points(value) {
  return Number(value || 0).toFixed(2);
}

function pairNames(pair) {
  if (!pair) return "—";
  return `${pair.managerAName} vs. ${pair.managerBName}`;
}

function latestMeetingLabel(pair) {
  const meeting = pair?.latestMeeting;
  if (!meeting) return "—";

  if (!meeting.winnerManagerId) {
    return `${meeting.season} W${meeting.week} • tie`;
  }

  const winner =
    meeting.winnerManagerId === pair.managerAId
      ? pair.managerAName
      : pair.managerBName;

  return `${meeting.season} W${meeting.week} • ${winner} won`;
}

function currentManagerIds(almanac) {
  const latestSeason = [...almanac.seasons]
    .sort((a, b) => Number(b.season) - Number(a.season))[0];

  if (!latestSeason) return new Set();

  const ids = new Set();

  for (const team of almanac.seasonTeams) {
    if (team.season !== latestSeason.season) continue;
    if (team.ownerSnapshot?.primaryManagerId) {
      ids.add(team.ownerSnapshot.primaryManagerId);
    }
  }

  for (const tenure of almanac.managerTenures) {
    if (
      tenure.season === latestSeason.season &&
      ["primary", "incoming_owner"].includes(tenure.role) &&
      tenure.managerId
    ) {
      ids.add(tenure.managerId);
    }
  }

  return ids;
}

function rivalryScore(pair, currentIds) {
  const bothCurrent =
    currentIds.has(pair.managerAId) && currentIds.has(pair.managerBId);

  const oneCurrent =
    currentIds.has(pair.managerAId) || currentIds.has(pair.managerBId);

  return (
    pair.all.games * 10 +
    pair.playoffs.games * 18 +
    (bothCurrent ? 24 : oneCurrent ? 8 : 0) -
    pair.averageMargin * 0.05
  );
}

export default function RivalriesExplorer({ almanac }) {
  const data = useMemo(() => buildRivalryMetrics(almanac), [almanac]);
  const activeManagerIds = useMemo(
    () => currentManagerIds(almanac),
    [almanac]
  );

  const [selectedRivalryId, setSelectedRivalryId] = useState(null);
  const [scope, setScope] = useState("featured");
  const [managerFilter, setManagerFilter] = useState("all");

  const selectedRivalry =
    data.rivalries.find(
      (rivalry) => rivalry.rivalryId === selectedRivalryId
    ) || null;

  const managerOptions = useMemo(() => {
    const ids = new Set();

    for (const rivalry of data.rivalries) {
      ids.add(rivalry.managerAId);
      ids.add(rivalry.managerBId);
    }

    return [...ids]
      .map((id) => ({
        id,
        name:
          almanac.managers.find((manager) => manager.managerId === id)
            ?.displayName || id,
        current: activeManagerIds.has(id),
      }))
      .sort((a, b) => {
        if (a.current !== b.current) return a.current ? -1 : 1;
        return a.name.localeCompare(b.name);
      });
  }, [data.rivalries, almanac.managers, activeManagerIds]);

  const filteredRivalries = useMemo(() => {
    let rows = [...data.rivalries];

    if (managerFilter !== "all") {
      rows = rows.filter(
        (rivalry) =>
          rivalry.managerAId === managerFilter ||
          rivalry.managerBId === managerFilter
      );
    }

    if (scope === "current") {
      rows = rows.filter(
        (rivalry) =>
          activeManagerIds.has(rivalry.managerAId) &&
          activeManagerIds.has(rivalry.managerBId)
      );
    } else if (scope === "playoffs") {
      rows = rows.filter((rivalry) => rivalry.playoffs.games > 0);
    } else if (scope === "featured" && managerFilter === "all") {
      rows = rows
        .sort(
          (a, b) =>
            rivalryScore(b, activeManagerIds) -
            rivalryScore(a, activeManagerIds)
        )
        .slice(0, FEATURED_LIMIT);
    }

    return rows;
  }, [
    data.rivalries,
    managerFilter,
    scope,
    activeManagerIds,
  ]);

  const showingFeaturedSubset =
    scope === "featured" &&
    managerFilter === "all" &&
    data.rivalries.length > FEATURED_LIMIT;

  return (
    <>
      <section className="panel rivalries-explorer">
        <div className="section-heading rivalry-section-heading">
          <div>
            <p className="eyebrow">Rivalries</p>
            <h2>Head-to-Head Archive</h2>
          </div>

          <span className="muted">
            {data.rivalries.length} historical manager pairing
            {data.rivalries.length === 1 ? "" : "s"}
          </span>
        </div>

        <div className="rivalry-leader-cards compact">
          <article>
            <span>Most Meetings</span>
            <strong>{pairNames(data.mostMeetings)}</strong>
            <small>
              {data.mostMeetings
                ? `${data.mostMeetings.all.games} meetings`
                : "—"}
            </small>
          </article>

          <article>
            <span>Tightest Series</span>
            <strong>{pairNames(data.closestSeries)}</strong>
            <small>
              {data.closestSeries
                ? seriesLeaderLabel(
                    data.closestSeries,
                    data.closestSeries.regular
                  )
                : "—"}
            </small>
          </article>

          <article>
            <span>Most Playoff Meetings</span>
            <strong>{pairNames(data.mostPlayoffMeetings)}</strong>
            <small>
              {data.mostPlayoffMeetings
                ? `${data.mostPlayoffMeetings.playoffs.games} playoff meeting${
                    data.mostPlayoffMeetings.playoffs.games === 1 ? "" : "s"
                  }`
                : "None yet"}
            </small>
          </article>
        </div>

        <div className="rivalry-browser">
          <div className="rivalry-scope-tabs">
            <button
              className={scope === "featured" ? "active" : ""}
              onClick={() => setScope("featured")}
            >
              FEATURED
            </button>
            <button
              className={scope === "current" ? "active" : ""}
              onClick={() => setScope("current")}
            >
              CURRENT OWNERS
            </button>
            <button
              className={scope === "playoffs" ? "active" : ""}
              onClick={() => setScope("playoffs")}
            >
              PLAYOFF HISTORY
            </button>
            <button
              className={scope === "all" ? "active" : ""}
              onClick={() => setScope("all")}
            >
              ALL
            </button>
          </div>

          <label className="rivalry-manager-filter">
            <span>Manager</span>
            <select
              value={managerFilter}
              onChange={(event) => setManagerFilter(event.target.value)}
            >
              <option value="all">All managers</option>
              {managerOptions.map((manager) => (
                <option key={manager.id} value={manager.id}>
                  {manager.name}
                  {manager.current ? " • current" : " • former"}
                </option>
              ))}
            </select>
          </label>
        </div>

        {(data.unattributedRegularGames > 0 ||
          data.unattributedPlayoffGames > 0) && (
          <div className="rivalry-data-note">
            {data.unattributedRegularGames +
              data.unattributedPlayoffGames}{" "}
            historical game
            {data.unattributedRegularGames +
              data.unattributedPlayoffGames ===
            1
              ? ""
              : "s"}{" "}
            are withheld because manager attribution remains unresolved.
          </div>
        )}

        <div className="rivalry-list">
          {filteredRivalries.map((rivalry) => (
            <button
              type="button"
              key={rivalry.rivalryId}
              className="rivalry-compact-row"
              onClick={() => setSelectedRivalryId(rivalry.rivalryId)}
            >
              <div className="rivalry-compact-main">
                <strong>
                  {rivalry.managerAName}
                  <span> vs. </span>
                  {rivalry.managerBName}
                </strong>
                <small>{latestMeetingLabel(rivalry)}</small>
              </div>

              <div className="rivalry-compact-stat rivalry-series-stat">
                <span>Series</span>
                <strong>
                  {seriesLeaderLabel(rivalry, rivalry.regular)}
                </strong>
              </div>

              <div className="rivalry-compact-stat">
                <span>Meetings</span>
                <strong>{rivalry.regular.games}</strong>
              </div>

              <div className="rivalry-compact-stat">
                <span>Playoffs</span>
                <strong>
                  {rivalry.playoffs.games
                    ? rivalry.playoffs.games
                    : "—"}
                </strong>
              </div>

              <div className="rivalry-row-chevron">›</div>
            </button>
          ))}

          {filteredRivalries.length === 0 && (
            <div className="empty-state">
              No rivalry pairings match this filter.
            </div>
          )}
        </div>

        {showingFeaturedSubset && (
          <button
            type="button"
            className="rivalry-view-all"
            onClick={() => setScope("all")}
          >
            VIEW ALL {data.rivalries.length} RIVALRIES
          </button>
        )}

        <p className="standings-footnote rivalry-footnote compact">
          Featured prioritizes established series, playoff history and current
          owners. Use the manager filter to instantly isolate one owner&apos;s
          complete rivalry history. League-median bonus games and lower
          placement playoff games never count.
        </p>
      </section>

      {selectedRivalry && (
        <RivalryProfileModal
          rivalry={selectedRivalry}
          onClose={() => setSelectedRivalryId(null)}
        />
      )}
    </>
  );
}
