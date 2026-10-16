"""Новые паки для 10–13 лет: день рождения, 1 сентября, старт каникул. Запуск из корня репозитория:
python -I tools/gen_art_new_packs.py web/effects/doodles/packs

Стиль тот же, что у остальных паков: объём градиентами, белые блики, без текста и без фильтров.
Стикеры, которые летят по траектории fly, нарисованы носом вверх: движок поворачивает их по курсу."""
import math
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
    os.makedirs(os.path.join(B, dst_pack), exist_ok=True)
    shutil.copy(os.path.join(B, src_pack, name), os.path.join(B, dst_pack, dst_name or name))


def star(cx, cy, R, r, n=5, rot=-90):
    pts = []
    for i in range(n * 2):
        a = math.radians(rot + i * 180 / n)
        rr = R if i % 2 == 0 else r
        pts.append(f'{cx + math.cos(a) * rr:.1f} {cy + math.sin(a) * rr:.1f}')
    return 'M' + ' L'.join(pts) + ' Z'


def drips(x0, x1, top, depth, n):
    """Край глазури: волна капель от x0 до x1 под верхом top."""
    w = (x1 - x0) / n
    d = [f'M{x0} {top + 6} Q{x0} {top} {x0 + 7} {top} H{x1 - 7} Q{x1} {top} {x1} {top + 6} V{top + depth}']
    x = x1
    for i in range(n):
        mid = x - w / 2
        deep = depth + (7 if i % 2 == 0 else 3)
        d.append(f'Q{mid + w / 4:.1f} {top + deep:.1f} {mid:.1f} {top + depth:.1f}')
        d.append(f'Q{mid - w / 4:.1f} {top + depth - 4:.1f} {x - w:.1f} {top + depth:.1f}')
        x -= w
    d.append('Z')
    return ' '.join(d)


# =====================================================================
# ДЕНЬ РОЖДЕНИЯ
# =====================================================================

flames = []
candles = []
for i, (x, c1, c2) in enumerate(((44, '#a5d8ff', '#1c7ed6'), (60, '#fff3bf', '#f59f00'), (76, '#ffc9c9', '#e03131'))):
    candles.append(
        f'<rect x="{x - 3}" y="22" width="6" height="21" rx="2.5" fill="url(#cd{i})"/>'
        f'<path d="M{x - 3} 28 L{x + 3} 25 M{x - 3} 35 L{x + 3} 32" stroke="#fff" stroke-opacity=".7" stroke-width="1.6"/>')
    flames.append(
        f'<g><animate attributeName="opacity" values="1;.7;1;.85;1" dur="{0.5 + i * 0.13:.2f}s" repeatCount="indefinite"/>'
        f'<circle cx="{x}" cy="15" r="9" fill="#ffd43b" fill-opacity=".25"/>'
        f'<path d="M{x} 5 C{x + 5} 11 {x + 5.5} 17 {x} 20 C{x - 5.5} 17 {x - 5} 11 {x} 5 Z" fill="url(#flame)"/></g>')
cdefs = ''.join(lin(f'cd{i}', [(0, a), (1, b)], 0, 0, 1, 0) for i, (a, b) in enumerate(
    (('#d0ebff', '#339af0'), ('#fff9db', '#fab005'), ('#ffe3e3', '#fa5252'))))
sprinkles = ''.join(
    f'<rect x="{x}" y="{y}" width="7" height="3" rx="1.5" fill="{c}" transform="rotate({r} {x + 3.5} {y + 1.5})"/>'
    for x, y, c, r in ((28, 90, '#ffd43b', 30), (44, 95, '#4dabf7', -20), (62, 91, '#ffffff', 15),
                       (78, 96, '#69db7c', -35), (90, 89, '#ffd43b', 20), (36, 99, '#ffffff', -10)))
write('birthday', 'cake.svg', svg(120, 120,
    lin('t1', [(0, '#ffdeeb'), (.5, '#f783ac'), (1, '#c2255c')], 0, 0, 1, 1) +
    lin('t2', [(0, '#c3fae8'), (.5, '#38d9a9'), (1, '#087f5b')], 0, 0, 1, 1) +
    lin('cream', [(0, '#ffffff'), (1, '#fff0f6')]) +
    lin('plate', [(0, '#f8f9fa'), (1, '#adb5bd')]) +
    rad('flame', [(0, '#fffbe6'), (.45, '#ffd43b'), (1, '#fd7e14')], '50%', '65%', '70%') + cdefs,
    f'''
<ellipse cx="60" cy="112" rx="46" ry="5" fill="#000" fill-opacity=".22"/>
<ellipse cx="60" cy="105" rx="48" ry="8" fill="url(#plate)"/>
<rect x="18" y="68" width="84" height="37" rx="9" fill="url(#t1)"/>
<path d="M84 68 H93 Q102 68 102 77 V96 Q102 105 93 105 H84 Z" fill="#a61e4d" fill-opacity=".22"/>
{sprinkles}
<path d="{drips(18, 102, 66, 10, 7)}" fill="url(#cream)"/>
<rect x="32" y="42" width="56" height="28" rx="7" fill="url(#t2)"/>
<path d="M76 42 H81 Q88 42 88 49 V63 Q88 70 81 70 H76 Z" fill="#064e3b" fill-opacity=".2"/>
<path d="{drips(32, 88, 40, 8, 5)}" fill="url(#cream)"/>
<path d="M24 80 Q24 74 30 74" stroke="#fff" stroke-opacity=".6" stroke-width="3" fill="none" stroke-linecap="round"/>
<path d="M37 54 Q37 50 41 50" stroke="#fff" stroke-opacity=".6" stroke-width="2.6" fill="none" stroke-linecap="round"/>
{''.join(candles)}
{''.join(flames)}
'''))

lens_l = star(36, 60, 24, 11)
lens_r = star(84, 60, 24, 11)
write('birthday', 'starglasses.svg', svg(120, 120,
    rad('lens', [(0, '#ffdeeb'), (.45, '#f06595'), (1, '#862e9c')], '35%', '30%', '80%') +
    lin('frame', [(0, '#fff3bf'), (1, '#f59f00')], 0, 0, 1, 1),
    f'''
<path d="M14 52 L4 48 M106 52 L116 48" stroke="#f8f9fa" stroke-opacity=".4" stroke-width="6" stroke-linecap="round"/>
<path d="M14 52 L4 48 M106 52 L116 48" stroke="#fab005" stroke-width="3.5" stroke-linecap="round"/>
<path d="M55 55 Q60 49 65 55" fill="none" stroke="#fab005" stroke-width="4" stroke-linecap="round"/>
<g stroke="url(#frame)" stroke-width="4" stroke-linejoin="round" fill="url(#lens)">
<path d="{lens_l}"/><path d="{lens_r}"/></g>
<ellipse cx="30" cy="54" rx="5" ry="2.6" fill="#fff" fill-opacity=".75" transform="rotate(-30 30 54)"/>
<ellipse cx="78" cy="54" rx="5" ry="2.6" fill="#fff" fill-opacity=".75" transform="rotate(-30 78 54)"/>
'''))

bits = ''.join(
    f'<rect x="{x}" y="{y}" width="8" height="4" rx="1.5" fill="{c}" transform="rotate({r} {x + 4} {y + 2})"/>'
    for x, y, c, r in ((14, 22, '#ffd43b', -30), (56, 14, '#4dabf7', 25), (30, 6, '#ff6b6b', 60),
                       (62, 32, '#69db7c', -15), (8, 36, '#f783ac', 40)))
write('birthday', 'popper.svg', svg(80, 124,
    lin('cone', [(0, '#d0bfff'), (.5, '#845ef7'), (1, '#5f3dc4')], 0, 0, 1, 0) +
    lin('rim', [(0, '#f3f0ff'), (1, '#b197fc')]) +
    '<clipPath id="cc"><path d="M33 118 L47 118 L66 50 L14 50 Z"/></clipPath>',
    f'''
<path d="M33 118 L47 118 L66 50 L14 50 Z" fill="url(#cone)"/>
<g clip-path="url(#cc)" stroke="#ffd43b" stroke-width="5">
<path d="M10 70 L70 58"/><path d="M10 88 L70 76"/><path d="M10 106 L70 94"/></g>
<path d="M50 52 L39 118 L47 118 L66 50 Z" fill="#3b2a8a" fill-opacity=".25"/>
<path d="M22 58 L35 112" stroke="#fff" stroke-opacity=".45" stroke-width="3" stroke-linecap="round"/>
<ellipse cx="40" cy="50" rx="26" ry="6.5" fill="url(#rim)"/>
<path d="M28 44 Q22 30 30 22 Q38 16 34 8" fill="none" stroke="#f783ac" stroke-width="3" stroke-linecap="round"/>
<path d="M52 44 Q60 32 54 24 Q48 16 56 8" fill="none" stroke="#3bc9db" stroke-width="3" stroke-linecap="round"/>
{bits}
<path d="{star(42, 26, 8, 3.5)}" fill="#ffd43b" stroke="#ffd43b" stroke-width="1.5" stroke-linejoin="round"/>
<circle cx="20" cy="12" r="3" fill="#ffffff"/><circle cx="68" cy="22" r="2.6" fill="#ffd43b"/>
'''))

rays = []
for i, c in enumerate(['#ff6b6b', '#ffd43b', '#4dabf7', '#69db7c', '#f783ac', '#ffd43b', '#3bc9db', '#ff922b']):
    a = math.radians(i * 45 - 90)
    x1, y1 = 32 + math.cos(a) * 9, 32 + math.sin(a) * 9
    x2, y2 = 32 + math.cos(a) * 24, 32 + math.sin(a) * 24
    x3, y3 = 32 + math.cos(a) * 28.5, 32 + math.sin(a) * 28.5
    rays.append(f'<path d="M{x1:.1f} {y1:.1f} L{x2:.1f} {y2:.1f}" stroke="{c}" stroke-width="3.6" stroke-linecap="round"/>'
                f'<circle cx="{x3:.1f}" cy="{y3:.1f}" r="3" fill="{c}"/>')
write('birthday', 'firework.svg', svg(64, 64,
    rad('core', [(0, '#ffffff'), (.5, '#fff3bf'), (1, '#fab005')], '45%', '40%', '60%'),
    f'''
{''.join(rays)}
<circle cx="32" cy="32" r="6" fill="url(#core)"/>
'''))

write('birthday', 'candle.svg', svg(48, 48,
    lin('cd', [(0, '#ffe3e3'), (1, '#fa5252')], 0, 0, 1, 0) +
    rad('flame', [(0, '#fffbe6'), (.45, '#ffd43b'), (1, '#fd7e14')], '50%', '65%', '70%'),
    '''
<circle cx="24" cy="14" r="11" fill="#ffd43b" fill-opacity=".25"/>
<path d="M24 3 C30 10 30.5 17 24 21 C17.5 17 18 10 24 3 Z" fill="url(#flame)"/>
<rect x="18" y="22" width="12" height="23" rx="4" fill="url(#cd)"/>
<path d="M18 29 L30 25 M18 37 L30 33" stroke="#fff" stroke-opacity=".75" stroke-width="2.2"/>
'''))

copy('june1', 'confetti1.svg', 'birthday')
copy('june1', 'confetti3.svg', 'birthday')

# =====================================================================
# 1 СЕНТЯБРЯ
# =====================================================================

grid = ''.join(f'<path d="M0 {y} H80"/>' for y in range(18, 104, 8))
write('school', 'plane.svg', svg(80, 112,
    lin('wl', [(0, '#ffffff'), (1, '#e9ecef')], 0, 0, 1, 1) +
    lin('wr', [(0, '#f1f3f5'), (1, '#ced4da')], 0, 0, 1, 1) +
    '<clipPath id="wings"><path d="M40 4 L4 96 L37 80 Z M40 4 L76 96 L43 80 Z"/></clipPath>',
    f'''
<path d="M40 4 L4 96 L37 80 Z" fill="url(#wl)"/>
<path d="M40 4 L76 96 L43 80 Z" fill="url(#wr)"/>
<g clip-path="url(#wings)" stroke="#a5d8ff" stroke-width="1.2">{grid}</g>
<path d="M24 46 L13 74" stroke="#ff8787" stroke-width="1.6" clip-path="url(#wings)"/>
<path d="M40 4 L35 100 L40 92 L45 100 Z" fill="#adb5bd"/>
<path d="M40 4 L40 92 L45 100 Z" fill="#868e96"/>
<path d="M36 18 L18 64" stroke="#fff" stroke-width="2.2" stroke-linecap="round"/>
'''))

write('school', 'pencil.svg', svg(24, 100,
    lin('body', [(0, '#fff3bf'), (.45, '#fcc419'), (1, '#e67700')], 0, 0, 1, 0) +
    lin('wood', [(0, '#ffe8cc'), (1, '#e8a87c')], 0, 0, 1, 0) +
    lin('fer', [(0, '#f1f3f5'), (1, '#868e96')], 0, 0, 1, 0) +
    lin('er', [(0, '#ffdeeb'), (1, '#e64980')], 0, 0, 1, 0),
    '''
<path d="M5 30 L19 30 L12 4 Z" fill="url(#wood)"/>
<path d="M9.8 12 L14.2 12 L12 4 Z" fill="#343a40"/>
<rect x="5" y="30" width="14" height="52" fill="url(#body)"/>
<path d="M12 30 V82" stroke="#e67700" stroke-opacity=".5" stroke-width="1.2"/>
<path d="M7.5 34 V78" stroke="#fff" stroke-opacity=".7" stroke-width="1.8" stroke-linecap="round"/>
<rect x="4.5" y="80" width="15" height="8" rx="1.5" fill="url(#fer)"/>
<rect x="5" y="88" width="14" height="10" rx="4" fill="url(#er)"/>
'''))

write('school', 'paperball.svg', svg(48, 48,
    rad('ball', [(0, '#ffffff'), (.6, '#e9ecef'), (1, '#adb5bd')], '38%', '32%', '72%'),
    '''
<circle cx="24" cy="24" r="21" fill="url(#ball)"/>
<g fill="none" stroke="#adb5bd" stroke-width="1.4" stroke-linejoin="round" stroke-linecap="round">
<path d="M8 18 L18 22 L16 32 L26 36"/><path d="M28 6 L26 16 L36 20 L42 30"/><path d="M18 22 L26 16"/><path d="M26 36 L34 40"/>
</g>
<g stroke="#a5d8ff" stroke-width="1.2"><path d="M10 28 L20 30"/><path d="M28 26 L40 24"/><path d="M22 42 L30 40"/></g>
<path d="M13 15 Q16 10 22 9" stroke="#fff" stroke-width="2.6" fill="none" stroke-linecap="round"/>
'''))

write('school', 'headphones.svg', svg(120, 120,
    lin('band', [(0, '#495057'), (1, '#212529')]) +
    lin('cup', [(0, '#96f2d7'), (.5, '#20c997'), (1, '#087f5b')], 0, 0, 1, 1) +
    lin('pad', [(0, '#495057'), (1, '#212529')], 0, 0, 1, 0),
    '''
<path d="M20 60 C20 12 100 12 100 60" fill="none" stroke="#f8f9fa" stroke-opacity=".35" stroke-width="12" stroke-linecap="round"/>
<path d="M20 60 C20 12 100 12 100 60" fill="none" stroke="#343a40" stroke-width="8" stroke-linecap="round"/>
<path d="M28 44 C32 26 46 20 60 19.5" fill="none" stroke="#63e6be" stroke-width="2.6" stroke-linecap="round"/>
<rect x="6" y="50" width="24" height="36" rx="12" fill="url(#cup)"/>
<rect x="90" y="50" width="24" height="36" rx="12" fill="url(#cup)"/>
<rect x="26" y="56" width="7" height="24" rx="3.5" fill="url(#pad)"/>
<rect x="87" y="56" width="7" height="24" rx="3.5" fill="url(#pad)"/>
<path d="M11 58 Q12 54 16 53" stroke="#fff" stroke-opacity=".7" stroke-width="2.6" fill="none" stroke-linecap="round"/>
<path d="M95 58 Q96 54 100 53" stroke="#fff" stroke-opacity=".7" stroke-width="2.6" fill="none" stroke-linecap="round"/>
<circle cx="18" cy="76" r="2.4" fill="#c3fae8"/><circle cx="102" cy="76" r="2.4" fill="#c3fae8"/>
'''))

write('school', 'pencilrocket.svg', svg(80, 150,
    lin('body', [(0, '#fff3bf'), (.45, '#fcc419'), (1, '#e67700')], 0, 0, 1, 0) +
    lin('wood', [(0, '#ffe8cc'), (1, '#e8a87c')], 0, 0, 1, 0) +
    lin('fin', [(0, '#ffc9c9'), (1, '#e03131')], 0, 0, 1, 1) +
    rad('win', [(0, '#ffffff'), (.5, '#a5d8ff'), (1, '#1c7ed6')], '35%', '30%', '75%') +
    lin('fire', [(0, '#fff9db'), (.4, '#ffa94d'), (1, '#f03e3e', 0)]),
    '''
<path d="M30 104 Q40 150 50 104 Z" fill="url(#fire)"/>
<path d="M34 104 Q40 130 46 104 Z" fill="#fff9db" fill-opacity=".8"/>
<path d="M24 76 L6 108 L24 100 Z" fill="url(#fin)"/>
<path d="M56 76 L74 108 L56 100 Z" fill="url(#fin)"/>
<path d="M24 38 L56 38 L40 4 Z" fill="url(#wood)"/>
<path d="M36 12 L44 12 L40 4 Z" fill="#343a40"/>
<rect x="24" y="38" width="32" height="66" rx="3" fill="url(#body)"/>
<path d="M40 38 V104" stroke="#e67700" stroke-opacity=".45" stroke-width="1.6"/>
<path d="M29 44 V96" stroke="#fff" stroke-opacity=".7" stroke-width="3" stroke-linecap="round"/>
<circle cx="40" cy="64" r="9.5" fill="#495057"/>
<circle cx="40" cy="64" r="7" fill="url(#win)"/>
<path d="M36 61 Q38 58 41 58" stroke="#fff" stroke-width="1.8" fill="none" stroke-linecap="round"/>
'''))

# =====================================================================
# СТАРТ КАНИКУЛ
# =====================================================================

write('vacation', 'cap.svg', svg(120, 120,
    lin('dome', [(0, '#99e9f2'), (.5, '#15aabf'), (1, '#0b7285')], 0, 0, 1, 1) +
    lin('brim', [(0, '#ffd8a8'), (1, '#f76707')], 0, 0, 1, 1),
    '''
<path d="M62 46 Q98 40 114 52 Q100 60 62 56 Z" fill="url(#brim)"/>
<path d="M62 52 Q96 50 114 52 Q100 60 62 56 Z" fill="#a33d03" fill-opacity=".25"/>
<path d="M22 54 C22 24 40 12 60 12 C82 12 98 26 98 54 Z" fill="url(#dome)"/>
<path d="M60 12 C82 12 98 26 98 54 H80 C80 34 72 18 60 12 Z" fill="#0b4f5c" fill-opacity=".22"/>
<path d="M60 12 V54" stroke="#0b7285" stroke-opacity=".5" stroke-width="1.6"/>
<path d="M30 40 Q34 24 48 18" stroke="#fff" stroke-opacity=".55" stroke-width="3.4" fill="none" stroke-linecap="round"/>
<rect x="22" y="50" width="76" height="6" rx="3" fill="#ff922b"/>
<circle cx="60" cy="12" r="4" fill="#ff922b"/>
'''))

write('vacation', 'skateboard.svg', svg(150, 60,
    lin('deck', [(0, '#d0bfff'), (.5, '#845ef7'), (1, '#5f3dc4')]) +
    rad('wheel', [(0, '#fff9db'), (.5, '#ffd43b'), (1, '#e67700')], '40%', '35%', '70%') +
    lin('truck', [(0, '#e9ecef'), (1, '#868e96')]),
    '''
<path d="M44 30 L52 38 H60 L68 30 Z M82 30 L90 38 H98 L106 30 Z" fill="url(#truck)"/>
<circle cx="50" cy="44" r="9" fill="url(#wheel)"/><circle cx="50" cy="44" r="3" fill="#e67700"/>
<circle cx="100" cy="44" r="9" fill="url(#wheel)"/><circle cx="100" cy="44" r="3" fill="#e67700"/>
<path d="M6 12 Q10 24 26 24 H124 Q140 24 144 12 Q146 8 142 9 Q136 18 124 18 H26 Q14 18 8 9 Q4 8 6 12 Z" fill="url(#deck)"/>
<path d="M40 21 Q52 15 62 21 Q72 27 84 21 Q96 15 108 21" fill="none" stroke="#ffd43b" stroke-width="3" stroke-linecap="round"/>
<path d="M20 20 H48" stroke="#fff" stroke-opacity=".55" stroke-width="2" stroke-linecap="round"/>
'''))

lines = ''.join(f'<path d="M6 {y} H42"/>' for y in range(16, 58, 7))
write('vacation', 'sheet.svg', svg(48, 62,
    lin('paper', [(0, '#ffffff'), (1, '#dee2e6')], 0, 0, 1, 1),
    f'''
<path d="M4 4 H34 L44 14 V58 H4 Z" fill="url(#paper)"/>
<g stroke="#a5d8ff" stroke-width="1.2">{lines}</g>
<path d="M12 4 V58" stroke="#ff8787" stroke-width="1.4"/>
<path d="M34 4 V14 H44 Z" fill="#ced4da"/>
<g fill="#212529" fill-opacity=".35"><circle cx="8" cy="12" r="1.6"/><circle cx="8" cy="31" r="1.6"/><circle cx="8" cy="50" r="1.6"/></g>
'''))

bows = ''.join(
    f'<path d="M{x - 6} {y - 3} L{x} {y} L{x - 6} {y + 3} Z M{x + 6} {y - 3} L{x} {y} L{x + 6} {y + 3} Z" fill="{c}"/>'
    for x, y, c in ((45, 104, '#ffd43b'), (37, 122, '#ff6b6b'), (45, 140, '#3bc9db')))
write('vacation', 'kite.svg', svg(90, 156,
    lin('k1', [(0, '#ffd8a8'), (1, '#f76707')], 0, 0, 1, 1) +
    lin('k2', [(0, '#c5f6fa'), (1, '#1098ad')], 0, 0, 1, 1),
    f'''
<path d="M45 86 Q30 100 45 110 T40 132 T46 154" stroke="#f8f9fa" stroke-opacity=".8" stroke-width="2" fill="none"/>
{bows}
<path d="M45 4 L10 40 L45 40 Z M45 40 L80 40 L45 86 Z" fill="url(#k1)"/>
<path d="M45 4 L80 40 L45 40 Z M45 40 L10 40 L45 86 Z" fill="url(#k2)"/>
<path d="M45 4 V86 M10 40 H80" stroke="#fff" stroke-opacity=".8" stroke-width="2"/>
<path d="M42 11 L18 37" stroke="#fff" stroke-opacity=".6" stroke-width="2.6" stroke-linecap="round"/>
'''))

write('vacation', 'icecream.svg', svg(48, 80,
    lin('cone', [(0, '#ffe8cc'), (.5, '#ffa94d'), (1, '#d9480f')], 0, 0, 1, 0) +
    rad('s1', [(0, '#fff0f6'), (.55, '#f783ac'), (1, '#c2255c')], '38%', '30%', '75%') +
    rad('s2', [(0, '#e6fcf5'), (.55, '#63e6be'), (1, '#0ca678')], '38%', '30%', '75%') +
    '<clipPath id="cc"><path d="M8 38 H40 L24 78 Z"/></clipPath>',
    '''
<path d="M8 38 H40 L24 78 Z" fill="url(#cone)"/>
<g clip-path="url(#cc)" stroke="#d9480f" stroke-opacity=".6" stroke-width="1.4">
<path d="M4 44 L36 76"/><path d="M14 38 L44 68"/><path d="M44 44 L12 76"/><path d="M34 38 L4 68"/></g>
<circle cx="24" cy="34" r="13" fill="url(#s2)"/>
<circle cx="24" cy="18" r="12" fill="url(#s1)"/>
<path d="M17 13 Q19 8 25 8" stroke="#fff" stroke-width="2.4" fill="none" stroke-linecap="round"/>
<circle cx="28" cy="6" r="4" fill="#e03131"/><path d="M28 2 Q30 -2 34 -1" stroke="#2b8a3e" stroke-width="1.5" fill="none"/>
'''))

print('ok')
