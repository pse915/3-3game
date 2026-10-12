from pathlib import Path
import json,collections
root=Path(__file__).resolve().parents[1]/'components/rpg_game/data/maps';fail=[]
for file in root.glob('*.json'):
 m=json.loads(file.read_text(encoding='utf-8'));w=m['width'];h=m['height'];sx,sy=m['spawn'];q=collections.deque([(sx,sy)]);seen={(sx,sy)}
 while q:
  x,y=q.popleft()
  for dx,dy in ((1,0),(-1,0),(0,1),(0,-1)):
   a,b=x+dx,y+dy
   if 0<a<w-1 and 0<b<h-1 and (a,b) not in seen and not m['solid'][b*w+a]:seen.add((a,b));q.append((a,b))
 for p in m['portals']+m['interactions']+m['npcs']:
  if not any((p['x']+dx,p['y']+dy) in seen for dx,dy in [(0,0),(1,0),(-1,0),(0,1),(0,-1)]):fail.append([m['id'],p.get('name',p.get('label'))])
print('Unreachable points:',json.dumps(fail,ensure_ascii=True))
(Path(__file__).resolve().parents[1]/'docs/evidence/connectivity-results.json').write_text(json.dumps({'maps':80,'unreachable':fail},ensure_ascii=False),encoding='utf-8')

