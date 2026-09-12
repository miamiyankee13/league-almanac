import { useEffect, useMemo, useState } from "react";
import {
  loadCommissionerState,
  removeManagerAttributionOverride,
  saveManagerAttributionOverride,
} from "../services/commissionerStore";

function managerName(almanac, managerId) {
  if (!managerId) return "Unresolved";

  return (
    almanac.managers.find((manager) => manager.managerId === managerId)
      ?.displayName || managerId
  );
}

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

export default function HistoricalManagerAttributionAdmin({
  almanac,
  onChange,
  reloadToken = 0,
}) {
  const leagueSeriesId = almanac.leagueSeries.leagueSeriesId;
  const completedSleeperSeasons = useMemo(
    () =>
      new Set(
        almanac.seasons
          .filter((season) => season.status === "complete" && !season.historicalOnly)
          .map((season) => season.season)
      ),
    [almanac]
  );

  const latestSleeperSeason = useMemo(
    () =>
      [...almanac.seasons]
        .filter((season) => !season.historicalOnly)
        .sort((a, b) => Number(b.season) - Number(a.season))[0]?.season || null,
    [almanac]
  );

  const latestPrimaryByRoster = useMemo(() => {
    const map = new Map();

    for (const team of almanac.seasonTeams) {
      if (team.historicalOnly || team.season !== latestSleeperSeason) continue;
      map.set(team.rosterId, team.ownerSnapshot?.primaryManagerId || null);
    }

    return map;
  }, [almanac, latestSleeperSeason]);

  const eligibleTeams = useMemo(
    () =>
      almanac.seasonTeams
        .filter(
          (team) =>
            !team.historicalOnly &&
            completedSleeperSeasons.has(team.season) &&
            team.managerAttributionStatus === "season_snapshot_accepted" &&
            Array.isArray(team.ownerSnapshot?.coManagerIds) &&
            team.ownerSnapshot.coManagerIds.length > 0
        )
        .sort(
          (a, b) =>
            Number(b.season) - Number(a.season) ||
            Number(a.rosterId) - Number(b.rosterId)
        ),
    [almanac, completedSleeperSeasons]
  );

  const [revision, setRevision] = useState(0);
  const currentState = useMemo(
    () => loadCommissionerState(leagueSeriesId),
    [leagueSeriesId, reloadToken, revision]
  );
  const activeOverrides = currentState.managerAttributionOverrides || {};

  const [drafts, setDrafts] = useState({});

  useEffect(() => {
    const next = {};

    for (const team of eligibleTeams) {
      const primary = team.ownerSnapshot.primaryManagerId || "";
      const eligibleIds = new Set(
        unique([primary, ...(team.ownerSnapshot.coManagerIds || [])])
      );
      const saved = activeOverrides[team.seasonTeamId]?.creditedManagerId || null;
      next[team.seasonTeamId] = saved && eligibleIds.has(saved) ? saved : primary;
    }

    setDrafts(next);
  }, [eligibleTeams, activeOverrides]);

  const activeCount = eligibleTeams.filter((team) => {
    const saved = activeOverrides[team.seasonTeamId]?.creditedManagerId;
    return saved && saved !== team.ownerSnapshot.primaryManagerId;
  }).length;

  function save(team) {
    const originalPrimaryManagerId = team.ownerSnapshot.primaryManagerId;
    const creditedManagerId = drafts[team.seasonTeamId] || originalPrimaryManagerId;

    if (!creditedManagerId || creditedManagerId === originalPrimaryManagerId) {
      removeManagerAttributionOverride(leagueSeriesId, team.seasonTeamId);
    } else {
      const documentedCoOwners = new Set(team.ownerSnapshot.coManagerIds || []);
      if (!documentedCoOwners.has(creditedManagerId)) return;

      saveManagerAttributionOverride(leagueSeriesId, team.seasonTeamId, {
        creditedManagerId,
        originalPrimaryManagerId,
        reason: "documented_sleeper_co_owner",
        updatedAt: new Date().toISOString(),
      });
    }

    setRevision((value) => value + 1);
    onChange?.();
  }

  return (
    <section className="panel admin-manager-attribution-panel">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Historical attribution</p>
          <h2>Historical Manager Attribution</h2>
        </div>
        <span className="muted">
          {activeCount} active override{activeCount === 1 ? "" : "s"}
        </span>
      </div>

      <div className="notice compact-notice">
        <strong>Use this only for documented Sleeper co-owned teams.</strong>{" "}
        Reassigning a completed season gives the selected co-owner full Almanac credit
        for that season instead of the listed Sleeper primary owner. Games, playoff
        results, championships, manager records and rivalry history all follow the
        reassignment; credit is not duplicated.
      </div>

      {eligibleTeams.length === 0 ? (
        <div className="muted">
          No completed Sleeper seasons with documented co-owners are eligible for
          reassignment.
        </div>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Season</th>
                <th>Team</th>
                <th>Sleeper primary</th>
                <th>Documented co-owner(s)</th>
                <th>Almanac credit</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {eligibleTeams.map((team) => {
                const primaryId = team.ownerSnapshot.primaryManagerId;
                const coOwnerIds = unique(team.ownerSnapshot.coManagerIds || []);
                const currentOwnerId = latestPrimaryByRoster.get(team.rosterId) || null;
                const selectedId = drafts[team.seasonTeamId] || primaryId || "";
                const savedId = activeOverrides[team.seasonTeamId]?.creditedManagerId || null;
                const hasOverride = Boolean(savedId && savedId !== primaryId);
                const changed = selectedId !== (savedId || primaryId || "");

                return (
                  <tr key={team.seasonTeamId}>
                    <td>{team.season}</td>
                    <td>{team.teamName}</td>
                    <td>{managerName(almanac, primaryId)}</td>
                    <td>
                      {coOwnerIds.map((managerId) => (
                        <div key={managerId}>
                          {managerName(almanac, managerId)}
                          {managerId === currentOwnerId ? " · CURRENT OWNER" : ""}
                        </div>
                      ))}
                    </td>
                    <td>
                      <select
                        value={selectedId}
                        onChange={(event) =>
                          setDrafts((current) => ({
                            ...current,
                            [team.seasonTeamId]: event.target.value,
                          }))
                        }
                      >
                        {unique([primaryId, ...coOwnerIds]).map((managerId) => (
                          <option key={managerId} value={managerId}>
                            {managerName(almanac, managerId)}
                            {managerId === primaryId ? " (Sleeper primary)" : ""}
                            {managerId === currentOwnerId ? " (current owner)" : ""}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td>
                      <button
                        type="button"
                        className={`badge-button ${hasOverride ? "resolved" : ""}`}
                        onClick={() => save(team)}
                        disabled={!changed && !hasOverride}
                      >
                        {selectedId === primaryId
                          ? hasOverride
                            ? "RESET"
                            : "SLEEPER"
                          : changed
                            ? "SAVE"
                            : "OVERRIDE"}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <div className="muted">
        Seasons with an ownership-reconciliation handoff are intentionally excluded here;
        reconcile those tenure boundaries above instead of applying a full-season override.
      </div>
    </section>
  );
}
