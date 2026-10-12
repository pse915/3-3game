const {chromium}=require('playwright');
const assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({channel:'chrome',headless:true});
 const page=await browser.newPage({viewport:{width:1024,height:768},hasTouch:true});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto((process.env.GAME_URL||'http://127.0.0.1:8765')+'/?test&qa-v53');
 for(const [n,stage]of [[12,1],[9,2],[6,3],[0,4]]){
  await page.getByRole('button',{name:'검증 '+n+'/12',exact:true}).click();
  await page.waitForFunction(stage=>JSON.parse(document.querySelector('#qa-v53-status').textContent).stage===stage,stage);
  await page.getByRole('button',{name:'검증 학교',exact:true}).click();
  await page.waitForFunction(()=>__game.map.id==='school');assert.equal(await page.evaluate(()=>__game.mainObjective.kind),'story');
 }
 await page.getByRole('button',{name:'검증 회복',exact:true}).click();
 assert.deepEqual(await page.locator('#qa-v53-status').evaluate(el=>JSON.parse(el.textContent)),{stage:1,first:0,wrong:12,complete:12,policies:12});
 await page.getByRole('button',{name:'검증 저장',exact:true}).click();await page.reload();await page.locator('#continueBtn').click();
 assert.equal(await page.evaluate(()=>__game.quiz.firstAttemptResults.q15),false);
 await page.getByRole('button',{name:'검증 엔딩',exact:true}).click();await page.waitForFunction(()=>document.querySelectorAll('.ending-snapshot').length===4);
 const before=await page.evaluate(()=>JSON.stringify(__game.story.quiz));await page.locator('#quickLanguageBtn').click();
 assert.equal(await page.evaluate(()=>JSON.stringify(__game.story.quiz)),before);assert.equal(await page.locator('.ending-snapshot').count(),4);
 await page.locator('#closeModal').click();await page.locator('#storyBtn').click();assert.equal(await page.locator('#modal').isVisible(),true);
 assert.deepEqual(errors,[]);await browser.close();console.log('v5.3 browser regression passed');
})().catch(e=>{console.error(e);process.exitCode=1;});
