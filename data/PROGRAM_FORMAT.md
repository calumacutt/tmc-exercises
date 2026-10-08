# PROGRAM_FORMAT.md — the program file contract

One file per program. Markdown, so the file is **simultaneously** the record, the
machine-readable history, and the poster source. **Export must equal import**
(CLAUDE.md §7.6): the Program Builder writes exactly this and reads exactly this,
so a program can be round-tripped without loss.

Locked so the three 6-week blocks of history can be entered by hand once.

---

## 1. Terminology

| Term | Meaning |
|---|---|
| **Program** | One file. One 6-week block, identified by its **start date**. |
| **Class** | A class *type* — what it trains, not when it runs. Free text. |
| **Session** | A titled, optionally timed block *within* a class. |
| **Bullet** | One poster line. Free text, plus the exercises it maps to. |
| **Exercise** | A row in the Movement Library, referenced as `[[Name]]`. |

⚠️ **A class is a TYPE, not an instance.** Each runs many times across the six
weeks, so no day, time, room or coach is recorded.

---

## 2. The format

```markdown
# TMC Program

Date: 2026-09-01

<!-- A note. This is the only way to write prose in the file. -->

## Lower Body

### Juggling Lesson (5 min)
- 3 ball cascade (reverse cascade), 4 ball (fountain) [[3 Ball Cascade]] [[4 Ball Fountain]]
- Or hacky sack [[Hacky Sack]]

### Movement Game (10 min)
- Teachers choice (lower body focus)
```

That is the whole grammar.

---

## 3. Revised 2026-10-08, after reading seven real posters

The format was locked in August against an *imagined* program. Seven real class
posters then disagreed with it in four ways, and **the format moved, not the
posters.** What changed, and why:

### A bullet is FREE TEXT plus `[[links]]`

Real lines are programming instructions, not exercise names: `Pull up/Chin up
x 5-8` offers a choice and a dose, `Teachers choice` names nothing, and one
`Banded routine` line referenced eight exercises. The old rule — one bullet is
one exercise name — was contradicted by most real lines.

So the bullet text is what goes on the poster, and `[[Exercise Name]]` references
are what the machine reads. One mechanism covers choices, dose, prose and lists,
and `export == import` still holds.

A bullet with **no links is legitimate** — `x 3 sets` is not an exercise. But it
is also what a forgotten `[[...]]` looks like, so unlinked bullets are **counted
and warned**, never silently accepted. In the first real program, 35 of 103
bullets are unlinked and every one is an instruction or a known library gap.

### Class names are OPEN

They were a closed list of six. That was only ever typo protection — stopping
`Legs`, `Lower body` and `Lower Body` becoming three classes — and it is the
wrong tool, because the gym changes its classes and the real posters already
carried seven, two of them Handstand streams (`Beg/Int`, `Int/Adv`).

**Class names mean nothing to heat**, which reads a date and a set of exercise
names. So they are free text, and `checkClassVocabulary()` does the typo job
across files instead: a class name appearing in exactly one program out of
several is **warned**, since recurrence is what separates a new class type from a
typo. A warning, not an error — the first program to introduce a real new class
would trip it too.

### Sessions are TITLED, and timed per program

`### <Title>` with an optional `(M min)`. The number is gone: file order gives
the sequence, exactly as bullet order does within a session.

"The Monkey Flip" and "Ring Play / Build to Routines" are the most informative
thing on a poster, and `### Session 3` threw that away for an invented ordinal.

⚠️ **§7.7's fixed 10/5/15/15/15 is GONE, and so is the 4-concurrent limit.**
Every poster disagreed with both. Observed: 5/10/15/20/10, 5/5/15/20/15,
10/10/10/15/15, 5/15/3/15/10/5 — five or six sessions, varying lengths, some
printing no duration at all. The duration is therefore **optional**: recording
null is honest, guessing a number is not. And no poster had a Personal Goals
session.

### Weeks are not modelled

One poster ran its ring section week by week across the block. Heat counts
anything in the block as trained, so the weeks stay as free text with every
exercise linked. Nothing is lost that heat would have used.

---

## 4. Parsing rules

| Line | Rule |
|---|---|
| `# ...` | Title. Free text, **ignored**. |
| `Date: YYYY-MM-DD` | **Required, ISO only.** Block start, and the sort key for heat. |
| `<!-- ... -->` | A note. Spans lines. Renders as nothing, so the poster stays clean. |
| `## <name>` | Starts a class. Any name. |
| `### <title>` or `### <title> (M min)` | Starts a session. Duration optional. |
| `- <text> [[Name]] ...` | A bullet: free text plus zero or more exercise references. |
| anything else | ⚠️ **ERROR.** See below. |

**Concurrent slot is bullet order**; **session order is file order**.

### An unrecognised line is an ERROR

The table used to say "anything else — ignored", which meant **a mistyped bullet
dropped an exercise silently**. That is the one fault a program file cannot be
audited for afterwards, because the evidence is the absence of a line nobody
remembers writing.

The cost is that prose cannot sit loose in a file. `<!-- ... -->` is the escape
hatch: a note has to be *marked* as a note, which is cheap, and an exercise can
never go missing without the file refusing to load, which is not. An unclosed
`<!--` is itself an error, since it would swallow the rest of the file.

### Punctuation is tolerated; data is not

`-`, `*` and `+` all read as the same bullet. The marker carries no meaning, and
a Markdown `*` would otherwise be refused for no reason.

---

## 5. Fail-fast rules

Same posture as `validateRows()` (CLAUDE.md §6.1). Import **refuses the file** on:

- **An exercise name in `[[...]]` that is not in the library.** Name is the
  primary key; a near-miss must not be fuzzy-matched. Reports the name, class and
  session.
- **Missing, non-ISO or duplicated `Date`.**
- **A line that is not a class, session, bullet or note** (above).
- **An unclosed `<!--`.**
- **An empty `[[]]`**, an empty bullet, an empty class name, an empty session
  title, or a file with no classes.
- **The same class twice in one file** — it is either a duplicate or a
  continuation and there is no way to tell which.
- **A session before any class**, or a bullet before any session.

Warn, but load:

- **unlinked bullets** (count);
- a **class name seen in only one program** of several;
- the same exercise **referenced twice in one bullet**;
- a **filename that disagrees with `Date:`**.

Duplicate exercises *across* bullets, sessions or classes are fine and expected —
the same exercise in Upper Body and Full Body is normal programming, and heat
takes a set.

---

## 5a. The parser — `shared/programs.js`

`parseProgram(text)` handles structure and needs nothing else, so a file can be
parsed, diffed or round-tripped offline. `validateAgainstLibrary(program, names)`
is the one rule needing the sheet. `exerciseSet(program)` is the heat input of
§7. `checkClassVocabulary(programs)` is the cross-file typo check. Problems are
**objects**, not strings, with `formatProblem()` exported.

⚠️ **All structural problems are collected, not thrown on the first.** The file
is still refused, but history is entered by hand and one fault per reload would
be miserable.

---

## 6. Filing

```
data/programs/YYYY-MM-DD.md
```

⚠️ **`data/programs/` is HEAT INPUT. Nothing invented goes in it.** A program
nobody ran would quietly cool every exercise it names, and the format gives a
fixture and real history exactly the same shape. Fixtures live in
`data/examples/` — that is why `program-format-example.md` was moved there.

---

## 7. What heat reads from this

`shared/heat.js` (Phase 3, **not yet built**) needs only:

- the **date** — to order programs and count "programs since last trained";
- the **set of exercise names** in the program.

Class and session are *not* inputs to heat. They are carried for round-trip
fidelity, for the poster, and for the balance metric (§7.5), which does care
which role an exercise was programmed in.

✅ **DECIDED: appearing anywhere in a program counts as trained, equally.** No
weighting by how many classes or sessions an exercise appears in, and no counting
of repeats. An exercise in one session of one class is as trained as one in all
six classes.

So the heat input from a program is just **the date plus a SET of exercise
names** — the class and session structure is genuinely irrelevant to heat, not
merely unused. That makes `programsSinceLastTrained` trivially computable: order
the files by date, and count back to the last program whose set contains the name.

The consequence to accept knowingly: heat cannot distinguish "lightly touched"
from "hammered all block". That is fine because the question heat answers is *has
this been covered recently*, not *how much volume did it get*.

⚠️ **The decision lives in `heat.js`, not in the file format.** These files record
the full class/session structure regardless, so if frequency weighting is ever
wanted, it can be added without re-entering a single program.
