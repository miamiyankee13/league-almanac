import { attachOwnershipEvidence } from "./ownershipEvidence";

function str(value) {
  return value == null ? null : String(value);
}

function source(kind = "sleeper", confidence = 1, note = null) {
  return { type: kind, confidence, note };
}

function userName(user) {
  return user?.display_name || user?.username || `User ${user?.user_id ?? "?"}`;
}

function explicitTeamName(roster, usersById) {
  const user = usersById.get(str(roster?.owner_id));

  return (
    user?.metadata?.team_name ||
    roster?.metadata?.team_name ||
    (user ? userName(user) : null) ||
    null
  );
}

function isPlayedMatchupRow(row, week, league) {
  const lastScoredLeg = Number(league?.settings?.last_scored_leg ?? 0);

  return Number(week) <= lastScoredLeg && row?.matchup_id != null;
}

function gameId(season, week, matchupId) {
  return `${season}:w${week}:m${matchupId}`;
}

function leagueSeriesIdFrom(rawSeasons) {
  const newest = rawSeasons[rawSeasons.length - 1];
  return `sleeper-series:${newest.league.league_id}`;
}

function buildManagers(rawSeasons) {
  const map = new Map();

  for (const season of rawSeasons) {
    for (const user of season.users || []) {
      const id = str(user.user_id);
      if (!id) continue;

      const existing = map.get(id);
      map.set(id, {
        managerId: id,
        sleeperUserId: id,
        displayName: userName(user),
        avatar: user.avatar ?? existing?.avatar ?? null,
        aliases: [...new Set([...(existing?.aliases || []), userName(user)])],
        provenance: source(),
      });
    }

    // Archived transaction creators may belong to managers who are no longer
    // present in the season's current users list. Preserve them as identities.
    for (const week of season.weeks || []) {
      for (const tx of week.transactions || []) {
        const id = str(tx.creator);
        if (!id || map.has(id)) continue;

        map.set(id, {
          managerId: id,
          sleeperUserId: id,
          displayName: `Sleeper user ${id}`,
          avatar: null,
          aliases: [],
          provenance: source(
            "inferred",
            0.8,
            "Manager identity recovered from archived transaction creator ID."
          ),
        });
      }
    }

    for (const draftEntry of season.drafts || []) {
      for (const pick of draftEntry.picks || []) {
        const id = str(pick.picked_by);
        if (!id || map.has(id)) continue;

        map.set(id, {
          managerId: id,
          sleeperUserId: id,
          displayName: `Sleeper user ${id}`,
          avatar: null,
          aliases: [],
          provenance: source(
            "inferred",
            0.8,
            "Manager identity recovered from historical draft pick."
          ),
        });
      }
    }
  }

  return [...map.values()];
}

function buildFranchises(rawSeasons, leagueSeriesId) {
  const rosterIds = new Set();

  for (const season of rawSeasons) {
    for (const roster of season.rosters || []) {
      if (roster?.roster_id != null) rosterIds.add(str(roster.roster_id));
    }
  }

  return [...rosterIds]
    .sort((a, b) => Number(a) - Number(b))
    .map((rosterId) => ({
      franchiseId: `${leagueSeriesId}:franchise:${rosterId}`,
      leagueSeriesId,
      sleeperRosterLineage: rosterId,
      provenance: source(
        "inferred",
        0.95,
        "Uses persistent roster_id lineage across renewed Sleeper seasons."
      ),
    }));
}

function buildOwnershipReview(rawSeasons, leagueSeriesId) {
  const issues = [];

  for (let i = 1; i < rawSeasons.length; i += 1) {
    const previous = rawSeasons[i - 1];
    const current = rawSeasons[i];

    const prevByRoster = new Map(
      (previous.rosters || []).map((r) => [str(r.roster_id), r])
    );

    for (const roster of current.rosters || []) {
      const rosterId = str(roster.roster_id);
      const prev = prevByRoster.get(rosterId);
      if (!prev) continue;

      const previousOwner = str(prev.owner_id);
      const currentOwner = str(roster.owner_id);

      if (previousOwner && currentOwner && previousOwner !== currentOwner) {
        issues.push({
          ownershipIssueId: `${current.league.season}:roster:${rosterId}`,
          changeType: "owner_change",
          season: str(current.league.season),
          franchiseId: `${leagueSeriesId}:franchise:${rosterId}`,
          rosterId,
          previousManagerId: previousOwner,
          currentManagerId: currentOwner,
          status: "needs_review",
          effectiveWeek: null,
          evidence: {
            previousSeason: str(previous.league.season),
            currentSeason: str(current.league.season),
          },
          provenance: source(
            "inferred",
            0.8,
            "Owner differs from the prior renewed season. Sleeper's current roster snapshot does not prove when the historical handoff occurred."
          ),
        });
      } else if (previousOwner && !currentOwner) {
        issues.push({
          ownershipIssueId: `${current.league.season}:roster:${rosterId}`,
          changeType: "vacated_roster",
          season: str(current.league.season),
          franchiseId: `${leagueSeriesId}:franchise:${rosterId}`,
          rosterId,
          previousManagerId: previousOwner,
          currentManagerId: null,
          status: "needs_review",
          effectiveWeek: null,
          evidence: {
            previousSeason: str(previous.league.season),
            currentSeason: str(current.league.season),
          },
          provenance: source(
            "inferred",
            0.8,
            "The prior-season owner disappeared from the renewed roster and the current historical season ended with no owner. The vacancy start must be reconciled so earlier games can still be credited correctly."
          ),
        });
      } else if (!previousOwner && currentOwner) {
        const lastScoredLeg = Number(
          current.league?.settings?.last_scored_leg ?? 0
        );

        // A vacancy filled before any games have been scored does not create
        // ambiguous historical game attribution. Once games exist, however,
        // we need to confirm whether the new owner started Week 1 or later.
        if (lastScoredLeg > 0) {
          issues.push({
            ownershipIssueId: `${current.league.season}:roster:${rosterId}`,
            changeType: "filled_vacancy",
            season: str(current.league.season),
            franchiseId: `${leagueSeriesId}:franchise:${rosterId}`,
            rosterId,
            previousManagerId: null,
            currentManagerId: currentOwner,
            status: "needs_review",
            effectiveWeek: null,
            evidence: {
              previousSeason: str(previous.league.season),
              currentSeason: str(current.league.season),
            },
            provenance: source(
              "inferred",
              0.7,
              "The prior season ended with a vacant roster and the current season has an owner after games were scored. The new owner's effective start week must be reconciled."
            ),
          });
        }
      }
    }
  }

  return attachOwnershipEvidence(rawSeasons, issues);
}

function mergeOwnershipOverrides(issues, ownershipOverrides) {
  return issues.map((issue) => {
    const decision = ownershipOverrides?.[issue.ownershipIssueId] || null;

    if (!decision) return issue;

    return {
      ...issue,
      status: "resolved",
      effectiveWeek: Number(decision.effectiveWeek),
      commissionerDecision: decision,
      provenance: source(
        "manual",
        1,
        "Ownership handoff timing confirmed in the Almanac commissioner layer."
      ),
    };
  });
}

function buildSeasons(rawSeasons, leagueSeriesId) {
  return rawSeasons.map((s) => {
    const leagueMedianGameEnabled =
      Number(s.league?.settings?.league_average_match ?? 0) === 1;

    return {
      seasonId: `${leagueSeriesId}:season:${s.league.season}`,
      leagueSeriesId,
      season: str(s.league.season),
      sleeperLeagueId: str(s.league.league_id),
      status: s.league.status ?? null,
      playoffWeekStart:
        Number(s.league?.settings?.playoff_week_start ?? 0) || null,
      lastScoredLeg:
        Number(s.league?.settings?.last_scored_leg ?? 0) || 0,

      recordFormat: {
        leagueMedianGameEnabled,
        headToHeadGamesStoredSeparately: true,
        note: leagueMedianGameEnabled
          ? "Sleeper season uses an extra game against the league median. H2H game history must remain separate from official standings W/L."
          : null,
      },

      provenance: source(),
    };
  });
}

function rosterOfficialRecord(roster, leagueMedianGameEnabled) {
  const settings = roster?.settings || {};

  const pointsFor =
    Number(settings.fpts ?? 0) +
    Number(settings.fpts_decimal ?? 0) / 100;

  const pointsAgainst =
    settings.fpts_against == null
      ? null
      : Number(settings.fpts_against ?? 0) +
        Number(settings.fpts_against_decimal ?? 0) / 100;

  return {
    wins: Number(settings.wins ?? 0),
    losses: Number(settings.losses ?? 0),
    ties: Number(settings.ties ?? 0),
    pointsFor,
    pointsAgainst,
    mayIncludeLeagueMedianResult: leagueMedianGameEnabled,
  };
}

function buildSeasonTeams(
  rawSeasons,
  leagueSeriesId,
  ownershipIssues
) {
  const issueByKey = new Map(
    ownershipIssues.map((x) => [`${x.season}:${x.rosterId}`, x])
  );

  const rows = [];
  const latestKnownTeamNameByRosterId = new Map();

  for (const season of rawSeasons) {
    const seasonYear = str(season.league.season);
    const usersById = new Map(
      (season.users || []).map((u) => [str(u.user_id), u])
    );

    const leagueMedianGameEnabled =
      Number(season.league?.settings?.league_average_match ?? 0) === 1;

    for (const roster of season.rosters || []) {
      const rosterId = str(roster.roster_id);
      const issue = issueByKey.get(`${seasonYear}:${rosterId}`);

      const currentExplicitName = explicitTeamName(roster, usersById);
      const inheritedName = latestKnownTeamNameByRosterId.get(rosterId) || null;

      const resolvedTeamName =
        currentExplicitName ||
        inheritedName ||
        `Roster ${roster?.roster_id ?? "?"}`;

      rows.push({
        seasonTeamId: `${seasonYear}:roster:${rosterId}`,
        season: seasonYear,
        sleeperLeagueId: str(season.league.league_id),
        rosterId,
        franchiseId: `${leagueSeriesId}:franchise:${rosterId}`,
        teamName: resolvedTeamName,
        teamNameSource: currentExplicitName
          ? "season_snapshot"
          : inheritedName
            ? "prior_season_fallback"
            : "roster_fallback",

        ownerSnapshot: {
          primaryManagerId: str(roster.owner_id),
          coManagerIds: Array.isArray(roster.co_owners)
            ? roster.co_owners.map(str).filter(Boolean)
            : [],
        },

        officialRecordSnapshot: rosterOfficialRecord(
          roster,
          leagueMedianGameEnabled
        ),

        managerAttributionStatus: issue
          ? issue.status
          : "season_snapshot_accepted",

        provenance: currentExplicitName
          ? source()
          : inheritedName
            ? source(
                "inferred",
                0.95,
                "Team name inherited from the most recent prior season for this roster because the current historical season snapshot had no owner/team name."
              )
            : source(),
      });

      latestKnownTeamNameByRosterId.set(rosterId, resolvedTeamName);
    }
  }

  return rows;
}

function buildManagerTenures(seasonTeams, ownershipIssues, seasons) {
  const issueByKey = new Map(
    ownershipIssues.map((x) => [`${x.season}:${x.rosterId}`, x])
  );

  const seasonByYear = new Map(seasons.map((s) => [s.season, s]));
  const tenures = [];

  for (const team of seasonTeams) {
    const issue = issueByKey.get(`${team.season}:${team.rosterId}`);
    const season = seasonByYear.get(team.season);
    const lastScoredLeg = Number(season?.lastScoredLeg || 0);

    if (!issue) {
      if (team.ownerSnapshot.primaryManagerId) {
        tenures.push({
          tenureId: `${team.seasonTeamId}:primary`,
          season: team.season,
          franchiseId: team.franchiseId,
          managerId: team.ownerSnapshot.primaryManagerId,
          role: "primary",
          startWeek: 1,
          endWeek: lastScoredLeg || null,
          status: "accepted",
          provenance: source(),
        });
      }
    } else if (issue.status === "resolved") {
      const effectiveWeek = Number(issue.effectiveWeek);
      const previousEndWeek = effectiveWeek - 1;

      if (issue.previousManagerId && previousEndWeek >= 1) {
        tenures.push({
          tenureId: `${team.seasonTeamId}:primary:previous`,
          season: team.season,
          franchiseId: team.franchiseId,
          managerId: issue.previousManagerId,
          role: "primary",
          startWeek: 1,
          endWeek: Math.min(previousEndWeek, lastScoredLeg || previousEndWeek),
          status: "commissioner_confirmed",
          provenance: source(
            "manual",
            1,
            "Manager tenure created from commissioner-confirmed ownership reconciliation."
          ),
        });
      }

      if (issue.currentManagerId && (!lastScoredLeg || effectiveWeek <= lastScoredLeg)) {
        tenures.push({
          tenureId: `${team.seasonTeamId}:primary:current`,
          season: team.season,
          franchiseId: team.franchiseId,
          managerId: issue.currentManagerId,
          role: "primary",
          startWeek: effectiveWeek,
          endWeek: lastScoredLeg || null,
          status: "commissioner_confirmed",
          provenance: source(
            "manual",
            1,
            "Manager tenure created from commissioner-confirmed ownership reconciliation."
          ),
        });
      } else if (issue.currentManagerId) {
        tenures.push({
          tenureId: `${team.seasonTeamId}:primary:incoming`,
          season: team.season,
          franchiseId: team.franchiseId,
          managerId: issue.currentManagerId,
          role: "incoming_owner",
          startWeek: effectiveWeek,
          endWeek: null,
          status: "after_competitive_season",
          provenance: source(
            "manual",
            1,
            "Incoming owner begins after the final scored fantasy week and receives no games from this season."
          ),
        });
      }
    } else {
      if (issue.previousManagerId) {
        tenures.push({
          tenureId: `${team.seasonTeamId}:candidate:previous`,
          season: team.season,
          franchiseId: team.franchiseId,
          managerId: issue.previousManagerId,
          role: "primary_candidate",
          startWeek: null,
          endWeek: null,
          status: "needs_review",
          provenance: source(
            "inferred",
            issue.evidence?.confidence ?? 0.5,
            "Historical owner candidate. Exact handoff unresolved."
          ),
        });
      }

      if (issue.currentManagerId) {
        tenures.push({
          tenureId: `${team.seasonTeamId}:candidate:current`,
          season: team.season,
          franchiseId: team.franchiseId,
          managerId: issue.currentManagerId,
          role: "primary_candidate",
          startWeek: null,
          endWeek: null,
          status: "needs_review",
          provenance: source(
            "inferred",
            issue.evidence?.confidence ?? 0.5,
            "Historical owner candidate. Exact handoff unresolved."
          ),
        });
      }
    }

    for (const managerId of team.ownerSnapshot.coManagerIds) {
      tenures.push({
        tenureId: `${team.seasonTeamId}:co:${managerId}`,
        season: team.season,
        franchiseId: team.franchiseId,
        managerId,
        role: "co_owner",
        startWeek: null,
        endWeek: null,
        status: "record_only",
        provenance: source(),
      });
    }
  }

  return tenures;
}

function resolveManagerAtWeek(managerTenures, season, franchiseId, week) {
  const candidates = managerTenures.filter(
    (tenure) =>
      tenure.season === season &&
      tenure.franchiseId === franchiseId &&
      tenure.role === "primary" &&
      tenure.startWeek != null &&
      Number(tenure.startWeek) <= Number(week) &&
      (tenure.endWeek == null || Number(tenure.endWeek) >= Number(week))
  );

  if (candidates.length === 1) {
    return {
      managerId: candidates[0].managerId,
      status: candidates[0].status,
    };
  }

  return {
    managerId: null,
    status: "needs_review",
  };
}

function buildGamesAndLineups(
  rawSeasons,
  leagueSeriesId,
  managerTenures
) {
  const games = [];
  const lineups = [];

  for (const season of rawSeasons) {
    const year = str(season.league.season);
    const playoffStart = Number(
      season.league?.settings?.playoff_week_start ?? 0
    );

    for (const weekEntry of season.weeks || []) {
      const playedRows = (weekEntry.matchups || []).filter((row) =>
        isPlayedMatchupRow(row, weekEntry.week, season.league)
      );

      const grouped = new Map();

      for (const row of playedRows) {
        const key = str(row.matchup_id);
        if (!grouped.has(key)) grouped.set(key, []);
        grouped.get(key).push(row);
      }

      for (const [matchupId, rows] of grouped.entries()) {
        if (rows.length !== 2) continue;

        const [a, b] = rows;
        const id = gameId(year, weekEntry.week, matchupId);

        const teamAFranchise = `${leagueSeriesId}:franchise:${a.roster_id}`;
        const teamBFranchise = `${leagueSeriesId}:franchise:${b.roster_id}`;

        const managerA = resolveManagerAtWeek(
          managerTenures,
          year,
          teamAFranchise,
          weekEntry.week
        );

        const managerB = resolveManagerAtWeek(
          managerTenures,
          year,
          teamBFranchise,
          weekEntry.week
        );

        games.push({
          gameId: id,
          season: year,
          week: weekEntry.week,
          matchupId,
          gameType: "head_to_head",
          phase:
            playoffStart && weekEntry.week >= playoffStart
              ? "playoffs"
              : "regular_season",

          teamA: {
            rosterId: str(a.roster_id),
            franchiseId: teamAFranchise,
            managerId: managerA.managerId,
            managerAttributionStatus: managerA.status,
            points: Number(a.points ?? 0),
          },

          teamB: {
            rosterId: str(b.roster_id),
            franchiseId: teamBFranchise,
            managerId: managerB.managerId,
            managerAttributionStatus: managerB.status,
            points: Number(b.points ?? 0),
          },

          provenance: source(),
        });

        for (const row of [a, b]) {
          const franchiseId = `${leagueSeriesId}:franchise:${row.roster_id}`;
          const manager = resolveManagerAtWeek(
            managerTenures,
            year,
            franchiseId,
            weekEntry.week
          );

          lineups.push({
            lineupId: `${id}:roster:${row.roster_id}`,
            gameId: id,
            season: year,
            week: weekEntry.week,
            rosterId: str(row.roster_id),
            franchiseId,
            managerId: manager.managerId,
            managerAttributionStatus: manager.status,
            starters: row.starters || [],
            starterPoints: row.starters_points || [],
            players: row.players || [],
            playerPoints: row.players_points || {},
            teamPoints: Number(row.points ?? 0),
            provenance: source(),
          });
        }
      }
    }
  }

  return { games, lineups };
}

function buildPlayoffGames(rawSeasons) {
  const out = [];

  for (const season of rawSeasons) {
    const year = str(season.league.season);

    for (const [bracketType, bracket] of [
      ["winners", season.winnersBracket || []],
      ["losers", season.losersBracket || []],
    ]) {
      for (const node of bracket) {
        out.push({
          playoffGameId: `${year}:${bracketType}:r${node.r}:m${node.m}`,
          season: year,
          bracketType,
          round: node.r ?? null,
          bracketMatch: node.m ?? null,
          placement: node.p ?? null,
          team1RosterId: str(node.t1),
          team2RosterId: str(node.t2),
          team1From: node.t1_from
            ? {
                winnerMatchId: str(node.t1_from.w),
                loserMatchId: str(node.t1_from.l),
              }
            : null,
          team2From: node.t2_from
            ? {
                winnerMatchId: str(node.t2_from.w),
                loserMatchId: str(node.t2_from.l),
              }
            : null,
          winnerRosterId: str(node.w),
          loserRosterId: str(node.l),
          isResolved: node.w != null && node.l != null,
          provenance: source(),
        });
      }
    }
  }

  return out;
}

function buildDrafts(rawSeasons) {
  const drafts = [];
  const picks = [];

  for (const season of rawSeasons) {
    for (const entry of season.drafts || []) {
      const draft = entry.draft;

      drafts.push({
        draftId: str(draft.draft_id),
        season: str(draft.season || season.league.season),
        type: draft.type || draft.draft_type || null,
        status: draft.status ?? null,
        rounds: Number(draft?.settings?.rounds ?? 0) || null,
        startTime: Number(draft.start_time || 0) || null,
        provenance: source(),
      });

      for (const pick of entry.picks || []) {
        picks.push({
          draftPickId: `${draft.draft_id}:${pick.pick_no}`,
          draftId: str(draft.draft_id),
          season: str(draft.season || season.league.season),
          pickNo: pick.pick_no ?? null,
          round: pick.round ?? null,
          draftSlot: pick.draft_slot ?? null,
          rosterId: str(pick.roster_id),
          pickedByManagerId: str(pick.picked_by),
          playerId: str(pick.player_id),
          provenance: source(),
        });
      }
    }
  }

  return { drafts, picks };
}

function buildTransactions(rawSeasons) {
  const seen = new Set();
  const out = [];

  for (const season of rawSeasons) {
    const year = str(season.league.season);

    for (const week of season.weeks || []) {
      for (const tx of week.transactions || []) {
        const id = str(tx.transaction_id);
        if (!id || seen.has(id)) continue;
        seen.add(id);

        out.push({
          transactionId: id,
          season: year,
          week: tx.leg ?? week.week ?? null,
          type: tx.type ?? null,
          status: tx.status ?? null,
          created: tx.created ?? null,
          statusUpdated: tx.status_updated ?? null,
          creatorManagerId: str(tx.creator),
          rosterIds: (tx.roster_ids || []).map(str),
          consenterRosterIds: (tx.consenter_ids || []).map(str),
          adds: tx.adds || {},
          drops: tx.drops || {},
          draftPicks: tx.draft_picks || [],
          waiverBudget: tx.waiver_budget || [],
          settings: tx.settings || null,
          provenance: source(),
        });
      }
    }
  }

  return out;
}

function buildChampions(
  seasons,
  seasonTeams,
  games,
  playoffGames
) {
  const seasonByYear = new Map(seasons.map((s) => [s.season, s]));
  const teamByKey = new Map(
    seasonTeams.map((team) => [`${team.season}:${team.rosterId}`, team])
  );

  const champions = [];

  for (const playoffGame of playoffGames) {
    if (
      playoffGame.bracketType !== "winners" ||
      Number(playoffGame.placement) !== 1 ||
      !playoffGame.isResolved
    ) {
      continue;
    }

    const season = seasonByYear.get(playoffGame.season);
    if (!season?.playoffWeekStart) continue;

    const championshipWeek =
      Number(season.playoffWeekStart) +
      Number(playoffGame.round || 1) -
      1;

    const game = games.find(
      (candidate) =>
        candidate.season === playoffGame.season &&
        Number(candidate.week) === championshipWeek &&
        [candidate.teamA.rosterId, candidate.teamB.rosterId].includes(
          playoffGame.winnerRosterId
        ) &&
        [candidate.teamA.rosterId, candidate.teamB.rosterId].includes(
          playoffGame.loserRosterId
        )
    );

    const winnerSide =
      game?.teamA?.rosterId === playoffGame.winnerRosterId
        ? game.teamA
        : game?.teamB?.rosterId === playoffGame.winnerRosterId
          ? game.teamB
          : null;

    const loserSide =
      game?.teamA?.rosterId === playoffGame.loserRosterId
        ? game.teamA
        : game?.teamB?.rosterId === playoffGame.loserRosterId
          ? game.teamB
          : null;

    const winnerTeam = teamByKey.get(
      `${playoffGame.season}:${playoffGame.winnerRosterId}`
    );

    const loserTeam = teamByKey.get(
      `${playoffGame.season}:${playoffGame.loserRosterId}`
    );

    champions.push({
      championId: `${playoffGame.season}:champion`,
      season: playoffGame.season,
      week: championshipWeek,

      winner: {
        rosterId: playoffGame.winnerRosterId,
        franchiseId: winnerTeam?.franchiseId ?? null,
        teamName: winnerTeam?.teamName ?? `Roster ${playoffGame.winnerRosterId}`,
        managerId: winnerSide?.managerId ?? null,
        managerAttributionStatus:
          winnerSide?.managerAttributionStatus ?? "needs_review",
        points: winnerSide?.points ?? null,
      },

      runnerUp: {
        rosterId: playoffGame.loserRosterId,
        franchiseId: loserTeam?.franchiseId ?? null,
        teamName: loserTeam?.teamName ?? `Roster ${playoffGame.loserRosterId}`,
        managerId: loserSide?.managerId ?? null,
        managerAttributionStatus:
          loserSide?.managerAttributionStatus ?? "needs_review",
        points: loserSide?.points ?? null,
      },

      provenance: source(),
    });
  }

  return champions.sort((a, b) => Number(b.season) - Number(a.season));
}

export function normalizeSleeperHistory(
  raw,
  { ownershipOverrides = {} } = {}
) {
  const rawSeasons = raw?.seasons || [];
  if (!rawSeasons.length) {
    throw new Error("No Sleeper seasons were supplied.");
  }

  const newest = rawSeasons[rawSeasons.length - 1];
  const leagueSeriesId = leagueSeriesIdFrom(rawSeasons);

  const managers = buildManagers(rawSeasons);
  const franchises = buildFranchises(rawSeasons, leagueSeriesId);

  const ownershipIssues = mergeOwnershipOverrides(
    buildOwnershipReview(rawSeasons, leagueSeriesId),
    ownershipOverrides
  );

  const seasons = buildSeasons(rawSeasons, leagueSeriesId);

  const seasonTeams = buildSeasonTeams(
    rawSeasons,
    leagueSeriesId,
    ownershipIssues
  );

  const managerTenures = buildManagerTenures(
    seasonTeams,
    ownershipIssues,
    seasons
  );

  const { games, lineups } = buildGamesAndLineups(
    rawSeasons,
    leagueSeriesId,
    managerTenures
  );

  const playoffGames = buildPlayoffGames(rawSeasons);
  const { drafts, picks: draftPicks } = buildDrafts(rawSeasons);
  const transactions = buildTransactions(rawSeasons);

  const champions = buildChampions(
    seasons,
    seasonTeams,
    games,
    playoffGames
  );

  return {
    schemaVersion: 4,
    generatedAt: new Date().toISOString(),
    sync: raw.sync || null,

    leagueSeries: {
      leagueSeriesId,
      name: newest.league.name || "League Almanac",
      currentSleeperLeagueId: str(newest.league.league_id),
      provenance: source(),
    },

    managers,
    franchises,
    seasons,
    seasonTeams,
    managerTenures,
    games,
    lineups,
    playoffGames,
    champions,
    drafts,
    draftPicks,
    transactions,
    ownershipIssues,
  };
}
