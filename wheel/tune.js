// Force/layout parameters and the live tuning panel.
//
// These defaults were tuned by hand against real data; CLAUDE.md §9 records the
// table. Expect to retune after the typed edge list lands (task 2.4) — much of
// the current machinery is compensating for spurious line-derived links.

const TUNE = {
  iterations:    600,   // relaxation steps
  pillScale:     1.20,  // exercise pill size multiplier
  // 1. node-from-node area-fill charge (same pillar)
  charge:        2.50,  // strength of all-pairs node repulsion
  chargeRange:   320,   // reach in px
  // radial area fill (keeps density even hub->rim)
  radialFill:    0.05,  // pull toward even-area target radius
  // 3. keystone-to-boundary attraction
  keystoneSeam:  0.30,  // how strongly boundary keystones snap to the seam
  // 4. repulsion away from the pillar TITLE text boxes
  titleRepel:    16,    // strength (0 = off by default; raise to clear titles)
  titleRange:    150,   // reach in px around a title
  // 5. repulsion away from sector (pillar) boundary seams
  boundaryRepel: 0,     // strength (0 = off; raise to push exercises off seams)
  boundaryRange: 60,    // reach in px from the seam line
  // sector sizing
  angleExp:      0.70,  // arc allocation exponent (1=∝count, <1 compresses big pillars)
  titleSize:     30,    // fixed pillar title font size
};

// Slider definitions: [key, label, min, max, step, decimals]
const TUNE_DEFS = [
  ['__g2', 'Node spreading'],
  ['charge',       '2a. Node spreading (fill the wedge)',     0, 2.5, 0.05, 2],
  ['chargeRange',  '2b. Reach of node spreading (px)',        60, 320, 10, 0],
  ['radialFill',   '2c. Even-density pull (hub→rim)',         0, 0.25, 0.005, 3],
  ['__g3', 'Keystones'],
  ['keystoneSeam', '3. Pull boundary keystones to the seam',  0, 0.6, 0.01, 2],
  ['__g4', 'Title clearance'],
  ['titleRepel',   '4a. Push exercises off the pillar titles',0, 40, 1, 0],
  ['titleRange',   '4b. Reach around titles (px)',            40, 300, 10, 0],
  ['__g5', 'Sector boundaries'],
  ['boundaryRepel','5a. Push exercises off pillar seams',     0, 40, 1, 0],
  ['boundaryRange','5b. Reach from seam (px)',                10, 160, 5, 0],
  ['__g7', 'Sector sizing'],
  ['angleExp',     'Sector arc allocation (1=∝count, <1 evens)', 0.4, 1.6, 0.05, 2],
  ['titleSize',    'Pillar title size (fixed)',               16, 48, 1, 0],
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
