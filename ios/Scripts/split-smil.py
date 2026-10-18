from pathlib import Path
import xml.etree.ElementTree as E,copy,json,re
root=Path(__file__).resolve().parent.parent
source=root.parent/'Screen_saver/web/effects'
ns='{http://www.w3.org/2000/svg}'
E.register_namespace('',ns[1:-1])
out=[];metadata={}
for p in source.rglob('*.svg'):
 tree=E.parse(p).getroot();parents=[n for n in tree if any(c.tag.split('}')[-1].startswith('animate') for c in n)]
 if not parents:continue
 key='effects/'+str(p.relative_to(source));base=copy.deepcopy(tree)
 for node in list(base):
  if any(c.tag.split('}')[-1].startswith('animate') for c in node):base.remove(node)
 out.append({'key':key+'#base','svg':E.tostring(base,encoding='unicode')})
 view=list(map(float,tree.attrib.get('viewBox','0 0 100 100').split()))
 layers=[]
 for i,node in enumerate(parents):
  layer=E.Element(tree.tag,tree.attrib)
  for defs in tree.findall(ns+'defs'):layer.append(copy.deepcopy(defs))
  group=copy.deepcopy(node);a=next(c for c in group if c.tag.split('}')[-1].startswith('animate'));group.remove(a);layer.append(group)
  id=key+'#layer'+str(i);out.append({'key':id,'svg':E.tostring(layer,encoding='unicode')})
  layers.append({'source':id,'attribute':a.attrib['attributeName'],'values':a.attrib['values'],'duration':float(a.attrib['dur'].rstrip('s')),'begin':float(a.attrib.get('begin','0s').rstrip('s'))})
 metadata[key]={'base':key+'#base','width':view[2],'height':view[3],'layers':layers}
(root/'SberKids/Resources/Content/animation-map.json').write_text(json.dumps(metadata,ensure_ascii=False,indent=2))
(root/'Scripts/smil-layers.json').write_text(json.dumps(out))
print('Split',len(metadata),'animated SVGs into',len(out),'native layers')
