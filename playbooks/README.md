# Playbooks

TMC operational playbooks — the procedures a coach follows, written so someone
who was not in the room can do the job.

| Playbook | Owner | Status |
|---|---|---|
| [Programming Playbook](PROGRAMMING_PLAYBOOK.md) | Rod Cooper / Calum | Draft 1 |
| Exercise Modification & Injury Playbook | Rod Cooper | Established (lives in Drive) |

## Two files, one source

`PROGRAMMING_PLAYBOOK.md` is the **source**. `Programming Playbook.docx` is
generated from it for Google Drive, where the rest of the playbooks live.

Both come out of one content list, so they cannot drift — but that also means
**edits belong in the markdown**, not in the .docx. A change typed straight into
the Word file is lost the next time the document is generated.

The .docx is built by cloning the package of the established Injury playbook and
swapping its `word/document.xml`, so it inherits the real house styles, fonts and
bullet formatting rather than approximating them.

## Deliberately tool-agnostic

Every step of the programming process can be done on paper. The digital tools
(Movement Wheel, Discipline view, Keystone breakdown, Program Builder) make some
steps much faster, and each step says how — but a coach with a printout and three
highlighters can follow the whole thing and get a good program.

The one genuine dependency is the **written record of the last three programs**.
Without it the process cannot start, which is the real reason every program is
written up in `data/PROGRAM_FORMAT.md`'s format.
