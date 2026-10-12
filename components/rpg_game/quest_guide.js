/** v5.2: pure, testable main-quest UX and bounded walkable route helper. */
export function mainObjective(state, event, quiz, catalog = []) {
  const story = state.life?.story || state.story || {};
  const pending = story.quiz?.pending || quiz?.pending;
  const chapter = Math.max(0,Math.min(7,story.chapter || 0));
  const completed = Math.min(32,(story.records || []).length);
  if(pending) return {id:'quiz:'+pending,kind:'quiz',map:state.map,point:null,
    title:'미래 사회 퀴즈 풀기',detail:'「스토리」를 눌러 문제를 풀고 다음 이야기로 가세요.',
    progress:`${completed}/32`};
  if(story.complete || !event) return {id:'ending',kind:'ending',map:state.map,point:null,
    title:'65세의 미래 다이어리 완성하기',detail:'「스토리」를 눌러 지난 선택과 미래 마을을 돌아보세요.',progress:'32/32'};
  const place = catalog.find(c=>c.id===event.map);
  const npc=event.npc || '이야기 인물';
  const last=npc.charCodeAt(npc.length-1);
  const particle=last>=44032&&last<=55203&&(last-44032)%28===0?'와':'과';
  return {id:'story:'+event.id,kind:'story',map:event.map,point:null,eventId:event.id,
    title:`${npc}${particle} 이야기하기`,
    detail:`${place?.name || '다음 장소'}에서 「${event.title}」 이야기를 진행하세요.`,
    progress:`${completed}/32`,chapter:chapter+1};
}

/** Select an actual portal from the current map instead of an arbitrary off-map coordinate. */
export function portalTarget(map, hop) {
  if(!map||!hop)return null;
  const matches=(map.portals||[]).filter(p=>p.target===hop.target);
  if(!matches.length)return null;
  return matches.find(p=>p.x===hop.x&&p.y===hop.y)||matches[0];
}

/** Find a route to any walkable tile within interaction distance of an NPC/portal.
 *  One BFS, no recursion. Null indicates unreachable, [] means already close enough.
 *  The queue never exceeds map cells; expansion is capped for corrupt/huge maps.
 */
export function approachPath(map,from,to,maxExpanded=90000){
  if(!map || !Array.isArray(map.solid) || !to || !from)return null;
  const w=map.width|0,h=map.height|0;
  if(w<=0||h<=0||w*h>150000||map.solid.length<w*h)return null;
  const [sx,sy]=from.map(Math.floor),[gx,gy]=to.map(Math.floor);
  if([sx,gx].some(v=>v<0||v>=w)||[sy,gy].some(v=>v<0||v>=h))return null;
  const start=sy*w+sx;
  if(map.solid[start])return null;
  const prev=new Int32Array(w*h);prev.fill(-1);
  const queue=new Int32Array(w*h);queue[0]=start;prev[start]=start;
  let head=0,tail=1,end=-1;
  const reach=(x,y)=>Math.max(Math.abs(x-gx),Math.abs(y-gy))<=1;
  while(head<tail && head<maxExpanded){
    const i=queue[head++],x=i%w,y=(i/w)|0;
    if(reach(x,y)){end=i;break;}
    for(const [dx,dy] of [[0,-1],[1,0],[0,1],[-1,0]]){
      const nx=x+dx,ny=y+dy;if(nx<1||ny<1||nx>=w-1||ny>=h-1)continue;
      const at=ny*w+nx;if(prev[at]!==-1||map.solid[at])continue;
      prev[at]=i;queue[tail++]=at;
    }
  }
  if(end===-1)return null;
  const result=[];for(let at=end;at!==start;at=prev[at])result.push([at%w+.5,((at/w)|0)+.5]);
  return result.reverse();
}

export function helpLevel(seconds){return seconds>=90?3:seconds>=60?2:seconds>=30?1:0;}
export function waypointKey(mapId,x,y,goalId,point){return `${mapId}|${Math.floor(x)},${Math.floor(y)}|${goalId}|${point?.join(',')||''}`;}
