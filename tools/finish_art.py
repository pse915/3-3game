"""Normalize generated source to the existing atlas contract and record evidence."""
from pathlib import Path
from PIL import Image
import json,hashlib,collections
from clean_atlas import clean
root=Path(__file__).resolve().parents[1];a=root/'components/rpg_game/assets';data=root/'components/rpg_game/data'
im=Image.open(a/'environment-source.png').convert('RGBA');im.resize((1024,1024),Image.Resampling.NEAREST).save(a/'environment.png')
clean(a/'environment.png')
maps={p.stem:json.loads(p.read_text(encoding='utf-8')) for p in (data/'maps').glob('*.json')};errors=[]
for name,m in maps.items():
 w,h=m['width'],m['height'];sx,sy=m['spawn'];seen={(sx,sy)};q=collections.deque(seen)
 while q:
  x,y=q.popleft()
  for dx,dy in ((1,0),(-1,0),(0,1),(0,-1)):
   xx,yy=x+dx,y+dy
   if 0<=xx<w and 0<=yy<h and (xx,yy) not in seen and not m['solid'][yy*w+xx]:seen.add((xx,yy));q.append((xx,yy))
 for p in m['portals']+m['interactions']+m['npcs']:
  if not any((p['x']+dx,p['y']+dy) in seen for dx,dy in ((0,0),(1,0),(-1,0),(0,1),(0,-1))):errors.append([name,p.get('name',p.get('label')),'unreachable'])
 for p in m['portals']:
  dest=maps.get(p['target']);pos=p.get('arrival')
  if not dest:errors.append([name,p['target'],'missing target'])
  elif not pos or not (0<=pos[0]<dest['width'] and 0<=pos[1]<dest['height']):errors.append([name,p['target'],'invalid arrival'])
  elif dest['solid'][pos[1]*dest['width']+pos[0]]:errors.append([name,p['target'],'solid arrival'])
school={'version':1,'schoolName':'서라벌여중','evidenceScope':'첨부 ZIP과 지시문만 확인; 최신 실측 도면과 실제 사진은 제공되지 않음','confirmedFromUserBrief':[{'feature':'학습지원실2부터 왼쪽 날개가 90도 꺾이는 ㄱ자 구조','status':'brief-confirmed; physical placement unverified'},{'feature':'학교 명칭 서라벌여중','status':'brief-confirmed'}],'inferred':[{'feature':'층별 객실 순서, 치수, 문 위치, 계단 좌표','status':'provisional; original project data'},{'feature':'외벽 벽돌·창문·지붕 재질, 방별 내부 가구 배치','status':'fictionalized for game; real photos required'}],'floorMaps':[{'id':k,'roomCount':sum(p['target'].startswith('room-') for p in m['portals']),'shape':'L-shaped corridor in data','status':'project-derived; physical validation pending'} for k,m in maps.items() if k.startswith('floor')],'schoolRoomCount':sum(k.startswith('room-') for k in maps),'indoorRoomCount':sum(m['kind']=='room' for m in maps.values()),'realPlanValidation':'additional source required; not represented as exact reconstruction'}
(data/'school_evidence.json').write_text(json.dumps(school,ensure_ascii=False,indent=2),encoding='utf-8')
(root/'docs/evidence/graphics-connectivity.json').write_text(json.dumps({'maps':len(maps),'roomCount':school['schoolRoomCount'],'checks':'spawn reachability; interaction adjacency; portal target and arrival bounds; solid arrival','errors':errors},ensure_ascii=False,indent=2),encoding='utf-8')
manifest=json.loads((a/'manifest.json').read_text(encoding='utf-8'));manifest['version']=3;manifest['environmentSource']='original generated atlas 2026-10-11; normalized from 1254x1254';manifest['avatarSheet']=json.loads((a/'avatars.json').read_text());manifest['schoolEvidence']='data/school_evidence.json';manifest['qualityGate']='PARTIAL: original environment atlas and six avatars replaced; other original atlases retained; external reference and real-device validation unavailable'
manifest['assets']=[dict(file=p.name,width=Image.open(p).width,height=Image.open(p).height,mode=Image.open(p).mode,sha256=hashlib.sha256(p.read_bytes()).hexdigest(),source=p.stem.endswith('-source')) for p in sorted(a.glob('*.png'))]
(a/'manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2),encoding='utf-8');print(json.dumps({'maps':len(maps),'rooms':school['schoolRoomCount'],'errors':errors},ensure_ascii=True))
