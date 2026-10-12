export const DISCOVERIES=[
{id:'school-promise',map:'school',name:'교정의 작은 약속',text:'누구에게나 학교에 참여할 기회가 필요해. 내가 바꿀 수 있는 작은 불편을 찾아보자.',concept:'배움과 사회적 지원',point:[71,57]},
{id:'town-letter',map:'town',name:'광장의 오래된 편지',text:'다른 나이의 이웃과 같은 길을 걸으며 서로의 속도를 존중한다는 편지를 발견했다.',concept:'세대 간 이해',point:[135,128]},
{id:'library-page',map:'library',name:'책 속 다이어리 조각',text:'미래의 계획은 한 번 완성하는 답이 아니야. 새로운 정보를 알게 되면 다시 써도 좋아.',concept:'계획의 점검과 수정',point:[14,22]},
{id:'care-time',map:'care',name:'함께 돌보는 시간표',text:'도움을 받는 사람도, 주는 사람도 자신만의 쉼과 시간이 필요하다는 메모를 발견했다.',concept:'사회적 돌봄과 일·가정 양립',point:[12,22]},
{id:'hall-seat',map:'hall',name:'광장 회의의 빈 의자',text:'의견을 말하기 어려운 주민에게도 자리를 남겨 두자는 약속을 찾았다.',concept:'사회적 준비와 공동체 참여',point:[10,22]},
{id:'hospital-route',map:'hospital',name:'쉬어 가는 길',text:'높은 계단만 고치는 것보다 쉬어 갈 의자와 읽기 쉬운 안내도 함께 필요하다고 적혀 있었다.',concept:'고령 친화 환경',point:[18,22]},
{id:'culture-hobby',map:'culture',name:'처음 만든 작은 작품',text:'즐기는 일과 만나는 사람은 나이가 들어도 삶을 지탱한다. 배움을 다시 시작할 수 있다.',concept:'여가와 대인 관계의 준비',point:[20,22]},
{id:'home-envelope',map:'home',name:'미래의 나에게 쓴 봉투',text:'재무·건강·여가·대인 관계를 한 가지씩 지금부터 준비하자는 작은 편지를 발견했다.',concept:'노후 준비 네 영역',point:[12,22]}
];
export function collectDiscovery(state,item){const l=state.life;l.fragments??=[];if(l.fragments.includes(item.id))return false;l.fragments.push(item.id);l.growth=Math.min(100,l.growth+2);l.preparation=Math.min(100,l.preparation+2);return true;}
