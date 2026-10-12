/** v5.3: preparedness is a fictional scenario device, never a demographic forecast. */
export const REQUIRED_QUIZ_IDS=['q01','q02','q03','q04','q05','q06','q07','q08','q10','q11','q12','q15'];
export function performance(story,bank){
 const q=story.quiz||{},required=bank?.questions?.filter(x=>x.required)||[];
 const results=q.firstAttemptResults||{};
 const known=required.filter(x=>typeof results[x.id]==='boolean');
 const correct=known.filter(x=>results[x.id]).length;
 return {totalRequired:required.length,firstTryCorrect:correct,firstTryWrong:known.length-correct,answeredRequired:known.length,unknownRequired:required.length-known.length,completedRequired:required.filter(x=>q.completed?.includes(x.id)).length,attemptsByQuiz:{...q.attempts},hintsByQuiz:{...q.hints},firstAttemptResults:{...results},learnedTopics:required.filter(x=>q.completed?.includes(x.id)).map(x=>x.topic)};
}
export function basicStage(correct,total=12){if(!total)return 1;const n=correct/total*12;return n>=10?1:n>=7?2:n>=4?3:4;}
export function crisisState(story,bank){
 const p=performance(story,bank),w=story.world||{};
 const socialScore=Math.round(.22*(w.populationVitality??71)+.23*(w.localEconomy??72)+.21*(w.communityTrust??70)+.17*(w.socialSafetyNet??66)+.09*(w.environment??71)+.08*(w.familySupport??65));
 const base=basicStage(p.firstTryCorrect,p.answeredRequired);
 // Only known responses count. Youth cannot jump directly to ruins.
 const progress=Math.min(1,Math.max(0,(story.chapter||0)/6));
 const pressure=p.answeredRequired?(base-1)*progress:0;
 const socialPressure=(70-socialScore)/18;
 const policies=(story.quiz?.projects||[]).length;
 const recovery=Math.min(4.5,policies*.35);
 const stage=1+Math.min(3,Math.max(0,Math.round(pressure+socialPressure-recovery)));
 return {stage,baseStage:base,socialScore,score:Math.max(0,Math.min(100,Math.round(100-(stage-1)*25))),recovery,policies,projects:[...(story.quiz?.projects||[])],performance:p};
}
const plans=new WeakMap();
/** Plans are rebuilt only after chapter, responses, meters, or policies change. */
export function environmentPlan(map,condition){
 const key=JSON.stringify([condition.stage,condition.policies,condition.baseStage,condition.projects]);
 const old=plans.get(map);if(old?.key===key)return old.plan;
 const stage=condition.stage,plan=[];
 if(stage>1){
  for(const o of map.objects||[]){
   if(o.asset>=16&&o.asset<=32&&o.w>=80){
    const seed=(o.x*13+o.y*17+o.asset)%13;
    if(stage===2&&seed%3)continue;
    for(let i=0;i<(stage===4?9:stage===3?5:1);i++)plan.push({type:i===0?'shutter':i%3===0?'roof':i%2?'window':'crack',x:o.x*32+o.w*(.15+(i%4)*.19),y:o.y*32+o.h*(.24+Math.floor(i/4)*.20),w:Math.min(48,o.w*.14),h:Math.min(42,o.h*.18)});
   }
  }
  const inside=map.kind==='room'||map.kind==='floor'||/^floor/.test(map.id);
  for(let y=4;y<map.height-3;y+=stage===4?4:7)for(let x=4;x<map.width-3;x+=7){
   if(map.solid[y*map.width+x]||(x*7+y*11)%5>stage-1)continue;
   if((map.portals||[]).some(p=>Math.hypot(x-p.x,y-p.y)<4)||(map.npcs||[]).some(n=>Math.hypot(x-n.x,y-n.y)<3))continue;
   plan.push({type:inside?'crack':(x+y)%3===0?'crack':'weeds',x:x*32,y:y*32,w:32,h:32});
  }
  if(inside&&stage>=3)for(const o of (map.objects||[]).filter(o=>o.asset>=33&&o.asset<=48).slice(0,stage*5))plan.push({type:'desk',x:o.x*32,y:o.y*32,w:32,h:32});
  if(map.id==='school'&&stage>=3){plan.push({type:'shutter',x:39*32,y:41*32,w:52,h:60});plan.push({type:'shutter',x:79*32,y:41*32,w:52,h:60});}
 }
 if(map.id==='school'&&stage===2)plan.push({type:'learning',x:75*32,y:48*32,w:128,h:96});
 if(condition.policies){
  const projects=condition.projects||[];
  if(map.id==='town'){
   const locations={q01:[116,172],q02:[116,172],q03:[116,172],q04:[116,172],q05:[105,156],q06:[105,156],q07:[154,158],q08:[105,156],q09:[102,83],q10:[155,83],q11:[154,127],q12:[137,115],q13:[128,122],q14:[154,158],q15:[116,172]};
   for(const id of projects){const [x,y]=locations[id]||map.spawn;const type=['q08','q10','q11'].includes(id)?'care':['q09','q12'].includes(id)?'housing':['q07','q14'].includes(id)?'learning':id==='q13'?'repair':'bench';plan.push({type,x:(x+2)*32,y:(y+2)*32,w:64,h:64});
    if(id==='q13')for(let j=0;j<7;j++)plan.push({type:'repair',x:(x+j-3)*32,y:(y+3)*32,w:32,h:32});
   }
  }else if(map.id==='school'){
   if(projects.some(id=>['q07','q14','q15'].includes(id)))plan.push({type:'learning',x:75*32,y:48*32,w:128,h:96});
   if(projects.some(id=>['q08','q10','q11'].includes(id)))plan.push({type:'care',x:54*32,y:47*32,w:96,h:96});
   if(projects.includes('q13'))for(let i=0;i<9;i++)plan.push({type:'repair',x:(57+i)*32,y:53*32,w:32,h:32});
  }
  // A restored town retains a few physical traces rather than erasing its history.
  if(condition.baseStage>=3&&stage<=2)for(const o of (map.objects||[]).filter(o=>o.asset>=16&&o.asset<=32).slice(0,3))plan.push({type:'crack',x:o.x*32+o.w*.2,y:o.y*32+o.h*.4,w:12,h:30});
 }
 plans.set(map,{key,plan});return plan;
}
/** Pixel silhouettes, opaque materials and broken shapes; no full-screen tint. */
export function drawEnvironment(g,map,condition,view){
 const {x=0,y=0,sx=1,sy=1}=view||{};
 g.save();g.imageSmoothingEnabled=false;
 const rect=(a,b,w,h,c)=>{g.fillStyle=c;g.fillRect(Math.round(a),Math.round(b),Math.max(1,Math.ceil(w)),Math.max(1,Math.ceil(h)));};
 for(const o of environmentPlan(map,condition)){
  const px=(o.x-x)*sx,py=(o.y-y)*sy,w=o.w*sx,h=o.h*sy;
  if(px>g.canvas.width||py>g.canvas.height||px+w<0||py+h<0)continue;
  const r=(a,b,c,d,col)=>rect(px+a*w,py+b*h,c*w,d*h,col);
  if(o.type==='window'){r(0,0,1,1,'#b0a18b');r(.1,.1,.8,.8,'#30444c');r(.15,.15,.28,.26,'#90b7b6');r(.56,.59,.31,.27,'#92aba7');r(.45,0,.09,1,'#c0aa8d');r(0,.45,1,.09,'#c0aa8d');}
  else if(o.type==='shutter'){r(0,0,1,.8,'#6b7474');for(let j=0;j<5;j++)r(0,j*.15,1,.045,'#414e55');r(.17,.82,.67,.16,'#927c6b');r(.3,.85,.35,.04,'#f0d6a2');}
  else if(o.type==='roof'){r(0,0,.3,.4,'#443f47');r(.3,.15,.3,.4,'#443f47');r(.6,.33,.4,.35,'#443f47');r(.12,.67,.7,.1,'#ab7b68');r(.38,.81,.4,.11,'#bd9374');}
  else if(o.type==='crack'){for(let j=0;j<6;j++)r(.25+(j%3)*.10,j*.14,.08,.20,'#625d64');r(.2,.7,.4,.07,'#9a8e80');}
  else if(o.type==='weeds'){for(let j=0;j<5;j++){r(.1+j*.17,.55-(j%2)*.2,.09,.45,'#61866a');r(.02+j*.17,.58-(j%2)*.2,.12,.09,'#8ba174');}r(.05,.92,.87,.08,'#526f57');}
  else if(o.type==='desk'){r(.1,.2,.8,.3,'#b39273');r(.1,.5,.12,.4,'#726657');r(.77,.5,.12,.4,'#726657');r(.1,.1,.8,.1,'#dbc2a1');r(.4,.25,.25,.05,'#70625f');}
  else if(o.type==='bench'){r(.05,.2,.9,.13,'#d8b18b');r(.05,.4,.9,.13,'#d8b18b');r(.15,.55,.1,.35,'#506a66');r(.75,.55,.1,.35,'#506a66');}
  else if(['care','housing','learning'].includes(o.type)){r(.05,.22,.9,.68,'#e5d0a7');r(0,.12,1,.16,o.type==='care'?'#77a7a3':o.type==='learning'?'#9b91b7':'#b98a75');r(.12,.34,.23,.24,'#83b4b2');r(.65,.34,.23,.24,'#83b4b2');r(.4,.47,.2,.43,'#635453');r(.38,.25,.25,.13,'#f5ecd3');if(o.type==='care'){r(.49,.27,.04,.08,'#6b9a88');r(.46,.3,.1,.025,'#6b9a88');}r(.03,.92,.94,.05,'#b19c80');}
  else {r(0,.45,1,.45,'#bcc5b6');r(.05,.55,.9,.08,'#edf0d6');r(.15,.1,.1,.4,'#5b9a7b');r(.75,.1,.1,.4,'#5b9a7b');r(.12,.08,.8,.09,'#6caa87');}
 }
 g.restore();
}
