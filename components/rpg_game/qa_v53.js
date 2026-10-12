/** Development-only UI fixture. Never imported without ?qa-v53. */
import {freshStory} from './story.js';
import {ensureQuiz,submitQuiz,applyVillageProject} from './quiz.js';
import {crisisState,performance} from './crisis.js';
export function mountQA(game){
 const bar=document.createElement('div');bar.style.cssText='position:fixed;bottom:4px;left:4px;z-index:10000;background:#fff8ed;padding:5px;display:flex;gap:4px;flex-wrap:wrap;max-width:95vw';document.body.append(bar);
 for(const n of [12,9,6,0]){const b=document.createElement('button');b.textContent='검증 '+n+'/12';b.onclick=async()=>{await game.start(false);const s=game.state.life.story=freshStory();s.chapter=7;s.step=0;Object.keys(s.world).forEach(k=>s.world[k]=70);const q=ensureQuiz(s);for(const [i,item]of game.quizData.questions.filter(x=>x.required).entries()){q.pending=item.id;if(i>=n)submitQuiz(s,item.id,(item.correct+1)%item.options.length,game.quizData);submitQuiz(s,item.id,item.correct,game.quizData);}await game.loadMap('town',[128,122]);game.refreshGuide(true);report();};bar.append(b);}
 const add=(text,fn)=>{const b=document.createElement('button');b.textContent=text;b.onclick=fn;bar.append(b);};
 add('검증 회복',()=>{const s=game.story;for(const item of game.quizData.questions.filter(x=>x.required))applyVillageProject(s,item.id,game.quizData);report();});
 add('검증 학교',()=>game.loadMap('school',[64,51]));add('검증 마을',()=>game.loadMap('town',[128,122]));
 add('검증 엔딩',()=>{game.story.complete=true;game.endingShowcase();report();});
 add('검증 저장',()=>{game.save();report();});
 add('검증 러시아어',()=>game.setLanguage('ru'));add('검증 한국어',()=>game.setLanguage('ko'));
 const status=document.createElement('output');status.id='qa-v53-status';bar.append(status);
 function report(){const s=game.story,c=crisisState(s,game.quizData),p=performance(s,game.quizData);status.textContent=JSON.stringify({stage:c.stage,first:p.firstTryCorrect,wrong:p.firstTryWrong,complete:p.completedRequired,policies:c.policies});}
}
