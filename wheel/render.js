// Draws the wheel: sector fills, pillar titles, centre medallion, and the
// PNG/SVG export. The exercise network itself is drawn by layout.js.

import { state, IMP_SLIDER_MAX } from './state.js';
import { filterRows, groupData, collectExercises, validateRows } from '../shared/library.js';
import { hsl, pillarBase, pillarHubColour } from '../shared/taxonomy.js';
import { TUNE } from './tune.js';
import {
  buildNetwork, chooseDiscRadius, titleFontSize, pillWidth, wrapTitle,
} from './layout.js';
import { LOGO_DATA_URI } from './logo.js';
import {
  SIZE, CX, CY, R_HUB, R_INNER, GAP_PILLAR, svg, SVGNS, el, polar, sectorPath,
  setDefs, getCSS, estLabelWidth, TITLE_FONT, TITLE_TRACKING, MAST_FONT,
} from './svg.js';

function render() {
  const rows = filterRows(state.RAW, { ...state, impSliderMax: IMP_SLIDER_MAX });

  // Fail fast on data that would silently produce a broken layout. Exercise
  // names are the primary key: chains, progressions, Also Appears In and the
  // node index are all keyed by name, so a duplicate makes the graph ambiguous.
  const problems = validateRows(rows);
  if (problems.length) {
    showDataError(problems);
    return;
  }

  const groups = groupData(rows);
  const totalEx = groups.reduce((s, g) => s + g.count, 0);

  if (totalEx === 0) {
    showStatus("No exercises match the current filters.<br>Try raising the importance slider or enabling variants.");
    return;
  }

  // reveal svg
  document.getElementById('status').style.display = 'none';
  svg.style.display = 'block';
  svg.setAttribute('viewBox', `0 0 ${SIZE} ${SIZE}`);
  while (svg.firstChild) svg.removeChild(svg.firstChild);

  // background (so exported PNG/SVG carries the dark canvas)
  const bgRect = el('rect', { x: 0, y: 0, width: SIZE, height: SIZE, fill: getCSS('--bg') }, svg);

  // defs: the soft glow. Reserved for HEAT — see CLAUDE.md §8.1. It used to be
  // applied to keystone pills, but keystones already read as hubs from their
  // luminous fill, larger pill and dark ink label, so the glow channel is now
  // free to mean one thing only: how hot a region of the wheel is.
  const defs = el('defs', {}, svg);
  defs.innerHTML = `
    <filter id="ks-glow" x="-60%" y="-60%" width="220%" height="220%">
      <feGaussianBlur in="SourceAlpha" stdDeviation="4" result="b"/>
      <feFlood flood-color="#fff" flood-opacity="0.55" result="c"/>
      <feComposite in="c" in2="b" operator="in" result="g"/>
      <feMerge><feMergeNode in="g"/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>`;
  setDefs(defs);

  const TWO_PI = Math.PI * 2;
  const startAngle = -Math.PI / 2; // 12 o'clock

  // Angular allocation: a wide wedge is still narrow near the hub, so equal
  // angle-per-exercise leaves dense pillars cramped. Weight angle by count^EXP
  // with EXP>1 so busy pillars get disproportionately more arc — this pushes
  // the per-pillar *area* closer to proportional, giving dense sectors room.
  const ANGLE_EXP = TUNE.angleExp;
  const totalPillarGap = GAP_PILLAR * groups.length;
  const usable = TWO_PI - totalPillarGap;
  const weights = groups.map(g => Math.pow(g.count, ANGLE_EXP));
  const wTotal = weights.reduce((s, w) => s + w, 0);

  let ang = startAngle;
  const sectorJobs = []; // one job per pillar sector

  groups.forEach((g, i) => {
    const pillarSpan = usable * (weights[i] / wTotal);
    const pA0 = ang, pA1 = ang + pillarSpan;
    const pMid = (pA0 + pA1) / 2;
    sectorJobs.push({ pillar: g.pillar, a0: pA0, a1: pA1, mid: pMid, exercises: collectExercises(g) });
    ang = pA1 + GAP_PILLAR;
  });

  // ---- choose disc radius from the busiest sector ----
  const discR = chooseDiscRadius(sectorJobs);
  let maxUsedR = discR;

  // ---- draw sector fills + faint zones ----
  sectorJobs.forEach((job, i) => {
    const base = pillarBase(job.pillar);
    // Sector tint as a radial gradient rather than a flat wash: fainter at the
    // hub, stronger at the rim. Gives the disc depth and quietly carries the eye
    // outward, which is where the content actually is.
    const gid = `sect-${i}`;
    const grad = el('radialGradient', {
      id: gid, gradientUnits: 'userSpaceOnUse', cx: CX, cy: CY, r: discR,
    }, defs);
    const tint = hsl(base.h, base.s, base.l);
    el('stop', { offset: R_HUB / discR, 'stop-color': tint, 'stop-opacity': 0.05 }, grad);
    el('stop', { offset: 1, 'stop-color': tint, 'stop-opacity': 0.16 }, grad);
    el('path', {
      d: sectorPath(CX, CY, R_HUB, discR, job.a0, job.a1),
      fill: `url(#${gid})`,
      stroke: getCSS('--bg'), 'stroke-width': 3,
    }, svg);
    // hub sector (solid pillar colour) as the centre ring
    el('path', {
      d: sectorPath(CX, CY, 0, R_HUB, job.a0, job.a1),
      fill: pillarHubColour(job.pillar), stroke: getCSS('--bg'), 'stroke-width': 3,
    }, svg);
  });

  // Outer ring: the sectors used to just stop at the rim. A hairline frames the
  // disc and echoes the ring around the hub medallion.
  el('circle', {
    cx: CX, cy: CY, r: discR, fill: 'none',
    stroke: getCSS('--line'), 'stroke-width': 1.5, 'stroke-opacity': 0.45,
  }, svg);

  // ---- pillar titles (horizontal) ----
  for (const job of sectorJobs) {
    drawSectorTitleForJob(job, discR);
  }

  // ---- build + draw the exercise network across all sectors ----
  // The full name set lets the link builder tell a TYPO from an exercise that is
  // merely filtered out of this render, so only the former is reported.
  buildNetwork(sectorJobs, discR, new Set(state.RAW.map(r => r.name)));

  // ---- centre medallion: gym logo ----
  el('circle', { cx: CX, cy: CY, r: R_HUB - 8, fill: getCSS('--bg'), stroke: getCSS('--line'), 'stroke-width': 1.5 }, svg);
  const logoSize = (R_HUB - 8) * 1.5;  // logo diameter within the hub
  el('image', {
    href: LOGO_DATA_URI,
    x: CX - logoSize / 2, y: CY - logoSize / 2,
    width: logoSize, height: logoSize,
    preserveAspectRatio: 'xMidYMid meet',
  }, svg);

  // enable downloads
  document.getElementById('btn-png').disabled = false;
  document.getElementById('btn-svg').disabled = false;

  // Crop the viewBox to the actual content so the wheel fills the frame.
  const margin = 80;
  const R = maxUsedR + margin;
  const vbX = CX - R, vbY = CY - R, vbSize = R * 2;
  svg.setAttribute('viewBox', `${vbX} ${vbY} ${vbSize} ${vbSize}`);
  bgRect.setAttribute('x', vbX); bgRect.setAttribute('y', vbY);
  bgRect.setAttribute('width', vbSize); bgRect.setAttribute('height', vbSize);
  svg._vb = { x: vbX, y: vbY, size: vbSize };

  // Masthead goes in LAST, once the viewBox is known, and lives inside the SVG so
  // it travels with the PNG/SVG export — the page masthead is HTML, outside the
  // SVG, so the export used to carry nothing identifying it. A circle inscribed in
  // a square leaves ~21% of the canvas empty in the corners, so it costs no
  // layout room.
  drawMasthead(vbX, vbY, vbSize, discR);
}

function drawMasthead(vbX, vbY, vbSize, discR) {
  const pad = vbSize * 0.028;
  const cx = vbX + vbSize / 2, cy = vbY + vbSize / 2;
  const lines = ['TMC Pillars'];

  // Horizontal room left of the disc at a given height. The disc curves away as
  // you go up, so every line of the block has a different amount of space — and a
  // corner is a triangle, so this matters more than a single margin would suggest.
  const roomAt = (y, fs) => {
    const dy = Math.abs(y - cy);
    const inside = discR * discR - dy * dy;
    const discHalf = inside > 0 ? Math.sqrt(inside) : 0;
    return (cx - discHalf) - (vbX + pad) - fs * 0.5;
  };

  // Shrink until every line clears the disc at its own baseline.
  let fs = vbSize * 0.062;
  for (let attempt = 0; attempt < 40; attempt++) {
    const lh = fs * 1.02;
    const fits = lines.every((ln, i) => {
      const y = vbY + pad + fs * 0.85 + i * lh;
      return estLabelWidth(ln, fs, MAST_FONT(fs), 0) <= roomAt(y, fs);
    });
    if (fits) break;
    fs *= 0.94;
  }

  const lh = fs * 1.02;
  const g = el('g', {}, svg);
  lines.forEach((ln, i) => {
    const t = el('text', {
      x: vbX + pad, y: vbY + pad + fs * 0.85 + i * lh,
      fill: getCSS('--ink'), 'font-size': fs, class: 'w-mast',
    }, g);
    t.textContent = ln;
  });
}


// Draw just the pillar title for a sector (network handles the pills).
function drawSectorTitleForJob(job, discR) {
  const { pillar, a0, a1 } = job;
  const span = a1 - a0;
  const mid = (a0 + a1) / 2;
  // Third copy of this constant, missed when R_INNER was introduced — the title
  // was being placed from a different inner radius than the layout uses.
  const innerR = R_INNER;
  const base = pillarBase(pillar);
  const titleFs = titleFontSize(span);
  // Distance from hub to rim, 0..1. Sat at a hardcoded 0.40, which put the title
  // in the narrow part of the wedge where there is least room — so exercises
  // either side of it got squeezed. Now tunable; see TUNE.titlePos.
  const titleR = innerR + (discR - innerR) * TUNE.titlePos;
  const [tx, ty] = polar(CX, CY, titleR, mid);
  // Uppercased HERE rather than via CSS text-transform, so the string we measure
  // is the string we draw. A CSS-only transform would leave the collision box
  // measuring the shorter mixed-case text and silently under-reserve space.
  const titleLines = wrapTitle(pillar.toUpperCase());
  const measured = titleLines.map(
    l => estLabelWidth(l, titleFs, TITLE_FONT(titleFs), TITLE_TRACKING));
  job._title = { lines: titleLines, x: tx, y: ty, fs: titleFs, base,
                 halfW: Math.max(...measured) / 2 + 18,
                 halfH: (titleLines.length * (titleFs * 1.15)) / 2 + 14 };
}

function showStatus(html) {
  const s = document.getElementById('status');
  s.innerHTML = html;
  s.style.display = 'block';
  svg.style.display = 'none';
  document.getElementById('btn-png').disabled = true;
  document.getElementById('btn-svg').disabled = true;
}

function showDataError(problems) {
  const items = problems.map(p => `
    <li style="margin:0 0 12px">
      <div><strong style="color:var(--ink)">${escapeHTML(p.name)}</strong>
        <span style="opacity:.7">— ${escapeHTML(p.kind)}${p.count > 1 ? `, appears ${p.count} times` : ''}</span></div>
      <ul style="margin:4px 0 0 14px;padding:0;opacity:.8">
        ${p.where.map(w => `<li>${escapeHTML(w)}</li>`).join('')}
      </ul>
    </li>`).join('');
  showStatus(`
    <strong style="color:#e8896b">Can't draw the wheel — ${problems.length}
      data problem${problems.length > 1 ? 's' : ''} found.</strong><br>
    <div style="margin:10px 0 14px;opacity:.8;max-width:60ch">
      Exercise names are the primary key. Chains, Progressions, Regressions and
      Also Appears In all reference exercises by name, so a repeated name — or a
      name containing a list delimiter — makes the graph ambiguous. Rather than
      draw something subtly wrong, the wheel stops here.
    </div>
    <ul style="text-align:left;display:inline-block;margin:0;padding:0 0 0 16px">${items}</ul>`);
}

function escapeHTML(s) {
  return String(s).replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

// ============================================================
// EXPORT
// ============================================================
function serialisedSVG() {
  // clone and inline the font-family + colours already as attributes/classes.
  const clone = svg.cloneNode(true);
  clone.setAttribute('xmlns', SVGNS);
  // inline a <style> with the font declarations + class fonts so the file is standalone
  const style = document.createElementNS(SVGNS, 'style');
  style.textContent = `
    @import url('https://fonts.googleapis.com/css2?family=Baloo+2:wght@700;800&family=Quicksand:wght@600;700&family=Archivo:wght@400;500;600;700&display=swap');
    .w-pillar-label{font-family:'Quicksand','Trebuchet MS',sans-serif;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;}
    .w-ex-label{font-family:'Archivo',sans-serif;font-weight:400;letter-spacing:0.01em;}
    text.w-ex-label.w-ex-key{font-weight:700;}
    .w-mast{font-family:'Baloo 2','Trebuchet MS',sans-serif;font-weight:800;}
  `;
  clone.insertBefore(style, clone.firstChild);
  return new XMLSerializer().serializeToString(clone);
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

document.getElementById('btn-svg').addEventListener('click', () => {
  const blob = new Blob([serialisedSVG()], { type: 'image/svg+xml;charset=utf-8' });
  downloadBlob(blob, 'movement-wheel.svg');
});

document.getElementById('btn-png').addEventListener('click', () => {
  const svgText = serialisedSVG();
  const vb = svg._vb || { size: SIZE };
  const out = 2000; // export resolution (square)
  const img = new Image();
  const svgBlob = new Blob([svgText], { type: 'image/svg+xml;charset=utf-8' });
  const url = URL.createObjectURL(svgBlob);
  img.onload = () => {
    const canvas = document.createElement('canvas');
    canvas.width = out; canvas.height = out;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = getCSS('--bg');
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    URL.revokeObjectURL(url);
    canvas.toBlob((blob) => downloadBlob(blob, 'movement-wheel.png'), 'image/png');
  };
  img.onerror = () => { URL.revokeObjectURL(url); alert('PNG export failed to rasterise the SVG.'); };
  img.src = url;
});

export { render, showStatus };
