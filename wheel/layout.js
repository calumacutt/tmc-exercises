// Force-directed layout for the exercise network, plus the pill/link drawing it
// drives.
//
// NOTE: buildNetwork() both computes positions and draws. Separating those is
// task 2.4/2.5 work (replacing line-chaining with the typed edge list), not part
// of the mechanical split — pulling the draw helpers into render.js now would
// make layout.js and render.js mutually dependent for no gain.

import { TUNE } from './tune.js';
import { hsl, pillarBase } from '../shared/taxonomy.js';
import {
  CX, CY, R_HUB, svg, el, polar, estLabelWidth, getCSS, getDefs,
} from './svg.js';

// Pick a disc radius large enough that the densest sector can hold its pills.
function chooseDiscRadius(jobs) {
  const innerR = R_HUB + 16;
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
// NETWORK ENGINE
// ============================================================
// Builds one connected constellation across all sectors:
//  • each Line is a chain of its exercises, in series by level
//  • keystones with multi-line membership act as hubs: the chains of the lines
//    they belong to connect THROUGH the keystone node
//  • force-directed relaxation gives an organic layout; every node is anchored
//    to its pillar wedge, keystones are pulled toward the relevant boundary
function buildNetwork(sectorJobs, discR) {
  const innerR = R_HUB + 26;
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
        lineKey: (ex.discipline || '') + ' - ' + (ex.line || ''),
        x: 0, y: 0, halfW: w / 2, halfH: h / 2, w, h,
        fs: (ex.keystone ? fs + 2 : fs) * TUNE.pillScale,
      };
      nodes.push(node);
      nodeByName.set(ex.name, node);
    }
  }

  // ---- build line chains (per Discipline+Line), ordered low->high ----
  const lineMap = new Map();  // key -> [ex]
  for (const job of sectorJobs) {
    for (const ex of job.exercises) {
      const key = (ex.discipline || '') + ' - ' + (ex.line || '');
      if (!lineMap.has(key)) lineMap.set(key, []);
      lineMap.get(key).push(ex);
    }
  }
  const chains = new Map();    // key -> ordered [ex]
  for (const [key, exs] of lineMap) chains.set(key, orderChain(exs, nodeByName));

  // ---- edges ----
  const edges = [];            // {a:node, b:node, cross:bool}
  // chain edges (consecutive members of a line)
  for (const [key, ordered] of chains) {
    for (let i = 0; i + 1 < ordered.length; i++) {
      const a = nodeByName.get(ordered[i].name), b = nodeByName.get(ordered[i + 1].name);
      if (a && b) edges.push({ a, b, cross: false });
    }
  }
  // hub edges: keystone connects through to the lines it ALSO belongs to.
  for (const node of nodes) {
    if (!node.isKey) continue;
    const refs = node.ex.alsoAppearsIn || [];
    for (const ref of refs) {
      const targetChain = resolveChain(ref, chains);
      if (!targetChain || !targetChain.length) continue;
      // connect keystone to the nearest-level member of that line
      const lvl = node.ex.level || 5;
      let best = null, bestD = Infinity;
      for (const e of targetChain) {
        const d = Math.abs((e.level || 5) - lvl);
        if (d < bestD) { bestD = d; best = e; }
      }
      const b = best && nodeByName.get(best.name);
      if (b && b !== node) edges.push({ a: node, b, cross: true });
    }
  }

  // ---- keystone bridge analysis ----
  // For each keystone, find which OTHER pillars it bridges to (via its hub
  // edges / Also Appears In). A keystone that bridges to an ADJACENT pillar is
  // a "boundary keystone": it should sit on the shared seam and be drawn with a
  // split two-tone fill. We record the bridged pillar + the seam angle.
  const adjOf = (pillar) => {
    const idx = sectorJobs.findIndex(j => j.pillar === pillar);
    const n = sectorJobs.length;
    return {
      prev: sectorJobs[(idx - 1 + n) % n],
      next: sectorJobs[(idx + 1) % n],
    };
  };
  for (const node of nodes) {
    node.bridgePillars = [];
    node.seamAngle = null;
    node.bridgePillar = null;
    if (!node.isKey) continue;
    // collect pillars this keystone links to (other than its own)
    const linked = new Set();
    for (const e of edges) {
      if (!e.cross) continue;
      let other = null;
      if (e.a === node) other = e.b; else if (e.b === node) other = e.a;
      if (other && other.job.pillar !== node.job.pillar) linked.add(other.job.pillar);
    }
    node.bridgePillars = [...linked];
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
    const span = job.a1 - job.a0, mid = (job.a0 + job.a1) / 2;
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
      node.homeMid = mid; node.span = span; node.a0 = job.a0; node.a1 = job.a1;
      i++;
    }
  }

  // precompute a target radius per node from its level (low=near hub, high=rim)
  // so chains naturally flow outward as radial strands instead of tangling.
  const allLevels = nodes.map(n => n.ex.level || 5);
  const loL = Math.min(...allLevels), hiL = Math.max(...allLevels);
  for (const node of nodes) {
    const lv = node.ex.level || 5;
    const f = hiL === loL ? 0.5 : (lv - loL) / (hiL - loL);
    node.targetR = innerR + 30 + f * (discR - innerR - 60);
  }

  // even-area fill: within each pillar, place nodes on a low-discrepancy areal
  // grid across the WHOLE wedge (radius by sqrt-area for even density, angle by
  // a golden-ratio sweep across the arc). This is the attractor the relaxation
  // relaxes toward, so the wedge fills uniformly in 2D — radius AND arc — rather
  // than chains bunching on the centre axis of a wide pillar.
  for (const job of sectorJobs) {
    const pn = nodes.filter(n => n.job.pillar === job.pillar)
      .sort((a, b) => ((a.ex.level || 5) - (b.ex.level || 5)) || a.ex.name.localeCompare(b.ex.name));
    const N = pn.length;
    const span = job.a1 - job.a0;
    const GOLD = 0.6180339887;
    pn.forEach((n, i) => {
      const frac = (i + 0.5) / Math.max(N, 1);
      // compress toward a mid annulus (0.12..0.92) so chains stay compact and
      // don't stretch all the way from hub to rim.
      const cf = 0.12 + frac * 0.80;
      n.fillR = Math.sqrt(innerR * innerR + cf * (discR * discR - innerR * innerR));
      // angular target: golden sweep keeps it even & deterministic across arc
      const af = (i * GOLD) % 1;
      n.fillA = job.a0 + 0.06 + af * (span - 0.12);
    });
  }

  // group nodes by line within each pillar, for inter-line repulsion. Lines are
  // treated as units that claim territory, so they spread to fill the wedge
  // (not just avoid direct pill overlaps, which leaves empty corners).
  const lineGroups = new Map(); // pillar|lineKey -> [nodes]
  for (const node of nodes) {
    const gk = node.job.pillar + '|' + node.lineKey;
    if (!lineGroups.has(gk)) lineGroups.set(gk, []);
    lineGroups.get(gk).push(node);
  }
  const lineUnits = [...lineGroups.entries()].map(([gk, ns]) => ({
    gk, nodes: ns, pillar: ns[0].job.pillar, cx: 0, cy: 0,
  }));
  // assign each line an arc slot, evenly spread across its pillar's wedge, so a
  // wide wedge's lines fan out to fill the arc rather than clumping centrally.
  // Order lines deterministically (by mean level then key) for stable layout.
  const unitsByPillar = new Map();
  for (const u of lineUnits) {
    if (!unitsByPillar.has(u.pillar)) unitsByPillar.set(u.pillar, []);
    unitsByPillar.get(u.pillar).push(u);
  }
  for (const [pillar, us] of unitsByPillar) {
    const job = jobByPillar.get(pillar);
    const span = job.a1 - job.a0;
    us.sort((a, b) => {
      const ml = arr => arr.reduce((s, n) => s + (n.ex.level || 5), 0) / arr.length;
      return ml(a.nodes) - ml(b.nodes) || a.gk.localeCompare(b.gk);
    });
    const M = us.length;
    us.forEach((u, i) => {
      u.targetA = job.a0 + (M === 1 ? span / 2 : 0.08 + (i + 0.5) / M * (span - 0.16));
    });
  }

  // ---- force-directed relaxation ----
  // Design goals:
  //  • chains should flex and curl (NOT lock to rigid radial spokes), so the
  //    radial-level bias is only a faint hint, not a hard rail.
  //  • every node carries a repulsive charge so a pillar's nodes spread to fill
  //    the whole wedge (incl. corners) rather than hugging the centre axis.
  //  • lines still repel as units so different chains claim separate territory.
  //  • boundary keystones are drawn toward their shared seam.
  const ITER = TUNE.iterations;
  const idealLink = fs * TUNE.linkLen;        // desired link length
  const idealCross = fs * TUNE.crossLen;       // cross/hub links a bit longer
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
  for (let it = 0; it < ITER; it++) {
    const t = 1 - it / ITER;       // cooling
    // link springs (stiff, so chains stay coherent and readable as strands)
    for (const e of edges) {
      const dx = e.b.x - e.a.x, dy = e.b.y - e.a.y;
      const d = Math.hypot(dx, dy) || 1;
      const target = e.cross ? idealCross : idealLink;
      const f = (d - target) / d * TUNE.linkStiff * (e.cross ? 0.55 : 1);
      const fx = dx * f, fy = dy * f;
      e.a.x += fx; e.a.y += fy; e.b.x -= fx; e.b.y -= fy;
    }
    // radial level bias: a FAINT hint only, so chains can curve freely
    // instead of snapping into straight radial spokes. Fades as it cools.
    for (const node of nodes) {
      const dx = node.x - CX, dy = node.y - CY;
      const r = Math.hypot(dx, dy) || 1;
      const pull = (node.targetR - r) * 0.02 * t;
      node.x += dx / r * pull; node.y += dy / r * pull;
    }
    // charge repulsion: nearby same-pillar nodes repel so the pillar's nodes
    // spread to fill its wedge. Bounded + medium range so it fills area without
    // flinging everything to the rim (which would hollow out the middle).
    for (let i = 0; i < nodes.length; i++) {
      const A = nodes[i];
      for (let k = i + 1; k < nodes.length; k++) {
        const B = nodes[k];
        if (A.job.pillar !== B.job.pillar) continue;
        let dx = B.x - A.x, dy = B.y - A.y;
        let d2 = dx * dx + dy * dy;
        const RNG = TUNE.chargeRange;
        if (d2 > RNG * RNG) continue;
        let d = Math.sqrt(d2) || 1;
        const q = (A.charge + B.charge) * 0.5;
        const mag = Math.min(7, (q * q) / (d2 + 1200) * TUNE.charge);
        const ux = dx / d, uy = dy / d;
        A.x -= ux * mag; A.y -= uy * mag;
        B.x += ux * mag; B.y += uy * mag;
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
    // angular line spread: pull each LINE's centroid toward its assigned arc
    // slot so chains fan out across a wide wedge instead of bunching on the
    // centre axis. Acts on the whole line (keeps chains internally coherent).
    for (const u of lineUnits) {
      if (u.targetA == null) continue;
      let sx = 0, sy = 0;
      for (const n of u.nodes) { sx += n.x; sy += n.y; }
      const cx = sx / u.nodes.length, cy = sy / u.nodes.length;
      const r = Math.hypot(cx - CX, cy - CY) || 1;
      let cur = Math.atan2(cy - CY, cx - CX);
      let tgt = u.targetA;
      while (tgt - cur > Math.PI) tgt -= TWO_PI;
      while (tgt - cur < -Math.PI) tgt += TWO_PI;
      const da = (tgt - cur) * TUNE.angularSpread;
      // rotate each node about the hub by da (rigid rotation of the line)
      const ca = Math.cos(da), sa = Math.sin(da);
      for (const n of u.nodes) {
        const px = n.x - CX, py = n.y - CY;
        n.x = CX + px * ca - py * sa;
        n.y = CY + px * sa + py * ca;
      }
    }
    // inter-line repulsion: each line is a unit that claims territory, so lines
    // spread out to fill the wedge instead of clumping with empty corners.
    for (const u of lineUnits) {
      let sx = 0, sy = 0;
      for (const n of u.nodes) { sx += n.x; sy += n.y; }
      u.cx = sx / u.nodes.length; u.cy = sy / u.nodes.length;
    }
    const SPREAD = TUNE.lineRepel * (0.5 + 0.5 * t);   // cools over time
    const RANGE = discR * TUNE.lineRange;
    for (let i = 0; i < lineUnits.length; i++) {
      for (let k = i + 1; k < lineUnits.length; k++) {
        const A = lineUnits[i], B = lineUnits[k];
        if (A.pillar !== B.pillar) continue;   // keep spreading within a pillar
        let dx = B.cx - A.cx, dy = B.cy - A.cy;
        let d = Math.hypot(dx, dy) || 1;
        if (d > RANGE) continue;
        const mag = Math.min(SPREAD, SPREAD * (RANGE / (d + RANGE)));
        const ux = dx / d, uy = dy / d;
        for (const n of A.nodes) { n.x -= ux * mag; n.y -= uy * mag; }
        for (const n of B.nodes) { n.x += ux * mag; n.y += uy * mag; }
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
    // 6. anti-crossing: find pairs of links that intersect and push their
    // endpoints to reduce the crossing. For two crossing segments we shove the
    // midpoints apart and pull each segment's endpoints slightly toward its own
    // midpoint — together this tends to untangle the X into parallel strands.
    // Only checks same-pillar link pairs and skips pairs sharing an endpoint.
    if (TUNE.linkCross > 0) {
      for (let i = 0; i < edges.length; i++) {
        const e1 = edges[i];
        const p1 = e1.a.job.pillar;
        for (let k = i + 1; k < edges.length; k++) {
          const e2 = edges[k];
          if (e2.a.job.pillar !== p1) continue; // only within a pillar
          // skip if they share a node
          if (e1.a === e2.a || e1.a === e2.b || e1.b === e2.a || e1.b === e2.b) continue;
          if (!segmentsCross(e1.a, e1.b, e2.a, e2.b)) continue;
          // midpoints
          const m1x = (e1.a.x + e1.b.x) / 2, m1y = (e1.a.y + e1.b.y) / 2;
          const m2x = (e2.a.x + e2.b.x) / 2, m2y = (e2.a.y + e2.b.y) / 2;
          let dx = m1x - m2x, dy = m1y - m2y;
          let d = Math.hypot(dx, dy) || 1;
          const ux = dx / d, uy = dy / d;
          const mag = TUNE.linkCross;
          // push e1's endpoints one way, e2's the other
          e1.a.x += ux * mag; e1.a.y += uy * mag;
          e1.b.x += ux * mag; e1.b.y += uy * mag;
          e2.a.x -= ux * mag; e2.a.y -= uy * mag;
          e2.b.x -= ux * mag; e2.b.y -= uy * mag;
        }
      }
    }
    // 4. title repulsion: push exercises out of the pillar TITLE text box so
    // labels stay readable. Soft radial-ish shove away from each title centre.
    if (TUNE.titleRepel > 0) {
      for (const job of sectorJobs) {
        const ttl = job._title;
        if (!ttl) continue;
        const RR = TUNE.titleRange;
        for (const node of nodes) {
          let dx = node.x - ttl.x, dy = node.y - ttl.y;
          // account for the title's box extent so big titles clear more space
          const ax = Math.max(0, Math.abs(dx) - ttl.halfW);
          const ay = Math.max(0, Math.abs(dy) - ttl.halfH);
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
    // node repulsion (box-aware, hard overlap resolution — runs everywhere)
    for (let i = 0; i < nodes.length; i++) {
      for (let k = i + 1; k < nodes.length; k++) {
        const A = nodes[i], B = nodes[k];
        const dx = B.x - A.x, dy = B.y - A.y;
        const padX = 12, padY = 8;
        const ox = (A.halfW + B.halfW + padX) - Math.abs(dx);
        const oy = (A.halfH + B.halfH + padY) - Math.abs(dy);
        if (ox > 0 && oy > 0) {
          if (ox < oy) {
            const push = ox / 2 * (dx <= 0 ? 1 : -1);
            A.x += push; B.x -= push;
          } else {
            const push = oy / 2 * (dy <= 0 ? 1 : -1);
            A.y += push; B.y -= push;
          }
        }
      }
    }
    // sector anchoring + radial containment
    for (const node of nodes) clampNode(node, innerR, discR, t);
  }
  for (const node of nodes) clampNode(node, innerR, discR, 0);

  // ---- draw edges (behind), then pills, then titles on top ----
  for (const e of edges) {
    const base = pillarBase((e.a.isKey ? e.a.job.pillar : e.a.job.pillar));
    drawLink(e.a, e.b, base, e.cross);
  }
  for (const node of nodes) {
    drawPillNode(node);
  }
  for (const job of sectorJobs) {
    if (job._title) drawSectorTitle(job._title.lines, job._title.x, job._title.y, job._title.fs, job._title.base);
  }
}

// keep a node inside its wedge (angular) and the disc (radial). Keystones get a
// softer angular clamp so they can sit right on a boundary to bridge pillars.
// do segments AB and CD properly intersect? (endpoints as {x,y})
function segmentsCross(A, B, C, D) {
  const ccw = (p, q, r) => (r.y - p.y) * (q.x - p.x) - (q.y - p.y) * (r.x - p.x);
  const d1 = ccw(C, D, A), d2 = ccw(C, D, B);
  const d3 = ccw(A, B, C), d4 = ccw(A, B, D);
  return ((d1 > 0) !== (d2 > 0)) && ((d3 > 0) !== (d4 > 0));
}

function clampNode(node, innerR, discR, t) {
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

// order a line's exercises low->high using prog/reg first, level second
function orderChain(exs, nodeByName) {
  if (exs.length <= 1) return exs.slice();
  const set = new Set(exs.map(e => e.name));
  const next = new Map(), hasPred = new Set();
  for (const e of exs) {
    for (const p of (e.progressions || [])) if (set.has(p)) { next.set(e.name, p); hasPred.add(p); }
    for (const r of (e.regressions || [])) if (set.has(r)) { next.set(r, e.name); hasPred.add(e.name); }
  }
  const used = new Set(), ordered = [];
  const byName = new Map(exs.map(e => [e.name, e]));
  const heads = exs.filter(e => !hasPred.has(e.name)).sort((a, b) => (a.level || 5) - (b.level || 5));
  for (const h of heads) {
    let cur = h.name, guard = 0;
    while (cur && !used.has(cur) && guard++ < 100) {
      used.add(cur);
      if (byName.get(cur)) ordered.push(byName.get(cur));
      cur = next.get(cur);
    }
  }
  for (const e of exs.filter(e => !used.has(e.name)).sort((a, b) => (a.level || 5) - (b.level || 5))) ordered.push(e);
  return ordered;
}

// resolve an "Also Appears In" ref ("Discipline - Line" or a line) to a chain
function resolveChain(ref, chains) {
  const r = ref.toLowerCase().trim();
  for (const [key, arr] of chains) if (key.toLowerCase() === r) return arr;
  for (const [key, arr] of chains) if (key.toLowerCase().endsWith('- ' + r)) return arr;
  for (const [key, arr] of chains) if (key.toLowerCase().split(' - ')[1] === r) return arr;
  return null;
}

// link line behind pills; cross/hub links dashed + fainter
function drawLink(a, b, base, isCross) {
  el('line', {
    x1: a.x, y1: a.y, x2: b.x, y2: b.y,
    stroke: hsl(base.h, base.s, isCross ? 50 : 58),
    'stroke-width': isCross ? 1.6 : 2.2,
    'stroke-opacity': isCross ? 0.45 : 0.6,
    'stroke-dasharray': isCross ? '5 5' : 'none',
    'stroke-linecap': 'round',
  }, svg);
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

  // outer glow halo
  el('rect', {
    x, y, width: it.w, height: it.h, rx, ry: rx,
    fill: fillRef, filter: 'url(#ks-glow)',
  }, g);
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
