import {crisisState,REQUIRED_QUIZ_IDS} from './crisis.js';
/** v4 narrative state machine. Independent of the preserved v3 quest and save envelope. */
import {formatChange,localizeSavedEffect} from './locale.js';
import {isQuiz} from './quiz.js';
export {SELF_NAMES,WORLD_NAMES} from './locale.js';
export const STORY_CHAPTERS=[
 {title:'첫 번째 갈림길',age:15,year:2026},
 {title:'서로 다른 길, 같은 고민',age:18,year:2029},
 {title:'독립과 새로운 도전',age:23,year:2034},
 {title:'일, 사랑, 그리고 가족',age:31,year:2042},
 {title:'내가 선택한 삶의 무게',age:41,year:2052},
 {title:'예상하지 못한 변화',age:51,year:2062},
 {title:'인생의 다음 장',age:60,year:2071},
 {title:'나의 미래 다이어리',age:65,year:2076}
];
const clamp=n=>Math.max(0,Math.min(100,Math.round(n)));
const defaultWorld=()=>({populationVitality:71,familySupport:65,localEconomy:72,communityTrust:70,environment:71,socialSafetyNet:66});
const defaultSelf=()=>({learning:45,money:45,health:65,satisfaction:55,career:20,connections:48});
export function freshStory(){return {version:4,chapter:0,step:0,complete:false,records:[],flags:{},relationships:{friend:48,mentor:52,partner:0,family:45,neighbors:45},self:defaultSelf(),world:defaultWorld(),outcomes:[],worldHistory:[],reflection:'',reunion:false};}
export function ensureStory(state){if(!state.life)state.life={};if(!state.life.story)state.life.story=freshStory();return state.life.story;}
const finiteMeter=o=>!!o&&typeof o==='object'&&!Array.isArray(o)&&Object.values(o).every(x=>Number.isInteger(x)&&x>=0&&x<=100);
export function isEndingVisualization(v){
 if(!v||typeof v!=='object'||Array.isArray(v)||v.snapshotVersion!==1)return false;
 if(!Number.isInteger(v.tier)||v.tier<0||v.tier>3||!Number.isInteger(v.score)||v.score<0||v.score>100)return false;
 if(!finiteMeter(v.world)||!Array.isArray(v.projects)||v.projects.length>15||new Set(v.projects).size!==v.projects.length||!v.projects.every(x=>/^q\d{2}$/.test(x)))return false;
 if(!v.flags||typeof v.flags!=='object'||Array.isArray(v.flags)||Object.keys(v.flags).length>100||!Object.values(v.flags).every(x=>typeof x==='string'&&x.length<100))return false;
 if(v.gameFlags!==undefined&&(!v.gameFlags||typeof v.gameFlags!=='object'||Array.isArray(v.gameFlags)||Object.keys(v.gameFlags).length>20||!Object.values(v.gameFlags).every(x=>typeof x==='boolean')))return false;
 return Array.isArray(v.chosenEvents)&&v.chosenEvents.length<=64&&v.chosenEvents.every(x=>typeof x==='string'&&x.length<100);
}
export function isStory(s){return !!s&&(!Object.hasOwn(s,'endingVisualization')||isEndingVisualization(s.endingVisualization))&&s.version===4&&Number.isInteger(s.chapter)&&s.chapter>=0&&s.chapter<=8&&Number.isInteger(s.step)&&s.step>=0&&s.step<=8&&typeof s.complete==='boolean'&&Array.isArray(s.records)&&s.records.length<=64&&s.records.every(r=>r&&typeof r.id==='string'&&r.id.length<100&&typeof r.title==='string'&&r.title.length<200&&typeof r.choice==='string'&&r.choice.length<300&&typeof r.result==='string'&&r.result.length<1200&&Number.isInteger(r.age)&&r.age>=15&&r.age<=65)&&s.flags&&typeof s.flags==='object'&&!Array.isArray(s.flags)&&Object.keys(s.flags).length<=100&&Object.values(s.flags).every(v=>typeof v==='string'&&v.length<100)&&finiteMeter(s.relationships)&&finiteMeter(s.self)&&finiteMeter(s.world)&&Array.isArray(s.outcomes)&&s.outcomes.length<=30&&Array.isArray(s.worldHistory)&&s.worldHistory.length<=8&&typeof s.reflection==='string'&&s.reflection.length<=2000&&typeof s.reunion==='boolean'&&(!Object.hasOwn(s,'quiz')||isQuiz(s.quiz));}
export function chapterInfo(s){return STORY_CHAPTERS[Math.min(7,s.chapter)];}
export function compatible(v,s){if(!v.when)return true;return Object.entries(v.when).every(([key,value])=>Array.isArray(value)?value.includes(s.flags[key]):s.flags[key]===value);}
export function currentEvent(state,data){const s=ensureStory(state);if(s.complete||s.chapter>=data.chapters.length)return null;const chapter=data.chapters[s.chapter];const e=chapter.events[s.step];if(!e)return null;const variation=(e.variants||[]).find(v=>compatible(v,s));const scene=variation?{...e,...variation,id:e.id,baseTitle:e.title}:{...e};
 const tier=worldTier(s);const f=s.flags;
 const contexts={
  'c5-return':tier.tier>=2?'광장에는 문을 닫은 상점과 빈 건물도 있다. 마을을 다시 연결할 방법을 생각해 보자.':'기억하던 광장에 새로운 시설도 생겼다. 변화의 이유를 주민에게 들어 보자.',
  'c6-change':f.advancedStudy?'젊은 시절 더 공부했던 경험이 변화에 대응할 실마리가 된다.':f.business?'작은 사업을 운영하며 배웠던 문제 해결 능력이 떠오른다.':'예전에 배운 기술을 다시 활용할 수도 있다.',
  'c6-friend':f.friendship==='kept'?'15세에 서로의 꿈을 적었던 그 친구다.':f.reunion==='letters'?'서로 주고받던 편지들이 다시 한자리에 모였다.':'오랜만에 다시 만난 친구는 그때와 달라져 있다.',
  'c7-together':tier.tier>=2?'마을 곳곳에 비어 있는 시설과 줄어든 사람들이 보인다. 주민회의는 재생 계획을 고민한다.':'마을에 새로 생긴 공간을 더 많은 주민이 함께 누리도록 논의한다.',
  'c8-return':tier.tier===3?'일부 교실은 비어 있고 외벽과 운동장에는 세월의 흔적이 깊다.':tier.tier===2?'예전 교실 일부는 다른 용도의 지역시설로 바뀌었다.':'학교는 오늘도 새로운 세대와 지역 주민을 맞이하고 있다.',
  'c8-classroom':f.education==='vocational'?'실습을 배우던 십 대의 선택이 떠오른다.':f.education==='alternative'?'다른 속도로 배움을 이어 가던 십 대의 선택이 떠오른다.':'진학을 고민하던 십 대의 선택이 떠오른다.',
  'c8-town':tier.tier===3?'오래 비어 있는 가게 앞에도 다시 시작하려는 주민의 안내문이 붙어 있다.':tier.tier===2?'비어 있는 건물과 재생 사업 간판이 나란히 보인다.':'여러 세대의 발걸음과 바뀐 생활 시설을 볼 수 있다.',
  'c8-last':f.promise==='learn'?'15세에 평생 배우겠다고 썼던 첫 편지가 생각난다.':f.promise==='support'?'도움이 필요할 때 요청하겠다고 썼던 첫 편지가 생각난다.':'15세에 변화를 두려워하지 않겠다고 썼던 첫 편지가 생각난다.'
 };
 if(contexts[scene.id])scene.story+='\n\n'+contexts[scene.id];
 return scene;}
function change(meter,changes,output,prefix){for(const [key,amount]of Object.entries(changes||{})){if(!Object.hasOwn(meter,key)||!Number.isFinite(amount))continue;const v=clamp(meter[key]+amount);const d=v-meter[key];meter[key]=v;if(d)output.push(formatChange(prefix,key,d));}}
const WORLD_SHOCKS=[
 {localEconomy:1},{populationVitality:-2,localEconomy:1},{populationVitality:-5,localEconomy:-3},{populationVitality:-10,localEconomy:-12,communityTrust:-5},{populationVitality:-13,localEconomy:-15,communityTrust:-12,familySupport:-6,socialSafetyNet:-5,environment:-4},{populationVitality:-13,localEconomy:-17,communityTrust:-12,familySupport:-6,socialSafetyNet:-5,environment:-6},{populationVitality:-11,localEconomy:-13,communityTrust:-10,familySupport:-4,socialSafetyNet:-4,environment:-4},{populationVitality:-2,localEconomy:-3}
];
export function worldTier(s){const bank={questions:REQUIRED_QUIZ_IDS.map(id=>({id,required:true}))};const c=crisisState(s,bank);const labels=['활기찬 마을','변화하는 마을','쇠퇴하는 마을','심각하게 쇠퇴한 마을'];return {score:c.score,tier:c.stage-1,label:labels[c.stage-1],condition:c};}
export function performStoryChoice(state,data,index){const s=ensureStory(state),e=currentEvent(state,data);if(!e)return {ok:false,message:'이야기를 찾을 수 없습니다.'};if(s.records.some(r=>r.id===e.id))return {ok:false,message:'이미 경험한 사건입니다.'};const c=e.choices?.[index];if(!c)return {ok:false,message:'선택지를 확인하세요.'};const deltas=[];change(s.self,c.self,deltas,'self');change(s.world,c.world,deltas,'world');change(s.relationships,c.relationships,deltas,'relationships');Object.assign(s.flags,c.flags||{});
 const age=STORY_CHAPTERS[s.chapter].age;
 const result=typeof c.result==='string'?c.result:'다음 장에 이 선택이 기록되었습니다.';
 const entry={id:e.id,title:e.title,choice:c.label,result,age,year:STORY_CHAPTERS[s.chapter].year,chapter:s.chapter+1,place:e.map,effects:deltas};
 s.records.push(entry);
 s.step++;
 let chapterChanged=false;
 if(s.step>=data.chapters[s.chapter].events.length){
  // Changes outside the player's control: demographics, technology and the economy.
  const shock={...WORLD_SHOCKS[s.chapter]};
  const resilience=Number(!!s.flags.communityWork)+Number(!!s.flags.recovered)+Number(!!s.flags.legacy);
  if(resilience&&s.chapter>=3)for(const k of ['populationVitality','localEconomy','communityTrust','socialSafetyNet'])if(shock[k]<0)shock[k]=Math.min(0,shock[k]+Math.min(7,resilience*3));
  change(s.world,shock,[], 'world');
  s.worldHistory.push({chapter:s.chapter+1,age,tier:worldTier(s).tier,score:worldTier(s).score});
  s.chapter++;s.step=0;chapterChanged=true;
  if(s.chapter>=data.chapters.length){s.complete=true;s.reunion=true;}
 }
 return {ok:true,entry,chapterChanged,done:s.complete,message:result};
}
/** Optional external societal scenarios. Independent of the player's marriage/parenthood. */
export const REGIONAL_SCENARIOS=[
 {id:'investment',label:'주민·지자체 협력 투자',description:'일자리·공공 서비스·지역 교류에 대한 투자가 늘었다.',world:{localEconomy:9,communityTrust:9,socialSafetyNet:8,populationVitality:5}},
 {id:'migration',label:'장기 인구 유출과 시설 통폐합',description:'외부 지역으로 이동하는 인구가 늘어 지역의 시설 이용과 경제 활력이 줄었다.',world:{populationVitality:-30,localEconomy:-22,communityTrust:-12,familySupport:-8}},
 {id:'downturn',label:'지역 경제 불황과 서비스 축소',description:'기업 이전, 경기 침체, 공공 서비스 축소가 겹쳐 어려움이 생겼다.',world:{localEconomy:-34,communityTrust:-25,socialSafetyNet:-15,environment:-8}}
];
export function applyRegionalScenario(state,id){const s=ensureStory(state);if(s.chapter<4||s.chapter>6)return {ok:false,message:'중년기 이후 지역 사회 변화 카드를 선택할 수 있습니다.'};const key='regional'+s.chapter;if(s.flags[key])return {ok:false,message:'이 시기의 지역사회 변화는 이미 확인했습니다.'};const scenario=REGIONAL_SCENARIOS.find(item=>item.id===id);if(!scenario)return {ok:false,message:'존재하지 않는 사회 시나리오입니다.'};
 const effects=[];change(s.world,scenario.world,effects,'world');s.flags[key]=id;s.outcomes.push({chapter:s.chapter,description:scenario.description,id});return {ok:true,message:scenario.description,world:worldTier(s),effects};}
export function endingThemes(s){const themes=[];if(s.flags.advancedStudy||s.flags.returnedStudy||s.self.learning>=70)themes.push('평생 배움');if(s.flags.business||s.flags.changedCareer)themes.push('도전과 전환');if(s.flags.relationship==='solo')themes.push('독립과 자율');if(s.flags.relationship==='married'||s.flags.relationship==='partnered')themes.push('관계의 성장');if(s.world.communityTrust>=65||s.flags.communityWork)themes.push('공동체 기여');if(s.flags.recovered||s.flags.reskilled)themes.push('회복과 다시 시작');if(s.self.satisfaction>=65)themes.push('나만의 균형');return themes.length?themes.slice(0,4):['여러 길을 걸어온 삶','계속되는 새로운 선택'];}
export function storySummary(state){const s=ensureStory(state),w=worldTier(s);return ['나의 인생, 우리의 미래 · 15세부터 65세까지',...s.records.map(r=>`${r.year}년 ${r.age}세 · ${r.title}\n${r.choice}\n${r.result}${Array.isArray(r.effects)&&r.effects.length?'\n'+r.effects.map(localizeSavedEffect).join(' · '):''}`),`내가 만들어 온 삶: ${endingThemes(s).join(' · ')}`,`미래 마을: ${w.label} (${w.score})`,...s.outcomes.map(o=>'지역 사회의 변화: '+o.description),`65세의 다짐: ${s.reflection||'아직 기록하지 않음'}`].join('\n\n');}
