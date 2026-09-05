import { useMemo, useState } from "react";
import {
  buildRivalryMetrics,
  formatRivalryRecord,
  recordForManager,
} from "../domain/rivalryMetrics";
import RivalryProfileModal from "./RivalryProfileModal";

function currentManagerIds(almanac) {
  const latestSeason = [...almanac.seasons].sort(
    (a, b) => Number(b.season) - Number(a.season)
  )[0];

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

function displayOrder(pair, focusManagerId) {
  if (focusManagerId === pair.managerBId) {
    return {
      primaryId: pair.managerBId,
      primaryName: pair.managerBName,
      secondaryId: pair.managerAId,
      secondaryName: pair.managerAName,
    };
  }

  return {
    primaryId: pair.managerAId,
    primaryName: pair.managerAName,
    secondaryId: pair.managerBId,
    secondaryName: pair.managerBName,
  };
}

function seriesSummary(pair, focusManagerId) {
  if (!pair?.regular?.games) return "No regular-season meetings";

  const order = displayOrder(pair, focusManagerId);
  const primary = recordForManager(pair, pair.regular, order.primaryId);
  const secondary = recordForManager(pair, pair.regular, order.secondaryId);

  if (primary.wins === secondary.wins) {
    return `Series tied ${formatRivalryRecord(primary)}`;
  }

  if (primary.wins > secondary.wins) {
    return `${order.primaryName} leads ${formatRivalryRecord(primary)}`;
  }

  return `${order.secondaryName} leads ${formatRivalryRecord(secondary)}`;
}

function meetingResult(meeting) {
  if (!meeting) return "—";

  if (!meeting.winnerManagerId) {
    return `${meeting.managerAName} tied ${meeting.managerBName} ${Number(
      meeting.pointsA
    ).toFixed(2)}–${Number(meeting.pointsB).toFixed(2)}`;
  }

  const winnerIsA = meeting.winnerManagerId === meeting.managerAId;
  const winnerName = winnerIsA ? meeting.managerAName : meeting.managerBName;
  const loserName = winnerIsA ? meeting.managerBName : meeting.managerAName;
  const winnerPoints = winnerIsA ? meeting.pointsA : meeting.pointsB;
  const loserPoints = winnerIsA ? meeting.pointsB : meeting.pointsA;

  return `${winnerName} def. ${loserName} ${Number(winnerPoints).toFixed(
    2
  )}–${Number(loserPoints).toFixed(2)}`;
}

function latestMeetingReceipt(pair) {
  const meeting = pair?.latestMeeting;
  if (!meeting) return "No meetings yet";

  const stage = meeting.isPlayoff ? ` · ${meeting.stage}` : "";
  return `Last: ${meeting.season} W${meeting.week}${stage} — ${meetingResult(
    meeting
  )}`;
}

export default function RivalriesExplorer({ almanac }) {
  const data = useMemo(() => buildRivalryMetrics(almanac), [almanac]);
  const activeManagerIds = useMemo(
    () => currentManagerIds(almanac),
    [almanac]
  );

  const [selectedRivalryId, setSelectedRivalryId] = useState(null);
  const [scope, setScope] = useState("current");
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
    }

    return rows;
  }, [data.rivalries, managerFilter, scope, activeManagerIds]);

  const focusManagerId = managerFilter === "all" ? null : managerFilter;

  return (
    <>
      <section className="panel rivalries-explorer">
        <div className="section-heading rivalry-section-heading">
          <div>
            <p className="eyebrow">Rivalries</p>
            <h2>Head-to-Head Archive</h2>
          </div>

          <span className="muted">
            {data.rivalries.length} historical pairing
            {data.rivalries.length === 1 ? "" : "s"}
          </span>
        </div>

        <div className="rivalry-browser rivalry-browser-clean">
          <div className="rivalry-scope-tabs">
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
              onChange={(event) => {
                const nextManager = event.target.value;
                setManagerFilter(nextManager);
                if (nextManager !== "all") setScope("all");
              }}
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
            {data.unattributedRegularGames + data.unattributedPlayoffGames}{" "}
            historical game
            {data.unattributedRegularGames + data.unattributedPlayoffGames === 1
              ? ""
              : "s"}{" "}
            are withheld because manager attribution remains unresolved.
          </div>
        )}

        {focusManagerId && (
          <div className="rivalry-focus-label">
            {managerOptions.find((manager) => manager.id === focusManagerId)?.name ||
              focusManagerId}
            &apos;s rivalry history
          </div>
        )}

        <div className="rivalry-list rivalry-list-clean">
          {filteredRivalries.map((rivalry) => {
            const order = displayOrder(rivalry, focusManagerId);

            return (
              <button
                type="button"
                key={rivalry.rivalryId}
                className="rivalry-compact-row rivalry-compact-row-clean"
                onClick={() => setSelectedRivalryId(rivalry.rivalryId)}
              >
                <div className="rivalry-compact-main rivalry-compact-main-clean">
                  <strong>
                    {order.primaryName}
                    <span> vs. </span>
                    {order.secondaryName}
                  </strong>
                  <small className="rivalry-series-line">
                    {seriesSummary(rivalry, focusManagerId)}
                  </small>
                  <small className="rivalry-latest-line">
                    {latestMeetingReceipt(rivalry)}
                  </small>
                </div>

                <div className="rivalry-compact-counts">
                  <span>
                    <strong>{rivalry.regular.games}</strong> regular meeting
                    {rivalry.regular.games === 1 ? "" : "s"}
                  </span>
                  <span>
                    <strong>{rivalry.playoffs.games}</strong> playoff meeting
                    {rivalry.playoffs.games === 1 ? "" : "s"}
                  </span>
                </div>

                <div className="rivalry-row-chevron">›</div>
              </button>
            );
          })}

          {filteredRivalries.length === 0 && (
            <div className="empty-state">
              No rivalry pairings match this filter.
            </div>
          )}
        </div>

        <p className="standings-footnote rivalry-footnote compact">
          Current Owners shows active manager pairings. League-median bonus games
          and lower placement playoff games are excluded from rivalry records.
        </p>
      </section>

      {selectedRivalry && (
        <RivalryProfileModal
          rivalry={selectedRivalry}
          focusManagerId={focusManagerId}
          onClose={() => setSelectedRivalryId(null)}
        />
      )}
    </>
  );
}
