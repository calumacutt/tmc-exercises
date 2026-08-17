"""
Generate the line-assignment proposal for the unfinished Exercises rows.

Read-only against the sheet. Emits:
  - assignments.csv   Name,Discipline,Line   (for VLOOKUP / paste)
  - moves.csv         rows already filed that we propose RE-filing

Every target LineKey is checked against the declared vocabulary in lists.csv;
an undeclared target is a hard error, not a warning.
"""
import csv, io, os, sys, collections

HERE = os.path.dirname(os.path.abspath(__file__))
DATA = os.path.dirname(HERE)
sys.stdout.reconfigure(encoding='utf-8')

def load(p):
    return list(csv.DictReader(io.open(p, encoding='utf-8-sig')))

lists = load(os.path.join(DATA, 'lists.csv'))
declared = {r['LineKey (Discipline - Line)'].strip()
            for r in lists if (r.get('LineKey (Discipline - Line)') or '').strip()}

ex_rows = load(os.path.join(DATA, 'exercises.csv'))
# sheet line number = index + 2 (header is line 1)
named = [(i + 2, r) for i, r in enumerate(ex_rows) if (r.get('Name') or '').strip()]
by_name = {}
for ln, r in named:
    by_name.setdefault(r['Name'].strip(), []).append((ln, r))

# ---------------------------------------------------------------- assignments
# Rows with a blank Line (and often blank Discipline) -> a declared LineKey.
# Confidence: high = unambiguous, check = wants Calum's physical read.
A = 'Foundational Resting Positions'
LB = 'Loaded Lower Body Strength'
BE = 'Bounciness & Elastic Power'
LV = 'Lever & Straight-Arm Body Control'

ASSIGN = [
    # --- frontal-plane hip cluster ------------------------------------ high
    ('Butterfly',                          A,  'Hip Opening (frontal)', 'high'),
    ('Butterfly - Weighted',               A,  'Hip Opening (frontal)', 'high'),
    ('Butterfly - Partner',                A,  'Hip Opening (frontal)', 'high'),
    ('Pancake',                            A,  'Hip Opening (frontal)', 'high'),
    ('Pancake - Elevated',                 A,  'Hip Opening (frontal)', 'high'),
    ('Pancake - Partner',                  A,  'Hip Opening (frontal)', 'high'),
    ('Pancake - Weighted',                 A,  'Hip Opening (frontal)', 'high'),
    ('Pancake - Dynamic',                  A,  'Hip Opening (frontal)', 'high'),
    ('Side Pancake Weighted',              A,  'Hip Opening (frontal)', 'high'),
    ('Frog Stretch',                       A,  'Hip Opening (frontal)', 'high'),
    ('Frog - Internal Lifts',              A,  'Hip Opening (frontal)', 'high'),
    ('Middle Splits',                      A,  'Hip Opening (frontal)', 'high'),
    ('Middle Splits - Active',             A,  'Hip Opening (frontal)', 'high'),
    ('Middle Splits - Sliding',            A,  'Hip Opening (frontal)', 'high'),
    ('Middle Splits - Contract and Relax', A,  'Hip Opening (frontal)', 'high'),
    ('Copenhagen',                         A,  'Hip Opening (frontal)', 'check'),
    # --- hip rotation / ER: could be Hip Articulation instead --------- check
    ('90/90',                              A,  'Hip Opening (frontal)', 'check'),
    ('Pigeon Stretch',                     A,  'Hip Opening (frontal)', 'check'),
    ('Pigeon Stretch - Box',               A,  'Hip Opening (frontal)', 'check'),
    ('Hurdler Stretch',                    A,  'Hip Opening (sagittal)', 'check'),
    # --- stance ------------------------------------------------------------
    ('Horse Stance',                       A,  'Stance Positions',      'high'),
    ('Horse Stance - Squats',              LB, 'Lateral / Mobility Squat', 'check'),
    # --- spinal extension / bridges ---------------------------------- high
    ('Cobra Peel',                         A,  'Spinal Extension', 'high'),
    ('Standing Arch',                      A,  'Spinal Extension', 'high'),
    ('Yoga Wheel Opener',                  A,  'Spinal Extension', 'high'),
    ('Thoracic Bridge',                    A,  'Spinal Extension', 'check'),
    ('Bridge Hold',                        A,  'Spinal Extension', 'check'),
    ('Bridge Pulses',       'Spinal & Hip Articulation', 'Bridge Articulation', 'check'),
    # --- lower body: squats / lunges --------------------------------------
    ('Split Squat',                        LB, 'Single-Leg Squat',      'high'),
    ('Cossack Squat',                      LB, 'Lateral / Mobility Squat', 'high'),
    ('Sissy Squat',                        LB, 'Anterior Chain (knee)', 'high'),
    ('Lunge',                              LB, 'Single-Leg Squat',      'high'),
    ('Kettlebell walking lunge',           LB, 'Single-Leg Squat',      'high'),
    ('Kettlebell Thruster',                LB, 'Bilateral Squat',       'high'),
    ('Kettlebell Swing Squat',             LB, 'Hip Hinge',             'high'),
    ('Kettlebell Swing Single Arm',        LB, 'Hip Hinge',             'high'),
    # --- jumps ------------------------------------------------------------
    ('Box Jump',                           BE, 'Vertical Jump', 'high'),
    ('High Jump',                          BE, 'Vertical Jump', 'high'),
    ('Gather Step jump',                   BE, 'Horizontal Jump', 'check'),
]

# ------------------------------------------------------------------- re-files
# Already filed under Hip Opening (frontal), but they are sagittal-plane or
# hip-hinge work. The line's NAME and its CONTENTS currently disagree.
MOVE = [
    # sagittal hip opening
    ('Front Splits',                            A, 'Hip Opening (sagittal)'),
    ('Front Splits - Active',                   A, 'Hip Opening (sagittal)'),
    ('Front Splits - Sliders',                  A, 'Hip Opening (sagittal)'),
    ('Front Splits - Knee Lift Contract and Relax', A, 'Hip Opening (sagittal)'),
    ('Long Lunge - Hold',                       A, 'Hip Opening (sagittal)'),
    ('Long Lunge - Pulses',                     A, 'Hip Opening (sagittal)'),
    ('Long Lunge - Contract and Relax',         A, 'Hip Opening (sagittal)'),
    ('Couch Stretch',                           A, 'Hip Opening (sagittal)'),
    ('Couch Stretch - Super',                   A, 'Hip Opening (sagittal)'),
    ('Couch Stretch - Arching',                 A, 'Hip Opening (sagittal)'),
    ('Heavy Hip Flexor Stretch',                A, 'Hip Opening (sagittal)'),
    ('Kneeling Runners Stretch',                A, 'Hip Opening (sagittal)'),
    ('Thomas Stretch',                          A, 'Hip Opening (sagittal)'),
    ('Dancers Pose',                            A, 'Hip Opening (sagittal)'),
    ('Elephant Walk',                           A, 'Hip Opening (sagittal)'),
    ('Elephant Walk - Slant Board',             A, 'Hip Opening (sagittal)'),
    ('Forward Fold Pulses',                     A, 'Hip Opening (sagittal)'),
    ('Partner Forward Fold',                    A, 'Hip Opening (sagittal)'),
    ('Partner Hamstring Stretch',               A, 'Hip Opening (sagittal)'),
    ('Leg Swings - Front',                      A, 'Hip Opening (sagittal)'),
    ('Leg Swings - Back',                       A, 'Hip Opening (sagittal)'),
    # loaded hip hinge, not mobility at all
    ('Jefferson Curl',                          LB, 'Hip Hinge'),
    ('Jefferson Curl - Wide Leg',               LB, 'Hip Hinge'),
    ('Jefferson Curl - to Squat',               LB, 'Hip Hinge'),
    ('Good Morning',                            LB, 'Hip Hinge'),
    ('Good Morning - Single Leg',               LB, 'Hip Hinge'),
    ('Good Morning - Wide Leg',                 LB, 'Hip Hinge'),
    ('RDL',                                     LB, 'Hip Hinge'),
    # filed as a PLANCHE. It is a hip hinge. This is why Planche Line showed 2.
    ('Kettlebell Swing',                        LB, 'Hip Hinge'),
    # --- the front lever family -------------------------------------------
    # All under Hanging & Pulling > Horizontal Pull, while the declared
    # "Front Lever Line" sits empty. Four sibling rows already carry
    # Also Appears In = that line, i.e. the migration was half-written by hand.
    ('Front Lever',              LV, 'Front Lever Line'),
    ('Front Lever - Straddle',   LV, 'Front Lever Line'),
    ('Front Lever - Tuck',       LV, 'Front Lever Line'),
    ('Front Lever Pull',         LV, 'Front Lever Line'),
    ('Front Lever Pull - Tuck',  LV, 'Front Lever Line'),
    ('Front Lever Pull - Straddle', LV, 'Front Lever Line'),
    ('Front Lever - Deadlift',   LV, 'Front Lever Line'),
]

# --------------------------------------------------------------- no good home
UNPLACED = [
    # These need a NEW declared line before they can be filed. Listing them as
    # unplaceable is the honest answer - do not force them somewhere wrong.
    ('German Hang',            'straight-arm PULL, currently under Pressing Strength > Horizontal Press. No "Back Lever Line" is declared.'),
    ('German Hang - Assisted', 'straight-arm PULL, currently under Pressing Strength > Horizontal Press. No "Back Lever Line" is declared.'),
    ('Back Lever',             'straight-arm PULL, currently under Pressing Strength > Horizontal Press. No "Back Lever Line" is declared.'),
    ('Back Lever - Tuck',      'straight-arm PULL, currently under Pressing Strength > Horizontal Press. No "Back Lever Line" is declared.'),
    ('Back Lever - Straddle',  'straight-arm PULL, currently under Pressing Strength > Horizontal Press. No "Back Lever Line" is declared.'),
    ('Kettlebell Halo',                  'loaded shoulder/thoracic circle - no declared line fits'),
    ('Kettlebell Around the world',       'loaded shoulder/thoracic circle - no declared line fits'),
    ('Kettlebell ATW to Lunge',           'compound; needs a call on primary home'),
    ('Kettlebell Wood Chop',              'loaded rotation - Rotational Articulation is Mobility, this is loaded'),
    ('Foam Roller Opener - Dumbbell',     'thoracic/chest opening - NO such line is declared'),
    ('Foam Roller Opener - Stall Bars',   'thoracic/chest opening - NO such line is declared'),
    ('Lying Chest Stretch',               'thoracic/chest opening - NO such line is declared'),
    ('Standing Chest Stretch',            'thoracic/chest opening - NO such line is declared'),
    ('Over head Partner Push',            'thoracic/chest opening - NO such line is declared'),
    ('Standing Lat Stretch',              'lat/side-body - NO such line is declared'),
    ('Squat Lat Stretch',                 'lat/side-body - NO such line is declared'),
    ('Mermaid Stretch',                   'lat/side-body - NO such line is declared'),
    ('Dumbell Lower Trap Raise',          'loaded shoulder prehab - Prehab & Rehab only declares "Banded"'),
    ('Cuban Rotation',                    'loaded shoulder prehab - Prehab & Rehab only declares "Banded"'),
    ('Dumbell Internal/External rotion',  'loaded shoulder prehab - Prehab & Rehab only declares "Banded"'),
    ('Dumbell Flys',                      'loaded shoulder prehab - Prehab & Rehab only declares "Banded"'),
    ('Table Top Lifts',                   'reverse plank / posterior - no clean declared home, no proposal yet'),
    ('Table Top Hold',                    'reverse plank / posterior - no clean declared home, no proposal yet'),
]

# Group the unplaced rows so the write-up's counts are derived, not hand-tallied.
def unplaced_group(why):
    if 'Back Lever Line' in why:      return 'needs: Back Lever Line'
    if 'thoracic/chest' in why:       return 'needs: Thoracic & Chest Opening'
    if 'lat/side-body' in why:        return 'needs: a side-body / lat line'
    if 'shoulder prehab' in why:      return 'needs: Prehab & Rehab renamed to a functional name'
    return 'no proposal yet'

# ------------------------------------------------------------------ validate
errors = []
for name, disc, line, _conf in ASSIGN:
    key = f'{disc} - {line}'
    if key not in declared:
        errors.append(f'UNDECLARED target LineKey: {key!r} (for {name!r})')
for name, disc, line in MOVE:
    key = f'{disc} - {line}'
    if key not in declared:
        errors.append(f'UNDECLARED target LineKey: {key!r} (for {name!r})')

def resolve(name):
    """Match a proposal name to sheet rows, tolerating trailing whitespace."""
    if name in by_name:
        return by_name[name]
    for k, v in by_name.items():
        if k.strip() == name.strip():
            return v
    return []

for name, *_ in ASSIGN:
    if not resolve(name):
        errors.append(f'NOT FOUND in Exercises: {name!r}')
for name, *_ in MOVE:
    if not resolve(name):
        errors.append(f'NOT FOUND in Exercises: {name!r}')
for name, _why in UNPLACED:
    if not resolve(name):
        errors.append(f'NOT FOUND in Exercises: {name!r}')

if errors:
    print('VALIDATION FAILED:')
    for e in errors:
        print('  -', e)
    sys.exit(1)

# ------------------------------------------------------------------- emit
with io.open(os.path.join(HERE, 'assignments.csv'), 'w', encoding='utf-8', newline='') as f:
    w = csv.writer(f)
    w.writerow(['Sheet line', 'Name', 'Discipline', 'Line', 'Confidence'])
    for name, disc, line, conf in ASSIGN:
        for ln, _r in resolve(name):
            w.writerow([ln, name, disc, line, conf])

with io.open(os.path.join(HERE, 'moves.csv'), 'w', encoding='utf-8', newline='') as f:
    w = csv.writer(f)
    w.writerow(['Sheet line', 'Name', 'Current Discipline', 'Current Line',
                'Proposed Discipline', 'Proposed Line'])
    for name, disc, line in MOVE:
        for ln, r in resolve(name):
            w.writerow([ln, name, (r.get('Discipline') or '').strip(),
                        (r.get('Line') or '').strip(), disc, line])

# ------------------------------------------------------------------ summary
print('validation passed: every target LineKey is declared, every name exists.\n')
print('assignments: %d rows' % sum(len(resolve(n)) for n, *_ in ASSIGN))
print('re-files   : %d rows' % sum(len(resolve(n)) for n, *_ in MOVE))
print('unplaced   : %d rows' % len(UNPLACED))
print('\nresulting fill of previously-empty lines:')
after = collections.Counter()
for name, disc, line, _c in ASSIGN:
    after[f'{disc} - {line}'] += len(resolve(name))
for name, disc, line in MOVE:
    after[f'{disc} - {line}'] += len(resolve(name))
cur = collections.Counter()
for _ln, r in named:
    cur[(r.get('Discipline') or '').strip() + ' - ' + (r.get('Line') or '').strip()] += 1
for k in sorted(after):
    was = cur[k]
    print('   %-56s %2d -> %2d' % (k, was, was + after[k]))

print('\nunplaced rows, grouped by what they need:')
gp = collections.Counter(unplaced_group(w) for _n, w in UNPLACED)
for k, v in sorted(gp.items(), key=lambda kv: -kv[1]):
    print('   %-52s %d' % (k, v))
print('   %-52s %d' % ('TOTAL', sum(gp.values())))

print('\nstill empty after this proposal:')
for k in sorted(declared):
    if cur[k] == 0 and after[k] == 0:
        print('   ', k)
