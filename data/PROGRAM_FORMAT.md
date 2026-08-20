# PROGRAM_FORMAT.md — the program file contract

One file per program. Markdown, so the file is **simultaneously** the record, the
machine-readable history, and the poster source. **Export must equal import**
(CLAUDE.md §7.6): the Program Builder writes exactly this and reads exactly this,
so a program can be round-tripped without loss.

Locked so the three 6-week blocks of history can be entered by hand once.

---

## 1. Terminology

Calum's words, and they win over the older draft:

| Term | Meaning |
|---|---|
| **Program** | One file. One 6-week block's worth of programming, dated. |
| **Class** | A distinct class the gym runs (day/time/level). A program has several. |
| **Session** | A timed block *within* a class. Numbered, with a duration. |
| **Exercise** | A row in the Movement Library. Matched by name. |

⚠️ **`Session` is what CLAUDE.md §7.7 used to call `Section`.** Same thing —
the five timed blocks of 10/5/15/15/15 min. §7.7 has been renamed to match.
"Session" reads as "a whole class" in most gyms, so the distinction to hold onto
is: a class *contains* sessions.

---

## 2. The format

```markdown
# TMC Program

Date: 2026-08-21
Block: 3

## Tuesday 6pm

### Session 1 — Warm Up (10 min)
- Bear Walk
- Leg Swings - Front

### Session 2 — Personal Goals (5 min)

### Session 3 — Skill (15 min)
- Cartwheel
- Shoulder Stand - Parallettes
```

That is the whole grammar. Nothing else is significant.

---

## 3. Parsing rules

Read top to bottom. Every machine-critical value sits on its own labelled line or
in a heading — never buried in prose, so a human can reword freely around it.

| Line | Rule |
|---|---|
| `# ...` | Title. Free text, **ignored**. |
| `Date: YYYY-MM-DD` | **Required, ISO only.** The sort key for heat. |
| `Block: N` | Optional integer. The 6-week block index. |
| `## <name>` | Starts a class. The whole line after `## ` is the class name. |
| `### Session N — <role> (M min)` | Starts a session. `N` integer, `<role>` free text, `M` integer minutes. Either `—` or `-` accepts as the separator. |
| `- <exercise name>` | An exercise in the current session. The rest of the line, trimmed, is the name. |
| anything else | Ignored — blank lines, prose, italic notes, `_(not programmed)_`. |

**Concurrent slot is the list order.** §7.6 requires the slot to be carried;
bullet position 1-4 *is* the slot, so no extra syntax is needed and the builder
can rebuild its lanes exactly.

**A session with no bullets is legitimate** — that is how Session 2 (personal
goals, not programmed by the teacher) is recorded. Do not write a placeholder
exercise.

---

## 4. Fail-fast rules

Same posture as `validateRows()` (CLAUDE.md §6.1): loud and specific, no silent
degradation. Import **refuses the file** on any of these:

- **An exercise name that is not in the library.** Name is the primary key; a
  near-miss must not be quietly dropped or fuzzy-matched. Report the name, the
  class, and the session.
- **Missing or non-ISO `Date`.** Heat cannot be ordered without it.
- **A `### Session` line that does not parse.** Do not guess a duration.
- **The same exercise twice in one session.**
- **More than 4 exercises in one session** (§7.7's concurrent limit).
- **An exercise line before any `### Session` heading**, or a session before any
  `## Class` heading — the file is structurally broken.

Duplicate exercise names *across* sessions or classes are fine and expected.

---

## 5. Filing

```
data/programs/YYYY-MM-DD.md
```

Dated filename so the directory sorts chronologically and the date is visible
without opening anything. `Date:` inside the file remains authoritative — the
filename is a convenience, and a mismatch should warn.

---

## 6. What heat reads from this

`shared/heat.js` (Phase 3, **not yet built**) needs only:

- the **date** — to order programs and count "programs since last trained";
- the **set of exercise names** in the program.

Class and session are *not* inputs to heat. They are carried for round-trip
fidelity, for the poster, and for the balance metric (§7.5), which does care
which role an exercise was programmed in.

⚠️ **One decision deliberately left open.** If an exercise is programmed in only
one of a program's three classes, is it "trained"? Two defensible answers: count
it (simplest, and matches "did we cover this"), or weight by the fraction of
classes. This format records enough to support either, so the decision can wait
for `heat.js` — but it must be made there and written down, not left implicit.
