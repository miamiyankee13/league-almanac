import {
  getMeaningfulPlayoffNodes,
  getPostseasonFinishForManager,
} from "./playoffUtils";

function asNumber(value) {
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

function applyResult(record, pointsFor, pointsAgainst) {
  record.games += 1;
  record.pointsFor += pointsFor;
  record.pointsAgainst += pointsAgainst;

  if (pointsFor > pointsAgainst) record.wins += 1;
  else if (pointsAgainst > pointsFor) record.losses += 1;
  else record.ties += 1;
}

function applyAggregateRecord(record, snapshot) {
  if (!snapshot?.recordKnown) return;

  const wins = asNumber(snapshot.wins);
  const losses = asNumber(snapshot.losses);
  const ties = asNumber(snapshot.ties);

  record.wins += wins;
  record.losses += losses;
  record.ties += ties;
  record.games += wins + losses + ties;
}

function applyKnownWinLoss(record, won) {
  record.games += 1;
  if (won) record.wins += 1;
  else record.losses += 1;
}

function winPct(record) {
  if (!record?.games) return 0;
  return (record.wins + record.ties * 0.5) / record.games;
}

function managerById(almanac, managerId) {
  return almanac.managers.find((manager) => manager.managerId === managerId);
}

function seasonTeamFor(almanac, season, franchiseId) {
  return almanac.seasonTeams.find(
    (team) => team.season === season && team.franchiseId === franchiseId
  );
}

function franchiseNumber(almanac, franchiseId) {
  return (
    almanac.franchises.find((franchise) => franchise.franchiseId === franchiseId)
      ?.sleeperRosterLineage || null
  );
}

function ensureSeason(stats, season, franchiseId) {
  const key = `${season}:${franchiseId}`;

  if (!stats._seasonMap.has(key)) {
    stats._seasonMap.set(key, {
      key,
      season,
      franchiseId,
      tenureRanges: [],
      regular: blankRecord(),
      playoffs: blankRecord(),
      playoffAppearance: false,
      championship: false,
      finalist: false,
      teamName: null,
      franchiseNumber: null,
      finish: "—",
      historicalOnly: false,
      pointsKnown: true,
    });
  }

  return stats._seasonMap.get(key);
}

function buildPlayablePostseasonGames(almanac) {
  const seasonByYear = new Map(
    almanac.seasons.map((season) => [season.season, season])
  );

  const out = [];
  const seenGameIds = new Set();

  for (const season of almanac.seasons) {
    const pathNodes = getMeaningfulPlayoffNodes(
      almanac,
      season.season
    );

    for (const node of pathNodes) {
      if (!node.isResolved) continue;
      if (!season?.playoffWeekStart || !node.round) continue;

      const week =
        Number(season.playoffWeekStart) + Number(node.round) - 1;

      const rosterIds = [
        node.team1RosterId,
        node.team2RosterId,
      ].filter(Boolean);

      if (rosterIds.length !== 2) continue;

      const game = almanac.games.find(
        (candidate) =>
          candidate.season === node.season &&
          Number(candidate.week) === week &&
          rosterIds.includes(candidate.teamA.rosterId) &&
          rosterIds.includes(candidate.teamB.rosterId)
      );

      if (!game || seenGameIds.has(game.gameId)) continue;

      seenGameIds.add(game.gameId);
      out.push(game);
    }
  }

  return out;
}

function tenureLabel(tenures, season) {
  const ranges = tenures
    .filter(
      (tenure) =>
        tenure.role === "primary" || tenure.role === "incoming_owner"
    )
    .map((tenure) => ({
      start: tenure.startWeek,
      end: tenure.endWeek,
      role: tenure.role,
    }))
    .sort((a, b) => asNumber(a.start) - asNumber(b.start));

  if (!ranges.length) return "—";

  return ranges
    .map((range) => {
      const start = asNumber(range.start);
      const end = range.end == null ? null : asNumber(range.end);

      if (range.role === "incoming_owner" && start > asNumber(season?.lastScoredLeg)) {
        return `Took over after Week ${season?.lastScoredLeg || start - 1}`;
      }

      if (start === 1 && end && end >= asNumber(season?.lastScoredLeg)) {
        return "Full season";
      }

      if (start === 1 && end) return `Weeks 1–${end}`;
      if (start && end) return `Weeks ${start}–${end}`;
      if (start) return `Week ${start}+`;
      return "—";
    })
    .join(" • ");
}

function compareBest(a, b) {
  const pctDiff = winPct(b.regular) - winPct(a.regular);
  if (Math.abs(pctDiff) > 1e-9) return pctDiff;
  if (b.regular.wins !== a.regular.wins) return b.regular.wins - a.regular.wins;
  return b.regular.pointsFor - a.regular.pointsFor;
}

function compareWorst(a, b) {
  const pctDiff = winPct(a.regular) - winPct(b.regular);
  if (Math.abs(pctDiff) > 1e-9) return pctDiff;
  if (a.regular.wins !== b.regular.wins) return a.regular.wins - b.regular.wins;
  return a.regular.pointsFor - b.regular.pointsFor;
}

function matchupSummary(statsByManager, opponentEntries, mode) {
  if (!opponentEntries.length) return null;

  const atLeastThree = opponentEntries.filter(([, record]) => record.games >= 3);
  const atLeastTwo = opponentEntries.filter(([, record]) => record.games >= 2);
  const pool = atLeastThree.length ? atLeastThree : atLeastTwo;

  if (!pool.length) return null;

  const sorted = [...pool].sort((a, b) => {
    const aPct = winPct(a[1]);
    const bPct = winPct(b[1]);

    if (Math.abs(aPct - bPct) > 1e-9) {
      return mode === "best" ? bPct - aPct : aPct - bPct;
    }

    if (b[1].games !== a[1].games) return b[1].games - a[1].games;

    if (mode === "best") {
      if (b[1].wins !== a[1].wins) return b[1].wins - a[1].wins;
      return (b[1].pointsFor - b[1].pointsAgainst) -
        (a[1].pointsFor - a[1].pointsAgainst);
    }

    if (a[1].wins !== b[1].wins) return a[1].wins - b[1].wins;
    return (a[1].pointsFor - a[1].pointsAgainst) -
      (b[1].pointsFor - b[1].pointsAgainst);
  });

  const [opponentId, record] = sorted[0];

  return {
    managerId: opponentId,
    displayName: statsByManager.get(opponentId)?.displayName || opponentId,
    ...record,
    winPct: winPct(record),
  };
}

export function buildManagerMetrics(almanac) {
  const latestSeason = almanac.seasons.at(-1)?.season || null;
  const seasonByYear = new Map(
    almanac.seasons.map((season) => [season.season, season])
  );

  const eligibleManagerIds = new Set(
    almanac.managerTenures
      .filter((tenure) =>
        ["primary", "incoming_owner"].includes(tenure.role)
      )
      .map((tenure) => tenure.managerId)
      .filter(Boolean)
  );

  const statsByManager = new Map();

  for (const managerId of eligibleManagerIds) {
    const manager = managerById(almanac, managerId);
    statsByManager.set(managerId, {
      managerId,
      displayName: manager?.displayName || managerId,
      aliases: manager?.aliases || [],
      avatar: manager?.avatar || null,
      regular: blankRecord(),
      playoffs: blankRecord(),
      pointsGames: 0,
      manualRegularGames: 0,
      manualPlayoffGames: 0,
      manualOpponentUnknownPlayoffOutcomes: 0,
      championships: 0,
      finals: 0,
      playoffAppearances: 0,
      seasons: [],
      current: false,
      currentFranchiseId: null,
      currentTeamName: null,
      joinSeason: null,
      mostRecentSeason: null,
      bestSeason: null,
      worstSeason: null,
      archrival: null,
      toughestMatchup: null,
      bestMatchup: null,
      _seasonMap: new Map(),
      _opponents: new Map(),
    });
  }

  for (const tenure of almanac.managerTenures) {
    if (!eligibleManagerIds.has(tenure.managerId)) continue;
    if (!["primary", "incoming_owner"].includes(tenure.role)) continue;

    const stats = statsByManager.get(tenure.managerId);
    const seasonSummary = ensureSeason(stats, tenure.season, tenure.franchiseId);
    const season = seasonByYear.get(tenure.season);
    const team = seasonTeamFor(almanac, tenure.season, tenure.franchiseId);

    seasonSummary.tenureRanges.push(tenure);
    seasonSummary.teamName ||= team?.teamName || null;
    seasonSummary.franchiseNumber ||= franchiseNumber(almanac, tenure.franchiseId);
    seasonSummary.historicalOnly ||= Boolean(team?.historicalOnly);
    seasonSummary.pointsKnown = team?.historicalOnly ? false : seasonSummary.pointsKnown;
    if (team?.manualFinish) seasonSummary.finish = team.manualFinish;

    if (team?.historicalOnly && team?.officialRecordSnapshot?.recordKnown) {
      applyAggregateRecord(stats.regular, team.officialRecordSnapshot);
      applyAggregateRecord(seasonSummary.regular, team.officialRecordSnapshot);
      stats.manualRegularGames +=
        asNumber(team.officialRecordSnapshot.wins) +
        asNumber(team.officialRecordSnapshot.losses) +
        asNumber(team.officialRecordSnapshot.ties);
    }

    if (team?.historicalOnly && team?.manualPlayoffAppearance) {
      seasonSummary.playoffAppearance = true;
    }

    if (team?.historicalOnly && team?.manualOpponentUnknownPlayoffRecord?.games) {
      const implied = {
        ...team.manualOpponentUnknownPlayoffRecord,
        recordKnown: true,
      };
      applyAggregateRecord(stats.playoffs, implied);
      applyAggregateRecord(seasonSummary.playoffs, implied);
      stats.manualOpponentUnknownPlayoffOutcomes += asNumber(implied.games);
      seasonSummary.historicalOnly = true;
      seasonSummary.pointsKnown = false;
      seasonSummary.playoffAppearance = true;
    }

    if (!stats.joinSeason || Number(tenure.season) < Number(stats.joinSeason)) {
      stats.joinSeason = tenure.season;
    }

    if (
      !stats.mostRecentSeason ||
      Number(tenure.season) > Number(stats.mostRecentSeason)
    ) {
      stats.mostRecentSeason = tenure.season;
    }

    if (tenure.season === latestSeason && !team?.historicalOnly) {
      stats.current = true;
      stats.currentFranchiseId = tenure.franchiseId;
      stats.currentTeamName = team?.teamName || null;
    }

    seasonSummary.tenureLabel = team?.historicalOnly
      ? "Historical season"
      : tenureLabel(seasonSummary.tenureRanges, season);
  }

  for (const game of almanac.games) {
    if (game.phase !== "regular_season") continue;

    const pairs = [
      [game.teamA, game.teamB],
      [game.teamB, game.teamA],
    ];

    for (const [side, opponent] of pairs) {
      const managerId = side.managerId;
      if (!managerId || !statsByManager.has(managerId)) continue;

      const stats = statsByManager.get(managerId);
      const pf = asNumber(side.points);
      const pa = asNumber(opponent.points);
      applyResult(stats.regular, pf, pa);
      stats.pointsGames += 1;

      const seasonSummary = ensureSeason(
        stats,
        game.season,
        side.franchiseId
      );
      seasonSummary.pointsKnown = true;
      applyResult(seasonSummary.regular, pf, pa);

      if (opponent.managerId) {
        if (!stats._opponents.has(opponent.managerId)) {
          stats._opponents.set(opponent.managerId, blankRecord());
        }
        applyResult(stats._opponents.get(opponent.managerId), pf, pa);
      }
    }
  }

  for (const game of buildPlayablePostseasonGames(almanac)) {
    const pairs = [
      [game.teamA, game.teamB],
      [game.teamB, game.teamA],
    ];

    for (const [side, opponent] of pairs) {
      const managerId = side.managerId;
      if (!managerId || !statsByManager.has(managerId)) continue;

      const stats = statsByManager.get(managerId);
      const pf = asNumber(side.points);
      const pa = asNumber(opponent.points);
      applyResult(stats.playoffs, pf, pa);

      const seasonSummary = ensureSeason(
        stats,
        game.season,
        side.franchiseId
      );
      seasonSummary.playoffAppearance = true;
      applyResult(seasonSummary.playoffs, pf, pa);
    }
  }

  for (const game of almanac.manualPlayoffGames || []) {
    const winnerManagerId = game?.winner?.managerId;
    const loserManagerId = game?.loser?.managerId;

    if (winnerManagerId && statsByManager.has(winnerManagerId)) {
      const stats = statsByManager.get(winnerManagerId);
      applyKnownWinLoss(stats.playoffs, true);
      stats.manualPlayoffGames += 1;

      const seasonSummary = ensureSeason(
        stats,
        game.season,
        game.winner.franchiseId
      );
      seasonSummary.historicalOnly = true;
      seasonSummary.pointsKnown = false;
      seasonSummary.playoffAppearance = true;
      applyKnownWinLoss(seasonSummary.playoffs, true);
    }

    if (loserManagerId && statsByManager.has(loserManagerId)) {
      const stats = statsByManager.get(loserManagerId);
      applyKnownWinLoss(stats.playoffs, false);
      stats.manualPlayoffGames += 1;

      const seasonSummary = ensureSeason(
        stats,
        game.season,
        game.loser.franchiseId
      );
      seasonSummary.historicalOnly = true;
      seasonSummary.pointsKnown = false;
      seasonSummary.playoffAppearance = true;
      applyKnownWinLoss(seasonSummary.playoffs, false);
    }
  }

  for (const champion of almanac.champions) {
    if (champion.winner.managerId && statsByManager.has(champion.winner.managerId)) {
      const stats = statsByManager.get(champion.winner.managerId);
      stats.championships += 1;
      stats.finals += 1;

      const seasonSummary = ensureSeason(
        stats,
        champion.season,
        champion.winner.franchiseId
      );
      seasonSummary.championship = true;
      seasonSummary.finalist = true;
    }

    if (
      champion.runnerUp.managerId &&
      statsByManager.has(champion.runnerUp.managerId)
    ) {
      const stats = statsByManager.get(champion.runnerUp.managerId);
      stats.finals += 1;

      const seasonSummary = ensureSeason(
        stats,
        champion.season,
        champion.runnerUp.franchiseId
      );
      seasonSummary.finalist = true;
    }
  }

  for (const stats of statsByManager.values()) {
    for (const seasonSummary of stats._seasonMap.values()) {
      if (seasonSummary.playoffAppearance && !seasonSummary.historicalOnly) {
        seasonSummary.finish = getPostseasonFinishForManager(
          almanac,
          seasonSummary.season,
          seasonSummary.franchiseId,
          stats.managerId
        );

        if (seasonSummary.finish === "—") {
          seasonSummary.finish = "Postseason";
        }
      }

      const season = seasonByYear.get(seasonSummary.season);
      seasonSummary.tenureLabel = seasonSummary.historicalOnly
        ? "Historical season"
        : tenureLabel(seasonSummary.tenureRanges, season);
    }

    stats.seasons = [...stats._seasonMap.values()].sort(
      (a, b) => Number(b.season) - Number(a.season)
    );

    stats.playoffAppearances = new Set(
      stats.seasons
        .filter((season) => season.playoffAppearance)
        .map((season) => season.season)
    ).size;

    const playedSeasons = stats.seasons.filter(
      (season) => season.regular.games > 0
    );

    stats.bestSeason = playedSeasons.length
      ? [...playedSeasons].sort(compareBest)[0]
      : null;

    stats.worstSeason = playedSeasons.length
      ? [...playedSeasons].sort(compareWorst)[0]
      : null;

    const rivalEntries = [...stats._opponents.entries()].filter(
      ([opponentId]) => statsByManager.has(opponentId)
    );

    if (rivalEntries.length) {
      const mostFaced = [...rivalEntries].sort((a, b) => {
        if (b[1].games !== a[1].games) return b[1].games - a[1].games;
        return Math.abs(b[1].wins - b[1].losses) -
          Math.abs(a[1].wins - a[1].losses);
      })[0];

      const [opponentId, record] = mostFaced;
      stats.archrival = {
        managerId: opponentId,
        displayName:
          statsByManager.get(opponentId)?.displayName || opponentId,
        ...record,
      };
    }

    stats.toughestMatchup = matchupSummary(
      statsByManager,
      rivalEntries,
      "toughest"
    );
    stats.bestMatchup = matchupSummary(
      statsByManager,
      rivalEntries,
      "best"
    );

    stats.winPct = winPct(stats.regular);
    stats.playoffWinPct = winPct(stats.playoffs);
    stats.pointsPerGame = stats.pointsGames
      ? stats.regular.pointsFor / stats.pointsGames
      : 0;
    stats.primarySeasonCount = stats.seasons.length;

    delete stats._seasonMap;
    delete stats._opponents;
  }

  const managers = [...statsByManager.values()].sort((a, b) => {
    if (b.championships !== a.championships) {
      return b.championships - a.championships;
    }
    if (b.regular.wins !== a.regular.wins) {
      return b.regular.wins - a.regular.wins;
    }
    if (Math.abs(b.winPct - a.winPct) > 1e-9) {
      return b.winPct - a.winPct;
    }
    if (b.regular.pointsFor !== a.regular.pointsFor) {
      return b.regular.pointsFor - a.regular.pointsFor;
    }
    return a.displayName.localeCompare(b.displayName);
  });

  const coOwnerOnlyManagers = almanac.managers.filter(
    (manager) => !eligibleManagerIds.has(manager.managerId)
  );

  return {
    managers,
    coOwnerOnlyManagers,
    latestSeason,
    hasLeagueMedianSeasons: almanac.seasons.some(
      (season) => season.recordFormat?.leagueMedianGameEnabled
    ),
    hasManualHistory: Boolean(almanac.manualHistory?.seasons?.length),
  };
}

export function formatManagerRecord(record) {
  if (!record) return "0-0";
  return record.ties
    ? `${record.wins}-${record.losses}-${record.ties}`
    : `${record.wins}-${record.losses}`;
}

export function formatManagerWinPct(value) {
  if (!Number.isFinite(value)) return ".000";
  return value.toFixed(3).replace(/^0/, "");
}
