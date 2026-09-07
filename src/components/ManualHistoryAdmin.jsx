import { useEffect, useMemo, useState } from "react";
import {
  loadCommissionerState,
  saveManualHistory,
} from "../services/commissionerStore";
import { normalizeManualHistory } from "../domain/manualHistory";

function uid(prefix) {
  try {
    if (globalThis.crypto?.randomUUID) return `${prefix}:${globalThis.crypto.randomUUID()}`;
  } catch {
    // Fall through to a timestamp-based local ID.
  }

  return `${prefix}:${Date.now()}:${Math.random().toString(36).slice(2, 9)}`;
}

function numberOrBlank(value) {
  return value == null ? "" : value;
}

function currentSleeperTeamCount(almanac) {
  const latestSleeperSeason = [...almanac.seasons]
    .filter((season) => season.sleeperLeagueId)
    .sort((a, b) => Number(b.season) - Number(a.season))[0];

  if (!latestSleeperSeason) return 12;

  return (
    almanac.seasonTeams.filter(
      (team) => team.season === latestSleeperSeason.season && team.sleeperLeagueId
    ).length || 12
  );
}

function blankTeams(season, count) {
  return Array.from({ length: count }, (_, index) => ({
    manualTeamId: uid(`manual-team:${season}`),
    rank: index + 1,
    teamName: "",
    managerId: null,
    wins: null,
    losses: null,
    ties: 0,
    finish: null,
  }));
}

function managerOptions(almanac, history) {
  const historicalIds = new Set(history.managers.map((manager) => manager.managerId));

  return {
    sleeper: almanac.managers
      .filter((manager) => !historicalIds.has(manager.managerId) && manager.sleeperUserId)
      .sort((a, b) => a.displayName.localeCompare(b.displayName)),
    historical: history.managers
      .slice()
      .sort((a, b) => a.displayName.localeCompare(b.displayName)),
  };
}

function historyForLeague(leagueSeriesId) {
  return normalizeManualHistory(
    loadCommissionerState(leagueSeriesId).manualHistory
  );
}

export default function ManualHistoryAdmin({ almanac, onChange, reloadToken = 0 }) {
  const leagueSeriesId = almanac.leagueSeries.leagueSeriesId;
  const [history, setHistory] = useState(() => historyForLeague(leagueSeriesId));
  const [newManagerName, setNewManagerName] = useState("");
  const [newSeasonYear, setNewSeasonYear] = useState("");
  const [newSeasonPlatform, setNewSeasonPlatform] = useState("ESPN");
  const [newSeasonTeamCount, setNewSeasonTeamCount] = useState(() =>
    currentSleeperTeamCount(almanac)
  );
  const [newSeasonPlayoffFieldSize, setNewSeasonPlayoffFieldSize] = useState(() =>
    Math.min(6, currentSleeperTeamCount(almanac))
  );
  const [dirtySeasons, setDirtySeasons] = useState(new Set());
  const [message, setMessage] = useState("");

  useEffect(() => {
    setHistory(historyForLeague(leagueSeriesId));
    setDirtySeasons(new Set());
    setMessage("");
  }, [leagueSeriesId, reloadToken]);

  const options = useMemo(
    () => managerOptions(almanac, history),
    [almanac, history]
  );

  const sleeperSeasonIds = useMemo(
    () => new Set(almanac.seasons.filter((season) => season.sleeperLeagueId).map((season) => season.season)),
    [almanac]
  );

  const earliestSleeperSeason = useMemo(() => {
    const years = almanac.seasons
      .filter((season) => season.sleeperLeagueId)
      .map((season) => Number(season.season));
    return years.length ? Math.min(...years) : null;
  }, [almanac]);

  function persist(nextHistory, nextMessage) {
    const normalized = normalizeManualHistory(nextHistory);
    saveManualHistory(leagueSeriesId, normalized);
    setHistory(normalized);
    setMessage(nextMessage || "Manual history saved locally.");
    onChange?.();
    return normalized;
  }

  function addHistoricalManager() {
    const displayName = newManagerName.trim();
    if (!displayName) return;

    const next = {
      ...history,
      managers: [
        ...history.managers,
        {
          managerId: uid("manual-manager"),
          displayName,
          aliases: [],
        },
      ],
    };

    persist(next, `${displayName} added as a historical manager.`);
    setNewManagerName("");
  }

  function updateHistoricalManager(managerId, displayName) {
    const clean = displayName.trim();
    if (!clean) return;

    persist(
      {
        ...history,
        managers: history.managers.map((manager) =>
          manager.managerId === managerId
            ? { ...manager, displayName: clean }
            : manager
        ),
      },
      "Historical manager updated."
    );
  }

  function deleteHistoricalManager(managerId) {
    const manager = history.managers.find((item) => item.managerId === managerId);
    if (!manager) return;

    if (!window.confirm(`Delete historical manager ${manager.displayName}? Any season rows mapped to this manager will become unresolved.`)) {
      return;
    }

    const next = {
      ...history,
      managers: history.managers.filter((item) => item.managerId !== managerId),
      seasons: history.seasons.map((season) => ({
        ...season,
        teams: season.teams.map((team) =>
          team.managerId === managerId ? { ...team, managerId: null } : team
        ),
      })),
    };

    persist(next, `${manager.displayName} removed; linked rows are now unresolved.`);
  }

  function addHistoricalSeason() {
    const season = newSeasonYear.trim();
    const count = Math.max(1, Math.min(32, Number(newSeasonTeamCount) || 12));
    const playoffFieldSize =
      newSeasonPlayoffFieldSize === "" || newSeasonPlayoffFieldSize == null
        ? null
        : Math.floor(Number(newSeasonPlayoffFieldSize));

    if (
      playoffFieldSize != null &&
      (!Number.isFinite(playoffFieldSize) || playoffFieldSize < 1 || playoffFieldSize > count)
    ) {
      setMessage(`Playoff teams must be between 1 and ${count}, or left blank if unknown.`);
      return;
    }

    if (!/^\d{4}$/.test(season)) {
      setMessage("Enter a four-digit season year.");
      return;
    }

    if (sleeperSeasonIds.has(season)) {
      setMessage(`${season} already exists as a Sleeper season and cannot be replaced by manual history.`);
      return;
    }

    if (earliestSleeperSeason && Number(season) >= earliestSleeperSeason) {
      setMessage(`Manual History is reserved for pre-Sleeper seasons. This league's Sleeper history begins in ${earliestSleeperSeason}.`);
      return;
    }

    if (history.seasons.some((item) => item.season === season)) {
      setMessage(`${season} already exists in Manual History.`);
      return;
    }

    const nextSeason = {
      manualSeasonId: uid(`manual-season:${season}`),
      season,
      platform: newSeasonPlatform.trim() || "ESPN",
      note: "",
      playoffFieldSize,
      teams: blankTeams(season, count),
    };

    const next = persist(
      {
        ...history,
        seasons: [...history.seasons, nextSeason],
      },
      `${season} historical season created. Fill in the standings and map owners below.`
    );

    setHistory(next);
    setNewSeasonYear("");
  }

  function editSeason(seasonId, updater) {
    setHistory((current) => ({
      ...current,
      seasons: current.seasons.map((season) =>
        season.manualSeasonId === seasonId ? updater(season) : season
      ),
    }));

    setDirtySeasons((current) => new Set([...current, seasonId]));
  }

  function editTeam(seasonId, teamId, patch) {
    editSeason(seasonId, (season) => ({
      ...season,
      teams: season.teams.map((team) =>
        team.manualTeamId === teamId ? { ...team, ...patch } : team
      ),
    }));
  }

  function saveSeason(seasonId) {
    const season = history.seasons.find((item) => item.manualSeasonId === seasonId);
    if (!season) return;

    const playoffFieldSize = Number(season.playoffFieldSize || 0);
    if (
      season.playoffFieldSize != null &&
      season.playoffFieldSize !== "" &&
      (!Number.isFinite(playoffFieldSize) ||
        playoffFieldSize < 1 ||
        playoffFieldSize > season.teams.length)
    ) {
      setMessage(
        `${season.season} playoff teams must be between 1 and ${season.teams.length}, or left blank if unknown.`
      );
      return;
    }

    const finishes = season.teams.map((team) => team.finish).filter(Boolean);

    if (
      playoffFieldSize > 0 &&
      playoffFieldSize < 4 &&
      finishes.includes("3rd Place")
    ) {
      setMessage(
        `${season.season} has a 3rd Place finisher, which proves a semifinal/3rd-place structure. Set Playoff Teams to at least 4, or leave it blank if the field size is unknown.`
      );
      return;
    }

    for (const finish of ["Champion", "Runner-up", "3rd Place"]) {
      if (finishes.filter((item) => item === finish).length > 1) {
        setMessage(`${season.season} has more than one ${finish}. Fix the finish column before saving.`);
        return;
      }
    }

    persist(history, `${season.season} historical season saved.`);
    setDirtySeasons((current) => {
      const next = new Set(current);
      next.delete(seasonId);
      return next;
    });
  }

  function deleteSeason(seasonId) {
    const season = history.seasons.find((item) => item.manualSeasonId === seasonId);
    if (!season) return;

    if (!window.confirm(`Delete the manually entered ${season.season} season?`)) {
      return;
    }

    persist(
      {
        ...history,
        seasons: history.seasons.filter((item) => item.manualSeasonId !== seasonId),
      },
      `${season.season} manual history deleted.`
    );
  }

  return (
    <section className="panel manual-history-panel">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Historical data</p>
          <h2>Manual History</h2>
        </div>
        <span className="muted">
          {history.seasons.length} historical season{history.seasons.length === 1 ? "" : "s"}
        </span>
      </div>

      <div className="notice compact-notice manual-history-scope-note">
        <strong>Manual history extends only the records the source data can prove.</strong>{" "}
        Standings/records, seasons managed, top-three finishes and playoff field size can
        extend career history. Every other known playoff qualifier receives at least one
        documented playoff loss, while podium finishes use the stronger minimum playoff W/L
        their finish proves. Only the known Champion vs. Runner-up final creates an
        opponent-specific playoff/rivalry meeting.
      </div>

      <div className="manual-history-coverage-grid">
        <div>
          <span>Included when entered</span>
          <strong>Standings · W/L · Titles · Finals · Playoff appearances · Minimum documented playoff W/L · Known championship H2H</strong>
        </div>
        <div>
          <span>Still requires matchup/score data</span>
          <strong>Weekly scores · Pre-Sleeper regular H2H · Unknown opponents · Margins · Streaks · Additional playoff rounds</strong>
        </div>
      </div>

      <div className="subsection-heading manual-history-subheading">
        <div>
          <p className="eyebrow">Identity mapping</p>
          <h3>Historical Managers</h3>
        </div>
        <span className="muted">Create only for owners who do not map to an existing Sleeper manager</span>
      </div>

      <div className="manual-history-create-row">
        <input
          value={newManagerName}
          onChange={(event) => setNewManagerName(event.target.value)}
          placeholder="Historical manager name"
          onKeyDown={(event) => {
            if (event.key === "Enter") addHistoricalManager();
          }}
        />
        <button type="button" onClick={addHistoricalManager} disabled={!newManagerName.trim()}>
          Add Historical Manager
        </button>
      </div>

      {history.managers.length > 0 && (
        <div className="manual-manager-list">
          {history.managers.map((manager) => (
            <HistoricalManagerRow
              key={manager.managerId}
              manager={manager}
              onSave={updateHistoricalManager}
              onDelete={deleteHistoricalManager}
            />
          ))}
        </div>
      )}

      <div className="subsection-heading manual-history-subheading">
        <div>
          <p className="eyebrow">Pre-Sleeper archive</p>
          <h3>Historical Seasons</h3>
        </div>
        <span className="muted">Team names remain preserved separately from owner identity</span>
      </div>

      <div className="manual-history-season-create">
        <label>
          <span>Season</span>
          <input
            inputMode="numeric"
            value={newSeasonYear}
            onChange={(event) => setNewSeasonYear(event.target.value)}
            placeholder="2018"
          />
        </label>
        <label>
          <span>Platform</span>
          <input
            value={newSeasonPlatform}
            onChange={(event) => setNewSeasonPlatform(event.target.value)}
            placeholder="ESPN"
          />
        </label>
        <label>
          <span>Teams</span>
          <input
            type="number"
            min="1"
            max="32"
            value={newSeasonTeamCount}
            onChange={(event) => setNewSeasonTeamCount(event.target.value)}
          />
        </label>
        <label>
          <span>Playoff teams</span>
          <input
            type="number"
            min="1"
            max={newSeasonTeamCount || 32}
            value={numberOrBlank(newSeasonPlayoffFieldSize)}
            onChange={(event) => setNewSeasonPlayoffFieldSize(event.target.value)}
            placeholder="6"
          />
        </label>
        <button type="button" onClick={addHistoricalSeason}>
          Add Historical Season
        </button>
      </div>

      {message && <div className="sync-message manual-history-message">{message}</div>}

      {history.seasons.length === 0 ? (
        <div className="empty-state manual-history-empty">
          No pre-Sleeper seasons entered yet.
        </div>
      ) : (
        <div className="manual-history-season-list">
          {[...history.seasons]
            .sort((a, b) => Number(b.season) - Number(a.season))
            .map((season) => (
              <HistoricalSeasonEditor
                key={season.manualSeasonId}
                season={season}
                managerOptions={options}
                dirty={dirtySeasons.has(season.manualSeasonId)}
                onSeasonChange={(patch) =>
                  editSeason(season.manualSeasonId, (current) => ({ ...current, ...patch }))
                }
                onTeamChange={(teamId, patch) =>
                  editTeam(season.manualSeasonId, teamId, patch)
                }
                onSave={() => saveSeason(season.manualSeasonId)}
                onDelete={() => deleteSeason(season.manualSeasonId)}
              />
            ))}
        </div>
      )}

      <p className="standings-footnote manual-history-storage-note">
        Manual history is stored in this league&apos;s local commissioner state and is
        included in the Almanac JSON export. Keep an export as a backup before
        clearing browser/site storage or moving to another device.
      </p>
    </section>
  );
}

function HistoricalManagerRow({ manager, onSave, onDelete }) {
  const [name, setName] = useState(manager.displayName);

  return (
    <div className="manual-manager-row">
      <input value={name} onChange={(event) => setName(event.target.value)} />
      <span className="manual-source-chip">Commissioner entered</span>
      <button type="button" onClick={() => onSave(manager.managerId, name)}>
        Save
      </button>
      <button type="button" className="secondary-button" onClick={() => onDelete(manager.managerId)}>
        Delete
      </button>
    </div>
  );
}

function HistoricalSeasonEditor({
  season,
  managerOptions,
  dirty,
  onSeasonChange,
  onTeamChange,
  onSave,
  onDelete,
}) {
  return (
    <article className="manual-season-card">
      <div className="manual-season-card-header">
        <div>
          <span className="manual-source-chip">Commissioner entered</span>
          <h3>{season.season} · {season.platform || "Historical"}</h3>
        </div>
        <div className="manual-season-actions">
          {dirty && <span className="manual-dirty-label">Unsaved changes</span>}
          <button type="button" onClick={onSave}>Save Season</button>
          <button type="button" className="secondary-button" onClick={onDelete}>Delete</button>
        </div>
      </div>

      <div className="manual-season-meta-editor">
        <label>
          <span>Platform</span>
          <input
            value={season.platform}
            onChange={(event) => onSeasonChange({ platform: event.target.value })}
          />
        </label>
        <label>
          <span>Playoff teams</span>
          <input
            type="number"
            min="1"
            max={season.teams.length}
            value={numberOrBlank(season.playoffFieldSize)}
            onChange={(event) =>
              onSeasonChange({
                playoffFieldSize: event.target.value === "" ? null : event.target.value,
              })
            }
            placeholder="Unknown"
          />
        </label>
        <label className="manual-season-note-field">
          <span>Source note</span>
          <input
            value={season.note || ""}
            onChange={(event) => onSeasonChange({ note: event.target.value })}
            placeholder="Optional note about where the history came from"
          />
        </label>
      </div>

      <div className="table-wrap manual-history-table-wrap">
        <table className="manual-history-table">
          <thead>
            <tr>
              <th>#</th>
              <th>Team</th>
              <th>Manager</th>
              <th>W</th>
              <th>L</th>
              <th>T</th>
              <th>Postseason Finish</th>
            </tr>
          </thead>
          <tbody>
            {season.teams.map((team) => (
              <tr key={team.manualTeamId}>
                <td>
                  <input
                    className="manual-rank-input"
                    type="number"
                    min="1"
                    value={numberOrBlank(team.rank)}
                    onChange={(event) => onTeamChange(team.manualTeamId, { rank: event.target.value })}
                  />
                </td>
                <td>
                  <input
                    value={team.teamName}
                    onChange={(event) => onTeamChange(team.manualTeamId, { teamName: event.target.value })}
                    placeholder="Historical team name"
                  />
                </td>
                <td>
                  <select
                    value={team.managerId || ""}
                    onChange={(event) => onTeamChange(team.manualTeamId, { managerId: event.target.value || null })}
                  >
                    <option value="">Unresolved</option>
                    {managerOptions.sleeper.length > 0 && (
                      <optgroup label="Existing Sleeper-era managers">
                        {managerOptions.sleeper.map((manager) => (
                          <option key={manager.managerId} value={manager.managerId}>
                            {manager.displayName}
                          </option>
                        ))}
                      </optgroup>
                    )}
                    {managerOptions.historical.length > 0 && (
                      <optgroup label="Historical managers">
                        {managerOptions.historical.map((manager) => (
                          <option key={manager.managerId} value={manager.managerId}>
                            {manager.displayName}
                          </option>
                        ))}
                      </optgroup>
                    )}
                  </select>
                </td>
                {[
                  ["wins", "W"],
                  ["losses", "L"],
                  ["ties", "T"],
                ].map(([field, label]) => (
                  <td key={field}>
                    <input
                      className="manual-record-input"
                      aria-label={`${season.season} ${team.teamName || "team"} ${label}`}
                      type="number"
                      min="0"
                      value={numberOrBlank(team[field])}
                      onChange={(event) => onTeamChange(team.manualTeamId, { [field]: event.target.value })}
                    />
                  </td>
                ))}
                <td>
                  <select
                    value={team.finish || ""}
                    onChange={(event) => onTeamChange(team.manualTeamId, { finish: event.target.value || null })}
                  >
                    <option value="">—</option>
                    <option value="Champion">Champion</option>
                    <option value="Runner-up">Runner-up</option>
                    <option value="3rd Place">3rd Place</option>
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="standings-footnote manual-history-footnote">
        Rank + Playoff Teams can credit playoff appearances. Every non-podium qualifier inside that field also gets at least one documented playoff loss because elimination is certain; their finish is shown as Playoffs because the exact round is unknown. Podium finishes use the stronger minimum playoff W/L they prove: with a known semifinal round, Champion and Runner-up each get one required pre-final win; 3rd Place gets one semifinal loss plus one 3rd-place win. Only Champion + Runner-up supplies an exact opponent-specific championship meeting for rivalry history. No missing opponent, score, margin or additional round is invented.
      </p>
    </article>
  );
}
