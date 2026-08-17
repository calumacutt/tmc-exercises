# Proposal — fill the declared-but-empty lines

**Generated 2026-08-18** from a live fetch of all three tabs.
Regenerate with `python data/proposals/build.py`.

**I have not touched the sheet.** Everything here is for you to apply by hand.
The script validates every proposed target against the `Links`/`Lists` tab and
refuses to emit anything pointing at an undeclared LineKey.

Output files:

| File | Contents |
|---|---|
| `assignments.csv` | 40 rows that currently have a blank `Line` → a declared LineKey |
| `moves.csv` | 36 rows that **are** filed, but filed wrongly → a better LineKey |

---

## The headline finding: `Hip Opening (frontal)` holds the sagittal work

`Foundational Resting Positions - Hip Opening (frontal)` currently holds 33
exercises. Nearly all of them are **sagittal-plane** — front splits, long
lunges, couch stretch, hip-flexor stretch, forward folds, elephant walk,
Thomas stretch, kneeling runner's stretch, leg swings front/back.

Meanwhile `Hip Opening (sagittal)` is **declared and empty**, and the 21
genuinely **frontal-plane** movements you're mid-way through entering — pancake,
middle splits, frog, butterfly, 90/90, Copenhagen, horse stance — have no `Line`
at all.

**So the line's name and its contents disagree.** The fix needs no new lines:

1. move ~21 sagittal exercises out of `(frontal)` into `(sagittal)`
2. file the 21 unfiled frontal-plane rows into `(frontal)`
3. move `Jefferson Curl` ×3, `Good Morning` ×3 and `RDL` out of hip-opening
   entirely — they are loaded hip **hinges**, not mobility positions

This is worth your physical read before you apply it. It's exactly the kind of
call you're better placed to make than I am, and it's a bigger change than it
looks — it re-homes about a sixth of the Mobility pillar.

**This also revises Taxonomy v2.** v2 said "the only hip line was Hip Opening
(frontal)" and proposed adding `Hip Opening - Lateral`. Both hip lines already
exist. No new line is needed here.

## Second finding: the front lever migration is already half-written

The whole front lever family (`Front Lever`, `- Straddle`, `- Tuck`,
`Front Lever Pull` ×3, `- Deadlift`) sits under
`Hanging & Pulling Above the Bar - Horizontal Pull`, while
`Lever & Straight-Arm Body Control - Front Lever Line` is declared and empty.

And four sibling rows — `Skin the Cat` ×3 and `360 Pull` — **already carry
`Also Appears In = "Lever & Straight-Arm Body Control - Front Lever Line"`.**
Someone started this migration by hand and stopped. `moves.csv` finishes it.

## Third finding: two mis-filings worth knowing about

- **`Kettlebell Swing` is filed under `Planche Line`.** It's a hip hinge. This
  is why `Planche Line` appeared to have 2 exercises — it really has 1
  (`Planche`).
- **`Back Lever`, `Back Lever - Tuck`, `- Straddle`, `German Hang`,
  `- Assisted` are under `Pressing Strength - Horizontal Press`.** They are
  straight-arm *pulling* holds. **This is v2's finding #2, and v2 was right.**
  But there is **no `Back Lever Line` declared**, so these cannot be fixed by
  re-filing — see below.

---

## What this proposal does NOT solve

**12 of the 23 empty lines get filled. 11 stay empty**, and 23 rows have no
honest home. I've left them unplaced rather than forcing them somewhere wrong.

### You need to declare 3 new lines, and rename 1

Counts below are emitted by `build.py`, not tallied by hand:

| What's needed | Why | Rows waiting |
|---|---|---|
| declare `Lever & Straight-Arm Body Control - Back Lever Line` | Back levers and German hangs are straight-arm pulls, currently mis-filed under Pressing Strength. v2 asked for this and was right. | 5 |
| declare `Foundational Resting Positions - Thoracic & Chest Opening` | Chest/thoracic openers have nowhere to go. `PROGRESS` §5.8 names a line like this, but **it is not in the `Links` tab** — so that note was written against a different taxonomy. | 5 |
| declare a **side-body / lat** line | `Standing Lat Stretch`, `Squat Lat Stretch`, `Mermaid Stretch`. Lumping these under "thoracic" would be anatomically wrong — they're lateral flexion, not thoracic extension. | 3 |
| **rename** `Prehab & Rehab - Banded` to a functional name | See below. | 4 |

That accounts for 17 of the 23 unplaced rows. The remaining **6 have no
proposal from me at all**: `Kettlebell Halo`, `Kettlebell Around the world`,
`Kettlebell ATW to Lunge`, `Kettlebell Wood Chop` (loaded shoulder/rotation
work — no declared line is close) and `Table Top Lifts` / `Table Top Hold`
(reverse-plank posterior work). These want your call rather than my guess.

### `Prehab & Rehab - Banded` is named after equipment, not function

That line holds 19 exercises including `Banded External Rotation`,
`Banded Lower Trap Pull` and `Banded Facepull`. You are now adding
`Cuban Rotation`, `Dumbell Lower Trap Raise`, `Dumbell Internal/External
rotion` and `Dumbell Flys` — the **same movements with a dumbbell** — and they
have nowhere to go, because the line is named for the band rather than the job.

Recommendation: **rename `Banded` → `Shoulder & Scapula`** (or similar), which
absorbs all of them at once and stops the problem recurring for cables, cuffs
or rings. Equipment belongs in an `Equipment` column, not in a line name.

Note the same line also contains `Bicep Curl - Banded` and
`Tricep Extension - Banded` — arm isolation, which is v2's finding #6. That one
still stands.

### Lines left empty that probably have exercises hiding elsewhere

`Rolls`, `Flips & Handsprings`, `Capoeira Inversions` are empty while
`Inverted & Rotational Locomotion - Cartwheel Family` holds 16 and
`Ground Locomotion - Rolling Locomotion` holds 10. Those 16 and 10 very likely
contain rolls and handsprings that belong in their own lines. I haven't proposed
splits because I'd be guessing at your intent — worth a second pass with you.

Genuinely likely to need *new exercises* rather than re-filing:
`Hand-Reactive Spring`, `Rotational / Kick Power`, `Squat Position`,
`Object Manipulation`, `Reactive Catching`, `Foot-Eye Cross`,
`Dance / Musical Movement`, `Spinal Waves`, `Hip Articulation`,
`Rotational Articulation`, `Posterior Chain (knee)`.

---

## How to apply it

Both CSVs carry a **`Sheet line`** column — the actual row number in the
`Exercises` tab as of the 2026-08-18 fetch. **Re-run the script before applying
if the owner has been editing**, or the row numbers will have drifted. Match on
`Name` rather than row number if in doubt; `Name` is the primary key.

### `assignments.csv` — rows with a blank Line

Fill in `Discipline` and `Line`. `Pillar (auto)` is a formula, so it fills
itself. The `Confidence` column is mine:

- **`high`** (32 rows) — apply directly.
- **`check`** (8 rows) — my reasoning is in `build.py`; these want your call.
  The rotation-vs-abduction ones especially: `90/90`, `Pigeon Stretch`,
  `Pigeon Stretch - Box` could each be `Hip Articulation` instead of
  `Hip Opening (frontal)`.

### `moves.csv` — rows already filed, filed wrongly

Shows current *and* proposed values side by side so you can see exactly what
changes. **Apply this one after `assignments.csv`**, and ideally after you've
decided on the frontal/sagittal swap above, since 21 of the 36 rows depend on it.

### Two single-cell fixes, unrelated to the above

1. **`Split Squat` is duplicated.** One at
   `Mobility › Foundational Resting Positions › Hip Opening (frontal)`, one
   half-entered with no taxonomy. **The wheel refuses to render at importance 3
   because of this** — `Name` is the primary key. Delete the *old* Mobility row
   and keep the new one; `assignments.csv` files the new one under
   `Loaded Lower Body Strength - Single-Leg Squat`, which is where a split squat
   belongs. (Its presence in hip-opening is more evidence for the swap above.)
2. **`Bridge Circle`'s `Also Appears In`** contains literal quote characters:
   `"Rhythm, Flow & Expression - Acrobatics"`. Delete the two `"` characters.
   Also change the separator to `;` if you ever put two values in that cell —
   the discipline name itself contains a comma, so commas cannot separate.

### While you're in there

- **`Importance` legend vs enum disagree.** The legend defines 1–5
  (`4 = Occasional`, `5 = Niche / rare`) but the `Importance` dropdown lists
  only 1–3, and only 1–3 are in use. Pick one. If you extend to 5, tell me — the
  wheel's slider is hard-capped at 3 and would need raising.
- **33 rows have a blank `Importance`**, all in the band you're working through.
