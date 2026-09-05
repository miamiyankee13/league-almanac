const DB_NAME = "league-almanac-cache";
const DB_VERSION = 1;
const STORE_NAME = "sleeper-seasons";
const CACHE_SCHEMA_VERSION = 1;
const DEFAULT_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

function canUseIndexedDb() {
  return typeof window !== "undefined" && "indexedDB" in window;
}

function openDb() {
  if (!canUseIndexedDb()) return Promise.resolve(null);

  return new Promise((resolve, reject) => {
    const request = window.indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "leagueId" });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function withStore(db, mode, callback) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, mode);
    const store = tx.objectStore(STORE_NAME);

    let request;
    try {
      request = callback(store);
    } catch (error) {
      reject(error);
      return;
    }

    tx.oncomplete = () => resolve(request?.result ?? null);
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

export async function getCachedSeason(
  leagueId,
  { maxAgeMs = DEFAULT_MAX_AGE_MS } = {}
) {
  const db = await openDb();
  if (!db) return null;

  try {
    const record = await withStore(db, "readonly", (store) =>
      store.get(String(leagueId))
    );

    if (!record) return null;
    if (record.schemaVersion !== CACHE_SCHEMA_VERSION) return null;

    const age = Date.now() - Number(record.cachedAt || 0);
    if (!Number.isFinite(age) || age > maxAgeMs) return null;

    return record.payload || null;
  } finally {
    db.close();
  }
}

export async function putCachedSeason(seasonPayload) {
  const leagueId = seasonPayload?.league?.league_id;
  if (!leagueId) return;

  const db = await openDb();
  if (!db) return;

  try {
    await withStore(db, "readwrite", (store) =>
      store.put({
        leagueId: String(leagueId),
        schemaVersion: CACHE_SCHEMA_VERSION,
        cachedAt: Date.now(),
        payload: seasonPayload,
      })
    );
  } finally {
    db.close();
  }
}

export async function clearHistoryCache() {
  const db = await openDb();
  if (!db) return;

  try {
    await withStore(db, "readwrite", (store) => store.clear());
  } finally {
    db.close();
  }
}
