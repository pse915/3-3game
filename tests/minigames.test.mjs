import test from 'node:test';
import assert from 'node:assert/strict';
import {budgetScore,patternScore,runHandsOn} from '../components/rpg_game/minigames.js';
// Minimal DOM surface for deterministic interaction tests; browser rendering is tested separately.
class Element{
 constructor(tag){this.tagName=tag;this.children=[];this.dataset={};this.style={};this.attributes={};}
 append(...nodes){this.children.push(...nodes);}
 setAttribute(k,v){this.attributes[k]=v;}
 querySelectorAll(selector){const tags=selector.split(',');return this.children.flatMap(c=>[...(tags.includes(c.tagName)?[c]:[]),...c.querySelectorAll(selector)]);}
}
function board(type){globalThis.document={createElement:tag=>new Element(tag)};const host=new Element('div'),scores=[];const root=runHandsOn(host,type,s=>scores.push(s));const find=id=>{const all=root.querySelectorAll('button,input');return all.find(e=>e.dataset.testid===`mini-${type}-${id}`);};return {root,scores,click:id=>{const b=find(id);assert.ok(b,id);b.onclick();},input:(id,value)=>{const e=find(id);e.value=String(value);e.oninput();}};}
test('budget remains affordable and balances three concrete allocations',()=>{assert.equal(budgetScore([20,10,15]),3);assert.equal(budgetScore([50,15,15]),0);assert.equal(budgetScore([20,0,0]),1);const b=board('budget');b.input('value-0',50);b.input('value-1',15);b.input('value-2',15);b.click('finish');assert.deepEqual(b.scores,[]);b.input('value-0',20);b.click('finish');assert.deepEqual(b.scores,[3]);});
test('recipe hands-on order and allergen restriction affect work result',()=>{const b=board('recipe');for(const id of ['cup','water','tea','finish'])b.click(id);assert.deepEqual(b.scores,[3]);b.click('finish');assert.equal(b.scores.length,1);const bad=board('recipe');for(const id of ['cup','water','tea','milk','finish'])bad.click(id);assert.deepEqual(bad.scores,[0]);});
test('code requires execution; wall collisions and corrected movement produce different feedback',()=>{const b=board('sequence');b.click('finish');assert.deepEqual(b.scores,[]);b.click('right');b.click('run');b.click('finish');assert.deepEqual(b.scores,[0]);const fixed=board('sequence');for(const id of ['down','down','right','right','run','finish'])fixed.click(id);assert.deepEqual(fixed.scores,[3]);});
test('route disallows teleports and walks around the construction barrier',()=>{const b=board('route');b.click('cell-24');b.click('finish');assert.deepEqual(b.scores,[]);for(const i of [5,10,15,20,21,22,23,24])b.click('cell-'+i);b.click('finish');assert.deepEqual(b.scores,[3]);});
test('schedule, diagnosis and lesson require completed assignments before submission',()=>{for(const type of ['schedule','diagnosis','lesson']){const b=board(type);b.click('finish');assert.deepEqual(b.scores,[]);for(let i=0;i<3;i++){b.click((type==='schedule'?'card-':'tool-')+i);b.click((type==='schedule'?'slot-':'need-')+i);}b.click('finish');assert.deepEqual(b.scores,[3],type);}});
test('pixel design is created by painting cells, and incomplete rows reduce feedback',()=>{const target=[1,2,1,2,3,2,1,2,1];assert.equal(patternScore(target,target),3);assert.equal(patternScore([0,2,1,2,3,2,1,2,1],target),2);const b=board('pattern');for(let color=1;color<=3;color++){b.click('color-'+color);target.forEach((v,i)=>{if(v===color)b.click('cell-'+i);});}b.click('finish');assert.deepEqual(b.scores,[3]);});
