import { useEffect, useMemo, useState } from "react";
import "./polish.css";
import { loadSleeperHistory } from "./data/sleeper/historyLoader";
import { normalizeSleeperHistory } from "./domain/almanacNormalizer";
import {
  loadCommissionerState,
  removeOwnershipOverride,
  saveOwnershipOverride,
} from "./services/commissionerStore";
import OwnershipReviewModal from "./components/OwnershipReviewModal";
import SeasonExplorer from "./components/SeasonExplorer";
import ManagersExplorer from "./components/ManagersExplorer";
import RivalriesExplorer from "./components/RivalriesExplorer";
import RecordBook from "./components/RecordBook";
import { getMeaningfulCompetitiveGames } from "./domain/gameUtils";

const LEAGUE_KEY = "league-almanac.currentLeagueId";
const NAV_KEY = "league-almanac.activeSection";
const THEME_KEY = "league-almanac.theme";

const NAV_ITEMS = [
  { id: "overview", label: "OVERVIEW" },
  { id: "seasons", label: "SEASONS" },
  { id: "records", label: "RECORDS" },
  { id: "managers", label: "MANAGERS" },
  { id: "rivalries", label: "RIVALRIES" },
  { id: "admin", label: "ADMIN" },
];

function initialTheme() {
  try {
    return localStorage.getItem(THEME_KEY) === "light" ? "light" : "dark";
  } catch {
    return "dark";
  }
}

function initialNavSection() {
  try {
    const stored = sessionStorage.getItem(NAV_KEY);
    return NAV_ITEMS.some((item) => item.id === stored) ? stored : "overview";
  } catch {
    return "overview";
  }
}

function downloadJson(data, filename) {
  const blob = new Blob([JSON.stringify(data, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function managerName(almanac, managerId) {
  if (!managerId) return "Ownership unresolved";

  return (
    almanac.managers.find((manager) => manager.managerId === managerId)
      ?.displayName || managerId
  );
}

function syncSummary(sync, elapsedMs) {
  if (!sync) return null;

  const seconds = (elapsedMs / 1000).toFixed(1);

  if (sync.cacheHits > 0) {
    return `Loaded in ${seconds}s • ${sync.cacheHits} historical season${
      sync.cacheHits === 1 ? "" : "s"
    } from cache • ${sync.fetchedSeasons} season${
      sync.fetchedSeasons === 1 ? "" : "s"
    } refreshed`;
  }

  return `Loaded in ${seconds}s • first sync completed • ${sync.newlyCachedSeasons} completed season${
    sync.newlyCachedSeasons === 1 ? "" : "s"
  } cached for faster future loads`;
}

export default function App() {
  const [leagueId, setLeagueId] = useState(
    () => localStorage.getItem(LEAGUE_KEY) || ""
  );

  const [loading, setLoading] = useState(false);
  const [progressMessage, setProgressMessage] = useState("");
  const [error, setError] = useState("");
  const [rawHistory, setRawHistory] = useState(null);
  const [almanac, setAlmanac] = useState(null);
  const [loadElapsedMs, setLoadElapsedMs] = useState(0);
  const [reviewIssueId, setReviewIssueId] = useState(null);
  const [activeSection, setActiveSection] = useState(initialNavSection);
  const [theme, setTheme] = useState(initialTheme);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    try {
      localStorage.setItem(THEME_KEY, theme);
    } catch {
      // Theme still works if local storage is unavailable.
    }
  }, [theme]);

  function normalizeWithStoredOverrides(raw) {
    const newest = raw.seasons.at(-1);
    const leagueSeriesId = `sleeper-series:${newest.league.league_id}`;
    const commissionerState = loadCommissionerState(leagueSeriesId);

    return normalizeSleeperHistory(raw, {
      ownershipOverrides: commissionerState.ownershipOverrides,
    });
  }

  async function loadLeague({ forceRefresh = false } = {}) {
    const id = leagueId.trim();
    if (!id) return;

    setLoading(true);
    setError("");
    setProgressMessage("Connecting to Sleeper…");

    const startedAt = performance.now();

    try {
      localStorage.setItem(LEAGUE_KEY, id);

      const raw = await loadSleeperHistory(id, {
        forceRefresh,
        onProgress: (event) => {
          if (event?.message) setProgressMessage(event.message);
        },
      });

      const normalized = normalizeWithStoredOverrides(raw);

      setRawHistory(raw);
      setAlmanac(normalized);
      setLoadElapsedMs(performance.now() - startedAt);

      window.__LEAGUE_ALMANAC__ = normalized;
      window.__LEAGUE_ALMANAC_RAW__ = raw;
    } catch (err) {
      console.error(err);
      setError(err?.message || "Failed to load Sleeper history.");
    } finally {
      setLoading(false);
      setProgressMessage("");
    }
  }

  function refreshNormalized() {
    if (!rawHistory) return;
    const normalized = normalizeWithStoredOverrides(rawHistory);
    setAlmanac(normalized);
    window.__LEAGUE_ALMANAC__ = normalized;
  }

  const reviewIssue = useMemo(
    () =>
      almanac?.ownershipIssues.find(
        (issue) => issue.ownershipIssueId === reviewIssueId
      ) || null,
    [almanac, reviewIssueId]
  );

  const reviewSeason = reviewIssue
    ? almanac?.seasons.find((season) => season.season === reviewIssue.season)
    : null;

  const meaningfulCompetitiveGameCount = almanac
    ? getMeaningfulCompetitiveGames(almanac).length
    : 0;

  const stats = almanac
    ? [
        ["Seasons", almanac.seasons.length],
        ["Managers", almanac.managers.length],
        ["Games", meaningfulCompetitiveGameCount],
      ]
    : [];

  const completedSeasons =
    almanac?.seasons.filter((season) => season.status === "complete").length || 0;

  const medianSeasons =
    almanac?.seasons.filter(
      (season) => season.recordFormat?.leagueMedianGameEnabled
    ) || [];

  const unresolvedOwnershipCount =
    almanac?.ownershipIssues.filter((issue) => issue.status !== "resolved")
      .length || 0;

  const resolvedOwnershipCount =
    almanac?.ownershipIssues.filter((issue) => issue.status === "resolved")
      .length || 0;



  function toggleTheme() {
    setTheme((current) => (current === "dark" ? "light" : "dark"));
  }

  function selectSection(sectionId) {
    setActiveSection(sectionId);

    try {
      sessionStorage.setItem(NAV_KEY, sectionId);
    } catch {
      // Navigation still works if session storage is unavailable.
    }

    requestAnimationFrame(() => {
      document.getElementById("almanac-section-nav")?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    });
  }

  function saveReview(decision) {
    if (!reviewIssue || !almanac) return;

    saveOwnershipOverride(
      almanac.leagueSeries.leagueSeriesId,
      reviewIssue.ownershipIssueId,
      decision
    );

    refreshNormalized();
    setReviewIssueId(null);
  }

  function leaveReviewUnresolved() {
    if (!reviewIssue || !almanac) return;

    removeOwnershipOverride(
      almanac.leagueSeries.leagueSeriesId,
      reviewIssue.ownershipIssueId
    );

    refreshNormalized();
    setReviewIssueId(null);
  }

  const statusLabel = loading ? "SYNCING" : almanac ? "LIVE" : "OFFLINE";

  return (
    <div className="almanac-app">
      <div
        className={`terminal-statusbar ${
          loading ? "syncing" : almanac ? "online" : "offline"
        }`}
      >
        <div className="terminal-status-left">
          <span className="terminal-pulse" aria-hidden="true" />
          <span className="terminal-status-label">{statusLabel}</span>
          <span> · LOCAL · CACHED</span>
        </div>
        <div className="terminal-status-right">
          {almanac
            ? `CONNECTED · ${almanac.leagueSeries.name}`
            : "AWAITING LEAGUE"}
        </div>
      </div>

      <main className="almanac-shell">
        <div className="masthead">
          <div className={`masthead-brand ${almanac ? "connected" : "disconnected"}`}>
            <div className="almanac-logo" aria-hidden="true">LA</div>
            <div>
              {almanac && <p className="eyebrow">League Almanac</p>}
              <h1>{almanac?.leagueSeries?.name || "League Almanac"}</h1>
              <p className="subhead">
                Historical records, champions, managers, rivalries and league lore.
              </p>
            </div>
          </div>

          <div className="masthead-utility">
            {almanac && (
              <div className="masthead-meta">
                <span>{completedSeasons} completed seasons</span>
                <span>{almanac.managers.length} known managers</span>
              </div>
            )}

            <button
              type="button"
              className="terminal-theme-toggle"
              onClick={toggleTheme}
              aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
              title={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
            >
              {theme === "dark" ? "☀" : "☾"}
            </button>
          </div>
        </div>

      <section className="panel load-panel">
        <div className="controls">
          <input
            value={leagueId}
            onChange={(event) => setLeagueId(event.target.value)}
            placeholder="Sleeper league ID"
            onKeyDown={(event) => {
              if (event.key === "Enter") loadLeague();
            }}
          />

          <button
            onClick={() => loadLeague()}
            disabled={loading || !leagueId.trim()}
          >
            {loading ? "SYNCING…" : almanac ? "REFRESH LEAGUE" : "LOAD HISTORY"}
          </button>

          {almanac && (
            <>
              <button
                className="secondary-button"
                onClick={() => loadLeague({ forceRefresh: true })}
                disabled={loading}
                title="Bypasses cached historical seasons and downloads the full league history again."
              >
                FULL RESYNC
              </button>

              <button
                className="secondary-button"
                onClick={() =>
                  downloadJson(
                    almanac,
                    `league-almanac-${almanac.leagueSeries.currentSleeperLeagueId}.json`
                  )
                }
              >
                EXPORT JSON
              </button>
            </>
          )}
        </div>

        {loading && progressMessage && (
          <div className="sync-message">{progressMessage}</div>
        )}

        {!loading && almanac?.sync && (
          <div className="sync-message">
            {syncSummary(almanac.sync, loadElapsedMs)}
          </div>
        )}

        {error && <div className="error">{error}</div>}
      </section>

      {almanac && (
        <>
          <nav
            className="almanac-nav"
            id="almanac-section-nav"
            aria-label="League Almanac sections"
          >
            <div className="almanac-nav-track">
              {NAV_ITEMS.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className={`almanac-nav-button ${
                    activeSection === item.id ? "active" : ""
                  }`}
                  onClick={() => selectSection(item.id)}
                  aria-current={activeSection === item.id ? "page" : undefined}
                >
                  <span>{item.label}</span>
                  {item.id === "admin" && unresolvedOwnershipCount > 0 && (
                    <span
                      className="almanac-nav-badge"
                      aria-label={`${unresolvedOwnershipCount} ownership reviews pending`}
                    >
                      {unresolvedOwnershipCount}
                    </span>
                  )}
                </button>
              ))}
            </div>
          </nav>

          <div className="almanac-section-content" data-section={activeSection}>
            {activeSection === "overview" && (
              <>
                <section className="summary-grid">
                  {stats.map(([label, value]) => (
                    <div className="metric" key={label}>
                      <div className="metric-label">{label}</div>
                      <div className="metric-value">{value}</div>
                    </div>
                  ))}
                </section>

                {medianSeasons.length > 0 && (
                  <section className="notice">
                    <strong>League-median scoring detected.</strong>{" "}
                    {medianSeasons.map((season) => season.season).join(", ")} use an
                    extra game against the league median. The Almanac is keeping
                    head-to-head games separate from official standings records so
                    those extra results will not contaminate rivalry/H2H history.
                  </section>
                )}

                <section className="panel">
                  <div className="section-heading">
                    <div>
                      <p className="eyebrow">Championship History</p>
                      <h2>Hall of Champions</h2>
                    </div>
                    <span className="muted">
                      {almanac.champions.length} championship season
                      {almanac.champions.length === 1 ? "" : "s"}
                    </span>
                  </div>

                  <div className="champion-grid">
                    {almanac.champions.map((champion) => (
                      <article className="champion-card" key={champion.championId}>
                        <div className="champion-season">{champion.season}</div>
                        <div className="champion-kicker">League Champion</div>
                        <h3>{managerName(almanac, champion.winner.managerId)}</h3>
                        <div className="champion-team">{champion.winner.teamName}</div>

                        <div className="champion-score">
                          <strong>
                            {champion.winner.points == null
                              ? "—"
                              : champion.winner.points.toFixed(2)}
                          </strong>
                          <span>–</span>
                          <strong>
                            {champion.runnerUp.points == null
                              ? "—"
                              : champion.runnerUp.points.toFixed(2)}
                          </strong>
                        </div>

                        <div className="champion-runner">
                          vs. {managerName(almanac, champion.runnerUp.managerId)}
                          <span>{champion.runnerUp.teamName}</span>
                        </div>
                      </article>
                    ))}
                  </div>
                </section>
              </>
            )}

            {activeSection === "seasons" && (
              <SeasonExplorer
                almanac={almanac}
                onReviewOwnership={(issueId) => setReviewIssueId(issueId)}
              />
            )}

            {activeSection === "records" && <RecordBook almanac={almanac} />}

            {activeSection === "managers" && (
              <ManagersExplorer almanac={almanac} />
            )}

            {activeSection === "rivalries" && (
              <RivalriesExplorer almanac={almanac} />
            )}

            {activeSection === "admin" && (
              <>
                <section className="admin-section-intro">
                  <div>
                    <p className="eyebrow">Admin</p>
                    <h2>League Administration</h2>
                    <p>
                      Commissioner-only data integrity tools and historical
                      overrides live here.
                    </p>
                  </div>
                </section>

                <section className="panel admin-reconciliation-panel">
                  <div className="section-heading">
                    <div>
                      <p className="eyebrow">Data integrity</p>
                      <h2>Ownership Reconciliation</h2>
                    </div>
                    <span className="muted">
                      {unresolvedOwnershipCount === 0
                        ? `${resolvedOwnershipCount} historical handoff${
                            resolvedOwnershipCount === 1 ? "" : "s"
                          } reconciled`
                        : `${unresolvedOwnershipCount} handoff${
                            unresolvedOwnershipCount === 1 ? "" : "s"
                          } still need review`}
                    </span>
                  </div>

                  {almanac.ownershipIssues.length > 0 &&
                    unresolvedOwnershipCount === 0 && (
                      <div className="reconciliation-complete">
                        <div className="reconciliation-check">✓</div>
                        <div>
                          <strong>Ownership history reconciled.</strong>
                          <span>
                            Manager tenure boundaries are now being applied to weekly
                            games, playoff results and future career statistics. You
                            can still edit any decision below.
                          </span>
                        </div>
                      </div>
                    )}

                  {almanac.ownershipIssues.length === 0 ? (
                    <div className="muted">
                      No cross-season owner changes detected.
                    </div>
                  ) : (
                    <div className="table-wrap">
                      <table>
                        <thead>
                          <tr>
                            <th>Season</th>
                            <th>Roster</th>
                            <th>Previous manager</th>
                            <th>Current snapshot</th>
                            <th>Evidence</th>
                            <th>Status</th>
                          </tr>
                        </thead>

                        <tbody>
                          {almanac.ownershipIssues.map((issue) => {
                            const previous = issue.previousManagerId
                              ? managerName(almanac, issue.previousManagerId)
                              : "VACANT / NO OWNER";
                            const current = issue.currentManagerId
                              ? managerName(almanac, issue.currentManagerId)
                              : "VACANT / NO OWNER";

                            const classification =
                              issue.evidence?.classification
                                ?.replaceAll("_", " ")
                                .toUpperCase() || "NEEDS REVIEW";

                            return (
                              <tr
                                key={issue.ownershipIssueId}
                                className="clickable-row"
                                onClick={() =>
                                  setReviewIssueId(issue.ownershipIssueId)
                                }
                              >
                                <td>{issue.season}</td>
                                <td>{issue.rosterId}</td>
                                <td>{previous}</td>
                                <td>{current}</td>
                                <td className="evidence-cell">{classification}</td>
                                <td>
                                  <button
                                    className={`badge-button ${
                                      issue.status === "resolved" ? "resolved" : ""
                                    }`}
                                    onClick={(event) => {
                                      event.stopPropagation();
                                      setReviewIssueId(issue.ownershipIssueId);
                                    }}
                                  >
                                    {issue.status === "resolved"
                                      ? `EDIT • W${issue.effectiveWeek}`
                                      : "REVIEW"}
                                  </button>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </section>
              </>
            )}
          </div>
        </>
      )}

      {reviewIssue && (
        <OwnershipReviewModal
          issue={reviewIssue}
          managers={almanac.managers}
          season={reviewSeason}
          onClose={() => setReviewIssueId(null)}
          onSave={saveReview}
          onLeaveUnresolved={leaveReviewUnresolved}
        />
      )}
      </main>
    </div>
  );
}
