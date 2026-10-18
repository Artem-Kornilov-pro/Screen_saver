from pathlib import Path
import re,json
root=Path(__file__).resolve().parent.parent
html=(root.parent/'Screen_saver/web/index.html').read_text()
def svgs(section):return re.findall(r'<svg\b[\s\S]*?</svg>',section)
tiles=svgs(html.split('<section class="tiles">')[1].split('</section>')[0])
tabs=svgs(html.split('<nav class="tabbar"')[1].split('</nav>')[0])
ops=svgs(html.split('<ul class="ops">')[1].split('</ul>')[0])
back=svgs(html.split('<section class="screen" id="screen-transfer"')[1].split('</header>')[0])
gear=svgs(html.split('<button class="debug-toggle"')[1].split('</button>')[0])
items=[]
def add(key,svg,color):
 svg=svg.replace('currentColor',color)
 svg=svg.replace('<svg ',f'<svg xmlns="http://www.w3.org/2000/svg" fill="{color}" ')
 items.append({'key':'ui/'+key,'svg':svg})
for name,s,color in zip(['qr','arrow','mobile'],tiles,['#e9e3ff','#ffffff','#c9f7da']):add(name,s,color)
add('envelope',ops[0],'#c9d3e6');add('back',back[0],'#f2f5f3');add('gear',gear[0],'#f2f5f3')
for i,name in enumerate(['home','savings','paw','done','content']):
 add(name,tabs[i],'#f2a7bd' if i==2 else '#6f7a74')
 add(name+'_active',tabs[i],'#21c25e')
(root/'Scripts/ui-assets.json').write_text(json.dumps(items))
print(len(items),'inline SVGs extracted')
