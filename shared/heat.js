// Heat — how recently something was trained, weighted by how often it should be.
//
// One implementation, consumed by the Discipline view, the wheel and (later) the
// goal targets and the end-of-program score. Three copies is how three views end
// up disagreeing (CLAUDE.md §2).
//
// ─────────────────────────────────────────────────────────────────────────────
// THE MODEL — all of it
//
// ⚠️ HEAT is the stored quantity. Coldness is just `1 - heat`, for display.
//
// An earlier version had it the other way round, with coldness unbounded and
// Infinity for never-trained. That was wrong, and Calum caught it: a thing does
// not get infinitely colder, it reaches the point where it is indistinguishable
// from never having been done, and then stops. Heat decaying to zero and
// staying there says exactly that, needs no clamping inside the aggregates, and
// makes "never trained" the natural limit rather than a special case.
//
// `Importance` is not an abstract priority. The sheet's own `Importance legend`
// defines it as a PROGRAMMING FREQUENCY, so it states a cooling time directly:
//
//     coolDays(1) = 42    every program      (a TMC block is 6 weeks)
//     coolDays(2) = 84    every 2nd program
//     coolDays(3) = 168   occasional
//
// ---- Heat -----------------------------------------------------------------
//
//     staleness(x) = days from when x was last trained to `today`,  null if never
//
//     heat(x) = staleness === null
//                 ? 0
//                 : clamp01(1 - staleness / coolDays(importance(x)))
//
//     coldness(x) = 1 - heat(x)
//
// So heat is 1 the day it is trained, falls linearly, and hits 0 after exactly
// one cooling period — at which point it is level with never having been done,
// which is the whole point. A block that is still running counts as trained
// today, so it does not start cooling until the block ENDS.
//
// ---- Importance -----------------------------------------------------------
//
// Only LINES carry a manual importance (the `Line Importance` column in the
// Lists tab). Disciplines and pillars do not, by decision, so theirs is derived.
//
// ⚠️ Aggregate importance in URGENCY space, never the raw 1/2/3. The scale is
// inverted and non-linear, so averaging the raw numbers is nonsense — a
// discipline with one must-do line and four occasional ones averages 2.6 and
// reads as unimportant. Convert first:
//
//     weight(1) = 1.0 · weight(2) = 0.5 · weight(3) = 0.25    (expected frequency)
//
//     discipline.weight = mean(weight of each of its lines)
//     pillar.weight     = mean(weight of each of its disciplines)
//
// Importance is a property of the STRUCTURE, so it is computed first and
// independently; logging a program does not move it.
//
// ---- Propagation ----------------------------------------------------------
//
//     line.staleness   = min(staleness of its exercises)       ← nulls dropped
//     line.heat        = heat(line.staleness, line's OWN importance)
//
//     discipline.heat  = mean(heat of its lines)
//     pillar.heat      = mean(heat of its disciplines)
//
// The min at line level IS the agreed "max of members": a line counts as trained
// if any one exercise in it was, and the most recent member is the one with the
// smallest staleness. Aggregating coldness with a max instead would light up a
// line you had just trained, because of its one neglected exercise.
//
// Discipline and pillar heat take a plain mean and apply NO importance of their
// own — each line's importance is already baked into its heat, so weighting
// again here would count it twice.
//
// ---- Not implemented ------------------------------------------------------
//
// ⚠️ `cook` / half-baked cannot be computed yet. It is defined over CONSECUTIVE
// blocks (CLAUDE.md §7.3) and there is one block. `halfBaked` is always null,
// deliberately, rather than guessed from a single block.
// ─────────────────────────────────────────────────────────────────────────────

// How long something takes to cool from fully trained to cold, per importance.
// Straight from the Importance legend; a TMC block is six weeks.
const BLOCK_DAYS = 42;
const COOL_DAYS = { 1: BLOCK_DAYS, 2: BLOCK_DAYS * 2, 3: BLOCK_DAYS * 4 };

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

function coolDaysFor(importance) {
  return COOL_DAYS[importance] != null ? COOL_DAYS[importance] : COOL_DAYS[3];
}

/** heat(staleness, importance). `null` staleness means never trained — heat 0. */
function heatOf(days, importance) {
  if (days === null) return 0;
  const h = 1 - days / coolDaysFor(importance);
  return Math.max(0, Math.min(1, h));
}

/** The pair every level stores: heat, and coldness as its complement. */
function scoreOf(days, importance) {
  const heat = heatOf(days, importance);
  return { heat, coldness: 1 - heat };
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

  const scoreFrom = scoreOf;

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
    // Mean of HEAT, which is bounded 0..1 by construction, so there is nothing
    // to clamp and no way for one never-trained line to swallow the average.
    // Each line's importance is already inside its heat; re-weighting here would
    // count it twice.
    const heat = mean(ls.map(l => l.heat));
    const seenD = ls.map(l => l.staleness).filter(d => d !== null);
    discipline.set(name, {
      staleness: seenD.length ? Math.min(...seenD) : null,
      trained: ls.some(l => l.trained),
      weight, importance: importanceOfWeight(weight), lines: ls.length,
      heat, coldness: 1 - heat, halfBaked: null,
    });
  }

  const pillar = new Map();
  for (const [name, discs] of pillOf) {
    const ds = [...discs].map(d => discipline.get(d)).filter(Boolean);
    if (!ds.length) continue;
    const weight = mean(ds.map(d => d.weight));
    const heat = mean(ds.map(d => d.heat));
    const seenP = ds.map(d => d.staleness).filter(x => x !== null);
    pillar.set(name, {
      staleness: seenP.length ? Math.min(...seenP) : null,
      trained: ds.some(d => d.trained),
      weight, importance: importanceOfWeight(weight), disciplines: ds.length,
      heat, coldness: 1 - heat, halfBaked: null,
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
  buildHeat, weightOf, importanceOfWeight, coolDaysFor, heatOf,
  COOL_DAYS, WEIGHT, BLOCK_DAYS,
};
