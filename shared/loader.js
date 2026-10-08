// Getting exercise data into a view — the ONE implementation, for every view.
//
// The wheel used to own this: a hard-coded sheet URL, its own fetch handler, its
// own FileReader handler, its own "did we get any rows" check. When the builder
// needed the same three things the choice was to duplicate them or to share them,
// and duplicating data-loading is how two views end up disagreeing about what
// loaded — the same reason `shared/library.js` exists.
//
// Two layers, so a view can take just the part it needs:
//   * `fetchSheetRows()` / `readFileRows()` — pure getters. Text in, normalised
//     model rows out. No DOM, no state, no opinion about what to do next.
//   * `wireDataSource()` — wires an Upload/Load pair of buttons to those getters.
//     Views keep their own markup and their own status rendering; only the
//     behaviour is shared.

import { parseCSV, rowsToObjects, field } from './csv.js';
import { normaliseRows } from './library.js';
import { SHEET_CSV_URL, LISTS_CSV_URL } from './sheet.js';

// CSV text -> normalised model rows. Throws on an empty or Name-less table,
// because "loaded nothing" is a real failure and silently rendering an empty
// view is exactly the kind of degradation CLAUDE.md §6.1 rules out.
function rowsFromText(text) {
  const rows = normaliseRows(rowsToObjects(parseCSV(text)));
  if (!rows.length) {
    throw new Error('No exercises found — is this the Exercises export, with a "Name" column?');
  }
  return rows;
}

async function fetchSheetRows(url = SHEET_CSV_URL) {
  const res = await fetch(url);
  // fetch() only rejects on network failure, so a 404 or a permissions page
  // arrives as a perfectly successful response full of HTML. Check explicitly.
  if (!res.ok) throw new Error('HTTP ' + res.status + ' fetching the sheet');
  return rowsFromText(await res.text());
}

function readFileRows(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      try { resolve(rowsFromText(reader.result)); } catch (err) { reject(err); }
    };
    reader.onerror = () => reject(new Error("That file couldn't be read."));
    reader.readAsText(file);
  });
}

// Wire a view's data controls.
//
//   uploadBtn / fileInput / sheetBtn : element ids (any may be omitted)
//   onRows(rows, source)             : called with normalised rows on success
//   onStatus(message, isError)       : progress and failures, view-rendered
//   autoLoad                         : fetch the sheet immediately on wire-up
//
// Returns { loadSheet, loadFile } so a view can also trigger a load itself.
function wireDataSource({ uploadBtn, fileInput, sheetBtn, onRows, onStatus, autoLoad = false }) {
  const say = (m, isErr) => { if (onStatus) onStatus(m, !!isErr); };
  const el = id => (id ? document.getElementById(id) : null);

  const deliver = (rows, source) => {
    say(`Loaded ${rows.length} exercises from ${source}.`, false);
    onRows(rows, source);
  };

  async function loadSheet() {
    say('Fetching the latest data from the Sheet…', false);
    try {
      deliver(await fetchSheetRows(), 'the Sheet');
    } catch (err) {
      // Named specifically: the overwhelmingly likely causes are the tab not
      // being published to web, or being offline. A generic "failed" sends the
      // reader hunting in the wrong place.
      say("Couldn't reach the published Sheet — check the tab is published to "
        + 'the web and the network is available. ' + (err.message || ''), true);
    }
  }

  async function loadFile(file) {
    if (!file) return;
    try {
      deliver(await readFileRows(file), file.name);
    } catch (err) {
      say(err.message || "That file couldn't be read.", true);
    }
  }

  const up = el(uploadBtn), fi = el(fileInput), sh = el(sheetBtn);
  if (up && fi) up.addEventListener('click', () => fi.click());
  if (fi) fi.addEventListener('change', e => {
    loadFile(e.target.files[0]);
    // Reset, or re-picking the same file fires no change event and the view
    // looks dead.
    e.target.value = '';
  });
  if (sh) sh.addEventListener('click', loadSheet);

  if (autoLoad) loadSheet();
  return { loadSheet, loadFile };
}

// The `Lists` tab's per-line rating — the manual half of heat (CLAUDE.md §7.4).
//
// ⚠️ Read the `Line Importance` column, NOT `Importance`. The Lists tab is two
// independent tables side by side: A-E is the LineKey table, F is a blank
// separator, and the columns after it are DROPDOWN VOCABULARY lists — one of
// which is called `Importance` and holds exactly one each of 1, 2, 3. Matching
// the wrong header would silently give three lines a rating and 58 nothing.
//
// Returns Map('Discipline - Line' -> 1|2|3).
async function fetchLineImportance(url = LISTS_CSV_URL) {
  const res = await fetch(url);
  if (!res.ok) throw new Error('HTTP ' + res.status + ' fetching the Lists tab');
  const rows = rowsToObjects(parseCSV(await res.text()));
  const out = new Map();
  for (const o of rows) {
    const key = field(o, ['LineKey (Discipline - Line)', 'LineKey']).trim();
    const imp = Number(field(o, ['Line Importance']).trim());
    if (!key) continue;
    if (!Number.isFinite(imp) || imp < 1 || imp > 3) continue;
    out.set(key, imp);
  }
  if (!out.size) {
    throw new Error('No `Line Importance` values found in the Lists tab — is the '
      + 'column still called that?');
  }
  return out;
}

export {
  fetchSheetRows, readFileRows, rowsFromText, wireDataSource, fetchLineImportance,
};
