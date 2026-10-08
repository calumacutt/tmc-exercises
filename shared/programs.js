// Program file parsing — the contract is `data/PROGRAM_FORMAT.md`.
//
// A program file is simultaneously the record, the machine-readable history and
// the poster source. Revised 2026-10-08 after reading seven real class posters,
// which disagreed with the locked format in four ways. The format moved, not the
// posters — see PROGRAM_FORMAT §5a for the full account.
//
// Split deliberately into two passes, because they need different inputs:
//
//   parseProgram(text)                structure only — needs nothing else
//   validateAgainstLibrary(p, names)  the exercise-name check — needs the sheet
//
// ⚠️ PROBLEMS ARE OBJECTS, NOT STRINGS — same as `validateRows()` in library.js,
// and for the same reason: callers want the parts (which class, which session,
// which line) to render them their own way. Interpolating one directly prints
// "[object Object]", which is a silent failure in the very code whose job is to
// be loud, and it has already happened once in this project. `formatProblem()`
// is exported so no caller has to invent that formatting.

// §7.7's old fixed 10/5/15/15/15 is GONE, and so is the 4-concurrent limit.
// Every one of the seven real posters disagreed with both: durations ran
// 5/10/15/20/10, 10/10/10/15/15, 5/15/3/15/10/5, sessions numbered five or six,
// some printed no duration at all, and a single "Banded routine" line referenced
// eight exercises. Sessions are titled and timed per program now.

// ⚠️ Punctuation is tolerated; DATA is not. `-`, `*` and `+` all read as the same
// bullet. The marker carries no meaning, and a Markdown `*` would otherwise be
// refused as an unparsed line for no reason.
const BULLET_RE = /^\s*[-*+]\s*(.*)$/;
const SESSION_RE = /^###\s+(.*?)\s*$/;
const CLASS_RE = /^##\s+(.*?)\s*$/;
const HEADING_RE = /^#{1,6}\s/;
const DATE_RE = /^Date:\s*(.*?)\s*$/i;
// A trailing "(20 min)" / "(5 mins)" / "(3 minutes)" on a session title.
const DURATION_RE = /^(.*?)\s*\((\d+)\s*min(?:s|utes)?\)\s*$/i;
// Exercise references. Everything outside them is free text for the poster.
const LINK_RE = /\[\[([^\]]*)\]\]/g;

function problem(kind, fields) {
  return { kind, ...fields };
}

// A real calendar date in ISO form. `new Date('2026-02-31')` happily returns
// 3 March, so the round-trip is the check — a format test alone would accept
// dates that do not exist.
function isIsoDate(s) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d = new Date(s + 'T00:00:00Z');
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
}

/**
 * Parse one program file.
 *
 * Returns { date, classes, problems, warnings, counts }.
 * `problems.length > 0` means the file must be REFUSED.
 *
 * ⚠️ Every structural problem is collected rather than thrown on the first one.
 * Refusing the file is still the outcome, but history is entered BY HAND, and
 * reporting one fault per reload would make that miserable and would hide how
 * much is actually wrong.
 */
function parseProgram(text, { filename = '' } = {}) {
  const problems = [];
  const warnings = [];
  const classes = [];
  let date = null;
  let dateLine = 0;
  // Tracked separately from `date`, so a malformed date reports ONLY that it is
  // malformed rather than also claiming there is no Date line.
  let sawDateLine = false;

  let currentClass = null;
  let currentSession = null;
  let inComment = false;
  let unlinkedBullets = 0;

  const lines = String(text).replace(/\r\n?/g, '\n').split('\n');

  lines.forEach((raw, i) => {
    const lineNo = i + 1;
    const line = raw.trim();
    if (!line) return;

    // --- Notes -------------------------------------------------------------
    // An HTML comment is the ONLY way to write a note, because every other
    // unrecognised line is an error. Comments render as nothing in Markdown, so
    // the file stays clean as a poster source.
    if (inComment) {
      if (line.includes('-->')) inComment = false;
      return;
    }
    if (line.startsWith('<!--')) {
      if (!line.includes('-->')) inComment = true;
      return;
    }

    // --- Date --------------------------------------------------------------
    const dm = line.match(DATE_RE);
    if (dm && !HEADING_RE.test(line)) {
      const value = dm[1];
      if (sawDateLine) {
        problems.push(problem('duplicate-date', { line: lineNo, value, firstLine: dateLine }));
        return;
      }
      sawDateLine = true;
      dateLine = lineNo;
      if (!isIsoDate(value)) {
        problems.push(problem('bad-date', { line: lineNo, value }));
        return;
      }
      date = value;
      return;
    }

    // --- Session heading ---------------------------------------------------
    // Checked BEFORE the class heading: `###` also starts with `##`.
    //
    // ⚠️ Sessions are TITLED, not numbered. "The Monkey Flip" and "Ring Play /
    // Build to Routines" are the most informative thing on a poster, and the old
    // `Session N` heading threw that away in favour of an invented ordinal. File
    // order gives the sequence, exactly as it does for bullets within a session.
    if (/^###\s/.test(line)) {
      const sm = line.match(SESSION_RE);
      if (!currentClass) {
        problems.push(problem('session-before-class', { line: lineNo, text: line }));
        return;
      }
      let title = sm[1];
      let minutes = null;
      const dur = title.match(DURATION_RE);
      if (dur) {
        title = dur[1];
        minutes = Number(dur[2]);
      }
      if (!title) {
        problems.push(problem('empty-session-title', { line: lineNo,
          className: currentClass.name }));
        return;
      }
      // The duration is OPTIONAL: real posters leave it off a section
      // ("Flow:", "Upper Body Strength: (PUSH/PULL/CORE)"). Recording null is
      // honest; guessing a number would not be.
      currentSession = { title, minutes, items: [] };
      currentClass.sessions.push(currentSession);
      return;
    }

    // --- Class heading -----------------------------------------------------
    // ⚠️ Class names are OPEN, by decision (Calum, 2026-10-08). They mean nothing
    // to heat, which reads a date and a set of exercise names; the closed list was
    // only typo protection, and a locked vocabulary is the wrong tool for that
    // when the gym will change its classes. `checkClassVocabulary()` does the job
    // instead, across files, where a typo is actually visible as an oddity.
    const cm = line.match(CLASS_RE);
    if (cm) {
      const name = cm[1];
      if (!name) {
        problems.push(problem('empty-class-name', { line: lineNo }));
        return;
      }
      if (classes.some(c => c.name === name)) {
        // Still an error: a class appearing twice is either a duplicate or a
        // continuation and there is no way to tell which.
        problems.push(problem('duplicate-class', { line: lineNo, name }));
      }
      currentClass = { name, sessions: [] };
      currentSession = null;
      classes.push(currentClass);
      return;
    }

    // --- Title -------------------------------------------------------------
    if (HEADING_RE.test(line)) return;      // `# ...` free text, ignored

    // --- Bullet ------------------------------------------------------------
    // ⚠️ A bullet is FREE TEXT plus zero or more [[Exercise]] references. Real
    // lines are programming instructions — "Pull up/Chin up x 5-8", "Teachers
    // choice", or eight exercises in one sentence — so one bullet cannot be one
    // exercise name. The text is what goes on the poster; the links are what the
    // machine reads. One mechanism covers choices, dose, prose and lists.
    const bm = line.match(BULLET_RE);
    if (bm) {
      const text = bm[1].trim();
      if (!currentSession) {
        problems.push(problem('bullet-before-session', { line: lineNo, text,
          className: currentClass && currentClass.name }));
        return;
      }
      if (!text) {
        problems.push(problem('empty-bullet', { line: lineNo,
          className: currentClass.name, session: currentSession.title }));
        return;
      }
      const names = [];
      let m;
      LINK_RE.lastIndex = 0;
      while ((m = LINK_RE.exec(text)) !== null) {
        const name = m[1].trim();
        if (!name) {
          problems.push(problem('empty-link', { line: lineNo,
            className: currentClass.name, session: currentSession.title }));
          continue;
        }
        if (names.includes(name)) {
          warnings.push(problem('duplicate-link-in-bullet', { line: lineNo, name,
            className: currentClass.name, session: currentSession.title }));
          continue;
        }
        names.push(name);
      }
      // A bullet with no links is legitimate — "Teachers choice" references no
      // library exercise. But it is also what a forgotten [[...]] looks like, so
      // they are counted and reported rather than passing unremarked.
      if (names.length === 0) unlinkedBullets++;
      currentSession.items.push({ text, names });
      return;
    }

    // --- Anything else -----------------------------------------------------
    // ⚠️ AN UNRECOGNISED LINE IS AN ERROR. The format used to ignore these, which
    // meant a mistyped bullet dropped an exercise SILENTLY — the one fault a
    // program file cannot be audited for afterwards, because the evidence is the
    // absence of a line nobody remembers writing.
    problems.push(problem('unparsed-line', { line: lineNo, text: line }));
  });

  // --- Whole-file checks ---------------------------------------------------
  if (!sawDateLine) problems.push(problem('missing-date', {}));
  if (inComment) problems.push(problem('unclosed-comment', {}));
  if (!classes.length) problems.push(problem('no-classes', {}));
  if (unlinkedBullets) warnings.push(problem('unlinked-bullets', { count: unlinkedBullets }));

  if (filename && date) {
    // The filename carries the date so the directory sorts chronologically, but
    // `Date:` inside the file stays authoritative.
    const stem = filename.replace(/^.*[\\/]/, '').replace(/\.md$/i, '');
    if (!stem.startsWith(date)) {
      warnings.push(problem('filename-date-mismatch', { filename, date }));
    }
  }

  const counts = {
    classes: classes.length,
    sessions: classes.reduce((n, c) => n + c.sessions.length, 0),
    bullets: classes.reduce((n, c) =>
      n + c.sessions.reduce((m, s) => m + s.items.length, 0), 0),
    unlinkedBullets,
    distinctExercises: exerciseSet({ classes }).size,
  };

  return { date, classes, problems, warnings, counts };
}

/**
 * The heat input, and nothing else.
 *
 * A program reduces to a date plus a SET of exercise names: appearing anywhere
 * counts as trained, equally. The class and session structure is genuinely
 * irrelevant to heat rather than merely unused — it is carried in the file so
 * that decision stays reversible without re-entering history.
 */
function exerciseSet(program) {
  const set = new Set();
  for (const cls of program.classes || []) {
    for (const session of cls.sessions || []) {
      for (const item of session.items || []) {
        for (const name of item.names) set.add(name);
      }
    }
  }
  return set;
}

/**
 * The one fail-fast rule that needs the library.
 *
 * Name is the primary key, so a near-miss must not be fuzzy-matched or quietly
 * dropped — `Muscle Up` against `Muscle Up - Rings` is exactly the mismatch that
 * made three keystone breakdowns unreachable for months.
 *
 * `knownNames` is a Set of names from the sheet.
 */
function validateAgainstLibrary(program, knownNames) {
  const problems = [];
  const seen = new Set();
  for (const cls of program.classes || []) {
    for (const session of cls.sessions || []) {
      for (const item of session.items || []) {
        for (const name of item.names) {
          if (knownNames.has(name) || seen.has(name)) continue;
          seen.add(name);        // report each unknown name once, not per use
          problems.push(problem('unknown-exercise', {
            name, className: cls.name, session: session.title,
          }));
        }
      }
    }
  }
  return problems;
}

/**
 * Typo protection for OPEN class names, across the whole history.
 *
 * This replaces the closed vocabulary. A new class type is legitimate and must
 * not be blocked; a typo is not. The signal that separates them is recurrence —
 * `Lower Body` appears in every block, `Lowe Body` appears once. So a class name
 * seen in exactly one program, when there are several, is worth a look.
 *
 * Deliberately a WARNING. The first program to introduce a genuinely new class
 * would trip it too, and refusing real history over that would be the worse
 * error — the same reasoning as the old missing-core-class rule.
 */
function checkClassVocabulary(programs) {
  const warnings = [];
  if (programs.length < 2) return warnings;
  const seenIn = new Map();
  for (const p of programs) {
    for (const cls of p.classes || []) {
      if (!seenIn.has(cls.name)) seenIn.set(cls.name, []);
      seenIn.get(cls.name).push(p.date);
    }
  }
  for (const [name, dates] of seenIn) {
    if (dates.length === 1) {
      warnings.push(problem('class-seen-once', { name, date: dates[0],
        total: programs.length }));
    }
  }
  return warnings;
}

/** Date order, oldest first — the block sequence. `Date:` is the only sort key. */
function sortProgramsByDate(programs) {
  return programs.slice().sort((a, b) => String(a.date).localeCompare(String(b.date)));
}

/** Render a problem or warning for a human. See the note at the top of the file. */
function formatProblem(p) {
  const at = p.line ? ` (line ${p.line})` : '';
  const where = [p.className, p.session].filter(Boolean).join(' › ');
  const inWhere = where ? ` in ${where}` : '';
  switch (p.kind) {
    case 'missing-date':
      return 'No `Date:` line — heat cannot order the programs without it.';
    case 'bad-date':
      return `\`Date: ${p.value}\` is not a real ISO date (YYYY-MM-DD)${at}.`;
    case 'duplicate-date':
      return `A second \`Date:\` line${at}; the first is on line ${p.firstLine}.`;
    case 'no-classes':
      return 'No `## Class` heading anywhere in the file.';
    case 'empty-class-name':
      return `A \`##\` heading with no class name${at}.`;
    case 'duplicate-class':
      return `The class "${p.name}" appears twice${at}.`;
    case 'empty-session-title':
      return `A \`###\` heading with no session title${at}.`;
    case 'session-before-class':
      return `A session heading before any \`## Class\`${at}: "${p.text}".`;
    case 'bullet-before-session':
      return `A bullet outside any session${at}: "${p.text}".`;
    case 'empty-bullet':
      return `An empty bullet${inWhere}${at}.`;
    case 'empty-link':
      return `An empty \`[[]]\` reference${inWhere}${at}.`;
    case 'unparsed-line':
      return `Line ${p.line} is not a class, session, bullet or note: "${p.text}". `
        + 'Wrap a note in `<!-- ... -->` if it is deliberate.';
    case 'unclosed-comment':
      return 'An `<!--` comment is never closed with `-->`, so the rest of the file '
        + 'was skipped.';
    case 'unknown-exercise':
      return `"${p.name}"${inWhere} is not in the Movement Library.`;
    case 'duplicate-link-in-bullet':
      return `"${p.name}" is referenced twice in one bullet${inWhere}${at}.`;
    case 'unlinked-bullets':
      return `${p.count} bullet(s) reference no exercise. That is fine for a line `
        + 'like "Teachers choice", but it is also what a forgotten `[[...]]` looks '
        + 'like.';
    case 'class-seen-once':
      return `The class "${p.name}" appears in only 1 of ${p.total} programs `
        + `(${p.date}) — a new class type, or a typo?`;
    case 'filename-date-mismatch':
      return `Filename "${p.filename}" does not start with its \`Date: ${p.date}\`.`;
    default:
      return `${p.kind}: ${JSON.stringify(p)}`;
  }
}

export {
  parseProgram, exerciseSet, validateAgainstLibrary, checkClassVocabulary,
  sortProgramsByDate, formatProblem,
};
