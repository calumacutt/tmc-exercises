// Force-directed layout for the exercise scatter, plus the pill drawing it
// drives.
//
// NO FORCE COMES FROM DISCIPLINE, LINE, OR LINKS.
//
// The only soft force is pairwise repulsion between pills. Everything else is a
// hard constraint. Two things that LOOK like forces are not:
//
//  • Discipline and line CLUSTERING is built in the seed — hierarchical blobs —
//    not produced by attraction. The spacing force is contact-only, so it can
//    neither disperse a cluster nor fill a void, which makes the seed the right
//    and only place for structure. See the seed section.
//  • The relationship LINKS from Progressions / Regressions / Variant Of are a
//    purely descriptive overlay behind the "Show links" toggle, off by default.
//    They are collected and stroked after the layout has settled and had no say in
//    where anything went — which is exactly why they sprawl across the wheel.
//    Task 2.4 is where they start driving the layout, and that is a separate
//    decision.
//
// The line-derived forces that used to exist were all removed deliberately:
// spurious links from merely sharing a Discipline+Line, inter-line repulsion,
// per-line arc slots, and the angular "fan lines across the arc" pull.
//
// NOTE: buildNetwork() both computes positions and draws. Separating those is
// task 2.5 work.

import { TUNE } from './tune.js';
import { hsl, pillarBase, shade } from '../shared/taxonomy.js';
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
//  • hierarchical blob seeding places it near its discipline and its line
//  • force-directed relaxation spreads nodes apart from there, keeping them
//    inside the wedge and clear of the pillar titles and sector seams
//  • boundary keystones are pulled onto the seam they bridge
//
// Level and progressions still affect nothing. Discipline and line affect the
// SEED only, never a force.
function buildNetwork(sectorJobs, discR, opts = {}) {
  const { allNames, showLinks, onDone } = opts;
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
      // Keystones are the same KIND of object as everything else now — just
      // bigger, bold, with a gold star above them. They no longer get a luminous
      // fill, which is what frees the whole lightness ramp for disciplines.
      const kfs = ex.keystone ? fs + 3 : fs;
      const w = pillWidth(ex.name, kfs) * TUNE.pillScale;
      const pillH = pillHeight(kfs) * TUNE.pillScale;
      // The star sits ABOVE the pill, and the collision box grows to include it —
      // otherwise stars would sit on top of neighbouring pills. Same principle as
      // the pillar titles: collide on what is actually drawn.
      const iconH = ex.keystone ? pillH * 0.60 : 0;
      const iconGap = ex.keystone ? pillH * 0.14 : 0;
      const extra = iconH + iconGap;
      const h = pillH + extra;
      const node = {
        ex, job, isKey: ex.keystone,
        x: 0, y: 0, halfW: w / 2, halfH: h / 2, w, h,
        pillH, iconH, iconGap, extra,
        fs: kfs * TUNE.pillScale,
      };
      nodes.push(node);
      nodeByName.set(ex.name, node);
    }
  }

  // ---- discipline / line shading ----
  // Indices come from an ALPHABETICAL ordering of the disciplines present in each
  // pillar, and of the lines present in each discipline. Alphabetical rather than
  // by count so a discipline keeps the same tone as the sheet grows — see
  // shade() in shared/taxonomy.js.
  const discsOf = new Map();   // pillar -> [discipline]
  const linesOf = new Map();   // pillar|discipline -> [line]
  for (const node of nodes) {
    const p = node.job.pillar;
    const d = (node.ex.discipline || '(none)').trim();
    const l = (node.ex.line || '(none)').trim();
    if (!discsOf.has(p)) discsOf.set(p, new Set());
    discsOf.get(p).add(d);
    const dk = p + '|' + d;
    if (!linesOf.has(dk)) linesOf.set(dk, new Set());
    linesOf.get(dk).add(l);
  }
  const sortedDiscs = new Map();
  for (const [p, set] of discsOf) sortedDiscs.set(p, [...set].sort());
  const sortedLines = new Map();
  for (const [dk, set] of linesOf) sortedLines.set(dk, [...set].sort());

  for (const node of nodes) {
    const p = node.job.pillar;
    const d = (node.ex.discipline || '(none)').trim();
    const l = (node.ex.line || '(none)').trim();
    const ds = sortedDiscs.get(p), ls = sortedLines.get(p + '|' + d);
    node.shade = shade(p, ds.indexOf(d), ds.length, ls.indexOf(l), ls.length);
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

  // ---- seed positions: hierarchical blobs ----
  // The clusters are BUILT here rather than coaxed out with an attractive force,
  // and that is a deliberate consequence of how the spacing force works: it is
  // CONTACT-ONLY, firing only when two air-grown boxes overlap. So it cannot
  // disperse a cluster and it cannot fill a void — whatever the seed forms is
  // what you see. (Same reason removing radialFill let the seed's radial spread
  // show through unchanged.) An attractive force would be fighting nothing while
  // opening gaps that nothing can close.
  //
  // Three levels: the pillar wedge holds discipline blobs, each discipline blob
  // holds line sub-blobs, each sub-blob holds its exercises on an even-area
  // sunflower. Blobs are sized from the area their pills actually need, so
  // relaxation barely has to move anything and the blob keeps its shape.
  for (const job of sectorJobs) {
    const span = job.a1 - job.a0;
    const rng = mulberry32(hashStr(job.pillar));
    const jobNodes = job.exercises.map(ex => nodeByName.get(ex.name)).filter(Boolean);
    for (const node of jobNodes) { node.span = span; node.a0 = job.a0; node.a1 = job.a1; }

    // group into discipline -> line -> nodes, alphabetically for stability
    const byDisc = new Map();
    for (const n of jobNodes) {
      const d = (n.ex.discipline || '(none)').trim();
      const l = (n.ex.line || '(none)').trim();
      if (!byDisc.has(d)) byDisc.set(d, new Map());
      const lines = byDisc.get(d);
      if (!lines.has(l)) lines.set(l, []);
      lines.get(l).push(n);
    }

    const discBlobs = [...byDisc.entries()].sort((x, y) => x[0].localeCompare(y[0]))
      .map(([name, lines]) => {
        const members = [...lines.values()].flat();
        return { name, lines, members, br: packedRadius(members, TUNE.air) };
      });

    const wedgeArea = 0.5 * span * (discR * discR - innerR * innerR);
    scaleBlobs(discBlobs, wedgeArea, 0.68);
    placeBlobs(discBlobs, job.a0, job.a1, innerR, discR, false);

    for (const blob of discBlobs) {
      const lineBlobs = [...blob.lines.entries()].sort((x, y) => x[0].localeCompare(y[0]))
        .map(([name, members]) => ({ name, members, br: packedRadius(members, TUNE.air) }));
      if (lineBlobs.length === 1) {
        lineBlobs[0].x = blob.x; lineBlobs[0].y = blob.y; lineBlobs[0].br = blob.br;
      } else {
        scaleBlobs(lineBlobs, Math.PI * blob.br * blob.br, 0.62);
        // a discipline blob is a circle, so sub-blobs are placed in the full round
        placeBlobs(lineBlobs, 0, TWO_PI, 0, blob.br, true, blob.x, blob.y);
      }
      for (const lb of lineBlobs) sunflower(lb.members, lb.x, lb.y, lb.br, rng);
    }

    // Boundary keystones are pulled out of their blob and onto the seam they
    // bridge — that placement is the whole point of the treatment.
    for (const node of jobNodes) {
      if (!node.isBoundaryKey || node.seamAngle == null) continue;
      const r = Math.hypot(node.x - CX, node.y - CY) || (innerR + discR) / 2;
      node.x = CX + r * Math.cos(node.seamAngle);
      node.y = CY + r * Math.sin(node.seamAngle);
    }
  }

  // ---- relaxation ----
  // Two categories of movement, and only two:
  //
  //   HARD  snaps a pill fully back into a valid position — inside its sector's
  //         spokes and rings, clear of the pillar titles, not overlapping another
  //         pill. Runs FIRST each iteration so walls and solid objects take
  //         priority over pills jostling each other.
  //   SOFT  two pairwise repulsions between pills in the same pillar, at two
  //         different length scales: a strong CONTACT one (grown boxes must not
  //         overlap) and a light LONG-RANGE one with a Student-t falloff. Nothing
  //         else is a force.
  //
  // The one wrinkle is the boundary-keystone seam pull, which is soft but not
  // pairwise. It exists because those keystones are meant to sit ON a seam, and
  // it is paired with an exemption from the spoke walls. It affects 2 nodes.
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
  // Pillar titles are immovable obstacles in the hard pass. There is no longer a
  // soft title force as well — that was the same job done twice.
  const titleBoxes = sectorJobs
    .filter(j => j._title)
    .map(j => ({ x: j._title.x, y: j._title.y, halfW: j._title.halfW, halfH: j._title.halfH }));

  // Fail fast on a non-finite title box. These are obstacles in the hard pass,
  // so a single NaN here propagates into every node's position and the
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
  // The whole relaxation — iterations AND settle — is a GENERATOR, yielding once
  // per iteration/pass. driveLayout() below pulls steps inside a per-frame time
  // budget and updates the already-drawn pills, so the wheel is WATCHED settling
  // instead of freezing the page for the full run. Same math, same order, same
  // final picture: chunking changes when the work happens, not what it computes.
  const relaxSteps = function* () {
  for (let it = 0; it < ITER; it++) {
    // ---- HARD first: walls and solid objects take priority ----
    hardPass(nodes, titleBoxes, innerR, discR);

    // ---- SOFT: pairwise repulsion, and nothing else ----
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
    // SECOND SOFT FORCE — a light long-range repulsion between every pair in the
    // same sector, on top of (not instead of) the contact force above.
    //
    // Falloff is a STUDENT-T / CAUCHY kernel, 1 / (1 + (d/farLen)^2): peak at
    // touching, half strength at farLen, and a HEAVY TAIL. That kernel is the one
    // borrowed from t-SNE, and the heavy tail is the whole reason to borrow it —
    // t-SNE swapped SNE's Gaussian for a Student-t in the low-dimensional space
    // specifically to fix the "crowding problem", where a fast-decaying kernel left
    // moderately-distant points feeling almost no repulsion and everything piled
    // up. That is exactly the failure mode here, so an exponential or Gaussian
    // falloff is the wrong instrument: it decays so fast it is contact-only again
    // with extra arithmetic.
    //
    // One deliberate difference from real t-SNE. Its repulsive GRADIENT is
    // proportional to d / (1 + d^2)^2, which vanishes as d -> 0, because in t-SNE
    // the attractive term owns short range. Here the contact force owns short
    // range, and the ask was a force that simply weakens with distance, so this
    // uses the kernel VALUE rather than the gradient. Bonus: it is bounded at
    // d = 0, so unlike a Coulomb 1/d^2 there is no singularity to guard.
    //
    // ⚠️ DEFAULT OFF, because the reasoning that motivated it turns out to be
    // wrong in a way worth recording. The hope was density equalisation: deep in an
    // even cloud the contributions cancel by symmetry, and only a node at the edge
    // of a void feels a residual. The symmetry argument is fine — the boundary
    // argument is not. A purely repulsive force is MONOTONE, so it has no interior
    // equilibrium at all; the only place a node stops being pushed outward is the
    // wall. Over 600 iterations even a tiny bias accumulates, so the wedge
    // interior empties and the rim packs.
    //
    // Measured at 492 pills, against a baseline of CV 0.106 / outer ring 67 /
    // nearest-neighbour gap CV 0.143:
    //   farRepel 0.15, farLen 300 -> CV 0.184, outer ring 88, nn gap CV 0.432
    //   farRepel 0.04, farLen 300 -> CV 0.219, outer ring 92
    //   farRepel 0.15, farLen  75 -> CV 0.188, outer ring 86
    // Weaker did not help and neither did a short length scale, so this is
    // structural rather than a tuning miss. It also made LOCAL spacing markedly
    // less even (that nn gap CV), which is the opposite of the intent.
    //
    // t-SNE gets away with this kernel because it always pairs it with an
    // attractive term — attraction is what sets the scale and gives an interior
    // equilibrium. So the knob stays, at 0, for use ALONGSIDE an attractor; on its
    // own it is strictly worse than nothing.
    const AIR = TUNE.air;
    const FAR = TUNE.farRepel;
    const FAR_L2 = Math.max(1, TUNE.farLen * TUNE.farLen);
    for (let i = 0; i < nodes.length; i++) {
      const A = nodes[i];
      for (let k = i + 1; k < nodes.length; k++) {
        const B = nodes[k];
        if (!spacingApplies(A, B)) continue;
        const dx = B.x - A.x, dy = B.y - A.y;
        let push = 0;
        if (FAR > 0) push += FAR / (1 + (dx * dx + dy * dy) / FAR_L2);
        // The contact force, unchanged — same grown boxes, same least-overlap
        // push. It just can no longer `continue` out of the pair, because the far
        // term above applies whether or not the boxes are in contact.
        const overX = (A.halfW + B.halfW + AIR) - Math.abs(dx);
        if (overX > 0) {
          const overY = (A.halfH + B.halfH + AIR) - Math.abs(dy);
          if (overY > 0) push += Math.min(overX, overY) * 0.5 * TUNE.charge;
        }
        if (push === 0) continue;
        const dist = Math.hypot(dx, dy) || 1;
        const ux = dx / dist, uy = dy / dist;
        // Split the separation by MOBILITY rather than 50/50. A boundary keystone
        // is partly pinned — the seam pull drags it back after this force runs, so
        // any ground it wins here is given away again, and its neighbours ended up
        // measurably cramped (mean gap to 5 nearest: 50 against 60 for everything
        // else). It still takes a share, so it can slide along the seam and drift
        // slightly off it to find room; it just stops absorbing separation it
        // cannot keep. Total separation per pair is unchanged.
        const mA = mobility(A), mB = mobility(B), tot = mA + mB;
        const pA = push * 2 * mA / tot, pB = push * 2 * mB / tot;
        A.x -= ux * pA; A.y -= uy * pA;
        B.x += ux * pB; B.y += uy * pB;
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
    yield;
  }

  // ---- settle ----
  // Soft ran last inside the loop, so finish on hard constraints only. Repeating
  // converges on satisfying all of them at once instead of letting whichever ran
  // last win.
  for (let pass = 0; pass < 40; pass++) { hardPass(nodes, titleBoxes, innerR, discR); yield; }

  // ...but a hard pass ends with clampNode, so a WALL gets the last word and can
  // shove a pill back into a neighbour with nothing left to undo it. That is not
  // a convergence tail, it is structural: whatever the final clamp breaks, stays
  // broken. Measured (during the cohesion experiment, where attraction pressed
  // pills together hard enough to expose it) as a handful of overlaps that were
  // all the same shape — 0.3–4.3px of VERTICAL graze between pills almost exactly
  // on top of each other: the signature of a radial clamp nudging one pill into
  // the one above it.
  //
  // So give the last word to "pills do not touch". A pill can finish a few px
  // outside its spoke, invisible on a 3000px disc; two pills sharing a rounded
  // corner is not. Gauss-Seidel, so it runs until nothing is TOUCHING rather than
  // a fixed count — a fixed count is a guess that goes stale whenever a force
  // changes strength.
  let solidsPasses = 0;
  while (solidsPasses < SETTLE_SOLIDS_MAX) {
    solidsPasses++;
    if (solidsPass(nodes, titleBoxes) === 0) break;
    yield;
  }
  if (solidsPasses >= SETTLE_SOLIDS_MAX && solidsPass(nodes, titleBoxes) > 0) {
    // Not fatal — the residue is sub-pixel in practice — but silence here would
    // hide a real regression if a future force makes it structural.
    console.warn('[movement-wheel] overlap settle did not converge in ' +
      SETTLE_SOLIDS_MAX + ' passes; some pills may touch.');
  }

  };  // end of relaxSteps

  // ---- draw first, settle LIVE ----
  // Everything is drawn ONCE, at seed positions: links behind, then pills, then
  // titles on top — same z-order as before. Each pill lives in its own
  // <g transform>, so a frame update is ~500 attribute writes, which is cheap.
  // Links are purely descriptive at this stage: they exert NO force and have no
  // say in where anything goes. Task 2.4 is where that changes.
  const linkEls = showLinks ? drawLinks(collectLinks(nodes, nodeByName, allNames)) : [];
  for (const node of nodes) {
    drawPillNode(node);
  }
  for (const job of sectorJobs) {
    if (job._title) drawSectorTitle(job._title.lines, job._title.x, job._title.y, job._title.fs, job._title.base);
  }

  const sync = () => {
    for (const node of nodes) {
      node._g.setAttribute('transform',
        'translate(' + node.x.toFixed(2) + ' ' + node.y.toFixed(2) + ')');
    }
    for (const l of linkEls) {
      l.el.setAttribute('x1', l.a.x.toFixed(1)); l.el.setAttribute('y1', l.a.y.toFixed(1));
      l.el.setAttribute('x2', l.b.x.toFixed(1)); l.el.setAttribute('y2', l.b.y.toFixed(1));
    }
  };
  sync();
  return driveLayout(relaxSteps(), sync, onDone);
}

// Pull generator steps inside a per-frame time budget, paint, repeat. Returns a
// handle whose cancel() stops the run — render() calls it before starting a new
// layout so a slider drag cannot leave two relaxations fighting over the DOM.
function driveLayout(gen, onFrame, onDone) {
  let cancelled = false;
  const BUDGET_MS = 12;  // leaves ~4ms of a 60fps frame for painting
  // A HIDDEN tab gets no animation frames and clamps setTimeout to ~1/sec, so
  // chunking there would stretch a 6s layout into minutes. Nobody can see the
  // animation in a hidden tab anyway — run the whole generator in one blocking
  // pass instead. Checked per tick, so fronting the tab mid-run resumes the
  // smooth version and hiding it mid-run finishes the work immediately.
  const schedule = fn => document.hidden ? setTimeout(fn, 0) : requestAnimationFrame(fn);
  const tick = () => {
    if (cancelled) return;
    const hidden = document.hidden;
    const t0 = performance.now();
    let done = gen.next().done;
    while (!done && (hidden || performance.now() - t0 < BUDGET_MS)) done = gen.next().done;
    onFrame();
    if (done) { if (onDone) onDone(); return; }
    schedule(tick);
  };
  schedule(tick);
  return { cancel() { cancelled = true; } };
}


// ============================================================
// HARD CONSTRAINTS
// ============================================================
// Everything in here SNAPS a pill fully back into a valid position, as opposed
// to the single soft force (pairwise repulsion) which only nudges. Hard runs
// BEFORE soft each iteration, so pressure away from walls and solid objects
// takes priority over pills jostling each other.
//
// All of it collides on the pill's ACTUAL bounding box:
//   • the two spokes bounding its sector
//   • the inner and outer rings
//   • the pillar title boxes
//   • other pills
//
// Boundary keystones are exempt from the spoke walls — they are deliberately
// meant to straddle the seam they bridge, which is what earns them the two-tone
// split fill. Everything else is exempt from nothing.

const PAD_X = 12, PAD_Y = 8;   // desired clear space when resolving overlaps

// Distance from the wheel centre to the NEAREST and FARTHEST point of a pill's
// box. Used for the ring walls so they collide on the box, not the centre.
// Real relationships between exercises, from the sheet: Progressions,
// Regressions and Variant Of.
//
// Deduplicated by unordered PAIR, because the same relationship is usually stated
// twice — A lists B as a progression and B lists A as a regression — and drawing
// it from both ends would double the stroke and make it read heavier than a
// one-sided link.
//
// An endpoint that is filtered out (a hidden variant, or below the importance
// threshold) simply drops the link. A name that matches NOTHING is reported
// loudly: silent non-resolution is the exact trap CLAUDE.md §6.4 records.
function collectLinks(nodes, nodeByName, allNames) {
  const seen = new Set();
  const links = [];
  const broken = new Map();

  const add = (from, rawName, field) => {
    const name = (rawName || '').trim();
    if (!name) return;
    const to = nodeByName.get(name);
    if (!to) {
      // Two very different cases, and conflating them made the default view log
      // an error on every render. A name that exists in the sheet but is not on
      // the wheel is simply filtered out — a hidden variant, or below the
      // importance threshold — and that is expected, so stay quiet. A name that
      // exists NOWHERE is a typo, and that is worth shouting about.
      if (!allNames || !allNames.has(name)) {
        broken.set(field + ' → ' + name, from.ex.name);
      }
      return;
    }
    if (to === from) return;
    // '::' as the separator rather than an escape: exercise names never contain
    // it, and it keeps this file plain text. An earlier attempt used a NUL, which
    // is legal JS but makes the source binary to git, grep and diff.
    const key = [from.ex.name, name].sort().join('::');
    if (seen.has(key)) return;
    seen.add(key);
    links.push({ a: from, b: to });
  };

  for (const node of nodes) {
    for (const t of (node.ex.progressions || [])) add(node, t, 'Progressions');
    for (const t of (node.ex.regressions || [])) add(node, t, 'Regressions');
    add(node, node.ex.variantOf, 'Variant Of');
  }

  if (broken.size) {
    console.error(
      '[movement-wheel] ' + broken.size + ' relationship target(s) match no exercise '
      + 'in the sheet at all — likely typos: '
      + [...broken.entries()].slice(0, 12).map(([k, owner]) => k + ' (on "' + owner + '")').join('; ')
      + (broken.size > 12 ? '; …' : ''));
  }
  return links;
}

// Thin, quiet strokes. Drawn first so the pills sit on top and each line appears
// to emerge from a pill edge rather than crossing over the label.
// Returns {el, a, b} handles so the live sync can move the endpoints each frame.
function drawLinks(links) {
  const out = [];
  if (!links.length) return out;
  const g = el('g', {}, svg);
  for (const { a, b } of links) {
    out.push({ a, b, el: el('line', {
      x1: a.x, y1: a.y, x2: b.x, y2: b.y,
      stroke: '#fff', 'stroke-opacity': 0.22, 'stroke-width': 1,
    }, g) });
  }
  return out;
}

// Radius of a circle big enough to hold these pills at their desired spacing.
function packedRadius(members, air) {
  let area = 0;
  for (const n of members) area += (n.w + air) * (n.h + air);
  return Math.sqrt(area / Math.PI);
}

// Scale a set of blob radii so they collectively occupy `fill` of the container
// area. Circles cannot tile, so `fill` well under 1 is what actually packs. The
// clamp stops a pathological data shape from inflating or crushing every blob.
function scaleBlobs(blobs, containerArea, fill) {
  let sum = 0;
  for (const b of blobs) sum += Math.PI * b.br * b.br;
  if (sum <= 0) return;
  const k = Math.max(0.75, Math.min(1.7, Math.sqrt(fill * containerArea / sum)));
  for (const b of blobs) b.br *= k;
}

// Greedily place blob circles inside a wedge (or a full circle when `full`).
// Biggest first, and among feasible spots it prefers the SMALLEST radius — so
// small blobs fill the middle and large ones are pushed outward. That is not a
// rule I wrote: a wedge is narrower near the hub, so a large blob simply cannot
// fit there. The size→radius correlation falls out of the geometry.
function placeBlobs(blobs, a0, a1, rLo, rHi, full, ox = CX, oy = CY) {
  const placed = [];
  for (const b of [...blobs].sort((x, y) => y.br - x.br)) {
    let best = null, bestScore = Infinity;
    const RSTEPS = 30, ASTEPS = 30;
    for (let i = 0; i < RSTEPS; i++) {
      const rMin = rLo + b.br, rMax = rHi - b.br;
      if (rMax < rMin) continue;
      const r = rMin + (i + 0.5) / RSTEPS * (rMax - rMin);
      const angPad = full ? 0 : Math.min(b.br / Math.max(r, 1), (a1 - a0) / 2);
      if (!full && b.br > (a1 - a0) / 2 * r) continue;   // too wide for the wedge here
      for (let k = 0; k < ASTEPS; k++) {
        const lo = a0 + angPad, hi = a1 - angPad;
        if (hi < lo) continue;
        const ang = lo + (k + 0.5) / ASTEPS * (hi - lo);
        const x = ox + r * Math.cos(ang), y = oy + r * Math.sin(ang);
        let worst = 0;
        for (const p of placed) {
          worst = Math.max(worst, (b.br + p.br) - Math.hypot(x - p.x, y - p.y));
        }
        // no overlap dominates; ties broken toward the hub so the middle fills
        const score = Math.max(0, worst) * 1000 + r;
        if (score < bestScore) { bestScore = score; best = { x, y }; }
      }
    }
    if (!best) {
      // nothing feasible: park it at the outer edge on the centre line
      const r = Math.max(rLo, rHi - b.br), ang = (a0 + a1) / 2;
      best = { x: ox + r * Math.cos(ang), y: oy + r * Math.sin(ang) };
    }
    b.x = best.x; b.y = best.y;
    placed.push(b);
  }
}

// Even-area sunflower: radius by sqrt so density is uniform, angle by the golden
// angle so successive members never line up. Deterministic.
function sunflower(members, cx, cy, br, rng) {
  const GOLD = 2.399963229728653;
  const jitter = rng ? (rng() - 0.5) * 0.4 : 0;
  members.forEach((n, i) => {
    const f = (i + 0.5) / Math.max(members.length, 1);
    const r = br * Math.sqrt(f);
    const a = i * GOLD + jitter;
    n.x = cx + r * Math.cos(a);
    n.y = cy + r * Math.sin(a);
  });
}

// How much of a pair's separation a node absorbs. 1 is fully mobile. A boundary
// keystone is held toward its seam by the seam pull, so it cannot keep everything
// it is given — it takes a reduced share and the mobile neighbour takes the rest.
// Deliberately NOT zero: at zero it would be glued in place like a pillar title,
// and it still needs to slide along the seam and drift a little off it to settle.
// Cap on the settle convergence loop, purely a runaway guard: it normally exits
// in a handful of passes, and a pass is O(n^2) box tests with no wall arithmetic.
const SETTLE_SOLIDS_MAX = 200;

const PINNED_MOBILITY = 0.25;
function mobility(node) {
  return node.isBoundaryKey ? PINNED_MOBILITY : 1;
}

// Does the pairwise spacing force apply to this pair?
//
// Normally same-pillar only — pills in different pillars are separated by the
// hard spoke walls, so spacing them softly across a seam would just fight the
// walls. The exception is a boundary keystone: it deliberately straddles a seam
// and belongs to BOTH pillars, so it must space against the pillar it bridges as
// well. Without this its neighbours on the far side of the seam felt no force at
// all and crowded right up to the hard 12/8px pad.
function spacingApplies(A, B) {
  if (A.job.pillar === B.job.pillar) return true;
  if (A.isBoundaryKey && A.bridgePillar === B.job.pillar) return true;
  if (B.isBoundaryKey && B.bridgePillar === A.job.pillar) return true;
  return false;
}

function boxRadii(node) {
  const dx = Math.abs(node.x - CX), dy = Math.abs(node.y - CY);
  const nearX = Math.max(0, dx - node.halfW), nearY = Math.max(0, dy - node.halfH);
  return {
    near: Math.hypot(nearX, nearY),
    far: Math.hypot(dx + node.halfW, dy + node.halfH),
  };
}

// Push a pill inside one spoke. The spoke is the ray from the centre at `ang`;
// `inward` is the unit normal pointing into the sector. Returns the distance it
// had to move (0 if it was already clear).
function clampToSpoke(node, ang, inwardX, inwardY) {
  let worst = Infinity;
  for (const sx of [-1, 1]) {
    for (const sy of [-1, 1]) {
      const px = node.x + sx * node.halfW - CX;
      const py = node.y + sy * node.halfH - CY;
      worst = Math.min(worst, px * inwardX + py * inwardY);
    }
  }
  if (worst >= 0) return 0;
  node.x += inwardX * -worst;
  node.y += inwardY * -worst;
  return -worst;
}

function clampNode(node, innerR, discR) {
  // ---- rings, on the box ----
  const ringClamp = () => {
    const { near, far } = boxRadii(node);
    const dx = node.x - CX, dy = node.y - CY;
    const r = Math.hypot(dx, dy) || 1;
    if (near < innerR) {
      const push = innerR - near;
      node.x += dx / r * push; node.y += dy / r * push;
    } else if (far > discR) {
      const pull = far - discR;
      node.x -= dx / r * pull; node.y -= dy / r * pull;
    }
  };

  ringClamp();

  // ---- spokes, on the box ----
  // Boundary keystones straddle their seam on purpose, so they skip this.
  if (!node.isBoundaryKey) {
    const n0x = -Math.sin(node.a0), n0y = Math.cos(node.a0);
    const n1x = Math.sin(node.a1), n1y = -Math.cos(node.a1);
    for (let pass = 0; pass < 6; pass++) {
      const m0 = clampToSpoke(node, node.a0, n0x, n0y);
      const m1 = clampToSpoke(node, node.a1, n1x, n1y);
      if (m0 === 0 && m1 === 0) break;
      if (pass >= 2) {
        // The two spokes are fighting: the pill is wider than the sector at this
        // radius. A wedge-shaped container resolves that by squeezing the pill
        // OUTWARD, where the arc is longer — so do exactly that rather than
        // wedging it at the centre line and calling it done.
        const dx = node.x - CX, dy = node.y - CY;
        const r = Math.hypot(dx, dy) || 1;
        node.x += dx / r * 6; node.y += dy / r * 6;
      }
    }
  }

  ringClamp();
}

// Resolve a real overlap between two boxes along the axis of least penetration —
// the cheapest way out. `share` splits the correction between them; pass 0 to
// move only the first.
// Resolves to the PADDED box, but reports whether the boxes were genuinely
// touching — overlapping with no pad at all.
//
// The distinction matters for convergence tests. The 12/8px pad is a preference:
// at full density the pills cannot all hold that much clearance, so "nothing
// needed moving" is unsatisfiable and useless as a stop condition — it burned a
// whole pass cap and then reported failure on a layout with zero actual overlaps.
// Genuine contact IS satisfiable, and is the thing that looks broken, so that is
// what callers get told about.
function resolveOverlap(A, B, share) {
  const dx = B.x - A.x, dy = B.y - A.y;
  const ox = (A.halfW + B.halfW + PAD_X) - Math.abs(dx);
  if (ox <= 0) return false;
  const oy = (A.halfH + B.halfH + PAD_Y) - Math.abs(dy);
  if (oy <= 0) return false;
  const touching = Math.abs(dx) < A.halfW + B.halfW
                && Math.abs(dy) < A.halfH + B.halfH;
  if (ox < oy) {
    const push = ox * (dx <= 0 ? 1 : -1);
    A.x += push * (1 - share); B.x -= push * share;
  } else {
    const push = oy * (dy <= 0 ? 1 : -1);
    A.y += push * (1 - share); B.y -= push * share;
  }
  return touching;
}

// Solid objects only: pill vs pill, then pill vs title. No walls. Returns the
// number of pairs in genuine contact — see resolveOverlap.
function solidsPass(nodes, titleBoxes) {
  let touching = 0;
  // pills vs pills — a hard constraint, not a force. Soft repulsion alone does
  // not prevent overlaps: measured, it left 14 of them at 492 pills.
  for (let i = 0; i < nodes.length; i++) {
    for (let k = i + 1; k < nodes.length; k++) {
      if (resolveOverlap(nodes[i], nodes[k], 0.5)) touching++;
    }
  }
  // pills vs titles — titles do not move, so the pill takes the whole push.
  // This replaces the old soft `titleRepel`, which was doing the same job twice.
  for (const node of nodes) {
    for (const t of titleBoxes) if (resolveOverlap(node, t, 0)) touching++;
  }
  return touching;
}

// One full hard pass: solid objects first, then the walls that contain them.
function hardPass(nodes, titleBoxes, innerR, discR) {
  solidsPass(nodes, titleBoxes);
  // walls last, so a pill shoved by a neighbour still ends up inside its sector
  for (const node of nodes) clampNode(node, innerR, discR);
}

function drawPillNode(node) {
  drawPill(node);
}

// A five-pointed star, centred, pointing up. `rOuter` is the circumscribed
// radius; 0.42 for the inner radius is the classic proportion.
function starPath(cx, cy, rOuter) {
  const rInner = rOuter * 0.42;
  let d = '';
  for (let i = 0; i < 10; i++) {
    const r = i % 2 === 0 ? rOuter : rInner;
    const a = -Math.PI / 2 + i * Math.PI / 5;
    d += (i ? 'L' : 'M') + (cx + r * Math.cos(a)).toFixed(2)
       + ',' + (cy + r * Math.sin(a)).toFixed(2);
  }
  return d + 'Z';
}

// Split a pillar title onto two lines when it is long, so the block is tall and
// narrow rather than wide — a wedge has more room radially than tangentially.
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
      // More saturated and less light than before (was s+6, l+24 capped at 82%),
      // which made the titles almost the same cream as the pill labels. Now they
      // read as a heading IN their pillar's colour rather than as bigger body text.
      fill: hsl(base.h, Math.min(base.s + 20, 88), Math.min(base.l + 10, 68)),
      'font-size': fs, class: 'w-pillar-label',
    }, g);
    t.textContent = ln;
  });
}

// One treatment for every pill. Discipline sets the FILL lightness, line sets the
// OUTLINE lightness, and the label flips to dark ink on the lighter fills so it
// stays readable across the whole ramp.
//
// Keystones are not a different kind of object any more: same fill, same outline
// rules, just a larger pill with BOLD text and a gold star above it. That is what makes the full
// lightness range usable for disciplines — previously keystones owned the bright
// end and the disciplines had to share what was left, which was invisible.
function drawPill(node) {
  const lab = node.ex;
  const base = pillarBase(node.job.pillar);
  const sh = node.shade;
  // Drawn RELATIVE to the origin inside a translated group, so the live layout
  // can move the whole pill (rect, star, label) with one transform write per
  // frame instead of redrawing it.
  const g = el('g', {
    transform: 'translate(' + node.x.toFixed(2) + ' ' + node.y.toFixed(2) + ')',
  }, svg);
  node._g = g;

  // The pill occupies the bottom of the collision box; the star fills the rest.
  const pillTop = -node.halfH + node.extra;
  const cyPill = pillTop + node.pillH / 2;
  const x = -node.halfW;
  const rx = node.pillH / 2;

  // Boundary keystones keep the two-tone split fill: their own pillar colour on
  // one half, the bridged pillar's on the other. That is the only visual for a
  // cross-pillar bridge, so it wins over the discipline shade for those 2 nodes.
  const isBoundary = node.isBoundaryKey && node.bridgePillar;
  let fill = sh.fill;
  let darkInk = sh.darkInk;
  if (isBoundary) {
    const other = pillarBase(node.bridgePillar);
    const gid = 'ksg-' + Math.random().toString(36).slice(2, 9);
    const grad = el('linearGradient', {
      id: gid, x1: '0%', y1: '0%', x2: '100%', y2: '0%',
      gradientUnits: 'objectBoundingBox',
    }, getDefs());
    el('stop', { offset: '0%', 'stop-color': hsl(base.h, base.s + 6, base.l) }, grad);
    el('stop', { offset: '46%', 'stop-color': hsl(base.h, base.s + 6, base.l) }, grad);
    el('stop', { offset: '54%', 'stop-color': hsl(other.h, other.s + 6, other.l) }, grad);
    el('stop', { offset: '100%', 'stop-color': hsl(other.h, other.s + 6, other.l) }, grad);
    fill = `url(#${gid})`;
    darkInk = true;
  }

  el('rect', {
    x, y: pillTop, width: node.w, height: node.pillH, rx, ry: rx,
    fill, 'fill-opacity': 0.94,
    stroke: sh.stroke, 'stroke-width': node.isKey ? 2 : 1.5,
  }, g);

  const ink = darkInk ? '#191410' : getCSS('--ink');

  if (node.isKey) {
    // Always GOLD, never the label ink. The star sits above the pill on the dark
    // canvas, not on the fill, so gold reads well against every pillar — and one
    // constant colour makes keystones legible as a single category across the
    // whole wheel, which a colour that flipped with the fill could not do.
    const r = node.iconH / 2;
    el('path', {
      d: starPath(0, pillTop - node.iconGap - r, r),
      fill: getCSS('--accent'),
    }, g);
  }

  // Weight comes from the CLASS, not a font-weight attribute: in SVG a CSS rule
  // beats a presentation attribute, so .w-ex-label's 400 silently won.
  const t = el('text', {
    x: 0, y: cyPill, 'text-anchor': 'middle', 'dominant-baseline': 'middle',
    fill: ink, 'font-size': node.fs,
    class: node.isKey ? 'w-ex-label w-ex-key' : 'w-ex-label',
  }, g);
  t.textContent = lab.name;
}

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
