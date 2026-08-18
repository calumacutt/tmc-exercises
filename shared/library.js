// Exercise row -> model, filtering, grouping, and the fail-fast validation gate.
//
// Pure: no DOM, no module-level mutable state. Callers pass their own filter
// options in, so the wheel and the builder cannot drift apart on what "hidden
// variant" or "importance <= n" means.

import { field } from './csv.js';
import { PILLAR_ORDER } from './taxonomy.js';

function normaliseRows(objs) {
  const out = [];
  for (const o of objs) {
    const name = field(o, ["Name"]);
    if (!name) continue;
    // Multi-value fields may be separated with "," or ";".
    //
    // Google Sheets multi-select dropdowns emit COMMA-delimited values and that
    // is not configurable, so the loader has to accept commas. That is only safe
    // while no Name and no declared LineKey contains a delimiter — checked by
    // validateRows(), which fails loudly if one ever does, because at that point
    // multi-value parsing becomes ambiguous and silently wrong.
    // Rationale in data/SHEET.md §3.
    const splitList = s => (s || "").split(/[;,]/).map(x => x.trim()).filter(Boolean);
    out.push({
      name,
      pillar: field(o, ["Pillar (auto)", "Pillar"]),
      discipline: field(o, ["Discipline (auto)", "Discipline"]),
      line: field(o, ["Primary Line", "Line"]),
      importance: parseInt(field(o, ["Importance"]), 10) || null,
      level: parseInt(field(o, ["Level"]), 10) || null,
      keystone: /^true$/i.test(field(o, ["Keystone?", "Keystone"])),
      variantOf: field(o, ["Variant Of"]),
      status: field(o, ["Status"]),
      progressions: splitList(field(o, ["Progressions"])),
      regressions: splitList(field(o, ["Regressions"])),
      alsoAppearsIn: splitList(field(o, ["Also Appears In"])),
    });
  }
  return out;
}

function filterRows(rows, { impMax, showVariants, impSliderMax }) {
  return rows.filter(r => {
    if (r.status && /^retired$/i.test(r.status)) return false;
    if (!showVariants && r.variantOf) return false;
    if (impMax < impSliderMax) {
      // rows with no importance are treated as "unrated" -> show only at max
      if (r.importance == null) return false;
      if (r.importance > impMax) return false;
    }
    return true;
  });
}

function groupData(rows) {
  // -> [{ pillar, count, disciplines: [{ name, exercises: [...] }] }]
  const pillarMap = new Map();
  for (const r of rows) {
    const p = r.pillar || "Uncategorised";
    const d = r.discipline || "Uncategorised";
    if (!pillarMap.has(p)) pillarMap.set(p, new Map());
    const dm = pillarMap.get(p);
    if (!dm.has(d)) dm.set(d, []);
    dm.get(d).push(r);
  }
  // order pillars canonically, unknowns after
  const pillars = [];
  const seen = new Set();
  for (const p of PILLAR_ORDER) {
    if (pillarMap.has(p)) { pillars.push(p); seen.add(p); }
  }
  for (const p of pillarMap.keys()) if (!seen.has(p)) pillars.push(p);

  return pillars.map(p => {
    const dm = pillarMap.get(p);
    const disciplines = [...dm.entries()]
      .map(([name, exs]) => ({ name, exercises: exs }))
      .sort((a, b) => b.exercises.length - a.exercises.length);
    const count = disciplines.reduce((s, d) => s + d.exercises.length, 0);
    return { pillar: p, count, disciplines };
  });
}

// flatten all exercises of a pillar (across its disciplines) into one list
function collectExercises(g) {
  const out = [];
  for (const d of g.disciplines) for (const e of d.exercises) out.push(e);
  return out;
}

// ---- data validation (fail fast) ----------------------------------------
// The exercise Name is a primary key: the node index, the within-line chains,
// Progressions/Regressions and Also Appears In all resolve by name. Duplicate
// names make that ambiguous, so callers refuse to draw rather than render
// something subtly wrong. See CLAUDE.md §6.1 — a tolerant version (per-line
// node index + NaN guards) was built and deliberately reverted.
function validateRows(rows) {
  const problems = [];
  const byName = new Map();
  for (const r of rows) {
    const n = (r.name || '').trim();
    if (!n) continue;
    const key = n.toLowerCase();
    if (!byName.has(key)) byName.set(key, []);
    byName.get(key).push(r);
  }
  for (const [, group] of byName) {
    if (group.length < 2) continue;
    const where = group.map(r =>
      `${r.pillar || '(no pillar)'} › ${r.discipline || '(no discipline)'} › ${r.line || '(no line)'}`);
    problems.push({
      kind: 'Duplicate exercise name',
      name: group[0].name.trim(),
      count: group.length,
      where,
    });
  }

  // A name containing a list delimiter breaks multi-value parsing: any
  // Progressions / Regressions / Also Appears In reference to it would split
  // into fragments that resolve to nothing, silently. This is the condition
  // that makes accepting commas safe, so it has to be loud.
  for (const r of rows) {
    const n = (r.name || '').trim();
    if (!n || !/[;,]/.test(n)) continue;
    problems.push({
      kind: 'Name contains a list delimiter',
      name: n,
      count: 1,
      where: [
        `${r.pillar || '(no pillar)'} › ${r.discipline || '(no discipline)'} › ${r.line || '(no line)'}`,
        'Multi-value fields split on "," and ";", so no reference to this name can resolve.',
        'Rename it — e.g. use "&" instead.',
      ],
    });
  }

  return problems;
}

export { normaliseRows, filterRows, groupData, collectExercises, validateRows };
