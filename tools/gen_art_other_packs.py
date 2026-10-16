"""Объёмная версия остальных 7 паков. Запуск из корня репозитория:
python -I tools/gen_art_other_packs.py web/effects/doodles/packs

Правило: градиенты только на заливках и замкнутых фигурах — на прямых линиях
(нулевая ширина bbox) градиент не рисуется."""
import os
import shutil
import sys

B = sys.argv[1]
NS = 'xmlns="http://www.w3.org/2000/svg"'


def svg(w, h, defs, body):
    return (f'<svg {NS} width="{w}" height="{h}" viewBox="0 0 {w} {h}">\n'
            f'<defs>{defs.strip()}</defs>\n{body.strip()}\n</svg>\n')


def _stops(stops):
    out = []
    for s in stops:
        o, c = s[0], s[1]
        op = f' stop-opacity="{s[2]}"' if len(s) > 2 else ''
        out.append(f'<stop offset="{o}" stop-color="{c}"{op}/>')
    return ''.join(out)


def lin(gid, stops, x1=0, y1=0, x2=0, y2=1):
    return f'<linearGradient id="{gid}" x1="{x1}" y1="{y1}" x2="{x2}" y2="{y2}">{_stops(stops)}</linearGradient>'


def rad(gid, stops, cx='38%', cy='32%', r='70%'):
    return f'<radialGradient id="{gid}" cx="{cx}" cy="{cy}" r="{r}">{_stops(stops)}</radialGradient>'


def write(pack, name, content):
    d = os.path.join(B, pack)
    os.makedirs(d, exist_ok=True)
    with open(os.path.join(d, name), 'w', encoding='utf-8') as f:
        f.write(content)


def copy(src_pack, name, dst_pack, dst_name=None):
    shutil.copy(os.path.join(B, src_pack, name), os.path.join(B, dst_pack, dst_name or name))


STAR = ('M24 3 L29.6 16.3 L44.9 17.2 L33 26.9 L36.9 41.8 L24 33.5 L11.1 41.8 '
        'L15 26.9 L3.1 17.2 L18.4 16.3 Z')

# =====================================================================
# НОВЫЙ ГОД
# =====================================================================

trim_bumps = ''.join(f'<circle cx="{x}" cy="49" r="7.5"/>' for x in range(31, 92, 8))
write('newyear', 'hat.svg', svg(120, 120,
    lin('cap', [(0, '#ff8787'), (.55, '#e03131'), (1, '#a61e1e')], 0, 0, 1, 1) +
    lin('trim', [(0, '#ffffff'), (1, '#dde3ea')]) +
    rad('pom', [(0, '#ffffff'), (.6, '#f8f9fa'), (1, '#ced4da')], '40%', '35%', '65%'),
    f'''
<path d="M32 46 C32 24 50 12 70 14 C88 16 98 32 100 52 L92 54 C90 40 84 30 74 28 C80 34 86 40 88 46 Z" fill="url(#cap)"/>
<path d="M70 14 C88 16 98 32 100 52 L92 54 C90 40 84 30 74 28 Z" fill="#6b0f0f" fill-opacity=".22"/>
<path d="M42 36 Q50 24 62 19.5" stroke="#fff" stroke-opacity=".45" stroke-width="4" fill="none" stroke-linecap="round"/>
<g fill="url(#trim)">{trim_bumps}</g>
<path d="M30 45 Q45 41 58 43" stroke="#fff" stroke-width="2" fill="none" stroke-linecap="round"/>
<g fill="url(#pom)"><circle cx="97" cy="57" r="8.5"/><circle cx="91" cy="55" r="4"/><circle cx="102" cy="53" r="4"/><circle cx="99" cy="63" r="4"/></g>
'''))

BULB_COLORS = [('r', '#ffc9c9', '#fa5252', '#a61e1e'), ('y', '#fff9db', '#fcc419', '#e67700'),
               ('g', '#d3f9d8', '#51cf66', '#2b8a3e'), ('b', '#d0ebff', '#4dabf7', '#1864ab')]
defs = ''.join(rad(f'b{k}', [(0, l), (.55, m), (1, d)], '40%', '30%', '75%') for k, l, m, d in BULB_COLORS)
defs += lin('cap', [(0, '#dee2e6'), (1, '#495057')], 0, 0, 1, 0)
bulbs = []
k = 0
for seg in range(4):
    for t, y in ((0.25, 19), (0.5, 23), (0.75, 19)):
        x = seg * 100 + t * 100
        key, _, mid, _ = BULB_COLORS[k % 4]
        b = (k * 0.17) % 1.2
        bulbs.append(
            f'<g><animate attributeName="opacity" values="1;.45;1" dur="1.2s" begin="{b:.2f}s" repeatCount="indefinite"/>'
            f'<circle cx="{x:.0f}" cy="{y + 13}" r="11" fill="{mid}" fill-opacity=".22"/>'
            f'<ellipse cx="{x:.0f}" cy="{y + 13}" rx="6.2" ry="9" fill="url(#b{key})"/>'
            f'<ellipse cx="{x - 2:.0f}" cy="{y + 9.5}" rx="1.7" ry="3.2" fill="#fff" fill-opacity=".8"/></g>')
        bulbs.append(f'<rect x="{x - 3.2:.1f}" y="{y}" width="6.4" height="5.5" rx="1.5" fill="url(#cap)"/>')
        k += 1
write('newyear', 'garland.svg', svg(400, 50, defs,
    '<path d="M0 8 Q50 38 100 8 Q150 38 200 8 Q250 38 300 8 Q350 38 400 8" stroke="#2b8a3e" stroke-width="3.2" fill="none"/>\n'
    '<path d="M0 7 Q50 37 100 7 Q150 37 200 7 Q250 37 300 7 Q350 37 400 7" stroke="#8ce99a" stroke-opacity=".5" stroke-width="1" fill="none"/>\n'
    + '\n'.join(bulbs)))

write('newyear', 'confetti1.svg', svg(48, 48,
    lin('g', [(0, '#a5d8ff'), (.5, '#4dabf7'), (1, '#1971c2')], 0, 0, 1, 0),
    '<rect x="17" y="5" width="14" height="38" rx="4" fill="url(#g)"/>\n'
    '<rect x="19.5" y="8" width="3" height="32" rx="1.5" fill="#fff" fill-opacity=".45"/>'))
write('newyear', 'confetti2.svg', svg(48, 48, '',
    '<path d="M6 30 Q14 14 22 30 T38 30" stroke="#e64980" stroke-width="7" fill="none" stroke-linecap="round"/>\n'
    '<path d="M6 30 Q14 14 22 30 T38 30" stroke="#fcc2d7" stroke-width="2.5" fill="none" stroke-linecap="round" transform="translate(0 -1.5)"/>'))
write('newyear', 'confetti3.svg', svg(48, 48,
    rad('g', [(0, '#fff9db'), (.55, '#fcc419'), (1, '#e67700')]),
    '<circle cx="24" cy="24" r="12.5" fill="url(#g)"/>\n'
    '<ellipse cx="20" cy="19.5" rx="3.5" ry="2.4" transform="rotate(-30 20 19.5)" fill="#fff" fill-opacity=".75"/>'))

write('newyear', 'gift.svg', svg(80, 84,
    lin('box', [(0, '#9775fa'), (1, '#5f3dc4')], 0, 0, 1, 1) +
    lin('lid', [(0, '#c0aaff'), (1, '#7950f2')]) +
    lin('rib', [(0, '#ffe066'), (.5, '#fcc419'), (1, '#e67700')], 0, 0, 1, 0) +
    rad('bow', [(0, '#fff3bf'), (.6, '#fcc419'), (1, '#e67700')], '40%', '35%', '70%'),
    '''
<ellipse cx="40" cy="79" rx="32" ry="3.5" fill="#000" fill-opacity=".22"/>
<rect x="12" y="34" width="56" height="42" rx="7" fill="url(#box)"/>
<rect x="12" y="34" width="56" height="7" fill="#000" fill-opacity=".15"/>
<rect x="35.5" y="34" width="9" height="42" fill="url(#rib)"/>
<rect x="8" y="23" width="64" height="15" rx="6" fill="url(#lid)"/>
<rect x="35.5" y="23" width="9" height="15" fill="url(#rib)"/>
<path d="M14 27 H32" stroke="#fff" stroke-opacity=".45" stroke-width="2.5" stroke-linecap="round"/>
<path d="M17 45 V68" stroke="#fff" stroke-opacity=".25" stroke-width="3" stroke-linecap="round"/>
<ellipse cx="30.5" cy="16" rx="11" ry="7.5" transform="rotate(-22 30.5 16)" fill="url(#bow)"/>
<ellipse cx="49.5" cy="16" rx="11" ry="7.5" transform="rotate(22 49.5 16)" fill="url(#bow)"/>
<ellipse cx="30" cy="16" rx="4.5" ry="2.6" transform="rotate(-22 30 16)" fill="#b35900" fill-opacity=".35"/>
<ellipse cx="50" cy="16" rx="4.5" ry="2.6" transform="rotate(22 50 16)" fill="#b35900" fill-opacity=".35"/>
<circle cx="40" cy="21" r="5" fill="url(#bow)"/>
'''))

# =====================================================================
# ВЕСНА: КОРАБЛИК
# =====================================================================

PETALS = '<circle cy="-6" r="5"/><circle cx="6" cy="-2" r="5"/><circle cx="4" cy="5" r="5"/><circle cx="-4" cy="5" r="5"/><circle cx="-6" cy="-2" r="5"/>'
crown = ['<path d="M30 50 Q60 14 90 50" stroke="#2f9e44" stroke-width="6" fill="none" stroke-linecap="round"/>',
         '<path d="M33 46 Q60 15 87 46" stroke="#8ce99a" stroke-opacity=".6" stroke-width="1.6" fill="none" stroke-linecap="round"/>']
for cx, cy, rot in ((41, 38, -50), (54, 29, -20), (67, 29, 20), (80, 38, 50)):
    crown.append(f'<ellipse cx="{cx}" cy="{cy}" rx="6.5" ry="3.2" transform="rotate({rot} {cx} {cy})" fill="url(#leaf)"/>')
for x, y, g in ((36, 44, 'pk'), (47, 32, 'wh'), (60, 27, 'vi'), (73, 32, 'wh'), (84, 44, 'pk')):
    crown.append(f'<g transform="translate({x} {y})"><g fill="url(#{g})">{PETALS}</g>'
                 f'<circle r="3.6" fill="url(#ctr)"/><circle cx="-1" cy="-1" r="1" fill="#fff" fill-opacity=".8"/></g>')
write('spring', 'crown.svg', svg(120, 120,
    lin('leaf', [(0, '#b2f2bb'), (1, '#2f9e44')], 0, 0, 1, 1) +
    rad('pk', [(0, '#fff0f6'), (.6, '#faa2c1'), (1, '#e64980')], '50%', '50%', '60%') +
    rad('wh', [(0, '#ffffff'), (.7, '#f8f9fa'), (1, '#ced4da')], '50%', '50%', '60%') +
    rad('vi', [(0, '#f3f0ff'), (.6, '#b197fc'), (1, '#7048e8')], '50%', '50%', '60%') +
    rad('ctr', [(0, '#fff3bf'), (1, '#f59f00')]),
    '\n'.join(crown)))

write('spring', 'boat.svg', svg(120, 82,
    lin('s1', [(0, '#ffffff'), (1, '#dfe4ea')], 0, 0, 1, 1) +
    lin('s2', [(0, '#f1f3f5'), (1, '#c3cad3')], 0, 0, 1, 1) +
    lin('hull', [(0, '#ffffff'), (1, '#c9d1da')]),
    '''
<ellipse cx="60" cy="70" rx="46" ry="5" fill="#1864ab" fill-opacity=".3"/>
<path d="M60 8 L60 46 L30 46 Z" fill="url(#s1)"/>
<path d="M60 14 L86 46 L60 46 Z" fill="url(#s2)"/>
<path d="M58 14 L36 42" stroke="#fff" stroke-opacity=".8" stroke-width="2" stroke-linecap="round"/>
<path d="M10 46 L110 46 L94 66 L26 66 Z" fill="url(#hull)"/>
<path d="M26 66 L40 46 M94 66 L80 46" stroke="#adb5bd" stroke-opacity=".7" stroke-width="1.6"/>
<path d="M60 46 L52 66 M60 46 L68 66" stroke="#adb5bd" stroke-opacity=".4" stroke-width="1.2"/>
<path d="M17 53 L103 53" stroke="#21c25e" stroke-width="3.2" stroke-linecap="round"/>
<path d="M18 52 L60 52" stroke="#8ce99a" stroke-width="1" stroke-linecap="round"/>
<path d="M2 73 Q12 67 22 73 T42 73 T62 73 T82 73 T102 73 T118 73" stroke="#4dabf7" stroke-width="4" fill="none" stroke-linecap="round"/>
<path d="M8 78 Q18 73 28 78 T48 78 M70 78 Q80 73 90 78 T110 78" stroke="#a5d8ff" stroke-opacity=".8" stroke-width="2.5" fill="none" stroke-linecap="round"/>
<g fill="#d0ebff"><circle cx="8" cy="65" r="2"/><circle cx="112" cy="64" r="1.6"/><circle cx="104" cy="60" r="1.2"/></g>
'''))

write('spring', 'drop.svg', svg(48, 48,
    rad('g', [(0, '#e7f5ff'), (.5, '#74c0fc'), (1, '#1c7ed6')], '38%', '55%', '65%'),
    '''
<path d="M24 4 C24 4 38 22 38 31 A14 14 0 0 1 10 31 C10 22 24 4 24 4 Z" fill="url(#g)"/>
<ellipse cx="18.5" cy="30" rx="3" ry="5.5" transform="rotate(15 18.5 30)" fill="#fff" fill-opacity=".8"/>
<circle cx="30" cy="37" r="1.6" fill="#fff" fill-opacity=".5"/>
'''))

write('spring', 'petal.svg', svg(48, 48,
    lin('g', [(0, '#fff0f6'), (.5, '#fcc2d7'), (1, '#f06595')], 0, 0, 1, 1),
    '''
<path d="M24 4 C36 12 36 32 24 44 C12 32 12 12 24 4 Z" fill="url(#g)"/>
<path d="M24 4 C36 12 36 32 24 44 Z" fill="#c2255c" fill-opacity=".12"/>
<path d="M24 10 Q25 24 24 38" stroke="#fff" stroke-opacity=".7" stroke-width="1.4" fill="none" stroke-linecap="round"/>
<ellipse cx="19" cy="17" rx="2.4" ry="5.5" transform="rotate(12 19 17)" fill="#fff" fill-opacity=".45"/>
'''))

write('spring', 'frog.svg', svg(96, 84,
    rad('body', [(0, '#b2f2bb'), (.55, '#51cf66'), (1, '#2b8a3e')], '40%', '30%', '75%') +
    rad('belly', [(0, '#f8fff0'), (1, '#c0eb75')], '50%', '35%', '70%') +
    rad('eye', [(0, '#ffffff'), (1, '#dee2e6')], '40%', '35%', '70%') +
    lin('leg', [(0, '#69db7c'), (1, '#2b8a3e')]),
    '''
<ellipse cx="48" cy="79" rx="38" ry="3.5" fill="#000" fill-opacity=".22"/>
<ellipse cx="22" cy="72" rx="12.5" ry="6.5" fill="url(#leg)"/>
<ellipse cx="74" cy="72" rx="12.5" ry="6.5" fill="url(#leg)"/>
<ellipse cx="48" cy="55" rx="30.5" ry="20.5" fill="url(#body)"/>
<ellipse cx="48" cy="62" rx="18.5" ry="11" fill="url(#belly)"/>
<circle cx="34" cy="31" r="11.5" fill="url(#body)"/>
<circle cx="62" cy="31" r="11.5" fill="url(#body)"/>
<circle cx="34" cy="31" r="7.2" fill="url(#eye)"/>
<circle cx="62" cy="31" r="7.2" fill="url(#eye)"/>
<circle cx="36" cy="32" r="3.6" fill="#212529"/><circle cx="64" cy="32" r="3.6" fill="#212529"/>
<circle cx="37.2" cy="30.6" r="1.2" fill="#fff"/><circle cx="65.2" cy="30.6" r="1.2" fill="#fff"/>
<path d="M36 49 Q48 57.5 60 49" stroke="#2b8a3e" stroke-width="2.6" fill="none" stroke-linecap="round"/>
<g fill="#ff8fa3" fill-opacity=".55"><circle cx="28" cy="47" r="3.8"/><circle cx="68" cy="47" r="3.8"/></g>
<ellipse cx="32" cy="45" rx="7" ry="3.5" transform="rotate(-25 32 45)" fill="#fff" fill-opacity=".3"/>
<ellipse cx="30" cy="25" rx="3" ry="1.8" transform="rotate(-30 30 25)" fill="#fff" fill-opacity=".45"/>
'''))

# =====================================================================
# 1 АПРЕЛЯ
# =====================================================================

def pupil(cx):
    return (f'<g><animateTransform attributeName="transform" type="translate" values="0 0;-8 -7;4 1;0 0" '
            f'dur="2.4s" repeatCount="indefinite"/><circle cx="{cx}" cy="24" r="8" fill="#212529"/>'
            f'<circle cx="{cx - 2.5}" cy="21" r="2.3" fill="#fff"/></g>')


write('april1', 'eyes.svg', svg(80, 40,
    rad('w', [(0, '#ffffff'), (.75, '#f8f9fa'), (1, '#ced4da')], '40%', '35%', '70%'),
    f'''
<circle cx="20" cy="20" r="17" fill="url(#w)" stroke="#212529" stroke-width="2"/>
<circle cx="60" cy="20" r="17" fill="url(#w)" stroke="#212529" stroke-width="2"/>
{pupil(22)}
{pupil(62)}
<ellipse cx="13" cy="11" rx="4" ry="2.5" transform="rotate(-30 13 11)" fill="#fff" fill-opacity=".9"/>
<ellipse cx="53" cy="11" rx="4" ry="2.5" transform="rotate(-30 53 11)" fill="#fff" fill-opacity=".9"/>
'''))

write('april1', 'nose-glasses.svg', svg(120, 62,
    rad('lens', [(0, '#ffffff', .5), (1, '#a5d8ff', .25)], '35%', '30%', '75%') +
    rad('nose', [(0, '#ffe3e3'), (.6, '#ff8787'), (1, '#e03131')], '35%', '30%', '75%') +
    lin('mus', [(0, '#495057'), (1, '#16191c')]),
    '''
<g stroke="#f8f9fa" stroke-opacity=".4" fill="none" stroke-linecap="round">
  <path d="M22 13 Q36 3 52 11 M68 11 Q84 3 98 13" stroke-width="9"/>
  <circle cx="38" cy="26" r="14" stroke-width="8"/><circle cx="82" cy="26" r="14" stroke-width="8"/>
  <path d="M52 24 Q60 19 68 24" stroke-width="8"/>
  <path d="M38 55 Q49 45 60 51.5 Q71 45 82 55 Q71 60 60 56 Q49 60 38 55 Z" stroke-width="4"/>
</g>
<path d="M22 13 Q36 3 52 11 M68 11 Q84 3 98 13" stroke="#212529" stroke-width="5" fill="none" stroke-linecap="round"/>
<circle cx="38" cy="26" r="14" fill="url(#lens)" stroke="#212529" stroke-width="4"/>
<circle cx="82" cy="26" r="14" fill="url(#lens)" stroke="#212529" stroke-width="4"/>
<path d="M29 19 Q33 15 38 15 M73 19 Q77 15 82 15" stroke="#fff" stroke-opacity=".8" stroke-width="2" fill="none" stroke-linecap="round"/>
<path d="M52 24 Q60 19 68 24" stroke="#212529" stroke-width="4" fill="none"/>
<ellipse cx="60" cy="40" rx="9.5" ry="10.5" fill="url(#nose)"/>
<ellipse cx="57" cy="36" rx="2.6" ry="3.6" fill="#fff" fill-opacity=".7"/>
<path d="M38 55 Q49 45 60 51.5 Q71 45 82 55 Q71 60 60 56 Q49 60 38 55 Z" fill="url(#mus)"/>
<path d="M45 52 Q52 49 58 52" stroke="#868e96" stroke-opacity=".6" stroke-width="1.2" fill="none" stroke-linecap="round"/>
'''))

write('april1', 'duck.svg', svg(86, 78,
    rad('body', [(0, '#fff9db'), (.55, '#ffd43b'), (1, '#f08c00')], '40%', '30%', '75%') +
    lin('beak', [(0, '#ffc078'), (1, '#f76707')]) +
    lin('wing', [(0, '#ffe066'), (1, '#f59f00')], 0, 0, 1, 1),
    '''
<ellipse cx="40" cy="73" rx="32" ry="3.5" fill="#000" fill-opacity=".22"/>
<path d="M10 47 Q2 38 4 33 Q12 37 18 41 Z" fill="url(#body)"/>
<ellipse cx="39" cy="51" rx="29" ry="18" fill="url(#body)"/>
<circle cx="55" cy="27" r="15.5" fill="url(#body)"/>
<path d="M67 25 Q76 26 82 30 Q76 34 67 35 Z" fill="url(#beak)"/>
<path d="M68 30 Q75 30.5 81 30" stroke="#d9480f" stroke-opacity=".5" stroke-width="1" fill="none"/>
<circle cx="59" cy="23" r="3.1" fill="#212529"/><circle cx="59.9" cy="22.1" r="1" fill="#fff"/>
<circle cx="63" cy="31" r="3" fill="#ff8787" fill-opacity=".45"/>
<path d="M24 45 Q36 36 46 49 Q34 56 24 45 Z" fill="url(#wing)"/>
<ellipse cx="48" cy="20" rx="3" ry="5" fill="#fff" fill-opacity=".55"/>
<ellipse cx="28" cy="46" rx="9" ry="4" transform="rotate(-20 28 46)" fill="#fff" fill-opacity=".3"/>
'''))
for n in ('confetti1.svg', 'confetti2.svg', 'confetti3.svg'):
    copy('newyear', n, 'april1')

# =====================================================================
# ДЕНЬ КОСМОНАВТИКИ
# =====================================================================

write('cosmonautics', 'helmet.svg', svg(120, 120,
    rad('glass', [(0, '#d6f0ff', .06), (.7, '#7cc4ff', .16), (1, '#3b82f6', .5)], '38%', '32%', '72%') +
    lin('rim', [(0, '#ffffff'), (1, '#adb5bd')], 0, 0, 1, 1) +
    lin('collar', [(0, '#f8f9fa'), (.6, '#ced4da'), (1, '#868e96')]) +
    rad('ball', [(0, '#ffc9c9'), (.6, '#fa5252'), (1, '#a61e1e')], '35%', '30%', '75%'),
    '''
<path d="M84 18 L94 6" stroke="#dee2e6" stroke-width="3" stroke-linecap="round"/>
<circle cx="95" cy="5" r="5" fill="url(#ball)"/>
<circle cx="60" cy="58" r="48" fill="url(#glass)" stroke="url(#rim)" stroke-width="5.5"/>
<path d="M27 46 A35 35 0 0 1 49 21" stroke="#fff" stroke-opacity=".8" stroke-width="5" fill="none" stroke-linecap="round"/>
<path d="M85 78 A30 30 0 0 1 72 88" stroke="#fff" stroke-opacity=".35" stroke-width="3" fill="none" stroke-linecap="round"/>
<circle cx="25" cy="56" r="3" fill="#fff" fill-opacity=".7"/>
<rect x="18" y="92" width="84" height="22" rx="11" fill="url(#collar)"/>
<path d="M26 97 H60" stroke="#fff" stroke-opacity=".7" stroke-width="2" stroke-linecap="round"/>
<g><circle cx="44" cy="104" r="7" fill="#ff6b6b" fill-opacity=".25"/><circle cx="44" cy="104" r="4" fill="#ff6b6b"/></g>
<g><circle cx="60" cy="104" r="7" fill="#51cf66" fill-opacity=".25"/><circle cx="60" cy="104" r="4" fill="#51cf66"/></g>
<g><circle cx="76" cy="104" r="7" fill="#4dabf7" fill-opacity=".25"/><circle cx="76" cy="104" r="4" fill="#4dabf7"/></g>
<g fill="#fff" fill-opacity=".8"><circle cx="43" cy="103" r="1.2"/><circle cx="59" cy="103" r="1.2"/><circle cx="75" cy="103" r="1.2"/></g>
'''))

write('cosmonautics', 'rocket.svg', svg(64, 130,
    lin('body', [(0, '#adb5bd'), (.3, '#ffffff'), (.65, '#e9ecef'), (1, '#9aa5b1')], 0, 0, 1, 0) +
    lin('red', [(0, '#ff8787'), (.5, '#fa5252'), (1, '#a61e1e')], 0, 0, 1, 0) +
    lin('fin', [(0, '#ff6b6b'), (1, '#a61e1e')], 0, 0, 1, 1) +
    rad('win', [(0, '#e7f5ff'), (.5, '#4dabf7'), (1, '#1864ab')], '38%', '35%', '70%') +
    lin('noz', [(0, '#868e96'), (.4, '#dee2e6'), (1, '#495057')], 0, 0, 1, 0) +
    lin('flame', [(0, '#fff3bf'), (.35, '#ffd43b'), (.75, '#ff922b'), (1, '#f03e3e', 0)]),
    '''
<path d="M20 95 Q32 134 44 95 Z" fill="url(#flame)"/>
<path d="M26 95 Q32 118 38 95 Z" fill="#fff9db"/>
<path d="M19 64 L4 98 L22 91 Z" fill="url(#fin)"/>
<path d="M45 64 L60 98 L42 91 Z" fill="url(#fin)"/>
<path d="M32 4 C48 20 50 52 46 92 L18 92 C14 52 16 20 32 4 Z" fill="url(#body)"/>
<path d="M32 4 C40 12 44 21 45.5 30 L18.5 30 C20 21 24 12 32 4 Z" fill="url(#red)"/>
<path d="M18.5 30 H45.5" stroke="#a61e1e" stroke-opacity=".35" stroke-width="1.5"/>
<circle cx="32" cy="52" r="10" fill="url(#noz)"/>
<circle cx="32" cy="52" r="7.2" fill="url(#win)"/>
<ellipse cx="29.5" cy="49" rx="2.6" ry="1.8" transform="rotate(-35 29.5 49)" fill="#fff" fill-opacity=".9"/>
<rect x="29.5" y="72" width="5" height="20" rx="2.5" fill="url(#red)"/>
<rect x="20" y="90" width="24" height="8" rx="2.5" fill="url(#noz)"/>
<path d="M24 36 Q22 60 23 86" stroke="#fff" stroke-opacity=".7" stroke-width="2.4" fill="none" stroke-linecap="round"/>
'''))

write('cosmonautics', 'star1.svg', svg(48, 48,
    rad('g', [(0, '#fff9db'), (.5, '#ffd43b'), (1, '#f08c00')], '40%', '35%', '70%'),
    f'''
<path d="{STAR}" fill="url(#g)" stroke="url(#g)" stroke-width="3" stroke-linejoin="round"/>
<ellipse cx="19" cy="19" rx="3.4" ry="2.2" transform="rotate(-35 19 19)" fill="#fff" fill-opacity=".85"/>
'''))

write('cosmonautics', 'star2.svg', svg(48, 48,
    rad('glow', [(0, '#ffffff', .9), (.4, '#c5f6fa', .35), (1, '#c5f6fa', 0)], '50%', '50%', '50%') +
    rad('g', [(0, '#ffffff'), (1, '#66d9e8')], '50%', '50%', '55%'),
    '''
<circle cx="24" cy="24" r="22" fill="url(#glow)"/>
<path d="M24 3 C26 16 32 22 45 24 C32 26 26 32 24 45 C22 32 16 26 3 24 C16 22 22 16 24 3 Z" fill="url(#g)"/>
<circle cx="24" cy="24" r="3.6" fill="#fff"/>
'''))

write('cosmonautics', 'planet.svg', svg(64, 64,
    rad('p', [(0, '#e5dbff'), (.55, '#9775fa'), (1, '#5f3dc4')], '38%', '32%', '72%') +
    lin('ring', [(0, '#fff4e6'), (.5, '#ffc078'), (1, '#e8590c')], 0, 0, 1, 0),
    '''
<ellipse cx="32" cy="34" rx="28" ry="8" transform="rotate(-20 32 32)" fill="none" stroke="url(#ring)" stroke-width="4.2"/>
<circle cx="32" cy="32" r="16.5" fill="url(#p)"/>
<path d="M17.5 26 Q32 21.5 46.5 27" stroke="#b197fc" stroke-opacity=".7" stroke-width="3" fill="none" stroke-linecap="round"/>
<path d="M16.5 36.5 Q32 33 47.5 38" stroke="#4c2ec4" stroke-opacity=".35" stroke-width="3" fill="none" stroke-linecap="round"/>
<ellipse cx="26" cy="24" rx="4.5" ry="2.8" transform="rotate(-30 26 24)" fill="#fff" fill-opacity=".55"/>
<path d="M4 34 A28 8 0 0 0 60 34" transform="rotate(-20 32 32)" fill="none" stroke="url(#ring)" stroke-width="4.2"/>
'''))

write('cosmonautics', 'alien.svg', svg(96, 76,
    lin('saucer', [(0, '#f1f3f5'), (.45, '#ced4da'), (1, '#6c757d')]) +
    lin('band', [(0, '#ffffff'), (1, '#adb5bd')]) +
    rad('glass', [(0, '#ffffff', .65), (.7, '#a5d8ff', .35), (1, '#4dabf7', .55)], '38%', '30%', '75%') +
    rad('head', [(0, '#d3f9d8'), (.55, '#69db7c'), (1, '#2b8a3e')], '40%', '30%', '75%'),
    '''
<ellipse cx="48" cy="71" rx="30" ry="3" fill="#000" fill-opacity=".2"/>
<path d="M30 55 L22 66 M66 55 L74 66" stroke="#fff3bf" stroke-opacity=".45" stroke-width="3" stroke-linecap="round"/>
<ellipse cx="48" cy="54" rx="16" ry="4.8" fill="#868e96"/>
<ellipse cx="48" cy="42" rx="44" ry="12.5" fill="url(#saucer)"/>
<ellipse cx="48" cy="37" rx="30" ry="6.2" fill="url(#band)"/>
<ellipse cx="48" cy="26" rx="9.5" ry="10.5" fill="url(#head)"/>
<ellipse cx="44.5" cy="25" rx="2.7" ry="3.8" fill="#212529"/><ellipse cx="51.5" cy="25" rx="2.7" ry="3.8" fill="#212529"/>
<circle cx="45.2" cy="23.6" r=".9" fill="#fff"/><circle cx="52.2" cy="23.6" r=".9" fill="#fff"/>
<path d="M45 31 Q48 33.5 51 31" stroke="#2b8a3e" stroke-width="1.6" fill="none" stroke-linecap="round"/>
<path d="M28 37 A20 21 0 0 1 68 37 Z" fill="url(#glass)"/>
<path d="M34 28 A15 15 0 0 1 43 19" stroke="#fff" stroke-opacity=".85" stroke-width="2.5" fill="none" stroke-linecap="round"/>
<path d="M10 40 Q30 34 48 33.5" stroke="#fff" stroke-opacity=".6" stroke-width="1.6" fill="none" stroke-linecap="round"/>
<g><circle cx="16" cy="44" r="6" fill="#ffd43b" fill-opacity=".25"/><circle cx="16" cy="44" r="3.4" fill="#ffd43b"/></g>
<g><circle cx="32" cy="47.5" r="6" fill="#ff8787" fill-opacity=".25"/><circle cx="32" cy="47.5" r="3.4" fill="#ff8787"/></g>
<g><circle cx="48" cy="48.5" r="6" fill="#ffd43b" fill-opacity=".25"/><circle cx="48" cy="48.5" r="3.4" fill="#ffd43b"/></g>
<g><circle cx="64" cy="47.5" r="6" fill="#ff8787" fill-opacity=".25"/><circle cx="64" cy="47.5" r="3.4" fill="#ff8787"/></g>
<g><circle cx="80" cy="44" r="6" fill="#ffd43b" fill-opacity=".25"/><circle cx="80" cy="44" r="3.4" fill="#ffd43b"/></g>
'''))

# =====================================================================
# ЛЕТО: ПЛЯЖ
# =====================================================================

write('summer', 'sunglasses.svg', svg(120, 50,
    lin('lens', [(0, '#38d9a9'), (.5, '#20c997'), (1, '#1c7ed6')], 0, 0, 1, 1),
    '''
<path d="M10 16 H110" stroke="#212529" stroke-width="5" stroke-linecap="round"/>
<path d="M18 16 H54 V26 C54 42 20 42 18 26 Z" fill="url(#lens)" stroke="#212529" stroke-width="3" stroke-linejoin="round"/>
<path d="M66 16 H102 V26 C100 42 66 42 66 26 Z" fill="url(#lens)" stroke="#212529" stroke-width="3" stroke-linejoin="round"/>
<path d="M24 21 L32 21 M24 26 L28 26 M72 21 L80 21 M72 26 L76 26" stroke="#fff" stroke-opacity=".75" stroke-width="2.6" stroke-linecap="round"/>
<path d="M12 14.5 H50" stroke="#495057" stroke-width="1.4" stroke-linecap="round"/>
'''))

write('summer', 'beachball.svg', svg(64, 64,
    rad('shade', [(0, '#ffffff', 0), (.6, '#000000', 0), (1, '#000000', .28)], '38%', '32%', '70%'),
    '''
<circle cx="32" cy="32" r="28" fill="#fff"/>
<path d="M32 32 L32 4 A28 28 0 0 1 56.25 18 Z" fill="#fa5252"/>
<path d="M32 32 L56.25 46 A28 28 0 0 1 32 60 Z" fill="#339af0"/>
<path d="M32 32 L7.75 46 A28 28 0 0 1 7.75 18 Z" fill="#fcc419"/>
<circle cx="32" cy="32" r="28" fill="url(#shade)"/>
<circle cx="32" cy="32" r="5" fill="#fff"/>
<path d="M14 21 A21 21 0 0 1 26 10.5" stroke="#fff" stroke-opacity=".85" stroke-width="4.5" fill="none" stroke-linecap="round"/>
<circle cx="13" cy="28" r="1.8" fill="#fff" fill-opacity=".7"/>
'''))

write('summer', 'bubble.svg', svg(48, 48,
    rad('g', [(0, '#ffffff', 0), (.7, '#a5d8ff', .12), (1, '#a5d8ff', .45)], '50%', '50%', '50%'),
    '''
<circle cx="24" cy="24" r="18" fill="url(#g)" stroke="#e7f5ff" stroke-opacity=".9" stroke-width="1.6"/>
<path d="M34 34 A14 14 0 0 1 24 38" stroke="#fcc2d7" stroke-opacity=".8" stroke-width="2" fill="none" stroke-linecap="round"/>
<path d="M38 22 A14 14 0 0 1 36 30" stroke="#96f2d7" stroke-opacity=".8" stroke-width="2" fill="none" stroke-linecap="round"/>
<path d="M13.5 18 A12 12 0 0 1 21.5 10.5" stroke="#fff" stroke-width="3" fill="none" stroke-linecap="round"/>
<circle cx="13" cy="24" r="1.4" fill="#fff"/>
'''))

write('summer', 'sun.svg', svg(48, 48,
    rad('core', [(0, '#fff9db'), (.55, '#ffd43b'), (1, '#f59f00')], '40%', '35%', '70%'),
    '''
<g stroke="#fab005" stroke-width="3.4" stroke-linecap="round">
  <path d="M24 3.5 V10 M24 38 V44.5 M3.5 24 H10 M38 24 H44.5 M9.5 9.5 L14 14 M34 34 L38.5 38.5 M38.5 9.5 L34 14 M9.5 38.5 L14 34"/>
</g>
<circle cx="24" cy="24" r="10" fill="url(#core)"/>
<ellipse cx="20.5" cy="20" rx="3" ry="2" transform="rotate(-35 20.5 20)" fill="#fff" fill-opacity=".8"/>
'''))

write('summer', 'crab.svg', svg(104, 76,
    rad('body', [(0, '#ffc9c9'), (.5, '#fa5252'), (1, '#a61e1e')], '40%', '30%', '75%') +
    rad('claw', [(0, '#ffa8a8'), (1, '#c92a2a')], '35%', '30%', '75%') +
    rad('eye', [(0, '#ffffff'), (1, '#dee2e6')], '40%', '35%', '70%'),
    '''
<ellipse cx="52" cy="71" rx="36" ry="3.5" fill="#000" fill-opacity=".22"/>
<path d="M30 50 L16 58 M32 56 L20 66 M74 50 L88 58 M72 56 L84 66" stroke="#c92a2a" stroke-width="3.4" stroke-linecap="round"/>
<path d="M32 40 L18 28 M72 40 L86 28" stroke="#e03131" stroke-width="4.2" stroke-linecap="round"/>
<ellipse cx="13" cy="21" rx="7.5" ry="5" transform="rotate(-30 13 21)" fill="url(#claw)"/>
<ellipse cx="16" cy="30" rx="7.5" ry="5" transform="rotate(20 16 30)" fill="url(#claw)"/>
<ellipse cx="91" cy="21" rx="7.5" ry="5" transform="rotate(30 91 21)" fill="url(#claw)"/>
<ellipse cx="88" cy="30" rx="7.5" ry="5" transform="rotate(-20 88 30)" fill="url(#claw)"/>
<path d="M44 34 L42 21 M60 34 L62 21" stroke="#e03131" stroke-width="3.2" stroke-linecap="round"/>
<ellipse cx="52" cy="46" rx="27" ry="16.5" fill="url(#body)"/>
<ellipse cx="42" cy="40" rx="8" ry="3.5" transform="rotate(-15 42 40)" fill="#fff" fill-opacity=".35"/>
<circle cx="42" cy="18" r="5.5" fill="url(#eye)"/><circle cx="62" cy="18" r="5.5" fill="url(#eye)"/>
<circle cx="43" cy="18.5" r="2.6" fill="#212529"/><circle cx="63" cy="18.5" r="2.6" fill="#212529"/>
<circle cx="43.8" cy="17.6" r=".9" fill="#fff"/><circle cx="63.8" cy="17.6" r=".9" fill="#fff"/>
<path d="M46 50.5 Q52 55 58 50.5" stroke="#8f1d1d" stroke-width="2" fill="none" stroke-linecap="round"/>
<g fill="#ffc9c9" fill-opacity=".6"><circle cx="38" cy="50" r="3"/><circle cx="66" cy="50" r="3"/></g>
'''))

# =====================================================================
# 1 ИЮНЯ: ШАРИКИ
# =====================================================================

write('june1', 'partyhat.svg', svg(120, 120,
    lin('cone', [(0, '#a5d8ff'), (.45, '#4dabf7'), (1, '#1864ab')], 0, 0, 1, 0) +
    rad('dot', [(0, '#fff9db'), (1, '#f59f00')], '40%', '35%', '70%') +
    lin('brim', [(0, '#74c0fc'), (1, '#1864ab')]) +
    rad('pom', [(0, '#ffe3e3'), (.6, '#ff6b6b'), (1, '#c92a2a')], '40%', '35%', '70%'),
    '''
<path d="M42 46 L60 6 L78 46 Z" fill="url(#cone)"/>
<path d="M50 30 L58.5 11" stroke="#fff" stroke-opacity=".55" stroke-width="2.6" stroke-linecap="round"/>
<g fill="url(#dot)"><circle cx="56" cy="24" r="3.2"/><circle cx="65" cy="33" r="3.2"/><circle cx="53" cy="39" r="3.2"/><circle cx="69" cy="42" r="3.2"/></g>
<ellipse cx="60" cy="46" rx="19.5" ry="4.8" fill="url(#brim)"/>
<g fill="url(#pom)"><circle cx="60" cy="6" r="6.5"/><circle cx="55" cy="4" r="3.2"/><circle cx="65" cy="4" r="3.2"/><circle cx="60" cy="1.5" r="3"/></g>
'''))

for name, l, m, d in (('red', '#ffc9c9', '#fa5252', '#a61e1e'), ('blue', '#d0ebff', '#4dabf7', '#1864ab'),
                      ('yellow', '#fff9db', '#fcc419', '#d9480f'), ('green', '#d3f9d8', '#51cf66', '#2b8a3e')):
    write('june1', f'balloon-{name}.svg', svg(48, 82,
        rad('g', [(0, l), (.5, m), (1, d)], '36%', '30%', '75%'),
        f'''
<path d="M24 52 Q18 61 24 69 T24 82" stroke="#dee2e6" stroke-width="1.5" fill="none"/>
<path d="M20.5 47 L24 53 L27.5 47 Z" fill="{d}"/>
<path d="M24 4 C35 4 42 13 42 25 C42 38 32 48 24 48 C16 48 6 38 6 25 C6 13 13 4 24 4 Z" fill="url(#g)"/>
<ellipse cx="16.5" cy="17" rx="4.2" ry="7.5" transform="rotate(20 16.5 17)" fill="#fff" fill-opacity=".55"/>
<circle cx="21" cy="29" r="1.6" fill="#fff" fill-opacity=".45"/>
'''))

write('june1', 'kite.svg', svg(80, 112,
    lin('a', [(0, '#ffdeeb'), (1, '#e64980')], 0, 0, 1, 1) +
    lin('b', [(0, '#e5dbff'), (1, '#9c36b5')], 0, 0, 1, 1) +
    rad('bowy', [(0, '#fff9db'), (1, '#f59f00')], '40%', '35%', '70%') +
    rad('bowb', [(0, '#d0ebff'), (1, '#1c7ed6')], '40%', '35%', '70%'),
    '''
<path d="M40 74 Q30 86 42 94 T38 112" stroke="#adb5bd" stroke-width="2" fill="none"/>
<path d="M33 84 L39 87 L33 90 Z M45 84 L39 87 L45 90 Z" fill="url(#bowy)"/>
<path d="M34 98 L40 101 L34 104 Z M46 98 L40 101 L46 104 Z" fill="url(#bowb)"/>
<path d="M40 4 L14 36 L40 36 Z M40 36 L66 36 L40 74 Z" fill="url(#a)"/>
<path d="M40 4 L66 36 L40 36 Z M40 36 L14 36 L40 74 Z" fill="url(#b)"/>
<path d="M40 4 V74 M14 36 H66" stroke="#fff" stroke-opacity=".75" stroke-width="2"/>
<path d="M38 10 L20 32" stroke="#fff" stroke-opacity=".55" stroke-width="2.4" stroke-linecap="round"/>
'''))
for n in ('confetti1.svg', 'confetti3.svg'):
    copy('newyear', n, 'june1')

# =====================================================================
# ДЕНЬ СБЕРЕЖЕНИЙ
# =====================================================================

write('savings', 'coin.svg', svg(48, 48,
    rad('face', [(0, '#fff9db'), (.5, '#fcc419'), (1, '#e67700')], '38%', '32%', '72%') +
    lin('rim', [(0, '#ffe066'), (1, '#c25e00')], 0, 0, 1, 1),
    '''
<circle cx="24" cy="24" r="20" fill="url(#face)" stroke="url(#rim)" stroke-width="3"/>
<circle cx="24" cy="24" r="14" fill="none" stroke="#fff3bf" stroke-opacity=".7" stroke-width="1.6"/>
<path d="M21 15 V34 M21 15 H26 A5.5 5.5 0 0 1 26 26 H17 M17 30 H27" stroke="#b35900" stroke-width="3.2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
<path d="M10.5 18 A15 15 0 0 1 19 9.5" stroke="#fff" stroke-opacity=".85" stroke-width="3" fill="none" stroke-linecap="round"/>
'''))

write('savings', 'piggy.svg', svg(98, 84,
    rad('body', [(0, '#fff0f6'), (.5, '#faa2c1'), (1, '#d6336c')], '40%', '30%', '75%') +
    lin('ear', [(0, '#faa2c1'), (1, '#c2255c')], 0, 0, 1, 1) +
    rad('snout', [(0, '#ffdeeb'), (1, '#f06595')], '40%', '35%', '70%') +
    lin('leg', [(0, '#f783ac'), (1, '#c2255c')]),
    '''
<ellipse cx="48" cy="80" rx="36" ry="3.5" fill="#000" fill-opacity=".22"/>
<path d="M13 42 q-8 -4 -4 -10 q6 -2 2 6" stroke="#e64980" stroke-width="3" fill="none" stroke-linecap="round"/>
<rect x="24" y="62" width="11.5" height="14" rx="4.5" fill="url(#leg)"/>
<rect x="54" y="64" width="11.5" height="13" rx="4.5" fill="url(#leg)"/>
<path d="M30 25 L34 9 L46 22 Z M51 21 L59 7 L64 24 Z" fill="url(#ear)" stroke="url(#ear)" stroke-width="2" stroke-linejoin="round"/>
<ellipse cx="46" cy="46" rx="34.5" ry="26.5" fill="url(#body)"/>
<rect x="35" y="21.5" width="20" height="4.6" rx="2.3" fill="#a61e4d"/>
<ellipse cx="80" cy="48" rx="10.5" ry="9.5" fill="url(#snout)"/>
<ellipse cx="77" cy="47.5" rx="1.9" ry="2.6" fill="#a61e4d"/><ellipse cx="83" cy="47.5" rx="1.9" ry="2.6" fill="#a61e4d"/>
<circle cx="64" cy="36" r="3.2" fill="#212529"/><circle cx="65" cy="35" r="1" fill="#fff"/>
<circle cx="67" cy="51" r="4.2" fill="#ff8fa3" fill-opacity=".6"/>
<path d="M22 36 Q28 26 40 25" stroke="#fff" stroke-opacity=".65" stroke-width="4" fill="none" stroke-linecap="round"/>
<ellipse cx="30" cy="52" rx="8" ry="4" transform="rotate(-20 30 52)" fill="#fff" fill-opacity=".25"/>
'''))
copy('cosmonautics', 'star1.svg', 'savings', 'star.svg')

for pack in ('newyear', 'spring', 'april1', 'cosmonautics', 'summer', 'june1', 'savings'):
    d = os.path.join(B, pack)
    print(pack, sum(os.path.getsize(os.path.join(d, f)) for f in os.listdir(d)), sorted(os.listdir(d)))
