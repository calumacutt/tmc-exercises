"""
Render the taxonomy v3 proposal as a single HTML page.

Runs taxonomy_v3.py first (which validates and emits changes.csv), then builds
the page from the same in-memory data — so the page cannot disagree with the CSV.
"""
import io, os, sys, collections

HERE = os.path.dirname(os.path.abspath(__file__))
sys.stdout.reconfigure(encoding='utf-8')

g = {'__file__': os.path.join(HERE, 'taxonomy_v3.py'), '__name__': 'taxonomy_v3'}
exec(io.open(g['__file__'], encoding='utf-8').read(), g)

V3, DECLARED, RENAME, MOVE = g['V3'], g['DECLARED'], g['RENAME'], g['MOVE']
GAME_TAG, PREHAB_TAG, AAI, cur, fill = (
    g['GAME_TAG'], g['PREHAB_TAG'], g['AAI'], g['cur'], g['fill'])

PILLAR_HUE = {
    'Strength & Capacity':  '8 58% 52%',
    'Mobility':             '145 32% 46%',
    'Handstands & Balance': '42 70% 54%',
    'Flocomotion':          '268 32% 58%',
    'Object Play':          '198 46% 52%',
}
PILLAR_ORDER = ['Handstands & Balance', 'Strength & Capacity', 'Mobility',
                'Flocomotion', 'Object Play']

def esc(t):
    return str(t).replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;')

def chips(names):
    return ''.join('<span class="chip">%s</span>' % esc(n) for n in sorted(names))

old_disc = {d for d, _ in cur.values() if d}
old_lines = {'%s - %s' % (d, l) for d, l in cur.values() if l}

cards = []
for p in PILLAR_ORDER:
    for d, (dp, ls) in V3.items():
        if dp != p:
            continue
        rows = []
        for l in ls:
            k = '%s - %s' % (d, l)
            tag = ' <em class="new">new</em>' if k not in old_lines else ''
            rows.append('<tr><td class="ln">%s%s</td><td class="num">%d</td></tr>'
                        % (esc(l), tag, fill[k]))
        cards.append(
            '<article class="disc" style="--hue:%s"><header><h3>%s%s</h3>'
            '<p class="pillar">%s</p></header>'
            '<table class="lines"><tbody>%s</tbody></table></article>'
            % (PILLAR_HUE[p], esc(d),
               ' <em class="new">new</em>' if d not in old_disc else '',
               esc(p), ''.join(rows)))

rename_rows = ''.join(
    '<tr><td>%s</td><td class="arrow">&rarr;</td><td class="to">%s</td></tr>'
    % (esc(o), esc(n)) for o, n in sorted(RENAME.items()))

by_dest = {}
for n, (line, why) in MOVE.items():
    by_dest.setdefault((line, why), []).append(n)
move_groups = ''.join(
    '<section class="movegroup"><h4>%s <span class="ct">%d</span></h4>'
    '<p class="why">%s</p><div class="chips">%s</div></section>'
    % (esc(line), len(names), esc(why), chips(names))
    for (line, why), names in sorted(by_dest.items()))

aai_rows = ''.join(
    '<tr><td>%s</td><td class="to">%s</td></tr>' % (esc(n), esc('; '.join(k)))
    for n, k in sorted(AAI.items()))

TPL = io.open(os.path.join(HERE, 'page.template.html'), encoding='utf-8').read()
html = TPL.format(
    n_ex=len(cur), n_disc=len(V3), n_disc_old=len(old_disc),
    n_lines=len(DECLARED), n_lines_old=len(old_lines),
    n_rename=len(RENAME), n_move=len(MOVE),
    n_game=len(GAME_TAG), n_prehab=len(PREHAB_TAG), n_aai=len(AAI),
    cards=''.join(cards), rename_rows=rename_rows, move_groups=move_groups,
    aai_rows=aai_rows, game_chips=chips(GAME_TAG), prehab_chips=chips(PREHAB_TAG),
)
out = os.path.join(HERE, 'taxonomy-v3.html')
io.open(out, 'w', encoding='utf-8', newline='\n').write(html)
print('\nwrote %s (%d chars)' % (out, len(html)))
