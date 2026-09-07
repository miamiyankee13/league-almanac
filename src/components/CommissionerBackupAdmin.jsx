import { useRef, useState } from "react";
import { normalizeManualHistory } from "../domain/manualHistory";
import {
  createCommissionerBackup,
  loadCommissionerState,
  readCommissionerImport,
  saveCommissionerState,
} from "../services/commissionerStore";

function downloadJson(data, filename) {
  const blob = new Blob([JSON.stringify(data, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function stateSummary(state) {
  const history = normalizeManualHistory(state?.manualHistory);

  return {
    seasons: history.seasons.length,
    historicalManagers: history.managers.length,
    ownershipOverrides: Object.keys(state?.ownershipOverrides || {}).length,
    loreEntries: Array.isArray(state?.loreEntries) ? state.loreEntries.length : 0,
  };
}

function summaryText(summary) {
  return `${summary.seasons} manual season${summary.seasons === 1 ? "" : "s"} · ${summary.historicalManagers} historical manager${summary.historicalManagers === 1 ? "" : "s"} · ${summary.ownershipOverrides} ownership decision${summary.ownershipOverrides === 1 ? "" : "s"} · ${summary.loreEntries} lore entr${summary.loreEntries === 1 ? "y" : "ies"}`;
}

export default function CommissionerBackupAdmin({ almanac, onImport }) {
  const fileInputRef = useRef(null);
  const [message, setMessage] = useState("");
  const leagueSeriesId = almanac.leagueSeries.leagueSeriesId;
  const currentState = loadCommissionerState(leagueSeriesId);
  const currentSummary = stateSummary(currentState);

  function exportBackup() {
    const backup = createCommissionerBackup(leagueSeriesId, {
      currentSleeperLeagueId: almanac.leagueSeries.currentSleeperLeagueId,
      name: almanac.leagueSeries.name,
    });

    downloadJson(
      backup,
      `league-almanac-admin-backup-${almanac.leagueSeries.currentSleeperLeagueId}.json`
    );

    setMessage(`Commissioner Backup exported · ${summaryText(currentSummary)}.`);
  }

  async function importBackup(event) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    try {
      const text = await file.text();
      const payload = JSON.parse(text);
      const parsed = readCommissionerImport(payload, leagueSeriesId);
      const existing = loadCommissionerState(leagueSeriesId);

      let nextState;
      let confirmation;
      let successMessage;

      if (parsed.mode === "commissioner-backup") {
        nextState = {
          ...parsed.state,
          manualHistory: normalizeManualHistory(parsed.state.manualHistory),
        };

        const incoming = stateSummary(nextState);
        confirmation =
          `Import this Commissioner Backup for ${almanac.leagueSeries.name}?\n\n` +
          `${summaryText(incoming)}\n\n` +
          "This REPLACES the current commissioner-entered Manual History, ownership reconciliation decisions and lore entries for this league. Sleeper history/cache is not affected.";
        successMessage = `Commissioner Backup imported · ${summaryText(incoming)}.`;
      } else {
        const importedHistory = normalizeManualHistory(parsed.manualHistory);
        nextState = {
          ...existing,
          manualHistory: importedHistory,
        };

        confirmation =
          `This is a full Almanac export, not a compact Commissioner Backup.\n\n` +
          `It contains ${importedHistory.seasons.length} manual season${importedHistory.seasons.length === 1 ? "" : "s"} and ${importedHistory.managers.length} historical manager${importedHistory.managers.length === 1 ? "" : "s"}.\n\n` +
          "Import its Manual History only? Current ownership reconciliation decisions and lore entries will be kept.";
        successMessage =
          `Manual History restored from Almanac export · ${importedHistory.seasons.length} season${importedHistory.seasons.length === 1 ? "" : "s"}. Ownership/lore data was left unchanged.`;
      }

      if (!window.confirm(confirmation)) return;

      saveCommissionerState(leagueSeriesId, nextState);
      setMessage(successMessage);
      onImport?.();
    } catch (error) {
      console.error(error);
      setMessage(error?.message || "Could not import that JSON file.");
    }
  }

  return (
    <section className="panel admin-backup-panel">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Local commissioner data</p>
          <h2>Commissioner Backup</h2>
        </div>
        <span className="muted">{currentSummary.seasons} manual season{currentSummary.seasons === 1 ? "" : "s"}</span>
      </div>

      <div className="notice compact-notice">
        <strong>Use this as the portable backup for everything you enter in Admin.</strong>{" "}
        It stores Manual History, historical manager identities, ownership reconciliation
        decisions and lore entries. Sleeper API history, cached seasons and derived Almanac
        records are intentionally excluded because the app can rebuild them.
      </div>

      <div className="controls">
        <button type="button" onClick={exportBackup}>
          EXPORT ADMIN BACKUP
        </button>
        <button
          type="button"
          className="secondary-button"
          onClick={() => fileInputRef.current?.click()}
        >
          IMPORT ADMIN BACKUP
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="application/json,.json"
          onChange={importBackup}
          style={{ display: "none" }}
        />
      </div>

      <div className="muted">
        Current backup contents · {summaryText(currentSummary)}
      </div>

      <div className="muted">
        Existing full Almanac exports are also accepted as a Manual History recovery file;
        they do not replace ownership/lore data.
      </div>

      {message && <div className="sync-message">{message}</div>}
    </section>
  );
}
