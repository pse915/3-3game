"""Purpose-specific room layouts, original terrain, five life choices, graph metadata."""
import json, random, math
from PIL import Image,ImageDraw,ImageColor

SPECS={
 'restroom':('위생·손 씻기','타일 / 물 사용 구역 / 환기',[50,51,52,53,54,55,56]),
 'classroom':('학생 수업','목재 / 크림 벽 / 창가 햇빛',[2,10,39,40,45,56,65,66]),
 'science':('과학 실험','내수 바닥 / 실험대 / 안전',[13,48,51,67]),
 'technology':('제작 실습','작업 바닥 / 공구·재료 수납',[60,61,67]),
 'homeeconomics':('조리·의생활 실습','주방 타일 / 조리대 / 식탁',[57,58,59,33]),
 'computer':('정보 수업','차분한 바닥 / 배선·작업석',[14,68]),
 'music':('연주·감상','목재 / 흡음 벽 / 악기 수납',[37,62,63]),
 'art':('미술 실습','작업 바닥 / 세척·건조',[38,64,51]),
 'hospital':('진료·건강관리','밝은 타일 / 가림막 / 접수',[41,67,69,70,65]),
 'library':('독서·대출','따뜻한 목재 / 서가·열람석',[3,43,71,72]),
 'office':('업무·회의','목재 / 서류·업무 기기',[14,68,73,76]),
 'cafe':('주문·음식·휴식','목재 / 주방 타일 / 좌석 러그',[12,33,34,46]),
 'home':('생활·휴식','목재 / 침실·주방 영역',[35,36,33,34,39,58]),
 'nursery':('놀이·돌봄','부드러운 바닥 / 낮은 가구',[42,75,34]),
 'welfare':('상담·여가·교류','넓은 통로 / 활동·휴게 영역',[65,73,74,34,43]),
 'shop':('판매·계산','석재 / 상품·계산대',[44,65,39]),
 'gym':('운동·건강','운동 바닥 / 기구·수납',[74,39]),
}

def upgrade(root):
 data=root/'data';assets=root/'assets';maps={p.stem:json.loads(p.read_text(encoding='utf-8')) for p in (data/'maps').glob('*.json')}
 def save(p,v):p.write_text(json.dumps(v,ensure_ascii=False,separators=(',',':')),encoding='utf-8')
 def fill(m,x,y,w,h,t,solid=0):
  for yy in range(y,min(y+h,m['height'])):
   for xx in range(x,min(x+w,m['width'])):m['tiles'][yy*m['width']+xx]=t;m['solid'][yy*m['width']+xx]=solid
 def put(m,a,x,y,w=64,h=64,solid=True,role=None):
  o=dict(asset=a,x=x,y=y,w=w,h=h,role=role or 'facility');m['objects'].append(o)
  if solid:
   by=int(y+h/32-.5);bw=max(1,math.ceil(w/32)-1);o['collision']=[int(x),by,bw,1]
   for xx in range(int(x),min(m['width'],int(x)+bw)):m['solid'][by*m['width']+xx]=1
  return o
 def inspect(m,x,y,label,text):m['interactions'].append(dict(x=x,y=y,label=label,text=text))
 # Terrain variants are authored at true 32px resolution, with subtle material distinctions.
 old=Image.open(assets/'terrain.png').convert('RGBA');im=Image.new('RGBA',(32*48,32));im.paste(old,(0,0));d=ImageDraw.Draw(im)
 for i in range(12,48):
  x=i*32;r=random.Random(i);c=['#d7e4dc','#d8b992','#ccb98e','#c3d5c5','#ddd3be','#dccbc7','#b9c9ba','#d5c5a6'][((i-12)//4)%8];rgb=ImageColor.getrgb(c)
  def col(delta):return tuple(max(0,min(255,v+delta)) for v in rgb)+(255,)
  d.rectangle((x,0,x+31,31),fill=c)
  for k in range(15):xx=r.randrange(32);yy=r.randrange(32);d.point((x+xx,yy),fill=col(r.choice([-4,4])))
  if 12<=i<16 or 28<=i<32:
   for a in (0,16,31):d.line((x+a,0,x+a,31),fill=col(-10));d.line((x,a,x+31,a),fill=col(-10))
  elif 16<=i<24:
   for a in (0,8,16,24):d.line((x,a,x+31,a),fill=col(-12));d.line((x+(i*7+a)%29,a,x+(i*7+a)%29,a+8),fill=col(-9))
  elif 24<=i<28:
   d.rectangle((x+2,2,x+29,29),outline=col(-16));d.rectangle((x+5,5,x+26,26),outline=col(12))
  elif 32<=i<36:
   for a in (2,8,29):d.line((x,a,x+31,a),fill=col(-18 if a==29 else 14))
  elif i>=40:
   for a in (0,16):d.line((x,a,x+31,a),fill=col(-12))
   d.line((x+((i%2)*16),0,x+((i%2)*16),15),fill=col(-12));d.line((x+16,16,x+16,31),fill=col(-12))
 d.rectangle((7*32,0,8*32-1,31),fill='#39383f')
 im.save(assets/'terrain.png')
 def roomtype(m):
  n=m['name'];id=m['id']
  if '화장실' in n:return 'restroom'
  if '학년 ' in n and n.endswith('반'):return 'classroom'
  if '과학' in n:return 'science'
  if '기술' in n:return 'technology'
  if '가정' in n:return 'homeeconomics'
  if '컴퓨터' in n or '정보' in n:return 'computer'
  if '음악' in n:return 'music'
  if '미술' in n:return 'art'
  if '보건' in n or id=='hospital':return 'hospital'
  if '도서' in n or '자료' in n or id=='library':return 'library'
  if '체력' in n:return 'gym'
  return {'cafe':'cafe','bakery':'cafe','home':'home','rental':'home','shared':'home','care':'nursery','nursery':'nursery','welfare':'welfare','culture':'art','mart':'shop','shop':'shop'}.get(id,'office')
 specs=[]
 for m in maps.values():
  if m['kind']!='room':continue
  kind=roomtype(m);m['style']=kind;m['objects']=[];m['interactions']=[];m['spawn']=[16,24];m['cameraBounds']=[4,4,24,24]
  # Keep the original 32x32 map but give actual rooms realistic proportions and an entrance.
  fill(m,0,0,32,32,7,1);base=12 if kind in ['restroom','hospital','science'] else 16 if kind in ['cafe','home','classroom','library','music'] else 20
  fill(m,5,8,22,18,base);fill(m,5,5,22,3,32,1);fill(m,4,5,1,21,33,1);fill(m,27,5,1,21,33,1);fill(m,15,25,3,4,40)
  for y in range(8,26):
   for x in range(5,27):m['tiles'][y*32+x]=base+((x*3+y*7+int(m['id'].split('-')[-1]) if m['id'].split('-')[-1].isdigit() else x+y)%4)
  if kind!='restroom':
   for x in (6,23):put(m,40,x,5,96,96,False,'window')
   put(m,66,18,5,32,32,False,'clock');put(m,45,5,9,64,64,False,'notice')
   put(m,11,24,22,48,64,True,'plant')
  if kind=='restroom':
   for x in (6,11,16):put(m,50,x,8,128,160,True,'toilet_cubicle')
   put(m,50,22,8,128,160,True,'toilet_cubicle')
   for x in (7,15):put(m,51,x,17,128,96,True,'sink_mirror_soap')
   put(m,53,23,21,32,48,True,'waste_bin');put(m,54,25,11,32,32,False,'paper');put(m,55,23,5,64,64,False,'ventilation');put(m,56,22,15,64,96,True,'cleaning')
   for x in (10,20):put(m,52,x,21,32,32,False,'drain')
   inspect(m,9,20,'손 씻기','물을 틀고 비누로 손을 씻었다. 작은 생활 습관도 미래의 건강을 지키는 준비다.')
   inspect(m,16,14,'개별 칸','칸막이와 문이 개인의 공간을 지켜 준다. 다른 사람의 이용을 방해하지 않고 지나가자.')
   m['npcs']=[]
  elif kind=='classroom':
   put(m,10,11,5,192,64,False);put(m,65,14,8,64,64)
   for y in (12,15,18,21):
    for x in (7,10,13,18,21,24):put(m,2,x,y,48,48)
   put(m,39,6,6,96,64);put(m,56,24,8,64,96)
  elif kind=='cafe':
   fill(m,7,9,18,4,12);put(m,12,9,7,192,128);put(m,44,21,8,96,96)
   for x,y in [(7,14),(12,14),(19,14),(23,14),(7,20),(12,20),(20,20)]:put(m,33,x,y,64,64)
   fill(m,18,20,7,4,24);put(m,34,21,22,96,64)
  elif kind=='science':
   for x,y in [(7,12),(18,12),(7,19),(18,19)]:put(m,13,x,y,96,96)
   put(m,48,20,7,128,96);put(m,51,7,7,96,96);put(m,67,25,7,32,64,False)
  elif kind=='technology':
   for x,y in [(7,12),(18,12),(7,19),(18,19)]:put(m,60,x,y,128,96)
   put(m,61,10,6,160,96);put(m,67,24,7,32,64,False)
  elif kind=='homeeconomics':
   put(m,57,7,7,160,96);put(m,58,23,7,64,96);put(m,59,19,16,128,96)
   for x,y in [(7,15),(12,15),(8,21)]:put(m,33,x,y,64,64)
   put(m,36,18,7,128,96)
  elif kind=='computer':
   for x in (7,12,19,23):
    for y in (12,18):put(m,14,x,y,64,64)
   put(m,10,11,5,160,64,False);put(m,68,22,7,64,64)
  elif kind=='music':
   put(m,37,9,8,128,96);put(m,63,20,7,128,128)
   for x in (7,12,18,23):
    for y in (16,21):put(m,62,x,y,64,64)
  elif kind=='art':
   put(m,64,20,7,128,96);put(m,51,7,7,96,96)
   for x,y in [(7,13),(13,13),(21,14),(8,21),(19,21)]:put(m,38,x,y,64,96)
  elif kind=='hospital':
   put(m,65,7,9,96,64);put(m,67,7,6,64,64,False);put(m,70,23,9,32,64)
   for x,y in [(8,14),(19,14),(8,20),(19,20)]:put(m,41,x,y,64,96);put(m,69,x+2,y,64,96)
  elif kind=='library':
   for x,y in [(7,8),(13,8),(20,8),(7,15),(20,15)]:put(m,3,x,y,96,96)
   put(m,71,8,21,128,96);put(m,72,24,19,48,64);put(m,43,14,16,96,96)
  elif kind=='home':
   fill(m,6,10,7,8,24);put(m,35,7,10,96,128);put(m,39,6,6,96,96);put(m,36,19,7,160,96);put(m,58,24,7,64,96);put(m,33,19,13,64,64);fill(m,17,19,7,5,26);put(m,34,19,20,128,96);put(m,3,7,19,96,96)
  elif kind=='nursery':
   put(m,75,8,7,128,96);put(m,75,20,7,128,96);fill(m,7,14,16,8,24)
   for x,y in [(8,14),(18,14)]:put(m,42,x,y,128,96)
   put(m,34,20,22,96,64)
  elif kind=='welfare':
   put(m,65,7,9,64,64);put(m,74,20,8,128,96);put(m,73,8,16,128,96);put(m,34,20,21,96,64);put(m,43,19,15,96,96)
  elif kind=='shop':
   for x,y in [(7,8),(13,8),(20,8),(7,15),(20,15)]:put(m,44,x,y,96,96)
   put(m,65,9,21,96,64);put(m,39,23,21,64,64)
  elif kind=='gym':
   for x,y in [(7,11),(18,11),(7,19),(18,19)]:put(m,74,x,y,128,96)
   put(m,39,20,6,128,96)
  else:
   put(m,76,7,6,96,96);put(m,68,22,8,64,64);put(m,73,8,18,128,96)
   for x,y in [(10,11),(19,11),(20,19)]:put(m,14,x,y,96,64)
  if kind!='restroom':
   inspect(m,6,11,'공간 안내',SPECS[kind][0]+'을 위한 공간이다. '+SPECS[kind][1]+'이 눈에 들어온다.')
   inspect(m,25,24,'창가에서 쉬기','잠시 숨을 고르며 지금 내게 필요한 건강, 여가, 관계를 떠올렸다.')
   for n in m['npcs']:n.pop('quest',None);n['x']=16;n['y']=12;n['text']='오늘은 어떤 하루를 보내고 싶나요? 서로 다른 삶과 가족의 모습을 존중해요.'
  specs.append(dict(map=m['id'],name=m['name'],type=kind,purpose=SPECS[kind][0],materials=SPECS[kind][1],assets=SPECS[kind][2],entrance=[16,28],layoutStatus='provisional; real school plan pending'))
 # No repeated clue prerequisites. Distinct interactive events in the same coherent day.
 for m in maps.values():
  for n in m['npcs']:n.pop('quest',None)
  for o in m['interactions']:o.pop('clue',None);o.pop('quest',None)
 school=maps['school'];school['npcs'].append(dict(x=62,y=51,name='기술썜',variant=5,quest='teacher',text='교정에서 오래된 다이어리를 찾았구나. 네가 살아갈 미래에는 어떤 하루가 기다릴까?'))
 school['interactions']=[dict(x=64,y=51,label='미래 다이어리',quest='intro',text='나의 선택과 우리가 함께 준비한 미래를 만나 보자.')]
 for id,q in [('cafe','life'),('care','care'),('hall','policy')]:maps[id]['npcs'][0]['quest']=q
 maps['cafe']['interactions'].append(dict(x=16,y=15,label='오늘의 교대표',quest='day',text='일과 쉼을 나누는 시간표'))
 for id in ('home','shared','rental'):maps[id]['npcs'].append(dict(x=16,y=20,name='미래의 나',quest='retire',variant=35,text='내 삶은 여전히 새로운 선택으로 이어지고 있어.'))
 # Densify around the plaza while retaining the large explorable districts.
 town=maps['town']
 for m in (town,school):
  for y in range(m['height']):
   for x in range(m['width']):
    j=y*m['width']+x;t=m['tiles'][j]
    if t in (1,2):m['tiles'][j]=40+(x//2+y)%4 if t==1 else 28+(x+y)%4
  for o in m['objects']:o.setdefault('role','landmark' if o['asset']>=16 else 'landscape')
 for x,y in [(120,119),(134,119),(120,132),(136,132),(115,125),(141,125)]:put(town,46,x,y,96,64);put(town,47,x+2,y-1,32,96)
 # A curved riverbank promenade with continuous walkable bridges.
 for y in range(25,238):
  x=181+round(math.sin(y/17)*3);fill(town,x,y,4,1,40+(y%4))
 for y in (48,92,132,180,222):fill(town,177,y,22,7,16)
 for y in range(30,232,14):put(town,9,179,y,96,64);put(town,46,177,y+4,96,64)
 for x in range(48,82,4):
  if 60<=x<=67:continue
  put(school,79,x,59,128,64)
 for x,y in [(55,52),(69,52),(56,62),(68,62)]:put(school,46,x,y,96,64)
 # Optional future overlays are data, not destructive modifications to base geometry.
 for m in maps.values():m['futureLayers']=[]
 for id,x,y in [('school',66,47),('town',135,130),('welfare',17,24)]:maps[id]['futureLayers'].append(dict(when='access',objects=[dict(asset=77,x=x,y=y,w=96,h=64)],label='모두를 위한 이동 환경'))
 for id,x,y in [('school',57,52),('town',122,132),('culture',18,19)]:maps[id]['futureLayers'].append(dict(when='community',objects=[dict(asset=78,x=x,y=y,w=128,h=96),dict(asset=9,x=x+4,y=y,w=96,h=64)],label='함께 가꾸는 정원'))
 for id,x,y in [('floor1',34,44),('care',20,21),('school',69,53)]:maps[id]['futureLayers'].append(dict(when='care',objects=[dict(asset=75,x=x,y=y,w=96,h=64)],label='돌봄과 배움의 자리'))
 maps['floor2']['futureLayers'].append(dict(when='community',objects=[dict(asset=43,x=43,y=44,w=96,h=64)],label='세대가 함께 읽는 학교'))
 for id in ('home','rental','shared'):
  maps[id]['futureLayers'].append(dict(when='home',objects=[dict(asset=78,x=10,y=22,w=96,h=64)],label='내 생활에 맞춘 집'))
 # Compact furnished interiors without reducing the 32x32 map envelope.
 # Characters keep their native frame size; walking aisles and furniture share one scale.
 for m in maps.values():
  if m['kind']!='room':continue
  oldtiles=m['tiles'][:];m['tiles']=[7]*1024;m['solid']=[1]*1024
  for y in range(8,24):
   for x in range(7,25):
    sx=min(27,round(16+(x-16)/.75));sy=min(25,round(16+(y-16)/.75));t=oldtiles[sy*32+sx]
    m['tiles'][y*32+x]=t;m['solid'][y*32+x]=int(t in (7,32,33,34,35))
  fill(m,15,23,3,6,40)
  def compact(o):
   o['x']=round(16+(o['x']-16)*.75);o['y']=round(16+(o['y']-16)*.75)
   if 'w' in o:o['w']=max(32,round(o['w']*.75/32)*32);o['h']=max(32,round(o['h']*.75/32)*32)
  for o in m['objects']:
   was_solid='collision' in o;compact(o)
   if o['asset']==2:o['w']=48;o['h']=48
   if was_solid:
    by=int(o['y']+o['h']/32-.5);bw=max(1,math.ceil(o['w']/32)-1);o['collision']=[o['x'],by,bw,1]
    for xx in range(o['x'],min(32,o['x']+bw)):m['solid'][by*32+xx]=1
  for o in m['npcs']+m['interactions']:compact(o)
  for layer in m['futureLayers']:
   for o in layer['objects']:compact(o)
  m['spawn']=[16,24]
 # School learning choices must produce a visible learning space too.
 maps['school']['futureLayers'].append(dict(when='learning',objects=[dict(asset=80,x=59,y=53,w=96,h=96),dict(asset=43,x=68,y=54,w=96,h=64)],label='지역과 함께 배우는 학교'))
 maps['floor2']['futureLayers'].append(dict(when='learning',objects=[dict(asset=43,x=43,y=44,w=96,h=64)],label='지역 배움 교실'))
 maps['cafe']['futureLayers'].extend([
  dict(when='earning',objects=[dict(asset=80,x=19,y=18,w=64,h=64)],label='저축과 교대 근무 기록'),
  dict(when='balanced',objects=[dict(asset=73,x=18,y=18,w=96,h=64)],label='함께 정하는 교대표'),
  dict(when='resting',objects=[dict(asset=43,x=18,y=18,w=96,h=64)],label='쉬며 읽고 만나는 자리')])
 # Walkable points are validated and graph connections exported for automatic cross-map routes.
 catalog=[]
 for m in maps.values():
  for p in m['portals']:m['solid'][int(p['y'])*m['width']+int(p['x'])]=0
  for n in m['npcs']+m['interactions']:m['solid'][int(n['y'])*m['width']+int(n['x'])]=0
  save(data/'maps'/f"{m['id']}.json",m);catalog.append({k:m[k] for k in ('id','name','kind','width','height','spawn')})
 save(data/'catalog.json',catalog);save(data/'connections.json',{m['id']:m['portals'] for m in maps.values()});save(data/'space_specs.json',specs)
 choices=[
 dict(id='life',title='일과 집, 나의 첫 하루',place='cafe',target=[16,12],concept='고용·주거 부담과 청년 지원',story='일자리와 집을 함께 찾아보자. 수입뿐 아니라 통근 시간과 쉬는 공간도 중요해.',choices=[['기술 일을 배우며 지원 임대주택에서 살기','학습과 주거 지원이 시작됐다. 새로운 일을 배우는 시간이 필요하다.',{'money':8,'support':8,'time':-4},'배움과 주거 지원'],['동네 협동조합에서 일하며 공동주거에서 살기','이웃과 생활비를 나누고 함께 일한다. 공동 공간의 약속도 필요하다.',{'relations':8,'community':8,'money':3},'이웃과 함께하는 생활'],['유연한 카페 근무와 작은 독립주택 선택','근무 일정을 조정하기 쉽다. 독립 공간의 주거비는 더 마련해야 한다.',{'time':8,'leisure':5,'money':-5},'나에게 맞춘 시간']]),
 dict(id='day',title='오늘의 일과 쉼',place='cafe',target=[16,15],concept='경제생활·휴식·일과 생활의 조화',story='카페의 오후가 바빠졌다. 교대표를 살펴보고 오늘의 시간을 나눠 보자.',choices=[['짧은 교대 근무를 돕고 저축하기','생활비에 여유가 생겼다. 쉬는 시간도 다음 일정에 남겨 두었다.',{'money':7,'time':-4},'수입과 준비'],['교대 시간을 함께 조정하기','동료와 일과 돌봄 시간을 나눴다. 서로 가능한 시간을 확인했다.',{'time':6,'relations':5},'함께 만드는 시간표'],['계획한 휴식과 만남을 지키기','무리한 소비를 줄이며 쉬었다. 건강과 관계도 삶을 지탱한다.',{'health':6,'leisure':7,'relations':4,'money':-3},'건강과 관계의 시간']]),
 dict(id='care',title='겹친 시간, 함께 돌보는 하루',place='care',target=[16,12],concept='돌봄의 사회적 책임·평등한 역할·고령화',story='아이를 돌보는 이웃과 부모의 병원 방문을 돕는 동료의 시간이 겹쳤다. 한 사람에게만 맡기지 않는 방법을 찾아보자.',choices=[['공공 돌봄과 유연근무 연결','이용 가능한 돌봄 시간이 늘고 동료가 교대를 나눈다. 필요한 서비스는 계속 확인한다.',{'care':12,'support':8,'time':5},'공공 돌봄 연결'],['가족과 이웃의 공평한 역할표','동의한 참여자들이 가능한 시간을 나눈다. 개인의 노력과 함께 공적 지원도 필요하다.',{'care':8,'relations':10},'평등한 역할 나누기'],['저녁 돌봄과 방문 지원 확대 제안','센터에 저녁 돌봄 자리와 방문 지원 안내가 생겼다. 운영 인력도 함께 준비해야 한다.',{'care':10,'community':8,'support':6},'돌봄 공백 줄이기']]),
 dict(id='policy',title='함께 준비하는 미래의 마을',place='hall',target=[16,12],concept='고령 친화 환경·세대 협력·사회적 준비',story='나이 든 주민도 늘고 일손과 돌봄의 필요도 달라졌다. 한정된 예산으로 먼저 준비할 조합을 골라 보자.',choices=[['일자리·주거와 배움의 기회','학교에 지역 배움 자리가 생기고 청년의 생활 지원이 연결됐다. 의료와 돌봄도 계속 논의한다.',{'money':7,'support':9,'community':4},'일자리와 배움'],['이동 안전·의료·돌봄 접근','학교와 복지관에 접근성 시설과 쉬어 갈 자리가 생겼다. 문화 기회도 이어서 준비한다.',{'health':8,'care':9,'support':8},'안전한 이동과 돌봄'],['세대가 함께하는 정원·문화','학교와 광장에 함께 읽고 가꾸는 공간이 생겼다. 주거 부담에 대한 대응도 필요하다.',{'relations':10,'leisure':9,'community':10},'세대가 함께하는 공간']]),
 dict(id='retire',title='미래의 나, 오늘을 다시 설계하다',place='home',target=[16,20],concept='노후 준비: 재무·건강·여가·대인 관계',story='나이 든 나의 하루에도 배움과 만남은 이어진다. 생활비, 몸의 상태, 즐길 일, 만날 사람을 함께 떠올려 보자.',choices=[['작은 저축·산책·취미·만남을 일주일에 나누기','네 영역을 일상에 조금씩 배치했다. 필요할 때 계획을 바꿀 수 있다.',{'money':3,'health':4,'leisure':4,'relations':4},'작게 꾸준히 준비하기'],['상담과 지역 자원, 이웃 관계 연결하기','혼자 감당하기 어려운 부분을 함께 준비한다. 이용 가능한 지원을 확인한다.',{'support':9,'care':5,'relations':7},'연결하며 준비하기'],['새 활동을 배우고 생활 계획 조정하기','상황과 관심이 달라져도 다시 시작할 수 있다. 재무와 건강 계획도 함께 살핀다.',{'leisure':8,'health':4,'community':6},'배우며 다시 설계하기']])]
 for q in choices:
  q['target']=[round(16+(q['target'][0]-16)*.75),round(16+(q['target'][1]-16)*.75)]
 save(data/'quests.json',choices)
 print('V2: 5 life choices, purpose-specific rooms, graph navigation, future layers')
