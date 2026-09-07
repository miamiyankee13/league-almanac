const PREFIX = "league-almanac.commissioner.v1";

export const COMMISSIONER_BACKUP_KIND = "league-almanac-commissioner-backup";
export const COMMISSIONER_BACKUP_VERSION = 1;

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

function objectOrEmpty(value) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value
    : {};
}

function normalizeCommissionerState(state) {
  const source = objectOrEmpty(state);

  return {
    ...emptyState(),
    ...source,
    ownershipOverrides: objectOrEmpty(source.ownershipOverrides),
    manualHistory: objectOrEmpty(source.manualHistory),
    loreEntries: Array.isArray(source.loreEntries) ? source.loreEntries : [],
  };
}

export function loadCommissionerState(leagueSeriesId) {
  if (!leagueSeriesId) return emptyState();

  try {
    const raw = localStorage.getItem(keyFor(leagueSeriesId));
    if (!raw) return emptyState();

    return normalizeCommissionerState(JSON.parse(raw));
  } catch {
    return emptyState();
  }
}

export function saveCommissionerState(leagueSeriesId, state) {
  const normalized = normalizeCommissionerState(state);
  localStorage.setItem(keyFor(leagueSeriesId), JSON.stringify(normalized));
  return normalized;
}

export function createCommissionerBackup(leagueSeriesId, leagueMetadata = {}) {
  return {
    kind: COMMISSIONER_BACKUP_KIND,
    schemaVersion: COMMISSIONER_BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    league: {
      leagueSeriesId,
      currentSleeperLeagueId: leagueMetadata.currentSleeperLeagueId || null,
      name: leagueMetadata.name || null,
    },
    commissionerState: loadCommissionerState(leagueSeriesId),
  };
}

function assertMatchingLeague(payloadLeagueSeriesId, currentLeagueSeriesId) {
  if (
    payloadLeagueSeriesId &&
    currentLeagueSeriesId &&
    payloadLeagueSeriesId !== currentLeagueSeriesId
  ) {
    throw new Error(
      "This backup belongs to a different League Almanac. Load the matching league before importing it."
    );
  }
}

/**
 * Accept the compact Commissioner Backup format plus the existing full Almanac
 * export as a manual-history recovery source.
 *
 * Full Almanac exports are intentionally treated as MANUAL-HISTORY ONLY because
 * the normalized Almanac contains derived records and does not preserve the raw
 * commissioner ownership/lore state as a complete backup.
 */
export function readCommissionerImport(payload, currentLeagueSeriesId) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw new Error("That file is not a valid League Almanac JSON object.");
  }

  if (payload.kind === COMMISSIONER_BACKUP_KIND) {
    const version = Number(payload.schemaVersion || 0);

    if (!Number.isFinite(version) || version < 1) {
      throw new Error("This Commissioner Backup is missing a supported schema version.");
    }

    if (version > COMMISSIONER_BACKUP_VERSION) {
      throw new Error(
        `This backup uses schema version ${version}, but this Almanac supports up to version ${COMMISSIONER_BACKUP_VERSION}. Update the app before importing it.`
      );
    }

    assertMatchingLeague(
      payload.league?.leagueSeriesId || null,
      currentLeagueSeriesId
    );

    return {
      mode: "commissioner-backup",
      state: normalizeCommissionerState(payload.commissionerState),
    };
  }

  if (payload.manualHistory && typeof payload.manualHistory === "object") {
    assertMatchingLeague(
      payload.leagueSeries?.leagueSeriesId || payload.league?.leagueSeriesId || null,
      currentLeagueSeriesId
    );

    return {
      mode: "almanac-export",
      manualHistory: objectOrEmpty(payload.manualHistory),
    };
  }

  throw new Error(
    "This JSON is not a Commissioner Backup and does not contain importable Manual History."
  );
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

export function saveManualHistory(leagueSeriesId, manualHistory) {
  const state = loadCommissionerState(leagueSeriesId);
  state.manualHistory = manualHistory || {};
  saveCommissionerState(leagueSeriesId, state);
  return state.manualHistory;
}
