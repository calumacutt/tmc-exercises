// Geometry constants and low-level SVG helpers for the wheel.
//
// Dropped in the module split as unused: R_DISC_IN, R_DISC_OUT, R_EX_IN,
// R_EX_OUT, GAP_DISC, fitText(), discColour(), exDotColour(). All were defined
// and never called. Re-add against a real need rather than restoring on spec.

const SIZE = 1600;             // SVG viewBox is square
const CX = SIZE / 2, CY = SIZE / 2;
const R_HUB = 150;             // inner pillar hub radius
// Inner edge of the exercise field. Was duplicated as R_HUB+26 in the layout and
// R_HUB+16 in chooseDiscRadius, so the radius calculation reserved slightly
// different space than the layout actually used. One constant now.
const R_INNER = R_HUB + 26;
const GAP_PILLAR = 0.012;      // radians of gap between pillars

const svg = document.getElementById('wheel');
const SVGNS = "http://www.w3.org/2000/svg";

function el(tag, attrs, parent) {
  const e = document.createElementNS(SVGNS, tag);
  for (const k in attrs) e.setAttribute(k, attrs[k]);
  if (parent) parent.appendChild(e);
  return e;
}
function polar(cx, cy, r, ang) { return [cx + r * Math.cos(ang), cy + r * Math.sin(ang)]; }

// annular sector path between two radii and two angles
function sectorPath(cx, cy, rIn, rOut, a0, a1) {
  const [x0o, y0o] = polar(cx, cy, rOut, a0);
  const [x1o, y1o] = polar(cx, cy, rOut, a1);
  const [x1i, y1i] = polar(cx, cy, rIn, a1);
  const [x0i, y0i] = polar(cx, cy, rIn, a0);
  const large = (a1 - a0) > Math.PI ? 1 : 0;
  return [
    `M ${x0o} ${y0o}`,
    `A ${rOut} ${rOut} 0 ${large} 1 ${x1o} ${y1o}`,
    `L ${x1i} ${y1i}`,
    `A ${rIn} ${rIn} 0 ${large} 0 ${x0i} ${y0i}`,
    "Z"
  ].join(" ");
}

// The <defs> element for the current render. buildNetwork() appends keystone
// gradients to it. Held here rather than on window so the dependency is visible.
let defs = null;
function setDefs(d) { defs = d; }
function getDefs() { return defs; }

const _measureCanvas = document.createElement('canvas');
const _mctx = _measureCanvas.getContext('2d');
function estLabelWidth(text, fs) {
  _mctx.font = `${fs}px Archivo, sans-serif`;
  return _mctx.measureText(text).width;
}

function getCSS(varName) {
  return getComputedStyle(document.documentElement).getPropertyValue(varName).trim() || "#000";
}

export {
  SIZE, CX, CY, R_HUB, R_INNER, GAP_PILLAR,
  svg, SVGNS, el, polar, sectorPath,
  setDefs, getDefs, estLabelWidth, getCSS,
};
