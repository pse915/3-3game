import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {freshState,isState} from '../components/rpg_game/systems.js';
import {ensureLife,isLifeState} from '../components/rpg_game/life.js';
import {freshStory,performStoryChoice,currentEvent,worldTier,isStory} from '../components/rpg_game/story.js';
import {freshQuiz,ensureQuiz,isQuiz,quizById,queueEventQuizzes,submitQuiz,applyVillageProject,openBonusQuiz,requiredQuizCount,completedRequired,learnedQuizNotes} from '../components/rpg_game/quiz.js';
const quiz=JSON.parse(fs.readFileSync(new URL('../components/rpg_game/data/quiz_v5.json',import.meta.url),'utf8'));
const data=JSON.parse(fs.readFileSync(new URL('../components/rpg_game/data/story_v4.json',import.meta.url),'utf8'));
function make(){const state=freshState();ensureLife(state);state.life.story=freshStory();return state;}
test('15 unique accurate-keyed quizzes cover eight chapters, five senior strategies and six low-birth tasks',()=>{
 assert.equal(quiz.version,5);assert.equal(quiz.questions.length,15);
 assert.equal(new Set(quiz.questions.map(q=>q.id)).size,15);
 assert.equal(requiredQuizCount(quiz),12);assert.equal(quiz.policyTopics['고령사회 준비'].length,5);
 assert.equal(quiz.policyTopics['저출산 대응'].length,6);
 for(const q of quiz.questions){assert.equal(q.options.length,4);assert.ok(q.correct>=0&&q.correct<4);assert.ok(q.explanation&&q.hint&&q.project?.after&&q.diary);assert.ok(q.chapter>=1&&q.chapter<=8);if(q.required)assert.ok(data.chapters[q.chapter-1].events.some(e=>e.id===q.afterEvent));}
 for(let chapter=1;chapter<=8;chapter++)assert.ok(quiz.questions.some(q=>q.chapter===chapter&&q.required));
 for(const needle of ['세대 간 소통','노후 생활 지원','고령 친화 산업','문화·여가','교통·생활 안전'])assert.ok(quiz.policyTopics['고령사회 준비'].some(x=>x.includes(needle)));
});
test('quiz wrong answers retry without penalties, correct answers unlock but never apply a policy automatically',()=>{
 const st=make(),s=st.life.story,q=ensureQuiz(s),snapshot=structuredClone(s.world),self=structuredClone(s.self);
 assert.equal(queueEventQuizzes(s,'c1-diary',quiz),1);assert.equal(q.pending,'q01');
 const item=quizById(quiz,'q01'),wrong=(item.correct+1)%4;
 for(let i=1;i<=4;i++){
  const r=submitQuiz(s,item.id,wrong,quiz);assert.ok(r.ok&&!r.correct);assert.equal(r.attempts,i);assert.equal(q.pending,item.id);
  assert.deepEqual(s.world,snapshot);assert.deepEqual(s.self,self);
 }
 assert.equal(q.hints.q01,4);
 const result=submitQuiz(s,item.id,item.correct,quiz);assert.ok(result.correct);
 assert.equal(q.pending,null);assert.ok(q.completed.includes('q01'));
 assert.deepEqual(s.world,snapshot,'Knowledge does not automatically increase societal indicators');
 assert.equal(submitQuiz(s,item.id,item.correct,quiz).ok,false,'No duplicate reward');
 assert.equal(queueEventQuizzes(s,'c1-diary',quiz),0,'No completed question repeats');
 const applied=applyVillageProject(s,item.id,quiz);assert.ok(applied.ok);assert.notDeepEqual(s.world,snapshot);
 assert.equal(applyVillageProject(s,item.id,quiz).ok,false,'policy can only be applied once');
 assert.ok(isStory(s));assert.ok(isState(st));assert.ok(isLifeState(st.life));
});
test('a restored V4 story has no mandatory backlog and keeps its record/flags',()=>{
 const st=make();for(let i=0;i<21;i++)assert.ok(performStoryChoice(st,data,i%3).ok);
 const before=structuredClone(st.life.story);
 assert.ok(isStory(before));assert.ok(!('quiz' in before));
 const restored=JSON.parse(JSON.stringify(st));assert.ok(isState(restored));
 assert.equal(ensureQuiz(restored.life.story).pending,null);
 assert.deepEqual(restored.life.story.records,before.records);
 const result=performStoryChoice(restored,data,0);assert.ok(result.ok);
 queueEventQuizzes(restored.life.story,result.entry.id,quiz);
 assert.ok(isStory(restored.life.story));
});
test('optional quizzes unlock only in the older-age chapters and are never forced',()=>{
 const st=make(),s=st.life.story;
 assert.equal(openBonusQuiz(s,'q09',quiz).ok,false);
 for(let i=0;i<24;i++){assert.ok(performStoryChoice(st,data,i%3).ok);}
 assert.equal(s.chapter,6);
 for(const id of ['q09','q13','q14']){
  const open=openBonusQuiz(s,id,quiz);assert.ok(open.ok);
  const item=quizById(quiz,id),answer=submitQuiz(s,id,item.correct,quiz);
  assert.ok(answer.correct);assert.equal(s.quiz.pending,null);
 }
 assert.equal(s.quiz.completed.length,3);
 assert.equal(openBonusQuiz(s,'q09',quiz).ok,false);
 assert.ok(isStory(s));
});
test('200 randomized complete lifetimes, each with all 12 mandatory quizzes, survive legacy save validators',()=>{
 const answerPositions=new Set();
 for(let seed=0;seed<200;seed++){
  const st=make(),s=st.life.story;
  for(let i=0;i<32;i++){
   const ev=currentEvent(st,data);assert.ok(ev,`seed=${seed} scene=${i}`);
   const pick=(Math.imul(seed+3,i+17)>>>4)%3;
   const outcome=performStoryChoice(st,data,pick);assert.ok(outcome.ok);
   queueEventQuizzes(s,outcome.entry.id,quiz);
   while(ensureQuiz(s).pending){
    const q=quizById(quiz,s.quiz.pending);
    answerPositions.add(q.correct);
    if((i+seed)%3===0){const wrong=(q.correct+1)%4;const failed=submitQuiz(s,q.id,wrong,quiz);assert.equal(failed.correct,false);}
    const snap=structuredClone(s.world);
    const solved=submitQuiz(s,q.id,q.correct,quiz);assert.equal(solved.correct,true);
    assert.deepEqual(s.world,snap);
    if((i+seed)%2===0)assert.equal(applyVillageProject(s,q.id,quiz).ok,true);
   }
   assert.equal(isStory(s),true,`seed=${seed} scene=${i}`);
   assert.equal(isState(st),true,`seed=${seed} scene=${i}`);
   assert.equal(isLifeState(st.life),true,`seed=${seed} scene=${i}`);
  }
  assert.equal(s.complete,true);assert.equal(s.records.length,32);
  assert.equal(completedRequired(s,quiz),12);
  assert.equal(s.quiz.pending,null);assert.equal(s.quiz.completed.length,12);
  assert.equal(learnedQuizNotes(s,quiz).length,12);
  assert.ok(worldTier(s).score>=0);
  const roundTrip=JSON.parse(JSON.stringify(st));assert.ok(isState(roundTrip));assert.ok(isQuiz(roundTrip.life.story.quiz));
 }
 assert.deepEqual([...answerPositions].sort(),[0,1,2,3]);
});

test('community projects have reachable, separate interaction points and do not block portals',async()=>{
 const {villageProjectMarkers}=await import('../components/rpg_game/village.js');
 const town=JSON.parse(fs.readFileSync(new URL('../components/rpg_game/data/maps/town.json',import.meta.url),'utf8'));
 const ids=quiz.questions.map(q=>q.id),points=villageProjectMarkers(town,quiz,ids);
 assert.equal(points.length,15);
 const positions=new Set();
 for(const point of points){
  const key=point.x+','+point.y;assert.ok(!positions.has(key),`duplicate marker ${key}`);positions.add(key);
  assert.equal(town.solid[point.y*town.width+point.x],0,`blocked marker ${key}`);
  assert.ok(town.portals.every(p=>Math.hypot(p.x-point.x,p.y-point.y)>3),`portal blocked by marker ${key}`);
 }
});
