# PROGRESS.md

Task state and next actions. Architecture, data contract and traps live in
`CLAUDE.md` — read that first.

**Convention:** `[ ]` todo · `[~]` in progress · `[x]` done · `[?]` needs a
decision from Calum before it can proceed.

---

## Current position

**Phase 0 is done.** The repo is restructured, the wheel and the columns view
are imported, snapshots of all three sheet tabs are committed, and
`data/SHEET.md` holds a verified data contract.

Auditing the real artifacts against these docs found that several recorded
"blockers" were already fixed and **two diagnoses were simply wrong** — see the
decision log and `CLAUDE.md` §6.4 / §5. Corrections are folded in below.

**Immediate next action:** Phase 1 — the schema decisions. They are all `[?]`
and all need Calum. 1.6 is now much cheaper than it was (see below), and 3.1 has
been pulled forward out of Phase 3 because it is urgent and unblocked.

---

## Phase 0 — Get everything into the repo ✅ DONE

- [x] **0.1 Collect loose artifacts.** `wheel/index.html` and the columns view
      imported. **Note:** the imported wheel is *newer* than the 1,656-line
      `movement_wheel.html` the docs described, but the two had **diverged** —
      it had the correct `PILLAR_ORDER` and Games colour, and had **lost**
      `validateRows()`. Reconciled: see W1.
      **`library_v2.csv`, `TAXONOMY_V2.md`, `REVIEW_NOTES.md`, `moves.txt`,
      `changes.txt`, `library_clean.csv` were not found anywhere on the dev
      machine and are not in git history — they may be lost.** 1.6 no longer
      depends on them (see below).
- [x] **0.2 Move Program Builder** → `builder/index.html`, byte-identical.
- [x] **0.3 Folder skeleton** created.
- [x] **0.4 `tools/serve.ps1` + `tools/serve.sh`** — `python`, not `python3`,
      which is not on PATH. PowerShell script is primary.
- [x] **0.5 Snapshots** at `data/exercises.csv` (fetched live), `data/lists.csv`,
      `data/breakdowns.csv`; `data/SHEET.md` written and verified.
- [x] **0.6 Hub page** at root `index.html`.
- [ ] **0.7 Verify GitHub Pages** serves the subdirectory pages after the
      restructure. **Needs a push first.**
- [x] **0.8 Commit.**

### Defects found during the Phase 0 code review

- [x] **W1 Restore the duplicate-name fail-fast gate.** `validateRows()`,
      `showDataError()` and `escapeHTML()` had been **deleted** from the
      imported wheel — the single most emphatically documented decision in the
      project (`CLAUDE.md` §6.1). Restored verbatim. It immediately caught a
      real duplicate: see 5.4.
- [x] **W2 Fix the multi-value delimiter.** `splitList()` split on `/[;,]/`, but
      the discipline `Rhythm, Flow & Expression` and the exercise
      `Foot Taps, Handslaps` both contain commas — so those values were shredded
      silently. Now `;`-only with a loud error on any comma. See
      `data/SHEET.md` §3.
- [x] **W3 The boundary-keystone split-fill now works.** ✅ Resolved by data, not
      code: with 10 keystones and cross-pillar `Also Appears In` values in the
      sheet, **3 boundary gradients now render.** The machinery had never once
      been exercised before this. Keep it — and note it is now a live constraint
      on the heat-glow decision below.
- [x] **W7 PNG/SVG export was broken by the module split.** `serialisedSVG()`
      used `SVGNS` and `render.js` never imported it, so both save buttons threw
      `ReferenceError` on click. Fixed.
      **The lesson matters more than the bug.** I "verified" the split by loading
      the page and checking the console — but nothing on initial render touches
      the export path, so the break was invisible. A static import checker I
      wrote to cover the gap reported clean twice, because its comment/string
      stripper ran away on the regex literal `/[&<>"']/g` in `escapeHTML` and
      silently swallowed the rest of the file.
      **Do not trust either method alone.** The check that works is exercising
      every code path in the browser: load, sheet fetch, slider, variants toggle,
      both export buttons, and the duplicate-name refusal. Relevant to §3's
      unresolved "no automated test path" tension — that gap is now a bug that
      reached Calum, not a hypothetical.
- [x] **W8 Dev server now sends `no-store`.** `python -m http.server` let the
      browser cache ES modules, so edits silently had no effect and — worse —
      **old and new modules loaded together.** That produced a phantom NaN
      cascade (fresh `render.js` + cached `tune.js` without `titlePos`), which I
      spent real time chasing as a layout bug that did not exist.
      **This invalidates verification done earlier in the split**, including some
      "0 overlaps" claims. Re-measured on the no-cache server: 0 pill/pill and
      0 pill/title overlaps at 492 pills, but only after raising the settle loop
      from 24 to 40 passes — at 24 there was still 1 overlap. Use
      `tools/serve.py`.
- [ ] **W4 Legacy pillar aliases were dropped** from `PILLAR_COLOURS`, so old
      fixtures in `data/examples/` render grey. Fine under fail-fast, but decide
      before those become test fixtures.
- [x] **W5 Dead `Games` pillar config removed** from `shared/taxonomy.js`. The
      pillar no longer exists in the sheet; the library is back to five.
- [x] **W6 Delimiter reversed to accept commas.** Google Sheets multi-select
      dropdowns emit comma-delimited values and that is not configurable, so
      `splitList` takes `,` or `;`. Safe now that no LineKey contains a comma
      (renaming `Rhythm, Flow & Expression` removed the last one) and
      `Foot Taps, Handslaps` became `Foot Taps & Handslaps`.
      `validateRows()` now **fails loudly if any name contains a delimiter** —
      that is the condition that makes accepting commas safe, so it is guarded
      rather than assumed.
- [ ] **B1 Fix silent data loss in the builder's drag-and-drop.**
      `handleDrop` does `occupant.name = name`, deleting the displaced exercise
      with no undo, while the cross-class branch 30 lines below handles the same
      case correctly via `addToClass(displacedName, …)`. Part of 4.2.
- [ ] **B2 Remove dead `dragover` logic.** `e.dataTransfer.getData ? 'copy' :
      'move'` always yields `'copy'`; `getData()` returns `""` during `dragover`
      by design. Use `types.includes('application/x-source-class')`. Part of 4.2.
- [ ] **B3 Introduce a `SECTIONS` array.** The 3×20min / 3-lane structure is
      hard-coded across ~6 sites. Do this *with* 4.1 rather than making six
      parallel edits. Section 2 needs a non-droppable flag.

### Open Phase 0 asks for Calum

- [ ] **Publish the `Lists` and `Breakdowns` tabs to web** and paste the CSV
      URLs into `data/SHEET.md`. Only `Exercises` is published, so the other two
      snapshots cannot be refreshed automatically.
- [ ] **Confirm `archive/columns/`.** `pillars/index.html` as committed was
      **byte-identical to `movement_columns.html`** — the A3 columns view, not
      the out-of-scope Pillars visualisation — so it was filed under
      `archive/columns/`. Say if you want it revived as a maintained lens.

---

## Phase 1 — Settle the schema

Cheap, unblocks everything downstream. This is design work, mostly in the
spreadsheet, not code. Full specifications in `CLAUDE.md` §7.

- [?] **1.1 Decide the edge model.** Add `Related` and `Components` columns
      alongside existing `Progressions` / `Regressions`; normalise to a typed
      graph at load. Confirm the four types are right:
      `progression` / `variant` / `component` / `related`.
- [?] **1.2 Decide `Session Role`** values and confirm it replaces the Games
      pillar. Proposed: `warm-up/game`, `skill`, `strength`, `mobility`,
      `conditioning`. Multi-value.
      **Two new constraints.** (a) The `Lists` tab **already declares
      `Session Types`** = `Warm Up` / `Skill` / `Strength` / `Game` — reconcile
      with that vocabulary instead of inventing a parallel one. (b) Games is
      **51 exercises, 11% of the library**, including `Rough Housing` and
      `Team Work & Connection`, which have no obvious movement home; and the
      proposed values contain **no partner/connection role** even though 4.13
      wants to score "partner work". Settle that before closing the field.
- [?] **1.3 Decide `cook` / `burn`** semantics and defaults.
- [?] **1.4 Decide Line and Discipline importance** — new columns or a separate
      tab? These are set manually, not derived.
- [x] **1.5 Both design tensions resolved.**
      §8.1 — **heat is carried by glow.** The glow halo has been taken off
      keystone pills to free the channel; they stay distinct via luminous fill,
      larger pill and dark ink label. Look still to be refined; wiring needs
      Phase 3 heat data.
      §8.2 — **Importance does not need splitting.** The `Importance legend` in
      the Links tab defines it as a programming-frequency scale
      (1 = in every program, 2 = every second, 3 = everything else), which is
      exactly what a cooling rate encodes.
- [?] **1.6 Taxonomy v2 — LARGELY SUPERSEDED, and much cheaper than it looked.**
      v2 was designed without sight of the `Lists` tab, and **two of its four
      headline findings are wrong**: `Front Lever Line` and the whole
      `Loaded Lower Body Strength` discipline (6 lines) **are already declared**
      in `Lists` and are simply unpopulated. Adopting v2's
      `Squat, Hinge & Single Leg` would duplicate a declared discipline under a
      new name.
      The v2 source files are also **missing from the machine and from git** —
      possibly lost. That no longer blocks this decision.
      **Reframed decision:** the cheap work is filing exercises into the
      **23 declared-but-empty LineKeys**. Only findings 5 (`Swinging &
      Brachiation`) and 6 (`Arms & Accessory`) are genuine additions not already
      declared. See `CLAUDE.md` §5.
- [ ] **1.7 Write the schema down** in `data/SHEET.md` once decided, so the
      loader and the sheet cannot drift. *(The file now exists and is verified —
      extend it rather than starting it.)*
- [ ] **1.8 Validate the taxonomy against `Lists`, not against exercise rows.**
      A `Discipline - Line` pair on an exercise row that is **absent** from
      `Lists` is an error and should fail loudly. A declared LineKey with no
      exercises is a **gap to fill**, not an error. Getting this backwards is
      what produced the wrong v2 findings. Also covers 2.8.
- [ ] **1.9 Pull 3.1 (lock the program format) forward into this phase.** It is
      marked urgent, three 6-week blocks of history are waiting, and it depends
      only on §7.7's section structure — which is already decided. It has no
      dependency on the wheel rebuild, so it should not sit behind Phase 2.

---

## Phase 2 — Rebuild the Movement Wheel on real edges

Do this **before** the Program Builder work: it is the fastest feedback loop
and it validates the schema visually. Bad edges are obvious on a diagram in a
way they never are in a spreadsheet.

- [x] **2.1 Fix `PILLAR_ORDER`.** ✅ Already correct in the imported wheel:
      `["Handstands & Balance", "Strength & Capacity", "Mobility",
      "Flocomotion", "Object Play", "Games"]` — the recommended adjacency.
      The Games colour is present too, so `CLAUDE.md` §6.2's trap is closed.
- [x] **2.2 Split the single file.** ✅ Done. Ten modules; see `CLAUDE.md` §2 for
      the layout and the three files that were not in the original sketch
      (`logo.js`, `svg.js`, `state.js`) and why.
      Code was moved by **line range, not retyped**, so the force model is
      verbatim. Verified against the live sheet: 491 exercises at max slider,
      all label coordinates finite, no console errors, exports enabled.
      **`file://` no longer works** — ES modules need an HTTP origin. Use
      `tools/serve.ps1`.
      Dropped as dead on the way through: `discColour`, `exDotColour`, `fitText`,
      `R_DISC_IN`, `R_DISC_OUT`, `R_EX_IN`, `R_EX_OUT`, `GAP_DISC` — all defined
      and never called. Note 2.6 will want a `discColour` again; write it against
      the real need rather than restoring it on spec.
- [ ] **2.3 Implement `shared/graph.js`** — typed edge list from the sheet.
      Reject contradictory reciprocal edges loudly.
- [~] **2.4 Replace line-chaining with the edge list.**
      **Step 1 done: the old links are entirely removed.** Line-derived links
      were generated because two exercises shared a Discipline+Line, which
      produced a mass of meaningless connections and made the force model fight
      its own data. Gone: the line chains, the edge list, the link springs, the
      anti-crossing pass, the link drawing, and the four `TUNE` parameters that
      served them (`linkStiff`, `linkLen`, `crossLen`, `linkCross`).
      `layout.js` 712 → 595 lines.
      **Boundary keystones survived**: the bridge analysis used to read the cross
      edges and now reads `Also Appears In` directly, which is where that
      information came from anyway.
      **Step 2 (blocked): reintroduce links from the typed edge list.** Needs
      `Progressions`/`Regressions` filled — still 0. Spring strength and stroke
      style then vary by edge type.
- [~] **2.5 Simplify the force model.** Well under way, and it did turn out to be
      removal rather than addition.
      **Gone with the links:** the link springs, the anti-crossing pass,
      `linkStiff`, `linkLen`, `crossLen`, `linkCross`.
      **Gone with all line-awareness:** inter-line repulsion, the per-line arc
      slots, the angular fan, `lineRepel`, `lineRange`, `angularSpread`. The
      layout no longer knows lines exist — Discipline and Line still drive colour
      and grouping elsewhere, they just exert no force.
      **Also gone: the level-based radial bias.** Level was placing low-level
      exercises near the hub and high-level ones at the rim, via two routes — an
      explicit `targetR` spring *and* the fill grid's sort order. Both removed.
      The fill grid now orders by name, which is neutral; sheet order would have
      made radius correlate with discipline and quietly reintroduced grouping.
      **What is left** is a pure per-pillar scatter: node charge repulsion, an
      even-density radial fill, and clearance from pillar titles and sector seams.
      **The only property of an exercise that affects where it lands is its
      pillar** — not its line, not its level, not its progressions.
      `TUNE` 19 → 12 exposed parameters; `layout.js` 712 → 513 lines.
      **Spacing fixes done since:**
      - `innerR` was `R_HUB + 26` in the layout but `R_HUB + 16` in
        `chooseDiscRadius`, so the radius calculation reserved different space
        than the layout used. Now one `R_INNER` constant in `svg.js`.
      - removed the vestigial `fillA`, `t` (cooling), `homeMid` and
        `bridgePillars` — all computed every render, never read.
      - **charge repulsion is box-aware.** It measured centre-to-centre distance,
        but pill widths vary 5.5× with name length, so two long pills side by
        side felt almost no repulsion while their ends overlapped. It now uses the
        gap between bounding boxes and pushes along the closest-point vector.
      - **title repulsion counts the pill's own box**, not just the title's. A
        long pill whose centre cleared a title but whose end overlapped it used
        to feel no push at all.
      - **pillar titles are now hard obstacles**, and a 24-pass settle loop
        alternates separation with clamping. `clampNode` is a hard constraint and
        ran last, so it could shove a node back into its wedge on top of a
        neighbour with nothing left to fix it.
      **Measured result: 0 pill/pill overlaps and 0 pill/title overlaps at both
      194 and 492 visible pills** (was 14 and 3).
      **Spacing round 2 (from Calum's render):** pills were stacking into
      aligned vertical columns with no horizontal spread. Two real defects found
      and fixed, plus one finding that is not a defect:
      - **the push direction was axis-locked.** It used the closest-corner vector,
        so for a vertical stack `gapX` is 0 and the push was *purely vertical* —
        a pill could never escape sideways, which built and then reinforced the
        columns. Now pushes along the vector between CENTRES.
      - **the per-node angular attractor was missing entirely.** `fillA` was
        deleted as vestigial when line-awareness was removed (its only consumer
        was the line-based angular force), leaving **radius as the only
        positional attractor** — so nodes kept their seeded angle and slid in and
        out radially. Restored per-node, with an `angularFill` slider.
      - proximity now uses per-axis overlap of boxes grown by `TUNE.air`, pushed
        by the smaller overlap. Calum's `min(gapX, gapY)` idea, but on grown
        boxes so it keeps a gradient — a raw `min(gap)` pinned nearly every
        neighbour to the 7px force cap and made things worse (measured).
      **Result: median vertical air 9px → 26px, 0 overlaps, 0 title overlaps.**
      **But the column effect is geometric, not a force bug.** Median pill is
      138×31px (4.4:1), so horizontal pitch is 164px against a vertical pitch of
      57px — nearly 3× asymmetric. Only ~7 pills fit across a pillar's arc while
      each pillar holds ~98, needing ~14 rows. Nearest-neighbour is therefore
      vertical for almost everyone no matter what the forces do.
      **The real lever is pill shape:** wrapping long names onto two lines would
      take a 138×31 pill to roughly 70×60 (~1.1:1) and make equal air actually
      look equal. Staggering alternate rows is a cheaper partial fix. Calum's
      call.
      **Still to do:** the radial distribution is rim-weighted and the innermost
      band is empty — the hardcoded 0.12 inner floor and the 1.35 disc-radius
      multiplier are the likely causes. Then retune and record defaults in
      `CLAUDE.md` §9.
- [ ] **2.6 Add discipline/line visual grouping** — shades of the pillar
      colour, plus tighter clustering for exercises sharing a line. This is the
      "subtly educates the viewer" goal: horizontal pulls near each other,
      vertical pulls near each other, both near but not mixed.
- [ ] **2.7 Infer `Level` by topological rank** from progression edges, with
      manual override. Avoids hand-filling ~400 rows.
- [ ] **2.8 Extend `validateRows()`** to warn on unresolvable `Also Appears In`
      references — but **resolve them against `Lists`** (see 1.8), otherwise it
      will report the 4 declared-but-empty Front Lever references as broken,
      which is exactly the mistake §6.4 recorded. Also warn on rows with a blank
      `Discipline`/`Line` — there are 16 and 57 of those respectively, and under
      fail-fast they should be loud, not silently bucketed as "Uncategorised".

---

## Phase 3 — Heat engine and program format

- [ ] **3.1 Lock the program file format.** Export == import. Must carry
      program date or block index, section, and concurrent slot. **Urgent** —
      three 6-week blocks of history are waiting to be entered by hand and
      back-filling twice would be miserable.
- [ ] **3.2 Implement `shared/heat.js`** as one pure function, aggregating at
      exercise / line / discipline level. Single implementation — three copies
      is how the views end up disagreeing.
- [ ] **3.3 Unit-test the heat engine** against hand-worked examples,
      especially: high-importance items cooling fast (handstand almost always
      cold), `cook` producing half-baked, `burn` producing burnt.
- [ ] **3.4 Enter the historical programs** (3 × 6-week blocks) in the locked
      format.

---

## Phase 4 — Program Builder

Independent of Phases 2–3; can run in parallel. Numbering follows Calum's
original list for traceability.

- [ ] **4.1 Restructure sections** to 10 / 5 / 15 / 15 / 15 min, up to 4
      concurrent exercises. *(was 3×20min, 3 concurrent)*
- [ ] **4.2 Fix drag-and-drop.** Currently buggy.
- [ ] **4.3 Drive the Library view from the sheet** instead of hard-coded data.
      Add importance filter and "hide variants".
- [ ] **4.4 Drive the Keystone view from the sheet** via `component` edges —
      progression chains and component breakdowns.
- [ ] **4.5 Group the shortlist by Session Role** (game/warm-up, strength,
      skill, mobility, conditioning) rather than a flat list.
- [ ] **4.6 Program history upload** → heat map across disciplines, lines and
      exercises, showing hot / cold / half-baked / burnt.
- [ ] **4.7 Goal selection** at discipline, line and keystone level, driven by
      the heat map.
- [ ] **4.8 Score metric** — "what would heat be after this program runs?"
      Flag when a stated focus is under-served, and when a goal keystone has
      untouched components.
- [ ] **4.9 Add the wheel as a lens** in the builder, reusing
      `wheel/layout.js`. Exercises selectable into the shortlist from it.
- [ ] **4.10 Cross-view selection.** Selecting an exercise in any view
      highlights it in all others (`shared/selection.js`).
- [ ] **4.11 Clickable discipline/line** in the exercise detail panel, jumping
      to that section of the Library view — same behaviour as the existing
      progression/regression links.
- [ ] **4.12 Apply heat visually** in all three lenses.
- [ ] **4.13 Extend the score metric** with partner work, strength vs skill vs
      mobility balance, intensity, fun — so a purely strength-focused program
      visibly shows what it is missing.
- [ ] **4.14 Program Blocks** (e.g. "The Jungle" = rope climbs, lizard crawl,
      L-sit hang, monkey crawl). Shape: name, ordered exercise list, section
      hint. Ships last, but **fix the data shape during Phase 1** so it is not
      retrofitted.

---

## Phase 5 — Spreadsheet completion

Ongoing, in parallel with everything. Data work, not code.

> Counts below verified against the 2026-08-18 snapshot (473 exercises). They
> drift as the sheet is filled — re-audit rather than trusting them.

- [ ] **5.1 Fill `Level`** — **364 of 473 blank.** Mostly solved by 2.7's
      inference.
- [ ] **5.2 Clean `Importance`** — **33 blank**; see the 1.5 split question.
- [~] **5.3 Set `Keystone` flags.** **7 are set, not zero.** But **none of them
      has an `Also Appears In`**, so the boundary-keystone two-tone fill still
      renders nothing (W3). Taxonomy v2 proposed 51.
      Also: `Breakdowns` names `Muscle Up` while `Exercises` flags
      `Muscle Up - Rings` — reconcile.
- [x] **5.4 Resolve the duplicate** `Bridge Circle`. ✅ Done — fixed exactly as
      recommended (one row, `Also Appears In` pointing at the other line).
      **But a new duplicate has appeared:** `Split Squat` exists twice —
      `Mobility › Foundational Resting Positions › Hip Opening (frontal)` and a
      second half-entered row with no pillar/discipline/line. Hidden at
      importance ≤ 2; **raising the slider to 3 stops the wheel drawing.** Fix:
      delete the blank-taxonomy row or give it a distinct name.
- [ ] **5.5 The 4 `Also Appears In` refs are NOT broken.** They point at
      `Lever & Straight-Arm Body Control - Front Lever Line`, which **is declared
      in `Lists`** and merely unpopulated. Nothing to fix here — the fix is
      1.8 (validate against `Lists`). **One real cell bug remains:**
      `Bridge Circle`'s value is `"Rhythm, Flow & Expression - Acrobatics"`
      *including literal quote characters* — remove them.
- [ ] **5.6 Categorise the uncategorised rows** — now **57 with a blank `Line`**
      and **16 with a blank `Discipline`**, up from the recorded ~24. Before
      adding v2's `Hip Opening - Lateral`, check the four *declared and empty*
      `Foundational Resting Positions` lines (`Squat Position`,
      `Stance Positions`, `Hip Opening (sagittal)`, `Spinal Extension`) — they
      are the obvious homes for most of these.
- [x] **5.7 Delete unused columns.** ✅ Done — `Loadable`, `Session Type`,
      `Class Types`, `Movement Split`, `Equipment` and `Video URL` are gone.
      `Notes` was kept and now holds **9** entries.
- [ ] **5.10 Fill the 23 declared-but-empty LineKeys.** This is the bulk of what
      Taxonomy v2 was really pointing at (see 1.6) — including the whole
      `Loaded Lower Body Strength` discipline and `Front Lever Line`.
      Highest-leverage data task in this phase.
- [ ] **5.11 Migrate multi-value cells to `;`.** Cheap today: `Progressions` and
      `Regressions` are **entirely empty**, and only one cell in the sheet
      contains a comma. Also rename the `Breakdowns` column
      `Component Exercises (comma-separated)`.
- [ ] **5.8 Fill thin lines.** Categories are correct but under-populated:
      Planche Line (1), Straight-Arm Balances (1), Single Leg & Split Stance
      (1), Vertical Jump (1), Squat Pattern (2), Bridge Work (2), Clubs & Rings
      (3), Thoracic & Chest Opening (3), Walkovers (3).
- [ ] **5.9 Two notable absences:** there is **no plain `Bridge`** despite a
      Bridge Work line and three bridge-derived skills, and **no plain
      `Squat`** despite squats living inside Thruster and Horse Stance Squats.

---

## Open questions for Calum

Data-level, from the name-cleanup pass. None blocking.

- [?] **"Schwheel"** — spelling unidentifiable. Swipe? Shushunova? Filed under
      Breaking & Power Moves on the assumption it is a floor/power move.
- [?] **"Human Flag - Limp"** — is "Limp" intended, or a typo for
      Lever / Limb?
- [?] **`Helicopter`** (Floor Flow) vs **`Helicóptero`** (Breaking) — two
      distinct moves, or the same thing to merge? *(Both still present in the
      live sheet, correctly UTF-8 encoded, so this is a real modelling question
      rather than an encoding artifact.)*
- [?] **`Bear Walk - Sexy` / `- Drunk`** — renamed under the variant
      convention, overriding established names. Revert?
- [?] **`Walking Lunge`** — primary home Bipedal Forward locomotion (current)
      or Single Leg & Split Stance?
- [?] **`Fin Push Up` / `Knuckles to Fin Push Up`** — unfamiliar, left as-is.

---

## Decision log

Record decisions here as they are made, with the reasoning. Prevents
re-litigating settled questions.

| Date | Decision | Reasoning |
|---|---|---|
| — | **Fail fast on duplicate names; no defensive tolerance.** | A tolerant version (per-line node index + `NaN` guards) was built and then deliberately reverted. It added complexity and would have made future bugs harder to find. |
| — | **Duplicate validation runs on filtered rows, not the whole sheet.** | No false alarms — errors exactly when the layout would break. Trade-off: the error can appear when the importance slider is raised. |
| — | **No build step.** Plain ES modules, no npm/bundler/CI. | Keeps free GitHub Pages hosting trivially working. Upgrade path if ever needed: Vite + GitHub Actions. |
| — | **Games will not remain a pillar.** | It is a role in a class, not a category of movement. Becomes a `Session Role` value. Orange `{h:25,s:62,l:54}` is a stopgap. |
| — | **Typed edge list replaces line-derived chaining.** | Current links exist because exercises share a Discipline+Line, producing noise and forcing the layout to honour a topology that does not reflect real relationships. |
| — | **Rebuild the wheel before the builder.** | Fastest feedback loop, and it validates the schema visually. |
| 2026-08-18 | **`Lists` is the authoritative taxonomy, not the exercise rows.** | The tab declares 61 LineKeys, 23 unpopulated. Inferring the taxonomy bottom-up from exercise rows makes declared-but-empty lines invisible and reports valid references as broken — which is exactly what produced two wrong Taxonomy v2 findings. |
| 2026-08-18 | **Multi-value fields use `;`, never `,`.** | The discipline `Rhythm, Flow & Expression` and the exercise `Foot Taps, Handslaps` both contain commas, so a comma delimiter shreds real values silently. Free to adopt now: `Progressions`/`Regressions` are empty and only one cell contains a comma. |
| 2026-08-18 | **`validateRows()` restored verbatim; not rewritten.** | It had been deleted from the imported wheel, against §6.1's explicit decision. Restored unchanged rather than reimplemented, so the documented behaviour and the code stay in step. It caught a real duplicate (`Split Squat`) within minutes. |
| 2026-08-18 | **Taxonomy v2 is superseded by "populate `Lists`", not adopted.** | Two of four headline findings re-derive structure `Lists` already declares. Its source files are also missing from the machine and from git. The cheap real work is filing exercises into the 23 empty declared LineKeys. |
| 2026-08-18 | **The columns view is archived at `archive/columns/`, not `pillars/`.** | The committed `pillars/index.html` was byte-identical to `movement_columns.html` — the A3 columns view. `pillars` already names the explicitly out-of-scope artifact, so keeping that name would be actively misleading. |
| 2026-08-18 | **Snapshots are fetched live, never copied from `Downloads`.** | The live `Exercises` tab was a strict superset of the newest local export (473 vs 449 rows, nothing removed). Picking a download would anchor every deterministic test to a stale baseline. |
