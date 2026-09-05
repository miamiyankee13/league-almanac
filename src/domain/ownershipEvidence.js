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
        creatorManagerId: str(tx.creator),
        evidenceType: "direct_creator",
      });
    }
  }

  return out.sort((a, b) => (a.created || 0) - (b.created || 0));
}

/**
 * A completed trade can involve a roster even when that roster's manager is
 * NOT the transaction creator. Sleeper's creator field identifies the side
 * that initiated the trade; the accepting side can therefore have real roster
 * activity without ever appearing as tx.creator.
 *
 * This is indirect ownership evidence only. It proves the roster participated
 * in a completed trade, not which user clicked accept.
 */
function completedTradeParticipationForRoster(season, rosterId) {
  const seen = new Set();
  const out = [];
  const targetRosterId = str(rosterId);

  for (const weekEntry of season?.weeks || []) {
    for (const tx of weekEntry.transactions || []) {
      const id = str(tx.transaction_id);
      if (!id || seen.has(id)) continue;
      if (tx.status !== "complete") continue;
      if (tx.type !== "trade") continue;

      const rosterIds = (tx.roster_ids || []).map(str);
      if (!rosterIds.includes(targetRosterId)) continue;

      const consenterRosterIds = (tx.consenter_ids || []).map(str);
      const rosterConsented =
        consenterRosterIds.length === 0 ||
        consenterRosterIds.includes(targetRosterId);

      if (!rosterConsented) continue;

      seen.add(id);
      out.push({
        transactionId: id,
        week: Number(tx.leg ?? weekEntry.week ?? 0) || null,
        created: Number(tx.created ?? tx.status_updated ?? 0) || null,
        type: tx.type ?? null,
        creatorManagerId: str(tx.creator),
        evidenceType: "roster_trade_participation",
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
  previousManagerId,
  currentManagerId,
  previousTransactions,
  currentTransactions,
  indirectCurrentTransactions,
  lastScoredLeg,
}) {
  const prevFirst = previousTransactions[0] || null;
  const prevLast = previousTransactions.at(-1) || null;
  const currentFirst = currentTransactions[0] || null;
  const currentLast = currentTransactions.at(-1) || null;
  const indirectFirst = indirectCurrentTransactions[0] || null;
  const indirectLast = indirectCurrentTransactions.at(-1) || null;

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
  } else if (prevLast && !currentFirst && indirectFirst) {
    const prevWeek = Number(prevLast.week || 0);
    const indirectWeek = Number(indirectFirst.week || 0);

    if (
      (prevLast.created || 0) < (indirectFirst.created || 0) &&
      indirectWeek >= prevWeek
    ) {
      classification = "midseason_window_indirect";
      suggestedEffectiveWeek = indirectWeek || null;
      confidence =
        indirectCurrentTransactions.length >= 2 ? 0.74 : 0.64;

      if (prevWeek && indirectWeek) {
        possibleEffectiveWeeks = makeRange(
          Math.max(1, prevWeek + 1),
          Math.max(prevWeek + 1, indirectWeek)
        );
      }

      notes.push(
        "No completed transaction was directly created by the incoming manager, but this roster participated in completed trades after the outgoing manager's last direct transaction."
      );
      notes.push(
        "Sleeper records a trade's creator as the manager who initiated the transaction. An incoming owner who accepts a trade can therefore be active without appearing as tx.creator."
      );
      notes.push(
        `The first such post-outgoing trade participation was in Week ${indirectWeek}. This is indirect roster-control evidence, not proof of the exact handoff week, so commissioner confirmation is still required.`
      );
    } else {
      classification = "outgoing_activity_only";
      confidence = 0.45;
      notes.push(
        "Only outgoing-manager direct transaction activity was found, and the available roster-level trade activity does not create a clean post-outgoing handoff window."
      );
    }
  } else if (!prevLast && !currentFirst && indirectFirst) {
    const indirectWeek = Number(indirectFirst.week || 0);

    classification = "indirect_roster_activity_only";
    suggestedEffectiveWeek = indirectWeek || null;
    confidence = 0.5;
    possibleEffectiveWeeks = indirectWeek
      ? makeRange(1, indirectWeek)
      : [];

    notes.push(
      "No completed transaction was directly created by either ownership candidate, but the roster participated in completed trades during the season."
    );
    notes.push(
      "Because Sleeper records the initiating side as tx.creator, this can reflect activity by an accepting replacement owner. It does not identify the user with certainty."
    );
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
    indirectCurrent: {
      transactionCount: indirectCurrentTransactions.length,
      firstTransaction: indirectFirst,
      lastTransaction: indirectLast,
      note:
        indirectCurrentTransactions.length > 0
          ? "Completed roster trade participation after the outgoing manager's last direct activity. This is indirect evidence because tx.creator can belong to the opposing trade partner."
          : null,
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

    const allTradeParticipation = completedTradeParticipationForRoster(
      season,
      issue.rosterId
    );

    const prevLast = previousTransactions.at(-1) || null;

    // Only use trade participation as incoming-side indirect evidence when a
    // direct current-manager transaction is unavailable. Prefer activity after
    // the outgoing manager's final direct action, and exclude trades initiated
    // by the outgoing manager themselves.
    const indirectCurrentTransactions =
      currentTransactions.length > 0
        ? []
        : allTradeParticipation.filter((tx) => {
            if (str(tx.creatorManagerId) === str(issue.previousManagerId)) {
              return false;
            }

            if (
              prevLast?.created &&
              tx.created &&
              Number(tx.created) <= Number(prevLast.created)
            ) {
              return false;
            }

            return true;
          });

    return {
      ...issue,
      evidence: {
        ...issue.evidence,
        ...buildAnalysis({
          changeType: issue.changeType || "owner_change",
          previousManagerId: issue.previousManagerId,
          currentManagerId: issue.currentManagerId,
          previousTransactions,
          currentTransactions,
          indirectCurrentTransactions,
          lastScoredLeg: Number(
            season?.league?.settings?.last_scored_leg ?? 0
          ),
        }),
      },
    };
  });
}
