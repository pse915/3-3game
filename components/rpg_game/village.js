/** Accessible, nonblocking, persistent marker sites for community improvements. */
export function villageProjectMarkers(map,bank,ids){
 if(!map||!bank||!Array.isArray(ids)||map.id!=='town')return [];
 const used=[],markers=[];
 const pass=(x,y)=>x>=1&&y>=1&&x<map.width-1&&y<map.height-1&&!map.solid[y*map.width+x];
 const exits=map.portals||[],npcs=map.npcs||[];
 const dist=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
 for(const id of ids){
  const q=bank.questions.find(x=>x.id===id);if(!q?.project)continue;
  let [ax,ay]=q.project.point;
  if(!pass(ax,ay)){
   let found=null;
   for(let radius=1;radius<=5&&!found;radius++)for(let dy=-radius;dy<=radius&&!found;dy++)for(let dx=-radius;dx<=radius&&!found;dx++)if(pass(ax+dx,ay+dy))found=[ax+dx,ay+dy];
   if(!found)continue;
   [ax,ay]=found;
  }
  const seen=new Set([ax+','+ay]),queue=[[ax,ay,0]],options=[];
  for(let head=0;head<queue.length;head++){
   const [x,y,steps]=queue[head];
   if(steps>8)continue;
   const point={x,y};
   const clear=exits.every(p=>dist(point,p)>=3.3)&&npcs.every(n=>dist(point,n)>=2.5)&&used.every(p=>dist(point,p)>=3);
   if(clear)options.push({x,y,steps});
   if(steps>=8)continue;
   for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]){
    const xx=x+dx,yy=y+dy,key=xx+','+yy;
    if(pass(xx,yy)&&!seen.has(key)){seen.add(key);queue.push([xx,yy,steps+1]);}
   }
  }
  options.sort((a,b)=>Math.abs(a.steps-5)-Math.abs(b.steps-5)||a.y-b.y||a.x-b.x);
  const chosen=options[0];if(!chosen)continue;
  used.push(chosen);
  markers.push({x:chosen.x,y:chosen.y,name:q.project.title,label:'🏘 '+q.project.label,projectId:id});
 }
 return markers;
}
