import { useMemo, useState } from "react";
import {
  buildManagerMetrics,
  formatManagerRecord,
  formatManagerWinPct,
} from "../domain/managerMetrics";
import ManagerProfileModal from "./ManagerProfileModal";

function formatPoints(value) {
  return Number(value || 0).toFixed(2);
}

export default function ManagersExplorer({ almanac }) {
  const data = useMemo(() => buildManagerMetrics(almanac), [almanac]);
  const [selectedManagerId, setSelectedManagerId] = useState(null);

  const selectedManager =
    data.managers.find((manager) => manager.managerId === selectedManagerId) ||
    null;

  return (
    <>
      <section className="panel managers-explorer">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Managers</p>
            <h2>Career Leaderboard</h2>
          </div>
          <span className="muted">
            {data.managers.length} primary manager{data.managers.length === 1 ? "" : "s"}
            {data.coOwnerOnlyManagers.length
              ? ` • ${data.coOwnerOnlyManagers.length} co-owner-only identit${
                  data.coOwnerOnlyManagers.length === 1 ? "y" : "ies"
                } excluded from career rankings`
              : ""}
          </span>
        </div>

        {data.hasLeagueMedianSeasons && (
          <div className="notice compact-notice manager-record-notice">
            <strong>Career record means head-to-head record.</strong> League-median
            bonus games stay out of manager career and rivalry W/L. Playoff games
            are also displayed separately.
          </div>
        )}

        <div className="manager-leader-cards">
          <article>
            <span>Most Championships</span>
            <strong>{data.managers[0]?.displayName || "—"}</strong>
            <small>
              {data.managers[0]
                ? `${data.managers[0].championships} title${data.managers[0].championships === 1 ? "" : "s"}`
                : "No completed championships"}
            </small>
          </article>

          <article>
            <span>Most H2H Wins</span>
            <strong>
              {[...data.managers].sort((a, b) => b.regular.wins - a.regular.wins)[0]
                ?.displayName || "—"}
            </strong>
            <small>
              {[...data.managers].sort((a, b) => b.regular.wins - a.regular.wins)[0]
                ?.regular.wins || 0} wins
            </small>
          </article>

          <article>
            <span>Most Points For</span>
            <strong>
              {[...data.managers].sort(
                (a, b) => b.regular.pointsFor - a.regular.pointsFor
              )[0]?.displayName || "—"}
            </strong>
            <small>
              {formatPoints(
                [...data.managers].sort(
                  (a, b) => b.regular.pointsFor - a.regular.pointsFor
                )[0]?.regular.pointsFor
              )} PF
            </small>
          </article>
        </div>

        <div className="table-wrap managers-table-wrap">
          <table className="managers-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Manager</th>
                <th>Seasons</th>
                <th>Career H2H</th>
                <th>Win %</th>
                <th>PF</th>
                <th>Playoffs</th>
                <th>Finals</th>
                <th>Titles</th>
              </tr>
            </thead>
            <tbody>
              {data.managers.map((manager, index) => (
                <tr
                  key={manager.managerId}
                  className="clickable-row manager-row"
                  onClick={() => setSelectedManagerId(manager.managerId)}
                >
                  <td className="rank-cell">{index + 1}</td>
                  <td>
                    <div className="manager-name-cell">
                      <strong>{manager.displayName}</strong>
                      <span>
                        {manager.current
                          ? manager.currentTeamName || "Current manager"
                          : `Last active ${manager.mostRecentSeason || "—"}`}
                      </span>
                    </div>
                  </td>
                  <td>{manager.primarySeasonCount}</td>
                  <td className="record-cell">
                    {formatManagerRecord(manager.regular)}
                  </td>
                  <td>{formatManagerWinPct(manager.winPct)}</td>
                  <td>{formatPoints(manager.regular.pointsFor)}</td>
                  <td>{manager.playoffAppearances}</td>
                  <td>{manager.finals}</td>
                  <td>
                    {manager.championships > 0 ? (
                      <span className="manager-title-badge">
                        {manager.championships}
                      </span>
                    ) : (
                      "0"
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <p className="standings-footnote manager-footnote">
          Leaderboard order: championships, then regular-season H2H wins, win
          percentage and points for. Co-owner-only identities remain preserved in
          the Almanac but do not receive primary-manager career statistics by
          default. Playoff statistics count championship-path games plus
          the official 3rd-place game; lower placement games do not affect
          playoff records.
        </p>
      </section>

      {selectedManager && (
        <ManagerProfileModal
          manager={selectedManager}
          onClose={() => setSelectedManagerId(null)}
        />
      )}
    </>
  );
}
