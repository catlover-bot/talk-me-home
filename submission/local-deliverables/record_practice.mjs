// Local deterministic Practice recording. All robot actions use ordinary UI confirmation.
// Run only after the root workflow has built the intended follow-up source.
import assert from 'node:assert/strict';
import { chromium, expect } from '@playwright/test';
import { spawn, execFileSync } from 'node:child_process';
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { proposalLabelForRequest } from '../../scripts/qa-mission-player.mjs';

if (process.env.GAME_DISABLE_LIVE !== '1') throw new Error('Explicit GAME_DISABLE_LIVE=1 required.');
const port=4177, origin=`http://127.0.0.1:${port}`;
const output=resolve('.validation/goal-004e-follow-up-media');
const captures=resolve('submission/local-deliverables/screenshots');
await mkdir(output,{recursive:true}); await mkdir(captures,{recursive:true});
const files={};
async function walk(directory){for(const entry of(await readdir(directory,{withFileTypes:true})).sort((a,b)=>a.name.localeCompare(b.name))){const path=join(directory,entry.name);if(entry.isDirectory())await walk(path);else files[path]=createHash('sha256').update(await readFile(path)).digest('hex');}}
await walk('dist');
const report={label:'PRACTICE — deterministic simulation + UI confirmation',commit:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),
  runtimeSha256:createHash('sha256').update(JSON.stringify(files)).digest('hex'),runtimeFiles:files,recordedAt:new Date().toISOString(),
  providerRequests:0,externalRequests:0,webSockets:0,confirmations:[],steps:[],chapters:[],screenshots:[],completed:false};
const server=spawn(process.execPath,['dist/server/server/production.js'],{stdio:['ignore','pipe','pipe'],env:{PATH:process.env.PATH,HOME:process.env.HOME,NODE_ENV:'production',
  GAME_DISABLE_LIVE:'1',GAME_PUBLIC_LIVE_ENABLED:'0',GAME_BIND_ADDRESS:'127.0.0.1',GAME_ORIGIN:origin,PORT:String(port)}});
let browser,context,page,started;
const pause=ms=>new Promise(done=>setTimeout(done,ms));
const elapsed=()=>Math.round(performance.now()-started);
try{
  for(let n=0;n<80;n++){
    if(server.exitCode!==null||server.signalCode!==null)throw new Error('Owned production exited before readiness.');
    try{if((await fetch(origin+'/api/health',{signal:AbortSignal.timeout(500)})).ok)break;}catch{}
    if(n===79)throw new Error('Local production did not become ready');await pause(100);
  }
  browser=await chromium.launch({headless:true,chromiumSandbox:true});
  context=await browser.newContext({viewport:{width:1280,height:720},reducedMotion:'reduce',serviceWorkers:'block',recordVideo:{dir:output,size:{width:1280,height:720}}});
  await context.route('**/*',route=>{const url=new URL(route.request().url());if(url.pathname.endsWith('/voice-token'))report.providerRequests++;if(url.origin!==origin)report.externalRequests++;
    return url.origin!==origin||url.pathname.endsWith('/voice-token')?route.abort():route.continue();});
  await context.routeWebSocket(/.*/,socket=>{report.webSockets++;socket.close();});
  started=performance.now(); page=await context.newPage(); page.setDefaultTimeout(10_000);
  await page.addInitScript(()=>document.addEventListener('DOMContentLoaded',()=>{const badge=document.createElement('div');badge.textContent='PRACTICE — deterministic simulation + deliberate UI confirmation';
    badge.style.cssText='position:fixed;bottom:0;left:0;right:0;padding:4px 12px;background:#24382f;color:#f4efdf;z-index:99999;font:13px sans-serif;pointer-events:none';document.body.append(badge);}));
  const shot=async(name)=>{await page.evaluate(()=>scrollTo(0,0));await page.screenshot({path:join(captures,`${name}.png`),animations:'disabled'});report.screenshots.push({name,atMs:elapsed()});};
  const chapter=async(name)=>{report.chapters.push({name,atMs:elapsed()});await shot(name);};
  const say=async(text,{decision='confirm',capture}={})=>{
    const step={text,startedAtMs:elapsed()};
    await page.getByLabel('Type a message',{exact:true}).fill(text);await pause(550);
    const response=page.waitForResponse(response=>response.url().endsWith('/tools'));
    await page.getByRole('button',{name:'Send message',exact:true}).click();assert.equal((await response).status(),200);
    await expect(page.getByTestId('caption')).not.toHaveText(text);await pause(900);
    const label=proposalLabelForRequest(text);
    if(label){const strip=page.getByTestId('action-proposal');await expect(strip).toHaveAttribute('data-status','awaiting_confirmation');await expect(page.getByTestId('proposal-label')).toHaveText(label);
      const id=await strip.getAttribute('data-proposal-id');
      if(capture){await shot(capture);if(capture==='pending')await strip.screenshot({path:join(captures,'action-strip.png')});}
      await pause(1700);await strip.getByRole('button',{name:decision==='decline'?'Not yet':'Confirm this action',exact:true}).click();
      if(label!=='Confirm the authorized return')await expect(strip).toHaveAttribute('data-status',decision==='decline'?'declined':'committed');
      else await expect(page.getByRole('heading',{name:'You brought Pip home.',exact:true})).toBeVisible();
      if(decision==='confirm')report.confirmations.push({proposalId:id,label,atMs:elapsed()});
      await pause(1600);
    }else await pause(900);
    step.endedAtMs=elapsed();report.steps.push(step);
    return await page.getByTestId('caption').count()?page.getByTestId('caption').innerText():'';
  };
  const relay=async(name)=>{const button=page.getByRole('button',{name:`Relay ${name}`,exact:true});if(await button.getAttribute('aria-pressed')!=='true')await button.click();await expect(page.getByTestId('acknowledged-relay')).toHaveText(name);await pause(800);};
  await page.goto(origin);await pause(2800);await shot('title');
  await page.getByRole('button',{name:'Start Practice',exact:true}).click();
  await expect(page.getByLabel('Type a message',{exact:true})).toBeEnabled();
  await page.getByRole('button',{name:'Presentation layout',exact:true}).click();await pause(1600);
  await say('Look around');await say('Inspect the latch');await chapter('cargo');
  await say('Keep the door open',{decision:'decline',capture:'pending'});await shot('declined');
  await say('Keep the door open');await shot('committed');
  await page.getByRole('button',{name:'Power OFF',exact:true}).click();await expect(page.getByTestId('acknowledged-power')).toHaveText('OFF');await pause(1400);
  await say('Cross to the far side',{capture:'next-proposal'});await say('Where are you?');await chapter('gallery');
  await relay('Beacon');await say('Go through the east gate');await say('Where are you?');
  await page.getByRole('button',{name:'Open transcript history',exact:true}).click();
  const gameEvents=page.locator('.history-message').filter({has:page.locator('strong').filter({hasText:/^Game event$/})});
  if(await gameEvents.count())await gameEvents.last().scrollIntoViewIfNeeded();
  await pause(2000);await shot('history');await page.keyboard.press('Escape');
  await say('Go through the southeast gate');const observation=await say('Inspect the northeast gate');
  if(/Cargo blocks/i.test(observation)){report.galleryRoute='Obstruction reported; backtracked via Fork and upper platform.';await relay('Beacon');await say('Go through the northwest gate');await relay('Harbor');await say('Go through the northeast gate');await say('Inspect the southeast gate');await relay('Beacon');await say('Go through the southeast gate');}
  else{report.galleryRoute='Lower platform route; local northeast inspection reported clear.';await relay('Harbor');await say('Go through the northeast gate');}
  await expect(page.getByRole('heading',{name:'Return Dock',exact:true})).toBeVisible();await say('Look around');await say('Inspect the contact');await chapter('dock');
  await say('Hold the contact');await page.getByRole('button',{name:'Charge',exact:true}).click();await expect(page.getByTestId('dock-energy')).toHaveText('Primed');await pause(1600);
  await page.getByRole('button',{name:'Store',exact:true}).click();await expect(page.getByTestId('dock-energy')).toHaveText('Stored');await pause(1600);
  await say('Release the contact');await say('Board the capsule');await shot('dock-ready');
  await page.getByRole('button',{name:'Authorize return',exact:true}).click();await expect(page.getByTestId('dock-authorization')).toHaveText('Granted');await pause(1600);
  await say('Confirm return');await expect(page.getByRole('heading',{name:'You brought Pip home.',exact:true})).toBeVisible();report.completed=true;await chapter('home');await pause(11000);
  assert.equal(report.providerRequests,0);assert.equal(report.externalRequests,0);assert.equal(report.webSockets,0);
  report.durationMs=elapsed();report.browser=browser.version();
}finally{
  if(context){const video=page?.video();await context.close();if(video)await video.saveAs(join(output,'practice-source.webm'));}
  await browser?.close();
  server.kill('SIGTERM');for(let n=0;n<30&&server.exitCode===null&&server.signalCode===null;n++)await pause(100);
  if(server.exitCode===null&&server.signalCode===null){server.kill('SIGKILL');throw new Error('Local production did not close gracefully');}
  report.cleanup='Owned browser and local production server closed; no external/provider request.';
  await writeFile(join(output,'practice-recording.json'),JSON.stringify(report,null,2)+'\n');
}
console.log(JSON.stringify({completed:report.completed,confirmations:report.confirmations.length,durationMs:report.durationMs,output}));
