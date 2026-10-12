import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {approachPath,portalTarget,helpLevel,waypointKey,mainObjective} from '../components/rpg_game/quest_guide.js';
import {nextMapHop,freshState,isState} from '../components/rpg_game/systems.js';
import {ensureStory,currentEvent,performStoryChoice} from '../components/rpg_game/story.js';
import {ensureLife} from '../components/rpg_game/life.js';
import {ensureQuiz,queueEventQuizzes,quizById,submitQuiz} from '../components/rpg_game/quiz.js';
const basedir=path.join(path.dirname(fileURLToPath(import.meta.url)),'../components/rpg_game/data');
const read=p=>JSON.parse(fs.readFileSync(path.join(basedir,p),'utf8'));
const maps=new Map();function map(id){if(!maps.has(id))maps.set(id,read(`maps/${id}.json`));return maps.get(id);}
const graph=read('connections.json'),catalog=read('catalog.json'),story=read('story_v4.json'),bank=read('quiz_v5.json');

test('stable one-goal-at-a-time action and chapter progression',()=>{
  const s=freshState();ensureLife(s);const life=ensureStory(s);const a=mainObjective(s,currentEvent(s,story),ensureQuiz(life),catalog);
  assert.equal(a.kind,'story');assert.equal(a.id,'story:c1-diary');assert.equal(a.map,'school');assert.equal(a.progress,'0/32');
  assert.match(a.title,/이야기하기/);
  for(let chapter=0;chapter<8;chapter++)for(let j=0;j<story.chapters[chapter].events.length;j++){
    const e=currentEvent(s,story),before=mainObjective(s,e,life.quiz,catalog);assert.ok(before.id.endsWith(e.id));
    const r=performStoryChoice(s,story,j%3);assert.equal(r.ok,true);
    queueEventQuizzes(life,r.entry.id,bank);
    const q=ensureQuiz(life);
    while(q.pending){const item=quizById(bank,q.pending);assert.ok(item);const answer=item.correct;
      const result=submitQuiz(life,item.id,answer,bank);assert.equal(result.correct,true);}
    const next=mainObjective(s,currentEvent(s,story),q,catalog);
    assert.notEqual(before.id,next.id);
  }
  assert.equal(mainObjective(s,null,ensureQuiz(life),catalog).kind,'ending');
  assert.equal(isState(s),true);
});

test('every main-story map connects through a real walkable first portal',()=>{
 const destinations=[...new Set(story.chapters.flatMap(ch=>ch.events.map(e=>e.map)))];
 let routes=0;
 for(const from of destinations)for(const to of destinations){
  if(from===to)continue;
  const m=map(from),hop=nextMapHop(graph,from,to),p=portalTarget(m,hop);
  assert.ok(p,`no portal from ${from} to ${to}`);
  const path=approachPath(m,m.spawn,[p.x,p.y]);
  assert.ok(Array.isArray(path),`portal is unreachable: ${from} -> ${to}`);
  for(const [x,y]of path)assert.equal(!!m.solid[Math.floor(y)*m.width+Math.floor(x)],false);
  routes++;
 }
 assert.equal(routes,132);
});

test('bounded BFS avoids collision tiles and respects unreachable targets',()=>{
 const m={width:9,height:9,solid:Array(81).fill(0)};
 for(let x=0;x<9;x++)m.solid[4*9+x]=1;
 const path=approachPath(m,[2,2],[6,6]);assert.equal(path,null);
 assert.equal(approachPath(m,[2,2],[2,3]).length,0);
 const reachable=approachPath(m,[2,2],[6,2]);assert.ok(reachable.length>0);
 assert.equal(approachPath({...m,solid:[]},[2,2],[6,2]),null);
 assert.equal(approachPath(m,[2,2],[22,12]),null);
});

test('map switch waypoints are from actual map portals, not fake coordinates',()=>{
 const m=map('school'),hop=nextMapHop(graph,'school','care'),portal=portalTarget(m,hop);
 assert.equal(portal.target,hop.target);
 assert.ok(m.portals.some(p=>p===portal));
 assert.equal(portalTarget(m,{target:'missing-room'}),null);
});

test('help is paused by UI externally and appears only at 30/60/90 s',()=>{
 for(const [sec,level] of [[0,0],[29,0],[30,1],[59,1],[60,2],[89,2],[90,3],[120,3]])assert.equal(helpLevel(sec),level);
 assert.notEqual(waypointKey('school',64.1,52.1,'c1',[62,51]),waypointKey('school',65.1,52.1,'c1',[62,51]));
});

test('focus setting and guide UI do not affect legacy validation or story keys',()=>{
 const state=freshState();ensureLife(state);const life=ensureStory(state);
 state.life.settings={storyFocus:false,language:'ru'};
 assert.equal(isState(state),true);
 assert.equal(mainObjective(state,currentEvent(state,story),ensureQuiz(life),catalog).kind,'story');
});

test('game includes guide controls, focus setting, localized navigation and star overlay',()=>{
 const root=path.join(basedir,'..');const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
 const js=fs.readFileSync(path.join(root,'game.js'),'utf8');const i18n=fs.readFileSync(path.join(root,'i18n.js'),'utf8');
 for(const id of ['missionCaption','missionProgress','missionToggle','missionMapBtn','missionJumpBtn'])assert.ok(html.includes(`id="${id}"`));
 for(const fn of ['drawQuestStar','approachPath','toggleMission','updateQuestHelp','focusSetting','portalTarget'])assert.ok(js.includes(fn));
 for(const msg of ['현재 목표','목표 근처로 이동','플레이 모드 · ','노란 ★ 별표가 다음 이야기의 목표예요.'])assert.ok(i18n.includes(msg));
});
