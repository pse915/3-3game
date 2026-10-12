// Touch-first work benches. Scores describe this practice session, never a life ranking.
export function budgetScore(values){const total=values.reduce((a,b)=>a+b,0);if(total>60||values.some(v=>!Number.isFinite(v)||v<0))return 0;return Number(values[0]>=20)+Number(values[1]>=10)+Number(values[2]>=15);}
export function patternScore(cells,target){return [0,1,2].reduce((n,row)=>n+Number(cells.slice(row*3,row*3+3).every((c,i)=>c===target[row*3+i])),0);}
export function runHandsOn(parent,type,onFinish){
 const box=document.createElement('section');box.dataset.testid='mini-'+type;box.setAttribute('aria-label','직업 실습 작업대');box.style.cssText='background:#fff9ee;padding:12px;border:2px solid #cbb3c9;border-radius:14px;margin:12px 0';parent.append(box);
 let finished=false;const text=(value)=>{const p=document.createElement('p');p.textContent=value;box.append(p);return p;};
 const status=text('직접 조작해 보세요. 연습은 다시 시작할 수 있어요.');status.setAttribute('aria-live','polite');
 const grid=(columns=3)=>{const div=document.createElement('div');div.style.cssText=`display:grid;grid-template-columns:repeat(${columns},minmax(0,1fr));gap:7px;margin:10px 0`;box.append(div);return div;};
 const button=(host,label,id,fn)=>{const b=document.createElement('button');b.type='button';b.textContent=label;b.dataset.testid='mini-'+type+'-'+id;b.style.cssText='min-width:44px;min-height:48px;padding:8px;touch-action:manipulation;font:inherit';b.onclick=()=>{if(!finished)fn(b);};host.append(b);return b;};
 const done=(score,message)=>{if(finished)return;finished=true;status.textContent=message+' · 다음 시도에서도 다시 배울 수 있어요.';for(const e of box.querySelectorAll('button,input'))e.disabled=true;onFinish(Math.max(0,Math.min(3,score)));};
 if(type==='recipe'){
  text('주문: 우유 없는 따뜻한 차. 작업 순서: 컵 확인 → 따뜻한 물 → 찻잎. 도구를 확인하고 재료를 순서대로 넣어요.');const order=[],board=grid();
  const update=()=>status.textContent='작업 기록: '+(order.join(' → ')||'빈 컵');
  for(const [id,label]of [['cup','컵 확인'],['water','따뜻한 물'],['tea','찻잎'],['milk','우유']])button(board,label,id,()=>{order.push(label);update();});
  button(box,'재료 다시 준비','reset',()=>{order.length=0;update();});button(box,'완성한 주문 전달','finish',()=>{const target=['컵 확인','따뜻한 물','찻잎'];done(order.includes('우유')?0:target.filter((v,i)=>order[i]===v).length,'주문 조건과 작업 순서를 확인했어요.');});
 }else if(type==='sequence'){
  text('로봇을 (1,1)에서 (3,3)까지 보내요. (2,1)은 장애물이에요. 아래 → 아래 → 오른쪽 → 오른쪽을 코드 블록으로 쌓고 실행해 보세요.');const commands=[],board=grid(2);let result=null;
  const update=()=>status.textContent='코드: '+(commands.join(' → ')||'아직 없음');
  for(const [id,label]of [['right','오른쪽'],['down','아래'],['left','왼쪽'],['up','위']])button(board,label,id,()=>{commands.push(label);result=null;update();});
  button(box,'코드 비우기','reset',()=>{commands.length=0;result=null;update();});
  button(box,'로봇 실행','run',()=>{let x=1,y=1,collision=false;for(const cmd of commands){const [dx,dy]={'오른쪽':[1,0],'아래':[0,1],'왼쪽':[-1,0],'위':[0,-1]}[cmd];const nx=x+dx,ny=y+dy;if(nx<1||ny<1||nx>3||ny>3||nx===2&&ny===1){collision=true;break;}x=nx;y=ny;}result={x,y,collision};status.textContent=`실행 결과 (${x},${y}) · ${collision?'벽에 막혔어요. 순서를 고쳐요.':x===3&&y===3?'도착했어요!':'아직 목표까지 이동해야 해요.'}`;});
  button(box,'검증한 코드 제출','finish',()=>{if(!result){status.textContent='먼저 로봇 실행을 눌러 결과를 확인해요.';return;}done(Number(!result.collision)+Number(result.x===3&&result.y===3)+Number(!result.collision&&commands.length===4),'코드가 실제 이동으로 이어지는지 시험했어요.');});
 }else if(type==='schedule'){
  text('연구 일정: 관찰 → 기록 → 비교. 세 시간 칸에 작업 카드를 넣어요. 조건을 관찰하고 기록한 뒤 자료를 비교해야 해요.');const labels=['관찰','기록','비교'],slots=[null,null,null];let selected=null;const cards=grid(),timeline=grid();
  labels.forEach((label,i)=>button(cards,label,'card-'+i,b=>{selected=i;for(const c of cards.children)c.setAttribute('aria-pressed',String(c===b));status.textContent=label+' 카드를 넣을 시간 칸을 누르세요.';}));
  slots.forEach((_,i)=>button(timeline,`${i+1}시간 · 빈 칸`,'slot-'+i,b=>{if(selected===null){status.textContent='먼저 작업 카드를 골라요.';return;}slots[i]=selected;b.textContent=`${i+1}시간 · ${labels[selected]}`;}));
  button(box,'연구 일정 실행','finish',()=>{if(slots.includes(null)){status.textContent='세 시간 칸을 모두 채워요.';return;}done(slots.filter((v,i)=>v===i).length,'자료를 관찰·기록·비교하는 흐름을 구성했어요.');});
 }else if(type==='budget'){
  text('고정 생활비를 낸 뒤 남은 자금은 60이에요. 비상금 20 이상, 즐거움 10 이상, 배움 15 이상을 목표로 봉투를 나누세요. 합계가 60을 넘으면 다시 조절해요.');const values=[0,0,0],labels=['비상금','즐거움','배움'];
  labels.forEach((label,i)=>{const wrapper=document.createElement('label');wrapper.style.cssText='display:block;padding:8px 0';const caption=document.createElement('span');caption.textContent=label+' 0';const input=document.createElement('input');input.type='range';input.min='0';input.max='60';input.step='5';input.value='0';input.dataset.testid='mini-budget-value-'+i;input.setAttribute('aria-label',label+' 봉투 금액');input.style.cssText='width:100%;height:48px;display:block';input.oninput=()=>{values[i]=Number(input.value);caption.textContent=label+' '+values[i];status.textContent='배분 합계 '+values.reduce((a,b)=>a+b,0)+' / 60';};wrapper.append(caption,input);box.append(wrapper);});
  button(box,'생활비 봉투 확정','finish',()=>{if(values.reduce((a,b)=>a+b,0)>60){status.textContent='남은 자금 60을 넘었어요. 봉투 금액을 줄여요.';return;}done(budgetScore(values),'즐거움·배움과 미래 자금을 함께 배분했어요.');});
 }else if(type==='route'){
  text('지원 물품을 상담 창구까지 배달해요. 출발은 왼쪽 위, 목표는 오른쪽 아래예요. 인접한 칸만 누를 수 있고 공사 구역은 지나갈 수 없어요.');const board=grid(5),blocked=new Set([2,7,12,17]),cells=[];let pos=0,steps=0;
  const refresh=()=>cells.forEach((b,i)=>{b.textContent=blocked.has(i)?'공사':i===pos?'나':i===24?'창구':'·';b.setAttribute('aria-label',`${Math.floor(i/5)+1}행 ${i%5+1}열 ${b.textContent}`);b.style.background=blocked.has(i)?'#d8ccc0':i===pos?'#e9bdcf':'#f2efe4';});
  for(let i=0;i<25;i++)cells.push(button(board,'·','cell-'+i,()=>{if(blocked.has(i)){status.textContent='공사 구역이에요. 다른 길을 찾아요.';return;}if(Math.abs(i%5-pos%5)+Math.abs(Math.floor(i/5)-Math.floor(pos/5))!==1){status.textContent='현재 위치 바로 옆 칸을 눌러요.';return;}pos=i;steps++;refresh();status.textContent=`${steps}번 이동 · ${pos===24?'상담 창구에 도착했어요.':'다음 안전한 칸을 골라요.'}`;}));refresh();
  button(box,'처음 위치로','reset',()=>{pos=0;steps=0;refresh();});button(box,'물품 전달','finish',()=>{if(pos!==24){status.textContent='물품을 전달하려면 먼저 창구까지 이동해요.';return;}done(steps<=10?3:steps<=14?2:1,'접근 가능한 경로를 직접 찾아 물품을 전달했어요.');});
 }else if(type==='pattern'){
  text('안내판 시안의 색 배치를 작업판에 재현해요. 색을 고르고 칸을 눌러 칠하세요. 색뿐 아니라 무늬도 함께 보여요.');const palette=['빈 칸','꽃 분홍','잎 초록','햇빛 노랑'],colors=['#fff','#e2a6bc','#88b89a','#e9ce73'],marks=['·','꽃','잎','해'],target=[1,2,1,2,3,2,1,2,1],values=Array(9).fill(0);let selected=1;
  const reference=grid();reference.setAttribute('aria-label','참고 시안');target.forEach(v=>{const d=document.createElement('div');d.textContent=marks[v];d.style.cssText=`text-align:center;padding:10px;background:${colors[v]};border:1px solid #777`;reference.append(d);});
  const colorsGrid=grid(3);for(let i=1;i<=3;i++)button(colorsGrid,palette[i],'color-'+i,b=>{selected=i;for(const c of colorsGrid.children)c.setAttribute('aria-pressed',String(c===b));});
  const board=grid();values.forEach((_,i)=>button(board,'·','cell-'+i,b=>{values[i]=selected;b.textContent=marks[selected];b.style.background=colors[selected];b.setAttribute('aria-label',`${Math.floor(i/3)+1}행 ${i%3+1}열 ${palette[selected]}`);}));
  button(box,'안내판 시안 완성','finish',()=>{done(patternScore(values,target),'요청한 배치를 직접 만들었어요. 읽기 쉬운 안내판은 쓰는 사람도 살펴야 해요.');});
 }else if(type==='diagnosis'||type==='lesson'){
  const medical=type==='diagnosis';const needs=medical?['갑자기 쓰러짐','상담 정보 필요','관찰 기록 전달']:['분수가 어려움','한 사람만 발표','틀린 답의 이유 탐색'];const actions=medical?['전문 인력 연결','증상과 시각 확인','사실과 시각 기록']:['그림으로 조각 나누기','역할을 돌아가며 나누기','생각의 과정 듣기'];
  text(medical?'모의 상담 접수대예요. 실제 의료 처치 안내가 아니에요. 도움 카드와 접수 기록을 연결해요. 쓰러짐→전문 인력, 정보→증상 확인, 전달→사실 기록.':'수업 설계 작업대예요. 도구 카드를 학생 활동에 연결해요. 분수→그림, 발표→역할 순환, 틀린 답→생각 듣기.');
  let selected=null;const pairs=[null,null,null],tools=grid(),requests=grid();actions.forEach((label,i)=>button(tools,label,'tool-'+i,b=>{selected=i;for(const c of tools.children)c.setAttribute('aria-pressed',String(c===b));status.textContent=label+' 카드를 연결할 기록을 눌러요.';}));
  needs.forEach((label,i)=>button(requests,label+' · 미연결','need-'+i,b=>{if(selected===null){status.textContent='먼저 사용할 도움 카드를 골라요.';return;}pairs[i]=selected;b.textContent=label+' → '+actions[selected];}));
  button(box,medical?'지원 연결 완료':'수업 설계 완료','finish',()=>{if(pairs.includes(null)){status.textContent='세 기록에 도구를 모두 연결해요.';return;}done(pairs.filter((v,i)=>v===i).length,medical?'도움의 종류와 관찰 기록을 연결했어요.':'서로 다른 배움에 맞는 수업 도구를 연결했어요.');});
 }else{text('이 작업대는 다른 체험으로 이동할 수 있어요.');button(box,'체험 마치기','finish',()=>done(0,'체험을 기록했어요.'));}
 return box;
}
