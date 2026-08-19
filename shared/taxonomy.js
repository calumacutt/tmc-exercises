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

// Discipline / line appearance, per CLAUDE.md §8.1: HUE stays with the pillar,
// LIGHTNESS carries discipline and line. Heat gets the glow.
//
// The pill's FILL carries the discipline across a wide absolute lightness range,
// and the OUTLINE carries the line within it. An earlier version put both on the
// outline only and it was invisible in practice — on a dark pill a 1.5px border is
// simply not enough area to register a 5-point lightness step.
//
// The full lightness range is available because keystones no longer claim the
// bright end of it: they are now marked by size and a crown, not by a luminous
// fill. See drawPill().
//
// Lightness is ABSOLUTE, not an offset from the pillar's own lightness, so a
// discipline's tone means the same thing in every pillar and the ramp is
// predictable. Hue and saturation still come from the pillar.
const PILL_L_MIN = 15;   // darkest discipline
const PILL_L_MAX = 55;   // lightest — deliberately a mid-tone, not glaring
const INK_FLIP = 42;     // above this fill lightness the label needs dark ink
const DISC_LIGHT_SPREAD = PILL_L_MAX - PILL_L_MIN;

// Callers pass indices from an ALPHABETICAL ordering, deliberately — not by
// exercise count. Count order would reshuffle every colour on the wheel whenever
// the sheet grows, so a discipline's tone would not be a stable identity.
function shade(pillar, discIdx, discTotal, lineIdx, lineTotal) {
  const b = pillarBase(pillar);
  const at = (idx, total) => (total <= 1 ? 0.5 : idx / (total - 1));

  const fillL = PILL_L_MIN + at(discIdx, discTotal) * DISC_LIGHT_SPREAD;
  // The outline always sits clearly lighter than its fill, so the line signal
  // survives at the dark end of the discipline ramp too.
  const strokeL = Math.max(30, Math.min(86, fillL + 20 + at(lineIdx, lineTotal) * 20));

  return {
    fill: hsl(b.h, b.s, fillL),
    stroke: hsl(b.h, Math.min(b.s + 10, 80), strokeL),
    darkInk: fillL >= INK_FLIP,
    fillL,
  };
}

export {
  PILLAR_ORDER, PILLAR_COLOURS, PILLAR_FALLBACK,
  hsl, pillarBase, pillarHubColour, shade,
};
