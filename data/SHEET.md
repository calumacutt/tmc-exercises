# The Movement Library — data contract

Source of truth is the Google Sheet. This file records **what the loaders may
rely on**. Update it whenever the sheet's shape changes; a drifting contract is
how the views end up disagreeing with each other.

Counts below were verified against `exercises.csv` / `lists.csv` /
`breakdowns.csv` as snapshotted **2026-08-18**. They will drift as the sheet is
filled — re-run the audit rather than trusting them indefinitely.

---

## 1. The sheet has three tabs

| Tab | Snapshot | Rows | Role |
|---|---|---|---|
| `Exercises` | `exercises.csv` | 473 | the library — one row per exercise |
| `Lists` | `lists.csv` | 61 LineKeys | **authoritative taxonomy** + enum dropdowns |
| `Breakdowns` | `breakdowns.csv` | 15 | **`component` edges** — keystone → capability → exercises |

### Published CSV URLs

`Exercises`:

```
https://docs.google.com/spreadsheets/d/e/2PACX-1vQDrwHw-jGM7r3ZO_i8orZWvJ_wxmMdfnUy3lvdsqwZeJGv_EyEvsiB1HxG1qrXIyzgtMrlZMhirtcI/pub?gid=955669041&single=true&output=csv
```

`Lists`: **TODO — not published yet.**

`Breakdowns`: **TODO — not published yet.**

Until those two are published their snapshots come from manual exports and
cannot be refreshed automatically. Publish both tabs (or set publish scope to
*Entire document*) and record the URLs here.

The published endpoint sends permissive CORS headers, so browser `fetch` works.
Keep the committed snapshots so tests are deterministic and work offline.

---

## 2. `Lists` is the taxonomy, not `Exercises`

**This is the most important rule in this file.**

The valid set of `Discipline - Line` pairs is **declared** in `Lists`, in the
`LineKey (Discipline - Line)` column. It is *not* the set of pairs that happen
to appear on exercise rows.

As of this snapshot: **61 declared LineKeys, 23 of which have zero exercises.**

Consequences:

- A loader that infers the taxonomy bottom-up from exercise rows **cannot see a
  declared-but-empty line**, and will wrongly report references to it as broken.
  This is what made the four `Lever & Straight-Arm Body Control - Front Lever
  Line` references look like dangling refs. They are not broken — that line is
  declared, and simply unpopulated.
- An empty declared line is a **gap in the data to be filled**, not an error.
- A `Discipline - Line` pair used on an exercise row but *absent* from `Lists`
  **is** an error, and should be reported loudly.

`Lists` also declares enum vocabularies, in parallel unrelated columns:
`Pillars`, `Statuses` (`Active` / `Idea` / `Retired`), `Levels` (1–7),
`Importance` (1–3), `Class Types`, `Splits`, `Session Types` (`Warm Up` /
`Skill` / `Strength` / `Game`), `Equipment`.

Note that `Session Types` substantially pre-empts the planned `Session Role`
field (CLAUDE.md §7.2) — reconcile with it rather than inventing a parallel
vocabulary.

---

## 3. Delimiter contract

**Multi-value fields are separated with `;` (semicolon). Never a comma.**

Commas cannot be the delimiter, because real values contain commas:

- the discipline **`Rhythm, Flow & Expression`** (34 exercises, 5 declared
  LineKeys) — so a comma-split shreds any `Also Appears In` pointing at one of
  its lines;
- the exercise **`Foot Taps, Handslaps`** — so a comma-split resolves it to two
  names that do not exist.

The wheel's `splitList()` splits on `;` only and logs a loud `console.error`
naming any value that still contains a comma. Do not "fix" that by accepting
both delimiters — see CLAUDE.md §11 on fail-fast.

Applies to `Progressions`, `Regressions`, `Also Appears In`, and the planned
`Related` / `Components`.

**Known offender:** `Bridge Circle`'s `Also Appears In` is
`"Rhythm, Flow & Expression - Acrobatics"` — *including literal quote
characters*, which are an attempt to escape the comma. CSV quoting is stripped
before `splitList` sees the value, so the quotes end up inside the string and it
cannot match a LineKey. Fix in the sheet: remove the quote characters.

---

## 4. `Exercises` columns

| Column | Notes |
|---|---|
| `Name` | **Primary key. Must be globally unique.** See §5. |
| `Pillar (auto)` | Formula-derived from `Discipline`. |
| `Discipline` | Must pair with `Line` to form a declared LineKey. |
| `Line` | " |
| `Importance` | 1–3. Display filter **and** planned cooling rate. 33 blank. |
| `Level` | 1–7. Only 109 of 473 filled — to be inferred by topological rank. |
| `Keystone` | `TRUE`/`FALSE`. 7 currently `TRUE`. |
| `Variant Of` | Parent exercise name. 119 filled. Variants hidden by default. |
| `Regressions` | `;`-separated exercise names. **Currently 0 filled.** |
| `Progressions` | `;`-separated exercise names. **Currently 0 filled.** |
| `Also Appears In` | One or more declared LineKeys, `;`-separated. 8 filled. |
| `Notes` | Prose. 9 filled. Not rendered. |
| `Status` | **Not present as a column**, though its enum is declared in `Lists`. The wheel filters `/^retired$/i` if it ever appears. |

Column lookup is **by header name, case-insensitive**, via a `field()` helper
returning `""` when a header is absent. Therefore **column order is irrelevant**
and **missing columns are safe**. Cell values are trimmed on read, so trailing
whitespace in the sheet (currently 35 names have it) does not break the key.

The export carries a trailing empty column and blank spacer rows; both are
tolerated. Rows are skipped unless `Name` is non-empty.

### Naming convention

Variants are `Base - Modifier`, never `Modifier Base`:
`Handstand - Stag`, `Front Lever - Tuck`, `Push Up - Fingertips`.

---

## 5. `Name` is a primary key — duplicates refuse to render

The node index, within-line chains, `Progressions`/`Regressions` and
`Also Appears In` all resolve by name. A duplicate makes the graph ambiguous and
historically produced a `NaN` cascade that collapsed two whole pillars.

`validateRows()` runs at the top of `render()` and **refuses to draw** on any
duplicate, naming it, its occurrence count and the full
`Pillar › Discipline › Line` of each occurrence, and disabling the export
buttons. Full history in CLAUDE.md §6.1. Do not add tolerance here.

Validation runs on the **filtered** rows, deliberately — so a duplicate hidden
by the importance slider or the variants toggle does not block rendering, and
the error can therefore appear when the slider is raised.

**Live duplicate as of this snapshot:** `Split Squat` appears twice —
`Mobility › Foundational Resting Positions › Hip Opening (frontal)`, and a
second half-entered row with no pillar, discipline or line. Hidden at importance
≤ 2; raising the slider to 3 stops the wheel drawing. Fix in the sheet: delete
the blank-taxonomy row, or give it a distinct name.

---

## 6. `Breakdowns` columns

| Column | Notes |
|---|---|
| `Keystone` | Exercise name. Should match an `Exercises.Name`, and ideally have `Keystone = TRUE`. |
| `Component` | Free-text capability, e.g. "Dip transition strength". Not an exercise. |
| `Component Exercises (comma-separated)` | **Header says comma; §3 says semicolon.** The header is wrong — migrate the cells to `;` and rename the column. |

This tab **is** the `component` edge table described in CLAUDE.md §7.1, already
populated for 3 keystones. §7.1's "keep links as columns on the exercise row"
recommendation should be revisited for `component` specifically, since a
separate tab already exists and the old builder already parses this exact shape
(its `EMBEDDED_CSV` section 3).

Not every `Keystone` value here has `Keystone = TRUE` in `Exercises` — e.g.
`Muscle Up` here vs the flagged `Muscle Up - Rings` there. Reconcile before
wiring it up.

---

## 7. Known data gaps (to fill, not to code around)

| Gap | Count |
|---|---|
| Declared LineKeys with no exercises | 23 of 61 |
| Rows with blank `Line` | 57 |
| Rows with blank `Discipline` | 16 |
| Rows with blank `Importance` | 33 |
| `Level` unfilled | 364 of 473 |
| `Progressions` / `Regressions` filled | 0 / 0 |
| Keystones flagged | 7 |
| Keystones with an `Also Appears In` | **0** — so the boundary-keystone two-tone fill has nothing to render |
