from pathlib import Path
from PIL import Image
import hashlib,json
r=Path(__file__).resolve().parents[1]/'components/rpg_game/assets';assets=[]
for p in sorted(r.glob('*.png')):
 im=Image.open(p);assets.append(dict(file=p.name,width=im.width,height=im.height,mode=im.mode,sha256=hashlib.sha256(p.read_bytes()).hexdigest(),source=p.stem.endswith('-source')))
manifest=dict(version=2,tileSize=32,characterFrame=[32,48],characterSheet=dict(columns=8,rows=4,directions=['down','left','right','up'],walkColumns=[0,1,2,3],runColumns=[4,5,6,7]),npcSheet=dict(columns=7,rows=5,frame=[32,48],animation='front idle only'),objectAtlases=dict(environment=[4,4,256,256],buildings=[4,4,256,256],furniture=[4,4,256,256],facilities=[4,4,256,256],details=[4,4,256,256]),qualityGate='NOT PASSED: missing supplied reference images; additional art, animation, map density and real device QA needed',assets=assets)
(r/'manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2),encoding='utf-8')
