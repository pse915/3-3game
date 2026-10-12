import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {freshState,isState} from '../components/rpg_game/systems.js';
import {ensureLife,isLifeState} from '../components/rpg_game/life.js';
import {freshStory,performStoryChoice,currentEvent,worldTier} from '../components/rpg_game/story.js';
import {ensureQuiz,queueEventQuizzes,submitQuiz,applyVillageProject} from '../components/rpg_game/quiz.js';
import {prepareI18n,setLanguage,translate,getLanguage} from '../components/rpg_game/i18n.js';
import {imageState,renderEndingImage,combineSnapshots} from '../components/rpg_game/ending_visual.js';
const base=new URL('../components/rpg_game/',import.meta.url);
const load=(p)=>JSON.parse(fs.readFileSync(new URL(p,base),'utf8'));
const story=load('data/story_v4.json'),quiz=load('data/quiz_v5.json'),catalog=load('data/catalog.json'),quests=load('data/quests.json'),activities=load('data/activities.json');
const ruStory=load('ru_story.json'),ruQuiz=load('ru_quiz.json'),ruExplore=load('ru_explore.json'),ruVariants=load('ru_variants.json'),ruContext=load('ru_context.json'),ruInterface=load('ru_interface.json'),ruMaps=load('ru_maps.json');
const fakeNodes={};
globalThis.document={body:{classList:{toggle(){}}},documentElement:{lang:'ko'},createTreeWalker(){return {nextNode(){return false}}}};
globalThis.localStorage={setItem(k,v){fakeNodes[k]=v},getItem(k){return fakeNodes[k]||null}};
prepareI18n(story,ruStory,quiz,ruQuiz,catalog,quests,activities,ruExplore,ruVariants,ruContext,ruInterface,ruMaps);setLanguage('ru');
const noKorean=(x)=>!/[가-힣]/.test(x);
test('all 32 main scenes, 96 main choices and 11 contextual variations have Russian translations',()=>{
 let scenes=0,choices=0,variants=0;
 for(const ch of story.chapters){assert.ok(noKorean(translate(ch.title)));
  for(const e of ch.events){assert.ok(noKorean(translate(e.title)),e.id);assert.ok(noKorean(translate(e.story)),e.id);scenes++;
   for(const c of e.choices){assert.ok(noKorean(translate(c.label)),e.id);assert.ok(noKorean(translate(c.result)),e.id);choices++;}
   for(const v of e.variants||[]){variants++;assert.ok(noKorean(translate(v.story)),e.id);assert.ok(noKorean(translate(v.npc)),e.id);for(const c of v.choices){assert.ok(noKorean(translate(c.label)),e.id);assert.ok(noKorean(translate(c.result)),e.id);}}
  }
 }
 assert.equal(scenes,32);assert.equal(choices,96);assert.equal(variants,11);
});
test('all 15 quiz questions, hints, choices, projects and 11 policy goals are Russian',()=>{
 for(const q of quiz.questions){for(const key of ['topic','question','explanation','hint','hintMore'])assert.ok(noKorean(translate(q[key])),`${q.id}.${key}`);for(const v of q.options)assert.ok(noKorean(translate(v)),q.id);for(const key of ['title','label','before','after'])assert.ok(noKorean(translate(q.project[key])),`${q.id}.${key}`);}
 for(const list of Object.values(quiz.policyTopics))for(const name of list)assert.ok(noKorean(translate(name)));
 assert.equal(quiz.questions.length,15);
});
test('original legacy exploratory quests and freely chosen activity labels are Russian',()=>{
 for(const q of quests){assert.ok(noKorean(translate(q.title)));assert.ok(noKorean(translate(q.story)));for(const c of q.choices){assert.ok(noKorean(translate(c[0])));assert.ok(noKorean(translate(c[1])));}}
 for(const a of activities.activities){assert.ok(noKorean(translate(a.title)),a.id);if(!a.id.startsWith('job-'))for(const c of a.choices){assert.ok(noKorean(translate(c.label)),a.id);assert.ok(noKorean(translate(c.consequence)),a.id);}}
 for(const e of activities.events){assert.ok(noKorean(translate(e.title)));assert.ok(noKorean(translate(e.story)));}
});
test('every map, NPC and school interaction has a Russian name or description',()=>{
 for(const c of catalog)assert.ok(noKorean(translate(c.name)),c.id+': '+c.name);
 const fsMap=new URL('../components/rpg_game/data/maps/',import.meta.url);
 for(const mapFile of fs.readdirSync(fsMap)){
  const m=JSON.parse(fs.readFileSync(new URL(mapFile,fsMap),'utf8'));
  for(const x of m.npcs||[]){assert.ok(noKorean(translate(x.name)),mapFile+': '+x.name);assert.ok(noKorean(translate(x.text)),mapFile+': '+x.text);}
  for(const x of m.interactions||[]){if(x.label)assert.ok(noKorean(translate(x.label)),mapFile+': '+x.label);if(x.text)assert.ok(noKorean(translate(x.text)),mapFile+': '+x.text);}
 }
});
test('locale switching never changes game state or answer scoring',()=>{
 const state=freshState();ensureLife(state);state.life.story=freshStory();const ref=state.life.story;
 const current=currentEvent(state,story);performStoryChoice(state,story,0);queueEventQuizzes(ref,current.id,quiz);
 const before=JSON.stringify(state);setLanguage('ko');assert.equal(translate('미래 다이어리'),'미래 다이어리');setLanguage('ru');assert.equal(translate('미래 다이어리'),'Дневник будущего');assert.equal(getLanguage(),'ru');assert.equal(JSON.stringify(state),before);
 const q=ensureQuiz(ref);assert.ok(q.pending);const item=quiz.questions.find(x=>x.id===q.pending);assert.equal(submitQuiz(ref,item.id,item.correct,quiz).correct,true);applyVillageProject(ref,item.id,quiz);
 const snap=imageState(ref,quiz);assert.deepEqual(snap.projects,[item.id]);assert.equal(snap.world.communityTrust,ref.world.communityTrust);
 assert.ok(isState(state));assert.ok(isLifeState(state.life));
});
test('saved world snapshots are stable and differ after projects or demographic decline',()=>{
 const s=freshStory();const origin=imageState(s,quiz);const project={...s,quiz:{projects:['q07','q13']}};
 const later=imageState(project,quiz);assert.notDeepEqual(later.projects,origin.projects);
 s.world.localEconomy=10;s.world.populationVitality=8;s.world.communityTrust=6;s.world.socialSafetyNet=10;
 const decay=imageState(s,quiz);assert.equal(decay.tier,3);assert.notEqual(decay.tier,origin.tier);
});
function mockCanvas(){const log=[];const context={canvas:null,fillRect(...x){log.push(['fillRect',...x])},drawImage(...x){log.push(['drawImage',...x.slice(-4)])},beginPath(){},arc(){},fill(){},moveTo(){},lineTo(){},stroke(){},fillText(){},measureText(s){return {width:s.length*9}},ellipse(){},save(){},restore(){},translate(){},rotate(){},strokeRect(){},clearRect(){}};
 const c={width:0,height:0,className:'',setAttribute(){},getContext(){context.canvas=c;return context},log};return c;}
test('both ages and both locations render original tiles/assets and visibly distinct changes',()=>{
 globalThis.document.createElement=kind=>{assert.equal(kind,'canvas');return mockCanvas()};
 const maps={town:load('data/maps/town.json'),school:load('data/maps/school.json')};
 const images={};for(const key of ['terrain','school','environment','facilities','furniture','buildings','details','avatars'])images[key]={width:1024,height:1024};
 const s=freshStory();s.quiz={projects:['q07','q13'],completed:[],pending:null,queue:[],attempts:{},hints:{},version:5};
 const snap=imageState(s,quiz),all=[];
 for(const location of ['town','school'])for(const future of [false,true]){const c=renderEndingImage(location,maps[location],images,snap,{future,quizBank:quiz});assert.equal(c.width,960);assert.equal(c.height,540);assert.ok(c.log.filter(x=>x[0]==='drawImage').length>100);all.push(c);}
 assert.notDeepEqual(all[0].log,all[1].log);assert.notDeepEqual(all[2].log,all[3].log);
 const combined=combineSnapshots(all);assert.equal(combined.width,1920);assert.equal(combined.height,1080);assert.equal(combined.log.filter(x=>x[0]==='drawImage').length,4);
});

test('live UI text nodes switch Russian–Korean–Russian without losing the Korean source',()=>{
 const originalBody=document.body,originalWalker=document.createTreeWalker;
 const textNode={nodeType:3,data:'게임 시작'};
 globalThis.NodeFilter={SHOW_TEXT:4};document.body={nodeType:1,classList:{toggle(){}}};
 document.createTreeWalker=()=>{let i=0;return {nextNode(){if(i++)return false;this.currentNode=textNode;return true}}};
 try{
  setLanguage('ru');assert.equal(textNode.data,'Начать игру');
  setLanguage('ko');assert.equal(textNode.data,'게임 시작');
  setLanguage('ru');assert.equal(textNode.data,'Начать игру');
  textNode.data='다시 도전하기';setLanguage('ru');assert.equal(textNode.data,'Попробовать ещё раз');
  setLanguage('ko');assert.equal(textNode.data,'다시 도전하기');
 }finally{document.body=originalBody;document.createTreeWalker=originalWalker;setLanguage('ko');}
});

test('200 life stories keep valid snapshots and save state under alternating languages',()=>{
 setLanguage('ru');
 for(let seed=0;seed<200;seed++){
  const state=freshState();ensureLife(state);state.life.story=freshStory();
  for(let step=0;step<32;step++){
   const event=currentEvent(state,story);assert.ok(event);
   if(step%7===0)setLanguage(step%2===0?'ko':'ru');
   const r=performStoryChoice(state,story,(seed+step*3+(seed*step)%7)%3);
   assert.equal(r.ok,true);
   queueEventQuizzes(state.life.story,event.id,quiz);
   const q=ensureQuiz(state.life.story);
   while(q.pending){const item=quiz.questions.find(x=>x.id===q.pending);assert.ok(item);
    const ans=submitQuiz(state.life.story,item.id,item.correct,quiz);assert.ok(ans.correct);
    if((seed+step)%3===0)applyVillageProject(state.life.story,item.id,quiz);
   }
  }
  assert.ok(state.life.story.complete);
  state.life.story.endingVisualization=imageState(state.life.story,quiz,{community:seed%2===0});
  assert.ok(isState(state),`seed ${seed}`);assert.ok(isLifeState(state.life));
  const saved=JSON.parse(JSON.stringify(state));assert.deepEqual(saved.life.story.endingVisualization,state.life.story.endingVisualization);
 }
 setLanguage('ko');
});
