"""
Build copy-paste blocks for the Exercises tab, aligned to the CURRENT sheet rows.

Emits, all in sheet row order from row 2 to the last named row, blanks preserved
so alignment cannot drift:

  paste-C-D-discipline-line.tsv   2 cols -> paste at C2
  paste-K-also-appears-in.tsv     1 col  -> paste at K2
  paste-check.csv                 sheet row + name + all three, to spot-check

Deliberately does NOT touch columns E-J (Importance, Level, Keystone, Variant Of,
Regressions, Progressions). A wider block would be one paste instead of two, but
it would also overwrite six columns the gym owner may be editing right now.
"""
import csv, io, os, sys

HERE = os.path.dirname(os.path.abspath(__file__))
DATA = os.path.dirname(HERE)
sys.stdout.reconfigure(encoding='utf-8')

g = {'__file__': os.path.join(HERE, 'taxonomy_v3.py'), '__name__': 'taxonomy_v3'}
exec(io.open(g['__file__'], encoding='utf-8').read(), g)
new_key, AAI, DECLARED = g['new_key'], g['AAI'], g['DECLARED']

rows = list(csv.DictReader(io.open(os.path.join(DATA, 'exercises.csv'), encoding='utf-8-sig')))
named_lines = [i + 2 for i, r in enumerate(rows) if (r.get('Name') or '').strip()]
first, last = named_lines[0], named_lines[-1]

cd, k, check = [], [], []
changed_dl = changed_aai = blanks = 0

for i, r in enumerate(rows):
    line_no = i + 2
    if line_no < first or line_no > last:
        continue
    name = (r.get('Name') or '').strip()
    if not name:
        cd.append(('', ''))
        k.append('')
        check.append((line_no, '', '', '', ''))
        blanks += 1
        continue

    key = new_key(name)
    nd, _, nl = key.partition(' - ')
    old_d = (r.get('Discipline') or '').strip()
    old_l = (r.get('Line') or '').strip()
    if (nd, nl) != (old_d, old_l):
        changed_dl += 1

    aai = ';'.join(AAI.get(name, []))
    if aai != (r.get('Also Appears In') or '').strip():
        changed_aai += 1

    cd.append((nd, nl))
    k.append(aai)
    check.append((line_no, name, nd, nl, aai))

# every emitted value must be a declared LineKey
bad = [(n, d, l) for _ln, n, d, l, _a in check if n and f'{d} - {l}' not in DECLARED]
bad += [(n, a, '') for _ln, n, _d, _l, a in check
        for a in (a.split(';') if a else []) if a not in DECLARED]
if bad:
    print('VALIDATION FAILED:')
    for b in bad[:20]:
        print('  -', b)
    sys.exit(1)

with io.open(os.path.join(HERE, 'paste-C-D-discipline-line.tsv'), 'w',
             encoding='utf-8', newline='') as f:
    f.write('\n'.join('%s\t%s' % r for r in cd))
with io.open(os.path.join(HERE, 'paste-K-also-appears-in.tsv'), 'w',
             encoding='utf-8', newline='') as f:
    f.write('\n'.join(k))
with io.open(os.path.join(HERE, 'paste-check.csv'), 'w', encoding='utf-8', newline='') as f:
    w = csv.writer(f)
    w.writerow(['Sheet row', 'Name', 'Discipline (C)', 'Line (D)', 'Also Appears In (K)'])
    w.writerows(check)

print('validation passed: every value is a declared LineKey.\n')
print('sheet rows covered   %d  (row %d to row %d)' % (len(cd), first, last))
print('  named exercises    %d' % (len(cd) - blanks))
print('  blank spacer rows  %d  (kept blank, so alignment holds)' % blanks)
print()
print('Discipline/Line changes  %d of %d' % (changed_dl, len(cd) - blanks))
print('Also Appears In changes  %d of %d' % (changed_aai, len(cd) - blanks))
print('  rows with an AAI value %d' % sum(1 for v in k if v))
print()
print('paste-C-D-discipline-line.tsv  -> select C2, paste')
print('paste-K-also-appears-in.tsv    -> select K2, paste')
print('\nfirst 3 and last 3 rows, to eyeball alignment:')
for ln, n, d, l, a in check[:3] + check[-3:]:
    print('  row %-4d %-30s %s | %s%s' % (ln, n or '(blank)', d, l, '  AAI: ' + a if a else ''))
