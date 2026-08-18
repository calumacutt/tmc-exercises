// Tolerant CSV parsing. Shared by the wheel and the builder.
//
// Column lookup is by header NAME (case-insensitive) via field(), so column
// order is irrelevant and a missing column is safe. See data/SHEET.md §4.

function parseCSV(text) {
  // Robust-enough CSV parser handling quoted fields, commas, CRLF.
  const rows = [];
  let row = [], field = "", inQ = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i], n = text[i + 1];
    if (inQ) {
      if (c === '"' && n === '"') { field += '"'; i++; }
      else if (c === '"') { inQ = false; }
      else { field += c; }
    } else {
      if (c === '"') inQ = true;
      else if (c === ',') { row.push(field); field = ""; }
      else if (c === '\r') { /* skip */ }
      else if (c === '\n') { row.push(field); rows.push(row); row = []; field = ""; }
      else field += c;
    }
  }
  if (field.length || row.length) { row.push(field); rows.push(row); }
  return rows;
}

function rowsToObjects(rows) {
  if (!rows.length) return [];
  const headers = rows[0].map(h => h.trim());
  const out = [];
  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    const o = {};
    headers.forEach((h, j) => { if (h) o[h] = (r[j] || "").trim(); });
    out.push(o);
  }
  return out;
}

// Tolerant getter — matches a header by any of several candidate names.
function field(obj, candidates) {
  for (const c of candidates) {
    for (const k in obj) {
      if (k.toLowerCase() === c.toLowerCase()) return obj[k];
    }
  }
  return "";
}

export { parseCSV, rowsToObjects, field };
