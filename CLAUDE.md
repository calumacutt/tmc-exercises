# CLAUDE.md — The Ultimate Mover / TMC Movement Toolkit

Read this first, every session. It is the durable reference: architecture,
data contract, hard-won constraints, and traps. Task state lives in
`PROGRESS.md`, not here.

---

## 1. What this project is

**The Movement Collective (TMC)** is a generalist movement gym in Newcastle,
NSW (Ido Portal–inspired: calisthenics, gymnastics, dance, acro, juggling,
hand balancing, locomotion). Calum does freelance software work for the gym
owner.

The goal is to **codify the gym owner's intuitive programming process into
digital tools.** He currently writes 6-week class programs from experience and
memory — he knows what's been trained recently, what needs attention, what's
important. That intuition is the thing being turned into software so that other
coaches (and eventually franchisees) can do the same job repeatably.

Three components:

| # | Component | Status | Purpose |
|---|---|---|---|
| 1 | **Movement Library** (Google Sheet) | ~400 exercises, actively being filled | Single source of truth. Exercises + metadata + relationships. Powers everything else. |
| 2 | **Movement Wheel** (static site) | Working, needs rework | Radial constellation of every exercise. Shows breadth and interconnection. Audience-facing: inspire and impress, remind people of exercises, subtly teach structure. |
| 3 | **Program Builder** (static site) | Working, hard-coded data | The real tool. Heat map → goal selection → drag-and-drop program construction → scoring → export. |

A fourth artifact, the **Movement Pillars** visualisation, exists but is
**out of scope** — do not work on it.

---

## 2. Repo layout and hosting

Hosted free on **GitHub Pages**, no build step. Plain ES modules, served
directly. See §3 for the constraint this imposes.

```
/                          GitHub Pages root
├── index.html             hub page: links to the tools
├── CLAUDE.md              this file
├── PROGRESS.md            task state / next actions
├── README.md              human-facing intro
├── data/
│   ├── movement-library.csv     committed snapshot (deterministic tests)
│   └── SHEET.md                 published CSV URL + column contract
├── shared/                      used by BOTH sites — no duplication
│   ├── csv.js                   tolerant CSV parsing
│   ├── library.js               row → exercise model + validation
│   ├── graph.js                 typed edge list → graph
│   ├── heat.js                  hot / cold / half-baked / burnt engine
│   ├── taxonomy.js              pillar / discipline / line, colours, order
│   └── selection.js             cross-view "selected exercise" state
├── wheel/
│   ├── index.html
│   ├── layout.js                force-directed engine
│   ├── render.js                SVG drawing
│   └── tune.js                  parameter panel + defaults
├── builder/
│   ├── index.html               (was the root tmc-exercises page)
│   ├── library-view.js
│   ├── keystone-view.js
│   ├── wheel-view.js            imports ../wheel/layout.js
│   ├── program.js               sections, slots, drag & drop
│   ├── blocks.js                named prebuilt combos
│   └── score.js                 goal metric
├── archive/                     kept, not maintained
│   ├── movement_pillars.html
│   └── movement_columns.html
└── tools/serve.sh               local dev server
```

**Why `shared/` matters:** the heat engine is consumed by the heat map, the
goal-selection targets, and the end-of-program score. The graph builder is
consumed by the wheel, the keystone view, and the score. Writing either twice
guarantees the views eventually disagree with each other.

**URL note:** the Program Builder used to be served from the repo root. Moving
it to `/builder/` changes its URL. Root becomes a hub page, which is a better
landing experience anyway, but any previously shared link now lands on the hub
rather than the tool.

---

## 3. Hosting constraints — read before splitting any file

**ES modules do not work over `file://`.** They require an HTTP origin. The
current `movement_wheel.html` is a single self-contained file, so it opens fine
by double-clicking. The moment it is split into modules, that stops working.

- **Local dev:** `python3 -m http.server 8000` from the repo root, then
  `http://localhost:8000/wheel/`. That is what `tools/serve.sh` does.
- **Playwright tests must use `http://localhost:...`, not `file://`.**
  This is a change from how the wheel was previously tested.
- GitHub Pages serves `.js` with the correct MIME type, so modules work in
  production with no configuration.

**Browsers cannot import HTML fragments.** There is no native include. Do not
attempt HTML partials. Keep each page's HTML a thin shell and put all real
logic in JS modules.

**CSS** can be split into separate files via `<link>` and works over `file://`
too.

**No build step, deliberately.** No npm, no bundler, no CI. If npm packages
become genuinely necessary later, the upgrade path is Vite + a GitHub Actions
deploy workflow — but do not introduce it pre-emptively.

---

## 4. The data contract

### Source of truth

The Google Sheet, published to web as CSV:

```
https://docs.google.com/spreadsheets/d/e/2PACX-1vQDrwHw-jGM7r3ZO_i8orZWvJ_wxmMdfnUy3lvdsqwZeJGv_EyEvsiB1HxG1qrXIyzgtMrlZMhirtcI/pub?gid=955669041&single=true&output=csv
```

The published endpoint sends permissive CORS headers, so browser fetch works.
**Also keep a committed snapshot at `data/movement-library.csv`** so tests are
deterministic and work offline.

### Parsing rules (preserve these)

- Column lookup is **by header name, case-insensitive**, via a `field()`
  helper that returns `""` when a header is absent.
- Therefore **column order is irrelevant** and **missing columns are safe**.
- Parsing tolerates header variants and trailing commas / trailing empty
  columns (the Sheet export has many).
- The data block may contain **blank spacer rows**; they are skipped by
  requiring a non-empty `Name`.

### Columns currently read

`Name`, `Pillar (auto)`, `Discipline`, `Line`, `Importance`, `Level`,
`Keystone`, `Variant Of`, `Status`, `Regressions`, `Progressions`,
`Also Appears In`

`Status` is read (a row matching `/^retired$/i` is filtered out) but is not
present in the current sheet.

### Columns confirmed NOT read — safe to delete

`Loadable`, `Session Type`, `Class Types`, `Movement Split`, `Equipment`,
`Video URL`, `Notes`

Fill rates when checked: Video URL 0, Movement Split 1, Notes 5, Equipment 18,
Session Type 19, Class Types 19, Loadable 368 (all `FALSE`). Only the 5 Notes
entries hold real content.

### Field semantics

| Field | Meaning |
|---|---|
| `Name` | **Primary key.** Must be globally unique. See §6. |
| `Pillar (auto)` | Derived from Discipline in the sheet via formula. |
| `Progressions` / `Regressions` | Comma-separated **exercise names**. Drive ordering. |
| `Also Appears In` | A `"Discipline - Line"` reference. Must match exactly or the link silently does not draw. |
| `Keystone` | `TRUE`/`FALSE`. Anchor exercise that bridges lines. |
| `Variant Of` | Parent exercise name. Variants hidden by default. |
| `Importance` | 1–3. Doubles as display filter **and** (planned) cooling rate. See §7. |
| `Level` | Difficulty. Mostly unfilled — see §7 for the inference plan. |

### Naming convention

Variants are written **`Base - Modifier`**, not `Modifier Base`:

- ✅ `Handstand - Stag`, `Front Lever - Tuck`, `Chin Up - Archer`,
  `Push Up - Fingertips`, `Bo-Staff - Palm Spin`, `Middle Splits - Sliding`
- ❌ `Stag Handstand`, `Tuck Front Lever`

305 names were normalised to this convention in a cleanup pass. When adding
exercises, follow it.

---

## 5. Taxonomy

### Pillars (live)

`Flocomotion`, `Strength & Capacity`, `Handstands & Balance`, `Object Play`,
`Mobility` — plus a **`Games` pillar recently added as a stopgap**.

**`Games` is scheduled for removal.** It is not a category of movement, it is a
*role in a class*. It becomes a value of the new `Session Role` field (§7).
Until then it is coloured orange: `{ h: 25, s: 62, l: 54 }`.

### Pillar colours (`shared/taxonomy.js`)

```js
"Strength & Capacity":  { h: 8,   s: 58, l: 52 }   // clay red
"Mobility":             { h: 145, s: 32, l: 46 }   // sage green
"Handstands & Balance": { h: 42,  s: 70, l: 54 }   // amber gold
"Flocomotion":          { h: 268, s: 32, l: 58 }   // muted violet
"Object Play":          { h: 198, s: 46, l: 52 }   // teal blue
"Games":                { h: 25,  s: 62, l: 54 }   // orange (temporary)
```

Legacy aliases `Strength/Capacity`, `Handstands/Balance`, `Acro/Flow` are also
mapped so old demo CSVs still colour correctly. **See §6 for the trap here.**

### Taxonomy v2 — designed, delivered, NOT YET ADOPTED

A full restructure was worked out and shipped as `library_v2.csv` +
`TAXONOMY_V2.md`. **The live sheet does not use it.** The live sheet has the
cleaned *names* but the *old* taxonomy, plus the new Games pillar.

v2 goes from 11 disciplines / 22 lines → **13 disciplines / 32 lines**, and
gives all 370 exercises a home with zero orphans. Its key findings:

1. **The sheet already referenced a line that did not exist.** Four rows had
   `Also Appears In = "Lever & Straight-Arm Body Control - Front Lever Line"`,
   but the Front Lever family was filed under Horizontal Pull. Somebody
   intended that line. v2 creates it, plus Back Lever Line, Planche Line and
   Straight-Arm Rotation.
2. **Back Lever and German Hang were under Pressing Strength → Horizontal
   Press.** They are straight-arm *pulling* holds.
3. **No lower-body strength existed at all.** Squats and hinges were scattered
   across Mobility (RDL, Good Mornings, Split Squat), Ground Locomotion
   (Walking Lunge), and nowhere (Kettlebell Swing had no Line). v2 adds a
   `Squat, Hinge & Single Leg` discipline.
4. **All 24–26 uncategorised rows were one missing line.** They are the entire
   frontal-plane hip cluster (pancakes, middle splits, frog, butterfly, 90/90,
   Copenhagen, horse stance) and the only hip line was "Hip Opening
   (frontal)". v2 adds `Hip Opening - Lateral`, which lands at exactly 20,
   balancing the 20 in frontal.
5. Vertical Pull was doing two jobs — strict pulling next to swinging/kipping.
   v2 splits out `Swinging & Brachiation`.
6. Arm isolation (curls, tricep extensions) was inside Horizontal Pull, making
   that line 28 items of unrelated work. v2 adds `Arms & Accessory`.

Adopting v2 is a **decision, not a mechanical step** — reconcile it against
whatever the owner has changed since, and against the Games dissolution.

---

## 6. Traps — things that have already bitten

### 6.1 Duplicate exercise names break entire pillars

**Name is the primary key.** The node index, within-line chains,
Progressions/Regressions and Also Appears In all resolve by name.

The failure mode, which cost a debugging session: a single duplicate
(`Bridge Circle`, present in both Flocomotion/Acrobatics and
Handstands/Bridge Work) caused **two whole pillars to collapse into an
illegible squashed strip.**

Mechanism:
1. Nodes were indexed in a `Map` keyed by name → two node objects, one map
   entry, second overwrote first.
2. Seeding assigned positions *by name lookup*, so the orphaned node never got
   coordinates or wedge angles.
3. `clampNode` did arithmetic on `undefined` → **`NaN` coordinates**.
4. `NaN` spread to every other node in the pillar through the same-pillar
   repulsion forces. Because the shared node was wired into *both* pillars'
   chains, it carried `NaN` across into the second pillar too.

**`NaN * 0 === NaN`, so turning the force sliders to zero did not stop the
propagation.** This was verified experimentally — disabling each force in turn
changed nothing. Do not debug this class of problem by zeroing parameters.

**Current handling: fail fast, by explicit decision.** `validateRows()` runs at
the top of `render()`. Any duplicate name → refuse to draw, show the offending
name, its occurrence count, and the full `Pillar › Discipline › Line` path of
each occurrence; disable the export buttons so a broken image cannot be saved.

An earlier attempt tolerated duplicates (a parallel per-line node index, plus
`NaN` guards in `clampNode`). **It was deliberately reverted** — Calum's call,
and the right one: it added complexity and would have made future bugs harder
to find. **Do not reintroduce defensive tolerance here.** If a lookup fails
now, it throws immediately, which is the desired behaviour.

One deliberate scoping choice: validation runs on the **filtered** rows, not
the whole sheet. So a duplicate hidden by the importance slider or the variants
toggle does not block rendering. That means no false alarms, but the error can
appear when the slider is raised. Switching to whole-sheet validation is a
one-line change if that trade is unwanted.

### 6.2 Pillar colour map must match real pillar names

Three pillars silently rendered **grey for an entire session** because
`PILLAR_COLOURS` still used old demo names (`Strength/Capacity`,
`Acro/Flow`) while the real sheet said `Strength & Capacity`, `Flocomotion`.
`pillarBase()` falls through to `PILLAR_FALLBACK` (a dull grey-brown) on a
miss — silently. When adding a pillar, add its colour.

### 6.3 `PILLAR_ORDER` is stale — outstanding issue

`PILLAR_ORDER` still lists the **old demo names**:

```js
["Handstands/Balance", "Strength/Capacity", "Mobility", "Acro/Flow", "Object Play"]
```

For real sheet data none of these match, so every pillar falls through to
"unknown → append in Map insertion order." **Pillar ordering around the wheel
is therefore effectively arbitrary.**

This matters more than cosmetics: **boundary-keystone detection depends on
pillar adjacency.** A keystone only gets the two-tone split fill and seam
placement when it bridges to a pillar that happens to sit *next to* its own.
With arbitrary order, which keystones straddle a seam is luck. In one test only
3 of 51 keystones rendered as split-fill. Fix `PILLAR_ORDER` to the real names
and choose an order that puts the heavily-bridged pairs adjacent
(Strength↔Handstands, Mobility↔Strength).

### 6.4 Broken `Also Appears In` references fail silently

The reference must match `"Discipline - Line"` exactly. A miss draws no link
and reports nothing. Four rows currently point at a non-existent Front Lever
Line. Consider adding this to `validateRows()` as a warning.

### 6.5 Google Fonts 403 in sandboxed test environments

Harmless. Fonts fall back to system. Not a bug.

---

## 7. Schema decisions already made (not yet implemented)

These were worked out deliberately. Implement them as described.

### 7.1 Typed edge list — replaces line-chaining

**The single highest-leverage change in the project.** Links are currently
generated because two exercises share a Discipline+Line. That is why there are
too many meaningless links, and why the spacing algorithm feels like it is
fighting the data — it is: the force layout is honouring a topology that does
not reflect real relationships.

Give every edge a **type**:

| Type | Meaning | Render |
|---|---|---|
| `progression` | A leads to B. Implies ordering. | Solid, strong spring |
| `variant` | Same movement, different shape | Solid, short spring |
| `component` | B is a prerequisite capability of A | Distinct style |
| `related` | Meaningfully linked, no ordering | Faint, weak spring |

This resolves the chin-up/muscle-up question: you do not have to decide whether
it is "really" a progression. Mark it `related` — drawn fainter, sprung more
weakly. **Only `progression` edges imply ordering.**

`component` edges *are* the keystone breakdown (press to handstand ← hip
flexion flexibility, pressing strength, handstand balance). One table serves
the wheel, the keystone view, and the program score.

**Where it lives:** a separate `Links` tab is cleaner graph hygiene but a worse
editing experience for the owner mid-fill. Keep it as **columns on the exercise
row** — `Progressions` and `Regressions` already exist; add `Related` and
`Components` — and normalise into a graph at load. Reciprocal edges can
contradict, so **the loader must reject contradictions loudly**, same posture
as the duplicate-name gate.

**Free consequence:** once progression edges are explicit, `Level` can be
**inferred by topological rank** instead of hand-filling ~400 rows. Seed a few
anchors, derive the rest, allow manual override.

### 7.2 `Session Role` — multi-value

Values: `warm-up/game`, `skill`, `strength`, `mobility`, `conditioning`.
An exercise can hold several; most will.

Does three jobs at once: dissolves the Games pillar, groups the Program Builder
shortlist the way a programmer actually reaches for exercises, and feeds the
balance metric (§7.5).

### 7.3 `cook` and `burn` — two fields, not three systems

Hot/cold, half-baked and burnt collapse to:

| Field | Meaning | Default |
|---|---|---|
| `cook` | Consecutive programs needed before it pays off. Below this → **half-baked**. | 1 (muscle up, dragon flag = 2) |
| `burn` | Max consecutive programs before it must rotate out → **burnt**. | blank = never burns (handstand) |

**Cooling rate needs no new field** — derive it from importance. High
importance cools faster, so the handstand is almost always cold and therefore
almost always wants programming.

### 7.4 Importance at Line and Discipline level

Set **manually**, not derived. Rationale: "we just want *something*
handstand-related in the program, it needn't be a specific straight-line
freestanding handstand." A specific exercise can be hot and low-priority while
its discipline is cold and urgent.

### 7.5 Heat engine — one pure function

`heat(programsSinceLastTrained, importance)`, aggregated at exercise, line and
discipline level. Consumed by the heat map, the goal-selection targets, and the
end-of-program score. The score is literally *"what would this discipline's
heat be after the program currently being designed is run?"*

**Write it once in `shared/heat.js`.** Three copies is how the three views end
up disagreeing.

### 7.6 Program format — export must equal import

Locking this is **urgent**, because there are three 6-week blocks of history to
enter by hand. It must include **program date or block index, section, and
concurrent slot**, or heat cannot be computed from it. Back-filling twice would
be miserable.

### 7.7 Program structure (replaces 3×20min / 3 concurrent)

| Section | Duration | Notes |
|---|---|---|
| 1 | 10 min | Warm-up or game |
| 2 | 5 min | Personal goals — **not programmed by the teacher** |
| 3 | 15 min | Skill or strength, programmer's choice |
| 4 | 15 min | " |
| 5 | 15 min | " |

Up to **4 concurrent exercises** per section.

### 7.8 Program Blocks

Named prebuilt combinations, e.g. **"The Jungle"** = rope climbs, lizard crawl,
L-sit hang, monkey crawl. Purpose is not only time-saving: it builds a vibe and
a thematic identity for the gym, and gives franchisees premade building blocks
instead of assembling from bare exercises every time.

Data shape: name, ordered exercise list, section hint. Decide the shape early
even though this ships last, so it is not retrofitted.

---

## 8. Two unresolved design tensions

Decide these before rebuilding the render layer.

### 8.1 Colour is oversubscribed

Three things want the colour channel: **pillar hue**, **discipline/line
shading**, and **hot/cold**. Something must move.

Proposal: heat as **glow intensity or opacity** — the keystone glow machinery
(`#ks-glow`) already does this — leaving hue for pillar and lightness for
discipline/line. Changing this later means reworking the renderer, so settle it
first.

### 8.2 Importance does double duty

It is both the display filter and the cooling rate. Coherent **only if**
"important" always means "should be trained often." Sanity-check against real
exercises; if anything is always-show but rarely-programmed, the field needs
splitting into two.

---

## 9. Movement Wheel — current implementation notes

Single file, ~1,656 lines, to be split per §2.

### Visual design language

- Dark warm charcoal, `--bg: #14110F`. Poster aesthetic.
- Fraunces + Archivo via Google Fonts CDN; falls back to system fonts.
- Title masthead "The Ultimate Mover" + TMC logo as an embedded base64 data
  URI (~80KB, original black-on-white **inverted to cream** for the dark hub).
- Deterministic seeded layout via `mulberry32` / `hashStr` — same input gives
  the same picture.
- Exports PNG and SVG. Background rect is drawn so exports carry the dark
  canvas.

### Pill rendering

- Ordinary: rounded-rect, dark fill, faint pillar-coloured border.
- **Keystone:** luminous pillar-colour fill + white glow halo
  (`filter: url(#ks-glow)`), dark ink label, slightly larger.
- **Boundary keystone** (keystone whose Also Appears In links to an *adjacent*
  pillar): **two-tone split fill** — own pillar colour on one half, bridged
  pillar's colour on the other — and pulled onto the shared seam angle.

### Force model and tuned defaults

A live tuning panel (collapsible, "⚙ Layout forces") exposes every parameter
and re-renders on change, debounced ~180ms, with a Reset button. These values
were tuned by hand and are the current defaults:

| Panel label | Key | Default |
|---|---|---|
| 1a Link stiffness | `linkStiff` | 0.05 |
| 1b Ideal link spacing | `linkLen` | 3.0 |
| 2a Line-from-line repulsion | `lineRepel` | 8 |
| 2b Line repulsion reach | `lineRange` | 0.6 |
| 2c Node spreading (fill wedge) | `charge` | 2.5 |
| 2d Node spreading reach (px) | `chargeRange` | 320 |
| 2e Even-density pull hub→rim | `radialFill` | 0.05 |
| 2f Fan lines across arc | `angularSpread` | 0.06 |
| 3 Keystone→seam attraction | `keystoneSeam` | 0.3 |
| 4a Title repulsion | `titleRepel` | 16 |
| 4b Title reach (px) | `titleRange` | 150 |
| 5a Sector-boundary repulsion | `boundaryRepel` | 0 |
| 5b Boundary reach (px) | `boundaryRange` | 60 |
| 6 Anti-crossing penalty | `linkCross` | 30.0 |
| Sector arc allocation | `angleExp` | 0.7 |
| Pillar title size (fixed) | `titleSize` | 30 |
| Exercise pill size | `pillScale` | 1.2 |
| Relaxation iterations | `iterations` | 600 |
| *(not exposed)* cross-link length | `crossLen` | 9.0 |

Notes on specific forces:

- **`angleExp`** is the arc-allocation exponent. At 1.0 each pillar gets arc
  proportional to exercise count; below 1.0 big pillars compress and small ones
  get room. It was hardcoded at 1.35, which is why Strength & Capacity
  ballooned. 0.7 balances it.
- **Title size is fixed** — it used to scale with sector width (22/30/38px).
- **Anti-crossing** only acts on genuine segment intersections (same pillar,
  not sharing an endpoint), so it is surgical.
- **Title repulsion and boundary repulsion are custom additions**, not part of
  the original engine.

**Expect to retune all of this after §7.1 lands.** Many of these values are
compensating for spurious line-derived links. With a real edge list the layout
should need *less* force machinery, not more — Calum's read is that the
algorithm is overcomplicated *because* of the excess links, and that is
probably right.

### Testing pattern

Playwright headless. Load page, `set_input_files("#file", csv)`, set importance
via `eval_on_selector("#imp", ...)`, screenshot the `<svg>`, assert on
`pageerror`. **After the module split, use `http://localhost:...` not
`file://`** (§3).

Useful assertions beyond "no errors":
- count `text.w-ex-label` = expected visible exercise count
- count `rect[filter='url(#ks-glow)']` = keystone count
- count `linearGradient[id^='ksg-']` = boundary-keystone count
- dump node coordinates and assert **all finite** — this is what caught the
  `NaN` cascade

---

## 10. Program Builder — current state

Lives in the repo as the old root `index.html`. Works, but:

- **Exercise data is hard-coded static.** Must be driven by the sheet, with
  filters for importance and "hide variants" (there are far too many exercises
  to list all).
- Keystone view is also hard-coded; should be driven by `component` edges.
- Drag-and-drop into class timelines is **buggy** — needs fixing.
- Shortlist is a plain flat list; should group by Session Role.
- Sections are 3×20min / 3 concurrent; must become 10/5/15/15/15 with 4
  concurrent.
- Export format is good and should be kept — but must become the *import*
  format too (§7.6).

Planned additions: heat map from uploaded history, goal selection, score
metric, wheel-as-a-lens view, cross-view selection highlight, clickable
discipline/line in the detail panel, program blocks.

**Framing that matters:** the Library view, the Wheel view and the Keystone
view are **three lenses on the same data and the same internal structure**, not
three features. Same information, different representations for different ways
of thinking. The wheel's particular strength is showing inter-discipline and
inter-line relationships through links and physical proximity, and fitting far
more exercises on screen than the list view.

---

## 11. Working preferences

- **Fail fast over defensive tolerance.** Established explicitly (§6.1). Loud,
  specific errors that name the offending data beat silent degradation. Do not
  add fallbacks that mask bad input.
- **Keep every computational transform explicit and visible in its own layer.**
  No hidden magic between stages.
- **Defer complexity to keep the core tractable.** Get the simple case right
  first.
- Calum catches modelling errors through physical intuition — if he says a
  layout or a model "feels wrong," treat that as a strong signal and go
  looking, rather than defending the implementation.
- Prefer showing a rendered result over describing one. Screenshot and look.
- Concise responses.
