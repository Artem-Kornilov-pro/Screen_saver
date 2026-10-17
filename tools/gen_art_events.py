"""Модельки событий и замена свинки. Запуск из корня репозитория:
python -I tools/gen_art_events.py web/effects/doodles/packs

Стиль по референсам команды: «надутые» глянцевые формы, розово-оранжевые и фиолетовые градиенты,
крупный белый блик сверху слева. Без текста: число на бейдже движок пишет сам."""
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
        op = f' stop-opacity="{s[2]}"' if len(s) > 2 else ''
        out.append(f'<stop offset="{s[0]}" stop-color="{s[1]}"{op}/>')
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


def star(cx, cy, R, r, n=5, rot=-90):
    pts = []
    for i in range(n * 2):
        a = math.radians(rot + i * 180 / n)
        rr = R if i % 2 == 0 else r
        pts.append(f'{cx + math.cos(a) * rr:.1f} {cy + math.sin(a) * rr:.1f}')
    return 'M' + ' L'.join(pts) + ' Z'


# Надутая звезда-бейдж: толстая обводка той же заливкой скругляет углы
S = star(80, 84, 58, 30)
write('events', 'star3d.svg', svg(160, 160,
    lin('fill', [(0, '#ffd8a8'), (.35, '#ff922b'), (.75, '#f06595'), (1, '#c2255c')], 0, 0, 1, 1) +
    lin('rim', [(0, '#ffffff', .9), (1, '#ffffff', 0)], 0, 0, 1, 1),
    f'''
<path d="{star(82, 90, 58, 30)}" fill="#862e9c" fill-opacity=".35" stroke="#862e9c" stroke-opacity=".35" stroke-width="22" stroke-linejoin="round"/>
<path d="{S}" fill="url(#fill)" stroke="url(#fill)" stroke-width="22" stroke-linejoin="round"/>
<path d="{star(80, 84, 50, 26)}" fill="none" stroke="url(#rim)" stroke-width="3" stroke-linejoin="round"/>
<ellipse cx="56" cy="52" rx="20" ry="9" fill="#fff" fill-opacity=".75" transform="rotate(-35 56 52)"/>
<circle cx="40" cy="74" r="4" fill="#fff" fill-opacity=".7"/>
'''))

write('events', 'sparkle.svg', svg(48, 48,
    rad('sp', [(0, '#ffffff'), (.4, '#fcc2d7'), (1, '#9775fa')], '45%', '40%', '65%'),
    '''
<path d="M24 1 C26 15 33 22 47 24 C33 26 26 33 24 47 C22 33 15 26 1 24 C15 22 22 15 24 1 Z" fill="url(#sp)"/>
<ellipse cx="20" cy="18" rx="3" ry="1.6" fill="#fff" transform="rotate(-40 20 18)"/>
'''))

write('events', 'firefly.svg', svg(32, 32,
    rad('ff', [(0, '#fffde0'), (.25, '#e9fac8'), (.55, '#a9e34b', .55), (1, '#82c91e', 0)], '50%', '50%', '50%'),
    '<circle cx="16" cy="16" r="16" fill="url(#ff)"/>'))

write('events', 'moon.svg', svg(120, 120,
    rad('moon', [(0, '#fffbe6'), (.5, '#ffe066'), (1, '#f08c00')], '35%', '30%', '80%') +
    '<mask id="cut"><rect width="120" height="120" fill="#fff"/><circle cx="80" cy="42" r="38" fill="#000"/></mask>',
    f'''
<circle cx="56" cy="62" r="56" fill="#ffd43b" fill-opacity=".14"/>
<circle cx="56" cy="62" r="44" fill="url(#moon)" mask="url(#cut)"/>
<ellipse cx="30" cy="54" rx="7" ry="13" fill="#fff" fill-opacity=".6" transform="rotate(20 30 54)" mask="url(#cut)"/>
<circle cx="44" cy="90" r="5" fill="#f08c00" fill-opacity=".35" mask="url(#cut)"/>
<path d="{star(100, 86, 8, 3.4, 4, -90)}" fill="#fff9db" stroke="#fff9db" stroke-width="1.5" stroke-linejoin="round"/>
<path d="{star(106, 16, 6, 2.6, 4, -90)}" fill="#fff9db" stroke="#fff9db" stroke-width="1.2" stroke-linejoin="round"/>
'''))

shutil.copy(os.path.join(B, 'savings', 'coin.svg'), os.path.join(B, 'events', 'coin.svg'))

# Банка-копилка вместо свинки (по ТЗ свинок и Сберкота использовать нельзя)
coins = ''.join(
    f'<ellipse cx="{x}" cy="{y}" rx="13" ry="5" fill="url(#coin)" stroke="#e67700" stroke-width="1.2"/>'
    for x, y in ((36, 92), (56, 94), (46, 87), (64, 86), (32, 81), (52, 79), (42, 72)))
write('savings', 'jar.svg', svg(96, 112,
    lin('glass', [(0, '#e7f5ff', .75), (.5, '#a5d8ff', .35), (1, '#4dabf7', .55)], 0, 0, 1, 0) +
    lin('lid', [(0, '#d0bfff'), (.5, '#845ef7'), (1, '#5f3dc4')], 0, 0, 1, 0) +
    rad('coin', [(0, '#fff9db'), (.6, '#ffd43b'), (1, '#f59f00')], '40%', '35%', '70%'),
    f'''
<ellipse cx="48" cy="106" rx="34" ry="5" fill="#000" fill-opacity=".22"/>
<path d="M18 30 Q14 30 14 38 V94 Q14 104 26 104 H70 Q82 104 82 94 V38 Q82 30 78 30 Z" fill="url(#glass)"/>
{coins}
<path d="M18 30 Q14 30 14 38 V94 Q14 104 26 104 H70 Q82 104 82 94 V38 Q82 30 78 30 Z" fill="none" stroke="#d0ebff" stroke-opacity=".9" stroke-width="2.4"/>
<path d="M22 40 V90" stroke="#fff" stroke-opacity=".8" stroke-width="4" stroke-linecap="round"/>
<path d="M30 40 V60" stroke="#fff" stroke-opacity=".45" stroke-width="2.4" stroke-linecap="round"/>
<rect x="12" y="16" width="72" height="16" rx="7" fill="url(#lid)"/>
<rect x="34" y="20" width="28" height="5" rx="2.5" fill="#2b1d6b"/>
<path d="M18 21 H30" stroke="#fff" stroke-opacity=".6" stroke-width="2.4" stroke-linecap="round"/>
<g transform="rotate(-18 48 8)"><ellipse cx="48" cy="8" rx="11" ry="4.5" fill="url(#coin)" stroke="#e67700" stroke-width="1.2"/></g>
'''))

print('ok')
