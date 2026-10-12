/** Non-mutating spatial lookup for large tile maps (world coordinates in pixels). */
export function buildObjectIndex(objects, tileSize=32, chunkTiles=16){
  const chunk=tileSize*chunkTiles, bins=new Map();
  for(const o of objects){
    const left=Math.floor(o.x*tileSize/chunk), top=Math.floor(o.y*tileSize/chunk);
    const right=Math.floor((o.x*tileSize+Math.max(1,o.w)-1)/chunk);
    const bottom=Math.floor((o.y*tileSize+Math.max(1,o.h)-1)/chunk);
    for(let y=top;y<=bottom;y++)for(let x=left;x<=right;x++){
      const key=x+','+y;
      if(!bins.has(key))bins.set(key,[]);
      bins.get(key).push(o);
    }
  }
  return {bins,chunk,tileSize};
}
export function nearbyObjects(index,x,y,width,height){
  const {bins,chunk,tileSize}=index, found=new Set();
  const minX=Math.floor(x/chunk), maxX=Math.floor((x+width)/chunk);
  const minY=Math.floor(y/chunk), maxY=Math.floor((y+height)/chunk);
  for(let cy=minY;cy<=maxY;cy++)for(let cx=minX;cx<=maxX;cx++){
    for(const o of bins.get(cx+','+cy)||[]){
      if(o.x*tileSize+o.w>x&&o.x*tileSize<x+width&&o.y*tileSize+o.h>y&&o.y*tileSize<y+height)found.add(o);
    }
  }
  return [...found];
}
/** Recovery for interrupted/older saves: position follows the *record IDs*, never guesses choices. */
export function findStoryResume(data, records){
  if(!data?.chapters||!Array.isArray(records))return null;
  const done=new Set(records.map(r=>r?.id).filter(Boolean));
  let total=0;
  for(let chapter=0;chapter<data.chapters.length;chapter++){
    const events=data.chapters[chapter].events;
    if(!Array.isArray(events))return null;
    for(let step=0;step<events.length;step++){
      total++;
      if(!done.has(events[step].id))return {chapter,step,complete:false};
    }
  }
  return {chapter:data.chapters.length,step:0,complete:true,total};
}

/** Valid spawn on map (tiles), falling back to map.spawn if a save was inside a wall. */
export function walkableSpawn(map,arrival){
  const pass=(x,y)=>Number.isFinite(x)&&Number.isFinite(y)&&x>=1&&y>=1&&x<map.width-1&&y<map.height-1&&!map.solid[Math.floor(y)*map.width+Math.floor(x)];
  const candidates=[arrival,map.spawn].filter(p=>Array.isArray(p)&&p.length===2);
  for(const position of candidates){
    const [x,y]=position;
    if(pass(x,y))return [x,y];
    for(let r=1;r<=12;r++)for(let yy=-r;yy<=r;yy++)for(let xx=-r;xx<=r;xx++){
      if(Math.abs(xx)!==r&&Math.abs(yy)!==r)continue;
      if(pass(x+xx,y+yy))return [x+xx,y+yy];
    }
  }
  for(let y=1;y<map.height-1;y++)for(let x=1;x<map.width-1;x++)if(pass(x,y))return[x,y];
  return null;
}
