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
// Measure a label. `font` takes a full CSS font shorthand so callers can measure
// in the face they will actually RENDER in — the pillar titles are Fraunces while
// the default here is Archivo, and measuring the wrong face under-reserved their
// collision box. `tracking` is in em, because measureText ignores letter-spacing.
function estLabelWidth(text, fs, font, tracking) {
  _mctx.font = font || `${fs}px Archivo, sans-serif`;
  const w = _mctx.measureText(text).width;
  return w + (tracking || 0) * fs * Math.max(0, text.length - 1);
}

// The face + tracking the pillar titles are drawn in. Kept here so the measuring
// and the drawing cannot drift apart.
const TITLE_FONT = fs => `700 ${fs}px Quicksand, "Trebuchet MS", sans-serif`;
const TITLE_TRACKING = 0.08;

// Same contract for the masthead.
const MAST_FONT = fs => `800 ${fs}px "Baloo 2", "Trebuchet MS", sans-serif`;

function getCSS(varName) {
  return getComputedStyle(document.documentElement).getPropertyValue(varName).trim() || "#000";
}

export {
  SIZE, CX, CY, R_HUB, R_INNER, GAP_PILLAR,
  svg, SVGNS, el, polar, sectorPath,
  setDefs, getDefs, estLabelWidth, TITLE_FONT, TITLE_TRACKING, MAST_FONT, getCSS,
};
