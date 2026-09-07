import { seriesLeaderLabel } from "../domain/rivalryMetrics";

function points(value) {
  if (value == null || !Number.isFinite(Number(value))) return "—";
  return Number(value).toFixed(2);
}

function margin(value) {
  if (value == null || !Number.isFinite(Number(value))) return "—";
  return Number(value).toFixed(2);
}

function displayOrder(rivalry, focusManagerId) {
  if (focusManagerId === rivalry.managerBId) {
    return {
      primaryId: rivalry.managerBId,
      primaryName: rivalry.managerBName,
      secondaryId: rivalry.managerAId,
      secondaryName: rivalry.managerAName,
      primaryIsA: false,
    };
  }

  return {
    primaryId: rivalry.managerAId,
    primaryName: rivalry.managerAName,
    secondaryId: rivalry.managerBId,
    secondaryName: rivalry.managerBName,
    primaryIsA: true,
  };
}

function meetingResult(meeting) {
  if (!meeting) return "—";

  if (meeting.scoreKnown === false) {
    if (!meeting.winnerManagerId) {
      return `${meeting.managerAName} vs. ${meeting.managerBName} • score unavailable`;
    }

    const winnerIsA = meeting.winnerManagerId === meeting.managerAId;
    const winnerName = winnerIsA ? meeting.managerAName : meeting.managerBName;
    const loserName = winnerIsA ? meeting.managerBName : meeting.managerAName;
    return `${winnerName} def. ${loserName} • score unavailable`;
  }

  if (!meeting.winnerManagerId) {
    return `${meeting.managerAName} tied ${meeting.managerBName} ${points(
      meeting.pointsA
    )}–${points(meeting.pointsB)}`;
  }

  const winnerIsA = meeting.winnerManagerId === meeting.managerAId;
  const winnerName = winnerIsA ? meeting.managerAName : meeting.managerBName;
  const loserName = winnerIsA ? meeting.managerBName : meeting.managerAName;
  const winnerPoints = winnerIsA ? meeting.pointsA : meeting.pointsB;
  const loserPoints = winnerIsA ? meeting.pointsB : meeting.pointsA;

  return `${winnerName} def. ${loserName} ${points(winnerPoints)}–${points(
    loserPoints
  )}`;
}

function meetingTeamContext(meeting, order) {
  if (!meeting) return "—";

  if (!meeting.winnerManagerId) {
    return order.primaryIsA
      ? `${meeting.teamAName} vs. ${meeting.teamBName}`
      : `${meeting.teamBName} vs. ${meeting.teamAName}`;
  }

  const winnerIsA = meeting.winnerManagerId === meeting.managerAId;
  return winnerIsA
    ? `${meeting.teamAName} vs. ${meeting.teamBName}`
    : `${meeting.teamBName} vs. ${meeting.teamAName}`;
}

function storyCard(label, meeting, value) {
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
      <strong>{value}</strong>
      <small>
        {meeting.season} W{meeting.week} — {meetingResult(meeting)}
      </small>
    </article>
  );
}

function currentStreakCard(rivalry) {
  const streak = rivalry.currentStreak;
  const latest = rivalry.streakThroughMeeting;

  return (
    <article>
      <span>Current Streak</span>
      <strong>{streak?.label || "—"}</strong>
      <small>
        {latest
          ? `Through ${latest.season} W${latest.week}${
              latest.isPlayoff ? ` · ${latest.stage}` : ""
            }`
          : rivalry.manualMeetingCount
            ? "Partial historical meetings do not define a streak"
            : "No meeting available"}
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

function pointDifferentialLabel(rivalry) {
  if (!rivalry.all.scoredGames) return "Unavailable";

  const diff = Number(rivalry.all.pointsA || 0) - Number(rivalry.all.pointsB || 0);

  if (Math.abs(diff) < 1e-9) return "Even";

  if (diff > 0) return `${rivalry.managerAName} +${points(diff)}`;
  return `${rivalry.managerBName} +${points(Math.abs(diff))}`;
}

export default function RivalryProfileModal({
  rivalry,
  focusManagerId = null,
  onClose,
}) {
  if (!rivalry) return null;

  const order = displayOrder(rivalry, focusManagerId);
  const firstMeetingSeason = rivalry.firstMeeting?.season || "—";

  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <section
        className="rivalry-profile-modal"
        onMouseDown={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={`${order.primaryName} versus ${order.secondaryName} rivalry`}
      >
        <div className="manager-profile-header">
          <div>
            <p className="eyebrow">Rivalry dossier</p>
            <h2>
              {order.primaryName}
              <span className="rivalry-vs"> vs. </span>
              {order.secondaryName}
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

        {rivalry.manualMeetingCount > 0 && (
          <div className="notice compact-notice manager-record-notice">
            <strong>Partial pre-Sleeper coverage.</strong>{" "}
            Known commissioner-entered championship results count toward the
            overall and playoff series. Missing historical regular-season meetings
            are not reconstructed, and score/margin/streak metrics use only scored
            matchups with complete chronology.
          </div>
        )}

        <div className="rivalry-overall-banner">
          <div className="rivalry-series-card rivalry-overall-series-card">
            <span>Overall Series</span>
            <strong>{seriesLeaderLabel(rivalry, rivalry.all)}</strong>
            <small className="rivalry-overall-meetings">
              {rivalry.all.games} total meeting
              {rivalry.all.games === 1 ? "" : "s"}
            </small>
          </div>
        </div>

        <div className="rivalry-series-banner rivalry-series-banner-paired rivalry-series-banner-secondary">
          <div className="rivalry-series-card">
            <span>Regular-season series</span>
            <strong>{seriesLeaderLabel(rivalry, rivalry.regular)}</strong>
          </div>

          <div className="rivalry-series-card">
            <span>Playoff series</span>
            <strong>
              {rivalry.playoffs.games
                ? seriesLeaderLabel(rivalry, rivalry.playoffs)
                : "No playoff meetings"}
            </strong>
          </div>
        </div>

        <div className="manager-profile-metrics rivalry-profile-metrics rivalry-profile-metrics-two">
          <div>
            <span>{rivalry.unknownScoreMeetingCount ? "Recorded Point Differential" : "Point Differential"}</span>
            <strong>{pointDifferentialLabel(rivalry)}</strong>
          </div>
          <div>
            <span>{rivalry.unknownScoreMeetingCount ? "Recorded Avg Margin" : "Avg Margin"}</span>
            <strong>
              {Number.isFinite(rivalry.averageMargin)
                ? `${margin(rivalry.averageMargin)} pts`
                : "Unavailable"}
            </strong>
          </div>
        </div>

        <div className="manager-story-grid rivalry-story-grid rivalry-story-grid-four">
          {currentStreakCard(rivalry)}
          {storyCard(
            "Closest Game",
            rivalry.closestGame,
            rivalry.closestGame ? `${margin(rivalry.closestGame.margin)} pts` : "—"
          )}
          {storyCard(
            "Biggest Blowout",
            rivalry.biggestBlowout,
            rivalry.biggestBlowout
              ? `${margin(rivalry.biggestBlowout.margin)} pts`
              : "—"
          )}
          {storyCard(
            "Highest-Scoring Meeting",
            rivalry.highestCombined,
            rivalry.highestCombined
              ? `${points(rivalry.highestCombined.combinedPoints)} combined`
              : "—"
          )}
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
                    {season.scoredMeetings
                      ? order.primaryIsA
                        ? `${points(season.pointsA)} – ${points(season.pointsB)}`
                        : `${points(season.pointsB)} – ${points(season.pointsA)}`
                      : "—"}
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
                    <td>{meeting.week == null ? "—" : meeting.week}</td>
                    <td>
                      <span
                        className={
                          meeting.isPlayoff
                            ? "rivalry-stage playoff"
                            : "rivalry-stage"
                        }
                      >
                        {meeting.isPlayoff ? meeting.stage : "Regular"}
                      </span>
                      {meeting.sourceType === "manual" && (
                        <span className="manual-source-chip manual-source-chip-inline">
                          Manual
                        </span>
                      )}
                    </td>
                    <td>
                      <strong className="rivalry-result">
                        {meetingResult(meeting)}
                      </strong>
                      <span className="rivalry-team-context">
                        {meetingTeamContext(meeting, order)}
                      </span>
                    </td>
                    <td>
                      {meeting.scoreKnown === false ? "—" : margin(meeting.margin)}
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>

        <div className="manager-profile-note">
          Rivalry series use known manager-vs-manager results. Sleeper matchup
          history supplies complete scored meetings; commissioner-entered Champion
          vs. Runner-up can add a scoreless known championship result. League-median
          bonus results and lower placement playoff games are excluded. Missing
          pre-Sleeper regular-season matchups are not inferred.
        </div>
      </section>
    </div>
  );
}
