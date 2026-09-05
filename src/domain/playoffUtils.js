function str(value) {
  return value == null ? null : String(value);
}

function winnerSourceMatchIds(node) {
  return [node?.team1From, node?.team2From]
    .map((source) => source?.winnerMatchId)
    .filter((matchId) => matchId != null)
    .map(String);
}

function participantRosterIds(node) {
  return [
    node?.team1RosterId,
    node?.team2RosterId,
    node?.winnerRosterId,
    node?.loserRosterId,
  ]
    .filter((rosterId) => rosterId != null)
    .map(String);
}

/**
 * Return only the winners-bracket games that are on the path to the league
 * championship. Placement/consolation games (3rd place, 5th place, etc.) are
 * intentionally excluded.
 *
 * We use two signals:
 * 1) Sleeper's t1_from/t2_from winner links when available.
 * 2) Historical resolved-bracket fallback: the winner of an earlier-round
 *    game appears as a participant in a later championship-path game.
 *
 * Signal #2 matters because older resolved Sleeper brackets can omit some
 * t1_from/t2_from fields after the roster IDs are filled in.
 */
export function getChampionshipPathPlayoffNodes(almanac, seasonYear) {
  const season = str(seasonYear);

  const nodes = almanac.playoffGames.filter(
    (node) =>
      node.season === season &&
      node.bracketType === "winners"
  );

  const championship = nodes.find(
    (node) => Number(node.placement) === 1
  );

  if (!championship) return [];

  const byMatchId = new Map(
    nodes.map((node) => [String(node.bracketMatch), node])
  );

  const meaningfulIds = new Set([championship.playoffGameId]);
  let changed = true;

  while (changed) {
    changed = false;

    const meaningfulNodes = nodes.filter((node) =>
      meaningfulIds.has(node.playoffGameId)
    );

    for (const laterNode of meaningfulNodes) {
      // Preferred source: explicit Sleeper bracket progression.
      for (const sourceMatchId of winnerSourceMatchIds(laterNode)) {
        const sourceNode = byMatchId.get(sourceMatchId);

        if (
          sourceNode &&
          !meaningfulIds.has(sourceNode.playoffGameId)
        ) {
          meaningfulIds.add(sourceNode.playoffGameId);
          changed = true;
        }
      }

      // Historical fallback: if a prior-round game's winner is one of the
      // participants in this championship-path matchup, that prior game was
      // also championship-relevant.
      const laterParticipants = new Set(participantRosterIds(laterNode));
      const priorRound = Number(laterNode.round || 0) - 1;

      if (priorRound < 1 || laterParticipants.size === 0) continue;

      for (const candidate of nodes) {
        if (Number(candidate.round) !== priorRound) continue;
        if (!candidate.isResolved || !candidate.winnerRosterId) continue;

        if (
          laterParticipants.has(String(candidate.winnerRosterId)) &&
          !meaningfulIds.has(candidate.playoffGameId)
        ) {
          meaningfulIds.add(candidate.playoffGameId);
          changed = true;
        }
      }
    }
  }

  return nodes
    .filter((node) => meaningfulIds.has(node.playoffGameId))
    .sort((a, b) => {
      if (Number(a.round) !== Number(b.round)) {
        return Number(a.round) - Number(b.round);
      }
      return Number(a.bracketMatch) - Number(b.bracketMatch);
    });
}

export function isChampionshipPathPlayoffNode(almanac, node) {
  if (!node) return false;

  return getChampionshipPathPlayoffNodes(almanac, node.season).some(
    (candidate) => candidate.playoffGameId === node.playoffGameId
  );
}


/**
 * Games that count as meaningful league playoffs for Almanac purposes.
 *
 * Includes:
 * - every game on the championship path
 * - the official 3rd-place game (p === 3)
 *
 * Excludes:
 * - 5th-place, 7th-place, and similar post-elimination placement games
 * - consolation / losers-bracket games
 *
 * This matches the league-history intent: the 3rd-place game determines an
 * official top-three finish, while lower placement games should not inflate
 * or deflate manager playoff records.
 */
export function getMeaningfulPlayoffNodes(almanac, seasonYear) {
  const season = str(seasonYear);

  const championshipPath = getChampionshipPathPlayoffNodes(
    almanac,
    season
  );

  const byId = new Map(
    championshipPath.map((node) => [node.playoffGameId, node])
  );

  for (const node of almanac.playoffGames) {
    if (
      node.season === season &&
      node.bracketType === "winners" &&
      Number(node.placement) === 3
    ) {
      byId.set(node.playoffGameId, node);
    }
  }

  return [...byId.values()].sort((a, b) => {
    if (Number(a.round) !== Number(b.round)) {
      return Number(a.round) - Number(b.round);
    }
    return Number(a.bracketMatch) - Number(b.bracketMatch);
  });
}



function resolvedWinnerBracketNodes(almanac, seasonYear) {
  const season = str(seasonYear);

  return almanac.playoffGames.filter(
    (node) =>
      node.season === season &&
      node.bracketType === "winners" &&
      node.isResolved
  );
}

/**
 * Return the most precise postseason finish we can support from Sleeper's
 * resolved winners bracket.
 *
 * Exact placements:
 * - p:1 winner  -> Champion
 * - p:1 loser   -> Runner-up
 * - p:3 winner  -> 3rd Place
 * - p:3 loser   -> 4th Place
 *
 * Other championship-path eliminations use the round they were eliminated
 * rather than the vague label "Playoffs".
 */
export function getPostseasonFinishForRoster(
  almanac,
  seasonYear,
  rosterId
) {
  const roster = str(rosterId);
  if (!roster) return "—";

  const nodes = resolvedWinnerBracketNodes(almanac, seasonYear);
  const championship = nodes.find(
    (node) => Number(node.placement) === 1
  );

  if (
    championship?.winnerRosterId &&
    String(championship.winnerRosterId) === roster
  ) {
    return "Champion";
  }

  if (
    championship?.loserRosterId &&
    String(championship.loserRosterId) === roster
  ) {
    return "Runner-up";
  }

  const thirdPlace = nodes.find(
    (node) => Number(node.placement) === 3
  );

  if (
    thirdPlace?.winnerRosterId &&
    String(thirdPlace.winnerRosterId) === roster
  ) {
    return "3rd Place";
  }

  if (
    thirdPlace?.loserRosterId &&
    String(thirdPlace.loserRosterId) === roster
  ) {
    return "4th Place";
  }

  const championshipPath = getChampionshipPathPlayoffNodes(
    almanac,
    seasonYear
  ).filter((node) => node.isResolved);

  const losses = championshipPath.filter(
    (node) =>
      node.loserRosterId &&
      String(node.loserRosterId) === roster
  );

  if (!losses.length) {
    const appeared = championshipPath.some((node) =>
      [node.team1RosterId, node.team2RosterId]
        .filter(Boolean)
        .map(String)
        .includes(roster)
    );

    return appeared ? "Still Alive" : "—";
  }

  const loss = losses
    .slice()
    .sort((a, b) => Number(b.round || 0) - Number(a.round || 0))[0];

  const championshipRound = Number(championship?.round || 0);
  const lossRound = Number(loss?.round || 0);

  if (championshipRound && lossRound === championshipRound - 1) {
    return "Semifinals";
  }

  if (lossRound === 1) {
    return "First Round";
  }

  return lossRound ? `Round ${lossRound}` : "—";
}

/**
 * Resolve the finish for the manager who actually controlled the roster at the
 * relevant postseason result. This avoids assigning a franchise's eventual
 * finish to a prior owner in the rare event of a postseason ownership change.
 */
export function getPostseasonFinishForManager(
  almanac,
  seasonYear,
  franchiseId,
  managerId
) {
  const season = str(seasonYear);
  const manager = str(managerId);
  if (!season || !franchiseId || !manager) return "—";

  const team = almanac.seasonTeams.find(
    (candidate) =>
      candidate.season === season &&
      candidate.franchiseId === franchiseId
  );

  if (!team) return "—";

  const rosterFinish = getPostseasonFinishForRoster(
    almanac,
    season,
    team.rosterId
  );

  if (rosterFinish === "—") return "—";

  const seasonMeta = almanac.seasons.find(
    (candidate) => candidate.season === season
  );

  const meaningfulNodes = getMeaningfulPlayoffNodes(
    almanac,
    season
  ).filter(
    (node) =>
      node.isResolved &&
      [node.team1RosterId, node.team2RosterId]
        .filter(Boolean)
        .map(String)
        .includes(String(team.rosterId))
  );

  if (!meaningfulNodes.length) return "—";

  const lastRelevantNode = meaningfulNodes
    .slice()
    .sort((a, b) => Number(b.round || 0) - Number(a.round || 0))[0];

  const week =
    Number(seasonMeta?.playoffWeekStart || 0) +
    Number(lastRelevantNode?.round || 0) -
    1;

  const game = almanac.games.find(
    (candidate) =>
      candidate.season === season &&
      Number(candidate.week) === week &&
      [candidate.teamA.franchiseId, candidate.teamB.franchiseId].includes(
        franchiseId
      )
  );

  if (!game) return "—";

  const side =
    game.teamA.franchiseId === franchiseId ? game.teamA : game.teamB;

  return side.managerId === manager ? rosterFinish : "—";
}

export function isMeaningfulPlayoffNode(almanac, node) {
  if (!node) return false;

  return getMeaningfulPlayoffNodes(almanac, node.season).some(
    (candidate) => candidate.playoffGameId === node.playoffGameId
  );
}
