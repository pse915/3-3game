/** Korean display labels. Stable save/API keys are deliberately not translated. */
export const SELF_NAMES=Object.freeze({
  learning:'배움',satisfaction:'삶의 만족도',health:'건강',money:'보유 자금',
  career:'직업 경험',connections:'인간관계',wealth:'자산',finance:'경제적 안정',
  happiness:'행복감',stress:'스트레스',relationship:'인간관계',relationships:'인간관계',
  friendship:'우정',family:'가족 관계',education:'학습 경험',skill:'직업 역량',confidence:'자신감'
});
export const WORLD_NAMES=Object.freeze({
  populationVitality:'인구 활력',familySupport:'가족·돌봄 지원',localEconomy:'지역 경제',
  communityTrust:'공동체 신뢰',environment:'환경 상태',socialSafetyNet:'사회 안전망'
});
export const RELATIONSHIP_NAMES=Object.freeze({
  friend:'친구 관계',mentor:'도움을 주는 어른과의 관계',partner:'동반자 관계',
  family:'가족 관계',neighbors:'이웃 관계'
});
export const CAREER_NAMES=Object.freeze({
  barista:'바리스타',designer:'디자이너',developer:'개발자',nurse:'간호사',
  teacher:'교사', 'social-worker':'사회복지사',entrepreneur:'창업가',researcher:'연구원'
});
const LABEL_SETS=Object.freeze({self:SELF_NAMES,world:WORLD_NAMES,relationships:RELATIONSHIP_NAMES,career:CAREER_NAMES});
export function koreanLabel(key,scope='self'){
  return LABEL_SETS[scope]?.[key] ?? SELF_NAMES[key] ?? WORLD_NAMES[key] ?? RELATIONSHIP_NAMES[key] ?? CAREER_NAMES[key] ?? '알 수 없는 지표';
}
export function signedValue(value){return `${value>0?'+':''}${value}`;}
export function formatChange(scope,key,value){
  const prefix={self:'나의 ',world:'마을의 ',relationships:'관계 · ',career:''}[scope]??'';
  return `${prefix}${koreanLabel(key,scope)} ${signedValue(value)}`;
}
/** Keep old v4 checkpoints readable without rewriting or invalidating them. */
export function localizeSavedEffect(value){
  if(typeof value!=='string')return '';
  return value.replace(/(나의|마을|관계)\s+([A-Za-z][A-Za-z0-9_-]*)\s+([+-]?\d+)/g,(_full,prefix,key,amount)=>{
    const scope=prefix==='나의'?'self':prefix==='마을'?'world':'relationships';
    const n=Number(amount);
    return formatChange(scope,key,n);
  });
}
export function changeSentiment(key,value){
  if(!value)return 'neutral';
  const reverse=new Set(['stress','fatigue']);
  return (value>0)!==reverse.has(key)?'positive':'negative';
}
