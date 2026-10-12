import test from 'node:test';
import assert from 'node:assert/strict';
import {buildObjectIndex,nearbyObjects,findStoryResume} from '../components/rpg_game/performance.js';
import {readFileSync} from 'node:fs';
const root='components/rpg_game/data/';
const load=(name)=>JSON.parse(readFileSync(root+name,'utf8'));
test('Spatial query returns exactly visible town objects without duplicates',()=>{
  const map=load('maps/town.json'),index=buildObjectIndex(map.objects);
  for(const [x,y,w,h] of [[0,0,500,400],[3200,3100,960,720],[7000,1000,800,600],[1000,5000,800,600]]){
    const expected=map.objects.filter(o=>o.x*32+o.w>x&&o.x*32<x+w&&o.y*32+o.h>y&&o.y*32<y+h);
    assert.deepEqual(new Set(nearbyObjects(index,x,y,w,h)),new Set(expected));
  }
});
test('Large objects covering multiple chunks do not render twice',()=>{
 const o={x:0,y:0,w:1500,h:1500};const index=buildObjectIndex([o]);
 assert.deepEqual(nearbyObjects(index,0,0,1200,1200),[o]);
});
test('Interrupted story restores first missing event, not infinite panel recursion',()=>{
 const story=load('story_v4.json');
 const entries=story.chapters.flatMap(ch=>ch.events);
 assert.deepEqual(findStoryResume(story,[]),{chapter:0,step:0,complete:false});
 const mid=entries.slice(0,7).map(e=>({id:e.id}));
 const expectedChapter=story.chapters.findIndex(c=>c.events.some(e=>e.id===entries[7].id));
 const expectedStep=story.chapters[expectedChapter].events.findIndex(e=>e.id===entries[7].id);
 assert.deepEqual(findStoryResume(story,mid),{chapter:expectedChapter,step:expectedStep,complete:false});
 assert.equal(findStoryResume(story,entries.map(e=>({id:e.id}))).complete,true);
});
import {walkableSpawn} from '../components/rpg_game/performance.js';
test('Save inside blocked wall respawns safely rather than trapping player',()=>{
 const map=load('maps/school.json');
 const safe=walkableSpawn(map,[0,0]);
 assert.ok(safe);
 assert.equal(map.solid[Math.floor(safe[1])*map.width+Math.floor(safe[0])],0);
 assert.ok(safe[0]>=1&&safe[1]>=1);
});
test('No traversable tile returns explicit error instead of a silent softlock',()=>{
 const map={width:8,height:8,solid:Array(64).fill(1),spawn:[4,4]};
 assert.equal(walkableSpawn(map,[0,0]),null);
});
