function withCacheBust(url) {
  const sep = url.includes("?") ? "&" : "?";
  return `${url}${sep}t=${Date.now()}`;
}

async function fetchJson(url) {
  const res = await fetch(withCacheBust(url), {
    cache: "no-store",
    // No custom headers: avoids unnecessary CORS preflight with Sleeper.
  });

  if (!res.ok) {
    const msg = await res.text().catch(() => "");
    throw new Error(`Sleeper request failed (${res.status}): ${msg || url}`);
  }

  return res.json();
}

export function getLeague(leagueId) {
  return fetchJson(`https://api.sleeper.app/v1/league/${leagueId}`);
}

export function getLeagueUsers(leagueId) {
  return fetchJson(`https://api.sleeper.app/v1/league/${leagueId}/users`);
}

export function getLeagueRosters(leagueId) {
  return fetchJson(`https://api.sleeper.app/v1/league/${leagueId}/rosters`);
}

export function getLeagueMatchups(leagueId, week) {
  return fetchJson(`https://api.sleeper.app/v1/league/${leagueId}/matchups/${week}`);
}

export function getLeagueWinnersBracket(leagueId) {
  return fetchJson(`https://api.sleeper.app/v1/league/${leagueId}/winners_bracket`);
}

export function getLeagueLosersBracket(leagueId) {
  return fetchJson(`https://api.sleeper.app/v1/league/${leagueId}/losers_bracket`);
}

export function getLeagueTransactions(leagueId, week) {
  return fetchJson(`https://api.sleeper.app/v1/league/${leagueId}/transactions/${week}`);
}

export function getLeagueDrafts(leagueId) {
  return fetchJson(`https://api.sleeper.app/v1/league/${leagueId}/drafts`);
}

export function getDraftPicks(draftId) {
  return fetchJson(`https://api.sleeper.app/v1/draft/${draftId}/picks`);
}
