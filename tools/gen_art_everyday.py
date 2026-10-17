"""Пак «обыденных» дудлов: пиксели, игры, тренды. Запуск из корня репозитория:
python -I tools/gen_art_everyday.py web/effects/doodles/packs

Пиксельные модельки собираются из сетки символов (одна буква — один цвет), глянцевые — градиентами,
как остальные паки. Текста нет: цифры 6 и 7 нарисованы контурами."""
import math
import os
import sys

B = sys.argv[1]
PACK = 'everyday'
NS = 'xmlns="http://www.w3.org/2000/svg"'


def svg(w, h, defs, body, crisp=False):
    extra = ' shape-rendering="crispEdges"' if crisp else ''
    return (f'<svg {NS} width="{w}" height="{h}" viewBox="0 0 {w} {h}"{extra}>\n'
            f'<defs>{defs.strip()}</defs>\n{body.strip()}\n</svg>\n')


def _stops(stops):
    out = []
    for s in stops:
        op = f' stop-opacity="{s[2]}"' if len(s) > 2 else ''
        out.append(f'<stop offset="{s[0]}" stop-color="{s[1]}"{op}/>')
    return ''.join(out)


def lin(gid, stops, x1=0, y1=0, x2=0, y2=1):
    return f'<linearGradient id="{gid}" x1="{x1}" y1="{y1}" x2="{x2}" y2="{y2}">{_stops(stops)}</linearGradient>'


def rad(gid, stops, cx='38%', cy='32%', r='70%'):
    return f'<radialGradient id="{gid}" cx="{cx}" cy="{cy}" r="{r}">{_stops(stops)}</radialGradient>'


def write(name, content):
    d = os.path.join(B, PACK)
    os.makedirs(d, exist_ok=True)
    with open(os.path.join(d, name), 'w', encoding='utf-8') as f:
        f.write(content)


def pix(grid, pal, cell):
    """Сетка символов → прямоугольники; одинаковые соседи в строке сливаются."""
    out = []
    for y, row in enumerate(grid):
        x = 0
        while x < len(row):
            ch = row[x]
            if ch in '. ':
                x += 1
                continue
            x2 = x
            while x2 < len(row) and row[x2] == ch:
                x2 += 1
            out.append(f'<rect x="{x * cell}" y="{y * cell}" width="{(x2 - x) * cell}" height="{cell}" fill="{pal[ch]}"/>')
            x = x2
    return ''.join(out)


def pix_svg(name, grid, pal, cell):
    write(name, svg(len(grid[0]) * cell, len(grid) * cell, '', pix(grid, pal, cell), crisp=True))


def bevel_cells(cells, base, light, dark, c=10):
    out = []
    for x, y in cells:
        X, Y = x * c, y * c
        out.append(
            f'<rect x="{X}" y="{Y}" width="{c}" height="{c}" fill="{base}"/>'
            f'<path d="M{X} {Y} H{X + c} L{X + c - 2} {Y + 2} H{X + 2} V{Y + c - 2} L{X} {Y + c} Z" fill="{light}"/>'
            f'<path d="M{X + c} {Y + c} H{X} L{X + 2} {Y + c - 2} H{X + c - 2} V{Y + 2} L{X + c} {Y} Z" fill="{dark}"/>')
    return ''.join(out)


# ---------- Пиксели ----------

pix_svg('coin8.svg', [
    "....OOOO....",
    "..OOyyyyOO..",
    ".OyyWWyyyyO.",
    ".OyWWyyooyO.",
    "OyyWyyyooyyO",
    "OyyyyyyooyyO",
    "OyyyyyyooyyO",
    "OyyyyyyooyyO",
    ".OyyyyyooyO.",
    ".OyyyyyyyyO.",
    "..OOyyyyOO..",
    "....OOOO....",
], {'O': '#d9480f', 'y': '#fcc419', 'W': '#fff3bf', 'o': '#f08c00'}, 4)

pix_svg('heart8.svg', [
    ".OOO...OOO.",
    "OrrrO.OrrrO",
    "OrWrrOrrrrO",
    "OrWrrrrrrrO",
    "OrrrrrrrrrO",
    ".OrrrrrrrO.",
    "..OrrrrrO..",
    "...OrrrO...",
    "....OrO....",
    ".....O.....",
], {'O': '#a61e1e', 'r': '#fa5252', 'W': '#ffc9c9'}, 4)

pix_svg('star8.svg', [
    "...W...",
    "...W...",
    "..WYW..",
    "WWYYYWW",
    "..WYW..",
    "...W...",
    "...W...",
], {'W': '#fff9db', 'Y': '#ffd43b'}, 4)

for nm, base, light, dark in (('pixA.svg', '#f06595', '#ffdeeb', '#a61e4d'),
                              ('pixB.svg', '#22b8cf', '#c5f6fa', '#0b7285'),
                              ('pixC.svg', '#94d82d', '#e9fac8', '#5c940d')):
    write(nm, svg(10, 10, '', bevel_cells([(0, 0)], base, light, dark), crisp=True))

pix_svg('arrow8.svg', [
    "....O....",
    "...OgO...",
    "..OgWgO..",
    ".OgWgggO.",
    "OOOgggOOO",
    "..OWggO..",
    "..OWggO..",
    "..OWggO..",
    "..OgggO..",
    "..OOOOO..",
], {'O': '#2b8a3e', 'g': '#51cf66', 'W': '#b2f2bb'}, 5)

pix_svg('rocket8.svg', [
    "....O....",
    "...OwO...",
    "..OwwwO..",
    "..OwbwO..",
    "..OwbwO..",
    "..OwwwO..",
    "..OwwwO..",
    ".OrOwOrO.",
    "OrrOwOrrO",
    "OrrOOOrrO",
    "...YoY...",
    "...oYo...",
    "....Y....",
], {'O': '#343a40', 'w': '#e9ecef', 'b': '#4dabf7', 'r': '#fa5252', 'Y': '#ffd43b', 'o': '#fd7e14'}, 5)

pix_svg('ball8.svg', [
    ".OOOO.",
    "OWWwwO",
    "OWwwwO",
    "OwwwgO",
    "OwwggO",
    ".OOOO.",
], {'O': '#495057', 'W': '#ffffff', 'w': '#e9ecef', 'g': '#adb5bd'}, 5)

pix_svg('paddle8.svg', ["OO", "Oc", "Oc", "Oc", "Oc", "Oc", "Oc", "Oc", "Oc", "Oc", "Oc", "OO"],
        {'O': '#1098ad', 'c': '#66d9e8'}, 5)

# Змейка: хвост тоньше, голова с глазом и языком
snake = [['.'] * 19 for _ in range(5)]
snake[2][0] = 'G'
for y in (1, 2):
    snake[y][1] = 'G'
for x in range(2, 14):
    for y in (1, 2, 3):
        snake[y][x] = 'L' if y == 1 else ('G' if (x // 2) % 2 == 0 else 'g')
for x in range(14, 18):
    for y in range(0, 5):
        snake[y][x] = 'L' if y == 0 else 'G'
snake[1][16] = 'W'
snake[3][18] = 'R'
pix_svg('snake8.svg', [''.join(r) for r in snake], {'G': '#40c057', 'g': '#2b8a3e', 'L': '#8ce99a', 'W': '#ffffff', 'R': '#fa5252'}, 5)

# Тетрис: четыре фигуры и ряд, который «сгорает»
TET = {
    'tetT.svg': ([(0, 0), (1, 0), (2, 0), (1, 1)], '#9775fa', '#e5dbff', '#5f3dc4'),
    'tetL.svg': ([(0, 0), (0, 1), (0, 2), (1, 2)], '#ff922b', '#ffe8cc', '#d9480f'),
    'tetS.svg': ([(1, 0), (2, 0), (0, 1), (1, 1)], '#51cf66', '#d3f9d8', '#2b8a3e'),
    'tetO.svg': ([(0, 0), (1, 0), (0, 1), (1, 1)], '#fcc419', '#fff3bf', '#e67700'),
    'tetI.svg': ([(0, 0), (1, 0), (2, 0), (3, 0)], '#22b8cf', '#c5f6fa', '#0b7285'),
}
for name, (cells, base, light, dark) in TET.items():
    w = (max(x for x, _ in cells) + 1) * 10
    h = (max(y for _, y in cells) + 1) * 10
    write(name, svg(w, h, '', bevel_cells(cells, base, light, dark), crisp=True))
row_colors = [TET[k][1:] for k in ('tetT.svg', 'tetL.svg', 'tetS.svg', 'tetO.svg', 'tetI.svg')]
row = ''.join(bevel_cells([(i, 0)], *row_colors[i % 5]) for i in range(15))
write('tetrow.svg', svg(150, 10, '', row, crisp=True))

# ---------- Глянец ----------

write('gamepad.svg', svg(120, 80,
    lin('body', [(0, '#d0bfff'), (.5, '#845ef7'), (1, '#5f3dc4')], 0, 0, 0, 1) +
    rad('b1', [(0, '#fff0f6'), (1, '#f06595')], '35%', '30%', '75%') +
    rad('b2', [(0, '#e3fafc'), (1, '#22b8cf')], '35%', '30%', '75%'),
    '''
<path d="M24 14 H96 C112 14 118 30 118 46 C118 66 106 76 96 72 L84 60 H36 L24 72 C14 76 2 66 2 46 C2 30 8 14 24 14 Z" fill="url(#body)"/>
<path d="M24 14 H96 C108 14 114 22 116 32 C100 24 20 24 4 32 C6 22 12 14 24 14 Z" fill="#fff" fill-opacity=".35"/>
<path d="M22 34 h8 v-8 h8 v8 h8 v8 h-8 v8 h-8 v-8 h-8 Z" fill="#212529" fill-opacity=".8"/>
<circle cx="86" cy="32" r="7" fill="url(#b1)"/><circle cx="98" cy="44" r="7" fill="url(#b2)"/>
<rect x="52" y="30" width="16" height="5" rx="2.5" fill="#212529" fill-opacity=".5"/>
'''))

# Блочный человечек: силуэт игрового аватара из блоков, свои цвета и лицо
write('blocky.svg', svg(80, 124,
    lin('skin', [(0, '#ffe8cc'), (1, '#ffc078')], 0, 0, 1, 1) +
    lin('hood', [(0, '#b197fc'), (1, '#6741d9')], 0, 0, 1, 1) +
    lin('pants', [(0, '#ffc078'), (1, '#e8590c')], 0, 0, 1, 0) +
    lin('shoe', [(0, '#96f2d7'), (1, '#0ca678')]),
    '''
<ellipse cx="40" cy="120" rx="26" ry="3.5" fill="#000" fill-opacity=".22"/>
<rect x="20" y="4" width="40" height="34" rx="6" fill="url(#skin)"/>
<rect x="18" y="2" width="44" height="10" rx="5" fill="#212529"/>
<rect x="46" y="2" width="22" height="6" rx="3" fill="#212529"/>
<ellipse cx="32" cy="22" rx="3" ry="4" fill="#212529"/><ellipse cx="48" cy="22" rx="3" ry="4" fill="#212529"/>
<circle cx="33" cy="20.5" r="1" fill="#fff"/><circle cx="49" cy="20.5" r="1" fill="#fff"/>
<path d="M34 30 Q40 34 46 30" stroke="#212529" stroke-width="2.4" fill="none" stroke-linecap="round"/>
<rect x="18" y="40" width="44" height="36" rx="3" fill="url(#hood)"/>
<rect x="30" y="58" width="20" height="10" rx="3" fill="#5f3dc4" fill-opacity=".6"/>
<path d="M33 40 L36 52 M47 40 L44 52" stroke="#e5dbff" stroke-width="2" stroke-linecap="round"/>
<rect x="4" y="40" width="13" height="30" rx="3" fill="url(#hood)"/><rect x="63" y="40" width="13" height="30" rx="3" fill="url(#hood)"/>
<rect x="4" y="68" width="13" height="9" rx="3" fill="url(#skin)"/><rect x="63" y="68" width="13" height="9" rx="3" fill="url(#skin)"/>
<rect x="18" y="77" width="21" height="32" rx="2" fill="url(#pants)"/><rect x="41" y="77" width="21" height="32" rx="2" fill="url(#pants)"/>
<rect x="17" y="107" width="23" height="9" rx="3" fill="url(#shoe)"/><rect x="40" y="107" width="23" height="9" rx="3" fill="url(#shoe)"/>
<path d="M23 8 Q24 6 28 6" stroke="#fff" stroke-opacity=".4" stroke-width="2" fill="none" stroke-linecap="round"/>
'''))

for name, a, b, c in (('gemA.svg', '#c5f6fa', '#22b8cf', '#0b7285'),
                      ('gemB.svg', '#ffdeeb', '#f06595', '#a61e4d'),
                      ('gemC.svg', '#e9fac8', '#94d82d', '#5c940d')):
    write(name, svg(64, 60,
        lin('g', [(0, a), (.5, b), (1, c)], 0, 0, 1, 1),
        f'''
<path d="M14 4 H50 L62 20 L32 58 L2 20 Z" fill="url(#g)"/>
<path d="M14 4 L22 20 H42 L50 4 Z" fill="#fff" fill-opacity=".45"/>
<path d="M2 20 H62 M22 20 L32 58 L42 20" stroke="#fff" stroke-opacity=".55" stroke-width="1.6" fill="none"/>
<path d="M42 20 L50 4 L62 20 Z" fill="{c}" fill-opacity=".35"/>
<path d="M12 12 L16 8" stroke="#fff" stroke-width="2.4" stroke-linecap="round"/>
'''))

pips = ''.join(f'<ellipse cx="{x}" cy="{y}" rx="4.2" ry="4.2" fill="#212529"/>'
               for x, y in ((36, 50), (36, 64), (36, 78), (58, 50), (58, 64), (58, 78)))
write('dice.svg', svg(100, 100,
    lin('front', [(0, '#ffffff'), (1, '#dee2e6')], 0, 0, 1, 1) +
    lin('side', [(0, '#e9ecef'), (1, '#adb5bd')], 0, 0, 1, 0) +
    lin('top', [(0, '#ffffff'), (1, '#f1f3f5')]),
    f'''
<path d="M22 32 L44 14 H92 L70 32 Z" fill="url(#top)"/>
<path d="M70 32 L92 14 V64 L70 90 Z" fill="url(#side)"/>
<rect x="22" y="32" width="48" height="58" rx="6" fill="url(#front)"/>
{pips}
<circle cx="57" cy="23" r="4" fill="#fa5252"/>
<ellipse cx="81" cy="40" rx="3" ry="4.2" fill="#495057"/><ellipse cx="81" cy="62" rx="3" ry="4.2" fill="#495057"/>
<path d="M28 40 V60" stroke="#fff" stroke-width="3" stroke-linecap="round"/>
'''))

bubbles = []
rows = ['#fa5252', '#ff922b', '#fcc419', '#51cf66']
for j, col in enumerate(rows):
    for i in range(4):
        cx, cy = 22 + i * 19, 22 + j * 19
        bubbles.append(f'<circle cx="{cx}" cy="{cy}" r="8" fill="{col}"/>'
                       f'<circle cx="{cx}" cy="{cy}" r="8" fill="url(#dome)"/>'
                       f'<ellipse cx="{cx - 2.5}" cy="{cy - 3}" rx="2.6" ry="1.6" fill="#fff" fill-opacity=".8"/>')
write('popit.svg', svg(100, 100,
    lin('base', [(0, '#e5dbff'), (1, '#9775fa')], 0, 0, 1, 1) +
    rad('dome', [(0, '#ffffff', .45), (.6, '#ffffff', 0), (1, '#000000', .25)], '40%', '35%', '70%'),
    f'''
<rect x="4" y="4" width="92" height="92" rx="20" fill="url(#base)"/>
<path d="M14 8 H70" stroke="#fff" stroke-opacity=".6" stroke-width="3" stroke-linecap="round"/>
{''.join(bubbles)}
'''))

# Ковёр на стене: бордовый, с ромбами и бахромой. По его узору водят пальцем.
border = ''.join(f'<path d="M{x} 14 l5 -5 l5 5 l-5 5 Z M{x} 136 l5 -5 l5 5 l-5 5 Z" fill="#ffd43b"/>' for x in range(22, 196, 14))
fringe = ''.join(f'<path d="M{6 if s < 0 else 214} {y} h{8 * s}" stroke="#f8f0e3" stroke-width="2" stroke-linecap="round"/>'
                 for y in range(14, 140, 6) for s in (-1, 1))
write('carpet.svg', svg(220, 150,
    lin('wool', [(0, '#c92a2a'), (1, '#862e2e')], 0, 0, 1, 1) +
    rad('med', [(0, '#fff3bf'), (.6, '#fab005'), (1, '#e67700')], '50%', '50%', '60%'),
    f'''
{fringe}
<rect x="14" y="4" width="192" height="142" rx="4" fill="url(#wool)"/>
<rect x="22" y="22" width="176" height="106" rx="2" fill="none" stroke="#ffd43b" stroke-width="2.4"/>
{border}
<path d="M110 30 L170 75 L110 120 L50 75 Z" fill="#1c3f6e" stroke="#ffd43b" stroke-width="2.4"/>
<path d="M110 50 L144 75 L110 100 L76 75 Z" fill="url(#med)"/>
<path d="M44 52 L58 75 L44 98 L30 75 Z M176 52 L190 75 L176 98 L162 75 Z" fill="#1c3f6e" stroke="#ffd43b" stroke-width="2"/>
<circle cx="110" cy="75" r="6" fill="#c92a2a"/>
<path d="M66 40 l6 6 l-6 6 l-6 -6 Z M154 40 l6 6 l-6 6 l-6 -6 Z M66 98 l6 6 l-6 6 l-6 -6 Z M154 98 l6 6 l-6 6 l-6 -6 Z" fill="#ffd43b"/>
'''))

spokes = ''.join(
    f'<path d="M{cx} {cy} L{cx + math.cos(math.radians(a)) * 17:.1f} {cy + math.sin(math.radians(a)) * 17:.1f}" stroke="#adb5bd" stroke-width="1.4"/>'
    for cx, cy in ((26, 64), (114, 64)) for a in range(0, 360, 45))
write('bmx.svg', svg(140, 90,
    rad('tyre', [(0, '#495057'), (1, '#212529')], '50%', '50%', '50%'),
    f'''
<ellipse cx="70" cy="86" rx="56" ry="3" fill="#000" fill-opacity=".2"/>
<circle cx="26" cy="64" r="21" fill="none" stroke="#868e96" stroke-width="6"/>
<circle cx="114" cy="64" r="21" fill="none" stroke="#868e96" stroke-width="6"/>
<circle cx="26" cy="64" r="17" fill="none" stroke="#dee2e6" stroke-width="1.6"/>
<circle cx="114" cy="64" r="17" fill="none" stroke="#dee2e6" stroke-width="1.6"/>
{spokes}
<circle cx="26" cy="64" r="4" fill="#ffd43b"/><circle cx="114" cy="64" r="4" fill="#ffd43b"/>
<path d="M26 64 L56 64 L48 34 Z M56 64 L96 34 L48 34" fill="none" stroke="#fa5252" stroke-width="5" stroke-linejoin="round" stroke-linecap="round"/>
<path d="M96 34 L114 64" stroke="#fa5252" stroke-width="5" stroke-linecap="round"/>
<path d="M92 20 L98 36" stroke="#495057" stroke-width="4" stroke-linecap="round"/>
<path d="M84 18 H102" stroke="#212529" stroke-width="5" stroke-linecap="round"/>
<path d="M40 28 H56" stroke="#212529" stroke-width="6" stroke-linecap="round"/>
<path d="M48 34 L46 28" stroke="#495057" stroke-width="4"/>
<circle cx="56" cy="64" r="6" fill="#ffd43b"/>
'''))

# 67: надутые глянцевые цифры контурами (без шрифтов)
for name, d, c1, c2 in (
        ('six.svg', 'M74 22 C44 20 26 44 26 72 C26 98 42 112 60 112 C80 112 92 98 92 80 C92 62 80 50 62 50 C46 50 32 58 28 72', '#ffa94d', '#f06595'),
        ('seven.svg', 'M24 24 H94 L56 112', '#b197fc', '#22b8cf')):
    write(name, svg(120, 136,
        lin('g', [(0, c1), (1, c2)], 0, 0, 1, 1),
        f'''
<path d="{d}" fill="none" stroke="#212529" stroke-opacity=".3" stroke-width="28" stroke-linecap="round" stroke-linejoin="round" transform="translate(3 6)"/>
<path d="{d}" fill="none" stroke="url(#g)" stroke-width="26" stroke-linecap="round" stroke-linejoin="round"/>
<path d="{d}" fill="none" stroke="#fff" stroke-opacity=".55" stroke-width="5" stroke-linecap="round" stroke-linejoin="round" stroke-dasharray="26 400" transform="translate(-4 -4)"/>
'''))

print('ok')
