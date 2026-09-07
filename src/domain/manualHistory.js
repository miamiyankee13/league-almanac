const FINISHES = new Set(["Champion", "Runner-up", "3rd Place"]);

function str(value) {
  return value == null ? null : String(value);
}

function nullableNumber(value) {
  if (value === "" || value == null) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function manualSource(note = "Commissioner entered historical league data.") {
  return {
    type: "manual",
    confidence: 1,
    note,
  };
}

function normalizedManager(manager) {
  const managerId = str(manager?.managerId);
  const displayName = String(manager?.displayName || "").trim();
  if (!managerId || !displayName) return null;

  return {
    managerId,
    displayName,
    aliases: Array.isArray(manager?.aliases)
      ? [...new Set(manager.aliases.map(String).filter(Boolean))]
      : [],
  };
}

function normalizedTeam(team, index, season) {
  const manualTeamId =
    str(team?.manualTeamId) || `manual-team:${season}:${index + 1}`;

  const wins = nullableNumber(team?.wins);
  const losses = nullableNumber(team?.losses);
  const ties = nullableNumber(team?.ties);

  return {
    manualTeamId,
    rank: nullableNumber(team?.rank) ?? index + 1,
    teamName: String(team?.teamName || "").trim(),
    managerId: str(team?.managerId),
    wins,
    losses,
    ties: ties ?? 0,
    finish: FINISHES.has(team?.finish) ? team.finish : null,
  };
}

function normalizedSeason(season, index) {
  const year = String(season?.season || "").trim();
  if (!year) return null;

  const playoffFieldSize = nullableNumber(season?.playoffFieldSize);

  return {
    manualSeasonId:
      str(season?.manualSeasonId) || `manual-season:${year}:${index + 1}`,
    season: year,
    platform: String(season?.platform || "ESPN").trim() || "ESPN",
    note: String(season?.note || "").trim(),
    playoffFieldSize:
      playoffFieldSize != null && playoffFieldSize > 0
        ? Math.floor(playoffFieldSize)
        : null,
    teams: Array.isArray(season?.teams)
      ? season.teams.map((team, teamIndex) => normalizedTeam(team, teamIndex, year))
      : [],
  };
}

export function normalizeManualHistory(manualHistory) {
  const managers = Array.isArray(manualHistory?.managers)
    ? manualHistory.managers.map(normalizedManager).filter(Boolean)
    : [];

  const seasons = Array.isArray(manualHistory?.seasons)
    ? manualHistory.seasons.map(normalizedSeason).filter(Boolean)
    : [];

  return {
    version: 2,
    managers,
    seasons,
  };
}

function teamRecord(team) {
  const wins = nullableNumber(team.wins);
  const losses = nullableNumber(team.losses);
  const ties = nullableNumber(team.ties) ?? 0;
  const recordKnown = wins != null && losses != null;

  return {
    wins: recordKnown ? wins : 0,
    losses: recordKnown ? losses : 0,
    ties: recordKnown ? ties : 0,
    pointsFor: null,
    pointsAgainst: null,
    mayIncludeLeagueMedianResult: false,
    recordKnown,
  };
}

function manualManagerRows(history, existingIds) {
  return history.managers
    .filter((manager) => !existingIds.has(manager.managerId))
    .map((manager) => ({
      managerId: manager.managerId,
      sleeperUserId: null,
      displayName: manager.displayName,
      avatar: null,
      aliases: manager.aliases || [],
      historicalOnly: true,
      provenance: manualSource(
        "Historical manager created in the Almanac commissioner layer."
      ),
    }));
}

function seasonCoverageNote(platform) {
  return `${platform} season entered by the commissioner from season-level history. Weekly matchup and scoring coverage is unavailable unless a specific known postseason result is explicitly represented.`;
}

function knownPlayoffAppearance(team, playoffFieldSize) {
  if (FINISHES.has(team.manualFinish)) return true;
  if (!playoffFieldSize) return false;
  return Number(team.historicalRank || Number.POSITIVE_INFINITY) <= playoffFieldSize;
}

function opponentUnknownPlayoffRecord(team, hasSemifinalRound) {
  const finish = team.manualFinish;

  // These are only the additional postseason outcomes the finish itself proves
  // beyond any exact opponent-specific game represented elsewhere.
  //
  // Championship / runner-up:
  // - the exact championship result is stored in manualPlayoffGames
  // - when a semifinal round is known to have existed, both finalists had to
  //   win at least one prior playoff game to reach the final
  //
  // 3rd Place:
  // - the manager had to lose the semifinal and win the 3rd-place game
  // - the opponent(s) are unknown, so these outcomes affect manager W/L only
  if (finish === "Champion" && hasSemifinalRound) {
    return { wins: 1, losses: 0, ties: 0, games: 1 };
  }

  if (finish === "Runner-up" && hasSemifinalRound) {
    return { wins: 1, losses: 0, ties: 0, games: 1 };
  }

  if (finish === "3rd Place") {
    return { wins: 1, losses: 1, ties: 0, games: 2 };
  }

  return null;
}

function manualChampionshipGame(manualSeason, champion, runnerUp) {
  if (!champion || !runnerUp) return null;

  const platform = manualSeason.platform || "Historical";

  return {
    manualPlayoffGameId: `${manualSeason.season}:manual-championship`,
    gameId: `${manualSeason.season}:manual-championship`,
    season: manualSeason.season,
    stage: "Championship",
    playoffType: "championship",
    scoreKnown: false,
    historicalOnly: true,
    sourcePlatform: platform,
    winner: {
      rosterId: champion.rosterId,
      franchiseId: champion.franchiseId,
      managerId: champion.ownerSnapshot.primaryManagerId,
      teamName: champion.teamName,
    },
    loser: {
      rosterId: runnerUp.rosterId,
      franchiseId: runnerUp.franchiseId,
      managerId: runnerUp.ownerSnapshot.primaryManagerId,
      teamName: runnerUp.teamName,
    },
    provenance: manualSource(
      `${platform} champion and runner-up prove the championship participants and winner; the final score and earlier playoff rounds remain unknown.`
    ),
  };
}

export function applyManualHistory(almanac, manualHistory) {
  if (!almanac) return almanac;

  const history = normalizeManualHistory(manualHistory);
  const sleeperSeasonIds = new Set(almanac.seasons.map((season) => season.season));
  const earliestSleeperSeason = almanac.seasons.length
    ? Math.min(...almanac.seasons.map((season) => Number(season.season)))
    : Number.POSITIVE_INFINITY;
  const manualSeasons = history.seasons.filter(
    (season) =>
      !sleeperSeasonIds.has(season.season) &&
      Number(season.season) < earliestSleeperSeason
  );

  const existingManagerIds = new Set(
    almanac.managers.map((manager) => manager.managerId)
  );
  const addedManagers = manualManagerRows(history, existingManagerIds);
  const allManagerIds = new Set([
    ...existingManagerIds,
    ...addedManagers.map((manager) => manager.managerId),
  ]);

  const seasonRows = [];
  const teamRows = [];
  const tenureRows = [];
  const championRows = [];
  const manualPlayoffGames = [];

  for (const manualSeason of manualSeasons) {
    const platform = manualSeason.platform || "Historical";
    const playoffFieldSize = manualSeason.playoffFieldSize
      ? Math.min(manualSeason.playoffFieldSize, manualSeason.teams.length)
      : null;
    const hasSemifinalRound = Boolean(
      (playoffFieldSize && playoffFieldSize >= 4) ||
        manualSeason.teams.some((team) => team.finish === "3rd Place")
    );

    seasonRows.push({
      seasonId: `${almanac.leagueSeries.leagueSeriesId}:manual-season:${manualSeason.season}`,
      leagueSeriesId: almanac.leagueSeries.leagueSeriesId,
      season: manualSeason.season,
      sleeperLeagueId: null,
      status: "complete",
      playoffWeekStart: null,
      lastScoredLeg: 0,
      sourcePlatform: platform,
      historicalNote: manualSeason.note || null,
      historicalOnly: true,
      hasMatchupData: false,
      playoffFieldSize,
      recordFormat: {
        leagueMedianGameEnabled: false,
        headToHeadGamesStoredSeparately: true,
        note: seasonCoverageNote(platform),
      },
      provenance: manualSource(seasonCoverageNote(platform)),
    });

    const seasonTeamRows = manualSeason.teams.map((team, index) => {
      const manualTeamId =
        team.manualTeamId || `manual-team:${manualSeason.season}:${index + 1}`;
      const franchiseId = `${almanac.leagueSeries.leagueSeriesId}:manual-franchise:${manualSeason.season}:${manualTeamId}`;
      const rosterId = `manual:${manualSeason.season}:${manualTeamId}`;
      const managerId = allManagerIds.has(team.managerId) ? team.managerId : null;
      const officialRecordSnapshot = teamRecord(team);

      const row = {
        seasonTeamId: `${manualSeason.season}:${manualTeamId}`,
        season: manualSeason.season,
        sleeperLeagueId: null,
        rosterId,
        franchiseId,
        teamName: team.teamName || `Historical Team ${index + 1}`,
        teamNameSource: "commissioner_entered",
        historicalRank: Number(team.rank || index + 1),
        manualFinish: team.finish || null,
        sourcePlatform: platform,
        historicalNote: manualSeason.note || null,
        historicalOnly: true,
        hasMatchupData: false,
        recordKnown: officialRecordSnapshot.recordKnown,
        pointsKnown: false,
        ownerSnapshot: {
          primaryManagerId: managerId,
          coManagerIds: [],
        },
        officialRecordSnapshot,
        managerAttributionStatus: managerId
          ? "commissioner_mapped"
          : "manual_unresolved",
        provenance: manualSource(
          `${platform} season team and standings entered by the commissioner.`
        ),
      };

      row.manualPlayoffAppearance = knownPlayoffAppearance(row, playoffFieldSize);
      row.manualOpponentUnknownPlayoffRecord = opponentUnknownPlayoffRecord(
        row,
        hasSemifinalRound
      );

      if (managerId) {
        tenureRows.push({
          tenureId: `${row.seasonTeamId}:manual-primary`,
          season: row.season,
          franchiseId: row.franchiseId,
          managerId,
          role: "primary",
          startWeek: null,
          endWeek: null,
          status: "commissioner_entered",
          historicalOnly: true,
          provenance: manualSource(
            "Historical season ownership mapped by the commissioner."
          ),
        });
      }

      return row;
    });

    teamRows.push(...seasonTeamRows);

    const champion = seasonTeamRows.find(
      (team) => team.manualFinish === "Champion"
    );
    const runnerUp = seasonTeamRows.find(
      (team) => team.manualFinish === "Runner-up"
    );

    if (champion) {
      championRows.push({
        championId: `${manualSeason.season}:manual-champion`,
        season: manualSeason.season,
        winner: {
          rosterId: champion.rosterId,
          franchiseId: champion.franchiseId,
          managerId: champion.ownerSnapshot.primaryManagerId,
          teamName: champion.teamName,
          points: null,
        },
        runnerUp: runnerUp
          ? {
              rosterId: runnerUp.rosterId,
              franchiseId: runnerUp.franchiseId,
              managerId: runnerUp.ownerSnapshot.primaryManagerId,
              teamName: runnerUp.teamName,
              points: null,
            }
          : {
              rosterId: null,
              franchiseId: null,
              managerId: null,
              teamName: "Runner-up unresolved",
              points: null,
            },
        sourcePlatform: platform,
        historicalOnly: true,
        provenance: manualSource(
          `${platform} championship finish entered by the commissioner.`
        ),
      });
    }

    const knownFinal = manualChampionshipGame(manualSeason, champion, runnerUp);
    if (knownFinal) manualPlayoffGames.push(knownFinal);
  }

  const seasons = [...almanac.seasons, ...seasonRows].sort(
    (a, b) => Number(a.season) - Number(b.season)
  );

  // Hall of Champions should keep the same newest-first presentation used by
  // the Sleeper-only Almanac, even after older manual seasons are added.
  const champions = [...almanac.champions, ...championRows].sort(
    (a, b) => Number(b.season) - Number(a.season)
  );

  const knownPlayoffAppearanceCount = teamRows.filter(
    (team) => team.manualPlayoffAppearance
  ).length;
  const mappedKnownFinalCount = manualPlayoffGames.filter(
    (game) => game.winner.managerId && game.loser.managerId
  ).length;
  const mappedOpponentUnknownOutcomeCount = teamRows.reduce((sum, team) => {
    if (!team.ownerSnapshot?.primaryManagerId) return sum;
    return sum + Number(team.manualOpponentUnknownPlayoffRecord?.games || 0);
  }, 0);

  return {
    ...almanac,
    managers: [...almanac.managers, ...addedManagers],
    seasons,
    seasonTeams: [...almanac.seasonTeams, ...teamRows],
    managerTenures: [...almanac.managerTenures, ...tenureRows],
    champions,
    manualPlayoffGames,
    manualHistory: {
      ...history,
      seasons: manualSeasons,
    },
    manualHistoryCoverage: {
      seasonCount: manualSeasons.length,
      historicalManagerCount: addedManagers.length,
      regularSeasonRecords: true,
      podiumFinishes: true,
      playoffAppearances: knownPlayoffAppearanceCount > 0,
      knownPlayoffMeetings: manualPlayoffGames.length > 0,
      mappedKnownPlayoffMeetings: mappedKnownFinalCount,
      opponentUnknownPlayoffOutcomes: mappedOpponentUnknownOutcomeCount,
      weeklyMatchups: false,
      weeklyScores: false,
      rivalryHeadToHead: mappedKnownFinalCount > 0,
      playoffWinLoss:
        mappedKnownFinalCount > 0 || mappedOpponentUnknownOutcomeCount > 0,
      pointsBasedRecords: false,
      completePreSleeperRivalryCoverage: false,
      completePreSleeperPlayoffBracketCoverage: false,
    },
  };
}

export function isManualSeason(season) {
  return season?.historicalOnly === true || season?.provenance?.type === "manual";
}
