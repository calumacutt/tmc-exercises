// Class file parsing — the contract is `data/PROGRAM_FORMAT.md`.
//
// ⚠️ ONE FILE PER CLASS (Calum, 2026-10-08). A file is a single class as it ran
// for one block, named `<Class Name> - <YYYY-MM-DD>.md`, and a BLOCK is simply
// the set of files sharing a `Date:`. That is what a layperson expects — one
// file per thing on the wall, with a name you can read — and it means adding a
// class to a block is dropping in a file rather than editing a big one.
//
// Nothing groups files but the date. There is no block index and no manifest,
// because either could disagree with the dates, and the dates are what heat
// actually sorts on.
//
// Split deliberately into two passes, because they need different inputs:
//
//   parseClassFile(text)              structure only — needs nothing else
//   validateAgainstLibrary(f, names)  the exercise-name check — needs the sheet
//
// ⚠️ PROBLEMS ARE OBJECTS, NOT STRINGS — same as `validateRows()` in library.js,
// and for the same reason: callers want the parts (which session, which line) to
// render them their own way. Interpolating one directly prints "[object Object]",
// a silent failure in the very code whose job is to be loud, and it has already
// happened once in this project. `formatProblem()` is exported so no caller has
// to invent that formatting.

// ⚠️ Punctuation is tolerated; DATA is not. `-`, `*` and `+` all read as the same
// bullet. The marker carries no meaning, and a Markdown `*` would otherwise be
// refused as an unparsed line for no reason.
const BULLET_RE = /^\s*[-*+]\s*(.*)$/;
const CLASS_RE = /^#\s+(.*?)\s*$/;        // H1: the class name
const SESSION_RE = /^##\s+(.*?)\s*$/;     // H2: a session
const DATE_RE = /^Date:\s*(.*?)\s*$/i;
const ENDS_RE = /^Ends:\s*(.*?)\s*$/i;
// A trailing "(20 min)" / "(5 mins)" / "(3 minutes)" on a session title.
const DURATION_RE = /^(.*?)\s*\((\d+)\s*min(?:s|utes)?\)\s*$/i;
// Exercise references. Everything outside them is free text for the poster.
const LINK_RE = /\[\[([^\]]*)\]\]/g;

// When a file records no `Ends:`, this is how long the block is assumed to have
// run. Six weeks is TMC's block length; it is a default, not a rule, which is
// why `Ends:` exists at all.
const DEFAULT_BLOCK_WEEKS = 6;

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

/** The day a block stopped being trained: its `Ends:`, or start + 6 weeks. */
function blockEnd(file) {
  if (file.ends) return file.ends;
  if (!file.date) return null;
  const d = new Date(file.date + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + DEFAULT_BLOCK_WEEKS * 7);
  return d.toISOString().slice(0, 10);
}

/**
 * Parse one class file.
 *
 * Returns { className, date, ends, sessions, problems, warnings, counts }.
 * `problems.length > 0` means the file must be REFUSED.
 *
 * ⚠️ Every structural problem is collected rather than thrown on the first one.
 * Refusing the file is still the outcome, but history is entered BY HAND, and
 * reporting one fault per reload would make that miserable and would hide how
 * much is actually wrong.
 */
function parseClassFile(text, { filename = '' } = {}) {
  const problems = [];
  const warnings = [];
  const sessions = [];
  let className = null;
  let date = null, dateLine = 0, sawDateLine = false;
  let ends = null, sawEndsLine = false;

  let currentSession = null;
  let inComment = false;
  let unlinkedBullets = 0;

  const lines = String(text).replace(/\r\n?/g, '\n').split('\n');

  lines.forEach((raw, i) => {
    const lineNo = i + 1;
    const line = raw.trim();
    if (!line) return;

    // --- Notes -------------------------------------------------------------
    // An HTML comment is the ONLY way to write prose, because every other
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

    // --- Dates -------------------------------------------------------------
    const dm = line.match(DATE_RE);
    if (dm && !/^#/.test(line)) {
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
    const em = line.match(ENDS_RE);
    if (em && !/^#/.test(line)) {
      const value = em[1];
      if (sawEndsLine) {
        problems.push(problem('duplicate-ends', { line: lineNo, value }));
        return;
      }
      sawEndsLine = true;
      if (!isIsoDate(value)) {
        problems.push(problem('bad-ends', { line: lineNo, value }));
        return;
      }
      ends = value;
      return;
    }

    // --- Session heading (H2) ----------------------------------------------
    // Checked BEFORE the H1: `##` also starts with `#`.
    //
    // ⚠️ Sessions are TITLED, not numbered. "The Monkey Flip" is the most
    // informative thing on a poster, and the old `Session N` heading threw that
    // away for an invented ordinal. File order gives the sequence, exactly as
    // bullet order does within a session.
    if (/^##\s/.test(line)) {
      const sm = line.match(SESSION_RE);
      let title = sm[1];
      let minutes = null;
      const dur = title.match(DURATION_RE);
      if (dur) {
        title = dur[1];
        minutes = Number(dur[2]);
      }
      if (!title) {
        problems.push(problem('empty-session-title', { line: lineNo }));
        return;
      }
      if (sessions.some(s => s.title === title)) {
        warnings.push(problem('duplicate-session-title', { line: lineNo, title }));
      }
      // The duration is OPTIONAL: real posters leave it off a section ("Flow:",
      // "Upper Body Strength: (PUSH/PULL/CORE)"). Recording null is honest;
      // guessing a number would not be.
      currentSession = { title, minutes, items: [] };
      sessions.push(currentSession);
      return;
    }

    // --- Class name (H1) ---------------------------------------------------
    // ⚠️ Class names are OPEN. They mean nothing to heat, which reads a date and
    // a set of exercise names; the closed list was only typo protection, and a
    // locked vocabulary is the wrong tool for that when the gym will change its
    // classes. `checkClassVocabulary()` does the job instead, across files.
    const cm = line.match(CLASS_RE);
    if (cm) {
      if (className !== null) {
        // One file is one class, so a second H1 is structurally ambiguous.
        problems.push(problem('second-class-heading', { line: lineNo, name: cm[1] }));
        return;
      }
      if (!cm[1]) {
        problems.push(problem('empty-class-name', { line: lineNo }));
        return;
      }
      className = cm[1];
      // ⚠️ A class name becomes a FILENAME, so it cannot contain these. Found the
      // hard way: the poster's "Handstand + Stretch - Beg/Int" could not be
      // written to disk at all.
      if (/[\/:*?"<>|]/.test(className)) {
        problems.push(problem('unsafe-class-name', { line: lineNo, name: className }));
      }
      return;
    }

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
        problems.push(problem('bullet-before-session', { line: lineNo, text }));
        return;
      }
      if (!text) {
        problems.push(problem('empty-bullet', { line: lineNo,
          session: currentSession.title }));
        return;
      }
      const names = [];
      let m;
      LINK_RE.lastIndex = 0;
      while ((m = LINK_RE.exec(text)) !== null) {
        const name = m[1].trim();
        if (!name) {
          problems.push(problem('empty-link', { line: lineNo,
            session: currentSession.title }));
          continue;
        }
        if (names.includes(name)) {
          warnings.push(problem('duplicate-link-in-bullet', { line: lineNo, name,
            session: currentSession.title }));
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
    // class file cannot be audited for afterwards, because the evidence is the
    // absence of a line nobody remembers writing.
    problems.push(problem('unparsed-line', { line: lineNo, text: line }));
  });

  // --- Whole-file checks ---------------------------------------------------
  if (className === null) problems.push(problem('missing-class-name', {}));
  if (!sawDateLine) problems.push(problem('missing-date', {}));
  if (inComment) problems.push(problem('unclosed-comment', {}));
  if (!sessions.length) problems.push(problem('no-sessions', {}));
  if (date && ends && ends < date) problems.push(problem('ends-before-date', { date, ends }));
  if (unlinkedBullets) warnings.push(problem('unlinked-bullets', { count: unlinkedBullets }));

  if (filename && date && !filename.includes(date)) {
    // The filename carries the date so the folder sorts readably, but `Date:`
    // inside the file stays authoritative.
    warnings.push(problem('filename-date-mismatch', { filename, date }));
  }
  if (filename && className && !filename.includes(className)) {
    warnings.push(problem('filename-class-mismatch', { filename, className }));
  }

  const counts = {
    sessions: sessions.length,
    bullets: sessions.reduce((n, s) => n + s.items.length, 0),
    unlinkedBullets,
    distinctExercises: exerciseSet({ sessions }).size,
  };

  return { className, date, ends, sessions, problems, warnings, counts };
}

/**
 * The heat input, and nothing else.
 *
 * Takes a class file OR a block, and reduces it to a SET of exercise names:
 * appearing anywhere counts as trained, equally. The session structure is
 * genuinely irrelevant to heat rather than merely unused — it is carried in the
 * file so that decision stays reversible without re-entering history.
 */
function exerciseSet(fileOrBlock) {
  const set = new Set();
  const files = fileOrBlock.classes || [fileOrBlock];
  for (const file of files) {
    for (const session of file.sessions || []) {
      for (const item of session.items || []) {
        for (const name of item.names) set.add(name);
      }
    }
  }
  return set;
}

/**
 * Group class files into blocks by their `Date:`, oldest first.
 *
 * The date is the ONLY thing that groups them. A manifest or a block index could
 * disagree with the dates, and the dates are what heat sorts on, so there is
 * nothing else to disagree with.
 */
function groupIntoBlocks(files) {
  const byDate = new Map();
  for (const f of files) {
    if (!byDate.has(f.date)) byDate.set(f.date, []);
    byDate.get(f.date).push(f);
  }
  return [...byDate.entries()]
    .sort((a, b) => String(a[0]).localeCompare(String(b[0])))
    .map(([date, classes]) => ({
      date,
      // A block ends when its latest class ends.
      ends: classes.map(blockEnd).sort().pop(),
      classes,
    }));
}

/**
 * The one fail-fast rule that needs the library.
 *
 * Name is the primary key, so a near-miss must not be fuzzy-matched or quietly
 * dropped — `Muscle Up` against `Muscle Up - Rings` is exactly the mismatch that
 * made three keystone breakdowns unreachable for months.
 */
function validateAgainstLibrary(file, knownNames) {
  const problems = [];
  const seen = new Set();
  for (const session of file.sessions || []) {
    for (const item of session.items || []) {
      for (const name of item.names) {
        if (knownNames.has(name) || seen.has(name)) continue;
        seen.add(name);          // report each unknown name once, not per use
        problems.push(problem('unknown-exercise', {
          name, className: file.className, session: session.title,
        }));
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
 * `Lower Body` appears in every block, `Lowe Body` appears once.
 *
 * Deliberately a WARNING. The first block to introduce a genuinely new class
 * would trip it too, and refusing real history over that would be the worse
 * error.
 */
function checkClassVocabulary(files) {
  const warnings = [];
  const blocks = new Set(files.map(f => f.date));
  if (blocks.size < 2) return warnings;
  const seenIn = new Map();
  for (const f of files) {
    if (!seenIn.has(f.className)) seenIn.set(f.className, new Set());
    seenIn.get(f.className).add(f.date);
  }
  for (const [name, dates] of seenIn) {
    if (dates.size === 1) {
      warnings.push(problem('class-seen-once', { name, date: [...dates][0],
        total: blocks.size }));
    }
  }
  return warnings;
}

/** Render a problem or warning for a human. See the note at the top of the file. */
function formatProblem(p) {
  const at = p.line ? ` (line ${p.line})` : '';
  const inWhere = p.session ? ` in ${p.session}` : '';
  switch (p.kind) {
    case 'missing-class-name':
      return 'No `# Class Name` heading — the file does not say which class it is.';
    case 'empty-class-name':
      return `A \`#\` heading with no class name${at}.`;
    case 'unsafe-class-name':
      return `The class name "${p.name}"${at} contains a character that cannot go `
        + 'in a filename (\ / : * ? " < > |), and a class name is its filename.';
    case 'second-class-heading':
      return `A second \`#\` heading, "${p.name}"${at}. One file is one class.`;
    case 'missing-date':
      return 'No `Date:` line — heat cannot order the blocks without it.';
    case 'bad-date':
      return `\`Date: ${p.value}\` is not a real ISO date (YYYY-MM-DD)${at}.`;
    case 'duplicate-date':
      return `A second \`Date:\` line${at}; the first is on line ${p.firstLine}.`;
    case 'bad-ends':
      return `\`Ends: ${p.value}\` is not a real ISO date (YYYY-MM-DD)${at}.`;
    case 'duplicate-ends':
      return `A second \`Ends:\` line${at}.`;
    case 'ends-before-date':
      return `\`Ends: ${p.ends}\` is before \`Date: ${p.date}\`.`;
    case 'no-sessions':
      return 'No `##` session heading anywhere in the file.';
    case 'empty-session-title':
      return `A \`##\` heading with no session title${at}.`;
    case 'duplicate-session-title':
      return `Two sessions are both called "${p.title}"${at}.`;
    case 'bullet-before-session':
      return `A bullet outside any session${at}: "${p.text}".`;
    case 'empty-bullet':
      return `An empty bullet${inWhere}${at}.`;
    case 'empty-link':
      return `An empty \`[[]]\` reference${inWhere}${at}.`;
    case 'unparsed-line':
      return `Line ${p.line} is not a class name, session, bullet or note: `
        + `"${p.text}". Wrap a note in \`<!-- ... -->\` if it is deliberate.`;
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
      return `The class "${p.name}" appears in only 1 of ${p.total} blocks `
        + `(${p.date}) — a new class type, or a typo?`;
    case 'filename-date-mismatch':
      return `Filename "${p.filename}" does not contain its \`Date: ${p.date}\`.`;
    case 'filename-class-mismatch':
      return `Filename "${p.filename}" does not contain its class "${p.className}".`;
    default:
      return `${p.kind}: ${JSON.stringify(p)}`;
  }
}

export {
  parseClassFile, exerciseSet, groupIntoBlocks, blockEnd, validateAgainstLibrary,
  checkClassVocabulary, formatProblem, DEFAULT_BLOCK_WEEKS,
};
