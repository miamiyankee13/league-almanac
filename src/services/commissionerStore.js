const PREFIX = "league-almanac.commissioner.v1";

function keyFor(leagueSeriesId) {
  return `${PREFIX}:${leagueSeriesId}`;
}

function emptyState() {
  return {
    ownershipOverrides: {},
    manualHistory: {},
    loreEntries: [],
  };
}

export function loadCommissionerState(leagueSeriesId) {
  if (!leagueSeriesId) return emptyState();

  try {
    const raw = localStorage.getItem(keyFor(leagueSeriesId));
    if (!raw) return emptyState();

    const parsed = JSON.parse(raw);
    return {
      ...emptyState(),
      ...parsed,
      ownershipOverrides: parsed?.ownershipOverrides || {},
      manualHistory: parsed?.manualHistory || {},
      loreEntries: parsed?.loreEntries || [],
    };
  } catch {
    return emptyState();
  }
}

export function saveCommissionerState(leagueSeriesId, state) {
  localStorage.setItem(keyFor(leagueSeriesId), JSON.stringify(state));
}

export function saveOwnershipOverride(leagueSeriesId, ownershipIssueId, override) {
  const state = loadCommissionerState(leagueSeriesId);

  state.ownershipOverrides = {
    ...state.ownershipOverrides,
    [ownershipIssueId]: override,
  };

  saveCommissionerState(leagueSeriesId, state);
  return state.ownershipOverrides;
}

export function removeOwnershipOverride(leagueSeriesId, ownershipIssueId) {
  const state = loadCommissionerState(leagueSeriesId);
  const next = { ...state.ownershipOverrides };
  delete next[ownershipIssueId];

  state.ownershipOverrides = next;
  saveCommissionerState(leagueSeriesId, state);

  return next;
}
