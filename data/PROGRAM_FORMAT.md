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
| **Program** | One file. One 6-week block, identified by its **start date**. |
| **Class** | A class *type* — what it trains, not when it runs. See §3. |
| **Session** | A timed block *within* a class. Numbered, with a duration. |
| **Exercise** | A row in the Movement Library. Matched by name. |

⚠️ **`Session` is what CLAUDE.md §7.7 used to call `Section`.** Same thing —
the five timed blocks of 10/5/15/15/15 min. §7.7 has been renamed to match.
"Session" reads as "a whole class" in most gyms, so the distinction to hold onto
is: a class *contains* sessions.

⚠️ **A class is a TYPE, not an instance.** Each one runs many times across the
six weeks, on various days and at various times. The program records *what was
programmed*, so no day, time, room or coach is captured — and none should be
added, because a class type has no single one.

---

## 2. The format

```markdown
# TMC Program

Date: 2026-08-21

## Upper Body

### Session 1 — Warm Up (10 min)
- Stick Dislocate
- Bear Walk

### Session 2 — Personal Goals (5 min)

### Session 3 — Skill (15 min)
- Skin the Cat
- German Hang
```

That is the whole grammar. Nothing else is significant.

---

## 3. Class vocabulary

Three **core** classes, in every program:

`Upper Body` · `Full Body` · `Lower Body`

Three **optional** classes, included when the block calls for them:

`Handstand` · `Mobility` · `Flocomotion`

So a program holds **3 to 6 classes**. Order in the file is presentation order;
it carries no meaning.

An unrecognised class name is an **error**, not a new class — same posture as the
taxonomy, where `Lists` is authoritative and an undeclared value is a fault
rather than a discovery (CLAUDE.md §6.4). Adding a class type means adding it to
this list first, deliberately. That is what stops `Lower body`, `Legs` and
`Lower Body` quietly becoming three classes in the history.

A **missing core class** should warn rather than fail: it is far more likely to be
a program that genuinely did not run one than a typo, and refusing to load real
history would be the worse error.

---

## 4. Parsing rules

Read top to bottom. Every machine-critical value sits on its own labelled line or
in a heading — never buried in prose, so a human can reword freely around it.

| Line | Rule |
|---|---|
| `# ...` | Title. Free text, **ignored**. |
| `Date: YYYY-MM-DD` | **Required, ISO only.** The **start of the 6-week block**, and the sort key for heat. |
| `## <name>` | Starts a class. The whole line after `## ` is the class name; must be one of §3. |
| `### Session N — <role> (M min)` | Starts a session. `N` integer, `<role>` free text, `M` integer minutes. Either `—` or `-` accepted as the separator. |
| `- <exercise name>` | An exercise in the current session. The rest of the line, trimmed, is the name. |
| anything else | Ignored — blank lines, prose, italic notes, `_(not programmed)_`. |

**There is no block index.** The date *is* the block identifier; ordering the
files by date gives the block sequence, so a separate counter could only ever
disagree with it.

**Concurrent slot is the list order.** §7.6 requires the slot to be carried;
bullet position 1-4 *is* the slot, so no extra syntax is needed and the builder
can rebuild its lanes exactly.

**A session with no bullets is legitimate** — that is how Session 2 (personal
goals, not programmed by the teacher) is recorded. Do not write a placeholder
exercise.

---

## 5. Fail-fast rules

Same posture as `validateRows()` (CLAUDE.md §6.1): loud and specific, no silent
degradation. Import **refuses the file** on any of these:

- **An exercise name that is not in the library.** Name is the primary key; a
  near-miss must not be quietly dropped or fuzzy-matched. Report the name, the
  class, and the session.
- **A class name not in §3.**
- **Missing or non-ISO `Date`.** Heat cannot be ordered without it.
- **A `### Session` line that does not parse.** Do not guess a duration.
- **The same exercise twice in one session.**
- **More than 4 exercises in one session** (§7.7's concurrent limit).
- **An exercise line before any `### Session` heading**, or a session before any
  `## Class` heading — the file is structurally broken.

Warn, but load:

- a **missing core class** (see §3);
- a **filename that disagrees with `Date:`**.

Duplicate exercise names *across* sessions or classes are fine and expected —
the same exercise appearing in Upper Body and Full Body is normal programming.

---

## 6. Filing

```
data/programs/YYYY-MM-DD.md
```

Dated filename so the directory sorts chronologically and the block start is
visible without opening anything. `Date:` inside the file remains authoritative.

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
