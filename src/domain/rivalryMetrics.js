import { getMeaningfulPlayoffNodes } from "./playoffUtils";

function asNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function blankSeries() {
  return {
    games: 0,
    winsA: 0,
    winsB: 0,
    ties: 0,
    pointsA: 0,
    pointsB: 0,
  };
}

function addToSeries(series, pointsA, pointsB) {
  series.games += 1;
  series.pointsA += pointsA;
  series.pointsB += pointsB;

  if (pointsA > pointsB) series.winsA += 1;
  else if (pointsB > pointsA) series.winsB += 1;
  else series.ties += 1;
}

function pairKey(managerIdA, managerIdB) {
  return [String(managerIdA), String(managerIdB)].sort().join("::");
}

function managerById(almanac, managerId) {
  return almanac.managers.find((manager) => manager.managerId === managerId);
}

function seasonTeamFor(almanac, season, franchiseId) {
  return almanac.seasonTeams.find(
    (team) => team.season === season && team.franchiseId === franchiseId
  );
}

function sideForManager(game, managerId) {
  if (game.teamA.managerId === managerId) return game.teamA;
  if (game.teamB.managerId === managerId) return game.teamB;
  return null;
}

function playoffLabel(node, season) {
  if (Number(node.placement) === 1) return "Championship";
  if (Number(node.placement) === 3) return "Third Place";

  const playoffNodes = season?._winnerNodes || [];
  const maxRound = playoffNodes.length
    ? Math.max(...playoffNodes.map((candidate) => Number(candidate.round || 0)))
    : Number(node.round || 0);

  if (Number(node.round) === maxRound) return "Final Round";
  if (Number(node.round) === maxRound - 1) return "Semifinals";
  if (Number(node.round) === 1) return "Opening Round";
  return `Playoff Round ${node.round}`;
}

function buildPlayablePostseasonMeetings(almanac) {
  const out = [];
  const seenGameIds = new Set();

  for (const season of almanac.seasons) {
    const winnerNodes = almanac.playoffGames.filter(
      (node) =>
        node.season === season.season &&
        node.bracketType === "winners"
    );

    const seasonWithBracket = {
      ...season,
      _winnerNodes: winnerNodes,
    };

    const pathNodes = getMeaningfulPlayoffNodes(
      almanac,
      season.season
    );

    for (const node of pathNodes) {
      if (!node.isResolved) continue;
      if (!season.playoffWeekStart || !node.round) continue;

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
      out.push({
        game,
        stage: playoffLabel(node, seasonWithBracket),
        playoffNode: node,
      });
    }
  }

  return out;
}

function ensurePair(pairs, almanac, managerId1, managerId2) {
  const key = pairKey(managerId1, managerId2);
  if (pairs.has(key)) return pairs.get(key);

  const manager1 = managerById(almanac, managerId1);
  const manager2 = managerById(almanac, managerId2);

  const name1 = manager1?.displayName || managerId1;
  const name2 = manager2?.displayName || managerId2;

  const managerAFirst =
    name1.localeCompare(name2, undefined, { sensitivity: "base" }) <= 0;

  const managerAId = managerAFirst ? managerId1 : managerId2;
  const managerBId = managerAFirst ? managerId2 : managerId1;

  const pair = {
    rivalryId: key,
    managerAId,
    managerBId,
    managerAName:
      managerById(almanac, managerAId)?.displayName || managerAId,
    managerBName:
      managerById(almanac, managerBId)?.displayName || managerBId,

    regular: blankSeries(),
    playoffs: blankSeries(),
    all: blankSeries(),

    meetings: [],
    seasonBreakdown: [],
    closestGame: null,
    biggestBlowout: null,
    highestCombined: null,
    currentStreak: null,
    firstMeeting: null,
    latestMeeting: null,
    averageMargin: 0,
  };

  pairs.set(key, pair);
  return pair;
}

function meetingFromGame(almanac, pair, game, stage) {
  const sideA = sideForManager(game, pair.managerAId);
  const sideB = sideForManager(game, pair.managerBId);

  if (!sideA || !sideB) return null;

  const pointsA = asNumber(sideA.points);
  const pointsB = asNumber(sideB.points);

  const winnerManagerId =
    pointsA > pointsB
      ? pair.managerAId
      : pointsB > pointsA
        ? pair.managerBId
        : null;

  const winnerName =
    winnerManagerId === pair.managerAId
      ? pair.managerAName
      : winnerManagerId === pair.managerBId
        ? pair.managerBName
        : null;

  return {
    meetingId: `${game.gameId}:${stage}`,
    gameId: game.gameId,
    season: game.season,
    week: Number(game.week),
    stage,
    isPlayoff: stage !== "Regular Season",

    managerAId: pair.managerAId,
    managerBId: pair.managerBId,
    managerAName: pair.managerAName,
    managerBName: pair.managerBName,

    pointsA,
    pointsB,
    margin: Math.abs(pointsA - pointsB),
    combinedPoints: pointsA + pointsB,

    winnerManagerId,
    winnerName,
    loserManagerId:
      winnerManagerId == null
        ? null
        : winnerManagerId === pair.managerAId
          ? pair.managerBId
          : pair.managerAId,

    teamAName:
      seasonTeamFor(almanac, game.season, sideA.franchiseId)?.teamName ||
      `Roster ${sideA.rosterId}`,
    teamBName:
      seasonTeamFor(almanac, game.season, sideB.franchiseId)?.teamName ||
      `Roster ${sideB.rosterId}`,
  };
}

function addMeeting(pair, meeting) {
  if (!meeting) return;

  pair.meetings.push(meeting);

  addToSeries(pair.all, meeting.pointsA, meeting.pointsB);

  if (meeting.isPlayoff) {
    addToSeries(pair.playoffs, meeting.pointsA, meeting.pointsB);
  } else {
    addToSeries(pair.regular, meeting.pointsA, meeting.pointsB);
  }
}

function chronological(a, b) {
  if (Number(a.season) !== Number(b.season)) {
    return Number(a.season) - Number(b.season);
  }

  if (Number(a.week) !== Number(b.week)) {
    return Number(a.week) - Number(b.week);
  }

  if (a.isPlayoff !== b.isPlayoff) return a.isPlayoff ? 1 : -1;
  return a.stage.localeCompare(b.stage);
}

function buildCurrentStreak(pair) {
  const meetings = [...pair.meetings].sort(chronological);
  if (!meetings.length) return null;

  const latest = meetings.at(-1);

  if (!latest.winnerManagerId) {
    return {
      managerId: null,
      managerName: null,
      count: 0,
      tiedLatest: true,
      label: "Last meeting tied",
    };
  }

  let count = 0;

  for (let index = meetings.length - 1; index >= 0; index -= 1) {
    const meeting = meetings[index];
    if (meeting.winnerManagerId !== latest.winnerManagerId) break;
    count += 1;
  }

  return {
    managerId: latest.winnerManagerId,
    managerName:
      latest.winnerManagerId === pair.managerAId
        ? pair.managerAName
        : pair.managerBName,
    count,
    tiedLatest: false,
    label: `${
      latest.winnerManagerId === pair.managerAId
        ? pair.managerAName
        : pair.managerBName
    } W${count}`,
  };
}

function seriesForSeason(pair, meetings, playoff) {
  const series = blankSeries();

  for (const meeting of meetings) {
    if (Boolean(meeting.isPlayoff) !== Boolean(playoff)) continue;
    addToSeries(series, meeting.pointsA, meeting.pointsB);
  }

  return series;
}

function finalizePair(pair) {
  pair.meetings.sort(chronological);

  pair.firstMeeting = pair.meetings[0] || null;
  pair.latestMeeting = pair.meetings.at(-1) || null;

  if (pair.meetings.length) {
    pair.closestGame = [...pair.meetings].sort(
      (a, b) => a.margin - b.margin || b.combinedPoints - a.combinedPoints
    )[0];

    pair.biggestBlowout = [...pair.meetings].sort(
      (a, b) => b.margin - a.margin || b.combinedPoints - a.combinedPoints
    )[0];

    pair.highestCombined = [...pair.meetings].sort(
      (a, b) =>
        b.combinedPoints - a.combinedPoints || b.margin - a.margin
    )[0];

    pair.averageMargin =
      pair.meetings.reduce((sum, meeting) => sum + meeting.margin, 0) /
      pair.meetings.length;
  }

  pair.currentStreak = buildCurrentStreak(pair);

  const seasons = [...new Set(pair.meetings.map((meeting) => meeting.season))]
    .sort((a, b) => Number(b) - Number(a));

  pair.seasonBreakdown = seasons.map((season) => {
    const meetings = pair.meetings.filter(
      (meeting) => meeting.season === season
    );

    return {
      season,
      meetings: meetings.length,
      regular: seriesForSeason(pair, meetings, false),
      playoffs: seriesForSeason(pair, meetings, true),
      pointsA: meetings.reduce((sum, meeting) => sum + meeting.pointsA, 0),
      pointsB: meetings.reduce((sum, meeting) => sum + meeting.pointsB, 0),
    };
  });

  return pair;
}

function seriesDifferential(series) {
  return Math.abs(series.winsA - series.winsB);
}

function tightnessScore(pair) {
  if (!pair.all.games) return Number.POSITIVE_INFINITY;

  const winBalance =
    seriesDifferential(pair.all) / Math.max(1, pair.all.games);

  return winBalance * 1000 + pair.averageMargin;
}

export function buildRivalryMetrics(almanac) {
  const eligibleManagerIds = new Set(
    almanac.managerTenures
      .filter((tenure) =>
        ["primary", "incoming_owner"].includes(tenure.role)
      )
      .map((tenure) => tenure.managerId)
      .filter(Boolean)
  );

  const pairs = new Map();
  let unattributedRegularGames = 0;

  for (const game of almanac.games) {
    if (game.phase !== "regular_season") continue;

    const managerIdA = game.teamA.managerId;
    const managerIdB = game.teamB.managerId;

    if (
      !managerIdA ||
      !managerIdB ||
      !eligibleManagerIds.has(managerIdA) ||
      !eligibleManagerIds.has(managerIdB)
    ) {
      unattributedRegularGames += 1;
      continue;
    }

    if (managerIdA === managerIdB) continue;

    const pair = ensurePair(pairs, almanac, managerIdA, managerIdB);
    addMeeting(
      pair,
      meetingFromGame(almanac, pair, game, "Regular Season")
    );
  }

  let unattributedPlayoffGames = 0;

  for (const entry of buildPlayablePostseasonMeetings(almanac)) {
    const { game, stage } = entry;

    const managerIdA = game.teamA.managerId;
    const managerIdB = game.teamB.managerId;

    if (
      !managerIdA ||
      !managerIdB ||
      !eligibleManagerIds.has(managerIdA) ||
      !eligibleManagerIds.has(managerIdB)
    ) {
      unattributedPlayoffGames += 1;
      continue;
    }

    if (managerIdA === managerIdB) continue;

    const pair = ensurePair(pairs, almanac, managerIdA, managerIdB);
    addMeeting(pair, meetingFromGame(almanac, pair, game, stage));
  }

  const rivalries = [...pairs.values()]
    .map(finalizePair)
    .sort((a, b) => {
      if (b.all.games !== a.all.games) return b.all.games - a.all.games;
      if (b.playoffs.games !== a.playoffs.games) {
        return b.playoffs.games - a.playoffs.games;
      }
      if (a.averageMargin !== b.averageMargin) {
        return a.averageMargin - b.averageMargin;
      }
      return `${a.managerAName}${a.managerBName}`.localeCompare(
        `${b.managerAName}${b.managerBName}`
      );
    });

  const mostMeetings = rivalries[0] || null;

  const closestCandidates = rivalries.filter(
    (pair) => pair.all.games >= 3
  );
  const closestSeries = (
    closestCandidates.length ? closestCandidates : rivalries
  )
    .slice()
    .sort((a, b) => {
      const scoreDiff = tightnessScore(a) - tightnessScore(b);
      if (Math.abs(scoreDiff) > 1e-9) return scoreDiff;
      return b.all.games - a.all.games;
    })[0] || null;

  const mostPlayoffMeetings =
    rivalries
      .filter((pair) => pair.playoffs.games > 0)
      .slice()
      .sort((a, b) => {
        if (b.playoffs.games !== a.playoffs.games) {
          return b.playoffs.games - a.playoffs.games;
        }
        return b.all.games - a.all.games;
      })[0] || null;

  return {
    rivalries,
    mostMeetings,
    closestSeries,
    mostPlayoffMeetings,
    unattributedRegularGames,
    unattributedPlayoffGames,
    hasLeagueMedianSeasons: almanac.seasons.some(
      (season) => season.recordFormat?.leagueMedianGameEnabled
    ),
  };
}

export function recordForManager(pair, series, managerId) {
  if (!pair || !series || !managerId) {
    return { wins: 0, losses: 0, ties: 0, games: 0 };
  }

  const managerIsA = managerId === pair.managerAId;

  return {
    wins: managerIsA ? series.winsA : series.winsB,
    losses: managerIsA ? series.winsB : series.winsA,
    ties: series.ties,
    games: series.games,
  };
}

export function formatRivalryRecord(record) {
  if (!record) return "0-0";
  return record.ties
    ? `${record.wins}-${record.losses}-${record.ties}`
    : `${record.wins}-${record.losses}`;
}

export function seriesLeaderLabel(pair, series) {
  if (!pair || !series || !series.games) return "No meetings";

  if (series.winsA === series.winsB) {
    return series.ties
      ? `Tied ${series.winsA}-${series.winsB}-${series.ties}`
      : `Tied ${series.winsA}-${series.winsB}`;
  }

  const leaderIsA = series.winsA > series.winsB;
  const leaderName = leaderIsA ? pair.managerAName : pair.managerBName;
  const wins = leaderIsA ? series.winsA : series.winsB;
  const losses = leaderIsA ? series.winsB : series.winsA;

  return series.ties
    ? `${leaderName} leads ${wins}-${losses}-${series.ties}`
    : `${leaderName} leads ${wins}-${losses}`;
}
