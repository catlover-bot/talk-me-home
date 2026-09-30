/** Current Practice-only preview capture. No provider transport, hidden-state route or media upload. */
import { chromium, expect } from '@playwright/test';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { confirmProposalForRequest, confirmVisibleProposal } from '../../../scripts/qa-mission-player.mjs';
const cwd=process.cwd(),work=cwd+'/.validation/goal-007-preview',origin='http://127.0.0.1:5489';
const plan=JSON.parse(await readFile(work+'/timed-plan.json','utf8'));
const compiled=JSON.parse(await readFile('dist/release.json','utf8'));
if(compiled.commit!==plan.sourceCommit)throw new Error('Preview source does not match compiled release.');
await mkdir(work+'/raw',{recursive:true});
const server=spawn(process.execPath,['dist/server/server/production.js'],{cwd,env:{...process.env,PORT:'5489',GAME_ORIGIN:origin,GAME_BIND_ADDRESS:'127.0.0.1',GAME_DISABLE_LIVE:'1',GAME_PUBLIC_LIVE_ENABLED:'0',ASSEMBLYAI_API_KEY:''},stdio:['ignore','pipe','pipe']});
const runId=new Date().toISOString().replaceAll(':','-');let browser,context;const errors=[],receipt={sourceCommit:plan.sourceCommit,mode:'Practice - deterministic simulation',syntheticMicrophone:false,providerTokenRequests:0,viewport:{width:1920,height:1080},segments:[],captionEvents:[],physicalConfirmations:0};
try{
 for(let i=0;i<80;i++){try{if((await fetch(origin+'/api/health')).ok)break;}catch{}await new Promise(r=>setTimeout(r,100));}
 const served=await(await fetch(origin+'/api/version')).json();if(served.commit!==plan.sourceCommit)throw new Error('Served identity mismatch.');
 browser=await chromium.launch({headless:true,chromiumSandbox:true});
 context=await browser.newContext({viewport:receipt.viewport,recordVideo:{dir:work+'/raw',size:receipt.viewport},reducedMotion:'reduce'});
 await context.route(/assemblyai[.]com|[/]voice-token([?]|$)/,async route=>{receipt.providerTokenRequests++;await route.abort('blockedbyclient');});
 const epoch=Date.now(),page=await context.newPage();page.setDefaultTimeout(8000);page.on('pageerror',e=>errors.push(e.message));
 const stamp=()=>Math.round((Date.now()-epoch))/1000;
 const caption=async(speaker,input)=>receipt.captionEvents.push({atSeconds:stamp(),speaker,input,text:await page.getByTestId('caption').innerText()});
 const confirm=async(text)=>{if(text==='Pick up the flight recorder')await confirmVisibleProposal(page,'Secure the flight recorder',text);else await confirmProposalForRequest(page,text);receipt.physicalConfirmations++;if(text==='Confirm return')await expect(page.getByRole('heading',{name:'You brought Pip home.',exact:true})).toBeVisible();else{await expect(page.getByTestId('action-proposal')).toHaveAttribute('data-status','committed');await caption('Game event',text);}};
 const say=async(text,commit=true)=>{receipt.captionEvents.push({atSeconds:stamp(),speaker:'Player - Practice text',text});await page.getByLabel('Type a message').fill(text);const response=page.waitForResponse(r=>r.url().endsWith('/tools'));await page.getByRole('button',{name:'Send message',exact:true}).click();const result=await(await response).json();if(!result.ok)throw new Error('Practice request rejected: '+text);await expect(page.getByTestId('caption')).not.toHaveText(text);await page.waitForTimeout(180);await caption('Pip - Practice text',text);if(result.code==='awaiting_confirmation'&&commit)await confirm(text);return result;};
 const relay=async(name)=>{const b=page.getByRole('button',{name:'Relay '+name,exact:true});if(await b.getAttribute('aria-pressed')!=='true')await b.click();await expect(page.getByTestId('acknowledged-relay')).toHaveText(name);};
 let stageStart,stageDuration;
 const at=async(fraction,action)=>{const remain=stageStart+stageDuration*1000*fraction-Date.now();if(remain>0)await page.waitForTimeout(remain);await action();};
 await page.goto(origin);await page.getByRole('button',{name:'Start Practice',exact:true}).waitFor();
 for(const item of plan.segments.filter(s=>s.kind==='practice')){
  stageStart=Date.now();stageDuration=item.durationSeconds;const segment={id:item.id,startSeconds:stamp(),plannedSeconds:stageDuration};
  if(item.id==='briefing')await at(.45,()=>page.getByRole('checkbox',{name:'Bring back the flight recorder',exact:true}).check());
  if(item.id==='roles'){await at(.05,()=>page.getByRole('button',{name:'Start Practice',exact:true}).click());await at(.19,()=>say('Look around'));}
  if(item.id==='latch'){await at(.30,()=>say('Keep the door open',false));await at(.78,()=>confirm('Keep the door open'));}
  if(item.id==='crossing'){await at(.05,async()=>{await page.getByRole('button',{name:'Power OFF',exact:true}).click();await expect(page.getByTestId('acknowledged-power')).toHaveText('OFF');});await at(.35,()=>say('Cross to the far side',false));await at(.72,()=>confirm('Cross to the far side'));}
  if(item.id==='gallery'){await at(.06,()=>relay('Beacon'));await at(.15,()=>say('Go through the east gate',false));await at(.32,()=>confirm('Go through the east gate'));await at(.50,()=>page.getByRole('button',{name:'Mark planned route on Fork – Leaf',exact:true}).click());await at(.62,()=>page.getByRole('button',{name:'Mark planned route on Leaf – Dock',exact:true}).click());}
  if(item.id==='recorder'){await at(.05,()=>say('Go through the southeast gate'));await at(.25,()=>say('Inspect the flight recorder'));await at(.52,()=>say('Pick up the flight recorder',false));await at(.79,()=>confirm('Pick up the flight recorder'));}
  if(item.id==='route'){await at(.05,()=>say('Inspect the northeast gate'));const report=await page.getByTestId('caption').innerText();receipt.observedBlockedPassage=/blocked|cargo blocks/i.test(report);await at(.31,async()=>{if(receipt.observedBlockedPassage){await page.getByRole('button',{name:'Cross out',exact:true}).click();await page.getByRole('button',{name:'Mark suspected obstruction on Leaf – Dock',exact:true}).click();await relay('Beacon');await say('Go through the northwest gate');await relay('Harbor');await say('Go through the northeast gate');await say('Inspect the southeast gate');await relay('Beacon');await say('Go through the southeast gate');}else{await relay('Harbor');await say('Go through the northeast gate');}});}
  if(item.id==='dock'){await at(.05,()=>say('Look around'));await at(.20,()=>say('Hold the contact',false));await at(.41,()=>confirm('Hold the contact'));await at(.63,async()=>{await page.getByRole('button',{name:'Charge',exact:true}).click();await expect(page.getByTestId('dock-energy')).toHaveText('Primed');});await at(.77,async()=>{await page.getByRole('button',{name:'Store',exact:true}).click();await expect(page.getByTestId('dock-energy')).toHaveText('Stored');});}
  if(item.id==='return'){await at(.03,()=>say('Release the contact'));await at(.21,()=>say('Board the capsule'));await at(.45,async()=>{await page.getByRole('button',{name:'Authorize return',exact:true}).click();await expect(page.getByTestId('dock-authorization')).toHaveText('Granted');});await at(.59,()=>say('Confirm return',false));await at(.84,()=>confirm('Confirm return'));}
  if(item.id==='home'){await expect(page.getByRole('heading',{name:'You brought Pip home.',exact:true})).toBeVisible();await expect(page.locator('.homecoming-recorder')).toHaveCount(1);receipt.confirmedHome=true;receipt.recorderSecuredAtHome=true;}
  const remain=stageStart+stageDuration*1000-Date.now();if(remain>0)await page.waitForTimeout(remain);segment.endSeconds=stamp();segment.durationSeconds=segment.endSeconds-segment.startSeconds;receipt.segments.push(segment);console.log(JSON.stringify({stage:item.id,duration:segment.durationSeconds}));
 }
 if(errors.length||receipt.providerTokenRequests)throw new Error('Preview had a browser error or forbidden provider request.');
 const video=page.video();await context.close();context=undefined;const path=await video.path();receipt.rawVideo={path,sha256:createHash('sha256').update(await readFile(path)).digest('hex')};
 receipt.status='COMPLETE';await writeFile(work+'/capture-'+runId+'.json',JSON.stringify(receipt,null,2)+'\n');await writeFile(work+'/capture-private.json',JSON.stringify(receipt,null,2)+'\n');
 await writeFile('submission/goal-007/preview/practice-caption-events.json',JSON.stringify({sourceCommit:receipt.sourceCommit,mode:receipt.mode,events:receipt.captionEvents},null,2)+'\n');
 console.log(JSON.stringify({completed:true,providerTokenRequests:receipt.providerTokenRequests,confirmations:receipt.physicalConfirmations,blocked:receipt.observedBlockedPassage}));
}catch(error){receipt.status='FAILED_OFFLINE_CAPTURE';receipt.error=String(error);await writeFile(work+'/capture-'+runId+'.json',JSON.stringify(receipt,null,2)+'\n');throw error;}finally{await context?.close();await browser?.close();if(server.exitCode===null){server.kill('SIGTERM');await once(server,'exit');}}
