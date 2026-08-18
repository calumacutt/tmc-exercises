"""
Taxonomy v3 proposal — recommended Discipline/Line structure + exercise moves.

READ-ONLY against the sheet. Emits changes.csv (one row per change Calum makes)
and a summary. Validates that every exercise lands in a declared v3 LineKey and
that nothing is silently dropped.

Three kinds of change, deliberately kept separate because they are applied
differently in the sheet:
  RENAME - a whole line/discipline is renamed. Bulk find-and-replace.
  MOVE   - one exercise changes line. Per-row edit.
  TAG    - one exercise gets Session Role values. Per-row edit, new column.
"""
import csv, io, os, sys, collections

HERE = os.path.dirname(os.path.abspath(__file__))
DATA = os.path.dirname(HERE)
sys.stdout.reconfigure(encoding='utf-8')

E = [r for r in csv.DictReader(io.open(os.path.join(DATA, 'exercises.csv'), encoding='utf-8-sig'))
     if (r.get('Name') or '').strip()]
for r in E:
    r['Name'] = r['Name'].strip()
cur = {r['Name']: ((r.get('Discipline') or '').strip(), (r.get('Line') or '').strip()) for r in E}

# ============================================================ v3 TAXONOMY
# discipline -> (pillar, [lines])
V3 = {
    # ---- Strength & Capacity
    'Hanging & Pulling': ('Strength & Capacity', [
        'Passive / Active Hang', 'Vertical Pull', 'Swinging & Brachiation',
        'Horizontal Pull', 'Pull-to-Press Transition']),
    'Straight-Arm Strength': ('Strength & Capacity', [
        'Front Lever Line', 'Back Lever Line', 'Planche Line', 'Side Lever Line',
        'Straight-Arm Rotation']),
    # Core currently exists only as a HANGING line inside a straight-arm
    # discipline, which is why loaded rotation work (kettlebell halo, wood chop)
    # had nowhere to go at all. Give core its own discipline.
    'Core & Midline': ('Strength & Capacity', [
        'Hanging Core & Compression', 'Rotational & Loaded Core']),
    'Pressing Strength': ('Strength & Capacity', [
        'Horizontal Press', 'Vertical Press', 'Dip Press',
        'Bent-Arm to Straight-Arm Press', 'Arms & Accessory']),
    'Loaded Lower Body Strength': ('Strength & Capacity', [
        'Bilateral Squat', 'Single-Leg Squat & Lunge', 'Lateral / Mobility Squat',
        'Hip Hinge']),
    'Bounciness & Elastic Power': ('Strength & Capacity', [
        'Vertical Jump', 'Horizontal Jump']),
    # ---- Handstands & Balance
    'Hand Balancing & Inversion': ('Handstands & Balance', [
        'Static Inversion', 'Shaped Handstands', 'Press Entries', 'Bent-Arm Balances']),
    # ---- Mobility
    'Hip & Leg Mobility': ('Mobility', [
        'Front Split Line', 'Middle Split Line', 'Hip Rotation',
        'Squat Position', 'Stance Positions']),
    'Shoulder & Thoracic Mobility': ('Mobility', [
        'Scapular Control', 'Shoulder Rotation', 'Chest & Thoracic Opening',
        'Lat & Side Body']),
    # NB: no 'Rotational Articulation' line. The library has no standalone
    # rotational-articulation exercise - the rotation work that exists is either
    # hanging core (Windscreen Wipers) or loaded (Kettlebell Wood Chop). That is a
    # gap in the TRAINING, not in the taxonomy; declaring an empty line hides it.
    'Spinal Mobility': ('Mobility', [
        'Spinal Extension & Bridging', 'Spinal Waves']),
    # ---- Flocomotion
    'Ground Locomotion': ('Flocomotion', [
        'Quadrupedal Forward', 'Lateral / Multi-directional', 'Rolling Locomotion',
        'Bipedal Forward']),
    'Inverted & Rotational Locomotion': ('Flocomotion', [
        'Cartwheel Family', 'Walkovers', 'Flips & Handsprings', 'Capoeira Inversions']),
    'Rhythm & Flow': ('Flocomotion', [
        'Rhythmic Foundations', 'Floor Flow', 'Kicks', 'Acrobatics',
        'Dance / Musical Movement']),
    'Partner & Connection': ('Flocomotion', [
        'Rough Housing', 'Partner Connection', 'Flow Games']),
    # ---- Object Play
    'Object Play': ('Object Play', ['Juggling', 'Staff', 'Ball Skills']),
}
DECLARED = {f'{d} - {l}' for d, (_p, ls) in V3.items() for l in ls}

# ============================================================ RENAMES (bulk)
# old LineKey -> new LineKey. Every exercise in the old line moves with it
# unless it also appears in MOVE below (MOVE wins).
RENAME = {
    'Hanging & Pulling Above the Bar - Passive / Active Hang': 'Hanging & Pulling - Passive / Active Hang',
    'Hanging & Pulling Above the Bar - Vertical Pull':         'Hanging & Pulling - Vertical Pull',
    'Hanging & Pulling Above the Bar - Horizontal Pull':       'Hanging & Pulling - Horizontal Pull',
    'Hanging & Pulling Above the Bar - Pull-to-Press Transition': 'Hanging & Pulling - Pull-to-Press Transition',
    'Lever & Straight-Arm Body Control - Front Lever Line': 'Straight-Arm Strength - Front Lever Line',
    'Lever & Straight-Arm Body Control - Planche Line':     'Straight-Arm Strength - Planche Line',
    'Lever & Straight-Arm Body Control - Side Lever Line':  'Straight-Arm Strength - Side Lever Line',
    'Lever & Straight-Arm Body Control - Core':             'Core & Midline - Hanging Core & Compression',
    'Foundational Resting Positions - Hip Opening (frontal)': 'Hip & Leg Mobility - Front Split Line',
    'Foundational Resting Positions - Stance Positions':      'Hip & Leg Mobility - Stance Positions',
    'Hand-Eye Coordination & Object Manipulation - Juggling': 'Object Play - Juggling',
    'Hand-Eye Coordination & Object Manipulation - Staff':    'Object Play - Staff',
    'Rhythm, Flow & Expression - Rhythmic Foundations': 'Rhythm & Flow - Rhythmic Foundations',
    'Rhythm, Flow & Expression - Floor Flow':           'Rhythm & Flow - Floor Flow',
    'Rhythm, Flow & Expression - Kicks':                'Rhythm & Flow - Kicks',
    'Rhythm, Flow & Expression - Acrobatics':           'Rhythm & Flow - Acrobatics',
    'Games - Rough Housing':          'Partner & Connection - Rough Housing',
    'Games - Team Work & Connection': 'Partner & Connection - Partner Connection',
    'Games - Floor & Flow Games':     'Partner & Connection - Flow Games',
    'Games - Ball Games':             'Object Play - Ball Skills',
    'Games - Stick Games':            'Object Play - Staff',
}

# ============================================================ MOVES (per row)
HP = 'Hanging & Pulling'
SA = 'Straight-Arm Strength'
PR = 'Pressing Strength'
LB = 'Loaded Lower Body Strength'
BE = 'Bounciness & Elastic Power'
HB = 'Hand Balancing & Inversion'
HL = 'Hip & Leg Mobility'
ST = 'Shoulder & Thoracic Mobility'
SP = 'Spinal Mobility'
IR = 'Inverted & Rotational Locomotion'
RF = 'Rhythm & Flow'
OP = 'Object Play'
PC = 'Partner & Connection'
GL = 'Ground Locomotion'
CM = 'Core & Midline'

MOVE = {}
def mv(line, names, why):
    for n in names:
        MOVE[n] = (line, why)

# --- Horizontal Pull is doing four jobs. Split it. ------------------------
mv(f'{SA} - Front Lever Line', [
    'Front Lever', 'Front Lever - Straddle', 'Front Lever - Tuck',
    'Front Lever Pull', 'Front Lever Pull - Tuck', 'Front Lever Pull - Straddle',
    'Front Lever - Deadlift', 'Ice Cream Maker',
], 'front lever family - the declared Front Lever Line was empty while these sat in Horizontal Pull')

mv(f'{SA} - Straight-Arm Rotation', [
    'Skin the Cat', 'Skin the Cat - Jumping', 'Skin the Cat - Pike', 'Skin the Cat - Bar',
    '360 Pull', 'Forward Roll - Bar', 'Backward Roll - Bar', 'Ring Roll', 'Ring Roll - Backward',
], 'straight-arm rotation through the shoulder - not a horizontal pull')

mv(f'{PR} - Arms & Accessory', [
    'Bicep Curl - Rings', 'Bicep Curl - Dumbbell', 'Bicep Curl - Rotational',
    'Hammer Curl', 'Pelican Curl',
], 'single-joint arm isolation - was padding out Horizontal Pull')

# --- Back lever family: straight-arm PULLING, filed under Pressing --------
mv(f'{SA} - Back Lever Line', [
    'German Hang', 'German Hang - Assisted',
    'Back Lever', 'Back Lever - Tuck', 'Back Lever - Straddle',
], 'straight-arm pulling holds, currently under Pressing Strength > Horizontal Press')

mv(f'{PR} - Arms & Accessory', [
    'Tricep Extension - Rings', 'Tricep Extension - Banded', 'Bicep Curl - Banded',
], 'single-joint arm isolation')

# --- Vertical Pull is doing two jobs -------------------------------------
mv(f'{HP} - Swinging & Brachiation', [
    'Swinging', 'Lateral Swing', 'Brachiation', 'Lache', 'Swing to Precision', 'Ape Swing',
], 'swinging/travelling, not strict vertical pulling')

mv(f'{HP} - Pull-to-Press Transition', [
    'Muscle Up - Bar', 'Bar Kip', 'Glide Kip', 'Pull Over', 'Pull Over - Jump',
], 'kipping and bar transitions belong with the other muscle-ups, not in strict Vertical Pull')

# --- Kettlebell Swing is not a planche ------------------------------------
mv(f'{LB} - Hip Hinge', [
    'Kettlebell Swing', 'Kettlebell Swing Squat', 'Kettlebell Swing Single Arm',
    'Jefferson Curl', 'Jefferson Curl - Wide Leg', 'Jefferson Curl - to Squat',
    'Good Morning', 'Good Morning - Single Leg', 'Good Morning - Wide Leg', 'RDL',
    'Hinge Pick Ups',
], 'loaded hip hinge - Kettlebell Swing was filed under Planche Line; the rest sat in hip mobility')

mv(f'{LB} - Single-Leg Squat & Lunge', [
    'Split Squat', 'Lunge', 'Kettlebell walking lunge', 'Sissy Squat', 'Walking Lunge',
], 'single-leg loaded strength')

mv(f'{LB} - Bilateral Squat', [
    'Kettlebell Thruster', 'Thruster',
], 'squat-to-press: the squat is the limiting element')

mv(f'{LB} - Lateral / Mobility Squat', [
    'Cossack Squat', 'Horse Stance - Squats',
], 'loaded squatting in the frontal plane')

mv(f'{CM} - Rotational & Loaded Core', [
    'Kettlebell Halo', 'Kettlebell Around the world', 'Kettlebell ATW to Lunge',
    'Kettlebell Wood Chop',
], 'loaded rotation - had no Discipline or Line at all, and no line in the library fitted')

mv(f'{BE} - Vertical Jump', ['Box Jump', 'High Jump'], 'vertical jumping')
mv(f'{BE} - Horizontal Jump', ['Gather Step jump'], 'travelling jump')

# --- The frontal-plane hip cluster (currently no Line at all) ------------
mv(f'{HL} - Middle Split Line', [
    'Butterfly', 'Butterfly - Weighted', 'Butterfly - Partner',
    'Pancake', 'Pancake - Elevated', 'Pancake - Partner', 'Pancake - Weighted',
    'Pancake - Dynamic', 'Side Pancake Weighted',
    'Frog Stretch', 'Frog - Internal Lifts',
    'Middle Splits', 'Middle Splits - Active', 'Middle Splits - Sliding',
    'Middle Splits - Contract and Relax',
    'Copenhagen', 'Leg Swings - Side', 'Partner Leg Lift - Side', 'Diagonal Stretch',
], 'abduction / middle-split work - had no Line, and Middle Split Line did not exist')

mv(f'{HL} - Hip Rotation', [
    '90/90', 'Pigeon Stretch', 'Pigeon Stretch - Box',
], 'hip rotation rather than a split line')

mv(f'{HL} - Stance Positions', ['Horse Stance', 'Stick Horse Stance'], 'stance positions')
mv(f'{HL} - Squat Position', ['Squat Gladiators'], 'held squat position (also a game - see tags)')
mv(f'{HL} - Front Split Line', ['Hurdler Stretch'], 'sagittal / front-split work')

# --- Shoulder & thoracic: the prehab rehome ------------------------------
mv(f'{ST} - Scapular Control', [
    'Banded Pull Apart', 'Banded Overhead Pull Apart', 'Banded Facepull',
    'Banded Lower Trap Pull', 'Banded Row', 'Banded Straight Arm Pull Down',
    'Banded Chin Pull Down', 'Banded Frontal Raise', 'Banded Lateral Raise',
    'Behind the Back Supinated Raise', 'Dumbell Lower Trap Raise', 'Banded Shoulder Routine',
], 'scapular control - was in Prehab & Rehab > Banded, a line named after equipment')

mv(f'{ST} - Shoulder Rotation', [
    'Banded External Rotation Pull Apart', 'Banded External Rotation - Single Arm',
    'Banded Internal Rotation - Single Arm', 'Banded Circles', 'Banded Dislocate',
    'Cuban Rotation', 'Dumbell Internal/External rotion',
], 'shoulder rotation - same rehome; the dumbbell versions had nowhere to go at all')

mv(f'{ST} - Chest & Thoracic Opening', [
    'Foam Roller Opener - Dumbbell', 'Foam Roller Opener - Stall Bars',
    'Lying Chest Stretch', 'Standing Chest Stretch', 'Over head Partner Push',
    'Dumbell Flys', 'Table Top Lifts', 'Table Top Hold', 'Banded Thoracic Rotations',
], 'chest / front-line opening - no such line existed')

mv(f'{ST} - Lat & Side Body', [
    'Standing Lat Stretch', 'Squat Lat Stretch', 'Mermaid Stretch',
], 'lateral flexion - not thoracic extension, so it needs its own line')

# --- Spinal: consolidate the three homes for bridges --------------------
mv(f'{SP} - Spinal Extension & Bridging', [
    'Cobra Peel', 'Standing Arch', 'Yoga Wheel Opener', 'Thoracic Bridge',
    'Bridge Hold', 'Bridge Pulses', 'Bridge Circle', 'Bridge Circle - Half',
    'Bridge Push Up', 'Push Up - Bridge',
], 'bridges were split across three disciplines - consolidated here')

mv(f'{SP} - Spinal Waves', ['Spinal Waves and Joint Rotations'], 'spinal waves (also a game - see tags)')

# --- Inverted & rotational: cartwheels were absorbing everything --------
mv(f'{IR} - Walkovers', ['Front Walkover', 'Back Walkover', 'Gumby'], 'walkovers are not cartwheels')
mv(f'{IR} - Flips & Handsprings', ['Aerial', 'Butterfly Twist'], 'no-hands rotation')
mv(f'{IR} - Capoeira Inversions', ['Rolê'], 'capoeira')

# --- Balance: fold the 1-exercise line away -----------------------------
mv(f'{HB} - Bent-Arm Balances', ['Crow - Straight Arm'],
   'Straight Arm Balance held one exercise and its name collided with Straight-Arm Strength')

# --- Object play: ball skills out of Games ------------------------------
mv(f'{OP} - Ball Skills', [
    'Soccer Ball Juggling', 'Game of Soccer', 'Throwing and Catching',
    'Bouncing Elimination', 'Bouncing and Shooting Basketball', 'Practice Ball Drills',
    'Paralette Balance + Pass the Ball', 'Head Shoulders Knees Toes Ball',
], 'ball skills are Object Play, not a category of their own')
mv(f'{OP} - Staff', ['Bo Staff Spinning'], 'duplicate of the Staff line')
mv(f'{OP} - Juggling', ['Juggling'], 'was filed under Games > Ball Games alongside the real Juggling line')

# --- Games with a real movement home -----------------------------------
mv(f'{GL} - Quadrupedal Forward', ['Crawling Patterns with Partner', 'Animal Pattern Relay Races'],
   'crawling patterns')
mv(f'{GL} - Rolling Locomotion', ['Push Pull and Rolling in all directions'], 'rolling')
mv(f'{RF} - Dance / Musical Movement', ['Contact Improv', 'Coordinations', 'Mimic Game'],
   'expressive / musical movement - fills a declared line that was empty')
mv(f'{HB} - Static Inversion', ['Balancing'], 'balance game')

# ============================================================ TAGS
# New multi-value Session Role column. `;`-separated.
GAME_TAG = [
    # everything that came out of the Games discipline stays flagged as a game
    'Soccer Ball Juggling', 'Game of Soccer', 'Throwing and Catching', 'Juggling',
    'Bouncing Elimination', 'Balancing Elimination', 'Bouncing and Shooting Basketball',
    'Practice Ball Drills', 'Paralette Balance + Pass the Ball', 'Name Game',
    'Head Shoulders Knees Toes Ball',
    'Coordinations', 'Crawling Patterns with Partner', 'Push Pull and Rolling in all directions',
    'Contact Improv', 'Stone and Water', 'Voodoo Doll', 'Mimic Game', 'Jenga Blocks',
    'Spinal Waves and Joint Rotations',
    'Push Pull Off the Line', 'King of the Mat', 'Knee Tap Game + Crawling Version',
    'Shoulder Tap Game', 'Flip the Croc', 'Quadrapedal Red Rover', 'Grappling',
    'Foot Taps, Handslaps', 'Squat Gladiators', 'Tug of War',
    'Zen Archer', 'Circle Stick Game', 'Drop Stick Game', 'Stick Twister',
    'Hanging Zen Archer', 'Stick Circle Madness', 'Limbo',
    'Partner Arching Circles Around Stick', 'Movement Riddles', 'Balancing',
    'Bo Staff Spinning', 'Stick Horse Stance',
    'Stuck in the Mud', 'Dead Bug Game', 'Paper Scissors Rock', 'Wheel Barrow Races',
    'Marry Me', 'Partner Carries', 'Animal Pattern Relay Races', 'Speed Dating',
    'Trust Game Eyes Closed',
]
PREHAB_TAG = [
    'Banded Circles', 'Banded Pull Apart', 'Behind the Back Supinated Raise',
    'Banded Frontal Raise', 'Banded Lateral Raise', 'Banded Dislocate',
    'Banded Overhead Pull Apart', 'Banded Facepull', 'Banded External Rotation Pull Apart',
    'Banded External Rotation - Single Arm', 'Banded Internal Rotation - Single Arm',
    'Banded Thoracic Rotations', 'Banded Lower Trap Pull', 'Banded Shoulder Routine',
    'Banded Row', 'Banded Straight Arm Pull Down', 'Banded Chin Pull Down',
    'Dumbell Lower Trap Raise', 'Cuban Rotation', 'Dumbell Internal/External rotion',
    'Dumbell Flys', 'Table Top Lifts', 'Table Top Hold',
]

# ============================================================ ALSO APPEARS IN
AAI = {
    'Bridge Circle':            [f'{RF} - Acrobatics'],
    'Bridge Walk':              [f'{SP} - Spinal Extension & Bridging'],
    'Crab Walk':                [f'{SP} - Spinal Extension & Bridging'],
    'Handstand to Roll':        [f'{HB} - Static Inversion'],
    'Forward Roll - Bar':       [f'{GL} - Rolling Locomotion'],
    'Backward Roll - Bar':      [f'{GL} - Rolling Locomotion'],
    'Skin the Cat':             [f'{SA} - Front Lever Line'],
    'Muscle Up - Rings':        [f'{PR} - Dip Press'],
    'Muscle Up - Bar':          [f'{HP} - Vertical Pull'],
    'Thruster':                 [f'{PR} - Vertical Press'],
    'Kettlebell Thruster':      [f'{PR} - Vertical Press'],
    'Horse Stance - Squats':    [f'{HL} - Stance Positions'],
    'Horse Stance - Walk':      [f'{HL} - Stance Positions'],
    'Lizard Crawl - Push Up':   [f'{PR} - Horizontal Press'],
    'Butterfly Twist':          [f'{RF} - Floor Flow'],
    'Aerial':                   [f'{IR} - Cartwheel Family'],
    'Cat Crawl - Spinal Wave':  [f'{SP} - Spinal Waves'],
    'Squat Gladiators':         [f'{PC} - Rough Housing'],
    'Stick Horse Stance':       [f'{OP} - Staff'],
    'Wheel Barrow Races':       [f'{GL} - Quadrupedal Forward'],
    'Partner Carries':          [f'{LB} - Single-Leg Squat & Lunge'],
    'Push Up - Bridge':         [f'{PR} - Vertical Press'],
    'Bridge Push Up':           [f'{PR} - Bent-Arm to Straight-Arm Press'],
    'Monkey Kick':              [f'{GL} - Quadrupedal Forward'],
    'Hanging Zen Archer':       [f'{HP} - Passive / Active Hang'],
    'Inverted Hang - Rings':    [f'{SA} - Straight-Arm Rotation'],
    'Handstand - Partner':      [f'{PC} - Partner Connection'],
    'Butterfly - Partner':      [f'{PC} - Partner Connection'],
    'Pancake - Partner':        [f'{PC} - Partner Connection'],
    'Partner Forward Fold':     [f'{PC} - Partner Connection'],
    'Partner Hamstring Stretch':[f'{PC} - Partner Connection'],
    'Over head Partner Push':   [f'{PC} - Partner Connection'],
    'Partner Leg Lift - Front': [f'{PC} - Partner Connection'],
    'Partner Leg Lift - Side':  [f'{PC} - Partner Connection'],
}

# ============================================================ RESOLVE
def new_key(name):
    """Where does this exercise end up under v3?"""
    if name in MOVE:
        return MOVE[name][0]
    d, l = cur[name]
    old = f'{d} - {l}'
    if old in RENAME:
        return RENAME[old]
    if old in DECLARED:
        return old
    return None  # unresolved

errors, unresolved = [], []
for name in cur:
    k = new_key(name)
    if k is None:
        unresolved.append(name)
    elif k not in DECLARED:
        errors.append(f'{name!r} -> {k!r} which is NOT a declared v3 LineKey')

for n in list(MOVE) + GAME_TAG + PREHAB_TAG + list(AAI):
    if n not in cur:
        errors.append(f'name not in sheet: {n!r}')
for n, keys in AAI.items():
    for k in keys:
        if k not in DECLARED:
            errors.append(f'AAI target not declared: {n!r} -> {k!r}')
for n in AAI:
    if new_key(n) in AAI[n]:
        errors.append(f'AAI duplicates primary line for {n!r}')

if errors:
    print('VALIDATION FAILED (%d):' % len(errors))
    for e in sorted(set(errors)):
        print('  -', e)
    sys.exit(1)

# ============================================================ EMIT
rows = []
for name in sorted(cur):
    d, l = cur[name]
    old = f'{d} - {l}' if (d or l) else '(no taxonomy)'
    k = new_key(name)
    if k is None:
        continue
    nd, _, nl = k.partition(' - ')
    kind = ('MOVE' if name in MOVE else
            'RENAME' if old in RENAME else '')
    if kind:
        rows.append({
            'Change': kind, 'Name': name,
            'Old Discipline': d, 'Old Line': l,
            'New Discipline': nd, 'New Line': nl,
            'Session Role': ';'.join(
                (['Game'] if name in GAME_TAG else []) +
                (['Prehab'] if name in PREHAB_TAG else [])),
            'Also Appears In': ';'.join(AAI.get(name, [])),
            'Why': MOVE[name][1] if name in MOVE else 'line renamed',
        })
# tag/AAI-only rows (no move, no rename)
for name in sorted(cur):
    if any(r['Name'] == name for r in rows):
        continue
    tags = (['Game'] if name in GAME_TAG else []) + (['Prehab'] if name in PREHAB_TAG else [])
    aai = AAI.get(name, [])
    if not tags and not aai:
        continue
    d, l = cur[name]
    rows.append({
        'Change': 'TAG', 'Name': name,
        'Old Discipline': d, 'Old Line': l,
        'New Discipline': d, 'New Line': l,
        'Session Role': ';'.join(tags),
        'Also Appears In': ';'.join(aai),
        'Why': 'tag / cross-reference only, taxonomy unchanged',
    })

cols = ['Change', 'Name', 'Old Discipline', 'Old Line', 'New Discipline', 'New Line',
        'Session Role', 'Also Appears In', 'Why']
with io.open(os.path.join(HERE, 'changes.csv'), 'w', encoding='utf-8', newline='') as f:
    w = csv.DictWriter(f, fieldnames=cols)
    w.writeheader()
    w.writerows(rows)

# ============================================================ SUMMARY
print('validation passed.\n')
print('exercises            %d' % len(cur))
print('unresolved (no home) %d' % len(unresolved))
for n in unresolved:
    print('    %-34s currently %s'
          % (n, (cur[n][0] + ' - ' + cur[n][1]).strip(' -') or '(no taxonomy)'))
print()
print('changes.csv rows     %d' % len(rows))
for k, v in collections.Counter(r['Change'] for r in rows).most_common():
    print('   %-8s %d' % (k, v))
print('\ntags: Game %d, Prehab %d' % (len(GAME_TAG), len(PREHAB_TAG)))
print('Also Appears In recommendations: %d' % len(AAI))

print('\nv3 line fill (disciplines %d -> %d, lines %d -> %d):'
      % (len({d for d, _ in cur.values() if d}), len(V3),
         len({f'{d} - {l}' for d, l in cur.values() if l}),
         len(DECLARED)))
fill = collections.Counter(new_key(n) for n in cur if new_key(n))
for d, (p, ls) in V3.items():
    print('\n  %s  [%s]' % (d, p))
    for l in ls:
        k = f'{d} - {l}'
        print('     %-34s %s' % (l, fill[k] if fill[k] else '** EMPTY **'))
