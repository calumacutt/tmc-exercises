// Force/layout parameters and the live tuning panel.
//
// These defaults were tuned by hand against real data; CLAUDE.md §9 records the
// table. Expect to retune after the typed edge list lands (task 2.4) — much of
// the current machinery is compensating for spurious line-derived links.

const TUNE = {
  iterations:    600,   // relaxation steps
  pillScale:     1.20,  // exercise pill size multiplier
  // 1. pill spacing (same pillar): keep roughly equal air around every pill
  charge:        2.50,  // how hard crowded pills push apart
  air:           26,    // desired clear space around each pill, px
  // 1b. parabolic (Student-t) repulsion between all pairs in a sector. NOT
  // optional any more: it is the counterweight that stops the pairwise
  // attractions collapsing each group to a point.
  // 0.07 is the balance point against the attraction defaults below. Too high and
  // it wins at long range and packs the rim (CV 0.26 at 0.5); too low and the
  // attractions collapse each group and the air phase re-spreads it at random.
  farRepel:      0.07,  // peak push at zero distance, px/iteration
  farLen:        300,   // half-strength distance, px
  // 1b-bis. wall repulsion: the same kernel against the sector boundaries, via
  // image pills. Multiplies farRepel, standing in for how many neighbours the
  // truncated medium is missing at a wall. 0 = walls are hard-only.
  // 4 measured a fairly sharp optimum: 3 and 4 both beat walls-off on every
  // metric, 5 starts giving back the clustering, 8+ makes local spacing worse
  // than having no wall force at all (nn-gap CV 0.135 -> 0.263 -> 0.348).
  wallRepel:     4,
  // 1c. the attraction hierarchy (see SCHED in layout.js for the ramps).
  // These are PER-PAIR strengths, so a pill in a 51-member discipline feels 50
  // pulls. That is the point — the parabolic repulsion scales with partner count
  // the same way, so the two stay in balance as groups grow.
  // ⚠️ Useful per-pair strength scales as 1/n: a pill in the 51-member Strength &
  // Capacity discipline gets 50 pulls, one in a 3-member discipline gets 2. So the
  // value that suits the big groups is ~17x too weak for the small ones. That is
  // inherent to a pairwise linear spring, not a tuning problem.
  discPull:      0.0002, // every same-discipline pair — first to fade
  linePull:      0.002,  // every same-line pair — fades second
  edgePull:      0.060,  // prog/reg/variant same-line pairs — fades last
  // 1c-bis. when pill-vs-pill collisions switch on, as a fraction of the run.
  // Before this point pills pass through each other so they can reach their group
  // without getting entangled; sector walls and titles stay hard throughout.
  // 0 = collide from the start (the old behaviour).
  // 0.35 measured best for clustering (line purity peaks there); 0 gives the most
  // even fill. See CLAUDE.md — this is a real trade, not a tuning miss.
  collideAt:     0.35,
  // 1d. seed: 0 = hierarchical blob seed, 1 = random scatter (tests whether the
  // forces can recover the structure from nothing)
  seedMode:      0,
  // 2. keystone-to-seam attraction (boundary keystones only)
  keystoneSeam:  0.30,  // how strongly boundary keystones snap to the seam
  // 3. pillar title placement
  titlePos:      0.667, // title distance hub→rim (0..1)
  // sector sizing
  angleExp:      0.70,  // arc allocation exponent (1=∝count, <1 compresses big pillars)
  titleSize:     48,    // fixed pillar title font size
  // animation pacing: max relaxation steps per painted frame. 10 is effectively
  // "as fast as the frame budget allows"; below 1 a step runs only every few
  // frames, stretching the whole settle out so the phases can be watched.
  // LIVE: read every frame by driveLayout, so dragging it mid-run changes pace
  // without restarting the layout (unlike every other slider).
  animSpeed:     10,
};

// Slider definitions: [key, label, min, max, step, decimals]
const TUNE_DEFS = [
  ['__g2', 'Pill spacing (soft forces)'],
  ['charge',       '2a. Spacing push strength',               0, 2.5, 0.05, 2],
  ['air',          '2b. Desired space around each pill (px)', 4, 120, 2, 0],
  ['farRepel',     '2c. Long-range repulsion strength',       0, 1.5, 0.01, 2],
  ['farLen',       '2d. Long-range half-strength dist (px)',  50, 1200, 25, 0],
  ['wallRepel',    '2d2. Wall repulsion (x pill repulsion)',  0, 40, 1, 0],
  ['__g2b', 'Attraction hierarchy (scheduled)'],
  ['discPull',     '2e. Discipline attraction (per pair)',    0, 0.004, 0.0001, 4],
  ['linePull',     '2f. Line attraction (per pair)',          0, 0.02, 0.0005, 4],
  ['edgePull',     '2g. Edge springs (per pair)',             0, 0.30, 0.005, 3],
  ['collideAt',    '2h. Pill collisions start at (run frac)', 0, 1, 0.05, 2],
  ['seedMode',     '2i. Seed (0 = blobs, 1 = random)',        0, 1, 1, 0],
  ['__g3', 'Keystones'],
  ['keystoneSeam', '3. Pull boundary keystones to the seam',  0, 0.6, 0.01, 2],
  ['__g4', 'Pillar titles'],
  ['titlePos',     '4a. Title distance hub→rim',              0.15, 0.9, 0.01, 2],
  ['__g7', 'Sector sizing'],
  ['angleExp',     'Sector arc allocation (1=∝count, <1 evens)', 0.4, 1.6, 0.05, 2],
  ['titleSize',    'Pillar title size (fixed)',               16, 88, 2, 0],
  ['__g8', 'General'],
  ['pillScale',    'Exercise pill size',                      0.6, 1.6, 0.05, 2],
  ['iterations',   'Relaxation iterations (quality)',         80, 700, 20, 0],
  ['animSpeed',    'Animation speed (steps/frame)',           0.1, 10, 0.1, 1, 'live'],
];
const TUNE_DEFAULTS = JSON.parse(JSON.stringify(TUNE));

function buildTunePanel(onChange) {
  const body = document.getElementById('tune-body');
  let debounce = null;
  const scheduleRender = () => {
    clearTimeout(debounce);
    debounce = setTimeout(onChange, 180);
  };
  for (const def of TUNE_DEFS) {
    if (def[0].startsWith('__g')) {
      const h = document.createElement('div');
      h.className = 'tune-group-title';
      h.textContent = def[1];
      body.appendChild(h);
      continue;
    }
    const [key, label, min, max, step, dec, live] = def;
    const row = document.createElement('div');
    row.className = 'tune-row';
    const lab = document.createElement('label'); lab.textContent = label;
    const rng = document.createElement('input');
    rng.type = 'range'; rng.min = min; rng.max = max; rng.step = step;
    rng.value = TUNE[key];
    const val = document.createElement('span');
    val.className = 'val'; val.textContent = Number(TUNE[key]).toFixed(dec);
    rng.addEventListener('input', () => {
      TUNE[key] = parseFloat(rng.value);
      val.textContent = Number(TUNE[key]).toFixed(dec);
      // 'live' sliders are read continuously by the running layout (animation
      // pacing); re-rendering would restart the very run being watched.
      if (!live) scheduleRender();
    });
    rng._key = key; rng._dec = dec;
    row.appendChild(lab); row.appendChild(rng); row.appendChild(val);
    body.appendChild(row);
  }
  // actions: reset
  const actions = document.createElement('div');
  actions.className = 'tune-actions';
  const reset = document.createElement('button');
  reset.className = 'btn'; reset.textContent = 'Reset to defaults';
  reset.addEventListener('click', () => {
    Object.assign(TUNE, JSON.parse(JSON.stringify(TUNE_DEFAULTS)));
    body.querySelectorAll('input[type="range"]').forEach(r => {
      r.value = TUNE[r._key];
      r.nextSibling.textContent = Number(TUNE[r._key]).toFixed(r._dec);
    });
    onChange();
  });
  actions.appendChild(reset);
  body.appendChild(actions);

  // collapse toggle
  const panel = document.getElementById('tune-panel');
  document.getElementById('tune-head').addEventListener('click', () => {
    panel.classList.toggle('collapsed');
  });
}

export { TUNE, TUNE_DEFS, TUNE_DEFAULTS, buildTunePanel };
