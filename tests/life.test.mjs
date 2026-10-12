import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {freshState,isState} from '../components/rpg_game/systems.js';
import {ensureLife,isLifeState,availableActivities,activityStatus,performActivity,pendingEvent,resolveEvent,nextDay,lifeEnding,lifeSummary} from '../components/rpg_game/life.js';
const data=JSON.parse(readFileSync(new URL('../components/rpg_game/data/activities.json',import.meta.url),'utf8'));
const a=id=>data.activities.find(a=>a.id===id);
test('legacy v2 state extends without rewriting completed diary or authentication',()=>{
 const s=freshState(),before=JSON.stringify(s),l=ensureLife(s);
 assert.equal(l.time,480);assert.equal(isState(s),true);assert.equal(isLifeState(l),true);
 const copy=JSON.parse(JSON.stringify(s));delete copy.life;assert.equal(JSON.stringify(copy),before);
});
test('free activities have no story-order gate, while genuine follow-ups require an earlier action',()=>{
 const s=freshState();assert.ok(availableActivities(s,data,'library').some(x=>x.id==='learning'));
 assert.equal(activityStatus(s,a('portfolio')).ok,false);
 assert.equal(performActivity(s,a('learning'),0,{reason:'새 분야를 알고 싶어서',plan:'직접 체험하기'}).ok,true);
 assert.equal(activityStatus(s,a('portfolio')).ok,true);
 assert.equal(s.completed.length,0);assert.equal(s.life.history[0].reason,'새 분야를 알고 싶어서');
});
test('unaffordable, exhausted and invalid choices are atomic; affordable rest is always offered',()=>{
 const s=freshState(),l=ensureLife(s);l.money=0;const before=JSON.stringify(l);
 assert.equal(performActivity(s,a('housing'),1).ok,false);assert.equal(JSON.stringify(l),before);
 assert.equal(performActivity(s,a('walking'),99).ok,false);assert.equal(JSON.stringify(l),before);
 l.fatigue=95;assert.equal(performActivity(s,a('walking'),0).ok,false);
 assert.equal(performActivity(s,a('rest'),0).ok,true);assert.equal(l.fatigue,71);
 l.time=0;const exhausted=JSON.stringify(l);assert.equal(performActivity(s,a('budget'),2).ok,false);assert.equal(JSON.stringify(l),exhausted);
});
test('events are once per activity checkpoint, persist while pending, and block advancing without resolving',()=>{
 const s=freshState();for(const id of ['walking','budget','learning'])assert.equal(performActivity(s,a(id),0).ok,true);
 const e=pendingEvent(s,data);assert.ok(e);assert.equal(pendingEvent(s,data).id,e.id);
 assert.equal(nextDay(s).ok,false);assert.equal(performActivity(s,a('rest'),0).ok,false);
 assert.equal(resolveEvent(s,e,1,{reason:'가능한 자원을 먼저 확인'}).ok,true);
 assert.equal(resolveEvent(s,e,1).ok,false);assert.equal(pendingEvent(s,data),null);
 assert.equal(s.life.events.length,1);assert.equal(s.life.events[0].reason,'가능한 자원을 먼저 확인');
});
test('daily repetition limit and new day recovery make resources meaningful',()=>{
 const s=freshState();performActivity(s,a('walking'),0);performActivity(s,a('walking'),0);
 assert.equal(performActivity(s,a('walking'),0).ok,false);
 const money=s.life.money;s.life.fatigue=80;assert.equal(nextDay(s).ok,true);
 assert.equal(s.life.day,2);assert.equal(s.life.time,480);assert.equal(s.life.fatigue,45);assert.equal(s.life.money,money-10);
 assert.equal(performActivity(s,a('walking'),0).ok,true);
});
test('career mini-games are distinguishable and success grants bounded learning feedback',()=>{
 const careers=data.activities.filter(x=>x.career);assert.equal(careers.length,8);assert.equal(new Set(careers.map(x=>x.minigame.type)).size,8);
 for(const c of careers){assert.equal(c.minigame.steps.length,3);for(const step of c.minigame.steps)assert.ok(step.options[step.correct]);}
 const s1=freshState(),s2=freshState();performActivity(s1,careers[0],0,{score:0});performActivity(s2,careers[0],0,{score:99});
 assert.equal(s2.life.growth-s1.life.growth,6);assert.equal(s2.life.history[0].score,3);
});
test('all eight future portraits are reachable from distinct conditions and do not rank lives',()=>{
 const scenarios=[['explorer',{}],['balanced',{stability:70,preparation:70,health:70,relations:60}],['resilient',{events:Array(4).fill({}),preparation:60}],['community',{relations:75}],['learner',{growth:75}],['steady',{stability:75}],['creative',{satisfaction:75}],['replan',{fatigue:80}]];
 for(const [id,overrides]of scenarios){const s=freshState();Object.assign(ensureLife(s),overrides);assert.equal(lifeEnding(s,data).id,id);}
 assert.equal(data.events.length,8);assert.equal(data.endings.length,8);assert.ok(data.activities.length>=15);
});
test('restored saves reject broken resources; summary keeps choices, reasons and future plans',()=>{
 const s=freshState();performActivity(s,a('future-prep'),0,{reason:'건강과 관계도 함께 준비',plan:'친구와 주 1회 산책'});
 assert.match(lifeSummary(s,data),/친구와 주 1회 산책/);assert.match(lifeSummary(s,data),/건강과 관계도 함께 준비/);
 const l=JSON.parse(JSON.stringify(s.life));l.time=999;assert.equal(isLifeState(l),false);l.time=100;l.money=-1;assert.equal(isLifeState(l),false);
});
