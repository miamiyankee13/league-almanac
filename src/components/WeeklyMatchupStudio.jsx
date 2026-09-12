import { useMemo, useState } from "react";
import { buildWeeklyMatchupStudio } from "../domain/weeklyMatchupStudio";
import { createWeeklyMatchupPdf } from "../domain/weeklyMatchupPdf";
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
  const [pdfError, setPdfError] = useState("");

  const title = data.week
    ? `Week ${data.week} Tale of the Tape`
    : "Weekly Tale of the Tape";

  function openPdf() {
    setPdfError("");

    // Open the tab immediately from the user's click so iPad/Safari does not
    // treat the PDF viewer as a blocked asynchronous popup.
    const pdfTab = window.open("", "_blank");

    if (!pdfTab) {
      setPdfError("The PDF tab was blocked. Allow pop-ups for this site and try again.");
      return;
    }

    try {
      pdfTab.document.title = `${title} - Generating PDF`;
      pdfTab.document.body.innerHTML =
        '<div style="font-family:system-ui;padding:24px;color:#333">Generating PDF...</div>';

      const { blob } = createWeeklyMatchupPdf(data);
      const url = URL.createObjectURL(blob);

      pdfTab.location.replace(url);

      // Give Safari plenty of time to load the local PDF before releasing the
      // temporary object URL. The opened tab keeps its own loaded document.
      window.setTimeout(() => URL.revokeObjectURL(url), 5 * 60 * 1000);
    } catch (error) {
      pdfTab.close();
      console.error(error);
      setPdfError(error?.message || "Could not generate the weekly PDF.");
    }
  }

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
            onClick={openPdf}
          >
            OPEN PDF
          </button>
        )}
      </div>

      {pdfError && <div className="error">{pdfError}</div>}

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
