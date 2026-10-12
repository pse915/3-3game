"""Original world/content authoring. Run to rebuild deterministic map data and 32px tiles."""
from pathlib import Path
import json, random
from PIL import Image, ImageDraw,ImageColor
ROOT=Path(__file__).parent/'components/rpg_game'
DATA=ROOT/'data'; ASSETS=ROOT/'assets'
def write(path,value):
    path.parent.mkdir(parents=True,exist_ok=True)
    path.write_text(json.dumps(value,ensure_ascii=False,separators=(',',':')),encoding='utf-8')
random.seed(915)
tile=Image.new('RGBA',(32*12,32)); d=ImageDraw.Draw(tile)
colors=['#8dab78','#dbcdb0','#b6b8b0','#9cc9c7','#cabb9e','#e7ddc8','#997b71','#647d68','#e0c996','#b59da8','#768d77','#ddaa97']
for i,c in enumerate(colors):
 x=i*32;d.rectangle((x,0,x+31,31),fill=c)
 rgb=ImageColor.getrgb(c)
 def shade(v):return tuple(max(0,min(255,k+v)) for k in rgb)+(255,)
 for k in range(12):
  a=x+random.randrange(32);b=random.randrange(32)
  d.line((a,b,min(x+31,a+random.randrange(1,3)),b),fill=shade(5 if k%2 else -4))
 if i in [1,2,4,5,8,9]:
  d.line((x,31,x+31,31),fill=shade(-9));d.line((x+31,0,x+31,31),fill=shade(-7))
 if i in [4,8]:
  for y in (7,15,23):d.line((x,y,x+31,y),fill=shade(-6))
 if i==6:
  for y in (0,8,16,24):
   d.line((x,y,x+31,y),fill='#d2b4a1');s=0 if y%16 else 8
   for a in range(s,32,16):d.line((x+a,y,x+a,y+8),fill='#d2b4a1')
 if i==3:
  for y in (6,19,26):d.line((x+4,y,x+16,y),fill='#c1e0cf')
tile.save(ASSETS/'terrain.png')
teachers=[('1-1','기술썜','일본어/진로활동'),('1-2','기술썜','기술가정'),('1-3','기술썜','음악'),('1-4','기술썜','수학'),('1-5','기술썜','과학'),('2-1','기술썜','한문'),('2-2','기술썜','수학'),('2-3','기술썜','과학'),('2-4','기술썜','역사'),('2-5','기술썜','국어'),('2-6','기술썜','음악/스포츠'),('3-1','기술썜','국어'),('3-2','기술썜','영어'),('3-3','기술썜','사회/역사'),('3-4','기술썜','수학'),('3-5','기술썜','사회'),('3-6','기술썜','도덕')]
floors=[['중앙현관','행정실','교장실','보건실','학생자치공간','자료실','행정자료실','학습지원실1','학습지원실2','방송실','과학교과연구실','과학실1','과학실2','과학실3','교육공무직원 관련 공간'],['1학년 교무실','교무센터','영어활동실','기술실','가정실','미술실','미술교과연구실','정보교과연구실','체력단련실'],['2학년 교무실','컴퓨터실','진로상담실','Wee클래스','자기주도배움터','다목적실','수학교과지원실'],['3학년 교무실','음악실1','음악실2','음악교과연구실','국어 관련 교과 공간','국어도서관']]
catalog=[]
def new(id,name,w,h,kind='room',floor=None):
 return dict(id=id,name=name,width=w,height=h,kind=kind,floor=floor,spawn=[16,25],tiles=[0]*(w*h),solid=[0]*(w*h),objects=[],portals=[],npcs=[],interactions=[])
def rect(m,x,y,w,h,t,s=0):
 for yy in range(max(0,y),min(m['height'],y+h)):
  for xx in range(max(0,x),min(m['width'],x+w)):
   j=yy*m['width']+xx;m['tiles'][j]=t;m['solid'][j]=s
def obj(m,asset,x,y,w,h,solid=True):
 m['objects'].append(dict(asset=asset,x=x,y=y,w=w,h=h))
 if solid:rect(m,int(x),int(y+h/32-.6),max(1,int(w/32)),1,m['tiles'][min(m['height']-1,int(y+h/32-.6))*m['width']+int(x)],1)
def portal(m,x,y,target,label,arrival):m['portals'].append(dict(x=x,y=y,target=target,label=label,arrival=arrival))
def interaction(m,x,y,label,text,quest=None,clue=None):m['interactions'].append(dict(x=x,y=y,label=label,text=text,quest=quest,clue=clue))
def save(m):
 write(DATA/'maps'/f"{m['id']}.json",m);catalog.append({k:m[k] for k in ('id','name','kind','width','height','spawn')})
def room(id,name,kind,back,arrival,teacher=None,quest=None,seed=0):
 r=random.Random(seed);m=new(id,name,32,32);m['style']=kind;m['spawn']=[16,27]
 rect(m,0,0,32,32,7,1);rect(m,3,4,26,25,4 if kind in ['cafe','home','library'] else 5)
 rect(m,3,3,26,3,6 if kind=='cafe' else 9,1)
 portal(m,16,28,back,'나가기',arrival)
 if kind in ['classroom','science','technology']:obj(m,10,11,4,224,64)
 for x in [5,23]:obj(m,40,x,3,96,96,False)
 obj(m,45,4,9,64,64,False);obj(m,3,25,8,64,96)
 for x in [4,26]:obj(m,11,x,6,48,64)
 if kind=='classroom':
  for y in [11,14,17,20,23]:
   for x in [7,10,13,18,21,24]:obj(m,2,x,y,48,48)
  obj(m,3,4,5,80,96);obj(m,14,23,6,64,64)
 elif kind=='cafe':
  obj(m,12,9,6,224,160)
  for x,y in [(7,14),(12,14),(19,14),(24,14),(7,20),(12,20),(19,20),(24,20)]:obj(m,33,x,y,64,64)
  obj(m,34,10,24,96,64);obj(m,46,20,24,96,64)
 elif kind in ['science','technology']:
  for x,y in [(6,12),(20,12),(6,20),(20,20)]:obj(m,13 if kind=='science' else 14,x,y,96,96)
 elif kind=='library':
  for x in (4,11,21):
   for y in (7,16):obj(m,3,x,y,96,96)
  obj(m,43,13,21,96,96)
 elif kind=='home':
  obj(m,35,5,15,96,160);obj(m,36,19,6,192,96);obj(m,34,18,20,128,96);obj(m,33,11,19,64,64)
 elif kind=='nursery':
  for x,y in [(7,14),(20,14),(10,21)]:obj(m,42,x,y,128,96)
 elif kind=='hospital':
  for x,y in [(6,14),(21,14),(6,21),(21,21)]:obj(m,41,x,y,96,128)
 elif kind=='music':
  obj(m,37,10,8,160,128)
  for x,y in [(7,18),(14,18),(21,18)]:obj(m,43,x,y,96,96)
 elif kind=='art':
  for x,y in [(7,12),(21,12),(7,21),(21,21)]:obj(m,38,x,y,96,128)
 else:
  for x,y in [(6,15),(21,15),(6,22)]:obj(m,14,x,y,96,96)
  obj(m,34,20,22,128,96)
 labels=[('게시판','주민의 시간표에는 일과 휴식, 돌봄이 함께 놓여 있다.'),('자료 책장','주거와 고용의 불안정, 돌봄 부담은 개인의 노력만으로 해결하기 어렵다.'),('생활 기록','서로 다른 가족과 삶의 방식은 존중받아야 한다.'),('창가의 메모','재무·건강·여가·대인 관계는 노후 준비의 네 영역이다.')]
 for j,(label,text) in enumerate(labels):interaction(m,[5,25,5,25][j],[11,11,24,24][j],label,text,clue=quest if j<2 else None)
 if teacher:
  cls,n,subject=teacher;m['npcs'].append(dict(x=16,y=9,name=n,subject=subject,variant=4+teachers.index(teacher),text=f'{subject} 수업의 가상 대화예요. 나에게 소중한 시간을 떠올려 볼까요? 어떤 삶이 우수한지 순위를 매기지는 않아요.'))
  if cls=='1-2':interaction(m,16,11,'미래 다이어리','너의 미래는 정해져 있지 않아. 다이어리를 펼쳐 미래마을로 걸어가 보자.',quest='intro');obj(m,15,15,11,48,48,False)
 elif quest:m['npcs'].append(dict(x=16,y=11,name={'job':'진로 안내자 윤슬','housing':'주민 다온','care':'돌봄 활동가 보람','elder':'주민 은빛','generation':'문화 기획자 하람','policy':'마을 안내자 누리','retire':'미래의 나','budget':'카페지기 소담'}.get(quest,'주민'),variant={'job':32,'housing':34,'care':27,'elder':35,'generation':30,'policy':33,'retire':36,'budget':25}[quest],quest=quest,text='함께 이 동네의 이야기를 바꿔 볼래요?'))
 else:m['npcs'].append(dict(x=16,y=11,name='공간 안내자',variant=21+seed%12,text=f'{name}에서 잠깐 쉬어 가요. 다이어리에 오늘의 생각을 기록할 수 있어요.'))
 save(m)
school=new('school','서라벌여중 · 교정',128,128,'outside');school['spawn']=[64,52]
rect(school,49,35,30,72,1);rect(school,31,75,70,28,8);rect(school,59,100,10,28,2)
# Modular brick building with an L footprint, pending real plan validation.
obj(school,32,35,17,1728,896)
rect(school,35,32,54,13,0,1);rect(school,35,17,8,28,0,1)
portal(school,64,46,'floor1','중앙현관',[58,45])
interaction(school,64,51,'빛나는 다이어리','어느 날, 운동장 가장자리에서 신비로운 다이어리를 발견했다. 미래마을의 여덟 이야기를 만나 나만의 삶을 기록해 보자.',quest='intro');obj(school,15,63,49,64,64,False)
for x,y in [(52,49),(72,49),(52,55),(72,55)]:obj(school,1,x,y,96,128);obj(school,9,x+3,y+1,96,64)
portal(school,64,119,'town','미래마을로',[128,116])
for j in range(180):
 x=random.randrange(8,120);y=random.randrange(5,118)
 if not (30<x<104 and 15<y<110):obj(school,j%2,x,y,96,128)
save(school)
for f in range(1,5):
 m=new(f'floor{f}',f'서라벌여중 · {f}층',96,96,'floor',f);m['spawn']=[58,45]
 rect(m,0,0,96,96,7,1);rect(m,15,40,72,12,5);rect(m,15,10,12,42,5)
 rect(m,14,9,1,43,9,1);rect(m,15,9,12,1,9,1);rect(m,27,39,60,1,9,1)
 rooms=[(t[0],t) for t in teachers if int(t[0][0])+1==f]+[(n,None) for n in floors[f-1]]+ [('화장실',None)]
 for k,(name,t) in enumerate(rooms):
  x,y=(31+(k%8)*7,40 if k<8 else 51) if k<16 else (16,14+(k-16)*7)
  rid=f'room-{f}-{k}';label=f'{name[0]}학년 {name[-1]}반' if t else name
  portal(m,x,y,rid,label,[16,26]);obj(m,5,x-1,y-2,64,64,False)
  typ='classroom' if t else 'science' if '과학' in name else 'technology' if any(s in name for s in ['기술','컴퓨터','정보']) else 'library' if any(s in name for s in ['도서','자료','국어']) else 'music' if '음악' in name else 'art' if '미술' in name else 'hospital' if '보건' in name else 'home' if '가정' in name else 'office'
  room(rid,label,typ,m['id'],[x,y+2 if y==40 else y-2],t,seed=f*100+k)
 for dest in range(1,5):
  if dest!=f:portal(m,18+(dest-1)*2,46,f'floor{dest}',f'엘리베이터 · {dest}층',[25,46])
 if f==1:portal(m,58,51,'school','교정으로',[64,49])
 for x in range(31,85,14):obj(m,11,x,47,48,64)
 save(m)
town=new('town','미래마을 · 느린 내일의 거리',256,256,'town');town['spawn']=[128,122]
rect(town,0,0,256,256,0)
for y in (48,92,132,180,222):rect(town,12,y,232,7,1);rect(town,12,y+3,232,1,2)
for x in (40,84,124,170,216):rect(town,x,10,7,236,1)
rect(town,108,110,42,36,2);rect(town,188,0,9,256,3,1)
for y in (48,92,132,180,222):rect(town,187,y,11,7,4)
obj(town,8,125,124,128,128);interaction(town,128,130,'광장의 오래된 편지','세대가 함께 쓰는 공간에는 여러 목소리가 필요하다.',clue='generation')
buildings=[('cafe','내일의 카페',6,115,109,'cafe','budget'),('career','직업상담센터',7,134,108,'technology','job'),('rental','청년 임대주택',7,67,78,'home','housing'),('care','돌봄센터',7,151,120,'home','care'),('welfare','노인복지관',7,102,149,'library','elder'),('culture','문화공방',6,151,151,'library','generation'),('hall','마을회관',7,113,165,'technology','policy'),('home','미래의 집',6,68,161,'home','retire'),('hospital','병원',7,202,118,'science',None),('library','마을도서관',7,204,164,'library',None),('bakery','햇살 빵집',6,56,117,'cafe',None),('shop','골목 소품점',6,23,75,'cafe',None),('office','함께 일하는 사무실',7,99,76,'technology',None),('nursery','어린이집',6,152,76,'home',None),('shared','이웃 공동주거',7,61,206,'home',None),('mart','동네 편의점',6,204,77,'cafe',None)]
for j,(id,name,asset,x,y,kind,q) in enumerate(buildings):
 if id in ['care','nursery']:kind='nursery'
 if id=='hospital':kind='hospital'
 rect(town,x-1,y+5,9,5,1);obj(town,16+j,x,y,224,224);portal(town,x+3,y+7,id,name,[16,26]);room(id,name,kind,'town',[x+3,y+9],quest=q,seed=j)
 rect(town,x+1,y+1,5,5,0,1)
town['npcs']=[dict(x=122+j%4*5,y=118+j//4*9,name=['산책하는 이웃','청년 주민','공방 수강생','마을 정원사'][j%4],variant=25+j,text='이 마을의 제도와 환경도 우리의 선택에 영향을 줘요.') for j in range(12)]
for j in range(1300):
 x=random.randrange(4,250);y=random.randrange(4,250)
 if any(abs(x-bx)<10 and abs(y-by)<11 for _,_,_,bx,by,_,_ in buildings):continue
 if town['tiles'][y*256+x]!=0 or 104<x<153 and 104<y<149:continue
 obj(town,j%2,x,y,96,128)
for x,y in [(115,121),(140,121),(116,137),(142,137),(178,135),(178,177)]:obj(town,9,x,y,96,64)
for x,y in [(111,117),(142,114),(112,129),(140,130)]:obj(town,1,x,y,96,128)
for x,y in [(119,117),(135,117),(120,131),(136,131)]:obj(town,47,x,y,32,96);obj(town,46,x+1,y+2,64,48)
portal(town,128,111,'school','학교로 돌아가기',[64,116]);save(town)
write(DATA/'catalog.json',catalog);write(DATA/'teachers.json',[dict(classroom=a,name=b,subject=c,fictionalAppearance=True) for a,b,c in teachers])
quests=[
 dict(id='job',title='나에게 맞는 일',place='career',concept='고용 불안정 · 청년 일자리',story='채용 공고는 많지만 계약 기간과 근무 시간이 모두 다르다. 게시판과 책장을 살펴보고 나의 조건을 정해 보자.',choices=[['배우며 일하는 기술 직무','학습 기회가 늘고 당분간 여유 시간은 줄어든다.',{'money':8,'time':-7,'leisure':-3},'기술을 배우는 일'],['지역 협동조합의 일','소득의 상승 폭은 작지만 주민과 함께 결정할 수 있다.',{'money':3,'relations':8,'community':9},'협동조합의 일'],['유연근무가 가능한 일','일정 조정이 쉽다. 안정적인 계약인지 확인하는 과정도 필요하다.',{'time':8,'money':2,'care':5},'유연근무의 일']]),
 dict(id='housing',title='나의 첫 번째 집',place='rental',concept='주거 부담 · 사회적 지원',story='집을 구하는 다온은 보증금과 통근 시간을 함께 고민한다. 임대 안내와 생활 자료를 조사하자.',choices=[['지원 임대주택','주거비 부담이 줄지만 입주 조건과 위치를 확인해야 한다.',{'money':9,'time':-3,'support':8},'지원 임대주택'],['공동주거','공용 공간 규칙을 함께 정하고 생활비를 나눈다.',{'money':6,'relations':8,'time':-2},'공동주거'],['작은 독립주택','혼자 쉬는 공간을 확보하고 더 많은 주거비를 배정한다.',{'money':-8,'leisure':8,'time':3},'독립주거']]),
 dict(id='budget',title='카페의 바쁜 오후',place='cafe',concept='경제생활 · 시간과 소비',story='카페지기 소담이 갑자기 바쁜 시간을 맞았다. 근무표와 생활비 자료를 확인하고 오늘의 오후를 선택하자.',choices=[['짧은 교대 근무를 돕는다','보수를 얻고 쉬려던 시간 일부를 사용한다.',{'money':8,'time':-6,'relations':3},'수입과 휴식 나누기'],['교대 시간을 함께 재설계한다','협의 시간이 필요하지만 앞으로 쉴 시간이 생긴다.',{'time':6,'community':6,'money':-2},'지속 가능한 시간표'],['계획한 휴식을 지킨다','소비 한도를 정하고 친구와 여가를 보낸다.',{'money':-4,'health':5,'leisure':9},'계획된 소비와 휴식']]),
 dict(id='care',title='겹쳐 버린 두 시간표',place='care',concept='일·가정 양립 · 평등한 돌봄',story='주민의 근무와 가족 돌봄 시간이 겹쳤다. 돌봄을 한 사람에게만 맡기지 않는 방법을 찾아보자.',choices=[['공공 돌봄과 유연근무를 연결한다','서비스 운영 시간과 이용 조건을 먼저 확인한다.',{'care':14,'support':9,'time':4},'공공 돌봄 연결'],['가족·이웃과 공평한 역할표를 만든다','동의한 참여자들이 가능한 시간을 나눈다. 공적 지원도 계속 필요하다.',{'care':8,'relations':10,'time':-4},'평등한 역할 분담'],['마을의 저녁 돌봄 확대를 제안한다','당장의 공백은 별도 지원으로 메우고 제도 개선을 요청한다.',{'care':6,'community':12,'support':7},'돌봄 운영 시간 개선']]),
 dict(id='elder',title='집 밖으로 이어지는 길',place='welfare',concept='고령 친화 환경 · 의료와 돌봄',story='은빛 주민은 버스 정류장 계단 때문에 모임에 자주 오지 못한다. 생활 기록과 이용 안내를 확인하자.',choices=[['이동 지원과 안전한 길을 연결한다','외출 선택지가 늘어난다. 교통 운영비도 함께 필요하다.',{'health':7,'relations':6,'support':10},'이동 지원'],['방문 건강관리와 모임을 연결한다','의료 접근과 사회적 관계를 함께 고려한다.',{'health':12,'care':6,'relations':4},'건강·관계 연결'],['주민과 접근성 개선 지도를 만든다','당사자의 의견을 바탕으로 마을 개선에 참여한다.',{'community':12,'relations':8,'time':-4},'접근성 지도']]),
 dict(id='generation',title='모두의 오후 공원',place='culture',concept='세대 간 이해와 협력',story='조용히 쉬고 싶은 주민과 공연 연습을 하고 싶은 주민이 같은 공간을 원한다. 서로의 이용 기록을 살펴보자.',choices=[['시간을 나누어 사용한다','시간표를 정기적으로 다시 협의한다.',{'time':4,'relations':8,'leisure':6},'시간을 나누는 공원'],['조용한 쉼터와 활동 구역을 나눈다','공간 배치와 접근성에 예산을 배정한다.',{'money':-4,'leisure':10,'community':8},'함께 쓰는 공원'],['세대가 함께하는 작은 행사를 연다','참여는 자유롭게 두고 조용한 시간도 보장한다.',{'relations':12,'community':8,'time':-3},'세대 협력 행사']]),
 dict(id='policy',title='한정된 예산, 함께 정하는 우선순위',place='hall',concept='사회적 책임 · 가족 친화 문화',story='이번 마을 예산으로 모든 사업을 동시에 확대하기는 어렵다. 의견 자료를 조사하고 먼저 추진할 조합을 정하자.',choices=[['주거 지원 + 청년 일자리','경제적 독립을 돕는다. 돌봄과 의료는 다음 예산에서도 논의해야 한다.',{'money':10,'support':10,'community':4},'주거·일자리 우선'],['돌봄 + 이동·의료 접근','일과 생활의 조화, 고령 주민의 일상을 지원한다.',{'care':10,'health':8,'support':10},'돌봄·의료 우선'],['문화·여가 + 세대 협력','관계와 참여 기회를 넓힌다. 주거 부담 해결도 계속 필요하다.',{'leisure':12,'relations':10,'community':10},'문화·협력 우선']]),
 dict(id='retire',title='미래의 내가 보내온 편지',place='home',concept='노후 준비: 재무·건강·여가·대인 관계',story='시간이 흘러 미래의 집에 도착했다. 네 영역의 기록을 살펴보고 앞으로 이어 갈 계획을 정하자.',choices=[['네 영역을 고르게 돌보는 주간 계획','작은 저축, 산책, 취미, 만남을 일상에 배치한다.',{'money':4,'health':4,'leisure':4,'relations':4},'작게 꾸준히 준비하기'],['사회적 지원과 이웃 관계를 먼저 찾는다','혼자 감당하기 어려운 부분은 상담과 지역 자원을 연결한다.',{'support':10,'relations':8,'care':5},'연결하며 준비하기'],['새로운 활동을 배우며 계획을 조정한다','지금의 상황과 관심에 맞추어 미래 계획을 다시 쓴다.',{'leisure':10,'health':4,'time':-3,'community':5},'배우며 다시 설계하기']])]
write(DATA/'quests.json',quests)
write(ASSETS/'manifest.json',dict(tileSize=32,characterFrame=[32,48],provenance='Original assets produced for this project; AI environment and character sheets, deterministic terrain authored in build_world.py.',assets=['terrain.png','environment.png','characters.png'],mapCount=len(catalog),referenceComparison='PENDING: reference images not attached',schoolPlan='PROVISIONAL: exact plan not supplied'))
print(f'Built {len(catalog)} maps and {len(teachers)} teacher records')

from world_v2 import upgrade
upgrade(ROOT)
