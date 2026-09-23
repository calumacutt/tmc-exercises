// Program file parsing — the contract is `data/PROGRAM_FORMAT.md`.
//
// A program file is simultaneously the record, the machine-readable history and
// the poster source, so this parser is what makes the first of those three real.
// Until now the format was locked but had never been machine-read.
//
// Split deliberately into two passes, because they need different inputs:
//
//   parseProgram(text)              structure only — needs nothing else
//   validateAgainstLibrary(p, names)  the exercise-name check — needs the sheet
//
// The name check is the one fail-fast rule in §5 that cannot run without the
// library, and keeping it separate means a program file can be parsed, diffed or
// round-tripped offline without pulling 616 rows in behind it.
//
// ⚠️ PROBLEMS ARE OBJECTS, NOT STRINGS — same as `validateRows()` in library.js,
// and for the same reason: callers want the parts (which class, which session,
// which line) to render them their own way. Interpolating one directly prints
// "[object Object]", which is a silent failure in the very code whose job is to
// be loud, and it has already happened once in this project. `formatProblem()`
// is exported so no caller has to invent that formatting.

// ---------- Vocabulary (PROGRAM_FORMAT §3) ----------
// An unrecognised class is an ERROR, not a new class — it is how `Legs`,
// `Lower body` and `Lower Body` quietly become three classes in the history.
const CORE_CLASSES = ['Upper Body', 'Full Body', 'Lower Body'];
const OPTIONAL_CLASSES = ['Handstand', 'Mobility', 'Flocomotion'];
const CLASS_NAMES = [...CORE_CLASSES, ...OPTIONAL_CLASSES];

// §7.7's concurrent limit. Bullet ORDER is the slot, so the array index carries
// it and no extra syntax is needed.
const MAX_CONCURRENT = 4;

// ⚠️ Punctuation is tolerated; DATA is not. Em dash, en dash and hyphen all read
// as the same separator, and `-`, `*`, `+` all read as the same bullet. None of
// them carries meaning, and an autocorrected en dash or a Markdown `*` would
// otherwise fall through to "anything else — ignored" and drop an exercise
// SILENTLY. That is the one failure mode this format cannot detect after the
// fact, so the tolerance here exists to prevent a silent loss, not to be lenient.
const SESSION_RE = /^###\s+Session\s+(\d+)\s*[—–-]\s*(.*?)\s*\((\d+)\s*min\)\s*$/i;
const BULLET_RE = /^\s*[-*+]\s*(.*)$/;
const CLASS_RE = /^##\s+(.*?)\s*$/;
const HEADING_RE = /^#{1,6}\s/;
const DATE_RE = /^Date:\s*(.*?)\s*$/i;

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
 * Returns { date, classes, problems, warnings, ignoredLines, counts }.
 * `problems.length > 0` means the file must be REFUSED (PROGRAM_FORMAT §5).
 *
 * ⚠️ Every structural problem is collected rather than thrown on the first one.
 * Refusing the file is still the outcome, but three 6-week blocks are being
 * entered BY HAND — reporting one fault per reload would make that miserable and
 * would hide how much is actually wrong.
 */
function parseProgram(text, { filename = '' } = {}) {
  const problems = [];
  const warnings = [];
  const classes = [];
  let date = null;
  let dateLine = 0;
  // Tracked separately from `date`, so a malformed date reports ONLY that it is
  // malformed. Inferring "no Date line" from a null date made a bad date report
  // twice, the second time saying something untrue.
  let sawDateLine = false;

  let currentClass = null;
  let currentSession = null;
  let inComment = false;

  const lines = String(text).replace(/\r\n?/g, '\n').split('\n');

  lines.forEach((raw, i) => {
    const lineNo = i + 1;
    const line = raw.trim();
    if (!line) return;

    // --- Notes -------------------------------------------------------------
    // An HTML comment is the ONLY way to write a note in a program file, because
    // every other unrecognised line is now an error (see the end of this loop).
    // HTML comments render as nothing in Markdown, so the file stays clean as a
    // poster source.
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
    if (/^###\s/.test(line)) {
      const sm = line.match(SESSION_RE);
      if (!sm) {
        // §5: do not guess a duration.
        problems.push(problem('bad-session-heading', { line: lineNo, text: line,
          className: currentClass && currentClass.name }));
        return;
      }
      if (!currentClass) {
        problems.push(problem('session-before-class', { line: lineNo, text: line }));
        return;
      }
      const number = Number(sm[1]);
      if (currentClass.sessions.some(s => s.number === number)) {
        problems.push(problem('duplicate-session', { line: lineNo, number,
          className: currentClass.name }));
        return;
      }
      currentSession = { number, role: sm[2] || '', minutes: Number(sm[3]), exercises: [] };
      currentClass.sessions.push(currentSession);
      return;
    }

    // --- Class heading -----------------------------------------------------
    const cm = line.match(CLASS_RE);
    if (cm) {
      const name = cm[1];
      if (!CLASS_NAMES.includes(name)) {
        problems.push(problem('unknown-class', { line: lineNo, name }));
        // Keep parsing into it anyway, so its sessions do not then report as
        // "session before class" and bury the one real fault under a cascade.
      }
      if (classes.some(c => c.name === name)) {
        problems.push(problem('duplicate-class', { line: lineNo, name }));
      }
      currentClass = { name, sessions: [] };
      currentSession = null;
      classes.push(currentClass);
      return;
    }

    // --- Title -------------------------------------------------------------
    if (HEADING_RE.test(line)) return;      // `# ...` free text, ignored

    // --- Exercise bullet ---------------------------------------------------
    const bm = line.match(BULLET_RE);
    if (bm) {
      const name = bm[1].trim();
      if (!currentSession) {
        problems.push(problem('exercise-before-session', { line: lineNo, name,
          className: currentClass && currentClass.name }));
        return;
      }
      if (!name) {
        // An empty bullet would otherwise fall through to "ignored" and vanish.
        problems.push(problem('empty-exercise', { line: lineNo,
          className: currentClass.name, session: currentSession.number }));
        return;
      }
      if (currentSession.exercises.includes(name)) {
        problems.push(problem('duplicate-in-session', { line: lineNo, name,
          className: currentClass.name, session: currentSession.number }));
        return;
      }
      currentSession.exercises.push(name);
      if (currentSession.exercises.length > MAX_CONCURRENT) {
        problems.push(problem('too-many-concurrent', { line: lineNo,
          className: currentClass.name, session: currentSession.number,
          count: currentSession.exercises.length }));
      }
      return;
    }

    // --- Anything else -----------------------------------------------------
    // ⚠️ AN UNRECOGNISED LINE IS AN ERROR (Calum, 2026-09-24). The format used to
    // ignore these, which meant a mistyped bullet dropped an exercise SILENTLY —
    // the one fault a program file cannot be audited for afterwards, because the
    // evidence is the absence of a line nobody remembers writing.
    //
    // The cost is that prose can no longer sit loose in the file. That is what the
    // HTML-comment escape hatch above is for, and it is a better trade: a note has
    // to be marked as a note, which is cheap, and an exercise can never go missing
    // without the file refusing to load, which is not.
    problems.push(problem('unparsed-line', { line: lineNo, text: line }));
  });

  // --- Whole-file checks ---------------------------------------------------
  if (!sawDateLine) problems.push(problem('missing-date', {}));

  for (const name of CORE_CLASSES) {
    if (!classes.some(c => c.name === name)) {
      // §3: warn, never fail. A block that genuinely did not run a core class is
      // far likelier than a typo, and refusing real history would be worse.
      warnings.push(problem('missing-core-class', { name }));
    }
  }

  if (filename && date) {
    // §6: the filename carries the date so the directory sorts chronologically,
    // but `Date:` inside the file stays authoritative.
    const stem = filename.replace(/^.*[\\/]/, '').replace(/\.md$/i, '');
    if (!stem.startsWith(date)) {
      warnings.push(problem('filename-date-mismatch', { filename, date }));
    }
  }

  const counts = {
    classes: classes.length,
    sessions: classes.reduce((n, c) => n + c.sessions.length, 0),
    exercises: classes.reduce((n, c) =>
      n + c.sessions.reduce((m, s) => m + s.exercises.length, 0), 0),
    distinctExercises: exerciseSet({ classes }).size,
  };

  if (inComment) problems.push(problem('unclosed-comment', {}));

  return { date, classes, problems, warnings, counts };
}

/**
 * The heat input, and nothing else (PROGRAM_FORMAT §7).
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
      for (const name of session.exercises) set.add(name);
    }
  }
  return set;
}

/**
 * The one fail-fast rule that needs the library (§5).
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
      for (const name of session.exercises) {
        if (knownNames.has(name) || seen.has(name)) continue;
        seen.add(name);          // report each unknown name once, not per use
        problems.push(problem('unknown-exercise', {
          name, className: cls.name, session: session.number,
        }));
      }
    }
  }
  return problems;
}

/** Date order, oldest first — the block sequence. `Date:` is the only sort key. */
function sortProgramsByDate(programs) {
  return programs.slice().sort((a, b) => String(a.date).localeCompare(String(b.date)));
}

/** Render a problem or warning for a human. See the note at the top of the file. */
function formatProblem(p) {
  const at = p.line ? ` (line ${p.line})` : '';
  const where = [p.className, p.session != null ? `Session ${p.session}` : null]
    .filter(Boolean).join(' › ');
  const inWhere = where ? ` in ${where}` : '';
  switch (p.kind) {
    case 'missing-date':
      return 'No `Date:` line — heat cannot order the programs without it.';
    case 'bad-date':
      return `\`Date: ${p.value}\` is not a real ISO date (YYYY-MM-DD)${at}.`;
    case 'duplicate-date':
      return `A second \`Date:\` line${at}; the first is on line ${p.firstLine}.`;
    case 'unknown-class':
      return `"${p.name}" is not a class type${at}. Valid: ${CLASS_NAMES.join(', ')}.`;
    case 'duplicate-class':
      return `The class "${p.name}" appears twice${at}.`;
    case 'bad-session-heading':
      return `Unparseable session heading${at}: "${p.text}" — expected `
        + '`### Session N — Role (M min)`.';
    case 'duplicate-session':
      return `Session ${p.number} appears twice in ${p.className}${at}.`;
    case 'session-before-class':
      return `A session heading before any \`## Class\`${at}: "${p.text}".`;
    case 'exercise-before-session':
      return `"${p.name}" is not inside any session${at}.`;
    case 'empty-exercise':
      return `An empty bullet${inWhere}${at}.`;
    case 'duplicate-in-session':
      return `"${p.name}" is listed twice${inWhere}${at}.`;
    case 'too-many-concurrent':
      return `${p.count} exercises${inWhere}${at} — the limit is ${MAX_CONCURRENT}.`;
    case 'unparsed-line':
      return `Line ${p.line} is not a class, session, bullet or note: "${p.text}". `
        + 'Wrap a note in `<!-- ... -->` if it is deliberate.';
    case 'unclosed-comment':
      return 'An `<!--` comment is never closed with `-->`, so the rest of the file '
        + 'was skipped.';
    case 'unknown-exercise':
      return `"${p.name}"${inWhere} is not in the Movement Library.`;
    case 'missing-core-class':
      return `No "${p.name}" class — expected in every program.`;
    case 'filename-date-mismatch':
      return `Filename "${p.filename}" does not start with its \`Date: ${p.date}\`.`;
    default:
      return `${p.kind}: ${JSON.stringify(p)}`;
  }
}

export {
  parseProgram, exerciseSet, validateAgainstLibrary, sortProgramsByDate,
  formatProblem, CORE_CLASSES, OPTIONAL_CLASSES, CLASS_NAMES, MAX_CONCURRENT,
};
