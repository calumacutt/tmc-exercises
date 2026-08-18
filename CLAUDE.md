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
| 1 | **Movement Library** (Google Sheet) | **3 tabs**; ~490 exercises, taxonomy now fully populated | Single source of truth. Exercises + taxonomy + component edges. Powers everything else. See `data/SHEET.md`. |
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
│   ├── exercises.csv            committed snapshot of the Exercises tab
│   ├── lists.csv                Lists tab — the authoritative taxonomy
│   ├── breakdowns.csv           Breakdowns tab — component edges
│   ├── examples/                dated manual exports, kept as fixtures
│   └── SHEET.md                 THE verified column contract, all 3 tabs
├── shared/                      used by BOTH sites — no duplication
│   ├── csv.js                   tolerant CSV parsing (parseCSV, field)
│   ├── library.js               row → model, filterRows, groupData, validateRows
│   ├── taxonomy.js              pillar order, colours, hsl helpers
│   ├── graph.js                 typed edge list → graph          (task 2.3, not built)
│   ├── heat.js                  hot/cold/half-baked/burnt engine (task 3.2, not built)
│   └── selection.js             cross-view selected exercise    (task 4.10, not built)
├── wheel/
│   ├── index.html               thin shell + boot wiring only
│   ├── layout.js                force model + pill/link drawing
│   ├── render.js                sectors, titles, medallion, export
│   ├── tune.js                  TUNE defaults + live panel
│   ├── svg.js                   geometry constants + SVG/text primitives
│   ├── state.js                 mutable view state in one place
│   └── logo.js                  base64 logo, isolated
├── builder/
│   ├── index.html               (was the root tmc-exercises page)
│   ├── library-view.js
│   ├── keystone-view.js
│   ├── wheel-view.js            imports ../wheel/layout.js
│   ├── program.js               sections, slots, drag & drop
│   ├── blocks.js                named prebuilt combos
│   └── score.js                 goal metric
├── archive/                     kept, not maintained
│   └── columns/index.html       A3 landscape columns view
└── tools/serve.sh               local dev server
```

Three modules are not in the original sketch, and are deliberate:
`logo.js` isolates 82KB of base64 so the real modules stay readable (it stays
inlined rather than becoming `logo.png`, because the SVG export has to be a
standalone file); `svg.js` holds geometry constants and SVG/text primitives that
both `layout.js` and `render.js` need, which would otherwise force a cycle;
`state.js` keeps mutable view state in one place instead of bare globals.

`layout.js` both computes positions **and draws** the pills and links. That is
not clean, and splitting it is task 2.4/2.5 work — pulling the draw helpers into
`render.js` now would make the two mutually dependent for no gain.

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
wheel **is now split into modules (task 2.2), so double-clicking it no longer
works.** Serve it. This is the price of the split and it was accepted.

- **Local dev:** `python -m http.server 8000` from the repo root, then
  `http://localhost:8000/wheel/`. That is what `tools/serve.ps1` (primary — the
  dev box runs PowerShell) and `tools/serve.sh` do. **Note `python`, not
  `python3`: `python3` is not on PATH on the dev machine.**
- **Playwright tests must use `http://localhost:...`, not `file://`.**
  This is a change from how the wheel was previously tested.
- ⚠️ **There is currently no automated test path at all.** `node`, `npm` and
  `npx` are **not installed** on the dev machine, and Playwright is an npm
  package — so §9's documented test pattern cannot run locally. It only ever ran
  in the chat sandbox. This is an unresolved tension with "no npm, deliberately"
  below. **Settle it before Phase 2 touches the force model**, because that is
  where the "all node coordinates finite" assertion caught the `NaN` cascade.
  A defensible reading: dev-only npm never enters the deploy path or Pages, so
  it does not violate the no-build-step decision. Interim measure: drive a
  browser manually and assert against the live DOM.
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

> **The authoritative, verified contract now lives in `data/SHEET.md`.** This
> section is the summary; that file is the reference. If they disagree, believe
> `data/SHEET.md` — it is checked against real snapshots.

### The sheet has THREE tabs, not one

| Tab | Snapshot | Role |
|---|---|---|
| `Exercises` | `data/exercises.csv` | the library, ~490 rows |
| `Lists` | `data/lists.csv` | **authoritative taxonomy** — 58 declared LineKeys — plus enum vocabularies |
| `Breakdowns` | `data/breakdowns.csv` | **the `component` edge table of §7.1, already built** |

Two consequences that were missed for a long time:

1. **`Lists` declares the taxonomy top-down.** The valid `Discipline - Line`
   pairs are the ones listed there — *not* the ones that happen to appear on
   exercise rows. **23 of 61 declared LineKeys have zero exercises.** A loader
   that infers the taxonomy from exercise rows cannot see those, and will
   wrongly report references to them as broken. See §6.4.
2. **`Breakdowns` already is the `component` edge table**, populated for 3
   keystones, in exactly the shape the old builder parses. §7.1's
   "columns-on-the-row, not a separate tab" recommendation should be revisited
   for `component` specifically.

`Lists` also declares `Session Types` (`Warm Up` / `Skill` / `Strength` /
`Game`), which substantially pre-empts §7.2's planned `Session Role` — reconcile
with it rather than inventing a parallel vocabulary.

### Multi-value delimiter: `,` or `;`

`splitList()` accepts **both**. Google Sheets multi-select dropdowns emit
comma-delimited values and that is not configurable, so the loader has to take
commas.

This was briefly semicolon-only, because two real values used to contain commas:
the discipline `Rhythm, Flow & Expression` and the exercise
`Foot Taps, Handslaps`. **Both have since been renamed** (`Rhythm & Flow`,
`Foot Taps & Handslaps`), so nothing in the taxonomy or the exercise names
contains a delimiter any more.

That is a *precondition*, not a permanent fact — so it is guarded, not assumed:
`validateRows()` **refuses to draw** if any name contains `,` or `;`, because at
that point multi-value parsing is ambiguous and would fail silently. Full
rationale in `data/SHEET.md` §3.

### Source of truth

The Google Sheet, published to web as CSV. Only the `Exercises` tab is
published so far — `Lists` and `Breakdowns` still need publishing before they
can be fetched live:

```
https://docs.google.com/spreadsheets/d/e/2PACX-1vQDrwHw-jGM7r3ZO_i8orZWvJ_wxmMdfnUy3lvdsqwZeJGv_EyEvsiB1HxG1qrXIyzgtMrlZMhirtcI/pub?gid=955669041&single=true&output=csv
```

The published endpoint sends permissive CORS headers, so browser fetch works.
**Committed snapshots live at `data/exercises.csv`, `data/lists.csv` and
`data/breakdowns.csv`** so tests are deterministic and work offline. Local
exports in `data/examples/` are kept as fixtures.

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

### Columns confirmed NOT read — ✅ ALREADY DELETED

`Loadable`, `Session Type`, `Class Types`, `Movement Split`, `Equipment` and
`Video URL` are **gone from the sheet.** Only `Notes` survives (9 entries, not
the 5 recorded earlier); it is read into the model but not rendered. Task 5.7 is
done.

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

Legacy aliases `Strength/Capacity`, `Handstands/Balance`, `Acro/Flow` were
previously mapped so old demo CSVs still coloured correctly. **They have since
been removed** — old fixtures now render grey. See §6.3.

`Games` is a pillar *and* a discipline, with 5 lines (`Ball Games`,
`Floor & Flow Games`, `Rough Housing`, `Stick Games`,
`Team Work & Connection`) and **51 exercises — 11% of the library.** Dissolving
it into `Session Role` is therefore not a small stopgap removal; it means
re-homing 51 rows, and `Rough Housing` / `Team Work & Connection` have no
obvious movement home. Note also that §7.2's proposed `Session Role` values have
**no partner/connection value**, while 4.13 wants to score "partner work" —
settle that before closing the field.

### Taxonomy v2 — designed, delivered, NOT ADOPTED, and PARTLY SUPERSEDED

> ⚠️ **Read this whole subsection before acting on v2.** Two of its four
> headline findings are wrong, because they were derived without knowledge of
> the `Lists` tab. The v2 source files (`library_v2.csv`, `TAXONOMY_V2.md`,
> `REVIEW_NOTES.md`, `moves.txt`, `changes.txt`, `library_clean.csv`) are **not
> in this repo and not on the dev machine** — they may be lost.

A full restructure was worked out and shipped as `library_v2.csv` +
`TAXONOMY_V2.md`. **The live sheet does not use it.** The live sheet has the
cleaned *names* but the *old* taxonomy, plus the new Games pillar.

v2 goes from 11 disciplines / 22 lines → **13 disciplines / 32 lines**, and
gives all 370 exercises a home with zero orphans. Its key findings:

1. ❌ **WRONG — "the sheet referenced a line that did not exist."** Four rows
   point at `Lever & Straight-Arm Body Control - Front Lever Line`, and that
   line **is declared in the `Lists` tab**, along with `Planche Line` and
   `Side Lever Line`. It simply has no exercises filed against it. Nobody
   *inferred* an intent — the intent is **recorded**. v2 proposing to "create"
   these lines is proposing to create lines that already exist. See §6.4.
2. **Back Lever and German Hang were under Pressing Strength → Horizontal
   Press.** They are straight-arm *pulling* holds.
3. ❌ **WRONG — "no lower-body strength existed at all."** A
   `Loaded Lower Body Strength` discipline **is declared in `Lists`** with six
   lines: `Bilateral Squat`, `Single-Leg Squat`, `Lateral / Mobility Squat`,
   `Hip Hinge`, `Posterior Chain (knee)`, `Anterior Chain (knee)`. All six are
   empty. The observation that squats and hinges are *scattered* is correct;
   the conclusion that no home exists is not. Adding v2's
   `Squat, Hinge & Single Leg` would **duplicate an already-declared discipline
   under a different name.** The work is filing exercises into the declared
   lines, not creating new ones.
4. ⚠️ **PARTLY STALE — "all 24–26 uncategorised rows were one missing line."**
   The count is now **57 rows with a blank `Line`** and **16 with a blank
   `Discipline`**, so this has grown, not been solved. The frontal-plane hip
   reading may still be right, but `Foundational Resting Positions` has four
   *declared and empty* lines (`Squat Position`, `Stance Positions`,
   `Hip Opening (sagittal)`, `Spinal Extension`) which are the obvious homes for
   most of them. Check those before adding `Hip Opening - Lateral`.
5. ✅ **Plausible and not contradicted.** Vertical Pull doing two jobs — strict
   pulling next to swinging/kipping. v2 splits out `Swinging & Brachiation`.
   `Lists` declares no such line, so this is a genuine v2 addition.
6. ✅ **Plausible and not contradicted.** Arm isolation (curls, tricep
   extensions) inside Horizontal Pull. v2 adds `Arms & Accessory`. Again not
   declared in `Lists`, so genuinely new.

**Revised position on adoption.** v2 was designed against an older snapshot
*and without sight of the `Lists` tab*, which is why two of its findings
re-derive structure that already exists. It is not a wholesale-adopt candidate.
The cheap, low-risk work it points at is:

- file exercises into the **23 declared-but-empty LineKeys** (findings 1 and 3
  collapse into this);
- then consider findings 5 and 6, which are real additions.

Treat "adopt v2" as **superseded by "populate `Lists`."** See PROGRESS 1.6.

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

### 6.3 `PILLAR_ORDER` — ✅ FIXED

Previously listed the old demo names, so every pillar fell through to "unknown →
append in Map insertion order" and pillar ordering was arbitrary. Now correct,
in the recommended adjacency:

```js
["Handstands & Balance", "Strength & Capacity", "Mobility",
 "Flocomotion", "Object Play", "Games"]
```

The reason this mattered beyond cosmetics — **boundary-keystone detection
depends on pillar adjacency** — still holds, but see 6.6: the feature has no
data to act on either way.

Note the legacy aliases (`Strength/Capacity`, `Acro/Flow`,
`Handstands/Balance`) were **dropped** from `PILLAR_COLOURS` at the same time.
Any old fixture using those names now renders `PILLAR_FALLBACK` grey. Consistent
with fail-fast, but worth knowing before `data/examples/` is used for tests.

### 6.4 Unresolvable `Also Appears In` — the diagnosis here was WRONG

The reference must match a declared LineKey exactly, and a miss draws no link
and reports nothing. That part is true, and is still worth adding to
`validateRows()` as a warning.

But the specific claim that four rows "point at a non-existent Front Lever Line"
**was wrong, and it propagated into Taxonomy v2's justification.**
`Lever & Straight-Arm Body Control - Front Lever Line` **is declared** in the
`Lists` tab. It has zero exercises filed against it. The wheel derives valid
lines *bottom-up from exercise rows*, so it cannot see a declared-but-empty
line and reports a perfectly good reference as broken.

The real failure in this area is the delimiter, not the reference: `Bridge
Circle` points at `"Rhythm, Flow & Expression - Acrobatics"`, which the old
comma-splitting `splitList()` shredded into two fragments. Fixed — see §4.

**Lesson: validate against `Lists`, not against the set of pairs observed on
exercise rows.**

### 6.6 The boundary-keystone split-fill has no data to act on

Zero `linearGradient[id^='ksg-']` elements render, and that is *not* the stale
`PILLAR_ORDER` of 6.3. **None of the 7 flagged keystones has any `Also Appears
In` value**, so the two-tone fill and seam-snapping machinery is entirely
unexercised. It cannot be validated until keystone flags and cross-pillar
references overlap. Relevant to §7.1/2.5: some of what looks like layout tuning
complexity is dead weight, not tuning.

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

### 8.1 Colour is oversubscribed — ✅ SETTLED

Three things wanted the colour channel: **pillar hue**, **discipline/line
shading**, and **hot/cold**.

**Decision: heat is carried by GLOW.** Hue stays with the pillar, lightness with
discipline/line. Hot regions of the wheel glow; cold regions do not.

This required freeing the channel, because **keystones already used the glow**
(`#ks-glow`) and one channel cannot carry two meanings — a hot keystone would
have been indistinguishable from a cold one, with the two effects stacking.
The glow halo has therefore been **removed from keystone pills**. Keystones stay
distinct through their luminous pillar-colour fill, larger pill and dark ink
label, which is what actually made them read as hubs.

The `#ks-glow` filter definition is retained in `render.js`, unused, reserved for
heat. Heat itself needs program history, so the glow cannot be wired up until
`shared/heat.js` and the locked program format exist (Phase 3). The exact look —
warm hue vs white, intensity curve — is deliberately still open.

### 8.2 Importance does double duty

It is both the display filter and the cooling rate. Coherent **only if**
"important" always means "should be trained often." Sanity-check against real
exercises; if anything is always-show but rarely-programmed, the field needs
splitting into two.

---

## 9. Movement Wheel — current implementation notes

Single file, ~1,670 lines, to be split per §2.

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

> ⚠️ **Both the link and the line parameters are gone.** `linkStiff`, `linkLen`,
> `crossLen`, `linkCross` went with the links; `lineRepel`, `lineRange` and
> `angularSpread` went with all line-awareness in the layout — see PROGRESS 2.4
> and 2.5. The level-based radial bias is gone too. The layout is now a pure
> per-pillar scatter: node charge repulsion, an even-density radial fill, and
> title/seam clearance — the only property affecting placement is the pillar.
> **`TUNE` is down to 12 exposed parameters from 19.**

| Panel label | Key | Default |
|---|---|---|
| 2c Node spreading (fill wedge) | `charge` | 2.5 |
| 2d Node spreading reach (px) | `chargeRange` | 320 |
| 2e Even-density pull hub→rim | `radialFill` | 0.05 |
| 3 Keystone→seam attraction | `keystoneSeam` | 0.3 |
| 4a Title repulsion | `titleRepel` | 16 |
| 4b Title reach (px) | `titleRange` | 150 |
| 5a Sector-boundary repulsion | `boundaryRepel` | 0 |
| 5b Boundary reach (px) | `boundaryRange` | 60 |
| Sector arc allocation | `angleExp` | 0.7 |
| Pillar title size (fixed) | `titleSize` | 30 |
| Exercise pill size | `pillScale` | 1.2 |
| Relaxation iterations | `iterations` | 600 |

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
