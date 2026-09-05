import {
  formatRivalryRecord,
  recordForManager,
  seriesLeaderLabel,
} from "../domain/rivalryMetrics";

function points(value) {
  return Number(value || 0).toFixed(2);
}

function margin(value) {
  return Number(value || 0).toFixed(2);
}

function meetingResult(meeting) {
  if (!meeting) return "—";

  if (!meeting.winnerManagerId) {
    return `Tied ${points(meeting.pointsA)}-${points(meeting.pointsB)}`;
  }

  const winnerIsA = meeting.winnerManagerId === meeting.managerAId;
  const winnerName = winnerIsA ? meeting.managerAName : meeting.managerBName;
  const loserName = winnerIsA ? meeting.managerBName : meeting.managerAName;
  const winnerPoints = winnerIsA ? meeting.pointsA : meeting.pointsB;
  const loserPoints = winnerIsA ? meeting.pointsB : meeting.pointsA;

  return `${winnerName} def. ${loserName} ${points(winnerPoints)}-${points(
    loserPoints
  )}`;
}

function storyCard(label, meeting) {
  if (!meeting) {
    return (
      <article>
        <span>{label}</span>
        <strong>—</strong>
        <small>No meeting available</small>
      </article>
    );
  }

  return (
    <article>
      <span>{label}</span>
      <strong>{margin(meeting.margin)} pts</strong>
      <small>
        {meeting.season} W{meeting.week} • {meetingResult(meeting)}
      </small>
    </article>
  );
}

function seasonSeriesLabel(pair, breakdown) {
  if (!breakdown?.regular?.games) return "—";
  return seriesLeaderLabel(pair, breakdown.regular);
}

function playoffSeriesLabel(pair, breakdown) {
  if (!breakdown?.playoffs?.games) return "—";
  return seriesLeaderLabel(pair, breakdown.playoffs);
}

export default function RivalryProfileModal({ rivalry, onClose }) {
  if (!rivalry) return null;

  const recordA = recordForManager(
    rivalry,
    rivalry.regular,
    rivalry.managerAId
  );
  const recordB = recordForManager(
    rivalry,
    rivalry.regular,
    rivalry.managerBId
  );

  const playoffA = recordForManager(
    rivalry,
    rivalry.playoffs,
    rivalry.managerAId
  );

  const firstMeetingSeason = rivalry.firstMeeting?.season || "—";

  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <section
        className="rivalry-profile-modal"
        onMouseDown={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={`${rivalry.managerAName} versus ${rivalry.managerBName} rivalry`}
      >
        <div className="manager-profile-header">
          <div>
            <p className="eyebrow">Rivalry dossier</p>
            <h2>
              {rivalry.managerAName}
              <span className="rivalry-vs"> vs. </span>
              {rivalry.managerBName}
            </h2>

            <div className="manager-profile-subtitle">
              <span>First meeting {firstMeetingSeason}</span>
              <span>
                {rivalry.regular.games} regular-season meeting
                {rivalry.regular.games === 1 ? "" : "s"}
              </span>
              <span>
                {rivalry.playoffs.games} playoff meeting
                {rivalry.playoffs.games === 1 ? "" : "s"}
              </span>
            </div>
          </div>

          <button className="modal-close" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>

        <div className="rivalry-series-banner">
          <div>
            <span>Regular-season series</span>
            <strong>{seriesLeaderLabel(rivalry, rivalry.regular)}</strong>
          </div>

          <div className="rivalry-series-split">
            <div>
              <span>{rivalry.managerAName}</span>
              <strong>{formatRivalryRecord(recordA)}</strong>
            </div>
            <div className="rivalry-series-divider">VS</div>
            <div>
              <span>{rivalry.managerBName}</span>
              <strong>{formatRivalryRecord(recordB)}</strong>
            </div>
          </div>
        </div>

        <div className="manager-profile-metrics rivalry-profile-metrics">
          <div>
            <span>All Meetings</span>
            <strong>{rivalry.all.games}</strong>
          </div>
          <div>
            <span>Total Points</span>
            <strong>
              {points(rivalry.all.pointsA)} – {points(rivalry.all.pointsB)}
            </strong>
          </div>
          <div>
            <span>Avg Margin</span>
            <strong>{margin(rivalry.averageMargin)}</strong>
          </div>
          <div>
            <span>Playoff Series</span>
            <strong>
              {rivalry.playoffs.games
                ? seriesLeaderLabel(rivalry, rivalry.playoffs)
                : "No meetings"}
            </strong>
          </div>
          <div>
            <span>{rivalry.managerAName} Playoff H2H</span>
            <strong>
              {rivalry.playoffs.games
                ? formatRivalryRecord(playoffA)
                : "—"}
            </strong>
          </div>
          <div>
            <span>Current Streak</span>
            <strong>{rivalry.currentStreak?.label || "—"}</strong>
          </div>
        </div>

        <div className="manager-story-grid rivalry-story-grid">
          {storyCard("Closest Game", rivalry.closestGame)}
          {storyCard("Biggest Blowout", rivalry.biggestBlowout)}

          <article>
            <span>Highest-Scoring Meeting</span>
            <strong>
              {rivalry.highestCombined
                ? `${points(rivalry.highestCombined.combinedPoints)} combined`
                : "—"}
            </strong>
            <small>
              {rivalry.highestCombined
                ? `${rivalry.highestCombined.season} W${
                    rivalry.highestCombined.week
                  } • ${meetingResult(rivalry.highestCombined)}`
                : "No meeting available"}
            </small>
          </article>
        </div>

        <div className="manager-profile-section-heading">
          <div>
            <p className="eyebrow">Series history</p>
            <h3>Season by Season</h3>
          </div>
          <span>Regular season and playoff records remain separate</span>
        </div>

        <div className="table-wrap">
          <table className="rivalry-season-table">
            <thead>
              <tr>
                <th>Season</th>
                <th>Meetings</th>
                <th>Regular Series</th>
                <th>Playoffs</th>
                <th>Points</th>
              </tr>
            </thead>
            <tbody>
              {rivalry.seasonBreakdown.map((season) => (
                <tr key={season.season}>
                  <td>
                    <strong>{season.season}</strong>
                  </td>
                  <td>{season.meetings}</td>
                  <td>{seasonSeriesLabel(rivalry, season)}</td>
                  <td>{playoffSeriesLabel(rivalry, season)}</td>
                  <td className="record-cell">
                    {points(season.pointsA)} – {points(season.pointsB)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="manager-profile-section-heading rivalry-history-heading">
          <div>
            <p className="eyebrow">Receipts</p>
            <h3>Every Meeting</h3>
          </div>
          <span>Newest first</span>
        </div>

        <div className="table-wrap rivalry-history-wrap">
          <table className="rivalry-history-table">
            <thead>
              <tr>
                <th>Season</th>
                <th>Week</th>
                <th>Stage</th>
                <th>Result</th>
                <th>Margin</th>
              </tr>
            </thead>
            <tbody>
              {[...rivalry.meetings]
                .sort((a, b) => {
                  if (Number(b.season) !== Number(a.season)) {
                    return Number(b.season) - Number(a.season);
                  }
                  return Number(b.week) - Number(a.week);
                })
                .map((meeting) => (
                  <tr key={meeting.meetingId}>
                    <td>
                      <strong>{meeting.season}</strong>
                    </td>
                    <td>{meeting.week}</td>
                    <td>
                      <span
                        className={
                          meeting.isPlayoff
                            ? "rivalry-stage playoff"
                            : "rivalry-stage"
                        }
                      >
                        {meeting.stage}
                      </span>
                    </td>
                    <td>
                      <strong className="rivalry-result">
                        {meetingResult(meeting)}
                      </strong>
                      <span className="rivalry-team-context">
                        {meeting.teamAName} vs. {meeting.teamBName}
                      </span>
                    </td>
                    <td>{margin(meeting.margin)}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>

        <div className="manager-profile-note">
          Rivalry series records use actual manager-vs-manager games only.
          League-median bonus results never count. “Playoff meetings” only
          includes resolved championship-path games plus the official
          3rd-place game. Fifth-place, seventh-place and other lower placement
          games are excluded.
        </div>
      </section>
    </div>
  );
}
