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
  // 1b. long-range repulsion, Student-t falloff. DEFAULT 0: measured harmful in
  // every configuration tried — from the blob seed it has no job (the seed
  // already fills the space) and it drags density CV 0.095 -> 0.238; from a
  // random seed it recovers some structure but still wrecks the even fill. The
  // schedule keeps it paired with the edge springs whenever it IS enabled.
  farRepel:      0,     // peak push at zero distance, px/iteration
  farLen:        300,   // half-strength distance, px
  // 1c. the attraction hierarchy (see SCHED in layout.js for the ramps).
  // Half-strength cohesions measured best: the blob seed already builds the
  // structure, so cohesion only needs to gather strays — CV 0.073 at these
  // values vs 0.102 at double. Pulling both cohesions to 0 trades a little
  // density (CV 0.095) for the shortest links (median 173 vs 214).
  // How tight cohesion gathers a group, as a FRACTION of the radius its pills need
  // at `air` spacing. At 1.0 only 1-3% of pills are outside it, so cohesion acts
  // purely as a STRAY-CATCHER — and that measured best (line purity 0.550, vs
  // 0.525 with cohesion off entirely and 0.44-0.53 at floor 0.35). The blob seed
  // already does the clustering; turning cohesion into a clumping force fights the
  // arrangement the seed made instead of helping it. Lower this only when
  // exploring with seedMode 1, where there is no seed structure to preserve.
  cohesionFloor: 1.0,
  discPull:      0.04,  // pull toward the discipline centroid — first to fade
  linePull:      0.06,  // pull toward the line centroid — fades second
  edgePull:      0.15,  // prog/reg/variant same-line pairs — fades last
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
  ['__g2b', 'Attraction hierarchy (scheduled)'],
  ['cohesionFloor','2e. Cohesion tightness (frac of packed)', 0, 1.2, 0.05, 2],
  ['discPull',     '2f. Discipline cohesion (fades first)',   0, 0.30, 0.005, 3],
  ['linePull',     '2g. Line cohesion (fades second)',        0, 0.40, 0.005, 3],
  ['edgePull',     '2h. Edge springs (fades last)',           0, 0.50, 0.005, 3],
  ['collideAt',    '2i. Pill collisions start at (run frac)', 0, 1, 0.05, 2],
  ['seedMode',     '2j. Seed (0 = blobs, 1 = random)',        0, 1, 1, 0],
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
