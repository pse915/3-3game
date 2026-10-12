import {crisisState,drawEnvironment} from './crisis.js';
/** Real map/asset snapshots: deterministic from the saved world and the player's projects. */
import {worldTier} from './story.js';
export const ENDING_VIEW_VERSION=1;
const VIEWS={town:{x:91,y:92,w:76,h:43},school:{x:27,y:11,w:80,h:45}};
const TILE=32;
const at=(s,x,y,w,h)=>({x:(x-s.x)*s.sx,y:(y-s.y)*s.sy,w:w*s.sx,h:h*s.sy});
function shape(g,v,x,y,w,h,color){const a=at(v,x,y,w,h);g.fillStyle=color;g.fillRect(Math.round(a.x),Math.round(a.y),Math.max(1,Math.round(a.w)),Math.max(1,Math.round(a.h)));}
function text(g,v,x,y,s,size=14,color='#fff'){const a=at(v,x,y,0,0);g.fillStyle='#244c49d9';g.fillRect(a.x-10,a.y-size,Math.min(230,s.length*size*.63+20),size+9);g.fillStyle=color;g.font=`bold ${size}px system-ui`;g.fillText(s,a.x,a.y+1);}
function drawAsset(g,v,images,obj){let{asset,x,y,w,h}=obj;const pos=at(v,x*TILE,y*TILE,w,h);if(pos.x>g.canvas.width||pos.y>g.canvas.height||pos.x+pos.w<0||pos.y+pos.h<0)return;let im,sx=0,sy=0,sw=256,sh=256;if(asset===32){im=images.school;sw=im?.width;sh=im?.height;}else{im=asset>=65?images.details:asset>=49?images.facilities:asset>=33?images.furniture:asset>=16?images.buildings:images.environment;const j=asset>=65?asset-65:asset>=49?asset-49:asset>=33?asset-33:asset>=16?asset-16:asset;sw=im?.width/4||256;sh=im?.height/4||256;sx=(j%4)*sw;sy=Math.floor(j/4)*sh;}if(im)g.drawImage(im,sx,sy,sw,sh,Math.round(pos.x),Math.round(pos.y),Math.max(1,Math.ceil(pos.w)),Math.max(1,Math.ceil(pos.h)));}
function students(g,v,images,x,y,n){for(let i=0;i<n;i++){const a=at(v,(x+(i%6)*1.4)*32,(y+Math.floor(i/6)*1.8)*32,14,22);if(images.avatars)g.drawImage(images.avatars,0,(i%6)*192,32,48,a.x,a.y,Math.max(4,a.w),Math.max(7,a.h));else{g.fillStyle=i%2?'#7d698f':'#d29485';g.fillRect(a.x,a.y,Math.max(4,a.w),Math.max(8,a.h));}}}
function facade(g,v,building,tier,i){const p=at(v,building.x*32,building.y*32,building.w,building.h);const rx=p.x,ry=p.y,rw=p.w,rh=p.h;if(tier===0){g.fillStyle='#f8df90bb';g.fillRect(rx+rw*.25,ry+rh*.44,rw*.40,Math.max(4,rh*.045));}else if(tier===1){g.fillStyle='#89bfa8ad';g.fillRect(rx+rw*.3,ry+rh*.45,rw*.27,Math.max(3,rh*.045));}else {g.fillStyle=tier===2?'#5b5d6474':'#2d333aaf';g.fillRect(rx+rw*.1,ry+rh*.12,rw*.8,rh*.8);g.strokeStyle='#514c4d';g.lineWidth=tier===3?3:2;g.beginPath();g.moveTo(rx+rw*.25,ry+rh*.21);g.lineTo(rx+rw*.29,ry+rh*.46);g.lineTo(rx+rw*.24,ry+rh*.57);g.stroke();if(tier===3){g.fillStyle='#48444a';g.fillRect(rx+rw*.45,ry+rh*.48,rw*.21,rh*.15);}}
}
function drawAging(g,v,objects,tier,mapId){if(tier<2)return;const buildings=objects.filter(o=>o.asset>=16&&o.asset<=32&&o.w>=96&&o.h>=80);for(let i=0;i<buildings.length;i++){const obj=buildings[i];if((i*13+obj.x+obj.y)%8>=tier*2)continue;facade(g,v,obj,tier,i);}}
function drawTownProjects(g,v,quiz,bank,lang){const list=quiz?.projects||[];for(let i=0;i<list.length;i++){const q=bank?.questions?.find(q=>q.id===list[i]);if(!q?.project?.point)continue;let[x,y]=q.project.point;
 // Keep real locations when visible; a small project notice appears on the central
 // square when its actual building lies outside this fixed before/after camera crop.
 if(x<v.x/32||x>(v.x+960/v.sx)/32||y<v.y/32||y>(v.y+540/v.sy)/32){x=110+(i%6)*7;y=125+Math.floor(i/6)*5;}
 shape(g,v,x*32-20,y*32-55,52,32,'#376d63');shape(g,v,x*32-14,y*32-49,40,21,'#e1ecd0');shape(g,v,x*32-10,y*32-38,30,4,'#568e7a');shape(g,v,x*32+3,y*32-23,4,28,'#634c48');
 const p=at(v,x*32,y*32-68,0,0);g.fillStyle='#e9c584';g.beginPath();g.arc(p.x,p.y,Math.max(4,v.sx*7),0,Math.PI*2);g.fill();
 }
}
function drawSchoolChanges(g,v,images,world,quiz,tier){const projects=quiz?.projects||[],count=projects.length,trust=world.communityTrust||0;
 // Landmark remains exactly the original sprite; modifications use transparent pixel overlays.

 if(tier<=1){shape(g,v,45*32,23*32,19*32,10,'#9cc5b7');shape(g,v,48*32,23*32,13*32,6,'#eaf2ce');}
 if(count>=2||trust>=65){shape(g,v,57*32,49*32,15*32,15,'#4c9174');shape(g,v,58*32,48*32,12*32,8,'#e0d98a');}
 if(projects.includes('q14')||projects.includes('q07')||projects.includes('q15')){shape(g,v,81*32,42*32,92,70,'#d9b97a');shape(g,v,82*32,43*32,55,26,'#6a9e9b');}
 if(projects.includes('q13'))for(let i=0;i<8;i++)shape(g,v,(60+i)*32,(53+i%2)*32,15,8,'#faf6d5');
 students(g,v,images,61,52,tier===3?1:tier===2?3:Math.min(12,6+Math.round(count/2)));
}
function drawTownChanges(g,v,images,world,quiz,tier,flags){const count=quiz?.projects?.length||0;
 if(tier===0||tier===1){for(let i=0;i<16;i++){const x=(107+(i*11)%48)*32,y=(112+(i*7)%24)*32;shape(g,v,x,y,18,11,i%3?'#4c9875':'#f0db83');}}
 if(tier>=2){for(let i=0;i<tier*18;i++){const x=(99+(i*17)%60)*32,y=(109+(i*11)%28)*32;shape(g,v,x,y,6+(i%3)*2,11,i%2?'#657d60':'#44484996');}}
 if((world.localEconomy||0)>65&&tier<2){shape(g,v,117*32,109*32,220,25,'#b07670');shape(g,v,118*32,110*32,160,10,'#f5de9e');}
 if(flags?.communityWork||flags?.legacy){shape(g,v,140*32,132*32,160,30,'#528f74');shape(g,v,142*32,131*32,115,12,'#e9d58c');}
 drawTownProjects(g,v,quiz,world.bank);
 students(g,v,images,132,127,tier===3?1:tier===2?3:Math.min(12,5+Math.round(count/3)));
}
export function imageState(story,bank,gameFlags={}){const tier=worldTier(story),quiz=story.quiz||{};return {tier:tier.tier,score:tier.score,world:{...story.world},projects:[...(quiz.projects||[])],flags:{...story.flags},chosenEvents:(story.records||[]).map(r=>r.id),gameFlags:{...gameFlags},condition:crisisState(story,bank),snapshotVersion:ENDING_VIEW_VERSION};}
/** Canvas image is not a fabricated generic picture: render the actual same map data and asset PNGs. */
export function renderEndingImage(mapId,map,images,snapshot,{future=false,quizBank}={}){
 const c=document.createElement('canvas');c.width=960;c.height=540;c.className='ending-snapshot';c.setAttribute('role','img');const g=c.getContext('2d',{alpha:false});g.imageSmoothingEnabled=false;
 const vp=VIEWS[mapId],v={x:vp.x*32,y:vp.y*32,sx:c.width/(vp.w*32),sy:c.height/(vp.h*32)};
 g.fillStyle='#7aa18b';g.fillRect(0,0,c.width,c.height);
 const x0=Math.floor(vp.x),x1=Math.min(map.width,Math.ceil(vp.x+vp.w)),y0=Math.floor(vp.y),y1=Math.min(map.height,Math.ceil(vp.y+vp.h));
 for(let y=y0;y<y1;y++)for(let x=x0;x<x1;x++){
  const pos=at(v,x*32,y*32,32,32);const tile=map.tiles[y*map.width+x]||0;
  g.drawImage(images.terrain,tile*32,0,32,32,Math.round(pos.x),Math.round(pos.y),Math.ceil(pos.w),Math.ceil(pos.h));
 }
 const layers=future?(map.futureLayers||[]).filter(layer=>snapshot.gameFlags?.[layer.when]).flatMap(layer=>layer.objects||[]):[];
 const objects=[...(map.objects||[]),...layers].filter(o=>o.x<vp.x+vp.w+8&&o.y<vp.y+vp.h+8&&o.x*32+o.w>vp.x*32&&o.y*32+o.h>vp.y*32).sort((a,b)=>(a.y*32+a.h)-(b.y*32+b.h));
 objects.forEach(o=>{const damaged=future&&snapshot.tier>=2&&((o.x*13+o.y*17)%7<snapshot.tier*2);const selected=damaged?{...images,buildings:images['buildings-ruin']||images.buildings,school:images['school-ruin']||images.school}:images;drawAsset(g,v,selected,o);});
 if(!future){if(mapId==='school')students(g,v,images,61,52,9);else students(g,v,images,132,127,8);}
 else {const tier=snapshot.tier;drawEnvironment(g,map,snapshot.condition||{stage:tier+1,policies:snapshot.projects.length,baseStage:tier+1},v);
  const world={...snapshot.world,bank:quizBank};const quiz={projects:snapshot.projects};
  if(mapId==='school')drawSchoolChanges(g,v,images,world,quiz,tier);else drawTownChanges(g,v,images,world,quiz,tier,snapshot.flags);
 }
 // Shared frame is intentionally outside the image; no locale text is baked into PNGs.
 return c;
}
export function combineSnapshots(canvases){const combined=document.createElement('canvas');combined.width=1920;combined.height=1080;const g=combined.getContext('2d');g.imageSmoothingEnabled=false;canvases.forEach((c,i)=>g.drawImage(c,(i%2)*960,Math.floor(i/2)*540,960,540));return combined;}
