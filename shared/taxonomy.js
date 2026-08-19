// Pillar vocabulary, order and colours. Shared by every view.
//
// PILLAR_ORDER drives the arc order around the wheel. It is not cosmetic:
// boundary-keystone detection depends on which pillars sit adjacent, so
// heavily-bridged pairs are deliberately placed next to each other.
//
// Adding a pillar without adding its colour makes it render grey and silently
// wrong — see CLAUDE.md §6.2.

const PILLAR_ORDER = [
  "Handstands & Balance",
  "Strength & Capacity",
  "Mobility",
  "Flocomotion",
  "Object Play",
];
const PILLAR_COLOURS = {
  "Strength & Capacity":  { h: 8,  s: 58, l: 52 },   // clay red
  "Mobility":             { h: 145, s: 32, l: 46 },  // sage green
  "Handstands & Balance": { h: 42, s: 70, l: 54 },   // amber gold
  "Flocomotion":          { h: 268, s: 32, l: 58 },  // muted violet
  "Object Play":          { h: 198, s: 46, l: 52 },  // teal blue
};
const PILLAR_FALLBACK = { h: 30, s: 8, l: 55 };

function hsl(h, s, l) { return `hsl(${h} ${s}% ${l}%)`; }
function pillarBase(p) { return PILLAR_COLOURS[p] || PILLAR_FALLBACK; }
function pillarHubColour(p) { const b = pillarBase(p); return hsl(b.h, b.s, Math.max(22, b.l - 16)); }

// Discipline / line shading, per CLAUDE.md §8.1: HUE stays with the pillar,
// LIGHTNESS carries discipline and line. Heat gets the glow, so lightness is the
// only channel left for the taxonomy below pillar level.
//
// Discipline moves lightness a lot, line a little, so the hierarchy reads: within
// one pillar hue you see a few distinct tones (disciplines), each with finer
// variation inside it (lines).
//
// Callers pass indices from an ALPHABETICAL ordering, deliberately — not by
// exercise count. Count order would reshuffle every colour on the wheel whenever
// the sheet grows, so a discipline's tone would not be a stable identity.
const DISC_LIGHT_SPREAD = 30;   // lightness range across disciplines in a pillar
const LINE_LIGHT_SPREAD = 9;    // finer range across lines in a discipline

function shade(pillar, discIdx, discTotal, lineIdx, lineTotal) {
  const b = pillarBase(pillar);
  const spread = (idx, total, range) =>
    total <= 1 ? 0 : (idx / (total - 1) - 0.5) * range;
  const l = b.l
    + spread(discIdx, discTotal, DISC_LIGHT_SPREAD)
    + spread(lineIdx, lineTotal, LINE_LIGHT_SPREAD);
  return { h: b.h, s: b.s, l: Math.max(20, Math.min(76, l)) };
}

export {
  PILLAR_ORDER, PILLAR_COLOURS, PILLAR_FALLBACK,
  hsl, pillarBase, pillarHubColour, shade,
};
