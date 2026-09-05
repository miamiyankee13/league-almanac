import { useEffect, useMemo, useState } from "react";

function formatDate(timestamp) {
  if (!timestamp) return "No recorded transaction";

  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(timestamp));
}

function confidenceLabel(value) {
  const score = Number(value || 0);
  if (score >= 0.9) return "VERY HIGH";
  if (score >= 0.75) return "HIGH";
  if (score >= 0.55) return "MEDIUM";
  return "LOW";
}

function classificationLabel(value) {
  const labels = {
    likely_offseason_before_season: "LIKELY OFFSEASON TAKEOVER",
    midseason_window: "LIKELY MIDSEASON HANDOFF",
    possible_midseason_takeover: "POSSIBLE MIDSEASON HANDOFF",
    likely_after_season_or_late_takeover: "LIKELY AFTER-SEASON HANDOFF",
    late_season_vacancy: "LATE-SEASON VACANCY",
    vacancy_window: "VACANCY TIMING WINDOW",
    unbounded_vacancy: "UNBOUNDED VACANCY",
    likely_vacancy_filled_before_season: "LIKELY OFFSEASON VACANCY FILL",
    vacancy_fill_window: "VACANCY-FILL TIMING WINDOW",
    unbounded_vacancy_fill: "UNBOUNDED VACANCY FILL",
    overlapping_activity: "OVERLAPPING ACTIVITY",
    outgoing_activity_only: "OUTGOING ACTIVITY ONLY",
    insufficient_evidence: "INSUFFICIENT EVIDENCE",
  };

  return labels[value] || "NEEDS REVIEW";
}

function suggestedWeek(issue, maxEffectiveWeek) {
  const confirmed = Number(issue?.effectiveWeek);
  if (confirmed >= 1 && confirmed <= maxEffectiveWeek) return confirmed;

  const suggested = Number(issue?.evidence?.suggestedEffectiveWeek);
  if (suggested >= 1 && suggested <= maxEffectiveWeek) return suggested;

  return null;
}

export default function OwnershipReviewModal({
  issue,
  managers,
  season,
  onClose,
  onSave,
  onLeaveUnresolved,
}) {
  const lastScoredLeg = Number(season?.lastScoredLeg || 0);
  const maxEffectiveWeek = Math.max(1, lastScoredLeg + 1);
  const isVacatedRoster =
    issue?.changeType === "vacated_roster" || !issue?.currentManagerId;
  const isFilledVacancy = issue?.changeType === "filled_vacancy";

  const initialWeek = suggestedWeek(issue, maxEffectiveWeek);
  const [effectiveWeek, setEffectiveWeek] = useState(initialWeek);

  useEffect(() => {
    setEffectiveWeek(suggestedWeek(issue, maxEffectiveWeek));
  }, [issue?.ownershipIssueId, issue?.effectiveWeek, maxEffectiveWeek]);

  const previous = managers.find(
    (manager) => manager.managerId === issue.previousManagerId
  );

  const current = managers.find(
    (manager) => manager.managerId === issue.currentManagerId
  );

  const options = useMemo(
    () =>
      Array.from({ length: maxEffectiveWeek }, (_, index) => {
        const week = index + 1;

        if (isVacatedRoster) {
          if (week === 1) {
            return {
              value: week,
              label: "Before Week 1 — roster was vacant for the full season",
            };
          }

          if (week === lastScoredLeg + 1) {
            return {
              value: week,
              label: `After Week ${lastScoredLeg} / after season — previous manager gets the full season`,
            };
          }

          return {
            value: week,
            label: `Week ${week} — roster becomes vacant starting Week ${week}`,
          };
        }

        if (week === 1) {
          return {
            value: week,
            label: isFilledVacancy
              ? "Before Week 1 / offseason — new manager gets the full season"
              : "Before Week 1 / offseason — new manager gets the full season",
          };
        }

        if (week === lastScoredLeg + 1) {
          return {
            value: week,
            label: isFilledVacancy
              ? `After Week ${lastScoredLeg} — roster stayed vacant for the full season`
              : `After Week ${lastScoredLeg} / after season — previous manager gets the full season`,
          };
        }

        return {
          value: week,
          label: `Week ${week} — new manager starts with Week ${week}`,
        };
      }),
    [lastScoredLeg, maxEffectiveWeek, isVacatedRoster, isFilledVacancy]
  );

  const prevLast = issue?.evidence?.previous?.lastTransaction;
  const currentFirst = issue?.evidence?.current?.firstTransaction;
  const possibleWeeks = issue?.evidence?.possibleEffectiveWeeks || [];
  const suggested = issue?.evidence?.suggestedEffectiveWeek || null;

  const previousEnd = effectiveWeek == null ? null : effectiveWeek - 1;
  const newStart = effectiveWeek;

  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <section
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="ownership-review-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="modal-header">
          <div>
            <p className="eyebrow">Ownership reconciliation</p>
            <h2 id="ownership-review-title">
              {issue.season} • Franchise {issue.rosterId}
            </h2>
          </div>
          <button className="icon-button" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>

        <div className="handoff">
          <div>
            <span className="handoff-label">
              {isFilledVacancy ? "Prior snapshot" : "Previous manager"}
            </span>
            <strong>
              {previous?.displayName ||
                issue.previousManagerId ||
                "VACANT / NO OWNER"}
            </strong>
          </div>
          <div className="handoff-arrow">→</div>
          <div>
            <span className="handoff-label">Current snapshot</span>
            <strong>
              {current?.displayName ||
                issue.currentManagerId ||
                "VACANT / NO OWNER"}
            </strong>
          </div>
        </div>

        <div className="evidence-grid">
          <div className="evidence-card">
            <span>
              {isFilledVacancy
                ? "Prior-season owner evidence"
                : "Last previous-manager transaction"}
            </span>
            <strong>
              {isFilledVacancy
                ? "Prior season ended vacant"
                : prevLast
                  ? `Week ${prevLast.week} • ${formatDate(prevLast.created)}`
                  : "None found"}
            </strong>
            <small>
              {isFilledVacancy
                ? "No prior owner is available for automatic game credit"
                : `${issue?.evidence?.previous?.transactionCount || 0} completed roster transactions found`}
            </small>
          </div>

          <div className="evidence-card">
            <span>
              {isVacatedRoster
                ? "Replacement-owner evidence"
                : "First current-manager transaction"}
            </span>
            <strong>
              {isVacatedRoster
                ? "No owner in final season snapshot"
                : currentFirst
                  ? `Week ${currentFirst.week} • ${formatDate(currentFirst.created)}`
                  : "None found"}
            </strong>
            <small>
              {isVacatedRoster
                ? "Choose when this roster should begin receiving no manager credit"
                : `${issue?.evidence?.current?.transactionCount || 0} completed roster transactions found`}
            </small>
          </div>
        </div>

        <div className="analysis-banner">
          <div>
            <span className="eyebrow">Automatic analysis</span>
            <strong>
              {classificationLabel(issue?.evidence?.classification)}
            </strong>
          </div>
          <span className="confidence">
            {confidenceLabel(issue?.evidence?.confidence)} CONFIDENCE
          </span>
        </div>

        {(possibleWeeks.length > 1 || suggested) && (
          <div className="handoff-window">
            <div>
              <span>Evidence window</span>
              <strong>
                {possibleWeeks.length > 1
                  ? `Weeks ${possibleWeeks[0]}–${possibleWeeks.at(-1)}`
                  : possibleWeeks.length === 1
                    ? `Week ${possibleWeeks[0]}`
                    : "Not bounded"}
              </strong>
            </div>
            <div>
              <span>Suggested effective week</span>
              <strong>{suggested ? `Week ${suggested}` : "None"}</strong>
            </div>
          </div>
        )}

        {!!issue?.evidence?.notes?.length && (
          <ul className="evidence-notes">
            {issue.evidence.notes.map((note) => (
              <li key={note}>{note}</li>
            ))}
          </ul>
        )}

        <label className="field-label" htmlFor="effective-week">
          Commissioner decision
        </label>

        <select
          id="effective-week"
          value={effectiveWeek ?? ""}
          onChange={(event) =>
            setEffectiveWeek(event.target.value ? Number(event.target.value) : null)
          }
        >
          <option value="">Choose an effective week…</option>
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>

        <div className="credit-preview">
          <div>
            <span>
              {previous?.displayName ||
                issue.previousManagerId ||
                "VACANT / NO OWNER"}
            </span>
            <strong>
              {effectiveWeek == null
                ? "Awaiting decision"
                : isFilledVacancy
                  ? previousEnd < 1
                    ? "No vacant weeks"
                    : `No manager credited Weeks 1–${Math.min(previousEnd, lastScoredLeg)}`
                  : previousEnd < 1
                    ? "No games credited"
                    : `Weeks 1–${Math.min(previousEnd, lastScoredLeg)}`}
            </strong>
          </div>
          <div>
            <span>
              {current?.displayName ||
                issue.currentManagerId ||
                "VACANT / NO OWNER"}
            </span>
            <strong>
              {effectiveWeek == null
                ? "Awaiting decision"
                : isVacatedRoster
                  ? newStart > lastScoredLeg
                    ? "No vacant competitive weeks"
                    : `No manager credited Weeks ${newStart}–${lastScoredLeg}`
                  : newStart > lastScoredLeg
                    ? "No games credited this season"
                    : `Weeks ${newStart}–${lastScoredLeg}`}
            </strong>
          </div>
        </div>

        <div className="modal-actions">
          <button className="secondary-button" onClick={onLeaveUnresolved}>
            LEAVE UNRESOLVED
          </button>
          <button
            disabled={effectiveWeek == null}
            onClick={() =>
              onSave({
                effectiveWeek,
                source: "commissioner_confirmed",
                confirmedAt: new Date().toISOString(),
              })
            }
          >
            SAVE RECONCILIATION
          </button>
        </div>
      </section>
    </div>
  );
}
