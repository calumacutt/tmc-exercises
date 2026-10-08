// Heat — how recently something was trained, weighted by how often it should be.
//
// One implementation, consumed by the Discipline view, the wheel and (later) the
// goal targets and the end-of-program score. Three copies is how three views end
// up disagreeing (CLAUDE.md §2).
//
// ─────────────────────────────────────────────────────────────────────────────
// THE MODEL
//
// `Importance` is not an abstract priority. The sheet's own `Importance legend`
// defines it as a PROGRAMMING FREQUENCY:
//
//     1 = every program · 2 = every second program · 3 = occasional
//
// So importance states a target interval directly, and coldness is just how far
// past that interval you are:
//
//     coldness = days since last trained ÷ target interval for its importance
//
// 0 means just trained, 1 means due now, above 1 means overdue. Nothing was
// tuned: the numbers come from the legend. That is the whole engine.
//
// ⚠️ WORK IN "URGENCY", NOT IN THE RAW 1/2/3. The importance scale is INVERTED
// (1 is most important) and non-linear, so averaging the raw numbers gives
// nonsense — a discipline holding one must-do line and four occasional ones
// averages to 2.6 and reads as unimportant. `weightOf()` converts to expected
// frequency (1 → 1.0, 2 → 0.5, 3 → 0.25), where higher means more important and
// a mean is meaningful. Every aggregate is computed in that space.
//
// ⚠️ "NEVER TRAINED" IS INFINITELY COLD (Calum, 2026-10-08). Unless a record says
// an exercise was done, the only safe assumption is that it was not. An earlier
// version aged it from the start of the record instead; that was a hard-wired
// notion of when history began, it quietly flattered a thin record, and it is
// gone. If the result looks wrong, the fix is more program files, not a softer
// default.
//
// The consequence to hold onto: `coldness` is UNBOUNDED and can be Infinity, so a
// mean over raw coldness would be Infinity the moment one member was never
// trained — destroying the gradient at discipline and pillar level. Every
// aggregate therefore averages CLAMPED coldness (`min(1, c)`), which is finite and
// is also exactly what gets rendered. Raw coldness survives at exercise and line
// level, so "twice overdue" is still legible in a tooltip.
//
// ⚠️ `cook` / half-baked IS NOT IMPLEMENTED, and cannot be yet. It is defined as
// CONSECUTIVE blocks (CLAUDE.md §7.3), so it needs at least two in the history
// to say anything at all. There is one. `halfBaked` is therefore always null,
// deliberately, rather than guessed from a single block.

// Target interval in days per importance, straight from the Importance legend.
// A TMC block is six weeks, so "every program" is 42 days.
const BLOCK_DAYS = 42;
const TARGET_DAYS = { 1: BLOCK_DAYS, 2: BLOCK_DAYS * 2, 3: BLOCK_DAYS * 4 };

// Expected frequency per importance — the space all averaging happens in.
const WEIGHT = { 1: 1, 2: 0.5, 3: 0.25 };

/** Importance 1|2|3 → urgency weight, where HIGHER means more important. */
function weightOf(importance) {
  return WEIGHT[importance] != null ? WEIGHT[importance] : WEIGHT[3];
}

/** Urgency weight → the nominal 1|2|3 it is closest to, for display. */
function importanceOfWeight(w) {
  let best = 3, bestD = Infinity;
  for (const k of [1, 2, 3]) {
    const d = Math.abs(WEIGHT[k] - w);
    if (d < bestD) { bestD = d; best = Number(k); }
  }
  return best;
}

function targetDaysFor(importance) {
  return TARGET_DAYS[importance] != null ? TARGET_DAYS[importance] : TARGET_DAYS[3];
}

function daysBetween(fromIso, toIso) {
  const a = Date.parse(fromIso + 'T00:00:00Z');
  const b = Date.parse(toIso + 'T00:00:00Z');
  if (Number.isNaN(a) || Number.isNaN(b)) return null;
  return Math.round((b - a) / 86400000);
}

function mean(xs) {
  return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null;
}

/**
 * Build the whole heat picture.
 *
 *   blocks          from groupIntoBlocks() — [{ date, ends, classes }], any number
 *   today           ISO date
 *   exercises       [{ name, pillar, discipline, line, importance }]
 *   lineImportance  Map('Discipline - Line' -> 1|2|3)
 *   exerciseSetOf   (block) -> Set of names  [injected so this file stays pure]
 *
 * Returns { exercise, line, discipline, pillar, meta } — each a Map of
 * name -> { staleness, coldness, heat, importance, weight, trained }.
 *
 * `coldness` is unclamped so "twice overdue" stays visible; `heat` is 1 minus
 * the clamped coldness, so it is always 0..1.
 */
function buildHeat({ blocks, today, exercises, lineImportance, exerciseSetOf }) {
  const ordered = blocks.slice().sort((a, b) => String(a.date).localeCompare(String(b.date)));

  // When was each name last trained? A block's exercises stop ageing when the
  // block ENDS, not when it starts — and a block still running has not started
  // ageing at all. Later blocks overwrite earlier ones, so the newest wins.
  const lastEnd = new Map();
  for (const b of ordered) {
    const end = b.ends && b.ends < today ? b.ends : today;
    for (const name of exerciseSetOf(b)) lastEnd.set(name, end);
  }

  // `days` is null for never trained — not a large number, so nothing downstream
  // can mistake it for a measurement.
  const stalenessOf = (name) => {
    const end = lastEnd.get(name);
    if (!end) return { days: null, trained: false };
    return { days: Math.max(0, daysBetween(end, today) || 0), trained: true };
  };

  const clamp01 = (x) => Math.max(0, Math.min(1, x));
  const scoreFrom = (days, importance) => {
    const coldness = days === null ? Infinity : days / targetDaysFor(importance);
    return { coldness, clamped: clamp01(coldness), heat: 1 - clamp01(coldness) };
  };

  // ---- Exercise level -------------------------------------------------------
  const exercise = new Map();
  for (const ex of exercises) {
    const imp = Number(ex.importance) || 3;
    const { days, trained } = stalenessOf(ex.name);
    exercise.set(ex.name, {
      staleness: days, trained, importance: imp, weight: weightOf(imp),
      ...scoreFrom(days, imp), halfBaked: null,
    });
  }

  // ---- Line level -----------------------------------------------------------
  // Staleness is the MOST RECENTLY trained member — the line counts as trained if
  // any one exercise in it was. That is the max-of-members rule, expressed as a
  // min over staleness, and it is why coldness must be aggregated this way round:
  // taking the max of member COLDNESS would light up a line you had just trained,
  // because of its one neglected exercise.
  const members = new Map();
  for (const ex of exercises) {
    if (!ex.discipline || !ex.line) continue;
    const key = ex.discipline + ' - ' + ex.line;
    if (!members.has(key)) members.set(key, []);
    members.get(key).push(ex);
  }
  const line = new Map();
  for (const [key, exs] of members) {
    const imp = lineImportance.get(key) || 3;
    // The MOST RECENTLY trained member. `null` (never) must not win a min against
    // a real number, so nulls are dropped rather than coerced — which is exactly
    // what `Math.min` would do with them.
    const stale = exs.map(e => stalenessOf(e.name));
    const seenDays = stale.map(s => s.days).filter(d => d !== null);
    const days = seenDays.length ? Math.min(...seenDays) : null;
    line.set(key, {
      staleness: days, trained: stale.some(s => s.trained),
      importance: imp, weight: weightOf(imp), members: exs.length,
      ...scoreFrom(days, imp), halfBaked: null,
    });
  }
  // Lines declared in `Lists` with no exercises still exist and are still cold.
  for (const [key, imp] of lineImportance) {
    if (line.has(key)) continue;
    line.set(key, {
      staleness: null, trained: false, importance: imp,
      weight: weightOf(imp), members: 0,
      ...scoreFrom(null, imp), halfBaked: null,
    });
  }

  // ---- Discipline and pillar ------------------------------------------------
  // ⚠️ IMPORTANCE IS AGGREGATED FIRST AND INDEPENDENTLY of heat (Calum's call),
  // in weight space, as a mean. It is a property of the structure, not of the
  // history, so it does not move when a program is logged.
  const discOf = new Map(), pillOf = new Map();
  for (const ex of exercises) {
    if (!ex.discipline) continue;
    const key = ex.discipline + ' - ' + ex.line;
    if (!discOf.has(ex.discipline)) discOf.set(ex.discipline, new Set());
    if (ex.line) discOf.get(ex.discipline).add(key);
    if (ex.pillar) {
      if (!pillOf.has(ex.pillar)) pillOf.set(ex.pillar, new Set());
      pillOf.get(ex.pillar).add(ex.discipline);
    }
  }

  const discipline = new Map();
  for (const [name, keys] of discOf) {
    const ls = [...keys].map(k => line.get(k)).filter(Boolean);
    if (!ls.length) continue;
    const weight = mean(ls.map(l => l.weight));
    // CLAMPED, so one never-trained line cannot take the whole discipline to
    // Infinity and wipe out the gradient.
    const coldness = mean(ls.map(l => l.clamped));
    const seenD = ls.map(l => l.staleness).filter(d => d !== null);
    discipline.set(name, {
      staleness: seenD.length ? Math.min(...seenD) : null,
      trained: ls.some(l => l.trained),
      weight, importance: importanceOfWeight(weight), lines: ls.length,
      coldness, clamped: coldness, heat: 1 - coldness, halfBaked: null,
    });
  }

  const pillar = new Map();
  for (const [name, discs] of pillOf) {
    const ds = [...discs].map(d => discipline.get(d)).filter(Boolean);
    if (!ds.length) continue;
    const weight = mean(ds.map(d => d.weight));
    const coldness = mean(ds.map(d => d.clamped));
    const seenP = ds.map(d => d.staleness).filter(x => x !== null);
    pillar.set(name, {
      staleness: seenP.length ? Math.min(...seenP) : null,
      trained: ds.some(d => d.trained),
      weight, importance: importanceOfWeight(weight), disciplines: ds.length,
      coldness, clamped: coldness, heat: 1 - coldness, halfBaked: null,
    });
  }

  return {
    exercise, line, discipline, pillar,
    meta: {
      today, blocks: ordered.length,
      firstBlock: ordered.length ? ordered[0].date : null,
      lastBlock: ordered.length ? ordered[ordered.length - 1].date : null,
      // Honest about what one block can and cannot show.
      coldnessIsBinaryAtExerciseLevel: ordered.length < 2,
      halfBakedAvailable: false,
    },
  };
}

export {
  buildHeat, weightOf, importanceOfWeight, targetDaysFor,
  TARGET_DAYS, WEIGHT, BLOCK_DAYS,
};
