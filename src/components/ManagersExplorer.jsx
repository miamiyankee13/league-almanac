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
            {data.managers.length} manager{data.managers.length === 1 ? "" : "s"}
          </span>
        </div>

        {data.hasLeagueMedianSeasons && (
          <div className="notice compact-notice manager-record-notice">
            <strong>Career record means head-to-head record.</strong> League-median
            bonus games stay out of manager career and rivalry W/L. Playoff games
            are also displayed separately.
          </div>
        )}

        <div className="table-wrap managers-table-wrap">
          <table className="managers-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Manager</th>
                <th>Seasons</th>
                <th>H2H Record</th>
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
          percentage and points for. Career rankings follow reconciled primary
          ownership and exclude co-owner-only identities.
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
