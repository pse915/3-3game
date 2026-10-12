import {crisisState,performance as quizPerformance,drawEnvironment} from './crisis.js';
import {getLanguage,initializeLanguage,setLanguage,prepareI18n,watchI18n,translate,translateDocument,localizeRecord} from './i18n.js';
import {imageState,renderEndingImage,combineSnapshots} from './ending_visual.js';
import {mainObjective,portalTarget,approachPath,helpLevel,waypointKey} from './quest_guide.js';
import {runHandsOn} from './minigames.js';
import {villageProjectMarkers} from './village.js';
import {ensureQuiz,quizById,requiredQuizCount,completedRequired,queueEventQuizzes,openBonusQuiz,submitQuiz,applyVillageProject,learnedQuizNotes} from './quiz.js';
import {buildObjectIndex,nearbyObjects,findStoryResume,walkableSpawn} from './performance.js';
import {koreanLabel,localizeSavedEffect} from './locale.js';
import {STORY_CHAPTERS,WORLD_NAMES,SELF_NAMES,ensureStory,chapterInfo,currentEvent,performStoryChoice,worldTier,storySummary,endingThemes,REGIONAL_SCENARIOS,applyRegionalScenario} from './story.js';
import {DISCOVERIES,collectDiscovery} from './discoveries.js';
import {LIFE_NAMES,ensureLife,isLifeState,availableActivities,activityStatus,performActivity,pendingEvent,resolveEvent,nextDay,lifeEnding,lifeSummary} from './life.js';
import{STAT_NAMES,freshState,isState,choose,findPath,futureFlags,nextMapHop,goalFor}from './systems.js';
const $=id=>document.getElementById(id),canvas=$('world'),ctx=canvas.getContext('2d',{alpha:false}),mini=$('minimap').getContext('2d'),modal=$('modal');
const KEY='seorabeol.diary.v2',BACKUP=KEY+'.backup',T=32,cache=new Map(),images={},keys=new Set(),pointers=new Map();
let state=freshState(),map,catalog,quests,graph,activities,storyData,quizData,ruStory,ruQuiz,ruExplore,ruVariants,ruContext,ruInterface,ruMaps,routeTarget=null,transitionUntil=0,running=false,loading=false,direction=0,walk=0,moving=false,run=false,camera={x:0,y:0},path=[],frame=0,last=0,lastSave=0,lastHud=0,fps=60,chosen=0,toastTimer,remoteAck=-1,bridgeReady=false,pendingNonce=null,origin=null;
let mapLoadPromise=null,renderIndex=null,renderIndexMap=null,renderIndexFlags='',minimapBase=null;
let routeMiss=null,frameFaults=0,lastFrameErrorAt=0;
let projectCache={map:null,keys:'',markers:[]};
let questIdle=0,questHelpShown=0,lastObjectiveId='',missionCollapsed=false,lastGuidanceKey='',lastGuidePoint=null;
const focusMode=()=>ensureLife(state).settings?.storyFocus!==false;
function mainGuideGoal(){return mainObjective(state,storyData?currentEvent(state,storyData):null,ensureQuiz(ensureStory(state)),catalog||[]);}
function focusSetting(on){const life=ensureLife(state);const settings=life.settings??={};settings.storyFocus=on;state.guideOn=on;questIdle=0;questHelpShown=0;refreshGuide(true);updateHUD();save(false);}
function translateUI(id,text){const node=$(id);if(node)node.textContent=translate(text);}

const runtimeErrors=[];
function recordRuntimeError(where,error){
 const message=String(error?.message||error||'원인 불명 오류').slice(0,300);
 runtimeErrors.push({at:new Date().toISOString(),where,message});
 if(runtimeErrors.length>20)runtimeErrors.shift();
}
addEventListener('error',e=>recordRuntimeError('스크립트',e.error||e.message));
addEventListener('unhandledrejection',e=>recordRuntimeError('비동기 작업',e.reason));
function exportDiagnostics(){
 const story=ensureStory(state);
 const report={version:'v5.3-crisis-world',map:map?.id||'지도 로딩 전',age:chapterInfo(story).age,chapter:story.chapter+1,step:story.step,completedScenes:story.records.length,quiz:story.quiz?{pending:story.quiz.pending,completed:story.quiz.completed.length,projects:story.quiz.projects.length}:null,loading,fps:Math.round(fps),goal:lastObjectiveId,guideEnabled:state.guideOn,focusMode:focusMode(),routeSteps:path.length,errors:runtimeErrors};
 download('미래다이어리-진단정보.json',JSON.stringify(report,null,2));
}

const renderFlags=()=>{const f=futureFlags(state);return Object.keys(f).filter(k=>f[k]).join('|');};
function drawObjectsInView(){
  const flags=renderFlags();
  if(!renderIndex||renderIndexMap!==map||renderIndexFlags!==flags){
    const layers=(map.futureLayers||[]).filter(l=>futureFlags(state)[l.when]);
    renderIndex=buildObjectIndex([...map.objects,...layers.flatMap(l=>l.objects)]);
    renderIndexMap=map;renderIndexFlags=flags;
  }
  return nearbyObjects(renderIndex,camera.x,camera.y,canvas.width,canvas.height);
}
function writeAutosave(){
  // Rendering/play time must not increment revision or trigger a Streamlit rerun every few seconds.
  if(!running)return;
  try{persist(state);}catch(e){console.warn('자동 백업 실패:',e?.message||e);}
}
const query=new URLSearchParams(location.search);const debug=query.has('test')&&['localhost','127.0.0.1','[::1]'].includes(location.hostname);
function bridge(type,extra={}){if(parent!==window)parent.postMessage({isStreamlitMessage:true,type,...extra},origin||'*');}
bridge('streamlit:componentReady',{apiVersion:1});bridge('streamlit:setFrameHeight',{height:Math.max(620,innerHeight)});
window.addEventListener('message',e=>{if(e.source!==parent||e.data?.type!=='streamlit:render')return;origin=e.origin;bridgeReady=true;const a=e.data.args||{};if(a.ack?.id===state.id&&a.ack?.revision>=remoteAck){remoteAck=a.ack.revision;$('saveStatus').textContent=a.ack.cloud?'기기 + 서버 + 구글 시트 저장됨':a.ack.sync==='failed'?'기기 + 서버 저장됨 · 구글 시트 전송 재시도 대기':a.ack.sync==='pending'?'기기 + 서버 저장됨 · 구글 시트 전송 대기':'기기 + 서버 저장됨';}if(a.restore&&pendingNonce===a.restoreNonce){pendingNonce=null;if(isState(a.restore)&&(!a.restore.life||isLifeState(a.restore.life))){state=a.restore;ensureLife(state);state.guideOn=state.guideOn!==false&&focusMode();loadMap(state.map,[state.x/T,state.y/T]);toast('서버 기록을 복원했어요.');save(false);}else toast('복원 가능한 기록이 없어요.');}});
function toast(text){$('toast').textContent=translate(text);$('toast').style.display='block';clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').style.display='none',3300);}
function persist(s){if(!isState(s)||!isLifeState(ensureLife(s)))throw Error('invalid save');const encoded=JSON.stringify(s);const previous=localStorage.getItem(KEY);try{if(previous&&isState(JSON.parse(previous)))localStorage.setItem(BACKUP,previous);}catch{}localStorage.setItem(KEY,encoded);}
function save(remote=true){ensureLife(state);state.life.settings??={};state.life.settings.language=getLanguage();try{const current=JSON.parse(localStorage.getItem(KEY));if(current?.id===state.id&&current.revision>state.revision){$('saveStatus').textContent='다른 탭의 새 기록이 있어요 · 다시 이어하기';return;}}catch{}state.revision++;try{persist(state);$('saveStatus').textContent=bridgeReady?'기기 저장됨 · 서버 전송 대기':'기기 저장됨';}catch{$('saveStatus').textContent='기기 저장 불가 · 다이어리에서 백업하세요';}if(remote&&bridgeReady)bridge('streamlit:setComponentValue',{value:{action:'save',state},dataType:'json'});}
function readLocal(){for(const key of [KEY,BACKUP])try{const s=JSON.parse(localStorage.getItem(key));if(isState(s)&&(!catalog||catalog.some(m=>m.id===s.map))&&(!s.life||isLifeState(s.life))){ensureLife(s);return s;}}catch{}return null;}
function img(name){return new Promise((resolve,reject)=>{const im=new Image();im.onload=()=>{images[name]=im;resolve(im)};im.onerror=()=>reject(Error('에셋을 읽지 못했습니다: '+name));im.src='assets/'+name+'.png';});}
async function getMap(id){if(cache.has(id)){const m=cache.get(id);cache.delete(id);cache.set(id,m);return m;}const ctrl=new AbortController(),timeout=setTimeout(()=>ctrl.abort(),12000);
let m;
try{
 const r=await fetch('data/maps/'+encodeURIComponent(id)+'.json',{signal:ctrl.signal});
 if(!r.ok)throw Error('맵 로드 실패 ('+r.status+')');
 m=await r.json();
}finally{clearTimeout(timeout);}cache.set(id,m);while(cache.size>5)cache.delete(cache.keys().next().value);return m;}
function pass(x,y,m=map){const tx=Math.floor(x/T),ty=Math.floor(y/T);return tx>=1&&ty>=1&&tx<m.width-1&&ty<m.height-1&&!m.solid[ty*m.width+tx];}
async function loadMap(id,arrival){
 const previous=mapLoadPromise;
 const task=(async()=>{
  if(previous)try{await previous;}catch{}
  loading=true;keys.clear();pointers.clear();path=[];
  try{const next=await getMap(id);const safe=walkableSpawn(next,arrival);
if(!safe)throw Error('이동할 수 있는 위치를 찾지 못했습니다: '+id);
const [x,y]=safe;
map=next;renderIndex=null;renderIndexMap=null;minimapBase=null;routeMiss=null;projectCache.map=null;lastGuidanceKey='';lastGuidePoint=null;
state.map=id;state.x=x*T;state.y=y*T;if(!state.visited.includes(id))state.visited.push(id);camera.x=state.x-canvas.width/2;camera.y=state.y-canvas.height*.60;refreshGuide(true);updateHUD();if(running){save();toast(next.name+' · '+(next.floor?next.floor+'층':'도착했어요'));}return true;}catch(e){toast('지역을 불러오지 못했어요. 연결을 확인한 뒤 다시 시도해 주세요.');console.error(e);return false;}finally{loading=false;}
 })();
 mapLoadPromise=task;
 try{return await task;}finally{if(mapLoadPromise===task)mapLoadPromise=null;}
}
function resize(){// one logical pixel to two display pixels; DPR does not multiply the texture buffer
const scale=innerWidth<600?1:2;canvas.width=Math.ceil(innerWidth/scale);canvas.height=Math.ceil(innerHeight/scale);ctx.imageSmoothingEnabled=false;bridge('streamlit:setFrameHeight',{height:Math.max(620,Math.min(900,screen.height-100))});}
addEventListener('resize',resize);resize();
function panel(title,desc,variant){keys.clear();pointers.clear();const b=$('modalBody');b.replaceChildren();const h=document.createElement('h2');h.textContent=title;b.append(h);if(variant!==undefined){const portrait=document.createElement('canvas');portrait.width=96;portrait.height=96;portrait.className='portrait';const n=(variant-4)%35;portrait.getContext('2d').drawImage(images.portraits,n%7*96,Math.floor(n/7)*96,96,96,0,0,96,96);b.append(portrait);}if(desc){const p=document.createElement('p');p.textContent=desc;b.append(p);}if(!modal.open)modal.showModal();$('mission').classList.add('in-dialog');return b;}
function button(parent,label,fn,sub){const b=document.createElement('button');b.textContent=label;if(sub){const s=document.createElement('small');s.textContent=sub;b.append(s);}b.onclick=fn;parent.append(b);return b;}
function close(){modal.close();keys.clear();pointers.clear();}
$('closeModal').onclick=close;modal.addEventListener('close',()=>{keys.clear();pointers.clear();$('mission').classList.remove('in-dialog');});
function progress(){return quests[state.completed.length];}
function storyGoal(){if(quizData&&ensureQuiz(ensureStory(state)).pending)return {map:map?.id||'school',point:[Math.floor(state.x/T),Math.floor(state.y/T)],text:'📚 배운 내용을 퀴즈로 확인할 시간이에요'};const e=storyData?currentEvent(state,storyData):null;if(!e)return null;const m=catalog?.find(item=>item.id===e.map);return {map:e.map,point:storyPoint(m||map),text:'📔 '+e.title};}
function storyPoint(m){if(!m)return [64,52];const [x,y]=m.spawn||[16,24];for(const [dx,dy] of [[2,0],[3,0],[0,-2],[-2,0],[0,2],[1,1],[-1,-1],[0,0]])if(pass((x+dx)*T,(y+dy)*T,m))return [x+dx,y+dy];return walkableSpawn(m,[x+2,y])||[x,y];}
function storyMarker(){const e=storyData&&currentEvent(state,storyData);if(!e||e.map!==map?.id)return null;const [x,y]=storyPoint(map);return {x,y,name:'📔 '+e.npc,label:'다음 이야기 · '+e.title,variant:5,story:true};}
function storyChapterLabel(){const s=ensureStory(state);return s.complete?'65세 · 생애 회고 완료':`${s.chapter+1}/8장 · ${chapterInfo(s).age}세 · ${chapterInfo(s).title}`;}
function storyHUD(){
 const s=ensureStory(state),goal=mainGuideGoal();
 $('time').textContent=storyChapterLabel();
 $('lifeBadge').textContent=chapterInfo(s).age+'세 · '+s.records.length+'/32 장면 · 학습 '+(quizData?completedRequired(s,quizData):0)+'/12';
 translateUI('missionCaption','현재 목표');
 translateUI('missionProgress',goal.progress);
 translateUI('objective','★ '+goal.title);
 translateUI('hint',goal.detail);
 const focus=focusMode();$('mission').classList.toggle('explore-mode',!focus);
 $('storyBtn').classList.toggle('quest-action',focus);
 $('guideBtn').setAttribute('aria-pressed',String(state.guideOn));
 translateUI('guideBtn',state.guideOn?'★ 길 안내 켜짐':'★ 길 안내');
 const needsPlace=goal.kind==='story'&&map?.id!==goal.map;
 translateUI('missionMapBtn',needsPlace?'지도 · 목표 위치':'지도 보기');
 $('missionJumpBtn').hidden=!focus||goal.kind==='ending'||questHelpShown<3;
 if(goal.id!==lastObjectiveId){lastObjectiveId=goal.id;questIdle=0;questHelpShown=0;$('missionHelp').textContent='';$('missionJumpBtn').hidden=true;}
}


function updateHUD(){if(!map)return;const g=goalFor(state,quests);$('location').textContent=map.name;$('lifeBadge').textContent=ensureLife(state).day+'일 · 시간 '+state.life.time+'분 · 자금 '+state.life.money;$('time').textContent=(state.intro?state.completed.length>=4?'장면 3 · ':'장면 2 · ':'장면 1 · ')+state.stage+' · '+state.completed.length+'/5 선택';$('objective').textContent=g.text;$('hint').textContent=state.ending?'지도에서 자유롭게 둘러보세요.':g.map===map.id?'금빛 점선을 따라 가까이 간 뒤 이야기 버튼을 눌러요.':(routeTarget?.label||'연결 통로')+' → '+(catalog.find(m=>m.id===g.map)?.name||g.map);$('guideBtn').textContent=state.guideOn?'길 안내 켜짐':'길 안내 꺼짐';$('guideBtn').setAttribute('aria-pressed',state.guideOn);storyHUD();drawMini();}
function toggleMission(){
 missionCollapsed=!missionCollapsed;$('mission').classList.toggle('collapsed',missionCollapsed);
 $('missionToggle').setAttribute('aria-expanded',String(!missionCollapsed));
 $('missionToggle').setAttribute('aria-label',translate(missionCollapsed?'안내 펼치기':'안내 접기'));
 $('missionToggle').textContent=missionCollapsed?'+':'−';
}
$('missionToggle').onclick=toggleMission;
$('missionMapBtn').onclick=()=>{const g=mainGuideGoal();if(g.kind==='quiz'||g.kind==='ending'){storyPanel();return;}const b=panel('★ 다음 목표 위치',g.detail);const m=catalog.find(c=>c.id===g.map);
 const hop=map?.id!==g.map?nextMapHop(graph,map.id,g.map):null;
 const p=document.createElement('article');p.className='entry';p.textContent=map?.id===g.map?'현재 지도에서 노란 별표를 찾아가세요.':`목적지: ${m?.name||g.map}\n다음 통로: ${hop?.label||'지도에서 길 안내를 확인하세요.'}`;b.append(p);
 button(b,'★ 길 안내 따라가기',()=>{state.guideOn=true;refreshGuide(true);updateHUD();close();});
 button(b,'목표 장소로 빠르게 이동하기',async()=>{close();if(await loadMap(g.map,m?.spawn))toast('노란 별표가 있는 인물에게 다가가세요.');});
 button(b,'자유롭게 전체 지도 보기',travel);
};
$('missionJumpBtn').onclick=async()=>{
 const g=mainGuideGoal();if(g.kind==='quiz'){storyPanel();return;}if(g.kind!=='story'){storyPanel();return;}
 const dest=catalog.find(c=>c.id===g.map);if(!dest){toast('목표 장소를 찾지 못했어요. 스토리 버튼으로 계속할 수 있어요.');return;}
 const arrival=g.map===map?.id?storyPoint(map):storyPoint(dest);
 if(await loadMap(g.map,arrival))toast('목표 인물 가까이에 도착했어요. 별표를 찾아 이야기하세요.');
};
function updateQuestHelp(dt){
 if(!running||!focusMode()||!map||loading||modal.open||document.hidden)return;
 const goal=mainGuideGoal();if(goal.id!==lastObjectiveId){questIdle=0;questHelpShown=0;lastObjectiveId=goal.id;$('missionHelp').textContent='';return;}
 if(goal.kind==='ending')return;
 questIdle+=dt;const level=helpLevel(questIdle);
 if(level===questHelpShown)return;
 questHelpShown=level;
 if(level>=1){
  const tip=level===1?'노란 ★ 별표가 다음 이야기의 목표예요.':level===2?'길 안내를 누르면 이동할 경로가 표시돼요.':'어렵다면 「목표 근처로 이동」을 눌러도 돼요.';
  translateUI('missionHelp',tip);$('missionJumpBtn').hidden=level<3;
  $('guideBtn').classList.toggle('hint-highlight',level>=2&&!state.guideOn);
 }
}
function nearby(){if(!map)return null;const marker=storyMarker();if(marker&&Math.hypot(marker.x*T-state.x,marker.y*T-state.y)<85)return {...marker,type:'npc'};let best=null,dist=Infinity;for(const [type,list]of [['portal',map.portals],['npc',activeNpcs()],['object',[...map.interactions,...activityObjects(),...discoveryObjects()]]])for(const o of list){const d=Math.hypot(o.x*T-state.x,o.y*T-state.y);if(d<80&&d<dist){best={...o,type};dist=d;}}if(!best){for(const obj of projectObjects())if(Math.hypot(obj.x*T-state.x,obj.y*T-state.y)<72){best={...obj,type:'npc'};break;}}return best;}
function interact(){if(!running||loading||modal.open)return;const o=nearby();if(!o){toast('사람이나 물건 가까이에서 눌러 주세요.');return;}if(o.type==='portal'){loadMap(o.target,o.arrival);return;}if(o.story){storyPanel(true);return;}if(o.projectId){villageProjectInfo(o.projectId);return;}if(o.quest==='teacher'){state.teacherMet=true;save();refreshGuide(true);updateHUD();const b=panel('기술썜',o.text,o.variant);button(b,'내 인생 스토리 시작하기',()=>storyPanel());button(b,'옆의 다이어리 살펴보기',close);return;}if(o.quest==='intro'){if(!state.teacherMet){panel('다이어리 옆의 선생님','바로 옆 기술썜과 먼저 이야기해 보자.');return;}if(state.completed.length===5){endingPanel();return;}if(state.intro){panel('미래 다이어리','우리가 함께 준비한 미래는 계속 달라지고 있어. 길 안내를 따라 내 하루를 이어 가자.');return;}state.intro=true;state.stage='청년기';save();const b=panel('첫 페이지가 열렸다','이곳은 상상 속 미래야. 일과 집, 쉼과 돌봄을 선택하며 마을과 학교의 변화를 직접 만나 보자. 개인의 결혼이나 출산에 정답을 정하지 않아.');button(b,'미래의 하루 시작',()=>{close();transitionUntil=performance.now()+2200;loadMap('town',[128,122]);});return;}if(o.discovery){discoveryPanel(DISCOVERIES.find(d=>d.id===o.discovery));return;}if(o.activity){activityPanel(activities.activities.find(a=>a.id===o.activity));return;}if(o.quest){questDialog(o.quest);return;}panel(o.name||o.label,npcStory(o),o.variant);}
function storyPanel(atMarker=false){
 const s=ensureStory(state);if(quizData&&ensureQuiz(s).pending){quizPanel();return;}
 const e=storyData&&currentEvent(state,storyData),tier=worldTier(s);
 if(!e||s.records.some(r=>r.id===e.id)){
  if(s.complete){storyEnding();return;}
  const b=panel('이야기 진행 복구','이전에 중단된 장면을 찾지 못했습니다. 작성한 다이어리 기록은 삭제하지 않고 다음 장면을 찾아 복구할 수 있어요.');
  button(b,'기록을 바탕으로 이야기 이어가기',()=>{
    const next=findStoryResume(storyData,s.records);
    if(!next){toast('스토리 자료를 읽지 못했어요. 새로고침을 시도해 주세요.');return;}
    s.chapter=next.chapter;s.step=next.step;s.complete=next.complete;
    save();refreshGuide(true);updateHUD();
    if(next.complete)storyEnding();else storyPanel();
  });
  button(b,'내 기록 먼저 확인하기',diary);
  return;
 }
 const chapter=chapterInfo(s);
 const b=panel(`${chapter.age}세 · ${chapter.title}`,`${e.title}\n\n${e.story}`);
 const pill=document.createElement('div');pill.className='story-status';pill.textContent=`제 ${s.chapter+1}장 / 8 · 사건 ${s.step+1} / ${storyData.chapters[s.chapter].events.length} · ${tier.label}`;b.append(pill);
 if(s.chapter>=4&&s.chapter<=6&&!s.flags['regional'+s.chapter])button(b,'🏙 지역 사회 변화 시나리오 경험하기',regionalScenarioPanel);
 const m=catalog.find(m=>m.id===e.map);
 if(map?.id!==e.map){const desc=document.createElement('p');desc.textContent=`다음 장면의 장소: ${m?.name||e.map} · 장소로 이동하여 NPC와 만나세요.`;b.append(desc);button(b,'🧭 '+(m?.name||'장면의 장소')+'로 이동하기',async()=>{close();if(await loadMap(e.map,m?.spawn))toast('📔 표시가 있는 인물에게 다가가거나 스토리 버튼을 누르세요.');}).classList.add('quest-action');return;}
 const note=document.createElement('p');note.textContent='장면을 읽고 행동을 선택하세요. 선택은 개인·관계·미래 마을에 남습니다.';b.append(note);
 for(const [i,c] of e.choices.entries())button(b,c.label,()=>{
  const before=worldTier(s),r=performStoryChoice(state,storyData,i);if(!r.ok){toast(r.message);return;}
  queueEventQuizzes(s,r.entry.id,quizData);save();refreshGuide(true);updateHUD();
  const after=worldTier(s);const p=panel(r.done?'65세 · 마지막 장면을 마쳤습니다':r.chapterChanged?'새로운 나이, 새로운 장':'그날의 선택이 미래로 이어집니다',r.message);
  const result=document.createElement('article');result.className='entry';result.textContent=`${r.entry.age}세 · ${r.entry.choice}\n${r.entry.effects.map(localizeSavedEffect).join(' · ')||'기억과 관계에 남는 선택'}`;p.append(result);
  if(before.tier!==after.tier){const change=document.createElement('p');change.className='world-change';change.textContent=`🏘 마을 풍경이 바뀌었어요: ${before.label} → ${after.label}`;p.append(change);}
  if(r.chapterChanged&&!r.done){const title=document.createElement('p');title.className='story-next';title.textContent=`시간이 흘러 ${chapterInfo(s).age}세 · ${chapterInfo(s).title}`;p.append(title);transitionUntil=performance.now()+1800;}
  button(p,r.done?'65세 인생 회고와 성찰':'다음 이야기 이어가기',()=>r.done?storyEnding():storyPanel()).classList.add('quest-action');
  button(p,'다이어리에 기록 확인',diary);
 });
 if(!atMarker)button(b,'🗺 현재 장면의 인물에게 다가가기',close);
}

// v5 teaching scenes live inside the narrative. Knowledge alone never raises village scores.
function quizPanel(){
 const st=ensureStory(state),q=ensureQuiz(st),item=quizById(quizData,q.pending);
 if(!item){const b=panel('퀴즈 복구 안내','학습 문제 기록과 문제은행이 일치하지 않아요. 기존 인생 기록은 유지하고 잘못된 퀴즈 ID만 정리할 수 있어요.');button(b,'잘못된 문제 기록 정리하고 이어가기',()=>{q.pending=null;q.queue=q.queue.filter(id=>quizById(quizData,id));if(q.queue.length)q.pending=q.queue.shift();save();storyPanel();});return;}
 const b=panel('📚 미래 사회 퀴즈 · '+item.topic,item.question);
 b.classList.add('quiz-active');
 const status=document.createElement('div');status.className='story-status';status.textContent=`필수 학습 ${completedRequired(st,quizData)} / ${requiredQuizCount(quizData)} · ${STORY_CHAPTERS[item.chapter-1].age}세 · 시도 ${q.attempts[item.id]||0}회`;b.append(status);
 const controls=document.createElement('div');controls.className='quiz-choices';b.append(controls);
 let selected=-1;
 for(const [i,answer] of item.options.entries()){
  const opt=button(controls,`${'①②③④'[i]}  ${answer}`,()=>{
   selected=i;for(const n of controls.querySelectorAll('button')){n.classList.remove('selected');n.setAttribute('aria-pressed','false');}opt.classList.add('selected');opt.setAttribute('aria-pressed','true');confirm.disabled=false;
  });opt.setAttribute('aria-pressed','false');
 }
 const confirm=button(b,'선택한 답 확인하기',()=>{
  if(selected<0)return;
  confirm.disabled=true;
  const beforeCrisis=crisisState(st,quizData);const result=submitQuiz(st,item.id,selected,quizData);const afterCrisis=crisisState(st,quizData);if(result.ok&&beforeCrisis.stage!==afterCrisis.stage)toast('가상 미래의 준비도가 달라졌어요. 정책과 공동체 활동으로 대응할 수 있어요.');
  if(!result.ok){toast(result.message);quizPanel();return;}
  save(result.correct);updateHUD();
  updateHUD();if(result.correct)quizSolvedPanel(item);
  else quizRetryPanel(item,result);
 });confirm.disabled=true;confirm.className='primary quest-action';
 const hint=document.createElement('small');hint.textContent='모르면 다시 도전하세요. 오답 때문에 능력치나 자금은 줄지 않아요.';b.append(hint);
}
function quizRetryPanel(item,result){
 const b=panel('다시 생각해 볼까요?','아쉬워요! 아직 정답이 아니에요.');
 const hint=document.createElement('article');hint.className='entry';hint.textContent=`${result.attempts}번째 시도 · 힌트\n${result.hint}`;b.append(hint);
 if(result.attempts>=3){const more=document.createElement('article');more.className='entry';more.textContent='개념 다시 살펴보기 · '+item.project.before+'\n각 선택지가 어떤 문제를 해결하려는지 비교해 보세요.';b.append(more);}
 button(b,'다시 도전하기',quizPanel).classList.add('quest-action');
 button(b,'나중에 이어서 풀기',()=>{close();toast('다음에 스토리를 열면 이 문제부터 이어집니다.');});
}
function drawVillagePreview(parent,project){
 const outer=document.createElement('div');outer.className='village-preview';
 for(const upgraded of [false,true]){
  const block=document.createElement('div');block.className='village-preview-card';
  const title=document.createElement('strong');title.textContent=upgraded?'개선안이 적용된 모습':'기존 마을 모습';block.append(title);
  const cv=document.createElement('canvas');cv.width=192;cv.height=104;cv.className='village-preview-canvas';cv.setAttribute('aria-label',upgraded?'개선 후 마을 시설 그림':'개선 전 마을 시설 그림');
  const g=cv.getContext('2d');g.imageSmoothingEnabled=false;
  g.fillStyle=upgraded?'#b6ddca':'#b8c1c3';g.fillRect(0,0,192,104);
  g.fillStyle=upgraded?'#7aa38a':'#969a95';g.fillRect(0,70,192,34);
  g.fillStyle='#e3cfaa';g.fillRect(26,25,136,55);g.fillStyle=upgraded?'#b16f71':'#817a77';g.fillRect(20,18,148,12);
  g.fillStyle=upgraded?'#f7f2db':'#a7a29a';g.fillRect(38,42,42,27);g.fillRect(110,42,42,27);
  g.fillStyle=upgraded?'#548a8a':'#666b72';g.fillRect(84,46,22,34);
  g.fillStyle=upgraded?'#578b76':'#99918b';g.fillRect(31,8,127,8);
  if(upgraded){g.fillStyle='#4e8e63';for(const x of [7,174]){g.fillRect(x,39,10,31);g.fillRect(x-6,27,22,20);}g.fillStyle='#f9e9a2';g.fillRect(60,29,70,8);g.fillStyle='#fff2e0';for(const x of [9,178])g.fillRect(x,79,6,12);}
  else{g.fillStyle='#7f837a';g.fillRect(6,76,25,2);g.fillRect(148,80,28,2);g.fillStyle='#b0a6a0';g.fillRect(39,29,60,5);}
  block.append(cv);const desc=document.createElement('p');desc.textContent=upgraded?project.after:project.before;block.append(desc);outer.append(block);
 }
 parent.append(outer);
 const foot=document.createElement('small');foot.textContent='픽셀 그림은 개선 전·후를 설명하는 연출입니다. 실제 마을 지도 변화는 개선안 적용을 선택한 뒤 확인할 수 있어요.';parent.append(foot);
}
function quizSolvedPanel(item){
 const b=panel('정답이에요! · '+item.topic,item.explanation);
 const label=document.createElement('h3');label.textContent='🏘 배운 내용을 마을에 적용해 볼까요?';b.append(label);
 const intro=document.createElement('p');intro.textContent=item.project.title+' · 주민들이 겪는 문제를 살펴보고 개선 방법을 선택해 보세요.';b.append(intro);
 drawVillagePreview(b,item.project);
 button(b,'마을에 개선안을 적용하기',()=>{
  const s=ensureStory(state),before=worldTier(s),result=applyVillageProject(s,item.id,quizData);
  if(!result.ok){toast(result.message);quizStudyPanel();return;}
  save();updateHUD();refreshGuide(true);
  const after=worldTier(s);const p=panel('🏘 마을이 달라졌어요!',`${result.project.title}\n\n${result.project.after}\n\n마을 상태: ${before.label} → ${after.label}`);
  const n=document.createElement('article');n.className='entry';n.textContent=Object.entries(result.delta).map(([k,v])=>`${koreanLabel(k,'world')} +${v}`).join(' · ')+'\n이 변화는 퀴즈 점수가 아니라 직접 선택한 마을 개선 활동의 결과예요.';p.append(n);
  button(p,'변화한 마을 직접 둘러보기',async()=>{close();await loadMap('town',[128,122]);});
  button(p,'다음 인생 이야기 이어가기',storyPanel);
 });
 button(b,'이번에는 관찰만 하고 이어가기',()=>{const p=panel('배움의 기록','개선안은 적용하지 않았지만 무엇을 바꿀 수 있을지 생각해 보았어요. 마을의 사회 지표는 그대로 유지됩니다.');button(p,'다음 이야기 이어가기',storyPanel);button(p,'학습장 다시 보기',quizStudyPanel);});
}
function quizLearningSummary(){if(!quizData)return '';const s=ensureStory(state);return '\n\n미래 사회에서 배운 내용\n'+learnedQuizNotes(s,quizData).map(n=>`${n.chapter}장 · ${n.topic} · ${n.diary} ${n.applied?'[마을 개선안 적용]':'[사례 관찰]'}`).join('\n');}
function renderQuizDiary(b){
 if(!quizData)return;const s=ensureStory(state),q=ensureQuiz(s);
 const title=document.createElement('h3');title.textContent=`📚 인구와 고령사회 학습 · 필수 ${completedRequired(s,quizData)}/${requiredQuizCount(quizData)}`;b.append(title);
 const topics=document.createElement('p');topics.textContent=`완료한 문제 ${q.completed.length}개 · 마을에 적용한 개선안 ${q.projects.length}개`;b.append(topics);
 for(const item of learnedQuizNotes(s,quizData)){
  const line=document.createElement('article');line.className='entry';line.textContent=`${item.chapter}장 · ${item.topic}\n${item.diary}${item.applied?'\n🏘 마을 개선안을 적용했어요.':'\n개선안은 적용하지 않았어요.'}`;b.append(line);
 }
}
function quizStudyPanel(){
 const s=ensureStory(state),q=ensureQuiz(s),b=panel('📚 미래 사회 학습장',`필수 퀴즈 ${completedRequired(s,quizData)}/${requiredQuizCount(quizData)}개 완료 · 총 ${q.completed.length}/${quizData.questions.length}개 학습`);
 if(q.pending){button(b,'풀고 있던 문제 이어서 풀기',quizPanel);return;}
 for(const item of quizData.questions.filter(item=>q.completed.includes(item.id)&&!q.projects.includes(item.id))){button(b,'🏘 '+item.project.title,()=>{applyVillageProject(s,item.id,quizData);save();updateHUD();quizStudyPanel();});}
 const progress=quizPerformance(s,quizData);const status=document.createElement('p');status.textContent=translate('핵심 퀴즈 최초 정답: ')+progress.firstTryCorrect+'/12 · '+translate('최초 기록 없음: ')+progress.unknownRequired;b.append(status);
 const groups=document.createElement('article');groups.className='entry';groups.textContent='고령사회 준비 5대 전략\n'+quizData.policyTopics['고령사회 준비'].map(x=>'• '+x).join('\n')+'\n\n저출산 대응 6대 과제\n'+quizData.policyTopics['저출산 대응'].map(x=>'• '+x).join('\n');b.append(groups);
 const note=document.createElement('p');note.textContent='메인 스토리의 문제는 해당 사건을 경험한 뒤 등장합니다. 보충 문제는 노후 준비 챕터부터 도전할 수 있어요.';b.append(note);
 const items=quizData.questions.filter(item=>!item.required);
 for(const item of items){
  const solved=q.completed.includes(item.id),unlocked=s.chapter>=6||s.complete;
  const label=(solved?'✓ ':'')+item.topic+(solved?' · 학습 완료':!unlocked?' · 56세 이후 열림':' · 보충 문제');
  const bt=button(b,label,()=>{const result=openBonusQuiz(s,item.id,quizData);if(!result.ok){toast(result.message);return;}save();quizPanel();});bt.disabled=solved||!unlocked;
 }
 button(b,'다이어리에서 학습·마을 변화를 확인하기',diary);
 button(b,'메인 스토리로 돌아가기',storyPanel);
}
function projectObjects(){
 if(!quizData||map?.id!=='town')return [];
 const ids=ensureQuiz(ensureStory(state)).projects,keys=ids.join('|');
 if(projectCache.map===map&&projectCache.keys===keys)return projectCache.markers;
 const markers=villageProjectMarkers(map,quizData,ids);
 projectCache={map,keys,markers};return markers;
}
function drawVillageProjects(){
 if(!quizData||map?.id!=='town')return;
 const objects=projectObjects();
 ctx.save();ctx.textAlign='center';
 for(const obj of objects){
  const x=Math.round(obj.x*T-camera.x),y=Math.round(obj.y*T-camera.y);
  if(x<-110||x>canvas.width+110||y<-90||y>canvas.height+90)continue;
  ctx.fillStyle='#3f6f63';ctx.fillRect(x-13,y-42,26,24);
  ctx.fillStyle='#eaf5d0';ctx.fillRect(x-10,y-39,20,18);
  ctx.fillStyle='#84b2a0';ctx.fillRect(x-2,y-58,4,16);
  ctx.fillStyle='#38584b';ctx.fillRect(x-2,y-36,4,14);
  ctx.fillStyle='#f9f2dc';ctx.font='bold 12px sans-serif';
  const width=Math.min(145,Math.max(65,ctx.measureText(obj.label).width+14));
  ctx.fillStyle='#3c665ce8';ctx.fillRect(x-width/2,y-78,width,18);
  ctx.fillStyle='#fff6dc';ctx.fillText(translate(obj.label),x,y-65);
 }
 ctx.restore();
}
function villageProjectInfo(id){
 const item=quizById(quizData,id);if(!item)return;
 const b=panel('🏘 '+item.project.title,item.project.after+'\n\n'+item.explanation);
 drawVillagePreview(b,item.project);
 button(b,'다음 이야기로 돌아가기',storyPanel);
 button(b,'마을 더 둘러보기',close);
}
function regionalScenarioPanel(){const s=ensureStory(state),b=panel('우리 마을의 50년 · 지역사회 변화','이 사건은 내 결혼이나 출산의 결과가 아니라 다른 주민의 이동, 경기, 지방 정책 등의 외부 조건을 체험하는 가상 시나리오입니다. 지역 변화는 다음 챕터에서도 누적되며 지역 재생으로 회복할 수 있습니다.');
 for(const card of REGIONAL_SCENARIOS)button(b,card.label,()=>{const before=worldTier(s),r=applyRegionalScenario(state,card.id);if(!r.ok){toast(r.message);storyPanel();return;}save();refreshGuide(true);updateHUD();const p=panel('마을 풍경의 변화',r.message+'\n\n'+before.label+' → '+r.world.label);const detail=document.createElement('p');detail.textContent='이후 마을로 나가 건물과 주민의 변화를 살펴보세요. 개인의 결혼·출산 여부는 사회 쇠퇴의 원인으로 처리하지 않습니다.';p.append(detail);button(p,'마을 살펴보기',async()=>{close();await loadMap('town',[128,122]);});button(p,'메인 스토리로 돌아가기',storyPanel);});
}
function renderStoryDiary(b){const s=ensureStory(state),t=worldTier(s);
 const h=document.createElement('h3');h.textContent='📔 15~65세 생애 연표';b.append(h);
 const summary=document.createElement('article');summary.className='entry';summary.textContent=storyChapterLabel()+'\n마을: '+t.label+' · '+t.score+' / 100\n인생 키워드: '+endingThemes(s).join(' · ');b.append(summary);
 const stats=document.createElement('div');stats.className='stats';for(const [k,v]of Object.entries(s.self)){const d=document.createElement('div');d.textContent=koreanLabel(k,'self')+' '+v;stats.append(d);}b.append(stats);
 const wh=document.createElement('h3');wh.textContent='미래 마을 지표 (가상 모델)';b.append(wh);
 const grid=document.createElement('div');grid.className='stats';for(const [k,v]of Object.entries(s.world)){const d=document.createElement('div');d.textContent=koreanLabel(k,'world')+' '+v;grid.append(d);}b.append(grid);
 for(const o of s.outcomes){const item=document.createElement('article');item.className='entry';item.textContent='지역 사회 시나리오 · '+o.description;b.append(item);}
 for(const r of s.records){const item=document.createElement('article');item.className='entry';const head=document.createElement('strong');head.textContent=`${r.year}년 · ${r.age}세 · ${r.title}`;const p=document.createElement('p');p.textContent=r.choice+'\n'+r.result+'\n'+(Array.isArray(r.effects)?r.effects:[]).map(localizeSavedEffect).join(' · ');item.append(head,p);b.append(item);}
 if(s.complete){const label=document.createElement('h3');label.textContent='65세의 인생 회고';b.append(label);const f=field(b,'앞으로 어떤 삶을 살아가고 싶은가요?',s.reflection,2000);f.onchange=()=>{s.reflection=f.value;save();};button(b,'나의 마지막 다짐 저장',()=>{s.reflection=f.value;save();toast('65세의 일기를 기록했어요.');});}
 renderQuizDiary(b);button(b,'📚 배움과 마을 변화 확인하기',quizStudyPanel);if(s.complete)button(b,'🌄 변화한 마을과 학교 이미지 보기',endingShowcase);button(b,s.complete?'65세 결과 다시 보기':'다음 메인 스토리 보기',()=>s.complete?storyEnding():storyPanel());
}
function storyEnding(){const s=ensureStory(state);if(quizData&&ensureQuiz(s).pending){quizPanel();return;}if(!s.complete){storyPanel();return;}
 const w=worldTier(s);const b=panel('65세 · 50년 만에 돌아온 서라벌여중','교정에는 15세의 네가 처음 적었던 다이어리가 남아 있다. 학교와 마을, 너의 삶은 변해 왔다. 그러나 인생의 다음 페이지는 여전히 열려 있다.');
 const q=document.createElement('article');q.className='entry';q.textContent='“나는 아직 어떤 어른이 될지 모르겠다. 하지만 내가 선택한 길을 걸어가 보고 싶다.”';b.append(q);
 const memories=document.createElement('article');memories.className='entry';memories.textContent='나의 인생 키워드: '+endingThemes(s).join(' · ')+'\n미래 마을: '+w.label+' ('+w.score+'/100)\n기억에 남은 선택 '+s.records.length+'개'+'\n인구·고령사회 필수 학습 '+completedRequired(s,quizData)+'/'+requiredQuizCount(quizData)+'개 · 마을 개선안 '+ensureQuiz(s).projects.length+'개';b.append(memories);
 const area=field(b,'내가 선택한 삶은 어떤 모습이었을까? 현실의 나는 앞으로 어떤 삶을 만들어 가고 싶을까?',s.reflection,2000);
 button(b,'65세 마지막 일기 완성',()=>{if(!area.value.trim()){toast('한 문장으로 내 생각을 적어 주세요.');return;}s.reflection=area.value;save();endingShowcase();});button(b,'🌄 결과 시각화 보기',endingShowcase);
 button(b,'15세부터의 인생 연표 보기',diary);button(b,'학습한 인구·고령사회 내용 살펴보기',quizStudyPanel);button(b,'나의 생애 기록 텍스트 받기',()=>download('나의-미래-다이어리-65세.txt',storySummary(state)+quizLearningSummary(),'text/plain'));
 button(b,'학교 교문으로 돌아가기',async()=>{close();await loadMap('school',[64,52]);});
}
let showcaseBusy=false;
async function endingShowcase(){
 const s=ensureStory(state);
 if(!s.complete){toast('65세 인생 스토리를 끝낸 뒤 결과를 볼 수 있어요.');return;}
 if(showcaseBusy)return;
 showcaseBusy=true;
 const waiting=panel('마을과 학교의 변화','여러분의 생애설계 선택이 마을을 변화시켰습니다.\n실제 게임 지도와 에셋으로 15세와 65세의 모습을 구성하고 있어요.');
 const info=document.createElement('p');info.setAttribute('role','status');info.textContent='마을과 학교의 이미지를 준비하고 있습니다…';waiting.append(info);
 try{
  const snapshot=imageState(s,quizData,futureFlags(state));s.endingVisualization=snapshot;save(false);
  const [town,school]=await Promise.all([getMap('town'),getMap('school')]);
  if(!modal.open)return;
  const b=panel('65세 · 나의 미래 마을','여러분의 생애설계 선택이 마을을 변화시켰습니다.');
  const hero=document.createElement('div');hero.className='ending-message';hero.textContent='여러분의 생애설계 선택이 마을을 변화시켰습니다.';b.append(hero);
  const tierNames=['활기찬 마을','변화하는 마을','쇠퇴하는 마을','심각하게 쇠퇴한 마을'];
  const overview=document.createElement('p');overview.className='story-status';overview.textContent='마을의 상태: '+tierNames[snapshot.tier]+' · '+snapshot.score+'/100 · 적용한 개선안 '+snapshot.projects.length+'개';b.append(overview);
  const progress=quizPerformance(s,quizData);const summary=document.createElement('p');summary.textContent=translate('핵심 퀴즈 최초 정답: ')+progress.firstTryCorrect+'/12 · '+translate('최종 학습 완료: ')+progress.completedRequired+'/12 · '+translate('최초 기록 없음: ')+progress.unknownRequired; b.append(summary);const schoolStatus=document.createElement('p');schoolStatus.textContent=translate('학교 시설: ')+translate(snapshot.projects.length&&snapshot.condition?.baseStage>=3&&snapshot.tier<2?'수리한 시설과 남아 있는 노후화의 흔적':['정상 운영','지역과 함께 쓰는 학습 공간','유휴 교실과 일부 시설 폐쇄','노후 교실 폐쇄 · 회고 공간은 열려 있어요'][snapshot.tier]);b.append(schoolStatus);const rule=document.createElement('p');rule.textContent='퀴즈는 가상 사회의 대응 준비도를 나타냅니다. 현실의 저출산·고령화 원인이 아니며, 정책과 사회 여건으로 마을을 회복할 수 있습니다.';b.append(rule);
  const imagesOut=[];
  for(const [id,m,title] of [['town',town,'내가 변화시킨 미래 마을'],['school',school,'50년 후 다시 만난 우리 학교']]){
   const titleEl=document.createElement('h3');titleEl.textContent=title;b.append(titleEl);
   const frames=document.createElement('div');frames.className='ending-compare';b.append(frames);
   for(const future of [false,true]){
    const card=document.createElement('div');card.className='ending-image-card';frames.append(card);
    const label=document.createElement('strong');label.textContent=future?'65세의 모습':'15세의 모습';card.append(label);
    const cv=renderEndingImage(id,m,images,snapshot,{future,quizBank:quizData});card.append(cv);imagesOut.push(cv);
   }
   await new Promise(resolve=>requestAnimationFrame(resolve));
  }
  const note=document.createElement('p');note.className='ending-note';note.textContent='두 시기의 같은 구역을 비교한 실제 게임 맵 렌더링입니다. 마을의 경제·인구·공동체 변화와 적용한 정책에 따라 건물, 거리, 시설이 달라집니다. 고령 인구가 많다는 이유만으로 폐허가 되지 않습니다.';b.append(note);
  const h=document.createElement('h3');h.textContent='나의 선택이 만든 변화';b.append(h);
  const summaries=document.createElement('div');summaries.className='ending-decisions';b.append(summaries);
  const applied=snapshot.projects.map(id=>quizById(quizData,id)).filter(Boolean).slice(-5);
  if(applied.length){for(const item of applied){const a=document.createElement('article');a.className='entry';a.textContent=item.project.title+'\n'+item.project.after;summaries.append(a);}}
  else {const a=document.createElement('article');a.className='entry';a.textContent='이 생애에서는 별도의 마을 개선안을 적용하지 않았습니다. 개인의 선택뿐 아니라 지역 경제와 정책 등 다양한 요인이 변화를 만들었습니다.';summaries.append(a);}
  const records=s.records.filter(r=>['c1-counsel','c3-learning','c4-relationship','c4-care','c5-town','c6-crisis','c7-together'].includes(r.id)).slice(-4);
  for(const r of records){const a=document.createElement('article');a.className='entry';a.textContent=`${r.age}세 · ${r.title}\n${r.choice}`;summaries.append(a);}
  button(b,'이미지 저장하기',()=>{
   try{const combined=combineSnapshots(imagesOut);
    combined.toBlob(blob=>{if(!blob){toast('이미지 저장에 실패했어요. 다시 시도해 주세요.');return;}
     const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='미래다이어리-마을과학교-15세-65세.png';a.click();setTimeout(()=>URL.revokeObjectURL(url),2000);},'image/png');
   }catch(error){recordRuntimeError('엔딩 이미지 저장',error);toast('이미지 저장에 실패했어요. 다시 시도해 주세요.');}
  });
  const last=document.createElement('p');last.className='ending-reflection';last.textContent='나의 선택은 어떤 미래를 만들었을까요? 앞으로 나는 어떤 삶을 설계하고 싶나요?';b.append(last);
  button(b,'나의 미래 다이어리로 돌아가기',diary);
  button(b,'65세 인생 회고 다시 보기',storyEnding);
 }catch(error){recordRuntimeError('엔딩 시각화',error);console.error(error);
  const b=panel('이미지를 불러오지 못했어요','게임 기록은 보존되어 있어요. 이미지 에셋과 지도를 다시 불러온 뒤 재시도할 수 있습니다.');
  button(b,'이미지 다시 생성하기',endingShowcase);button(b,'다이어리 돌아가기',diary);
 }finally{showcaseBusy=false;}
}

function drawWorldCondition(now,visibleObjects=[]){if(!map)return;drawEnvironment(ctx,map,crisisState(ensureStory(state),quizData),camera);}

function questDialog(id){const q=quests.find(q=>q.id===id);if(!q)return;if(state.completed.includes(id)){panel(q.title,state.diary.find(d=>d.id===id).consequence);return;}if(!state.intro||progress()?.id!==id){panel('이어지는 하루','화면 위에 표시된 다음 이야기부터 이어 가자. 이곳은 자유롭게 둘러봐도 좋아.');return;}const b=panel(q.title,q.story,map.npcs.find(n=>n.quest===id)?.variant);const reason=field(b,'선택한 이유 (선택 사항)','');for(const [i,c]of q.choices.entries())button(b,c[0],()=>{const old=state.stage;ensureLife(state).coreReasons[q.id]=reason.value;if(choose(state,q,i)){applyCoreEffects(q,i);if(old!==state.stage)transitionUntil=performance.now()+2500;save();refreshGuide(true);updateHUD();const p=panel('내 선택이 이어지는 미래',c[1]+' '+q.concept);button(p,'다음 하루로 이어가기',()=>{close();if(old!==state.stage)transitionUntil=performance.now()+2500;});}},c[1]);}
function summary(){return [storySummary(state),quizLearningSummary(),'서라벌여중: 나의 미래 다이어리 (추가 탐험 기록)',...state.diary.map(x=>`${x.title}: ${x.choice}\n${x.consequence}`),'나의 성찰: '+state.reflection,lifeSummary(state,activities)].join('\n\n');}
function translateGameExport(text){
 if(getLanguage()!=='ru')return text;
 const life=ensureLife(state),story=ensureStory(state);
 const free=[state.reflection,story.reflection,life.plan,life.reason,...(life.history||[]).flatMap(x=>[x.reason,x.plan]),...(life.events||[]).map(x=>x.reason)].filter(x=>typeof x==='string'&&x.length);
 let value=text;const preserved=[];
 for(const input of [...new Set(free)].sort((a,b)=>b.length-a.length)){
  if(!value.includes(input))continue;
  const token=`@@DIARY_INPUT_${preserved.length}@@`;preserved.push([token,input]);value=value.replaceAll(input,token);
 }
 value=translate(value);
 for(const [token,input] of preserved)value=value.replaceAll(token,input);
 return value;
}
function download(name,text,type='application/json'){const content=type==='text/plain'?translateGameExport(text):text;const u=URL.createObjectURL(new Blob([content],{type}));const a=document.createElement('a');a.href=u;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(u),1000);}
function diary(){const b=panel(ensureStory(state).complete?'65세 · 나의 미래 다이어리':'나의 미래 다이어리',state.ending?'삶에는 하나의 정답이 없다. 지금의 선택을 돌아보고, 다음 페이지에 담고 싶은 삶을 생각해 보자.':'작은 선택이 쌓여 나만의 이야기가 됩니다.');const stats=document.createElement('div');stats.className='stats';for(const k of ['money','health','leisure','relations']){const d=document.createElement('div');d.textContent=STAT_NAMES[k]+' · '+state.stats[k];stats.append(d);}b.append(stats);const note=document.createElement('p');note.textContent='수치는 가상 자원 상태이며 성적·삶의 우열·실제 미래 예측이 아닙니다.';b.append(note);renderStoryDiary(b);for(const d of state.diary){const e=document.createElement('article');e.className='entry';const strong=document.createElement('strong');strong.textContent=d.title+' · '+d.choice;const p=document.createElement('p');p.textContent=d.consequence;const small=document.createElement('small');small.textContent=d.concept;e.append(strong,p,small);b.append(e);}const label=document.createElement('label');label.textContent='나는 어떤 삶을 중요하게 생각하며, 지금부터 무엇을 준비할까?';const area=document.createElement('textarea');area.value=state.reflection;area.maxLength=2000;area.setAttribute('aria-label','나의 미래 성찰');area.onchange=()=>{state.reflection=area.value;save();};b.append(label,area);renderLifeDiary(b);button(b,'성찰 저장',()=>{state.reflection=area.value;save();toast('나의 생각을 기록했어요.');});button(b,'다이어리 글 내려받기',()=>download('미래-다이어리.txt',summary(),'text/plain'));button(b,'진행 기록 백업 파일 받기',()=>download('미래-다이어리-백업.json',JSON.stringify(state)));button(b,'백업 파일 불러오기',()=>{const input=document.createElement('input');input.type='file';input.accept='.json';input.onchange=async()=>{try{if(input.files[0].size>500000)throw Error();const s=JSON.parse(await input.files[0].text());if(!isState(s)||(s.life&&!isLifeState(s.life))||!catalog.some(m=>m.id===s.map))throw Error();state=s;ensureLife(state);state.guideOn=true;close();await loadMap(s.map,[s.x/T,s.y/T]);toast('백업을 복원했어요.');}catch{toast('올바른 게임 백업 파일이 아니에요.');}};input.click();});if(bridgeReady)button(b,'이 기기의 서버 기록 복원',()=>{pendingNonce=crypto.randomUUID();bridge('streamlit:setComponentValue',{value:{action:'restore',id:state.id,token:state.token,nonce:pendingNonce},dataType:'json'});});}
function travel(){const b=panel('우리의 학교, 미래의 마을','빠른 이동은 수업 시간 안에 이야기를 만날 수 있도록 도와줍니다. 학교 방 배치는 실제 배치도 확인 전 임시 구성입니다.');const grid=document.createElement('div');grid.className='map-grid';b.append(grid);for(const id of new Set(['school','floor1','floor2','floor3','floor4','room-2-1','town',state.home,state.work,...(storyData?storyData.chapters.flatMap(c=>c.events.map(e=>e.map)):[]),...quests.map(q=>q.place)])){const m=catalog.find(m=>m.id===id);if(!m)continue;button(grid,m.name,()=>{close();loadMap(id,m.spawn);});}const h=document.createElement('p');h.textContent='방문한 공간 '+state.visited.length+'곳 · 총 '+catalog.length+'개 맵';b.append(h);}
function guide(){state.guideOn=!state.guideOn;refreshGuide(true);updateHUD();save(false);}
let lastTouchAction=-1000;
$('actBtn').addEventListener('pointerup',e=>{if(e.pointerType==='touch'){e.preventDefault();lastTouchAction=performance.now();interact();}});
$('actBtn').onclick=()=>{if(performance.now()-lastTouchAction>600)interact();};$('storyBtn').onclick=()=>storyPanel();$('diaryBtn').onclick=diary;$('menuBtn').onclick=pauseMenu;$('activityBtn').onclick=activityBoard;$('guideBtn').onclick=guide;$('runBtn').onclick=()=>{run=!run;$('runBtn').setAttribute('aria-pressed',run);};
const dirs={up:[0,-1],down:[0,1],left:[-1,0],right:[1,0]};
for(const b of document.querySelectorAll('[data-dir]')){b.onpointerdown=e=>{e.preventDefault();b.setPointerCapture(e.pointerId);pointers.set(e.pointerId,b.dataset.dir);};for(const evt of ['pointerup','pointercancel','lostpointercapture'])b.addEventListener(evt,e=>pointers.delete(e.pointerId));}
addEventListener('keydown',e=>{if(e.target.matches('textarea,input')||modal.open)return;if(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight',' '].includes(e.key))e.preventDefault();keys.add(e.key.toLowerCase());if(!e.repeat&&(e.key==='Enter'||e.key===' '))interact();if(!e.repeat&&e.key.toLowerCase()==='m')travel();if(!e.repeat&&e.key.toLowerCase()==='j')diary();if(!e.repeat&&e.key==='Escape')pauseMenu();if(!e.repeat&&e.key.toLowerCase()==='b')activityBoard();if(!e.repeat&&e.key.toLowerCase()==='q')storyPanel();});
addEventListener('keyup',e=>keys.delete(e.key.toLowerCase()));addEventListener('blur',()=>{keys.clear();pointers.clear();writeAutosave();});document.addEventListener('visibilitychange',()=>{keys.clear();pointers.clear();last=0;writeAutosave();});addEventListener('pagehide',writeAutosave);
function drawAsset(index,x,y,w,h){const tier=worldTier(ensureStory(state)).tier;const damaged=tier>=2&&((Math.floor(x/32)*13+Math.floor(y/32)*17)%7<tier*2);if(index===32){ctx.drawImage(damaged&&images['school-ruin']?images['school-ruin']:images.school,Math.round(x-camera.x),Math.round(y-camera.y),w,h);return;}const im=index>=65?images.details:index>=49?images.facilities:index>=33?images.furniture:index>=16?(damaged&&images['buildings-ruin']?images['buildings-ruin']:images.buildings):images.environment;index=index>=65?index-65:index>=49?index-49:index>=33?index-33:index>=16?index-16:index;const cellW=index<16&&im!==images.environment&&im===images['buildings-ruin']?im.width/4:256,cellH=im===images['buildings-ruin']?im.height/4:256;ctx.drawImage(im,index%4*cellW,Math.floor(index/4)*cellH,cellW,cellH,Math.round(x-camera.x),Math.round(y-camera.y),w,h);}
function actor(x,y,variant,dir=0,anim=0,player=false){if(player&&images.avatars){ctx.drawImage(images.avatars,anim*32,(variant*4+dir)*48,32,48,Math.round(x-camera.x-16),Math.round(y-camera.y-43),32,48);drawAccessory(x,y,dir);return;}if(variant>=4){const n=(variant-4)%35;ctx.drawImage(images.npcs,n%7*32,Math.floor(n/7)*48,32,48,Math.round(x-camera.x-16),Math.round(y-camera.y-43),32,48);return;}if(images.avatars){ctx.drawImage(images.avatars,anim*32,(variant*4+dir)*48,32,48,Math.round(x-camera.x-16),Math.round(y-camera.y-43),32,48);return;}ctx.save();if(variant)ctx.filter=`hue-rotate(${variant*31%360}deg)`;ctx.drawImage(images.characters,anim*32,dir*48,32,48,Math.round(x-camera.x-16),Math.round(y-camera.y-43),32,48);ctx.restore();}
function label(text,x,y,color='#fff9e6'){const xx=Math.round(x-camera.x),yy=Math.round(y-camera.y);ctx.font='9px "Malgun Gothic",sans-serif';ctx.textAlign='center';const translated=translate(text);const w=ctx.measureText(translated).width;ctx.fillStyle='#423d4cbd';ctx.fillRect(xx-w/2-5,yy-10,w+10,15);ctx.fillStyle=color;ctx.fillText(translated,xx,yy);}
function drawMini(){if(!map)return;const w=144;
if(!minimapBase){
 const off=document.createElement('canvas');off.width=w;off.height=w;
 const octx=off.getContext('2d');octx.fillStyle='#66866b';octx.fillRect(0,0,w,w);
 for(let y=0;y<map.height;y+=2)for(let x=0;x<map.width;x+=2){octx.fillStyle=map.solid[y*map.width+x]?'#536254':map.tiles[y*map.width+x]===3?'#8dc4c8':'#d2cbb0';octx.fillRect(x/map.width*w,y/map.height*w,Math.ceil(w/map.width*2),Math.ceil(w/map.height*2));}
 minimapBase=off;
}
mini.drawImage(minimapBase,0,0);mini.fillStyle='#a388b2';for(const p of map.portals)mini.fillRect(p.x/map.width*w-2,p.y/map.height*w-2,4,4);if(routeTarget&&state.guideOn){mini.fillStyle='#ffe070';mini.fillRect(routeTarget.x/map.width*w-3,routeTarget.y/map.height*w-3,6,6);}mini.fillStyle='#fff8e0';mini.beginPath();mini.arc(state.x/T/map.width*w,state.y/T/map.height*w,3,0,7);mini.fill();}
function draw(now){if(!map)return;ctx.fillStyle='#263b3c';ctx.fillRect(0,0,canvas.width,canvas.height);const x0=Math.max(0,Math.floor(camera.x/T)),y0=Math.max(0,Math.floor(camera.y/T)),x1=Math.min(map.width,Math.ceil((camera.x+canvas.width)/T)),y1=Math.min(map.height,Math.ceil((camera.y+canvas.height)/T));for(let y=y0;y<y1;y++)for(let x=x0;x<x1;x++)ctx.drawImage(images.terrain,map.tiles[y*map.width+x]*32,0,32,32,Math.round(x*T-camera.x),Math.round(y*T-camera.y),32,32);
if(path.length){ctx.fillStyle='#faf1b4';for(let i=0;i<path.length;i+=2){const[x,y]=path[i];ctx.fillRect(x*T-camera.x-2,y*T-camera.y-2,4,4);}}
const visibleObjects=drawObjectsInView();const visible=visibleObjects.map(o=>({y:o.y*T+o.h-8,draw:()=>drawAsset(o.asset,o.x*T,o.y*T,o.w,o.h)}));
for(const n of activeNpcs())if(Math.abs(n.x*T-state.x)<canvas.width&&Math.abs(n.y*T-state.y)<canvas.height)visible.push({y:n.y*T,draw:()=>{actor(n.x*T,n.y*T,n.variant,n.direction||0,Math.floor(now/220)%4);label(n.name,n.x*T,n.y*T-51);}});
visible.push({y:state.y,draw:()=>{ctx.fillStyle='#24372f44';ctx.beginPath();ctx.ellipse(state.x-camera.x,state.y-camera.y,11,4,0,0,7);ctx.fill();actor(state.x,state.y,state.avatar,direction,moving?Math.floor(walk)%4+(run||keys.has('shift')?4:0):0,true);}});visible.sort((a,b)=>a.y-b.y);for(const o of visible)o.draw();
for(const p of map.portals){if(p.x*T<camera.x-100||p.x*T>camera.x+canvas.width+100||p.y*T<camera.y-100||p.y*T>camera.y+canvas.height+100)continue;ctx.fillStyle='#fff2ca';ctx.fillRect(p.x*T-camera.x-4,p.y*T-camera.y-3,8,4);label(p.label,p.x*T,p.y*T-18);}
for(const o of [...map.interactions,...activityObjects(),...discoveryObjects()]){if(state.completed.includes(o.quest))continue;const x=o.x*T-camera.x,y=o.y*T-camera.y-12;if(x<0||x>canvas.width||y<0||y>canvas.height)continue;if(o.activity||o.discovery)label(o.label,o.x*T,o.y*T-23,'#cff3e1');ctx.fillStyle=o.quest?'#ffe697':'#fff7d0';ctx.fillRect(x-2,y-5-Math.sin(now/350)*2,4,10);ctx.fillRect(x-5,y-2-Math.sin(now/350)*2,10,4);}
drawWorldCondition(now,visibleObjects);for(const n of activeNpcs())if(Math.abs(n.x*T-state.x)<canvas.width&&Math.abs(n.y*T-state.y)<canvas.height){actor(n.x*T,n.y*T,n.variant,n.direction||0,Math.floor(now/220)%4);label(n.name,n.x*T,n.y*T-51);}actor(state.x,state.y,state.avatar,direction,moving?Math.floor(walk)%4:0,true);drawVillageProjects();if(futureFlags(state).community&&map.id==='town'){for(let i=0;i<9;i++)drawAsset(1,(115+i*3)*T,139*T,32,48);}
drawLifeChanges(now);drawGuidance(now);if(loading){ctx.fillStyle='#fff8edb0';ctx.fillRect(0,0,canvas.width,canvas.height);}
}
function tick(now){
 try{tickFrame(now);frameFaults=0;}
 catch(error){
  if(frameFaults===0||performance.now()-lastFrameErrorAt>1000){recordRuntimeError('화면 갱신',error);console.error('게임 화면 복구:',error);$('saveStatus').title=error.stack||error.message;}
  lastFrameErrorAt=performance.now();frameFaults++;
  if(frameFaults>=3){
   // A broken animation must not leave a silent, permanently frozen canvas.
   running=false;map=null;renderIndex=null;
   $('overlay').hidden=false;$('continueBtn').hidden=false;
   $('saveStatus').textContent='화면 오류 감지 · 이어서 걷기로 복구하세요';
   toast('화면 문제가 감지됐어요. 기록은 남아 있어요. 이어서 걷기를 눌러 주세요.');
   frameFaults=0;
  }
  requestAnimationFrame(tick);
 }
}
function tickFrame(now){if(last&&now-last<(state.life?.settings?.quality==='low'?31:15)){requestAnimationFrame(tick);return;}const raw=last?(now-last)/1000:1/60;const dt=Math.min(raw,.05);last=now;fps=fps*.95+(1/raw)*.05;if(map){if(running&&!document.hidden)state.playSeconds+=dt;if(running&&!modal.open&&!loading&&!document.hidden){let dx=0,dy=0;const active=[...pointers.values()];for(const [key,dir]of Object.entries({arrowup:'up',w:'up',arrowdown:'down',s:'down',arrowleft:'left',a:'left',arrowright:'right',d:'right'}))if(keys.has(key))active.push(dir);for(const dir of new Set(active)){dx+=dirs[dir][0];dy+=dirs[dir][1];}moving=!!(dx||dy);if(moving){const len=Math.hypot(dx,dy);dx/=len;dy/=len;direction=Math.abs(dx)>Math.abs(dy)?dx<0?1:2:dy<0?3:0;const speed=(run||keys.has('shift')?190:110)*dt,nx=state.x+dx*speed,ny=state.y+dy*speed;if(pass(nx-8,state.y)&&pass(nx+8,state.y))state.x=nx;if(pass(state.x-8,ny)&&pass(state.x+8,ny))state.y=ny;walk+=dt*(run?12:7);}if(now-lastSave>20000){writeAutosave();lastSave=now;}}else moving=false;const tx=Math.max(0,Math.min(map.width*T-canvas.width,state.x-canvas.width/2)),ty=Math.max(0,Math.min(map.height*T-canvas.height,state.y-canvas.height*.60));camera.x+=(tx-camera.x)*Math.min(1,dt*14);camera.y+=(ty-camera.y)*Math.min(1,dt*14);draw(state.life?.settings?.reducedMotion?0:now);if(now-lastHud>400){updateQuestHelp(Math.min((now-lastHud)/1000,1));refreshGuide();drawMini();const n=nearby();$('prompt').style.display=running&&n&&!modal.open?'block':'none';$('prompt').textContent=n?(n.type==='portal'?'들어가기 · ':'이야기 · ')+(n.label||n.name):'';$('perf').textContent=Math.round(fps)+' FPS';lastHud=now;}}frame++;requestAnimationFrame(tick);}
async function start(resume){if(resume){const s=readLocal();if(s)state=s;}else {state=freshState();state.avatar=chosen;}ensureLife(state);if(!localStorage.getItem('seorabeol.diary.language')&&state.life.settings?.language)setLanguage(state.life.settings.language);applyAppearance();document.body.classList.toggle('large-text',!!state.life.settings?.largeText);state.guideOn=state.guideOn!==false&&focusMode();questIdle=0;questHelpShown=0;const opened=await loadMap(state.map,[state.x/T,state.y/T]);
if(!opened){$('overlay').hidden=false;$('saveStatus').textContent='지역을 불러오지 못했어요 · 인터넷 연결 후 다시 시도';return;}
$('overlay').hidden=true;running=true;save();}
$('startBtn').onclick=()=>start(false);$('continueBtn').onclick=()=>start(true);
try{[catalog,quests,graph,activities,storyData,quizData,ruStory,ruQuiz,ruExplore,ruVariants,ruContext,ruInterface,ruMaps]=await Promise.all(['catalog','quests','connections','activities','story_v4','quiz_v5'].map(n=>fetch('data/'+n+'.json').then(r=>{if(!r.ok)throw Error(n+' 로드 실패');return r.json()})).concat(['ru_story','ru_quiz','ru_explore','ru_variants','ru_context','ru_interface','ru_maps'].map(n=>fetch(n+'.json').then(r=>{if(!r.ok)throw Error(n+' 로드 실패');return r.json()}))));prepareI18n(storyData,ruStory,quizData,ruQuiz,catalog,quests,activities,ruExplore,ruVariants,ruContext,ruInterface,ruMaps);watchI18n();setLanguage(initializeLanguage()); await Promise.all(['terrain','environment','characters','npcs','portraits','buildings','school','furniture','facilities','details'].map(img));await Promise.all(['buildings-ruin','school-ruin'].map(name=>img(name).catch(()=>{})));await img('avatars').then(()=>{images.avatarsOriginal=images.avatars;}).catch(()=>{});await loadMap('school',[64,52]);for(let i=0;i<6;i++){const b=document.createElement('button'),c=document.createElement('canvas');c.width=32;c.height=48;const cx=c.getContext('2d');if(images.avatars)cx.drawImage(images.avatars,0,i*192,32,48,0,0,32,48);else{cx.filter=`hue-rotate(${i*31}deg)`;cx.drawImage(images.characters,0,0,32,48,0,0,32,48);}b.append(c);b.setAttribute('aria-label','캐릭터 '+(i+1));if(!i)b.className='selected';b.onclick=()=>{chosen=i;document.querySelectorAll('.character-row button').forEach(x=>x.className='');b.className='selected';};$('characters').append(b);}if(readLocal()){$('continueBtn').hidden=false;$('startBtn').textContent='새 다이어리 시작';}requestAnimationFrame(tick);if(debug)window.__game={get state(){return state},get map(){return map},get cacheSize(){return cache.size},get mapLoading(){return loading},get frameFaults(){return frameFaults},get fps(){return fps},get path(){return path},get target(){return routeTarget},get mainObjective(){return mainGuideGoal()},get questIdle(){return questIdle},get focusMode(){return focusMode()},get goal(){return storyGoal()||goalFor(state,quests)},get story(){return ensureStory(state)},get storyEvent(){return currentEvent(state,storyData)},get quizData(){return quizData},get quiz(){return ensureQuiz(ensureStory(state))},quizPanel,quizStudyPanel,endingShowcase,setLanguage:(lang)=>{setLanguage(lang);updateHUD();},storyChoose:(index)=>{const r=performStoryChoice(state,storyData,index);if(r.ok){save();updateHUD();refreshGuide(true);}return r;},storyPanel,refreshGuide,loadMap,interact,save,diary,travel,guide,start,choose:(id,i)=>{const q=quests.find(q=>q.id===id);if(choose(state,q,i))applyCoreEffects(q,i);save();updateHUD();},setPosition:(x,y)=>{state.x=x*T;state.y=y*T;},questDialog,activityBoard,activityPanel,eventPanel,pauseMenu,activities,ensureLife:()=>ensureLife(state)};}catch(e){$('startBtn').disabled=true;$('startBtn').textContent='파일을 불러오지 못했어요';toast(e.message);console.error(e);}
setInterval(()=>{if(running&&!document.hidden&&bridgeReady&&remoteAck<state.revision)bridge('streamlit:setComponentValue',{value:{action:'save',state},dataType:'json'});},30000);







function refreshGuide(force=false){
 if(!map||!graph)return;
 const objective=mainGuideGoal();
 // A quiz/ending is an on-screen action, not a fictional NPC at the player's position.
 if(objective.kind!=='story'){routeTarget=null;path=[];lastGuidanceKey='';return;}
 const other=objective.map!==map.id;
 const hop=other?nextMapHop(graph,map.id,objective.map):null;
 const portal=other?portalTarget(map,hop):null;
 const point=other?portal&&[portal.x,portal.y]:storyPoint(map);
 if(!point){routeTarget=null;path=[];lastGuidanceKey='';return;}
 routeTarget={x:point[0],y:point[1],label:other?(portal.label||'다음 통로'):objective.title,kind:other?'portal':'npc'};
 if(!state.guideOn){path=[];lastGuidanceKey='';return;}
 const key=waypointKey(map.id,state.x/T,state.y/T,objective.id,point);
 if(!force&&key===lastGuidanceKey)return;
 if(!force&&path.length){
  let near=Infinity,index=-1;
  for(let i=0;i<path.length;i++){const dist=Math.hypot(path[i][0]*T-state.x,path[i][1]*T-state.y);if(dist<near){near=dist;index=i;}}
  if(near<70){path=path.slice(index);lastGuidanceKey=key;return;}
 }
 const result=approachPath(map,[state.x/T,state.y/T],point);
 path=result||[];lastGuidanceKey=key;
 if(result===null){routeMiss={key,at:performance.now()};}else routeMiss=null;
}
function endingPanel(){const ending=lifeEnding(state,activities);const b=panel('변화한 학교, 아직 쓰고 있는 나의 미래','일과 집, 돌봄과 마을을 선택하며 무엇이 달라졌나요? 재무·건강·여가·대인 관계를 떠올리고 내가 준비할 한 가지를 적어 보세요.');const result=document.createElement('article');result.className='entry';result.textContent=ending.title+' · '+ending.description;b.append(result);const a=document.createElement('textarea');a.maxLength=2000;a.value=state.reflection;a.setAttribute('aria-label','엔딩 성찰');b.append(a);button(b,'미래 다이어리 완성',()=>{if(!a.value.trim()){toast('내 생각을 한 문장 남겨 주세요.');return;}state.reflection=a.value;state.ending=true;save();refreshGuide(true);updateHUD();diary();});}
function drawQuestStar(now){
 if(!focusMode()||!routeTarget||!map)return;
 const sx=routeTarget.x*T-camera.x,sy=routeTarget.y*T-camera.y-45;
 if(sx<-30||sx>canvas.width+30||sy<-35||sy>canvas.height+35)return;
 const bob=state.life?.settings?.reducedMotion?0:Math.sin(now/320)*4;
 ctx.save();ctx.translate(sx,sy+bob);ctx.shadowColor='#cf8f13';ctx.shadowBlur=5;ctx.fillStyle='#ffd54d';ctx.strokeStyle='#76552c';ctx.lineWidth=1.5;
 ctx.beginPath();for(let i=0;i<10;i++){const a=-Math.PI/2+i*Math.PI/5,r=i%2?7:15;const x=Math.cos(a)*r,y=Math.sin(a)*r;if(!i)ctx.moveTo(x,y);else ctx.lineTo(x,y);}ctx.closePath();ctx.fill();ctx.stroke();ctx.restore();
}
function drawGuidance(now){if(state.guideOn&&routeTarget&&!ensureStory(state).complete){const p=path.find(p=>p[0]*T-camera.x>canvas.width-32||p[0]*T-camera.x<32||p[1]*T-camera.y<80||p[1]*T-camera.y>canvas.height-95)||[routeTarget.x,routeTarget.y];const x=Math.max(24,Math.min(canvas.width-24,p[0]*T-camera.x)),y=Math.max(90,Math.min(canvas.height-100,p[1]*T-camera.y));ctx.save();ctx.translate(x,y);const outside=Math.abs(p[0]*T-camera.x-x)>1||Math.abs(p[1]*T-camera.y-y)>1;ctx.rotate(outside?Math.atan2(p[1]*T-state.y,p[0]*T-state.x)-Math.PI/2:0);ctx.fillStyle='#ffdf75';ctx.beginPath();ctx.moveTo(0,8);ctx.lineTo(-7,-5);ctx.lineTo(7,-5);ctx.fill();ctx.restore();}drawQuestStar(now);const flags=futureFlags(state);for(const layer of map.futureLayers||[])if(flags[layer.when]){const o=layer.objects[0];if(Math.abs(o.x*T-state.x)<canvas.width&&Math.abs(o.y*T-state.y)<canvas.height)label(layer.label,o.x*T+o.w/2,o.y*T-5,'#fff0b0');}if(state.intro&&now<transitionUntil){ctx.fillStyle='#faf2dedb';ctx.fillRect(0,canvas.height/2-30,canvas.width,60);ctx.fillStyle='#5d485e';ctx.textAlign='center';ctx.font='18px sans-serif';ctx.fillText(translate('시간이 흘러 · ')+translate(state.stage),canvas.width/2,canvas.height/2+7);}}

function activeNpcs(){const tier=worldTier(ensureStory(state)).tier;const list=map.npcs.filter((n,i)=>(n.quest!=='retire'||map.id===state.home)&&(n.quest||!['town','school'].includes(map.id)||tier<2||i%(tier===3?5:3)===0)).map((n,i)=>{const o={...n};if(!n.quest&&ensureStory(state).chapter>=2)o.text=(tier>=2?'일부 시설이 운영을 멈췄어요. 돌봄과 일자리, 안전한 길을 함께 준비하면 다시 회복할 수 있어요.':ensureQuiz(ensureStory(state)).projects.length?'주민들이 정책을 실천하면서 시설을 수리하고 세대가 함께 배우기 시작했어요.':'인구 구성이 달라져도 모든 세대가 함께 살아갈 수 있는 시설을 준비하고 있어요.')+'\n\n'+(n.text||'');if(!n.quest&&running&&!state.life?.settings?.reducedMotion&&Math.abs(n.x*T-state.x)<640){const phase=Math.floor(performance.now()/4000+i)%4;const dx=[0,1,0,-1][phase];if(pass((n.x+dx)*T,n.y*T)){o.x+=dx;o.direction=dx<0?1:dx>0?2:0;}}return o;});if(state.stage==='노년기'&&map.id==='town')for(let i=0;i<list.length;i++){if(i%3===0){list[i].variant=i%2?36:35;list[i].name='오래 함께한 이웃';}}const m=storyMarker();if(m)list.push(m);if(state.completed.includes('care')&&['care','school'].includes(map.id))list.push({x:map.id==='school'?71:21,y:map.id==='school'?55:18,name:['돌봄 연결 담당자','역할을 나누는 이웃','저녁 돌봄 담당자'][state.choices.care],variant:27,text:['공공 돌봄과 근무 시간을 함께 조정하고 있어요.','성별에 관계없이 동의한 사람들이 시간을 나누고 있어요.','저녁 돌봄과 방문 지원의 빈 시간을 연결하고 있어요.'][state.choices.care]});return list;}
function npcStory(o){let t=o.text||'';if(map?.id==='town'&&ensureStory(state).chapter>=4){const tier=worldTier(ensureStory(state));t+=' 지금 우리 마을은 '+tier.label+' 상태야. 일자리·인구 이동·지역 정책·서로 돕는 활동이 함께 영향을 주고 있어.';}const life=ensureLife(state),local=life.history.filter(h=>activities.activities.find(a=>a.id===h.id)?.map===map.id);if(local.length)t+=' 네가 이곳에서 '+local.at(-1).title+'을 체험한 뒤 우리 일상이 달라졌어. '+local.at(-1).consequence;if(state.completed.length&&map.id===state.home)t+=' 이곳은 네가 선택한 집이야. '+state.diary[0].consequence;if(state.completed.length&&map.id===state.work)t+=' 네가 고른 일터에서 배우는 하루가 시작됐어.';if(state.completed.includes('day')&&map.id==='cafe')t+=' '+state.diary.find(d=>d.id==='day').consequence;if(state.completed.includes('care')&&map.id==='care')t+=' '+state.diary.find(d=>d.id==='care').consequence;if(state.completed.includes('policy')&&['school','town','hall'].includes(map.id))t+=' '+state.diary.find(d=>d.id==='policy').consequence;return t;}

function field(parent,label,value='',limit=600){const l=document.createElement('label');l.textContent=label;const a=document.createElement('textarea');a.value=value;a.maxLength=limit;a.setAttribute('aria-label',label);a.className='short-field';parent.append(l,a);return a;}
function activityObjects(){if(!activities||!map)return [];return availableActivities(state,activities,map.id).slice(0,6).map((a,i)=>{let x,y;if(a.point){[x,y]=a.point;}else if(map.kind==='room'){x=10+i*2;y=22;}else if(map.id==='school'){x=57+i*3;y=55;}else{x=119+i*3;y=129;}if(!pass(x*T,y*T))return null;return {x,y,label:a.title,name:a.title,activity:a.id};}).filter(Boolean);}
function lifeStats(parent){const l=ensureLife(state),box=document.createElement('div');box.className='stats';for(const k of ['money','time','fatigue','satisfaction','growth','stability','preparation','relations','health']){const d=document.createElement('div');d.textContent=LIFE_NAMES[k]+' · '+l[k]+(k==='time'?'분':'');box.append(d);}parent.append(box);}
function effectsText(effect){return Object.entries(effect).map(([k,v])=>(LIFE_NAMES[k]||koreanLabel(k))+' '+(v>0?'+':'')+v).join(' · ');}
function activityBoard(){const b=panel('오늘을 직접 설계하기','핵심 이야기는 위의 길 안내를 따라가요. 이곳의 체험은 원하는 순서로 선택할 수 있어요. 시간과 생활자금을 나누고, 선택 뒤에 새로 열린 활동도 찾아보세요.');const l=ensureLife(state);const note=document.createElement('p');note.textContent=l.day+'일째 · 남은 시간 '+l.time+'분 · 피로 '+l.fatigue+' · 생활자금 '+l.money;b.append(note);const local=availableActivities(state,activities,map.id);if(local.length){const h=document.createElement('h3');h.textContent='지금 이곳에서 할 수 있는 일';b.append(h);for(const a of local){const status=activityStatus(state,a);button(b,a.title,()=>activityPanel(a),a.time+'분 · '+(status.ok?a.concept:status.message));}}const h=document.createElement('h3');h.textContent='마을에서 찾아보기';b.append(h);const grid=document.createElement('div');grid.className='map-grid';b.append(grid);for(const a of availableActivities(state,activities).filter(a=>!local.includes(a))){const m=catalog.find(m=>m.id===a.map);button(grid,a.title,async()=>{close();if(m)await loadMap(m.id,m.spawn);activityPanel(a);},(m?.name||'어디서나')+' · '+a.time+'분');}const e=pendingEvent(state,activities);if(e)button(b,'아직 해결하지 않은 사건 · '+e.title,()=>eventPanel(e));}
function activityPanel(a){if(!a)return;const l=ensureLife(state),status=activityStatus(state,a),b=panel(a.title,a.story||a.description||a.concept);const p=document.createElement('p');p.textContent=a.time+'분을 사용해요 · '+a.concept;b.append(p);if(!status.ok){const n=document.createElement('p');n.textContent=status.message;b.append(n);button(b,'다른 활동 찾아보기',activityBoard);return;}const reason=field(b,'이 활동을 고른 이유 (선택 사항)',l.reason);const plan=field(b,'다음에 준비할 일 (선택 사항)',l.plan);for(const [i,c]of a.choices.entries()){const btn=button(b,c.label,()=>{const finish=score=>{const r=performActivity(state,a,i,{reason:reason.value,plan:plan.value,score});if(!r.ok){toast(r.message);return;}save();updateHUD();const p=panel('나의 하루가 달라졌어요',r.message);const result=document.createElement('p');result.textContent=effectsText(r.entry.effects);p.append(result);if(c.followUp?.length){const n=document.createElement('p');n.textContent='새로운 기회가 활동 메뉴에 열렸어요.';p.append(n);}button(p,'계속 탐험하기',()=>{close();const e=pendingEvent(state,activities);if(e){save();eventPanel(e);}});button(p,'다이어리 확인하기',diary);};if(a.minigame)minigamePanel(a,finish);else finish(0);},(c.consequence||'')+'\n'+effectsText(c.effect));btn.disabled=l.money+(c.effect.money||0)<0;}}
function minigamePanel(a,done){const b=panel(a.title+' · 직업 작업대',a.minigame.instructions);runHandsOn(b,a.minigame.type,score=>done(score));}

function eventPanel(e){const b=panel('계획에 없던 하루 · '+e.title,e.story||e.description);const reason=field(b,'어떻게 대응하고 싶은가요? (선택 사항)');for(const [i,c]of e.choices.entries())button(b,c.label,()=>{const r=resolveEvent(state,e,i,{reason:reason.value});if(!r.ok){toast(r.message);return;}save();updateHUD();const p=panel('다시 이어 쓰는 계획',r.message);const n=document.createElement('p');n.textContent=effectsText(r.entry.effects);p.append(n);button(p,'계속 탐험하기',close);},effectsText(c.effect));}
function renderLifeDiary(b){const l=ensureLife(state),ending=lifeEnding(state,activities),h=document.createElement('h3');h.textContent='나만의 생애설계';b.append(h);lifeStats(b);const e=document.createElement('article');e.className='entry';e.textContent=ending.title+' · '+ending.description;b.append(e);for(const item of [...l.history,...l.events]){const article=document.createElement('article');article.className='entry';const strong=document.createElement('strong');strong.textContent=item.day+'일 · '+item.title+' · '+item.choice;const p=document.createElement('p');p.textContent=item.consequence;const why=document.createElement('small');why.textContent='이유: '+(item.reason||'아직 기록하지 않았어요')+' · '+effectsText(item.effects);article.append(strong,p,why);b.append(article);}for(const d of state.diary){if(!l.coreReasons[d.id])continue;const p=document.createElement('p');p.textContent=d.title+'을 선택한 이유: '+l.coreReasons[d.id];b.append(p);}const plan=field(b,'지금부터 실천할 미래 계획',l.plan);plan.oninput=()=>{l.plan=plan.value;};button(b,'미래 계획 저장',()=>{l.plan=plan.value;save();toast('미래 계획을 저장했어요.');});}
function pauseMenu(){const b=panel('다이어리 잠시 펼치기','천천히 둘러봐도 좋아요. 필요한 메뉴를 골라요.');button(b,'계속 걷기',close);button(b,'지도 · 빠른 이동',travel);button(b,'오늘의 자유 활동',activityBoard);button(b,'⭐ 현재 목표로 안내받기',()=>{$('missionMapBtn').click();});button(b,'📔 15~65세 메인 스토리',()=>storyPanel());button(b,'📚 미래 사회 퀴즈 학습장',quizStudyPanel);button(b,'퀘스트 일지 (기존 자유 탐험)',questJournal);button(b,'나의 다이어리',diary);button(b,'가방 · 발견한 기록',inventory);button(b,'캐릭터 꾸미기',customize);button(b,'설정',settings);button(b,'지금 저장',()=>{save();toast('진행 상황을 저장했어요.');});button(b,'문제 진단 기록 내려받기',exportDiagnostics);if(['home','rental','shared'].includes(map.id))button(b,'집에서 쉬고 다음 날 시작',()=>{const r=nextDay(state);if(r.ok){save();updateHUD();close();}toast(r.message);});else button(b,'집으로 돌아가 쉬기',async()=>{close();const m=catalog.find(m=>m.id===state.home);await loadMap(m.id,m.spawn);pauseMenu();});button(b,'타이틀로 돌아가기',()=>{save();close();running=false;$('overlay').hidden=false;$('continueBtn').hidden=false;});}
function questJournal(){const b=panel('기존 이야기 탐험','v3의 다섯 이야기와 자유 체험은 보존되었습니다. 새로운 메인 스토리와 별도로 진행할 수 있어요.');for(const q of quests){const d=state.diary.find(x=>x.id===q.id);const p=document.createElement('article');p.className='entry';p.textContent=(d?'완료 · ':'앞으로 · ')+q.title+'\n'+(d?d.consequence:q.concept);b.append(p);if(!d&&q===progress())button(b,'이 이야기로 안내받기',()=>{state.guideOn=true;refreshGuide(true);updateHUD();close();});}button(b,'자유 활동 살펴보기',activityBoard);}
function inventory(){const l=ensureLife(state),b=panel('발견한 기록 가방','탐험과 배움의 흔적을 모아요. 성적이나 순위는 매기지 않아요.');const items=[...(l.fragments||[]).map(id=>{const d=DISCOVERIES.find(d=>d.id===id);return[d?.name||id,d?.text||'발견한 메모'];}),['미래 다이어리','내가 고른 다섯 이야기와 성찰'],...Object.keys(l.careers).map(k=>[koreanLabel(k,'career')+' 체험 배지',l.careers[k]+'번 체험한 기억']),...l.unlocked.map(k=>[activities.activities.find(a=>a.id===k||a.requires===k)?.title||k,'선택으로 열린 새로운 기회']),['학교 탐험 지도',state.visited.filter(id=>id.startsWith('room-')).length+'개 교실을 방문했어요']];for(const [name,detail]of items){const p=document.createElement('article');p.className='entry';p.textContent=name+' · '+detail;b.append(p);}}
function customize(){applyAppearance();const b=panel('나의 모습 고르기','머리 모양과 피부색, 옷차림이 다른 캐릭터 중 마음에 드는 모습을 골라요.');const row=document.createElement('div');row.className='character-row';b.append(row);for(let i=0;i<6;i++){const btn=button(row,'',()=>{state.avatar=i;save();customize();});btn.setAttribute('aria-label','모습 '+(i+1));const c=document.createElement('canvas');c.width=32;c.height=48;const cx=c.getContext('2d');if(images.avatars)cx.drawImage(images.avatars,0,i*192,32,48,0,0,32,48);else cx.drawImage(images.characters,0,0,32,48,0,0,32,48);btn.append(c);if(state.avatar===i)btn.classList.add('selected');}const ap=ensureLife(state).appearance??={hair:0,skin:0,outfit:0,bag:0,glasses:false};for(const [key,title,choices]of [['hair','머리색',['기본','밤색','짙은색','자두색']],['skin','피부색',['기본','밝은색','중간색','진한색']],['outfit','옷 색',['기본','세이지','라벤더','복숭아']],['bag','가방',['민트','갈색','보라']]]){const row=document.createElement('div');row.className='palette-row';const l=document.createElement('label');l.textContent=title;b.append(l,row);choices.forEach((name,i)=>{const btn=button(row,name,()=>{ap[key]=i;applyAppearance();save();customize();});btn.setAttribute('aria-pressed',ap[key]===i);});}button(b,'안경 '+(ap.glasses?'착용':'없음'),()=>{ap.glasses=!ap.glasses;save();customize();});button(b,'이 모습으로 걷기',close);}
function setGameLanguage(code){
 setLanguage(code);
 const l=ensureLife(state);l.settings??={};l.settings.language=getLanguage();
 if(running)save(false);
 if(map)updateHUD();
 $('quickLanguageBtn').textContent='🌐 '+(getLanguage()==='ru'?'Русский / 한국어':'한국어 / Русский');
}
$('titleLanguageBtn').onclick=languageSettings;
$('quickLanguageBtn').onclick=()=>setGameLanguage(getLanguage()==='ru'?'ko':'ru');
function languageSettings(){
 const b=panel('언어 / Язык','한국어와 러시아어를 선택하세요. 이야기를 다시 시작하지 않고 즉시 바뀝니다.');
 for(const [code,label] of [['ko','🇰🇷 한국어'],['ru','🇷🇺 Русский']]){
  const btn=button(b,(getLanguage()===code?'✓ ':'')+label,()=>{
   setGameLanguage(code);languageSettings();
  });btn.setAttribute('aria-pressed',getLanguage()===code);
 }
 button(b,'설정',settings);
}
function settings(){const l=ensureLife(state);l.settings??={reducedMotion:matchMedia('(prefers-reduced-motion: reduce)').matches,quality:'normal'};const b=panel('편안하게 플레이하기','소리 없이도 모든 이야기를 이해할 수 있어요. 태블릿이 느리면 가벼운 화면을 선택해 주세요.');button(b,'🌐 언어 / Язык: '+(getLanguage()==='ru'?'Русский':'한국어'),languageSettings);button(b,'움직임 효과 '+(l.settings.reducedMotion?'줄임':'기본'),()=>{l.settings.reducedMotion=!l.settings.reducedMotion;save();settings();});button(b,'화면 품질 '+(l.settings.quality==='low'?'가벼움':'기본'),()=>{l.settings.quality=l.settings.quality==='low'?'normal':'low';save();settings();});button(b,'글씨 '+(document.body.classList.contains('large-text')?'크게':'기본'),()=>{document.body.classList.toggle('large-text');l.settings.largeText=document.body.classList.contains('large-text');save();});button(b,'플레이 모드 · '+(focusMode()?'스토리 집중':'자유 탐험'),()=>{focusSetting(!focusMode());settings();});button(b,'길 안내 '+(state.guideOn?'켜짐':'꺼짐'),()=>{guide();settings();});}
function drawLifeChanges(now){const l=ensureLife(state);if(!l.history.length)return;const local=l.history.filter(h=>activities.activities.find(a=>a.id===h.id)?.map===map.id);if(local.length){const x=map.kind==='room'?14:map.id==='school'?67:128,y=map.kind==='room'?18:map.id==='school'?57:132;drawAsset(local.at(-1).domain==='care'?73:local.at(-1).domain==='rest'?43:45,x*T,y*T,64,64);label('우리의 활동 기록 '+local.length+'장',x*T+32,y*T-3,'#cff3e1');}if(map.id==='town'&&l.unlocked.length){const n=Math.min(12,l.unlocked.length);for(let i=0;i<n;i++)drawAsset(1,(120+i*2)*T,136*T,32,48);}}

function applyCoreEffects(q,i){const l=ensureLife(state),c=q.choices[i];for(const k of ['health','relations'])l[k]=Math.max(0,Math.min(100,l[k]+(c[2][k]||0)));l.money=Math.max(0,l.money+(c[2].money||0));l.stability=Math.max(0,Math.min(100,l.stability+(c[2].support||0)));l.preparation=Math.min(100,l.preparation+6);l.satisfaction=Math.max(0,Math.min(100,l.satisfaction+(c[2].leisure||0)));if(q.id==='life')l.values=['배움과 안정','이웃과 협력','자율적인 시간'][i];}

addEventListener('storage',e=>{if(e.key!==KEY||!running)return;try{const incoming=JSON.parse(e.newValue);if(incoming?.id===state.id&&incoming.revision>state.revision){running=false;keys.clear();pointers.clear();close();$('overlay').hidden=false;$('continueBtn').hidden=false;toast('다른 탭에서 새 기록을 저장했어요. 이어서 걷기를 누르면 최신 기록을 가져와요.');}}catch{}});

const avatarPalettes=[['#513b36','#a66d50','#f4c8a6','#fff0d6','#775878'],['#272f3d','#555d6b','#e3a984','#a8c9bb','#4c6680'],['#704831','#c18b52','#c68c64','#edd3b3','#aa626b'],['#282d2f','#505c59','#f1c9af','#d1c2e5','#587760'],['#633d32','#ad7160','#a66b4e','#f2dfc4','#6f79a3'],['#394539','#718061','#d9a37e','#f4c7cf','#58647e']];
function applyAppearance(){if(!images.avatarsOriginal)return;const ap=state.life?.appearance;if(!ap){images.avatars=images.avatarsOriginal;return;}const off=document.createElement('canvas');off.width=256;off.height=1152;const cx=off.getContext('2d');cx.drawImage(images.avatarsOriginal,0,0);const px=cx.getImageData(0,0,256,1152),rgba=hex=>[parseInt(hex.slice(1,3),16),parseInt(hex.slice(3,5),16),parseInt(hex.slice(5,7),16)],hair=[null,['#553a32','#a66d50'],['#292e3d','#596074'],['#574358','#a887a4']][ap.hair],skin=[null,'#f1c9af','#ce916c','#9a6349'][ap.skin],cloth=[null,['#a8c9bb','#4c6680'],['#d1c2e5','#775878'],['#f4c7cf','#aa626b']][ap.outfit],bag=[null,['#a67b55','#d4b285','#ead4ad'],['#94749f','#c3a2d2','#e3cee9']][ap.bag];const maps=avatarPalettes.map(p=>{const entries=[];if(hair)entries.push([p[0],hair[0]],[p[1],hair[1]]);if(skin)entries.push([p[2],skin]);if(cloth)entries.push([p[3],cloth[0]],[p[4],cloth[1]]);if(bag)entries.push(['#6b968b',bag[0]],['#8abbab',bag[1]],['#c9e0c7',bag[2]]);return entries.map(([a,b])=>[rgba(a),rgba(b)]);});for(let i=0;i<px.data.length;i+=4){if(!px.data[i+3])continue;const row=Math.floor(i/4/256/192);for(const [a,b]of maps[row])if(px.data[i]===a[0]&&px.data[i+1]===a[1]&&px.data[i+2]===a[2]){px.data[i]=b[0];px.data[i+1]=b[1];px.data[i+2]=b[2];break;}}cx.putImageData(px,0,0);images.avatars=off;}
function drawAccessory(x,y,dir){if(!state.life?.appearance?.glasses||dir===3)return;const xx=Math.round(x-camera.x),yy=Math.round(y-camera.y-21);ctx.fillStyle='#544c68';if(dir===0){ctx.strokeStyle='#544c68';ctx.lineWidth=1;ctx.strokeRect(xx-5,yy-6,5,4);ctx.strokeRect(xx+1,yy-6,5,4);ctx.fillRect(xx-1,yy-5,2,1);}else ctx.fillRect(xx+(dir===1?-5:2),yy-6,5,2);}

function discoveryObjects(){if(!map)return [];return DISCOVERIES.filter(d=>d.map===map.id&&!state.life?.fragments?.includes(d.id)).map(d=>({x:d.point[0],y:d.point[1],label:'작은 발견 · '+d.name,discovery:d.id})).filter(d=>pass(d.x*T,d.y*T));}
function discoveryPanel(d){const b=panel(d.name,d.text);button(b,'메모 조각 보관하기',()=>{if(collectDiscovery(state,d)){save();updateHUD();toast('메모를 가방에 넣었어요 · 배움과 준비 +2');}close();});}

if(new URLSearchParams(location.search).has('qa-v53'))import('./qa_v53.js').then(m=>m.mountQA(window.__game));
