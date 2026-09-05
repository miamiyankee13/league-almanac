import {
  getLeague,
  getLeagueUsers,
  getLeagueRosters,
  getLeagueMatchups,
  getLeagueWinnersBracket,
  getLeagueLosersBracket,
  getLeagueTransactions,
  getLeagueDrafts,
  getDraftPicks,
} from "./sleeperClient";
import {
  getCachedSeason,
  putCachedSeason,
} from "../../services/historyCache";

const DEFAULT_MAX_WEEKS = 18;
const MAX_HISTORY_SEASONS = 30;

function validLeagueId(value) {
  if (value == null) return false;
  const id = String(value).trim();
  return id !== "" && id !== "0" && id !== "null" && id !== "undefined";
}

async function safe(label, fn, fallback) {
  try {
    return await fn();
  } catch (error) {
    console.warn(`[ALMANAC] ${label} failed`, error);
    return fallback;
  }
}

export async function getLeagueChain(startLeagueId) {
  if (!validLeagueId(startLeagueId)) {
    throw new Error("A valid Sleeper league ID is required.");
  }

  const newestFirst = [];
  const seen = new Set();
  let leagueId = String(startLeagueId);

  for (let i = 0; i < MAX_HISTORY_SEASONS; i += 1) {
    if (!validLeagueId(leagueId) || seen.has(leagueId)) break;
    seen.add(leagueId);

    const league = await getLeague(leagueId);
    if (!league) break;

    newestFirst.push(league);

    if (!validLeagueId(league.previous_league_id)) break;
    leagueId = String(league.previous_league_id);
  }

  return newestFirst.reverse();
}

async function loadWeeks(leagueId, maxWeeks) {
  const weekNumbers = Array.from(
    { length: maxWeeks },
    (_, index) => index + 1
  );

  // Phase 0 loaded weeks sequentially. The Almanac intentionally loads them
  // concurrently; this removes the largest avoidable source of first-load delay.
  return Promise.all(
    weekNumbers.map(async (week) => {
      const [matchups, transactions] = await Promise.all([
        safe(
          `matchups ${leagueId} week ${week}`,
          () => getLeagueMatchups(leagueId, week),
          []
        ),
        safe(
          `transactions ${leagueId} week ${week}`,
          () => getLeagueTransactions(leagueId, week),
          []
        ),
      ]);

      return {
        week,
        matchups: Array.isArray(matchups) ? matchups : [],
        transactions: Array.isArray(transactions) ? transactions : [],
      };
    })
  );
}

async function loadSeason(league, { maxWeeks = DEFAULT_MAX_WEEKS } = {}) {
  const leagueId = String(league.league_id);

  const [users, rosters, winnersBracket, losersBracket, drafts, weeks] =
    await Promise.all([
      safe("users", () => getLeagueUsers(leagueId), []),
      safe("rosters", () => getLeagueRosters(leagueId), []),
      safe("winners bracket", () => getLeagueWinnersBracket(leagueId), []),
      safe("losers bracket", () => getLeagueLosersBracket(leagueId), []),
      safe("drafts", () => getLeagueDrafts(leagueId), []),
      loadWeeks(leagueId, maxWeeks),
    ]);

  const draftsWithPicks = await Promise.all(
    (drafts || []).map(async (draft) => ({
      draft,
      picks: await safe(
        `draft picks ${draft.draft_id}`,
        () => getDraftPicks(draft.draft_id),
        []
      ),
    }))
  );

  return {
    league,
    users: users || [],
    rosters: rosters || [],
    weeks,
    winnersBracket: winnersBracket || [],
    losersBracket: losersBracket || [],
    drafts: draftsWithPicks,
  };
}

export async function loadSleeperHistory(
  startLeagueId,
  {
    maxWeeks = DEFAULT_MAX_WEEKS,
    forceRefresh = false,
    onProgress = null,
  } = {}
) {
  const chain = await getLeagueChain(startLeagueId);
  const seasons = [];
  let cacheHits = 0;
  let fetchedSeasons = 0;
  let newlyCachedSeasons = 0;

  onProgress?.({
    type: "chain",
    message: `Found ${chain.length} linked Sleeper season${chain.length === 1 ? "" : "s"}.`,
    totalSeasons: chain.length,
  });

  // Seasons stay sequential so we do not blast Sleeper with ~150 simultaneous
  // requests. Each season's 18 weekly matchup/transaction calls are parallel.
  for (let index = 0; index < chain.length; index += 1) {
    const league = chain[index];
    const seasonLabel = league.season || `season ${index + 1}`;
    const isComplete = league.status === "complete";

    let seasonPayload = null;

    if (isComplete && !forceRefresh) {
      seasonPayload = await getCachedSeason(league.league_id);

      if (seasonPayload) {
        cacheHits += 1;
        onProgress?.({
          type: "cache_hit",
          season: seasonLabel,
          message: `${seasonLabel}: loaded from historical cache.`,
        });
      }
    }

    if (!seasonPayload) {
      fetchedSeasons += 1;
      onProgress?.({
        type: "fetching",
        season: seasonLabel,
        message: `${seasonLabel}: syncing Sleeper data…`,
      });

      seasonPayload = await loadSeason(league, { maxWeeks });

      if (isComplete) {
        await putCachedSeason(seasonPayload);
        newlyCachedSeasons += 1;
      }
    }

    seasons.push(seasonPayload);
  }

  return {
    generatedAt: new Date().toISOString(),
    startingLeagueId: String(startLeagueId),
    seasons,
    sync: {
      totalSeasons: chain.length,
      cacheHits,
      fetchedSeasons,
      newlyCachedSeasons,
      forceRefresh,
    },
  };
}
