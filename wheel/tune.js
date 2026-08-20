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
  air:           26,    // clear space each pill wants around it, px. This used to
                        // double as the force's RANGE, which made it useless as a
                        // counterweight to cohesion — reaching further and
                        // demanding more personal space were the same knob, so
                        // raising it inflated the very clusters it was meant to
                        // spread apart. Range is `spacingRange` now.
  spacingRange:  4.0,   // interaction radius = air * this. 1 = contact-only (the
                        // original force, algebraically unchanged — verified: it
                        // reproduces the pre-cohesion layout exactly)
  // 1b. discipline cohesion: pull each pill toward its own discipline's centre
  discPull:      0.10,  // 0 = disciplines held together by the seed alone
  // 2. keystone-to-seam attraction (boundary keystones only)
  keystoneSeam:  0.30,  // how strongly boundary keystones snap to the seam
  // 3. pillar title placement
  titlePos:      0.667, // title distance hub→rim (0..1)
  // sector sizing
  angleExp:      0.70,  // arc allocation exponent (1=∝count, <1 compresses big pillars)
  titleSize:     48,    // fixed pillar title font size
};

// Slider definitions: [key, label, min, max, step, decimals]
const TUNE_DEFS = [
  ['__g2', 'Soft forces'],
  ['charge',       '2a. Spacing push strength',               0, 2.5, 0.05, 2],
  ['air',          '2b. Spacing range / clear air per pill (px)', 4, 120, 2, 0],
  ['spacingRange', '2c. Spacing reach (x air, 1=contact only)', 1, 5, 0.1, 1],
  ['discPull',     '2d. Discipline cohesion',                 0, 0.30, 0.005, 3],
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
    const [key, label, min, max, step, dec] = def;
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
      scheduleRender();
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
