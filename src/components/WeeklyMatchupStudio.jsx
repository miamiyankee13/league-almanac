import { useMemo, useState } from "react";
import { buildWeeklyMatchupStudio } from "../domain/weeklyMatchupStudio";
import "./weeklyMatchupStudio.css";

function TaleSide({ side }) {
  return (
    <div className="tot-side">
      <strong className="tot-team-name">{side.teamName}</strong>
      <span className="tot-manager-name">{side.managerName}</span>
      <div className="tot-season-record">{side.seasonRecord}</div>
    </div>
  );
}

function CompareRow({ label, left, right }) {
  return (
    <div className="tot-compare-row">
      <strong>{left}</strong>
      <span>{label}</span>
      <strong>{right}</strong>
    </div>
  );
}

function MatchupCard({ matchup, week }) {
  return (
    <article className="tot-card">
      <div className="tot-card-topline">
        <span>WEEK {week}</span>
        <span>MATCHUP {matchup.displayNumber}</span>
      </div>

      <div className="tot-versus">
        <TaleSide side={matchup.sideA} />
        <div className="tot-vs">VS</div>
        <TaleSide side={matchup.sideB} />
      </div>

      <div className="tot-compare">
        <CompareRow
          label="CAREER RECORD"
          left={matchup.sideA.careerRecord}
          right={matchup.sideB.careerRecord}
        />
        <CompareRow
          label="TITLES"
          left={matchup.sideA.championships}
          right={matchup.sideB.championships}
        />
        <CompareRow
          label="PLAYOFF APPEARANCES"
          left={matchup.sideA.playoffAppearances}
          right={matchup.sideB.playoffAppearances}
        />
      </div>

      <div className="tot-history">
        <div>
          <span>RECORDED SERIES</span>
          <strong>{matchup.seriesLabel}</strong>
        </div>
        <div>
          <span>PLAYOFF H2H</span>
          <strong>{matchup.playoffSeriesLabel}</strong>
        </div>
        <div className="tot-last-meeting">
          <span>LAST MEETING</span>
          <strong>{matchup.lastMeetingLabel}</strong>
        </div>
      </div>

      <p className="tot-narrative">{matchup.narrative}</p>
    </article>
  );
}

export default function WeeklyMatchupStudio({ almanac, rawHistory }) {
  const data = useMemo(
    () => buildWeeklyMatchupStudio(almanac, rawHistory),
    [almanac, rawHistory]
  );
  const [generated, setGenerated] = useState(false);

  const title = data.week
    ? `Week ${data.week} Tale of the Tape`
    : "Weekly Tale of the Tape";

  return (
    <section className="panel weekly-studio">
      <div className="section-heading weekly-studio-heading">
        <div>
          <p className="eyebrow">Content Studio</p>
          <h2>Weekly Matchup Studio</h2>
          <p className="weekly-studio-subtitle">
            Quick matchup history built from current Sleeper pairings and Almanac records.
          </p>
        </div>

        {data.available && generated && (
          <button
            type="button"
            className="secondary-button weekly-studio-print"
            onClick={() => window.print()}
          >
            PRINT / SAVE PDF
          </button>
        )}
      </div>

      {!data.available ? (
        <div className="empty-state weekly-studio-empty">
          {data.reason || "No current matchups are available."}
        </div>
      ) : !generated ? (
        <div className="weekly-studio-launch">
          <div>
            <span>
              {data.season} · WEEK {data.week}
            </span>
            <strong>{data.matchupCount} matchups ready</strong>
            <p>
              One concise card per matchup: season record, career record, titles,
              recorded series, playoff history and the last meeting.
            </p>
          </div>

          <button type="button" onClick={() => setGenerated(true)}>
            GENERATE {title.toUpperCase()}
          </button>
        </div>
      ) : (
        <div className="weekly-studio-print-surface">
          <header className="weekly-studio-preview-header">
            <div>
              <span>LEAGUE ALMANAC · WEEKLY MATCHUP STUDIO</span>
              <h2>{data.leagueName}</h2>
            </div>
            <strong>
              {data.season} · WEEK {data.week}
            </strong>
          </header>

          <div className="weekly-studio-grid">
            {data.matchups.map((matchup) => (
              <MatchupCard
                key={`${data.season}:${data.week}:${matchup.matchupId}`}
                matchup={matchup}
                week={data.week}
              />
            ))}
          </div>

          <footer className="weekly-studio-footer">
            Recorded H2H uses matchup-level history plus known commissioner-entered
            championship results. Missing historical matchups are not inferred.
          </footer>
        </div>
      )}
    </section>
  );
}
