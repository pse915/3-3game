import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {freshState,isState} from '../components/rpg_game/systems.js';
import {ensureLife,isLifeState} from '../components/rpg_game/life.js';
import {freshStory,currentEvent,performStoryChoice,applyRegionalScenario} from '../components/rpg_game/story.js';
import {SELF_NAMES,WORLD_NAMES,RELATIONSHIP_NAMES,CAREER_NAMES,koreanLabel,formatChange,localizeSavedEffect,changeSentiment} from '../components/rpg_game/locale.js';
const files=new URL('../components/rpg_game/data/',import.meta.url);
const story=JSON.parse(fs.readFileSync(new URL('story_v4.json',files),'utf8'));
const state=()=>{const s=freshState();ensureLife(s);s.life.story=freshStory();return s;};
test('reported English output is translated and Korean historical logs are supported',()=>{
 assert.equal(formatChange('self','learning',7),'나의 배움 +7');
 assert.equal(formatChange('self','satisfaction',3),'나의 삶의 만족도 +3');
 assert.equal(formatChange('world','localEconomy',-5),'마을의 지역 경제 -5');
 assert.equal(formatChange('relationships','friend',4),'관계 · 친구 관계 +4');
 assert.equal(localizeSavedEffect('나의 learning +7 · 나의 satisfaction +3'),'나의 배움 +7 · 나의 삶의 만족도 +3');
 assert.equal(localizeSavedEffect('마을 localEconomy -12 · 관계 partner +4'),'마을의 지역 경제 -12 · 관계 · 동반자 관계 +4');
 assert.equal(localizeSavedEffect('나의 배움 +7'),'나의 배움 +7');
 assert.equal(localizeSavedEffect(null),'');
 assert.equal(changeSentiment('stress',7),'negative');
 assert.equal(changeSentiment('stress',-3),'positive');
 assert.equal(changeSentiment('learning',4),'positive');
});
test('all supported story effects and NPC relationship changes have Korean labels',()=>{
 const dictionary={self:SELF_NAMES,world:WORLD_NAMES,relationships:RELATIONSHIP_NAMES};
 let checked=0;
 for(const chapter of story.chapters)for(const event of chapter.events){
  for(const eventType of [event,...(event.variants||[])])for(const choice of eventType.choices){
   for(const [scope,names] of Object.entries(dictionary))for(const key of Object.keys(choice[scope]||{})){
    assert.ok(Object.hasOwn(names,key),`missing ${scope}.${key} in ${event.id}`);
    assert.ok(!/[a-zA-Z]/.test(koreanLabel(key,scope)));
    checked++;
   }
  }
 }
 assert.ok(checked>300);
 for(const key of ['barista','designer','developer','nurse','teacher','social-worker','entrepreneur','researcher'])assert.ok(CAREER_NAMES[key]);
});
test('200 different complete lifetimes never show raw English status keys; save remains valid',()=>{
 const outcomes=new Set();let tested=0;
 for(let seed=0;seed<200;seed++){
  const s=state();
  for(let n=0;n<32;n++){
   const event=currentEvent(s,story);
   assert.ok(event);
   const chosen=((Math.imul(seed+23,n+283)^(seed*2351+n*97))>>>0)%event.choices.length;
   const r=performStoryChoice(s,story,chosen);
   assert.ok(r.ok);
   assert.ok(isState(s) && isLifeState(s.life));
   for(const effect of r.entry.effects){
    assert.ok(!/(나의|마을|관계)\s+[A-Za-z]/.test(effect),`raw key: ${effect}`);
    assert.ok(!/undefined|null|NaN/.test(effect));
    tested++;
   }
  }
  assert.equal(s.life.story.records.at(-1).age,65);
  assert.ok(s.life.story.complete);
  assert.ok(!currentEvent(s,story));
  outcomes.add(s.life.story.records.map(r=>r.choice).join('|'));
 }
 assert.ok(tested>3000,`effects:${tested}`);
 assert.ok(outcomes.size>30);
});
test('regional scenarios use translated change labels and cannot be repeated',()=>{
 const s=state();for(let n=0;n<16;n++)performStoryChoice(s,story,n%3);
 const result=applyRegionalScenario(s,'migration');assert.ok(result.ok);
 assert.ok(result.effects.every(e=>/마을의 [^a-zA-Z]+ [+-]?\d+$/.test(e)));
 assert.equal(applyRegionalScenario(s,'migration').ok,false);
 assert.ok(isState(s));
});
test('visible page chrome uses Korean headings instead of English development labels',()=>{
 const html=fs.readFileSync(new URL('../components/rpg_game/index.html',import.meta.url),'utf8');
 const code=fs.readFileSync(new URL('../components/rpg_game/game.js',import.meta.url),'utf8');
 assert.ok(!html.includes('FUTURE DIARY'));
 assert.ok(!code.includes('`CHAPTER '));
 assert.ok(!code.includes('`CH '));
 assert.ok(code.includes('localizeSavedEffect'));
});
