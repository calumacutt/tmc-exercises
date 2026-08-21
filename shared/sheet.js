// The published Movement Library sheet — one home for the three tab URLs.
//
// They were previously hard-coded in wheel/index.html and nowhere else, so the
// builder could not reach the sheet without a second copy. A second copy is how
// the two views end up pointing at different data.
//
// All three tabs are published to web as CSV and send permissive CORS headers, so
// browser fetch works. The verified column contract for each is data/SHEET.md.

const SHEET_PUB =
  'https://docs.google.com/spreadsheets/d/e/2PACX-1vQDrwHw-jGM7r3ZO_i8orZWvJ_wxmMdfnUy3lvds' +
  'qwZeJGv_EyEvsiB1HxG1qrXIyzgtMrlZMhirtcI/pub';

const tab = gid => `${SHEET_PUB}?gid=${gid}&single=true&output=csv`;

// Exercises: the library itself, ~550 rows.
const SHEET_CSV_URL = tab('955669041');
// Lists: the AUTHORITATIVE taxonomy — declared LineKeys plus the enum
// vocabularies. Validate against this, never against the pairs that happen to
// appear on exercise rows (CLAUDE.md §6.4).
const LISTS_CSV_URL = tab('1547339907');
// Breakdowns: the `component` edge table — keystone -> component -> exercises.
const BREAKDOWNS_CSV_URL = tab('1095995642');

export { SHEET_CSV_URL, LISTS_CSV_URL, BREAKDOWNS_CSV_URL };
