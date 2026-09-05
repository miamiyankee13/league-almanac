function str(value) {
  return value == null ? null : String(value);
}

function completedTransactionsForRoster(season, rosterId, managerId) {
  const seen = new Set();
  const out = [];

  for (const weekEntry of season?.weeks || []) {
    for (const tx of weekEntry.transactions || []) {
      const id = str(tx.transaction_id);
      if (!id || seen.has(id)) continue;

      const rosterIds = (tx.roster_ids || []).map(str);
      if (!rosterIds.includes(str(rosterId))) continue;
      if (str(tx.creator) !== str(managerId)) continue;
      if (tx.status !== "complete") continue;

      seen.add(id);
      out.push({
        transactionId: id,
        week: Number(tx.leg ?? weekEntry.week ?? 0) || null,
        created: Number(tx.created ?? tx.status_updated ?? 0) || null,
        type: tx.type ?? null,
      });
    }
  }

  return out.sort((a, b) => (a.created || 0) - (b.created || 0));
}

function makeRange(start, end) {
  if (!Number.isFinite(start) || !Number.isFinite(end) || start > end) return [];
  const out = [];
  for (let value = start; value <= end; value += 1) out.push(value);
  return out;
}

function buildAnalysis({
  changeType,
  previousTransactions,
  currentTransactions,
  lastScoredLeg,
}) {
  const prevFirst = previousTransactions[0] || null;
  const prevLast = previousTransactions.at(-1) || null;
  const currentFirst = currentTransactions[0] || null;
  const currentLast = currentTransactions.at(-1) || null;

  const notes = [];
  let classification = "insufficient_evidence";
  let confidence = 0.3;
  let suggestedEffectiveWeek = null;
  let possibleEffectiveWeeks = [];

  const finalCompetitiveWeek = Number(lastScoredLeg || 0);

  if (changeType === "vacated_roster") {
    if (prevLast) {
      const prevWeek = Number(prevLast.week || 0);
      const firstPossibleVacantWeek = Math.max(1, prevWeek + 1);
      const afterSeasonWeek = Math.max(1, finalCompetitiveWeek + 1);

      classification =
        finalCompetitiveWeek && prevWeek >= Math.max(1, finalCompetitiveWeek - 2)
          ? "late_season_vacancy"
          : "vacancy_window";

      confidence = classification === "late_season_vacancy" ? 0.78 : 0.58;
      possibleEffectiveWeeks = makeRange(
        firstPossibleVacantWeek,
        Math.max(firstPossibleVacantWeek, afterSeasonWeek)
      );

      if (finalCompetitiveWeek && prevWeek >= finalCompetitiveWeek) {
        suggestedEffectiveWeek = afterSeasonWeek;
      }

      notes.push(
        "Sleeper's final roster snapshot for this season has no owner, so the previous manager cannot be credited automatically for the full season."
      );
      notes.push(
        `The previous manager's last completed roster transaction was in Week ${prevWeek}. The roster could have become vacant any time after that activity through the end of the competitive season.`
      );
      notes.push(
        "Choose the first week the roster should be treated as vacant. Games before that week remain credited to the previous manager; games from that week forward receive no manager credit."
      );
    } else {
      classification = "unbounded_vacancy";
      confidence = 0.35;
      possibleEffectiveWeeks = makeRange(
        1,
        Math.max(1, finalCompetitiveWeek + 1)
      );
      notes.push(
        "Sleeper's final roster snapshot for this season has no owner and no completed roster transaction from the prior-season manager was found to narrow the vacancy date."
      );
      notes.push(
        "Commissioner review is required to determine how much of the season should remain credited to the prior manager."
      );
    }
  } else if (changeType === "filled_vacancy") {
    if (currentFirst) {
      const nextWeek = Number(currentFirst.week || 0);
      if (nextWeek <= 1) {
        classification = "likely_vacancy_filled_before_season";
        suggestedEffectiveWeek = 1;
        confidence = 0.9;
        possibleEffectiveWeeks = [1];
        notes.push(
          "The prior season ended with no owner, while the current manager was active by Week 1."
        );
      } else {
        classification = "vacancy_fill_window";
        suggestedEffectiveWeek = nextWeek || null;
        confidence = 0.62;
        possibleEffectiveWeeks = nextWeek ? makeRange(1, nextWeek) : [];
        notes.push(
          "The prior season ended with a vacant roster. The current manager's first completed roster transaction provides the latest plausible start of the new tenure, but the manager may have taken over earlier."
        );
      }
    } else {
      classification = "unbounded_vacancy_fill";
      confidence = 0.35;
      possibleEffectiveWeeks = makeRange(
        1,
        Math.max(1, finalCompetitiveWeek + 1)
      );
      notes.push(
        "The prior season ended with a vacant roster, but no completed current-manager transaction was found to establish when the roster was filled."
      );
    }
  } else if (prevLast && currentFirst) {
    if ((prevLast.created || 0) < (currentFirst.created || 0)) {
      const prevWeek = Number(prevLast.week || 0);
      const nextWeek = Number(currentFirst.week || 0);

      classification = "midseason_window";
      suggestedEffectiveWeek = nextWeek || null;
      confidence = nextWeek > prevWeek ? 0.86 : 0.7;

      if (prevWeek && nextWeek) {
        possibleEffectiveWeeks = makeRange(
          Math.max(1, prevWeek + 1),
          Math.max(prevWeek + 1, nextWeek)
        );
      }

      notes.push(
        "The outgoing manager's last completed roster transaction occurred before the incoming manager's first completed roster transaction."
      );
      notes.push(
        "The suggested week is the first week with confirmed incoming-manager activity; the actual handoff could have occurred earlier inside the displayed window."
      );
    } else {
      classification = "overlapping_activity";
      confidence = 0.3;
      notes.push(
        "Outgoing and incoming manager transaction activity overlaps in time, so transaction evidence alone cannot identify a clean handoff."
      );
    }
  } else if (!prevLast && currentFirst) {
    if (Number(currentFirst.week || 0) <= 1) {
      classification = "likely_offseason_before_season";
      suggestedEffectiveWeek = 1;
      confidence = 0.94;
      possibleEffectiveWeeks = [1];
      notes.push(
        "No completed current-season roster transaction was found for the outgoing manager, while the incoming manager was active by Week 1."
      );
    } else {
      classification = "possible_midseason_takeover";
      suggestedEffectiveWeek = Number(currentFirst.week || 0) || null;
      confidence = 0.62;
      possibleEffectiveWeeks = suggestedEffectiveWeek
        ? makeRange(1, suggestedEffectiveWeek)
        : [];
      notes.push(
        "The incoming manager has confirmed in-season roster activity, but there is no completed outgoing-manager transaction to bound the beginning of the handoff window."
      );
    }
  } else if (prevLast && !currentFirst) {
    if (
      finalCompetitiveWeek &&
      Number(prevLast.week || 0) >= Math.max(1, finalCompetitiveWeek - 2)
    ) {
      classification = "likely_after_season_or_late_takeover";
      suggestedEffectiveWeek = finalCompetitiveWeek + 1;
      confidence = 0.82;
      possibleEffectiveWeeks = [finalCompetitiveWeek + 1];

      notes.push(
        "The outgoing manager remained active very late in the season and no completed roster transaction from the incoming manager was found."
      );
    } else {
      classification = "outgoing_activity_only";
      confidence = 0.45;
      notes.push(
        "Only outgoing-manager transaction activity was found, so the replacement timing cannot be established automatically."
      );
    }
  } else {
    classification = "insufficient_evidence";
    confidence = 0.3;
    notes.push(
      "No completed transaction activity from either manager cleanly establishes the ownership handoff."
    );
  }

  return {
    classification,
    confidence,
    suggestedEffectiveWeek,
    possibleEffectiveWeeks,
    previous: {
      transactionCount: previousTransactions.length,
      firstTransaction: prevFirst,
      lastTransaction: prevLast,
    },
    current: {
      transactionCount: currentTransactions.length,
      firstTransaction: currentFirst,
      lastTransaction: currentLast,
    },
    notes,
  };
}

export function attachOwnershipEvidence(rawSeasons, ownershipIssues) {
  const seasonByYear = new Map(
    (rawSeasons || []).map((season) => [
      str(season?.league?.season),
      season,
    ])
  );

  return ownershipIssues.map((issue) => {
    const season = seasonByYear.get(str(issue.season));
    if (!season) return issue;

    const previousTransactions = completedTransactionsForRoster(
      season,
      issue.rosterId,
      issue.previousManagerId
    );

    const currentTransactions = completedTransactionsForRoster(
      season,
      issue.rosterId,
      issue.currentManagerId
    );


    return {
      ...issue,
      evidence: {
        ...issue.evidence,
        ...buildAnalysis({
          changeType: issue.changeType || "owner_change",
          previousTransactions,
          currentTransactions,
          lastScoredLeg: Number(season?.league?.settings?.last_scored_leg ?? 0),
        }),
      },
    };
  });
}
