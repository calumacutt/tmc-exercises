// Force-directed layout for the exercise scatter, plus the pill drawing it
// drives.
//
// THE LAYOUT KNOWS NOTHING ABOUT LINES, AND NOTHING ABOUT LINKS.
//
// Both were removed deliberately. Links used to be generated because two
// exercises shared a Discipline+Line, which produced a mass of meaningless
// connections and made the force model fight its own data. The line-derived
// forces went the same way: inter-line repulsion, the per-line arc slots, and
// the angular "fan lines across the arc" pull.
//
// What remains is a pure scatter within each pillar wedge: per-node charge
// repulsion, an even-density radial fill, and clearance from the pillar titles
// and sector seams. Nothing about an exercise other than its pillar affects
// where it lands. Getting THAT to look right is the current focus — see
// PROGRESS 2.5.
//
// Task 2.3/2.4 will reintroduce links from a real typed edge list
// (progressions / regressions / components / related). Discipline and Line still
// exist in the data and still drive colour and grouping elsewhere; they simply
// exert no force here.
//
// NOTE: buildNetwork() both computes positions and draws. Separating those is
// task 2.5 work.

import { TUNE } from './tune.js';
import { hsl, pillarBase } from '../shared/taxonomy.js';
import {
  CX, CY, R_HUB, R_INNER, svg, el, polar, estLabelWidth, getCSS, getDefs,
} from './svg.js';

// Pick a disc radius large enough that the densest sector can hold its pills.
function chooseDiscRadius(jobs) {
  const innerR = R_INNER;
  let need = 0;
  let totalArea = 0;
  for (const j of jobs) {
    const span = j.a1 - j.a0;
    const frac = span / (Math.PI * 2);
    const fs = scatterFontSize(j.exercises.length, span);
    const lineH = fs + 20;            // pill height + breathing
    let area = 0;
    for (const e of j.exercises) {
      // extra breathing factor so pills don't have to bleed across edges to fit
      area += (pillWidth(e.name, fs) + 16) * lineH * 1.7;
    }
    // reserve room for the title obstacle (with clearance) too
    area += pillWidth(j.pillar, titleFontSize(span)) * (titleFontSize(span) + 30) * 1.5;
    totalArea += area;
    if (frac > 0) {
      const rNeeded = Math.sqrt(area / (frac * Math.PI) + innerR * innerR);
      if (rNeeded > need) need = rNeeded;
    }
  }
  const rTotal = Math.sqrt(totalArea / Math.PI + innerR * innerR);
  // grow freely with content; the network needs more room than a plain scatter
  // (links + radial strands), so scale up and use a generous cap.
  const R = Math.max(need, rTotal, R_HUB + 240) * 1.35;
  return Math.min(R, 3200);
}

function scatterFontSize(countInWedge, span) {
  let fs = 17;
  if (countInWedge > 6) fs = 15;
  if (countInWedge > 12) fs = 13.5;
  if (countInWedge > 22) fs = 12;
  if (countInWedge > 36) fs = 11;
  return fs;
}
function titleFontSize(span) {
  // fixed size regardless of sector width (driven by the tuning panel)
  return TUNE.titleSize;
}

// pill box dimensions for a label at a given font size
function pillWidth(text, fs) { return estLabelWidth(text, fs) + fs * 1.6; } // padding L+R
function pillHeight(fs) { return fs + 14; }

// Is point (x,y) inside the sector [a0,a1] x [innerR, outerR]? small bleed allowed.
function inWedge(x, y, a0, a1, innerR, outerR, bleedPx, bleedAng) {
  const dx = x - CX, dy = y - CY;
  const r = Math.sqrt(dx * dx + dy * dy);
  if (r < innerR - bleedPx || r > outerR + bleedPx) return false;
  let ang = Math.atan2(dy, dx);
  const TWO_PI = Math.PI * 2;
  while (ang < a0 - 0.5) ang += TWO_PI;
  while (ang > a1 + TWO_PI - 0.5) ang -= TWO_PI;
  return ang >= a0 - bleedAng && ang <= a1 + bleedAng;
}

// ============================================================
// SCATTER ENGINE
// ============================================================
// Places every exercise inside its pillar wedge:
//  • an even-density areal grid provides the target position
//  • force-directed relaxation spreads nodes apart from there, keeping them
//    inside the wedge and clear of the pillar titles and sector seams
//  • boundary keystones are pulled onto the seam they bridge
//
// The ONLY property of an exercise that affects where it lands is its pillar.
// Not its line, not its level, not its progressions.
function buildNetwork(sectorJobs, discR) {
  const innerR = R_INNER;
  const TWO_PI = Math.PI * 2;

  // ---- collect all exercises with their sector job ----
  const nodes = [];           // {ex, job, x, y, fs, w, h, isKey, ...}
  const nodeByName = new Map();
  const jobByPillar = new Map(sectorJobs.map(j => [j.pillar, j]));

  // font size: shared across the wheel, based on total count
  const total = sectorJobs.reduce((s, j) => s + j.exercises.length, 0);
  let fs = total > 90 ? 12 : total > 50 ? 13 : total > 24 ? 14 : 16;

  for (const job of sectorJobs) {
    for (const ex of job.exercises) {
      const w = pillWidth(ex.name, (ex.keystone ? fs + 2 : fs)) * TUNE.pillScale;
      const h = pillHeight(ex.keystone ? fs + 2 : fs) * TUNE.pillScale;
      const node = {
        ex, job, isKey: ex.keystone,
        x: 0, y: 0, halfW: w / 2, halfH: h / 2, w, h,
        fs: (ex.keystone ? fs + 2 : fs) * TUNE.pillScale,
      };
      nodes.push(node);
      nodeByName.set(ex.name, node);
    }
  }

  // Discipline -> pillar, so an Also Appears In reference can be resolved to a
  // pillar. The layout itself knows nothing about lines; this reads only the
  // discipline half of the reference, which is what determines the pillar.
  const pillarOfDiscipline = new Map();
  for (const node of nodes) {
    const d = (node.ex.discipline || '').trim();
    if (d && !pillarOfDiscipline.has(d)) pillarOfDiscipline.set(d, node.job.pillar);
  }

  // ---- keystone bridge analysis ----
  // For each keystone, find which OTHER pillars it bridges to, read straight
  // from Also Appears In. A keystone that bridges to an ADJACENT pillar is a
  // "boundary keystone": it sits on the shared seam and is drawn with a split
  // two-tone fill. We record the bridged pillar + the seam angle.
  //
  // This used to be derived from the cross edges. Reading Also Appears In
  // directly is both simpler and more honest — that column is where the
  // information came from all along — and it means removing the links did not
  // cost the boundary-keystone treatment.
  const adjOf = (pillar) => {
    const idx = sectorJobs.findIndex(j => j.pillar === pillar);
    const n = sectorJobs.length;
    return {
      prev: sectorJobs[(idx - 1 + n) % n],
      next: sectorJobs[(idx + 1) % n],
    };
  };
  for (const node of nodes) {
    node.seamAngle = null;
    node.bridgePillar = null;
    if (!node.isKey) continue;
    // collect pillars this keystone cross-references (other than its own)
    const linked = new Set();
    for (const ref of (node.ex.alsoAppearsIn || [])) {
      // "Discipline - Line" -> take the discipline half
      const disc = ref.split(' - ')[0].trim();
      const p = pillarOfDiscipline.get(disc);
      if (p && p !== node.job.pillar) linked.add(p);
    }
    // is any linked pillar adjacent to this one? if so it's a boundary keystone.
    // (read angles from the job — node.a0/a1 aren't seeded until the next block)
    const myJob = jobByPillar.get(node.job.pillar);
    const { prev, next } = adjOf(node.job.pillar);
    let seam = null, bp = null;
    if (linked.has(next.pillar)) { seam = myJob.a1; bp = next.pillar; }
    else if (linked.has(prev.pillar)) { seam = myJob.a0; bp = prev.pillar; }
    if (seam != null) { node.seamAngle = seam; node.bridgePillar = bp; node.isBoundaryKey = true; }
  }

  // ---- seed positions ----
  // ordinary nodes: low-discrepancy seed inside their wedge.
  // keystones: seeded near the boundary of their sector that faces the pillar
  // they bridge to (so they settle on the shared edge).
  for (const job of sectorJobs) {
    const span = job.a1 - job.a0;
    const rng = mulberry32(hashStr(job.pillar));
    const GOLDEN = 2.399963229728653;
    let i = 0;
    for (const ex of job.exercises) {
      const node = nodeByName.get(ex.name);
      const frac = (i + 0.5) / Math.max(job.exercises.length, 1);
      const rr = Math.sqrt(innerR * innerR + frac * (discR * discR - innerR * innerR));
      const baseFrac = ((i * GOLDEN) % TWO_PI) / TWO_PI;
      let aa = job.a0 + 0.04 + baseFrac * (span - 0.08);
      // boundary keystones: seed right on the shared seam
      if (node.isBoundaryKey && node.seamAngle != null) aa = node.seamAngle;
      node.x = CX + rr * Math.cos(aa);
      node.y = CY + rr * Math.sin(aa);
      node.span = span; node.a0 = job.a0; node.a1 = job.a1;
      i++;
    }
  }

  // even-area fill: within each pillar, place nodes on a low-discrepancy areal
  // grid across the WHOLE wedge (radius by sqrt-area for even density, angle by
  // a golden-ratio sweep across the arc). This is the attractor the relaxation
  // relaxes toward, so the wedge fills uniformly in 2D — radius AND arc — rather
  // than chains bunching on the centre axis of a wide pillar.
  for (const job of sectorJobs) {
    // Ordered by NAME, not by level and not by sheet order. Any order gives even
    // density — the order only decides which node lands where — so this is the
    // neutral deterministic choice. Sheet order would make radius correlate with
    // discipline, quietly reintroducing grouping.
    const pn = nodes.filter(n => n.job.pillar === job.pillar)
      .sort((a, b) => a.ex.name.localeCompare(b.ex.name));
    const N = pn.length;
    const span = job.a1 - job.a0;
    const GOLD = 0.6180339887;
    pn.forEach((n, i) => {
      const frac = (i + 0.5) / Math.max(N, 1);
      // compress toward a mid annulus (0.12..0.92) so the scatter stays compact
      // and doesn't stretch all the way from hub to rim.
      const cf = 0.12 + frac * 0.80;
      n.fillR = Math.sqrt(innerR * innerR + cf * (discR * discR - innerR * innerR));
      // Per-node ANGULAR target: a golden-ratio sweep across the wedge arc.
      // This is the other half of "even fill" and it went missing when the
      // line-based angular force was removed — leaving radius as the only
      // positional attractor, so nodes kept their seeded angle and slid in and
      // out radially, forming radial strands. Per node, not per line, so no
      // line-awareness comes back with it.
      const af = (i * GOLD) % 1;
      n.fillA = job.a0 + 0.06 + af * (span - 0.12);
    });
  }

  // ---- force-directed relaxation ----
  // Design goals:
  //  • every node carries a repulsive charge so a pillar's nodes spread to fill
  //    the whole wedge (incl. corners) rather than hugging the centre axis.
  //  • an even-density radial pull keeps it uniform hub→rim.
  //  • boundary keystones are drawn toward their shared seam.
  const ITER = TUNE.iterations;
  // per-pillar charge scales with how much room the pillar has per node, so a
  // wide-but-sparse pillar (e.g. Strength) pushes harder to fill its area.
  const pillarArea = new Map();
  for (const job of sectorJobs) {
    const area = 0.5 * (job.a1 - job.a0) * (discR * discR - innerR * innerR);
    pillarArea.set(job.pillar, area / Math.max(job.exercises.length, 1));
  }
  for (const node of nodes) {
    node.charge = Math.sqrt(pillarArea.get(node.job.pillar) || 4000);
  }
  // Pillar titles are immovable obstacles for the separation pass. The soft
  // title repulsion alone left pills sitting on titles, because it is a force
  // and can be outvoted; this makes clearance a hard constraint like pill/pill
  // overlap already was.
  const titleBoxes = sectorJobs
    .filter(j => j._title)
    .map(j => ({ x: j._title.x, y: j._title.y, halfW: j._title.halfW, halfH: j._title.halfH }));

  // Fail fast on a non-finite title box. These are obstacles in the separation
  // pass, so a single NaN here propagates into every node's position and the
  // whole wheel silently collapses — exactly the cascade CLAUDE.md §6.1
  // describes. It happens for real: a missing TUNE key makes titleR NaN, which
  // is invisible until every pill has no coordinates. Loud beats silent.
  for (const t of titleBoxes) {
    if (![t.x, t.y, t.halfW, t.halfH].every(Number.isFinite)) {
      throw new Error(
        'Pillar title box is not finite: ' + JSON.stringify(t) +
        ' — check TUNE.titlePos and TUNE.titleSize are set.');
    }
  }
  for (let it = 0; it < ITER; it++) {
    // charge repulsion: nearby same-pillar nodes repel so the pillar's nodes
    // spread to fill its wedge. Bounded + medium range so it fills area without
    // flinging everything to the rim (which would hollow out the middle).
    //
    // SPACING FORCE — aim for roughly equal clear air around every pill.
    //
    // Each pill claims a box grown by TUNE.air on all sides. Two pills are
    // "crowded" only when those grown boxes overlap, i.e. they are too close on
    // BOTH axes; clear on either axis means there is already air between them.
    // The push is the SMALLER of the two overlaps — the least movement that
    // would resolve the crowding — applied along the vector between CENTRES.
    //
    // Both halves matter:
    //  • measuring per-axis overlap of grown boxes (rather than hypot of the
    //    corner gap) means a pill sitting directly above another reads as
    //    crowded, which it is. hypot() let a vertical stack look far apart
    //    because its horizontal gap was zero.
    //  • pushing along CENTRES rather than along an axis is what lets a pill
    //    escape sideways. An axis-aligned push locks pills onto whichever axis
    //    they already share: for a vertical stack the horizontal gap is 0, so
    //    the push was purely vertical and the column could only ever get
    //    tighter. Measured, that gave nearest-neighbours 10:1 vertical over
    //    horizontal with a median horizontal gap of 0px.
    //
    // Overlap varies continuously, so unlike a min(gap) proximity term this
    // keeps a usable gradient instead of pinning every neighbour to a force cap.
    const AIR = TUNE.air;
    for (let i = 0; i < nodes.length; i++) {
      const A = nodes[i];
      for (let k = i + 1; k < nodes.length; k++) {
        const B = nodes[k];
        if (A.job.pillar !== B.job.pillar) continue;
        const dx = B.x - A.x, dy = B.y - A.y;
        const overX = (A.halfW + B.halfW + AIR) - Math.abs(dx);
        if (overX <= 0) continue;
        const overY = (A.halfH + B.halfH + AIR) - Math.abs(dy);
        if (overY <= 0) continue;
        const push = Math.min(overX, overY) * 0.5 * TUNE.charge;
        const dist = Math.hypot(dx, dy) || 1;
        const ux = dx / dist, uy = dy / dist;
        A.x -= ux * push; A.y -= uy * push;
        B.x += ux * push; B.y += uy * push;
      }
    }
    // area-fill containment: charge + line-spread push outward, which alone
    // hollows the centre. Pull each node toward its even-area target RADIUS so
    // the wedge fills uniformly hub→rim (no hollow, no rim pile).
    for (const node of nodes) {
      const dx = node.x - CX, dy = node.y - CY;
      const r = Math.hypot(dx, dy) || 1;
      const pull = (node.fillR - r) * TUNE.radialFill;
      node.x += dx / r * pull; node.y += dy / r * pull;
    }
    // angular even-fill: rotate each node toward its target ANGLE, the mirror of
    // the radial pull above. Without this the wedge fills in one dimension only.
    if (TUNE.angularFill > 0) {
      for (const node of nodes) {
        const dx = node.x - CX, dy = node.y - CY;
        const r = Math.hypot(dx, dy) || 1;
        const cur = Math.atan2(dy, dx);
        let tgt = node.fillA;
        while (tgt - cur > Math.PI) tgt -= TWO_PI;
        while (tgt - cur < -Math.PI) tgt += TWO_PI;
        const na = cur + (tgt - cur) * TUNE.angularFill;
        node.x = CX + r * Math.cos(na);
        node.y = CY + r * Math.sin(na);
      }
    }
    // boundary keystones: gentle pull toward their shared seam angle so they
    // settle exactly on the pillar border they bridge.
    for (const node of nodes) {
      if (!node.isBoundaryKey || node.seamAngle == null) continue;
      const dx = node.x - CX, dy = node.y - CY;
      const r = Math.hypot(dx, dy) || 1;
      let cur = Math.atan2(dy, dx);
      let target = node.seamAngle;
      while (target - cur > Math.PI) target -= TWO_PI;
      while (target - cur < -Math.PI) target += TWO_PI;
      const na = cur + (target - cur) * TUNE.keystoneSeam;
      node.x = CX + r * Math.cos(na);
      node.y = CY + r * Math.sin(na);
    }
    // 4. title repulsion: push exercises out of the pillar TITLE text box so
    // labels stay readable. Soft radial-ish shove away from each title centre.
    if (TUNE.titleRepel > 0) {
      for (const job of sectorJobs) {
        const ttl = job._title;
        if (!ttl) continue;
        const RR = TUNE.titleRange;
        for (const node of nodes) {
          const dx = node.x - ttl.x, dy = node.y - ttl.y;
          // Both boxes count. This used to subtract only the title's extent, so
          // a long pill whose CENTRE cleared the title but whose end overlapped
          // it felt no push at all — the main cause of pills sitting on titles.
          const ax = Math.max(0, Math.abs(dx) - ttl.halfW - node.halfW);
          const ay = Math.max(0, Math.abs(dy) - ttl.halfH - node.halfH);
          const d = Math.hypot(ax, ay);
          if (d > RR) continue;
          let ux = dx, uy = dy; const ul = Math.hypot(ux, uy) || 1;
          ux /= ul; uy /= ul;
          const mag = TUNE.titleRepel * (1 - d / RR);
          node.x += ux * mag; node.y += uy * mag;
        }
      }
    }
    // 5. sector-boundary repulsion: push exercises away from the seams between
    // pillars (the radial lines at a0/a1) so chains don't sit on the divider.
    // Keystones that are MEANT to bridge a seam are exempt.
    if (TUNE.boundaryRepel > 0) {
      for (const node of nodes) {
        if (node.isBoundaryKey) continue;
        const dx = node.x - CX, dy = node.y - CY;
        const r = Math.hypot(dx, dy) || 1;
        let ang = Math.atan2(dy, dx);
        // distance (in px, tangential) to each of the two seams
        for (const seam of [node.a0, node.a1]) {
          let da = ang - seam;
          while (da > Math.PI) da -= TWO_PI;
          while (da < -Math.PI) da += TWO_PI;
          const tang = da * r;                 // arc-length offset from seam
          if (Math.abs(tang) > TUNE.boundaryRange) continue;
          const sign = tang >= 0 ? 1 : -1;
          const mag = TUNE.boundaryRepel * (1 - Math.abs(tang) / TUNE.boundaryRange);
          // nudge angularly away from the seam
          const na = ang + sign * (mag / r);
          ang = na;
        }
        node.x = CX + r * Math.cos(ang);
        node.y = CY + r * Math.sin(ang);
      }
    }
    // hard overlap resolution + containment
    separate(nodes, titleBoxes);
    for (const node of nodes) clampNode(node, innerR, discR);
  }

  // ---- settle pass ----
  // clampNode is a HARD constraint and used to run last, which meant the final
  // thing to touch a node could shove it back inside its wedge directly on top
  // of a neighbour, with nothing left to undo that. Alternating separation and
  // clamping converges on satisfying both instead of letting the clamp win by
  // being last.
  for (let pass = 0; pass < 40; pass++) {
    separate(nodes, titleBoxes);
    for (const node of nodes) clampNode(node, innerR, discR);
  }

  // ---- draw pills, then titles on top ----
  for (const node of nodes) {
    drawPillNode(node);
  }
  for (const job of sectorJobs) {
    if (job._title) drawSectorTitle(job._title.lines, job._title.x, job._title.y, job._title.fs, job._title.base);
  }
}


// Hard, box-aware separation. Resolves any actual rectangle overlap by pushing
// along the axis of least penetration — the cheapest way out. Pill/pill pushes
// both apart; pill/title pushes only the pill, since titles do not move.
function separate(nodes, titleBoxes) {
  const padX = 12, padY = 8;
  for (let i = 0; i < nodes.length; i++) {
    for (let k = i + 1; k < nodes.length; k++) {
      const A = nodes[i], B = nodes[k];
      const dx = B.x - A.x, dy = B.y - A.y;
      const ox = (A.halfW + B.halfW + padX) - Math.abs(dx);
      const oy = (A.halfH + B.halfH + padY) - Math.abs(dy);
      if (ox <= 0 || oy <= 0) continue;
      if (ox < oy) {
        const push = ox / 2 * (dx <= 0 ? 1 : -1);
        A.x += push; B.x -= push;
      } else {
        const push = oy / 2 * (dy <= 0 ? 1 : -1);
        A.y += push; B.y -= push;
      }
    }
  }
  for (const node of nodes) {
    for (const t of titleBoxes) {
      const dx = node.x - t.x, dy = node.y - t.y;
      const ox = (node.halfW + t.halfW + padX) - Math.abs(dx);
      const oy = (node.halfH + t.halfH + padY) - Math.abs(dy);
      if (ox <= 0 || oy <= 0) continue;
      // whole push goes to the pill
      if (ox < oy) node.x += ox * (dx <= 0 ? -1 : 1);
      else         node.y += oy * (dy <= 0 ? -1 : 1);
    }
  }
}

function clampNode(node, innerR, discR) {
  const dx = node.x - CX, dy = node.y - CY;
  let r = Math.hypot(dx, dy);
  let ang = Math.atan2(dy, dx);
  const TWO_PI = Math.PI * 2;
  while (ang < node.a0 - Math.PI) ang += TWO_PI;
  while (ang > node.a0 + Math.PI) ang -= TWO_PI;
  // allow keystones to bleed past the boundary (to sit on the seam); boundary
  // keystones get extra bleed so they can centre right on the shared edge.
  const bleed = node.isBoundaryKey ? 0.14 : (node.isKey ? 0.06 : 0.0);
  const angHalf = Math.min((node.halfW + 4) / Math.max(r, 1), node.span * 0.5);
  const lo = node.a0 + 0.02 + angHalf - bleed, hi = node.a1 - 0.02 - angHalf + bleed;
  if (lo <= hi) {
    if (ang < lo) ang = lo; else if (ang > hi) ang = hi;
  } else { ang = (node.a0 + node.a1) / 2; }
  const rLo = innerR + node.halfH, rHi = discR - node.halfH * 0.5;
  if (r < rLo) r = rLo; else if (r > rHi) r = rHi;
  node.x = CX + r * Math.cos(ang);
  node.y = CY + r * Math.sin(ang);
}




// draw a pill for a network node (keystones rendered larger/bolder via drawPill)
function drawPillNode(node) {
  const base = pillarBase(node.job.pillar);
  drawPill({ lab: node.ex, x: node.x, y: node.y, w: node.w, h: node.h, node }, node.fs, base, node.job.pillar);
}

// wrap a long pillar name onto up to two lines
function wrapTitle(name) {
  if (name.length <= 14) return [name];
  // split on slash or space near the middle
  if (name.includes('/')) return name.split('/').map(s => s.trim());
  const words = name.split(' ');
  if (words.length === 1) return [name];
  const mid = Math.ceil(words.length / 2);
  return [words.slice(0, mid).join(' '), words.slice(mid).join(' ')];
}

function drawSectorTitle(lines, x, y, fs, base) {
  const g = el('g', {}, svg);
  const lh = fs + 2;
  const y0 = y - (lines.length - 1) * lh / 2;
  lines.forEach((ln, i) => {
    const t = el('text', {
      x, y: y0 + i * lh, 'text-anchor': 'middle', 'dominant-baseline': 'middle',
      fill: hsl(base.h, Math.min(base.s + 6, 80), Math.min(base.l + 24, 82)),
      'font-size': fs, class: 'w-pillar-label',
    }, g);
    t.textContent = ln;
  });
}

function drawPill(it, fs, base, pillar) {
  const lab = it.lab;
  const node = it.node;
  const g = el('g', {}, svg);
  const x = it.x - it.w / 2, y = it.y - it.h / 2;
  const rx = it.h / 2;

  if (!lab.keystone) {
    // ordinary pill: dark fill, faint pillar-coloured border
    el('rect', {
      x, y, width: it.w, height: it.h, rx, ry: rx,
      fill: hsl(base.h, base.s, 14), 'fill-opacity': 0.92,
      stroke: hsl(base.h, base.s, Math.min(base.l + 6, 64)),
      'stroke-width': 1.5,
    }, g);
    const t = el('text', {
      x: it.x, y: it.y, 'text-anchor': 'middle', 'dominant-baseline': 'middle',
      fill: getCSS('--ink'), 'font-size': fs, class: 'w-ex-label',
    }, g);
    t.textContent = lab.name;
    return;
  }

  // ---- KEYSTONE: luminous, colour-filled hub pill ----
  // Boundary keystones (straddle an adjacent pillar) get a split two-tone fill:
  // their own pillar colour on one half, the bridged pillar's colour on the
  // other — visually signalling they belong to both.
  const isBoundary = node && node.isBoundaryKey && node.bridgePillar;
  let fillRef;
  if (isBoundary) {
    const other = pillarBase(node.bridgePillar);
    // orient the gradient across the seam: own colour toward pillar interior,
    // bridged colour toward the neighbour. Compute split direction from the
    // angular position (perpendicular-ish to the radial seam reads best).
    const gid = 'ksg-' + Math.random().toString(36).slice(2, 9);
    const grad = el('linearGradient', {
      id: gid, x1: '0%', y1: '0%', x2: '100%', y2: '0%',
      gradientUnits: 'objectBoundingBox',
    }, getDefs());
    el('stop', { offset: '0%',  'stop-color': hsl(base.h, base.s + 6, base.l) }, grad);
    el('stop', { offset: '46%', 'stop-color': hsl(base.h, base.s + 6, base.l) }, grad);
    el('stop', { offset: '54%', 'stop-color': hsl(other.h, other.s + 6, other.l) }, grad);
    el('stop', { offset: '100%','stop-color': hsl(other.h, other.s + 6, other.l) }, grad);
    fillRef = `url(#${gid})`;
  } else {
    fillRef = hsl(base.h, Math.min(base.s + 10, 82), Math.min(base.l + 4, 60));
  }

  // NOTE: no glow halo here any more. Glow now means HEAT (CLAUDE.md §8.1) and
  // cannot mean two things at once. Keystones stay distinct through the luminous
  // fill, the larger pill and the dark ink label.
  // solid pill body
  el('rect', {
    x, y, width: it.w, height: it.h, rx, ry: rx,
    fill: fillRef,
    stroke: '#fff', 'stroke-opacity': 0.85, 'stroke-width': 1.5,
  }, g);
  // label: dark ink on the bright fill for contrast
  const t = el('text', {
    x: it.x, y: it.y, 'text-anchor': 'middle', 'dominant-baseline': 'middle',
    fill: '#1a1410', 'font-size': fs, 'font-weight': '700', class: 'w-ex-label',
  }, g);
  t.textContent = lab.name;
}

// small deterministic PRNG so layout is stable across re-renders
function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function hashStr(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}


export {
  buildNetwork, chooseDiscRadius, scatterFontSize, titleFontSize, pillWidth, wrapTitle,
};
