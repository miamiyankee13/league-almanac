import { getMeaningfulPlayoffNodes } from "./playoffUtils";

function str(value) {
  return value == null ? null : String(value);
}

/**
 * Resolve the actual Sleeper matchup rows that correspond to meaningful
 * postseason games:
 * - championship path
 * - official 3rd-place game
 *
 * Lower placement games remain excluded.
 */
export function getMeaningfulPlayoffGameEntries(almanac) {
  const out = [];
  const seenGameIds = new Set();

  for (const season of almanac.seasons || []) {
    const nodes = getMeaningfulPlayoffNodes(
      almanac,
      season.season
    );

    for (const node of nodes) {
      if (!node.isResolved) continue;
      if (!season.playoffWeekStart || !node.round) continue;

      const rosterIds = [
        node.team1RosterId,
        node.team2RosterId,
      ]
        .filter(Boolean)
        .map(String);

      if (rosterIds.length !== 2) continue;

      const week =
        Number(season.playoffWeekStart) + Number(node.round) - 1;

      const game = almanac.games.find(
        (candidate) =>
          candidate.season === str(season.season) &&
          Number(candidate.week) === week &&
          rosterIds.includes(candidate.teamA.rosterId) &&
          rosterIds.includes(candidate.teamB.rosterId)
      );

      if (!game || seenGameIds.has(game.gameId)) continue;

      seenGameIds.add(game.gameId);
      out.push({
        game,
        node,
        season,
      });
    }
  }

  return out;
}

/**
 * League games that count as meaningful competition in Almanac summaries and
 * records. Regular-season games always count; postseason games are restricted
 * to the meaningful playoff set above.
 */
export function getMeaningfulCompetitiveGames(almanac) {
  const regularGames = (almanac.games || []).filter(
    (game) => game.phase === "regular_season"
  );

  const playoffGames = getMeaningfulPlayoffGameEntries(almanac).map(
    (entry) => entry.game
  );

  return [...regularGames, ...playoffGames];
}
