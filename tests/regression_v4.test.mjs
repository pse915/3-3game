import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {freshState,isState} from '../components/rpg_game/systems.js';
import {ensureLife,isLifeState} from '../components/rpg_game/life.js';
import {freshStory,performStoryChoice,currentEvent,isStory,applyRegionalScenario,worldTier} from '../components/rpg_game/story.js';
const dataDir=new URL('../components/rpg_game/data/',import.meta.url);
const data=JSON.parse(fs.readFileSync(new URL('story_v4.json',dataDir),'utf8'));
const mapsDir=new URL('maps/',dataDir);
const make=()=>{const s=freshState();ensureLife(s);s.life.story=freshStory();return s;};
const getMap=id=>JSON.parse(fs.readFileSync(new URL(id+'.json',mapsDir),'utf8'));
function reachable(m,point){
 const w=m.width,h=m.height,solid=m.solid;const pass=(x,y)=>x>=1&&y>=1&&x<w-1&&y<h-1&&!solid[y*w+x];
 const start=m.spawn;if(!pass(...start)||!pass(...point))return false;
 const q=[start];const seen=new Set([start.join(',')]);
 for(let i=0;i<q.length;i++){
  const [x,y]=q[i];if(x===point[0]&&y===point[1])return true;
  for(const p of [[x+1,y],[x-1,y],[x,y+1],[x,y-1]]){
   if(!pass(...p)||seen.has(p.join(',')))continue;seen.add(p.join(','));q.push(p);
  }
 }
 return false;
}
test('all 32 scenes point to real maps with reachable story markers',()=>{
 const ids=new Set();
 for(const chapter of data.chapters)for(const event of chapter.events){
  assert.ok(!ids.has(event.id));ids.add(event.id);
  const map=getMap(event.map);const [x,y]=map.spawn;
  const candidates=[[x+2,y],[x+3,y],[x,y-2],[x-2,y],[x,y+2],[x+1,y+1],[x-1,y-1]];
  const candidate=candidates.find(p=>p[0]>0&&p[1]>0&&p[0]<map.width-1&&p[1]<map.height-1&&!map.solid[p[1]*map.width+p[0]])||[x,y];
  assert.ok(reachable(map,candidate),`${event.id} marker cannot be reached from ${event.map}`);
  assert.ok(event.choices.every(x=>typeof x.label==='string'&&x.label.length>1));
 }
 assert.equal(ids.size,32);
});
test('a legacy v3 state without story data upgrades without losing v3 progress',()=>{
 const s=make();delete s.life.story;s.intro=true;s.teacherMet=true;s.completed=['life'];s.choices.life=1;
 s.diary=[{id:'life',title:'오늘',choice:'협력',consequence:'함께',concept:'생애설계'}];
 assert.ok(isState(s));const clone=JSON.parse(JSON.stringify(s));
 assert.deepEqual(clone.completed,['life']);assert.equal(clone.life.story,undefined);
 assert.ok(currentEvent(clone,data));assert.ok(isStory(clone.life.story));
 assert.deepEqual(clone.completed,s.completed);assert.deepEqual(clone.choices,s.choices);
});
test('each choice is applied once; choices progress and all meters stay bounded',()=>{
 const s=make(),seen=new Set();
 for(let n=0;n<32;n++){
  const event=currentEvent(s,data);assert.ok(!seen.has(event.id));seen.add(event.id);
  const r=performStoryChoice(s,data,n%event.choices.length);assert.ok(r.ok);
  assert.ok(s.life.story.records.length===n+1);
  for(const section of ['self','world','relationships'])assert.ok(Object.values(s.life.story[section]).every(v=>Number.isInteger(v)&&v>=0&&v<=100));
 }
 const before=JSON.stringify(s.life.story);const repeat=performStoryChoice(s,data,0);
 assert.equal(repeat.ok,false);assert.equal(JSON.stringify(s.life.story),before);
});
test('social deterioration and later re-investment visibly change town tier in saved state',()=>{
 const s=make();for(let i=0;i<16;i++)performStoryChoice(s,data,2);
 applyRegionalScenario(s,'migration');for(let i=0;i<4;i++)performStoryChoice(s,data,2);
 applyRegionalScenario(s,'downturn');for(let i=0;i<4;i++)performStoryChoice(s,data,2);
 applyRegionalScenario(s,'downturn');const bad=worldTier(s.life.story);
 assert.ok(bad.tier>=2);
 assert.ok(s.life.story.worldHistory.length===6);
 for(let i=0;i<8;i++)performStoryChoice(s,data,0);
 assert.ok(isState(s));assert.ok(s.life.story.complete);
 assert.ok(s.life.story.worldHistory.some(x=>x.tier>=1));
});
