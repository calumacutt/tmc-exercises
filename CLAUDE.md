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
│   ├── programs/                one file per program, the heat input
│   ├── PROGRAM_FORMAT.md        THE program file contract (export == import)
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

- **Local dev:** `python tools/serve.py 8000` from the repo root, then
  `http://localhost:8000/wheel/`. That is what `tools/serve.ps1` (primary — the
  dev box runs PowerShell) and `tools/serve.sh` do. **Note `python`, not
  `python3`: `python3` is not on PATH on the dev machine.**
- ⚠️ **Do not use plain `python -m http.server`.** It sends `Last-Modified` and
  the browser then caches ES modules aggressively — which means an edited module
  can keep running the OLD code, and worse, **a mix of old and new modules can
  load together.** That produced a phantom "NaN cascade" during the wheel split:
  a fresh `render.js` reading `TUNE.titlePos` from a cached `tune.js` that
  predated the key, giving `titleR = NaN`, which propagated into every node.
  There was no bug in the code at all. `tools/serve.py` sends `no-store`, so a
  reload always gets what is on disk. **Verification against a caching server is
  worthless** — several checks during the split silently passed against stale
  modules.
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

The Google Sheet, published to web as CSV. **All three tabs are now published**
and fetch live — the `Exercises` URL is below, all three are in `data/SHEET.md`:

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

**`Session Role` exists in the sheet but is NOT yet read** — see §7.2 for the
decided vocabulary. Live columns as of 2026-08-21: `Name`, `Pillar (auto)`,
`Discipline`, `Line`, `Regressions`, `Progressions`, `Also Appears In`,
`Importance`, `Level`, `Keystone`, `Variant Of`, `Session Role`, `Notes`.

⚠️ **Incomplete rows are OMITTED, not pseudo-grouped.** `filterRows()` drops any
row missing `Pillar`, `Discipline`, `Line` or `Importance`, so the owner's
half-entered rows never distort the picture or get clumped by an attractive
force. 29 of the live sheet's 521 rows are currently in that state. The row stays
in the RAW set, so a relationship link pointing at one reads as "filtered out"
(silent) rather than "typo" (loud).

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
`Mobility`. **Five, and the code and the sheet agree** — verified against the
live sheet 2026-08-21.

✅ **The `Games` pillar is GONE, and this is done, not pending.** It was never a
category of movement, only a *role in a class*. Its 51 exercises have been
re-homed into real pillars and tagged `Session Role = Game`; the pillar and its
orange stopgap colour are out of both the sheet and `shared/taxonomy.js`. The
`Rough Housing` / `Team Work & Connection` homelessness problem was solved the
same way — there is now a **`Partner & Connection`** discipline
(`Zen Archer`, `Circle Stick Game`, `Drop Stick Game`, …), which also closes
§7.2's missing-partner-value gap that 4.13 needed for scoring "partner work".

### Pillar colours (`shared/taxonomy.js`)

```js
"Strength & Capacity":  { h: 8,   s: 58, l: 52 }   // clay red
"Mobility":             { h: 145, s: 32, l: 46 }   // sage green
"Handstands & Balance": { h: 42,  s: 70, l: 54 }   // amber gold
"Flocomotion":          { h: 268, s: 32, l: 58 }   // muted violet
"Object Play":          { h: 198, s: 46, l: 52 }   // teal blue
```

Legacy aliases `Strength/Capacity`, `Handstands/Balance`, `Acro/Flow` were
previously mapped so old demo CSVs still coloured correctly. **They have since
been removed** — old fixtures now render grey. See §6.3.

**Historical note, kept because it explains the shape of the data:** Games used
to be a pillar *and* a discipline with 5 lines and 51 exercises (11% of the
library), so dissolving it was never a small stopgap removal — it meant re-homing
51 rows. That work is done in the sheet.

### Taxonomy v2 — designed, delivered, NOT ADOPTED, and PARTLY SUPERSEDED

> ⚠️ **Read this whole subsection before acting on v2.** Two of its four
> headline findings are wrong, because they were derived without knowledge of
> the `Lists` tab. The v2 source files (`library_v2.csv`, `TAXONOMY_V2.md`,
> `REVIEW_NOTES.md`, `moves.txt`, `changes.txt`, `library_clean.csv`) are **not
> in this repo and not on the dev machine** — they may be lost.

A full restructure was worked out and shipped as `library_v2.csv` +
`TAXONOMY_V2.md`. **The live sheet does not use it.** The live sheet has the
cleaned *names* but the *old* taxonomy (minus the Games pillar, since removed).

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
 "Flocomotion", "Object Play"]
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

## 7. Schema decisions already made (NOT YET IMPLEMENTED IN CODE)

These were worked out deliberately. Implement them as described.

⚠️ **Read this section as a specification, not as a description of the running
code.** Nothing here is wired up yet. In particular **there is no heat engine and
no heat map** — no `shared/heat.js`, no program history loaded, and the `#ks-glow`
filter that §8.1 reserves for heat is defined but unused. The two items marked
DECIDED / LOCKED below (7.2 `Session Role`, 7.6 program format) are settled
*contracts*; the code still does not read either.

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

### 7.2 `Session Role` — ✅ DECIDED (2026-08-21)

**Vocabulary: the `Lists` tab's `Session Types`, extended.** Seven values:

`Warm Up` · `Skill` · `Strength` · `Game` · `Prehab` · `Mobility` · `Conditioning`

**Multi-value, and at least one role is REQUIRED on every exercise.** An exercise
may hold several; the field is never blank.

Three earlier drafts disagreed and all three are superseded by the above:

| source | values | status |
|---|---|---|
| this file's old §7.2 | warm-up/game, skill, strength, mobility, conditioning | superseded |
| `Lists` tab `Session Types` | Warm Up, Skill, Strength, Game | **the base** |
| what was already in the sheet | Game (51), Prehab (19) | folded in |

Two things that fell out of reconciling them. `Warm Up` and `Game` stay
**separate** — the old draft merged them, but they are different jobs and the
sheet already used `Game` alone. And `Prehab` was invented in the sheet, in
neither draft; it is the home for the banded prehab/rehab work, which is exactly
the case the field exists to capture.

It still does three jobs at once: it dissolved the Games pillar (done, §5), it
groups the Program Builder shortlist the way a programmer actually reaches for
exercises (4.5), and it feeds the balance metric (§7.5).

⚠️ **Not yet a completeness-gate field.** Only 70 of 521 rows are filled, so
adding `Session Role` to `filterRows()`'s gate today would hide 451 exercises.
Add it to the gate once the column is populated — and that is the point of
requiring at least one role: the gate becomes the thing that keeps it populated.

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
up disagreeing. **Not built** — Phase 3, and it needs the program history entered
in the now-locked format first.

### 7.6 Program format — ✅ LOCKED (2026-08-21), see `data/PROGRAM_FORMAT.md`

Markdown, one file per program, so the file is simultaneously the record, the
machine-readable history and the **poster source**. Export equals import.
Hierarchy is **Program (dated) → Class → Session (numbered, with a duration) →
Exercise**, and the bullet ORDER within a session *is* the concurrent slot, so the
slot requirement is met with no extra syntax. Full grammar, fail-fast rules and a
validated example are in `data/PROGRAM_FORMAT.md` and
`data/programs/2026-08-21-example.md`.

This was urgent because three 6-week blocks of history are waiting to be entered
by hand and back-filling twice would be miserable. It is now safe to enter them.

### 7.7 Program structure (replaces 3×20min / 3 concurrent)

⚠️ **These are `Session`s, not `Section`s.** Renamed to match Calum's
terminology and the program format: a **class contains sessions**. Older notes
below and in PROGRESS may still say "section" — same thing.

| Session | Duration | Notes |
|---|---|---|
| 1 | 10 min | Warm-up or game |
| 2 | 5 min | Personal goals — **not programmed by the teacher** |
| 3 | 15 min | Skill or strength, programmer's choice |
| 4 | 15 min | " |
| 5 | 15 min | " |

Up to **4 concurrent exercises** per session.

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

The lightness half is implemented as `shade()` in `shared/taxonomy.js`:

- the pill **FILL** carries the discipline, across an **absolute** lightness ramp
  of 15%→55% (absolute, not an offset from the pillar's own lightness, so a tone
  means the same thing in every pillar);
- the **OUTLINE** carries the line within that discipline, always 20–40 points
  lighter than its fill so the signal survives at the dark end;
- the label flips to **dark ink above 42% fill lightness**, which is what makes a
  wide ramp usable at all.

A first attempt put both signals on the outline only, and it was **invisible** —
a 1.5px border is not enough area to register a 5-point lightness step. That is
the lesson: on a dark ground, fill area carries lightness, borders carry hue.

Indices come from an **alphabetical** ordering of the disciplines in a pillar and
the lines in a discipline — *not* by exercise count, which would reshuffle every
colour on the wheel each time the sheet grows.

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

**The export is a finished piece, not a diagram.** The masthead — **"TMC
Pillars"** — is drawn **inside the SVG**, so it travels with the PNG/SVG. Before
that the export carried only exercise labels and pillar titles, nothing
identifying what it was, because the page masthead is HTML *outside* the SVG. It
sits in a corner, which a circle inscribed in a square leaves empty (~21% of the
canvas), so it costs no layout room, and it is **fit-scaled against the disc edge
at its own baseline** — a corner is a triangle, so a wide line runs into the
wheel.

A pillar legend and a subtitle were tried and removed: the legend became
redundant once the pillar titles were large and legible enough to read directly.

**Typefaces are rounded on purpose.** Every object on the wheel is a rounded rect
or a circle, and the original Fraunces fought that. Masthead is **Baloo 2 800**,
pillar titles **Quicksand 700** uppercase, exercise labels **Archivo 400**.
Fraunces is gone entirely — note it has an `opsz` axis, so at masthead sizes it
was automatically using its high-contrast display cut and reading thin.

⚠️ **`.w-pillar-label` is uppercased in JS, not by CSS `text-transform`.** The
title's collision box is measured with `estLabelWidth`, and a CSS-only transform
would leave it measuring the shorter mixed-case string and silently under-reserve
space. For the same reason `estLabelWidth` takes an explicit font and tracking:
titles render in Quicksand with 0.08em tracking while the default measure is
Archivo with none, so measuring the wrong face under-reserved the box. `svg.js`
exports `TITLE_FONT` / `TITLE_TRACKING` / `MAST_FONT` and the CSS mirrors them —
change both or neither.

- Dark warm charcoal, `--bg: #14110F`. Poster aesthetic.
- Baloo 2 + Quicksand + Archivo via Google Fonts CDN; falls back to system fonts.
- Title masthead "The Ultimate Mover" + TMC logo as an embedded base64 data
  URI (~80KB, original black-on-white **inverted to cream** for the dark hub).
- Deterministic seeded layout via `mulberry32` / `hashStr` — same input gives
  the same picture.
- Exports PNG and SVG. Background rect is drawn so exports carry the dark
  canvas.

### Pill rendering

One treatment for every pill: rounded rect, fill from the discipline shade,
outline from the line shade, label ink flipped for contrast.

- **Keystones are not a different kind of object.** Same fill and outline rules,
  just a larger pill (`fs + 3`, 2px outline), a **bold label**, and a **gold
  five-pointed star above it**. They used to own a luminous fill and dark ink,
  which reserved the bright end of the lightness ramp and left disciplines
  fighting over the remainder — that is why the discipline shading was invisible.
  Marking them by size, weight and an icon instead frees the whole ramp.
- The star is **always `--accent` gold**, never the label ink. It sits above the
  pill on the dark canvas rather than on the fill, so gold reads against every
  pillar, and one constant colour makes keystones legible as a single category —
  which a colour that flipped with the fill could not do.
- ⚠️ **The star is inside the collision box.** `halfH` grows by the icon height
  plus its gap, and the pill is drawn in the *bottom* of that box, so a star can
  never sit on a neighbouring pill. Same principle as the pillar titles: collide
  on what is actually drawn.
- ⚠️ **The bold weight comes from a CSS class, not a `font-weight` attribute.**
  In SVG a CSS rule beats a presentation attribute, so `.w-ex-label`'s 400
  silently won and the attribute did nothing. `text.w-ex-label.w-ex-key` is
  deliberately more specific. The font link also has to request Archivo **700**
  or the browser synthesises fake bold.
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
> and 2.5. The level-based radial bias is gone, and so is the radial even-density
> pull — it was floored at 12% of the wedge area, which left a 356px ring next to
> the hub that no node could ever be assigned to, and it *actively evacuated* a
> centre the seed had already filled. The layout is now a pure per-pillar scatter:
> box-aware spacing, an angular even-fill, and title/seam clearance. The only
> property affecting placement is the pillar.
>
> ⚠️ **The seed is load-bearing, and it is where the STRUCTURE lives.** The
> spacing force is contact-only — it fires when boxes grown by `air` overlap — so
> it cannot feel a void, cannot disperse a cluster, and any overlap-free
> arrangement is a stable equilibrium. Two consequences:
>
> - uniform radial spread comes from the seed covering the full radius, not from
>   repulsion expanding to fill the disc;
> - **discipline and line clustering is BUILT in the seed**, not produced by an
>   attractive force. Three levels: the pillar wedge holds discipline blobs, each
>   holds line sub-blobs, each holds its pills on an even-area sunflower. Blobs are
>   sized from the area their pills actually need, so relaxation barely moves them.
>   An attractive force was considered and rejected — it would fight nothing while
>   opening gaps that contact-only repulsion cannot close.
>
> Blob placement is greedy, biggest-first, preferring the smallest feasible radius.
> **Large disciplines end up further out on their own** — a wedge is narrower near
> the hub, so a big blob cannot fit there. That correlation falls out of the
> geometry rather than being a rule.
> **`TUNE` exposes 17 sliders.** It went 19 → 8 when the force model was
> simplified, then back up as the scheduled hierarchy, the wall repulsion and the
> live-animation controls were added. Every default was set by ablation.

| Panel label | Key | Default |
|---|---|---|
| 2a Spacing push strength | `charge` | 2.5 |
| 2b Desired space around each pill (px) | `air` | 26 |
| 3 Keystone→seam attraction | `keystoneSeam` | 0.3 |
| 4a Title distance hub→rim | `titlePos` | 0.667 |
| Sector arc allocation | `angleExp` | 0.7 |
| Pillar title size (fixed) | `titleSize` | 48 |
| Exercise pill size | `pillScale` | 1.2 |
| Relaxation iterations | `iterations` | 600 |

### The layout is HARD and SOFT, and nothing else

**SOFT — one force only: pairwise repulsion** between pills in the same pillar.
Each pill claims a box grown by `air`; two pills push apart by the smaller of
their two axis overlaps, along the vector between their CENTRES. Pushing along an
axis instead locks pills onto whichever axis they already share and builds
columns — that was measured at 10:1 vertical over horizontal.

⚠️ **Pill-vs-pill collision is SCHEDULED (`TUNE.collideAt`, default 0.35).** For
the first third of the run pills pass straight through each other, because with
collisions on from the start two pills that need to swap places cannot, and a pill
separated from its group by a wall of others stays stranded for the whole run.
Sector walls and pillar titles stay hard throughout — titles never move, so they
cause no entanglement, and a pill tunnelling a title would draw on top of it
(verified 0 title overlaps).

**EVERY soft force is PAIRWISE** — same shape, one strength each, no rest lengths,
no thresholds, no special cases. Three attractions (all same-discipline pairs, all
same-line pairs, all edge pairs), one parabolic repulsion (all pairs in a sector),
one contact spacing force. A same-line pair is also a same-discipline pair, so it
feels both pulls: that is what makes it a hierarchy.

**WALL REPULSION — the same kernel against the sector boundaries, via image pills.**
A hard wall spikes the density against it, and not because pills want to be there:
a pill at a wall is missing every neighbour that *would* have been on the other
side, so its own repulsion is unbalanced while its motion is blocked. Reflecting it
across the wall and repelling it from its own image supplies what the truncated
medium lost. All four boundaries act, summed — nearest-wall-only would put a
discontinuity where the nearest wall changes. Clearances come from the pill's BOX
through the same helpers the hard clamp uses, so soft and hard cannot disagree about
where a wall is. Boundary keystones skip the spokes, as they already skip the hard
spoke clamp. It runs at CONSTANT gain, unlike the pill-pill repulsion it borrows the
kernel from: it is a boundary condition, and if it decayed the air phase would
re-pack everything against the walls.

⚠️ **It needs `wallRepel` (default 4) and that is not tuning taste.** A pill at a
wall is missing a half-NEIGHBOURHOOD, not one neighbour, so a single self-image is
about an order of magnitude too weak against the ~80 partners the pairwise force
sums over — measured, it only took pinned pills from 26% to 18%. At 492 pills:

| `wallRepel` | density CV | pills pinned to a wall | nn-gap CV | line purity | link median |
|---|---|---|---|---|---|
| 0 (hard walls only) | 0.090 | 26% | 0.177 | 0.547 | 178 |
| **4** | **0.053** | **7%** | **0.135** | **0.590** | **165** |
| 8 | 0.109 | 13% | 0.263 | 0.555 | 176 |
| 20 | 0.177 | 12% | 0.348 | 0.476 | 237 |

4 improves *every* metric at once and is the best result the layout has produced. It
is a fairly sharp optimum — 3 is also good, 5 starts giving back the clustering, and
by 8 local spacing is worse than having no wall force at all. Deriving the strength
instead of tuning it would mean mirroring every nearby pill rather than only itself,
at the cost of a second O(n²) pass.

⚠️ **The parabolic repulsion is load-bearing, not optional.** It is the ONLY thing
stopping the attractions collapsing each group to a point — attraction grows with
separation, repulsion is strongest at contact, so a pair settles where they balance.
`farRepel` 0.07 is that balance point at the current attraction defaults. Too high
and it wins at long range and packs the rim (CV 0.26 at 0.5); too low and groups
collapse and the air phase re-spreads them at random (line purity drops to 0.49).

⚠️ **Per-pair strength scales as 1/n and that is inherent.** A pill in the 51-member
Strength & Capacity discipline gets 50 pulls; one in a 3-member discipline gets 2.
So the value that suits the big groups is ~17x too weak for the small ones. This is
a property of pairwise linear springs, not a tuning problem — dividing by the
partner count would fix it and would also stop the force being pairwise.

**Rejected, and do not reintroduce without evidence:** centroid pulls with a
threshold radius (a "flat bottom" at the group's packed radius). It silently did
nothing to 97-99% of pills, which no amount of tuning could reveal from outside,
and it needed a second nested variant to stop the discipline level dismantling the
line level. Also rejected: a rest length on the edge springs (the repulsion already
provides the short-range floor), and starting the air phase earlier (line purity
0.550 → 0.487 — even spacing genuinely fights clustering, so the sequencing is the
point).

**This is a real trade, not a tuning miss.** At 492 pills, `collideAt` 0.35 vs 0:
line-neighbourhood purity **0.514 → 0.550**, mean line spread 189 → 176px, median
link 232 → 198px — but radial density CV **0.075 → 0.139**. Gating lets cohesion
collapse groups, which undoes the seed's space-filling, and the contact-only air
phase cannot refill a void. Purity peaks at 0.35 and falls again by 0.50.
Two attempts to get both, both rejected and both recorded in `layout.js`: starting
the air phase earlier (purity 0.550 → 0.487 — even spacing fights clustering
whatever the phase overlap), and slack on the cohesion radius (buys the density
back but gives up the purity it was added for).

**HARD — snaps a pill fully back into a valid position.** All of it collides on
the pill's *actual bounding box*:

- the two **spokes** bounding its sector. If a pill is wider than the sector at
  its radius the two spokes fight, and it is squeezed **outward** where the arc is
  longer — what a wedge-shaped container would physically do.
- the **inner and outer rings**, using the nearest and farthest point of the box
  rather than its centre.
- the **pillar title boxes**, which do not move, so the pill takes the whole push.
- **other pills**, resolved along the axis of least penetration. Pads: 12px
  horizontal, 8px vertical.

**HARD runs first each iteration**, so pressure away from walls and solid objects
takes priority over pills jostling each other. After the loop, 40 hard-only
passes settle it — soft ran last inside the loop, and repeating the constraints
converges on satisfying all of them rather than letting whichever ran last win.

**The one exception:** boundary keystones get a soft pull toward their seam and an
exemption from the spoke walls, because they are meant to straddle it. 2 nodes.
Two consequences of that pinning, both measured and both corrected:

- **They absorb only a reduced share of a pair's separation** (`PINNED_MOBILITY`
  0.25, split by mobility so the pair's total separation is unchanged). The seam
  pull runs *after* the spacing force and drags them back, so any ground they win
  is given away again — while the neighbour keeps its half. That left them
  measurably cramped: mean gap to the 5 nearest was **50 against 60** for
  everything else, on a seam whose position predicts ~69. Deliberately not zero,
  or they would be glued like a title and could not slide along the seam to settle.
- **They space against BOTH pillars they straddle** (`spacingApplies`). The
  spacing force is otherwise same-pillar only, so their neighbours across the seam
  felt no force at all and crowded to the hard 12/8px pad. For `Dragon Squat`, 6 of
  its 8 nearest neighbours were in the adjacent pillar.

This replaced a system with five soft forces. Removing `angularFill`,
`titleRepel`/`titleRange` and `boundaryRepel`/`boundaryRange` — the last two
re-expressed as hard walls — took radial density CV from **0.345 to 0.064** and
`TUNE` from 13 sliders to 8. Overlaps stayed at 0.

**Forces with no slider** (they matter more than several that have one):

- **Disc radius** (`chooseDiscRadius`) — area estimate × 1.7 breathing per pill,
  title reserve × 1.5, floor `R_HUB + 240`, whole thing × 1.35, capped 3200px.
  The single biggest influence on perceived spacing, and entirely hardcoded.
- **The seed** — see the warning above. It is what fills the radius.
- **Font size** — 12/13/14/16px stepped by total exercise count; `pillScale`
  multiplies it.
- **Per-node charge** — auto-scaled as `√(wedge area ÷ node count)`, then the
  pair force is capped at 7px with a `+1200` softening term.

**Distances are measured between bounding boxes, not centres.** Pill widths vary
5.5× with name length (48–268px), so centre distance badly misjudged how close
two pills actually were: two long pills side by side have far-apart centres and
felt almost no repulsion while their ends touched. Charge repulsion uses the gap
between boxes and pushes along the closest-point vector; title repulsion counts
the pill's own extent as well as the title's.

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
