import {
  formatManagerRecord,
  formatManagerWinPct,
} from "../domain/managerMetrics";

function formatPoints(value) {
  return Number(value || 0).toFixed(2);
}

function seasonRecordLabel(season) {
  return `${formatManagerRecord(season.regular)} • ${formatPoints(
    season.regular.pointsFor
  )} PF`;
}

function seasonDescriptor(season) {
  const franchise = season.franchiseNumber
    ? `Franchise ${season.franchiseNumber}`
    : "Franchise";

  if (season.teamName) return `${franchise} • ${season.teamName}`;
  return franchise;
}

export default function ManagerProfileModal({ manager, onClose }) {
  if (!manager) return null;

  const activeLabel = manager.current
    ? manager.currentTeamName
      ? `Current • ${manager.currentTeamName}`
      : "Current manager"
    : `Last active ${manager.mostRecentSeason || "—"}`;

  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <section
        className="manager-profile-modal"
        onMouseDown={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={`${manager.displayName} manager profile`}
      >
        <div className="manager-profile-header">
          <div>
            <p className="eyebrow">Manager profile</p>
            <h2>{manager.displayName}</h2>
            <div className="manager-profile-subtitle">
              <span>{activeLabel}</span>
              <span>Joined {manager.joinSeason || "—"}</span>
              <span>{manager.primarySeasonCount} season{manager.primarySeasonCount === 1 ? "" : "s"}</span>
            </div>
          </div>

          <button className="modal-close" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>

        <div className="manager-profile-metrics">
          <div>
            <span>Career H2H</span>
            <strong>{formatManagerRecord(manager.regular)}</strong>
          </div>
          <div>
            <span>Win %</span>
            <strong>{formatManagerWinPct(manager.winPct)}</strong>
          </div>
          <div>
            <span>Points For</span>
            <strong>{formatPoints(manager.regular.pointsFor)}</strong>
          </div>
          <div>
            <span>PF / Game</span>
            <strong>{formatPoints(manager.pointsPerGame)}</strong>
          </div>
          <div>
            <span>Playoffs</span>
            <strong>{manager.playoffAppearances}</strong>
          </div>
          <div>
            <span>Finals</span>
            <strong>{manager.finals}</strong>
          </div>
          <div>
            <span>Titles</span>
            <strong>{manager.championships}</strong>
          </div>
          <div>
            <span>Playoff Record</span>
            <strong>{formatManagerRecord(manager.playoffs)}</strong>
          </div>
        </div>

        <div className="manager-story-grid">
          <article>
            <span>Best Season</span>
            <strong>{manager.bestSeason?.season || "—"}</strong>
            <small>
              {manager.bestSeason
                ? seasonRecordLabel(manager.bestSeason)
                : "No completed H2H games"}
            </small>
          </article>

          <article>
            <span>Worst Season</span>
            <strong>{manager.worstSeason?.season || "—"}</strong>
            <small>
              {manager.worstSeason
                ? seasonRecordLabel(manager.worstSeason)
                : "No completed H2H games"}
            </small>
          </article>

          <article>
            <span>Most-Faced Opponent</span>
            <strong>{manager.archrival?.displayName || "—"}</strong>
            <small>
              {manager.archrival
                ? `${formatManagerRecord(manager.archrival)} in ${manager.archrival.games} meetings`
                : "No opponent history yet"}
            </small>
          </article>
        </div>

        <div className="manager-profile-section-heading">
          <div>
            <p className="eyebrow">Career timeline</p>
            <h3>Season by Season</h3>
          </div>
          <span>Manager credit follows reconciled ownership weeks</span>
        </div>

        <div className="table-wrap manager-season-table-wrap">
          <table className="manager-season-table">
            <thead>
              <tr>
                <th>Season</th>
                <th>Franchise / Team</th>
                <th>Tenure</th>
                <th>H2H</th>
                <th>Win %</th>
                <th>PF</th>
                <th>Playoffs</th>
                <th>Finish</th>
              </tr>
            </thead>
            <tbody>
              {manager.seasons.map((season) => (
                <tr key={season.key}>
                  <td><strong>{season.season}</strong></td>
                  <td>
                    <strong className="manager-season-team">
                      {seasonDescriptor(season)}
                    </strong>
                  </td>
                  <td>{season.tenureLabel || "—"}</td>
                  <td>{formatManagerRecord(season.regular)}</td>
                  <td>{formatManagerWinPct(
                    season.regular.games
                      ? (season.regular.wins + season.regular.ties * 0.5) /
                          season.regular.games
                      : 0
                  )}</td>
                  <td>{formatPoints(season.regular.pointsFor)}</td>
                  <td>
                    {season.playoffAppearance
                      ? formatManagerRecord(season.playoffs)
                      : "—"}
                  </td>
                  <td>
                    <span
                      className={
                        season.finish === "Champion"
                          ? "title-finish"
                          : season.finish === "3rd Place"
                            ? "podium-finish"
                            : ""
                      }
                    >
                      {season.finish}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="manager-profile-note">
          Career H2H is regular-season opponent record only. Playoff record is
          tracked separately and counts championship-path games plus the official
          3rd-place game. Fifth-place, seventh-place and other lower placement
          games are excluded. League-median bonus games are also excluded from
          manager-vs-manager records.
        </div>
      </section>
    </div>
  );
}
