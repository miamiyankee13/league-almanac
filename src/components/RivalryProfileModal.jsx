import { useState } from "react";
import {
  formatRivalryRecord,
  recordForManager,
  seriesLeaderLabel,
} from "../domain/rivalryMetrics";

const RECENT_MEETING_LIMIT = 5;

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

  const winnerIsA =
    meeting.winnerManagerId === meeting.managerAId;

  const winnerName = winnerIsA
    ? meeting.managerAName
    : meeting.managerBName;

  const loserName = winnerIsA
    ? meeting.managerBName
    : meeting.managerAName;

  const winnerPoints = winnerIsA
    ? meeting.pointsA
    : meeting.pointsB;

  const loserPoints = winnerIsA
    ? meeting.pointsB
    : meeting.pointsA;

  return `${winnerName} def. ${loserName} ${points(
    winnerPoints
  )}-${points(loserPoints)}`;
}

function StoryCard({ label, meeting, value }) {
  return (
    <article>
      <span>{label}</span>
      <strong>
        {value ??
          (meeting ? `${margin(meeting.margin)} pts` : "—")}
      </strong>
      <small>
        {meeting
          ? `${meeting.season} W${meeting.week} • ${meetingResult(
              meeting
            )}`
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

function sortedMeetings(rivalry) {
  return [...rivalry.meetings].sort((a, b) => {
    if (Number(b.season) !== Number(a.season)) {
      return Number(b.season) - Number(a.season);
    }
    return Number(b.week) - Number(a.week);
  });
}

export default function RivalryProfileModal({ rivalry, onClose }) {
  const [showSeasonHistory, setShowSeasonHistory] = useState(false);
  const [showAllMeetings, setShowAllMeetings] = useState(false);

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

  const playoffB = recordForManager(
    rivalry,
    rivalry.playoffs,
    rivalry.managerBId
  );

  const meetings = sortedMeetings(rivalry);
  const visibleMeetings = showAllMeetings
    ? meetings
    : meetings.slice(0, RECENT_MEETING_LIMIT);

  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <section
        className="rivalry-profile-modal compact-dossier"
        onMouseDown={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={`${rivalry.managerAName} versus ${rivalry.managerBName} rivalry`}
      >
        <div className="manager-profile-header rivalry-dossier-header">
          <div>
            <p className="eyebrow">Rivalry dossier</p>
            <h2>
              {rivalry.managerAName}
              <span className="rivalry-vs"> vs. </span>
              {rivalry.managerBName}
            </h2>
            <div className="manager-profile-subtitle">
              <span>
                Since {rivalry.firstMeeting?.season || "—"}
              </span>
              <span>
                {rivalry.regular.games} regular-season meetings
              </span>
              {rivalry.playoffs.games > 0 && (
                <span>
                  {rivalry.playoffs.games} playoff meeting
                  {rivalry.playoffs.games === 1 ? "" : "s"}
                </span>
              )}
            </div>
          </div>

          <button className="modal-close" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>

        <div className="rivalry-scoreboard">
          <div className="rivalry-score-side">
            <span>{rivalry.managerAName}</span>
            <strong>{formatRivalryRecord(recordA)}</strong>
            <small>{points(rivalry.regular.pointsA)} points</small>
          </div>

          <div className="rivalry-score-center">
            <span>REGULAR SERIES</span>
            <strong>{seriesLeaderLabel(rivalry, rivalry.regular)}</strong>
          </div>

          <div className="rivalry-score-side right">
            <span>{rivalry.managerBName}</span>
            <strong>{formatRivalryRecord(recordB)}</strong>
            <small>{points(rivalry.regular.pointsB)} points</small>
          </div>
        </div>

        <div className="rivalry-quick-metrics">
          <div>
            <span>Avg Margin</span>
            <strong>{margin(rivalry.averageMargin)}</strong>
          </div>
          <div>
            <span>Current Streak</span>
            <strong>{rivalry.currentStreak?.label || "—"}</strong>
          </div>
          <div>
            <span>Playoff Series</span>
            <strong>
              {rivalry.playoffs.games
                ? `${rivalry.managerAName} ${formatRivalryRecord(
                    playoffA
                  )} • ${rivalry.managerBName} ${formatRivalryRecord(
                    playoffB
                  )}`
                : "No meetings"}
            </strong>
          </div>
        </div>

        <div className="manager-story-grid rivalry-story-grid compact">
          <StoryCard
            label="Closest Game"
            meeting={rivalry.closestGame}
          />
          <StoryCard
            label="Biggest Blowout"
            meeting={rivalry.biggestBlowout}
          />
          <StoryCard
            label="Highest-Scoring"
            meeting={rivalry.highestCombined}
            value={
              rivalry.highestCombined
                ? `${points(
                    rivalry.highestCombined.combinedPoints
                  )} combined`
                : "—"
            }
          />
        </div>

        <div className="rivalry-recent-section">
          <div className="manager-profile-section-heading compact">
            <div>
              <p className="eyebrow">Recent receipts</p>
              <h3>
                {showAllMeetings
                  ? "Every Meeting"
                  : `Last ${Math.min(
                      RECENT_MEETING_LIMIT,
                      meetings.length
                    )} Meetings`}
              </h3>
            </div>
            <span>{meetings.length} total</span>
          </div>

          <div className="rivalry-recent-list">
            {visibleMeetings.map((meeting) => (
              <div className="rivalry-recent-row" key={meeting.meetingId}>
                <div className="rivalry-recent-when">
                  <strong>{meeting.season}</strong>
                  <span>
                    W{meeting.week}
                    {meeting.isPlayoff ? ` • ${meeting.stage}` : ""}
                  </span>
                </div>

                <div className="rivalry-recent-result">
                  <strong>{meetingResult(meeting)}</strong>
                  <span>
                    {meeting.teamAName} vs. {meeting.teamBName}
                  </span>
                </div>

                <div className="rivalry-recent-margin">
                  {margin(meeting.margin)}
                </div>
              </div>
            ))}
          </div>

          {meetings.length > RECENT_MEETING_LIMIT && (
            <button
              type="button"
              className="rivalry-disclosure-button"
              onClick={() => setShowAllMeetings((value) => !value)}
            >
              {showAllMeetings
                ? "SHOW RECENT ONLY"
                : `SHOW ALL ${meetings.length} MEETINGS`}
            </button>
          )}
        </div>

        <div className="rivalry-collapsible">
          <button
            type="button"
            className="rivalry-collapsible-trigger"
            onClick={() => setShowSeasonHistory((value) => !value)}
          >
            <div>
              <span className="eyebrow">Series history</span>
              <strong>Season-by-Season Breakdown</strong>
            </div>
            <span>{showSeasonHistory ? "−" : "+"}</span>
          </button>

          {showSeasonHistory && (
            <div className="table-wrap rivalry-season-history-wrap">
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
          )}
        </div>

        <div className="manager-profile-note rivalry-definition-note">
          Records are manager-vs-manager H2H only. League-median bonus results
          never count. Playoff meetings include the championship path plus the
          official 3rd-place game; lower placement games are excluded.
        </div>
      </section>
    </div>
  );
}
