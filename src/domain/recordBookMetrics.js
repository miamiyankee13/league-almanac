import { buildManagerMetrics } from "./managerMetrics";
import { getPostseasonFinishForRoster } from "./playoffUtils";
import { getMeaningfulPlayoffGameEntries } from "./gameUtils";

function str(value) {
  return value == null ? null : String(value);
}

function num(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function blankRecord() {
  return {
    wins: 0,
    losses: 0,
    ties: 0,
    games: 0,
    pointsFor: 0,
    pointsAgainst: 0,
  };
}

function addResult(record, pointsFor, pointsAgainst) {
  record.games += 1;
  record.pointsFor += pointsFor;
  record.pointsAgainst += pointsAgainst;

  if (pointsFor > pointsAgainst) record.wins += 1;
  else if (pointsAgainst > pointsFor) record.losses += 1;
  else record.ties += 1;
}

function winPct(record) {
  if (!record?.games) return 0;
  return (record.wins + record.ties * 0.5) / record.games;
}

function managerName(almanac, managerId) {
  if (!managerId) return null;

  return (
    almanac.managers.find((manager) => manager.managerId === managerId)
      ?.displayName || managerId
  );
}

function seasonTeam(almanac, season, franchiseId) {
  return almanac.seasonTeams.find(
    (team) =>
      team.season === str(season) &&
      team.franchiseId === franchiseId
  );
}

function seasonTeamByRoster(almanac, season, rosterId) {
  return almanac.seasonTeams.find(
    (team) =>
      team.season === str(season) &&
      team.rosterId === str(rosterId)
  );
}

function managerLineage(almanac, season, franchiseId) {
  const tenures = almanac.managerTenures
    .filter(
      (tenure) =>
        tenure.season === str(season) &&
        tenure.franchiseId === franchiseId &&
        ["primary", "incoming_owner"].includes(tenure.role)
    )
    .sort(
      (a, b) =>
        num(a.startWeek) - num(b.startWeek)
    );

  const names = [];

  for (const tenure of tenures) {
    const name = managerName(almanac, tenure.managerId);
    if (name && !names.includes(name)) names.push(name);
  }

  return names.length ? names.join(" → ") : "Manager unresolved";
}

function playoffStage(node, seasonNodes) {
  if (Number(node?.placement) === 1) return "Championship";
  if (Number(node?.placement) === 3) return "3rd Place";

  const championship = seasonNodes.find(
    (candidate) => Number(candidate.placement) === 1
  );

  const championshipRound = Number(championship?.round || 0);
  const round = Number(node?.round || 0);

  if (championshipRound && round === championshipRound - 1) {
    return "Semifinals";
  }

  if (round === 1) return "First Round";
  return round ? `Playoff Round ${round}` : "Playoffs";
}

function competitiveGames(almanac) {
  const regular = almanac.games
    .filter((game) => game.phase === "regular_season")
    .map((game) => ({
      ...game,
      recordBookStage: "Regular Season",
    }));

  const playoff = getMeaningfulPlayoffGameEntries(almanac).map(
    ({ game, node, season }) => {
      const seasonNodes = almanac.playoffGames.filter(
        (candidate) =>
          candidate.season === season.season &&
          candidate.bracketType === "winners"
      );

      return {
        ...game,
        recordBookStage: playoffStage(node, seasonNodes),
      };
    }
  );

  return [...regular, ...playoff];
}

function sideEntry(almanac, game, side, opponent) {
  const team = seasonTeam(
    almanac,
    game.season,
    side.franchiseId
  );

  const opponentTeam = seasonTeam(
    almanac,
    game.season,
    opponent.franchiseId
  );

  const points = num(side.points);
  const opponentPoints = num(opponent.points);

  const outcome =
    points > opponentPoints
      ? "W"
      : points < opponentPoints
        ? "L"
        : "T";

  return {
    id: `${game.gameId}:${side.rosterId}`,
    gameId: game.gameId,
    season: game.season,
    week: Number(game.week),
    stage: game.recordBookStage,
    phase: game.phase,
    rosterId: side.rosterId,
    franchiseId: side.franchiseId,
    managerId: side.managerId,
    managerName:
      managerName(almanac, side.managerId) ||
      "Manager unresolved",
    teamName:
      team?.teamName ||
      `Roster ${side.rosterId}`,
    opponentRosterId: opponent.rosterId,
    opponentFranchiseId: opponent.franchiseId,
    opponentManagerId: opponent.managerId,
    opponentManagerName:
      managerName(almanac, opponent.managerId) ||
      "Manager unresolved",
    opponentTeamName:
      opponentTeam?.teamName ||
      `Roster ${opponent.rosterId}`,
    points,
    opponentPoints,
    outcome,
    margin: Math.abs(points - opponentPoints),
    combinedPoints: points + opponentPoints,
  };
}

function gameEntries(almanac) {
  const games = competitiveGames(almanac);
  const teamGames = [];
  const matchupGames = [];

  for (const game of games) {
    const a = sideEntry(
      almanac,
      game,
      game.teamA,
      game.teamB
    );

    const b = sideEntry(
      almanac,
      game,
      game.teamB,
      game.teamA
    );

    teamGames.push(a, b);

    let winner = null;
    let loser = null;

    if (a.points > b.points) {
      winner = a;
      loser = b;
    } else if (b.points > a.points) {
      winner = b;
      loser = a;
    }

    matchupGames.push({
      gameId: game.gameId,
      season: game.season,
      week: Number(game.week),
      stage: game.recordBookStage,
      teamA: a,
      teamB: b,
      winner,
      loser,
      isTie: !winner,
      margin: Math.abs(a.points - b.points),
      combinedPoints: a.points + b.points,
    });
  }

  return {
    teamGames,
    matchupGames,
  };
}

function firstBy(items, comparator) {
  if (!items.length) return null;
  return [...items].sort(comparator)[0];
}

function buildGameRecords(almanac) {
  const { teamGames, matchupGames } = gameEntries(almanac);
  const decidedGames = matchupGames.filter((game) => !game.isTie);
  const losingEntries = teamGames.filter((entry) => entry.outcome === "L");
  const winningEntries = teamGames.filter((entry) => entry.outcome === "W");

  const highestScore = firstBy(
    teamGames,
    (a, b) => b.points - a.points
  );

  const lowestScore = firstBy(
    teamGames,
    (a, b) => a.points - b.points
  );

  const highestLosingScore = firstBy(
    losingEntries,
    (a, b) => b.points - a.points
  );

  const lowestWinningScore = firstBy(
    winningEntries,
    (a, b) => a.points - b.points
  );

  const biggestBlowout = firstBy(
    decidedGames,
    (a, b) =>
      b.margin - a.margin ||
      b.combinedPoints - a.combinedPoints
  );

  const closestWin = firstBy(
    decidedGames,
    (a, b) =>
      a.margin - b.margin ||
      b.combinedPoints - a.combinedPoints
  );

  const highestCombined = firstBy(
    matchupGames,
    (a, b) =>
      b.combinedPoints - a.combinedPoints ||
      b.margin - a.margin
  );

  const lowestCombined = firstBy(
    matchupGames,
    (a, b) =>
      a.combinedPoints - b.combinedPoints ||
      a.margin - b.margin
  );

  const topScores = [...teamGames]
    .sort(
      (a, b) =>
        b.points - a.points ||
        Number(b.season) - Number(a.season) ||
        b.week - a.week
    )
    .slice(0, 10);

  const worstScores = [...teamGames]
    .sort(
      (a, b) =>
        a.points - b.points ||
        Number(a.season) - Number(b.season) ||
        a.week - b.week
    )
    .slice(0, 10);

  const badBeats = [...losingEntries]
    .sort(
      (a, b) =>
        b.points - a.points ||
        a.margin - b.margin
    )
    .slice(0, 10);

  const blowouts = [...decidedGames]
    .sort(
      (a, b) =>
        b.margin - a.margin ||
        b.combinedPoints - a.combinedPoints
    )
    .slice(0, 10);

  return {
    teamGames,
    matchupGames,
    highestScore,
    lowestScore,
    highestLosingScore,
    lowestWinningScore,
    biggestBlowout,
    closestWin,
    highestCombined,
    lowestCombined,
    topScores,
    worstScores,
    badBeats,
    blowouts,
  };
}

function buildSeasonRecords(almanac) {
  const completedSeasonIds = new Set(
    almanac.seasons
      .filter((season) => season.status === "complete")
      .map((season) => season.season)
  );

  const rowsByKey = new Map();

  for (const team of almanac.seasonTeams) {
    if (!completedSeasonIds.has(team.season)) continue;

    rowsByKey.set(`${team.season}:${team.franchiseId}`, {
      id: `${team.season}:${team.franchiseId}`,
      season: team.season,
      franchiseId: team.franchiseId,
      rosterId: team.rosterId,
      teamName: team.teamName,
      managerLineage: managerLineage(
        almanac,
        team.season,
        team.franchiseId
      ),
      h2h: blankRecord(),
      official: team.officialRecordSnapshot,
      pointDiff: 0,
      finish: getPostseasonFinishForRoster(
        almanac,
        team.season,
        team.rosterId
      ),
      champion: false,
      leagueMedianEnabled: Boolean(
        almanac.seasons.find(
          (season) => season.season === team.season
        )?.recordFormat?.leagueMedianGameEnabled
      ),
    });
  }

  for (const game of almanac.games) {
    if (
      game.phase !== "regular_season" ||
      !completedSeasonIds.has(game.season)
    ) {
      continue;
    }

    const pairs = [
      [game.teamA, game.teamB],
      [game.teamB, game.teamA],
    ];

    for (const [side, opponent] of pairs) {
      const row = rowsByKey.get(
        `${game.season}:${side.franchiseId}`
      );

      if (!row) continue;

      addResult(
        row.h2h,
        num(side.points),
        num(opponent.points)
      );
    }
  }

  for (const champion of almanac.champions) {
    const row = rowsByKey.get(
      `${champion.season}:${champion.winner.franchiseId}`
    );

    if (row) row.champion = true;
  }

  const seasons = [...rowsByKey.values()].map((row) => ({
    ...row,
    winPct: winPct(row.h2h),
    pointDiff: row.h2h.pointsFor - row.h2h.pointsAgainst,
  }));

  const mostWins = firstBy(
    seasons,
    (a, b) =>
      b.h2h.wins - a.h2h.wins ||
      b.winPct - a.winPct ||
      b.h2h.pointsFor - a.h2h.pointsFor
  );

  const bestRecord = firstBy(
    seasons,
    (a, b) =>
      b.winPct - a.winPct ||
      b.h2h.wins - a.h2h.wins ||
      b.h2h.pointsFor - a.h2h.pointsFor
  );

  const worstRecord = firstBy(
    seasons,
    (a, b) =>
      a.winPct - b.winPct ||
      a.h2h.wins - b.h2h.wins ||
      a.h2h.pointsFor - b.h2h.pointsFor
  );

  const mostPoints = firstBy(
    seasons,
    (a, b) => b.h2h.pointsFor - a.h2h.pointsFor
  );

  const fewestPoints = firstBy(
    seasons,
    (a, b) => a.h2h.pointsFor - b.h2h.pointsFor
  );

  const bestPointDiff = firstBy(
    seasons,
    (a, b) => b.pointDiff - a.pointDiff
  );

  const worstPointDiff = firstBy(
    seasons,
    (a, b) => a.pointDiff - b.pointDiff
  );

  const mostPointsAgainst = firstBy(
    seasons,
    (a, b) =>
      b.h2h.pointsAgainst - a.h2h.pointsAgainst
  );

  const mostPointsWithoutTitle = firstBy(
    seasons.filter((row) => !row.champion),
    (a, b) => b.h2h.pointsFor - a.h2h.pointsFor
  );

  const leaderboard = [...seasons].sort(
    (a, b) =>
      b.winPct - a.winPct ||
      b.h2h.wins - a.h2h.wins ||
      b.h2h.pointsFor - a.h2h.pointsFor
  );

  return {
    seasons,
    leaderboard,
    mostWins,
    bestRecord,
    worstRecord,
    mostPoints,
    fewestPoints,
    bestPointDiff,
    worstPointDiff,
    mostPointsAgainst,
    mostPointsWithoutTitle,
    hasLeagueMedianSeasons: seasons.some(
      (row) => row.leagueMedianEnabled
    ),
  };
}

function bestWinPctManager(managers) {
  if (!managers.length) return null;

  const qualified = managers.filter(
    (manager) => manager.regular.games >= 10
  );

  const pool = qualified.length ? qualified : managers;

  return firstBy(
    pool,
    (a, b) =>
      b.winPct - a.winPct ||
      b.regular.wins - a.regular.wins ||
      b.regular.pointsFor - a.regular.pointsFor
  );
}

function buildCareerRecords(almanac) {
  const managerData = buildManagerMetrics(almanac);
  const managers = managerData.managers;

  const mostTitles = firstBy(
    managers,
    (a, b) =>
      b.championships - a.championships ||
      b.finals - a.finals ||
      b.regular.wins - a.regular.wins
  );

  const mostFinals = firstBy(
    managers,
    (a, b) =>
      b.finals - a.finals ||
      b.championships - a.championships ||
      b.regular.wins - a.regular.wins
  );

  const mostPlayoffAppearances = firstBy(
    managers,
    (a, b) =>
      b.playoffAppearances - a.playoffAppearances ||
      b.playoffs.wins - a.playoffs.wins
  );

  const mostRegularWins = firstBy(
    managers,
    (a, b) =>
      b.regular.wins - a.regular.wins ||
      b.winPct - a.winPct
  );

  const bestWinPct = bestWinPctManager(managers);

  const mostCareerPF = firstBy(
    managers,
    (a, b) =>
      b.regular.pointsFor - a.regular.pointsFor
  );

  const mostPlayoffWins = firstBy(
    managers,
    (a, b) =>
      b.playoffs.wins - a.playoffs.wins ||
      b.playoffWinPct - a.playoffWinPct
  );

  const mostSeasons = firstBy(
    managers,
    (a, b) =>
      b.primarySeasonCount - a.primarySeasonCount ||
      b.regular.games - a.regular.games
  );

  return {
    managers,
    mostTitles,
    mostFinals,
    mostPlayoffAppearances,
    mostRegularWins,
    bestWinPct,
    bestWinPctMinimumGames:
      managers.some((manager) => manager.regular.games >= 10)
        ? 10
        : 1,
    mostCareerPF,
    mostPlayoffWins,
    mostSeasons,
    hasLeagueMedianSeasons:
      managerData.hasLeagueMedianSeasons,
  };
}

export function buildRecordBook(almanac) {
  return {
    games: buildGameRecords(almanac),
    seasons: buildSeasonRecords(almanac),
    careers: buildCareerRecords(almanac),
  };
}

export function formatRecord(record) {
  if (!record) return "0-0";

  return record.ties
    ? `${record.wins}-${record.losses}-${record.ties}`
    : `${record.wins}-${record.losses}`;
}

export function formatPct(value) {
  if (!Number.isFinite(value)) return ".000";
  return value.toFixed(3).replace(/^0/, "");
}
