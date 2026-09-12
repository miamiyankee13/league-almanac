import { buildManagerMetrics } from "./managerMetrics";
import { buildRivalryMetrics } from "./rivalryMetrics";

function str(value) {
  return value == null ? null : String(value);
}

function asNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function recordText(record) {
  if (!record) return "0-0";
  const wins = asNumber(record.wins);
  const losses = asNumber(record.losses);
  const ties = asNumber(record.ties);

  return ties ? `${wins}-${losses}-${ties}` : `${wins}-${losses}`;
}

function currentRawSeason(rawHistory) {
  const seasons = rawHistory?.seasons || [];
  return seasons.length ? seasons.at(-1) : null;
}

function matchupGroupsForWeek(rawSeason, weekNumber) {
  const week = (rawSeason?.weeks || []).find(
    (entry) => Number(entry.week) === Number(weekNumber)
  );

  if (!week) return [];

  const groups = new Map();

  for (const row of week.matchups || []) {
    if (row?.matchup_id == null || row?.roster_id == null) continue;

    const matchupId = str(row.matchup_id);
    if (!groups.has(matchupId)) groups.set(matchupId, []);
    groups.get(matchupId).push(row);
  }

  return [...groups.entries()]
    .map(([matchupId, rows]) => ({
      matchupId,
      rows: rows
        .filter((row) => row?.roster_id != null)
        .sort((a, b) => Number(a.roster_id) - Number(b.roster_id)),
    }))
    .filter((group) => group.rows.length >= 2)
    .sort((a, b) => Number(a.matchupId) - Number(b.matchupId));
}

function resolveWeek(rawSeason) {
  if (!rawSeason) return null;

  const settings = rawSeason.league?.settings || {};
  const currentLeg = Number(settings.leg || 0);
  const lastScoredLeg = Number(settings.last_scored_leg || 0);
  const preferredWeek = currentLeg > 0 ? currentLeg : Math.max(1, lastScoredLeg + 1);

  if (matchupGroupsForWeek(rawSeason, preferredWeek).length) {
    return preferredWeek;
  }

  const future = (rawSeason.weeks || [])
    .map((entry) => Number(entry.week))
    .filter((week) => Number.isFinite(week) && week >= Math.max(1, lastScoredLeg + 1))
    .sort((a, b) => a - b)
    .find((week) => matchupGroupsForWeek(rawSeason, week).length);

  if (future) return future;

  const available = (rawSeason.weeks || [])
    .map((entry) => Number(entry.week))
    .filter((week) => Number.isFinite(week) && matchupGroupsForWeek(rawSeason, week).length)
    .sort((a, b) => b - a)[0];

  return available || null;
}

function managerName(almanac, managerId) {
  if (!managerId) return "Unresolved";
  return (
    almanac.managers.find((manager) => manager.managerId === managerId)
      ?.displayName || managerId
  );
}

function teamForRoster(almanac, season, rosterId) {
  return almanac.seasonTeams.find(
    (team) =>
      team.season === String(season) &&
      team.rosterId === String(rosterId) &&
      !team.historicalOnly
  );
}

function managerMetricMap(almanac) {
  const metrics = buildManagerMetrics(almanac);
  return new Map(metrics.managers.map((manager) => [manager.managerId, manager]));
}

function rivalryKey(managerAId, managerBId) {
  if (!managerAId || !managerBId) return null;
  return [String(managerAId), String(managerBId)].sort().join("::");
}

function rivalryMap(almanac) {
  const data = buildRivalryMetrics(almanac);
  return new Map(data.rivalries.map((rivalry) => [rivalry.rivalryId, rivalry]));
}

function seriesRecordForManager(rivalry, series, managerId) {
  if (!rivalry || !series || !managerId) {
    return { wins: 0, losses: 0, ties: 0, games: 0 };
  }

  if (managerId === rivalry.managerAId) {
    return {
      wins: asNumber(series.winsA),
      losses: asNumber(series.winsB),
      ties: asNumber(series.ties),
      games: asNumber(series.games),
    };
  }

  if (managerId === rivalry.managerBId) {
    return {
      wins: asNumber(series.winsB),
      losses: asNumber(series.winsA),
      ties: asNumber(series.ties),
      games: asNumber(series.games),
    };
  }

  return { wins: 0, losses: 0, ties: 0, games: 0 };
}

function seriesLabel(rivalry, sideA, sideB, seriesName = "all") {
  const series = rivalry?.[seriesName];

  if (!rivalry || !series?.games) {
    return seriesName === "playoffs" ? "No recorded playoff meetings" : "First recorded meeting";
  }

  const recordA = seriesRecordForManager(rivalry, series, sideA.managerId);
  const recordB = seriesRecordForManager(rivalry, series, sideB.managerId);

  if (recordA.wins === recordB.wins) {
    const ties = recordA.ties ? `-${recordA.ties}` : "";
    return `Tied ${recordA.wins}-${recordB.wins}${ties}`;
  }

  const leader = recordA.wins > recordB.wins ? sideA : sideB;
  const leaderRecord = recordA.wins > recordB.wins ? recordA : recordB;
  const trailerRecord = recordA.wins > recordB.wins ? recordB : recordA;
  const ties = leaderRecord.ties ? `-${leaderRecord.ties}` : "";

  return `${leader.managerName} leads ${leaderRecord.wins}-${trailerRecord.wins}${ties}`;
}

function lastMeetingLabel(rivalry) {
  const meeting = rivalry?.latestMeeting;
  if (!meeting) return "No recorded meeting";

  const stage = meeting.isPlayoff ? ` · ${meeting.stage}` : "";
  const when =
    meeting.week == null
      ? `${meeting.season}${stage}`
      : `${meeting.season} W${meeting.week}${stage}`;

  if (meeting.scoreKnown === false) {
    return meeting.winnerName
      ? `${when} · ${meeting.winnerName} won`
      : `${when} · result recorded`;
  }

  if (!meeting.winnerManagerId) {
    return `${when} · tied ${Number(meeting.pointsA).toFixed(1)}-${Number(
      meeting.pointsB
    ).toFixed(1)}`;
  }

  const winnerIsA = meeting.winnerManagerId === meeting.managerAId;
  const winnerPoints = winnerIsA ? meeting.pointsA : meeting.pointsB;
  const loserPoints = winnerIsA ? meeting.pointsB : meeting.pointsA;

  return `${when} · ${meeting.winnerName} ${Number(winnerPoints).toFixed(
    1
  )}-${Number(loserPoints).toFixed(1)}`;
}

function narrativeFor(matchup, week) {
  const { sideA, sideB, rivalry } = matchup;

  if (!rivalry?.all?.games) {
    const aPct = sideA.seasonPct;
    const bPct = sideB.seasonPct;

    if (Math.abs(aPct - bPct) > 1e-9) {
      const better = aPct > bPct ? sideA : sideB;
      return `First recorded meeting; ${better.managerName} enters Week ${week} with the better season record.`;
    }

    return `First recorded meeting between ${sideA.managerName} and ${sideB.managerName}.`;
  }

  const recordA = seriesRecordForManager(rivalry, rivalry.all, sideA.managerId);
  const recordB = seriesRecordForManager(rivalry, rivalry.all, sideB.managerId);

  const leader =
    recordA.wins === recordB.wins
      ? null
      : recordA.wins > recordB.wins
        ? sideA
        : sideB;

  const leaderRecord =
    leader?.managerId === sideA.managerId ? recordA : recordB;
  const trailerRecord =
    leader?.managerId === sideA.managerId ? recordB : recordA;

  const streak = rivalry.currentStreak;

  if (
    leader &&
    streak?.managerId === leader.managerId &&
    asNumber(streak.count) >= 2
  ) {
    return `${leader.managerName} leads the recorded series ${leaderRecord.wins}-${trailerRecord.wins} and has won ${streak.count} straight.`;
  }

  if (rivalry.playoffs?.games > 0) {
    return `${seriesLabel(
      rivalry,
      sideA,
      sideB,
      "all"
    )}; ${seriesLabel(rivalry, sideA, sideB, "playoffs").toLowerCase()} in the playoffs.`;
  }

  if (leader) {
    const latestWinner = rivalry.latestMeeting?.winnerName;
    if (latestWinner) {
      return `${leader.managerName} leads the recorded series ${leaderRecord.wins}-${trailerRecord.wins}; ${latestWinner} won the last meeting.`;
    }

    return `${leader.managerName} leads the recorded series ${leaderRecord.wins}-${trailerRecord.wins}.`;
  }

  const latestWinner = rivalry.latestMeeting?.winnerName;
  if (latestWinner) {
    return `The recorded series is tied ${recordA.wins}-${recordB.wins}; ${latestWinner} won the last meeting.`;
  }

  return `The recorded series is tied ${recordA.wins}-${recordB.wins}.`;
}

function sideSnapshot(almanac, season, rosterId, managerMetrics) {
  const team = teamForRoster(almanac, season, rosterId);
  const managerId = team?.ownerSnapshot?.primaryManagerId || null;
  const managerMetric = managerId ? managerMetrics.get(managerId) : null;
  const seasonRecord = team?.officialRecordSnapshot || {
    wins: 0,
    losses: 0,
    ties: 0,
  };

  const seasonGames =
    asNumber(seasonRecord.wins) +
    asNumber(seasonRecord.losses) +
    asNumber(seasonRecord.ties);

  const seasonPct = seasonGames
    ? (asNumber(seasonRecord.wins) + asNumber(seasonRecord.ties) * 0.5) /
      seasonGames
    : 0;

  return {
    rosterId: String(rosterId),
    teamName: team?.teamName || `Roster ${rosterId}`,
    managerId,
    managerName: managerName(almanac, managerId),
    seasonRecord: recordText(seasonRecord),
    seasonPct,
    careerRecord: managerMetric ? recordText(managerMetric.regular) : "—",
    championships: asNumber(managerMetric?.championships),
    finals: asNumber(managerMetric?.finals),
    playoffAppearances: asNumber(managerMetric?.playoffAppearances),
  };
}

export function buildWeeklyMatchupStudio(almanac, rawHistory) {
  const rawSeason = currentRawSeason(rawHistory);

  if (!almanac || !rawSeason) {
    return {
      available: false,
      reason: "Load the current Sleeper league before generating a weekly preview.",
      season: null,
      week: null,
      matchups: [],
    };
  }

  const season = String(rawSeason.league?.season || "");
  const week = resolveWeek(rawSeason);

  if (!season || !week) {
    return {
      available: false,
      reason: "No current Sleeper matchup schedule is available.",
      season: season || null,
      week: week || null,
      matchups: [],
    };
  }

  const groups = matchupGroupsForWeek(rawSeason, week);
  const managers = managerMetricMap(almanac);
  const rivalries = rivalryMap(almanac);

  const matchups = groups.map((group, index) => {
    const rowA = group.rows[0];
    const rowB = group.rows[1];

    const sideA = sideSnapshot(almanac, season, rowA.roster_id, managers);
    const sideB = sideSnapshot(almanac, season, rowB.roster_id, managers);

    const key = rivalryKey(sideA.managerId, sideB.managerId);
    const rivalry = key ? rivalries.get(key) || null : null;

    const matchup = {
      matchupId: group.matchupId,
      displayNumber: index + 1,
      sideA,
      sideB,
      rivalry,
      seriesLabel: seriesLabel(rivalry, sideA, sideB, "all"),
      playoffSeriesLabel: seriesLabel(rivalry, sideA, sideB, "playoffs"),
      lastMeetingLabel: lastMeetingLabel(rivalry),
    };

    return {
      ...matchup,
      narrative: narrativeFor(matchup, week),
    };
  });

  return {
    available: matchups.length > 0,
    reason:
      matchups.length > 0
        ? null
        : `No paired Sleeper matchups were found for Week ${week}.`,
    season,
    week,
    leagueName: almanac.leagueSeries?.name || rawSeason.league?.name || "League",
    matchupCount: matchups.length,
    matchups,
  };
}

export { recordText };
