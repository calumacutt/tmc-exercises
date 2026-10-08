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
// ⚠️ "NEVER TRAINED" IS NOT INFINITELY COLD. It means "not in the recorded
// history", so its staleness is the age of the RECORD, not of the world. With
// one block logged five weeks ago, an untrained importance-1 line sits at 0.88
// coldness and an occasional one at 0.22 — a real gradient from a single block,
// and one that deepens honestly as history accumulates. Treating it as infinite
// would paint 520 exercises the same colour and say more than the data supports.
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
  const recordStart = ordered.length ? ordered[0].date : today;
  // How stale something not in the record is: the age of the record itself.
  const recordAge = Math.max(0, daysBetween(recordStart, today) || 0);

  // When was each name last trained? Newest block first; a block's exercises
  // stop ageing when the block ENDS, not when it starts — and a block still
  // running has not started ageing at all.
  const lastEnd = new Map();
  for (const b of ordered) {
    const end = b.ends && b.ends < today ? b.ends : today;
    for (const name of exerciseSetOf(b)) lastEnd.set(name, end);
  }

  const stalenessOf = (name) => {
    const end = lastEnd.get(name);
    if (!end) return { days: recordAge, trained: false };
    return { days: Math.max(0, daysBetween(end, today) || 0), trained: true };
  };

  const scoreFrom = (days, importance) => {
    const coldness = days / targetDaysFor(importance);
    return { coldness, heat: 1 - Math.max(0, Math.min(1, coldness)) };
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
    const stale = exs.map(e => stalenessOf(e.name));
    const days = Math.min(...stale.map(s => s.days));
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
      staleness: recordAge, trained: false, importance: imp,
      weight: weightOf(imp), members: 0,
      ...scoreFrom(recordAge, imp), halfBaked: null,
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
    const coldness = mean(ls.map(l => l.coldness));
    discipline.set(name, {
      staleness: Math.min(...ls.map(l => l.staleness)),
      trained: ls.some(l => l.trained),
      weight, importance: importanceOfWeight(weight), lines: ls.length,
      coldness, heat: 1 - Math.max(0, Math.min(1, coldness)), halfBaked: null,
    });
  }

  const pillar = new Map();
  for (const [name, discs] of pillOf) {
    const ds = [...discs].map(d => discipline.get(d)).filter(Boolean);
    if (!ds.length) continue;
    const weight = mean(ds.map(d => d.weight));
    const coldness = mean(ds.map(d => d.coldness));
    pillar.set(name, {
      staleness: Math.min(...ds.map(d => d.staleness)),
      trained: ds.some(d => d.trained),
      weight, importance: importanceOfWeight(weight), disciplines: ds.length,
      coldness, heat: 1 - Math.max(0, Math.min(1, coldness)), halfBaked: null,
    });
  }

  return {
    exercise, line, discipline, pillar,
    meta: {
      today, recordStart, recordAge, blocks: ordered.length,
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
