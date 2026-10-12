/** v5 knowledge checks: a separate, save-compatible state machine. No DOM or timers. */
export const QUIZ_VERSION=5;
export function freshQuiz(){return {version:5,completed:[],pending:null,queue:[],attempts:{},hints:{},projects:[],firstAttemptResults:{}};}
export function ensureQuiz(story){
 if(!story.quiz)story.quiz=freshQuiz();
 story.quiz.firstAttemptResults??={};
 return story.quiz;
}
export function isQuiz(q){
 if(!q||typeof q!=='object')return false;
 const ids=a=>Array.isArray(a)&&a.length<=15&&new Set(a).size===a.length&&a.every(x=>typeof x==='string'&&/^q\d{2}$/.test(x));
 const dict=v=>v&&typeof v==='object'&&!Array.isArray(v)&&Object.keys(v).length<=15&&Object.entries(v).every(([k,n])=>/^q\d{2}$/.test(k)&&Number.isInteger(n)&&n>=0&&n<=999);
 const first=q.firstAttemptResults;
 const validFirst=first===undefined||first&&typeof first==='object'&&!Array.isArray(first)&&Object.keys(first).length<=15&&Object.entries(first).every(([id,result])=>/^q\d{2}$/.test(id)&&typeof result==='boolean'&&(q.attempts[id]||0)>0);
 return validFirst&&!!q&&q.version===5&&ids(q.completed)&&ids(q.queue)&&ids(q.projects)&&(q.pending===null||typeof q.pending==='string'&&/^q\d{2}$/.test(q.pending))&&dict(q.attempts)&&dict(q.hints)&&q.projects.every(x=>q.completed.includes(x));
}
export function quizById(bank,id){return bank?.questions?.find(q=>q.id===id)||null;}
export function requiredQuizCount(bank){return bank?.questions?.filter(q=>q.required).length||0;}
export function completedRequired(story,bank){return ensureQuiz(story).completed.filter(id=>quizById(bank,id)?.required).length;}
function activateNext(q){
 if(!q.pending&&q.queue.length)q.pending=q.queue.shift();
 return q.pending;
}
export function queueEventQuizzes(story,eventId,bank){
 const q=ensureQuiz(story);let added=0;
 for(const item of bank.questions){
  if(!item.required||item.afterEvent!==eventId||q.completed.includes(item.id)||q.pending===item.id||q.queue.includes(item.id))continue;
  q.queue.push(item.id);added++;
 }
 activateNext(q);return added;
}
export function openBonusQuiz(story,id,bank){
 const q=ensureQuiz(story),item=quizById(bank,id);
 if(!item||item.required||story.chapter<6&&!story.complete)return {ok:false,message:'노후 준비 챕터에서 열리는 보충 문제예요.'};
 if(q.pending)return {ok:false,message:'먼저 진행 중인 문제를 완료해 주세요.'};
 if(q.completed.includes(id))return {ok:false,message:'이미 학습한 문제예요.'};
 q.pending=id;return {ok:true};
}
export function submitQuiz(story,id,index,bank){
 const q=ensureQuiz(story),item=quizById(bank,id);
 if(!item||q.pending!==id||!Number.isInteger(index)||index<0||index>=item.options.length)return {ok:false,message:'진행 중인 문제와 답안을 확인해 주세요.'};
 if(!q.attempts[id]&&!Object.hasOwn(q.firstAttemptResults,id))q.firstAttemptResults[id]=index===item.correct;
 q.attempts[id]=Math.min(999,(q.attempts[id]||0)+1);
 if(index!==item.correct){q.hints[id]=Math.min(999,(q.hints[id]||0)+1);return {ok:true,correct:false,attempts:q.attempts[id],hint:q.attempts[id]>=2?item.hintMore:item.hint};}
 if(!q.completed.includes(id))q.completed.push(id);
 q.pending=null;
 activateNext(q);
 return {ok:true,correct:true,attempts:q.attempts[id],next:q.pending,item};
}
export function applyVillageProject(story,id,bank){
 const q=ensureQuiz(story),item=quizById(bank,id);
 if(!item||!q.completed.includes(id))return {ok:false,message:'먼저 관련 퀴즈를 완료해 주세요.'};
 if(q.projects.includes(id))return {ok:false,message:'이미 마을에 반영한 개선안이에요.'};
 const project=item.project;
 const delta={};
 for(const [key,amount] of Object.entries(project.effects)){
  if(!Object.hasOwn(story.world,key)||!Number.isFinite(amount))continue;
  const before=story.world[key];story.world[key]=Math.max(0,Math.min(100,Math.round(before+amount)));delta[key]=story.world[key]-before;
 }
 q.projects.push(id);
 return {ok:true,project,delta};
}
export function learnedQuizNotes(story,bank){
 const q=ensureQuiz(story);
 return q.completed.map(id=>quizById(bank,id)).filter(Boolean).map(item=>({id:item.id,chapter:item.chapter,topic:item.topic,diary:item.diary,applied:q.projects.includes(item.id)}));
}
