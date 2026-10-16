"""Объёмная версия паков (осень, зима): градиенты, блики, мягкие тени.
Запуск из корня репозитория: python -I tools/gen_art_autumn_winter.py web/effects/doodles/packs"""
import os
import sys

B = sys.argv[1]
NS = 'xmlns="http://www.w3.org/2000/svg"'


def svg(w, h, defs, body):
    return (f'<svg {NS} width="{w}" height="{h}" viewBox="0 0 {w} {h}">\n'
            f'<defs>{defs.strip()}</defs>\n{body.strip()}\n</svg>\n')


def lin(gid, stops, x1=0, y1=0, x2=0, y2=1):
    s = ''.join(f'<stop offset="{o}" stop-color="{c}"/>' for o, c in stops)
    return f'<linearGradient id="{gid}" x1="{x1}" y1="{y1}" x2="{x2}" y2="{y2}">{s}</linearGradient>'


def rad(gid, stops, cx='38%', cy='32%', r='70%'):
    s = ''.join(f'<stop offset="{o}" stop-color="{c}"/>' for o, c in stops)
    return f'<radialGradient id="{gid}" cx="{cx}" cy="{cy}" r="{r}">{s}</radialGradient>'


def write(pack, name, content):
    d = os.path.join(B, pack)
    os.makedirs(d, exist_ok=True)
    with open(os.path.join(d, name), 'w', encoding='utf-8') as f:
        f.write(content)


MAPLE = ('M24 3 L27 12 L32 9 L31 18 L40 14 L37 22 L45 24 L36 30 L38 35 L28 33 L26 40 '
         'L22 40 L20 33 L10 35 L12 30 L3 24 L11 22 L8 14 L17 18 L16 9 L21 12 Z')

# =====================================================================
# ОСЕНЬ
# =====================================================================

write('autumn', 'maple.svg', svg(48, 48,
    lin('g', [(0, '#ffc078'), (.5, '#fd7e14'), (1, '#d9480f')], 0, 0, 1, 1),
    f'''
<path d="M24 40 Q24.5 44 23 47" stroke="#a0522d" stroke-width="2" fill="none" stroke-linecap="round"/>
<path d="{MAPLE}" fill="url(#g)" stroke="url(#g)" stroke-width="2.6" stroke-linejoin="round"/>
<path d="M24 39 Q24 26 24 11 M24 30 Q30 25 36 21 M24 30 Q18 25 12 21 M24 22 Q27 17 30 14 M24 22 Q21 17 18 14"
      stroke="#ffe8cc" stroke-opacity=".75" stroke-width="1.4" fill="none" stroke-linecap="round"/>
<ellipse cx="17" cy="17" rx="5" ry="2.6" transform="rotate(-35 17 17)" fill="#fff" fill-opacity=".35"/>
'''))

write('autumn', 'leaf.svg', svg(48, 48,
    lin('g', [(0, '#fff3bf'), (.35, '#ffd43b'), (1, '#f08c00')], 0, 0, 1, 1),
    '''
<path d="M24 42 Q25 45.5 22.5 47" stroke="#a0711f" stroke-width="2" fill="none" stroke-linecap="round"/>
<path d="M24 3 C38 11 41 28 24 43 C7 28 10 11 24 3 Z" fill="url(#g)"/>
<path d="M24 3 C38 11 41 28 24 43 Z" fill="#e67700" fill-opacity=".16"/>
<path d="M24 8 Q24.6 25 24 40 M24 17 Q28 15 31 11 M24 17 Q20 15 17 11 M24 26 Q29 23 33 19 M24 26 Q19 23 15 19 M24 34 Q27.5 32 30 28 M24 34 Q20.5 32 18 28"
      stroke="#fff9db" stroke-opacity=".85" stroke-width="1.3" fill="none" stroke-linecap="round"/>
<ellipse cx="18" cy="15" rx="3.2" ry="6" transform="rotate(25 18 15)" fill="#fff" fill-opacity=".35"/>
'''))

write('autumn', 'acorn.svg', svg(48, 48,
    rad('nut', [(0, '#f6d4a0'), (.55, '#d9a35b'), (1, '#9c6226')]) +
    lin('cap', [(0, '#a8693a'), (1, '#5c3a1a')]),
    '''
<path d="M22.5 41.5 Q24 46.5 25.5 41.5 Z" fill="#9c6226"/>
<ellipse cx="24" cy="30" rx="10.5" ry="13" fill="url(#nut)"/>
<ellipse cx="20" cy="30" rx="2.6" ry="5.6" fill="#fff" fill-opacity=".45"/>
<path d="M24 15 Q25 9 28.5 7" stroke="#5c3a1a" stroke-width="3" fill="none" stroke-linecap="round"/>
<path d="M10.5 22 C10.5 12 37.5 12 37.5 22 C37.5 26.8 10.5 26.8 10.5 22 Z" fill="url(#cap)"/>
<g fill="#c8854f" fill-opacity=".7">
  <circle cx="16" cy="19" r="1.3"/><circle cx="21" cy="17" r="1.3"/><circle cx="27" cy="17" r="1.3"/>
  <circle cx="32" cy="19" r="1.3"/><circle cx="18.5" cy="22.6" r="1.3"/><circle cx="24" cy="21.4" r="1.3"/>
  <circle cx="29.5" cy="22.6" r="1.3"/>
</g>
<path d="M14 17.5 Q19 13.5 26 13.5" stroke="#fff" stroke-opacity=".3" stroke-width="2" fill="none" stroke-linecap="round"/>
'''))

write('autumn', 'umbrella.svg', svg(96, 112,
    lin('can', [(0, '#ff8787'), (.55, '#fa5252'), (1, '#c92a2a')]) +
    lin('hd', [(0, '#e0a96d'), (1, '#8d5524')], 0, 0, 1, 0),
    '''
<path d="M48 47 V95 Q48 106 40 106 Q32.5 106 32.5 98.5" stroke="url(#hd)" stroke-width="4.5" fill="none" stroke-linecap="round"/>
<path d="M6 48 C6 22 26 6 48 6 C70 6 90 22 90 48 Q81 40 70 48 Q59 40 48 48 Q37 40 26 48 Q15 40 6 48 Z" fill="url(#can)"/>
<path d="M48 6 C40 16 36 30 37 43 Q31 41 26 48 C26 30 34 14 48 6 Z" fill="#a61e1e" fill-opacity=".22"/>
<path d="M48 6 C70 6 90 22 90 48 Q81 40 70 48 C70 30 62 14 48 6 Z" fill="#a61e1e" fill-opacity=".22"/>
<path d="M17 31 Q23 17 37 11" stroke="#fff" stroke-opacity=".55" stroke-width="4" fill="none" stroke-linecap="round"/>
<path d="M54 12 Q58 13 61 15" stroke="#fff" stroke-opacity=".35" stroke-width="3" fill="none" stroke-linecap="round"/>
<circle cx="48" cy="5" r="3.2" fill="#ced4da"/>
<ellipse cx="9" cy="58" rx="1.8" ry="2.8" fill="#a5d8ff"/>
<ellipse cx="88" cy="60" rx="1.8" ry="2.8" fill="#a5d8ff"/>
<ellipse cx="70" cy="56" rx="1.5" ry="2.3" fill="#a5d8ff" fill-opacity=".8"/>
'''))

ribs_band = ''.join(f'<path d="M{x} 45 V55"/>' for x in range(37, 86, 6))
write('autumn', 'hat.svg', svg(120, 120,
    lin('knit', [(0, '#ffc078'), (.5, '#fd7e14'), (1, '#e8590c')]) +
    lin('band', [(0, '#f76707'), (1, '#c2410c')]) +
    rad('pom', [(0, '#fffdf7'), (.6, '#fff4e6'), (1, '#ffc078')], '40%', '35%', '65%'),
    f'''
<path d="M35 47 C35 24 47 16 60 16 C73 16 85 24 85 47 Z" fill="url(#knit)"/>
<path d="M47 21 Q45 34 46 46 M60 17 V46 M73 21 Q75 34 74 46" stroke="#d9480f" stroke-opacity=".35" stroke-width="2" fill="none" stroke-linecap="round"/>
<path d="M37 35 Q60 27.5 83 35" stroke="#ffd43b" stroke-width="5" fill="none" stroke-linecap="round"/>
<path d="M41 32 Q44 23 53 19.5" stroke="#fff" stroke-opacity=".4" stroke-width="4" fill="none" stroke-linecap="round"/>
<rect x="30" y="42" width="60" height="15" rx="7.5" fill="url(#band)"/>
<g stroke="#9c3608" stroke-opacity=".45" stroke-width="2.2" stroke-linecap="round">{ribs_band}</g>
<path d="M35 45.5 H52" stroke="#fff" stroke-opacity=".25" stroke-width="2" stroke-linecap="round"/>
<g fill="url(#pom)">
  <circle cx="60" cy="13" r="9.5"/><circle cx="53" cy="10" r="4.5"/><circle cx="67" cy="10" r="4.5"/>
  <circle cx="60" cy="5" r="4.5"/><circle cx="54" cy="17" r="4"/><circle cx="66" cy="17" r="4"/>
</g>
'''))

write('autumn', 'hedgehog.svg', svg(112, 82,
    rad('sp', [(0, '#b07a45'), (.6, '#7a4a22'), (1, '#4e2f14')], '45%', '40%', '70%') +
    rad('face', [(0, '#fde3c0'), (1, '#e3ac6c')], '40%', '35%', '75%') +
    rad('ap', [(0, '#ff8787'), (.6, '#e03131'), (1, '#a61e1e')], '35%', '30%', '75%') +
    lin('lf', [(0, '#8ce99a'), (1, '#2f9e44')], 0, 0, 1, 1),
    '''
<ellipse cx="56" cy="76" rx="42" ry="4" fill="#000" fill-opacity=".22"/>
<ellipse cx="36" cy="69" rx="6.5" ry="4.2" fill="#5c3a1a"/>
<ellipse cx="66" cy="70" rx="6.5" ry="4.2" fill="#5c3a1a"/>
<path d="M12 62 L10 50 L18 50 L16 38 L26 40 L26 28 L36 33 L40 21 L48 29 L56 19 L62 29 L70 22 L72 34 L82 31 L80 43 L90 44 L86 54 L94 58 L90 64 Z"
      fill="url(#sp)" stroke="url(#sp)" stroke-width="3" stroke-linejoin="round"/>
<path d="M28 46 L22 38 M38 40 L34 31 M50 37 L50 27 M62 39 L66 30 M73 45 L79 38 M30 56 L22 52"
      stroke="#d39a63" stroke-opacity=".55" stroke-width="1.8" stroke-linecap="round"/>
<path d="M44 13 Q45 9 47 7.5" stroke="#5c3a1a" stroke-width="2" fill="none" stroke-linecap="round"/>
<path d="M46.5 10 Q53 4.5 57 9.5 Q51 13.5 46.5 10 Z" fill="url(#lf)"/>
<circle cx="44" cy="22" r="9.5" fill="url(#ap)"/>
<ellipse cx="40.5" cy="18.5" rx="2.6" ry="3.4" fill="#fff" fill-opacity=".7"/>
<ellipse cx="88" cy="60" rx="16.5" ry="12.5" fill="url(#face)"/>
<path d="M96 54.5 Q103 58 108.5 62 Q103 66 96 67.5 Z" fill="url(#face)"/>
<circle cx="108.5" cy="62" r="3.3" fill="#212529"/>
<circle cx="107.6" cy="61" r="1" fill="#fff" fill-opacity=".8"/>
<circle cx="82" cy="50" r="4.2" fill="#d99a5b"/>
<circle cx="91" cy="56" r="2.7" fill="#212529"/>
<circle cx="91.9" cy="55.1" r=".9" fill="#fff"/>
<circle cx="95" cy="64.5" r="3.2" fill="#ff8fa3" fill-opacity=".55"/>
<path d="M98 66.5 Q101 68 104 66.5" stroke="#8d5524" stroke-width="1.4" fill="none" stroke-linecap="round"/>
'''))

# =====================================================================
# ЗИМА
# =====================================================================

SNOW = rad('snow', [(0, '#ffffff'), (.55, '#f1f5f9'), (1, '#c3d3e4')], '36%', '30%', '75%')

write('winter', 'snowman-ski.svg', svg(120, 140,
    SNOW +
    lin('car', [(0, '#ffc078'), (1, '#e8590c')]) +
    lin('hat', [(0, '#74c0fc'), (1, '#1c7ed6')]) +
    lin('scf', [(0, '#ff8787'), (1, '#e03131')]) +
    lin('stick', [(0, '#b07a45'), (1, '#6b4220')], 0, 0, 1, 0) +
    rad('pom', [(0, '#ffffff'), (1, '#d0ebff')], '40%', '35%', '70%'),
    '''
<ellipse cx="58" cy="136" rx="52" ry="3.5" fill="#000" fill-opacity=".2"/>
<g fill="#fff" fill-opacity=".85"><circle cx="5" cy="123" r="5"/><circle cx="13" cy="127" r="3.8"/><circle cx="1.5" cy="130" r="3"/></g>
<g stroke="#ced4da" stroke-width="3" stroke-linecap="round"><path d="M28 80 L7 123"/><path d="M86 80 L67 125"/></g>
<circle cx="7.5" cy="121" r="3.2" fill="#adb5bd"/><circle cx="67.5" cy="123" r="3.2" fill="#adb5bd"/>
<path d="M3 134 H98 Q108 134 108 126" stroke="#c92a2a" stroke-width="5.5" fill="none" stroke-linecap="round"/>
<path d="M10 128 H104 Q114 128 114 120" stroke="#fa5252" stroke-width="5.5" fill="none" stroke-linecap="round"/>
<path d="M14 126.6 H100" stroke="#ffc9c9" stroke-width="1.4" stroke-linecap="round"/>
<circle cx="58" cy="104" r="22.5" fill="url(#snow)"/>
<ellipse cx="58" cy="86.5" rx="12" ry="2.6" fill="#9fb3c8" fill-opacity=".45"/>
<circle cx="58" cy="70" r="17.5" fill="url(#snow)"/>
<ellipse cx="58" cy="55.2" rx="9" ry="2" fill="#9fb3c8" fill-opacity=".45"/>
<g fill="#343a40"><circle cx="58" cy="65" r="2.7"/><circle cx="58" cy="75" r="2.7"/><circle cx="58" cy="100" r="2.7"/></g>
<g fill="#fff" fill-opacity=".6"><circle cx="57.2" cy="64.2" r=".8"/><circle cx="57.2" cy="74.2" r=".8"/></g>
<g stroke="url(#stick)" stroke-width="3.2" stroke-linecap="round" fill="none">
  <path d="M42 67 Q34 72 27 80 M32 76 L26.5 71.5"/>
  <path d="M74 67 Q81 72 87 80 M82 75.5 L88 72.5"/>
</g>
<path d="M49 57 Q40 60 30 64 L33 71.5 Q42 67 51.5 62 Z" fill="url(#scf)"/>
<path d="M37.5 61.5 L40.5 68 M43.5 59.5 L46.5 65.5" stroke="#fff" stroke-width="2.2" stroke-linecap="round"/>
<path d="M30 64 L27 67 M31.5 67.5 L28.5 70.5" stroke="#e03131" stroke-width="1.6" stroke-linecap="round"/>
<circle cx="58" cy="42" r="14.5" fill="url(#snow)"/>
<path d="M43 53 Q58 60.5 73 53 L73 59.5 Q58 67 43 59.5 Z" fill="url(#scf)"/>
<path d="M47 55.5 Q58 60 69 55.5" stroke="#fff" stroke-opacity=".45" stroke-width="1.5" fill="none"/>
<g fill="#212529"><circle cx="53" cy="40" r="2.2"/><circle cx="63" cy="40" r="2.2"/></g>
<g fill="#fff"><circle cx="53.7" cy="39.3" r=".7"/><circle cx="63.7" cy="39.3" r=".7"/></g>
<path d="M59 43.5 Q70 45 78 47.5 Q70 49 59 49 Z" fill="url(#car)"/>
<path d="M64 45.5 L65 47.5 M69 46.3 L69.8 48" stroke="#d9480f" stroke-width="1" stroke-linecap="round"/>
<g fill="#495057"><circle cx="52" cy="50" r="1.1"/><circle cx="55" cy="51.6" r="1.1"/><circle cx="58.5" cy="52.1" r="1.1"/><circle cx="62" cy="51.6" r="1.1"/></g>
<g fill="#ffa8a8" fill-opacity=".55"><circle cx="49" cy="45.5" r="2.6"/><circle cx="67" cy="45.5" r="2.6"/></g>
<path d="M44 35 C44 20.5 72 20.5 72 35 Z" fill="url(#hat)"/>
<path d="M50 26 Q54 22.5 59 22" stroke="#fff" stroke-opacity=".45" stroke-width="2.5" fill="none" stroke-linecap="round"/>
<rect x="42" y="31" width="32" height="7.5" rx="3.75" fill="#1864ab"/>
<circle cx="58" cy="19.5" r="6.2" fill="url(#pom)"/>
<ellipse cx="51" cy="98" rx="5" ry="9" transform="rotate(25 51 98)" fill="#fff" fill-opacity=".5"/>
'''))

FLAKE_ARM = 'M24 4 V44 M24 11 L19.5 6.5 M24 11 L28.5 6.5 M24 37 L19.5 41.5 M24 37 L28.5 41.5'
write('winter', 'snowflake.svg', svg(48, 48,
    rad('glow', [(0, '#ffffff'), (.5, '#d0ebff'), (1, '#d0ebff')], '50%', '50%', '50%') +
    lin('st', [(0, '#ffffff'), (1, '#a5d8ff')], 0, 0, 1, 1),
    f'''
<circle cx="24" cy="24" r="16" fill="url(#glow)" fill-opacity=".22"/>
<g stroke="url(#st)" stroke-width="3" stroke-linecap="round" fill="none">
  <path d="{FLAKE_ARM}"/>
  <path d="{FLAKE_ARM}" transform="rotate(60 24 24)"/>
  <path d="{FLAKE_ARM}" transform="rotate(120 24 24)"/>
</g>
<circle cx="24" cy="24" r="3.4" fill="#fff"/>
'''))

write('winter', 'snowflake2.svg', svg(48, 48,
    lin('st', [(0, '#e7f5ff'), (1, '#74c0fc')], 0, 0, 1, 1),
    '''
<g stroke="url(#st)" stroke-width="3.4" stroke-linecap="round" fill="none">
  <path d="M24 7 V41"/><path d="M24 7 V41" transform="rotate(60 24 24)"/><path d="M24 7 V41" transform="rotate(120 24 24)"/>
</g>
<g fill="#e7f5ff">
  <circle cx="24" cy="6" r="2.4"/><circle cx="24" cy="42" r="2.4"/><circle cx="8.4" cy="15" r="2.4"/>
  <circle cx="39.6" cy="33" r="2.4"/><circle cx="39.6" cy="15" r="2.4"/><circle cx="8.4" cy="33" r="2.4"/>
</g>
<circle cx="24" cy="24" r="4" fill="#fff"/>
'''))

write('winter', 'snowball.svg', svg(48, 48, SNOW, '''
<circle cx="24" cy="24" r="18" fill="url(#snow)"/>
<path d="M11 31 A15 15 0 0 0 37 31" stroke="#a9bfd6" stroke-opacity=".5" stroke-width="3" fill="none" stroke-linecap="round"/>
<ellipse cx="18" cy="17" rx="4.5" ry="3" transform="rotate(-30 18 17)" fill="#fff"/>
<g fill="#fff"><circle cx="31" cy="14" r="1.2"/><circle cx="34" cy="20" r=".9"/></g>
'''))

ribs = ''.join(f'<path d="M{x} 45 V55"/>' for x in range(37, 86, 6))
write('winter', 'hat.svg', svg(120, 120,
    lin('knit', [(0, '#74c0fc'), (.55, '#339af0'), (1, '#1971c2')]) +
    lin('band', [(0, '#1c7ed6'), (1, '#1864ab')]) +
    lin('scf', [(0, '#ff8787'), (1, '#e03131')]) +
    rad('pom', [(0, '#ffffff'), (.6, '#f1f8ff'), (1, '#c5dff8')], '40%', '35%', '65%'),
    f'''
<path d="M34 52 L31 72 Q36 72 42 67 L42 54 Z M86 52 L89 72 Q84 72 78 67 L78 54 Z" fill="url(#band)"/>
<g fill="url(#pom)"><circle cx="31" cy="75" r="3.6"/><circle cx="89" cy="75" r="3.6"/></g>
<path d="M35 47 C35 24 47 16 60 16 C73 16 85 24 85 47 Z" fill="url(#knit)"/>
<path d="M47 21 Q45 34 46 46 M73 21 Q75 34 74 46" stroke="#1864ab" stroke-opacity=".35" stroke-width="2" fill="none" stroke-linecap="round"/>
<g stroke="#fff" stroke-width="2.2" stroke-linecap="round"><path d="M60 24 V38 M54 27.5 L66 34.5 M66 27.5 L54 34.5"/></g>
<path d="M41 32 Q44 23 53 19.5" stroke="#fff" stroke-opacity=".4" stroke-width="4" fill="none" stroke-linecap="round"/>
<rect x="30" y="42" width="60" height="15" rx="7.5" fill="url(#band)"/>
<g stroke="#0b4f8a" stroke-opacity=".45" stroke-width="2.2" stroke-linecap="round">{ribs}</g>
<g fill="url(#pom)">
  <circle cx="60" cy="13" r="9.5"/><circle cx="53" cy="10" r="4.5"/><circle cx="67" cy="10" r="4.5"/>
  <circle cx="60" cy="5" r="4.5"/><circle cx="54" cy="17" r="4"/><circle cx="66" cy="17" r="4"/>
</g>
<path d="M32 87 Q60 99 88 87 L88 97 Q60 109 32 97 Z" fill="url(#scf)"/>
<path d="M38 92.5 Q60 101 82 92.5" stroke="#fff" stroke-opacity=".5" stroke-width="2" fill="none"/>
<rect x="72" y="93" width="12" height="22" rx="4" fill="url(#scf)"/>
<path d="M72 103 H84 M72 109 H84" stroke="#fff" stroke-width="2"/>
<path d="M74 115 V118 M78 115 V118 M82 115 V118" stroke="#e03131" stroke-width="1.6" stroke-linecap="round"/>
'''))

write('winter', 'penguin.svg', svg(112, 76,
    lin('body', [(0, '#5c636a'), (1, '#1f2327')]) +
    rad('belly', [(0, '#ffffff'), (1, '#dde3ea')], '45%', '30%', '75%') +
    lin('beak', [(0, '#ffc078'), (1, '#f76707')]) +
    lin('scf', [(0, '#ff8787'), (1, '#e03131')]),
    '''
<ellipse cx="56" cy="70" rx="44" ry="3.5" fill="#000" fill-opacity=".2"/>
<path d="M2 40 H18 M0 48 H13 M4 56 H20" stroke="#d0ebff" stroke-opacity=".8" stroke-width="3" stroke-linecap="round"/>
<ellipse cx="22" cy="54" rx="7.5" ry="3.6" fill="url(#beak)"/>
<ellipse cx="52" cy="47" rx="36" ry="17.5" fill="url(#body)"/>
<ellipse cx="55" cy="54" rx="28" ry="9.5" fill="url(#belly)"/>
<path d="M38 41 Q26 33 19 31 Q26 44 35 50 Z" fill="#1f2327"/>
<circle cx="86" cy="38" r="14.5" fill="url(#body)"/>
<circle cx="90" cy="39" r="8" fill="url(#belly)"/>
<circle cx="92" cy="36" r="2.3" fill="#212529"/><circle cx="92.8" cy="35.2" r=".8" fill="#fff"/>
<path d="M98 37.5 Q105 39 109.5 41 Q105 43 98 44.5 Z" fill="url(#beak)"/>
<g fill="#ffa8a8" fill-opacity=".5"><circle cx="93" cy="44" r="2.3"/></g>
<path d="M73 47 Q86 53 99 47 L99 52.5 Q86 58.5 73 52.5 Z" fill="url(#scf)"/>
<path d="M76 50 Q86 54.5 96 50" stroke="#fff" stroke-opacity=".45" stroke-width="1.4" fill="none"/>
<path d="M40 34 Q52 29 66 31" stroke="#fff" stroke-opacity=".22" stroke-width="3" fill="none" stroke-linecap="round"/>
'''))

for pack in ('autumn', 'winter'):
    d = os.path.join(B, pack)
    print(pack, {f: os.path.getsize(os.path.join(d, f)) for f in sorted(os.listdir(d))})
