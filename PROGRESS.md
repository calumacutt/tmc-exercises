# PROGRESS.md

Task state and next actions. Architecture, data contract and traps live in
`CLAUDE.md` — read that first.

**Convention:** `[ ]` todo · `[~]` in progress · `[x]` done · `[?]` needs a
decision from Calum before it can proceed.

---

## Current position

Migrating from a Claude chat workflow (single-file downloads, no version
control) into this repo. Nothing in the new structure has been built yet.

The repo currently contains **only** the old Program Builder as root
`index.html`, with hard-coded exercise data.

**Immediate next action:** Phase 0, task 0.1 — gather the existing artifacts
into the repo.

---

## Phase 0 — Get everything into the repo

Nothing can be worked on properly until the artifacts are in one place under
version control. Several exist only as downloaded files on Calum's machine.

- [ ] **0.1 Collect loose artifacts.** These were produced in chat and exist as
      local downloads:
  - `movement_wheel.html` (~1,656 lines — the current, tuned, validated
    version) → will become `wheel/`
  - `movement_columns.html` (~895 lines, A3 landscape columns view) →
    `archive/`
  - `movement_pillars.html` (if it exists locally) → `archive/`
  - `library_v2.csv`, `TAXONOMY_V2.md`, `REVIEW_NOTES.md`, `moves.txt`,
    `changes.txt`, `library_clean.csv` → `docs/taxonomy-v2/`
      *(reference material for the v2 decision — do not treat as live data)*
- [ ] **0.2 Move Program Builder** from root `index.html` to
      `builder/index.html`. Note the URL change; root becomes the hub.
- [ ] **0.3 Create the folder skeleton** per `CLAUDE.md` §2 (`shared/`,
      `wheel/`, `builder/`, `data/`, `archive/`, `tools/`).
- [ ] **0.4 Add `tools/serve.sh`** (`python3 -m http.server 8000`) and confirm
      `http://localhost:8000/` works. Required before any module split — see
      `CLAUDE.md` §3.
- [ ] **0.5 Commit a data snapshot** to `data/movement-library.csv` and write
      `data/SHEET.md` with the published URL and the column contract.
- [ ] **0.6 Build the hub page** at root `index.html` — plain links to
      `/wheel/` and `/builder/`. Keep it minimal.
- [ ] **0.7 Verify GitHub Pages** still serves correctly after restructuring,
      including the subdirectory pages.
- [ ] **0.8 Commit.** From here on, commit before each chunk of work so
      "revert that" is trivial.

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
- [?] **1.3 Decide `cook` / `burn`** semantics and defaults.
- [?] **1.4 Decide Line and Discipline importance** — new columns or a separate
      tab? These are set manually, not derived.
- [?] **1.5 Resolve the two design tensions** in `CLAUDE.md` §8: what visual
      channel carries heat, and whether Importance needs splitting into
      display-filter vs cooling-rate. **Both must be settled before the render
      rework in Phase 2.**
- [?] **1.6 Decide on Taxonomy v2 adoption** — adopt wholesale, adopt in part,
      or re-derive against the current sheet. It was designed against an older
      snapshot and the owner has since added the Games pillar. See
      `CLAUDE.md` §5.
- [ ] **1.7 Write the schema down** in `data/SHEET.md` once decided, so the
      loader and the sheet cannot drift.

---

## Phase 2 — Rebuild the Movement Wheel on real edges

Do this **before** the Program Builder work: it is the fastest feedback loop
and it validates the schema visually. Bad edges are obvious on a diagram in a
way they never are in a spreadsheet.

- [ ] **2.1 Fix `PILLAR_ORDER`.** It still contains old demo names, so pillar
      order is currently arbitrary — which makes boundary-keystone detection
      luck-based. See `CLAUDE.md` §6.3. Choose an order putting
      heavily-bridged pairs adjacent (Strength↔Handstands, Mobility↔Strength).
- [ ] **2.2 Split the single file** into `wheel/index.html` + `layout.js` +
      `render.js` + `tune.js`, and move parsing/taxonomy into `shared/`.
      Switch Playwright tests to `http://localhost:...`.
- [ ] **2.3 Implement `shared/graph.js`** — typed edge list from the sheet.
      Reject contradictory reciprocal edges loudly.
- [ ] **2.4 Replace line-chaining with the edge list** in the layout. Spring
      strength and stroke style vary by edge type.
- [ ] **2.5 Simplify the force model.** Expect to *remove* machinery, not add
      it — much of the current tuning compensates for spurious links. Retune
      the defaults afterwards and record the new values in `CLAUDE.md` §9.
- [ ] **2.6 Add discipline/line visual grouping** — shades of the pillar
      colour, plus tighter clustering for exercises sharing a line. This is the
      "subtly educates the viewer" goal: horizontal pulls near each other,
      vertical pulls near each other, both near but not mixed.
- [ ] **2.7 Infer `Level` by topological rank** from progression edges, with
      manual override. Avoids hand-filling ~400 rows.
- [ ] **2.8 Consider extending `validateRows()`** to warn on unresolvable
      `Also Appears In` references (currently silent — `CLAUDE.md` §6.4).

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

- [ ] **5.1 Fill `Level`** — largely blank. Mostly solved by 2.7's inference.
- [ ] **5.2 Clean `Importance`** — inconsistent; see the 1.5 split question.
- [ ] **5.3 Set `Keystone` flags.** The live sheet has **zero**, so the wheel's
      keystone treatment has nothing to render. Taxonomy v2 proposed 51.
- [ ] **5.4 Resolve the duplicate** `Bridge Circle` (Flocomotion/Acrobatics +
      Handstands/Bridge Work). Preferred fix: keep one row, point its
      `Also Appears In` at the other line. **The wheel currently refuses to
      render because of this.**
- [ ] **5.5 Fix the 4 broken `Also Appears In`** references pointing at
      `"Lever & Straight-Arm Body Control - Front Lever Line"`.
- [ ] **5.6 Categorise the ~24 uncategorised rows** — the frontal-plane hip
      cluster. Resolved by adopting v2's `Hip Opening - Lateral`.
- [ ] **5.7 Delete unused columns** — `Loadable`, `Session Type`,
      `Class Types`, `Movement Split`, `Equipment`, `Video URL`, `Notes`.
      Confirmed unread. **Copy out the 5 `Notes` entries first** — the only
      real content there.
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
      distinct moves, or the same thing to merge?
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
