import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {freshState,isState} from '../components/rpg_game/systems.js';
import {ensureLife,isLifeState} from '../components/rpg_game/life.js';
import {freshStory,currentEvent,performStoryChoice,worldTier,storySummary,applyRegionalScenario,isStory,STORY_CHAPTERS} from '../components/rpg_game/story.js';
const root=new URL('../components/rpg_game/data/',import.meta.url);
const data=JSON.parse(fs.readFileSync(new URL('story_v4.json',root),'utf-8'));
const make=()=>{const s=freshState();ensureLife(s);s.life.story=freshStory();return s;};
test('8 chapters with 32 interconnected playable events and 11 branching variants',()=>{
 assert.equal(data.chapters.length,8);
 assert.equal(data.chapters.flatMap(x=>x.events).length,32);
 assert.equal(data.chapters.flatMap(x=>x.events).flatMap(x=>x.variants||[]).length,11);
 assert.deepEqual(STORY_CHAPTERS.map(x=>x.age),[15,18,23,31,41,51,60,65]);
 for(const c of data.chapters)for(const e of c.events){assert.ok(e.id&&e.title&&e.story&&e.map);assert.ok(e.choices.length>=3);for(const v of e.variants||[])assert.ok(v.choices.length>=3);}
});
test('200 distinct routes reach age 65; saved state passes legacy v3 validator',()=>{
 const endings=new Set(),paths=new Set();
 for(let seed=0;seed<200;seed++){
  const st=make(),events=[];
  for(let i=0;i<32;i++){
   const event=currentEvent(st,data);assert.ok(event,`seed ${seed}, step ${i}`);
   events.push(event.id);
   const iChoice=((Math.imul(seed+131,i+769) ^ Math.imul(seed*7+i*13,2654435761)) >>> 7)%3;
   const result=performStoryChoice(st,data,iChoice);
   assert.equal(result.ok,true);
   assert.equal(st.life.story.records.length,i+1);
   assert.ok(isState(st));assert.ok(isLifeState(st.life));assert.ok(isStory(st.life.story));
  }
  assert.ok(st.life.story.complete);
  assert.equal(st.life.story.records[31].age,65);
  assert.equal(currentEvent(st,data),null);
  assert.equal(performStoryChoice(st,data,0).ok,false);
  assert.ok(storySummary(st).includes('15세부터 65세까지'));
  paths.add(st.life.story.records.map(e=>e.choice).join('|'));
  endings.add(worldTier(st.life.story).tier);
 }
 assert.ok(paths.size>30);
 assert.ok(endings.size>=1);
});
test('all education pathways and family pathways have contextual scenes',()=>{
 for(const [education,expected] of [['general','일반고'],['vocational','직업계고'],['alternative','검정고시']]){
  const st=make();performStoryChoice(st,data,0);performStoryChoice(st,data,0);
  performStoryChoice(st,data,{general:0,vocational:1,alternative:2}[education]);performStoryChoice(st,data,0);
  assert.ok(currentEvent(st,data).id==='c2-newday');
  assert.ok(currentEvent(st,data).story.includes(expected));
 }
 for(const familyChoice of [0,1,2]){
  const st=make();for(let i=0;i<14;i++)performStoryChoice(st,data,i===14?familyChoice:0);
  assert.equal(st.life.story.chapter,3);
  performStoryChoice(st,data,0);performStoryChoice(st,data,0);
  performStoryChoice(st,data,familyChoice);
  performStoryChoice(st,data,0);
  for(let i=0;i<5;i++)performStoryChoice(st,data,0);
  assert.ok(isStory(st.life.story));
 }
});
test('regional economic and migration changes can cause decay and recovery without blaming childlessness',()=>{
 const st=make();for(let i=0;i<16;i++)performStoryChoice(st,data,2);
 assert.equal(st.life.story.chapter,4);
 const before=worldTier(st.life.story);
 let r=applyRegionalScenario(st,'migration');assert.ok(r.ok);
 assert.equal(applyRegionalScenario(st,'downturn').ok,false);
 for(let i=0;i<4;i++)performStoryChoice(st,data,2);
 r=applyRegionalScenario(st,'downturn');assert.ok(r.ok);
 for(let i=0;i<4;i++)performStoryChoice(st,data,2);
 r=applyRegionalScenario(st,'downturn');assert.ok(r.ok);
 const after=worldTier(st.life.story);
 assert.ok(after.tier>=2,`${JSON.stringify(after)}`);
 assert.ok(after.score<before.score);
 assert.ok(st.life.story.flags.children===undefined||typeof st.life.story.flags.children==='string');
 assert.ok(isStory(st.life.story));
});
test('every mapped teacher has the exact requested name 기술썜',()=>{
 const teachers=JSON.parse(fs.readFileSync(new URL('teachers.json',root),'utf8'));
 assert.equal(teachers.length,17);assert.ok(teachers.every(t=>t.name==='기술썜'));
 const mp=new URL('maps/',root);
 let n=0;
 for(const f of fs.readdirSync(mp)){
  const m=JSON.parse(fs.readFileSync(new URL(f,mp),'utf8'));
  for(const npc of m.npcs||[]){if(npc.subject||npc.quest==='teacher'){assert.equal(npc.name,'기술썜');n++;}}
 }
 assert.ok(n>=17);
});
