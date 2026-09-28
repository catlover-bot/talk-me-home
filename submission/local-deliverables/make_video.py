"""Locally edit labelled historical Live and new Practice media; never calls a provider."""
from pathlib import Path
import json, subprocess, hashlib
from PIL import Image, ImageDraw, ImageFont

ROOT=Path(__file__).resolve().parents[2]
WORK=ROOT/'.validation/goal-004e-follow-up-media'
RENDER=WORK/'rendered-slides'
WORK.mkdir(parents=True,exist_ok=True)
LIVE=ROOT/'.validation/goal-004c-live/2026-09-28T10-24-13-651Z-voice-mission/qa-combined-video.mp4'
PRACTICE=WORK/'practice-source.webm'
record=json.loads((WORK/'practice-recording.json').read_text())
assert record['completed'] and record['providerRequests']==record['externalRequests']==record['webSockets']==0
historical_sha='0d8a672b786ee56f16673016ba9205682a179db547722c3db6fa530f1e743dfe'
assert hashlib.sha256(LIVE.read_bytes()).hexdigest()==historical_sha
SHORT=record['commit'][:7]
FONT='/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf'
BOLD='/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf'
SERIF='/usr/share/fonts/truetype/liberation/LiberationSerif-Regular.ttf'

def run(args): subprocess.run(args,cwd=ROOT,check=True,stdout=subprocess.DEVNULL)
def card(name,kicker,title,lines):
    image=Image.new('RGB',(1280,720),'#24382f');d=ImageDraw.Draw(image)
    d.rectangle((66,58,114,63),fill='#c8a368')
    d.text((66,97),kicker,font=ImageFont.truetype(BOLD,20),fill='#cad5c0')
    d.text((64,185),title,font=ImageFont.truetype(SERIF,54),fill='#f4efdf')
    y=350
    for line in lines:
        d.text((68,y),line,font=ImageFont.truetype(FONT,27),fill='#e4e5d3');y+=54
    d.text((68,666),'TALK ME HOME  /  LOCAL EXPLANATORY DRAFT',font=ImageFont.truetype(FONT,15),fill='#bfcdb7')
    path=WORK/f'{name}.png';image.save(path);return path

live_card=card('real-context','RETAINED REAL TEST — SEPTEMBER 28, 2026','One confirmed action. Not a full rescue.',[
  'Synthetic microphone input + actual provider replies + UI confirmation.',
  'Original digital audio. Historical execution build bb6dfd2.',
  'This excerpt includes the Cargo continuation failure.'])
scope_card=card('mode-transition','MODE AND BUILD CHANGE','Next: offline Practice, newly recorded.',[
  'The real run did not cross Cargo or reach home. Ending ACK was received.',
  f'Next footage uses deterministic typed Practice on build {SHORT}.',
  'Selected moments from one offline mission; no new provider connection.'])
chapters={x['name']:x['atMs']/1000 for x in record['chapters']}
cargo_start=max(0,chapters['cargo']-.5)
dock_start=max(0,chapters['dock']-.5)
def before_confirmation(label,start,maximum):
    boundary=next(item['atMs']/1000 for item in record['confirmations'] if item['label']==label)
    duration=round(min(maximum,boundary-start-.7),3)
    assert duration>1
    return duration
segments=[
  {'name':'title','kind':'still','source':RENDER/'slide-1.png','duration':12,'label':'LOCAL DEMO DRAFT','caption':'Voice-led cooperation, with deliberate on-screen action confirmation.'},
  {'name':'premise','kind':'still','source':RENDER/'slide-2.png','duration':10,'label':'THE GAME PREMISE','caption':'The map is a reference. Pip describes what is nearby.'},
  {'name':'historical-context','kind':'still','source':live_card,'duration':7,'label':None,'caption':None},
  {'name':'real-failed-cargo','kind':'video','source':LIVE,'start':50,'duration':44.6,'audio':True,'label':'RETAINED REAL VOICE | synthetic input + UI confirmation | bb6dfd2 | FAILED CARGO','caption':'Original same-session audio. No full Rescue was completed.'},
  {'name':'mode-transition','kind':'still','source':scope_card,'duration':9,'label':None,'caption':None},
  {'name':'practice-cargo','kind':'video','source':PRACTICE,'start':cargo_start,'duration':before_confirmation('Move to the far-side platform',cargo_start,22),'audio':False,'label':f'NEW PRACTICE | deterministic typed simulation | {SHORT} | OFFLINE','caption':'Cargo Bay: discuss shared Power, inspect the proposal, and choose Confirm or Not yet.'},
  {'name':'practice-gallery','kind':'video','source':PRACTICE,'start':max(0,chapters['gallery']-.5),'duration':22,'audio':False,'label':f'NEW PRACTICE | deterministic typed simulation | {SHORT} | OFFLINE','caption':'Relay Gallery: compare Pip\'s reports with the atlas. Edited selections, not Live continuation.'},
  {'name':'practice-dock','kind':'video','source':PRACTICE,'start':dock_start,'duration':before_confirmation('Confirm the authorized return',dock_start,24),'audio':False,'label':f'NEW PRACTICE | deterministic typed simulation | {SHORT} | OFFLINE','caption':'Return Dock: coordinate contact and stored energy. Human return authorization remains separate.'},
  {'name':'practice-home','kind':'video','source':PRACTICE,'start':max(0,chapters['home']-.5),'duration':10,'audio':False,'label':f'PRACTICE ENDING | same offline mission | {SHORT}','caption':'Server-confirmed Practice home. This is not a real Voice clear.'},
  {'name':'availability','kind':'still','source':RENDER/'slide-6.png','duration':14,'label':'LOCAL EXPLANATORY DRAFT | NO PUBLIC DEMO URL','caption':'Full Live Rescue remains unverified. Upload and event submission are still pending.'},
]
timeline=[];cursor=0
for i,section in enumerate(segments):
    outfile=WORK/f'edit-{i:02d}.mp4'
    args=['ffmpeg','-y','-hide_banner','-loglevel','error']
    if section['kind']=='still':args+=['-loop','1','-i',str(section['source'])]
    else:args+=['-ss',str(section.get('start',0)),'-i',str(section['source'])]
    if not section.get('audio'):args+=['-f','lavfi','-i','anullsrc=r=48000:cl=stereo']
    # A fixed frame surrounds UI footage; labels never replace application captions.
    filters=['scale=1152:648:force_original_aspect_ratio=decrease','pad=1280:720:(ow-iw)/2:(oh-ih)/2:color=0x24382f','setsar=1'] if section['label'] else ['scale=1280:720','setsar=1']
    for field,y,size in [('label',9,17),('caption',693,16)]:
        if section[field]:
            txt=WORK/f'edit-{i:02d}-{field}.txt';txt.write_text(section[field],encoding='utf8')
            filters.append(f'drawtext=fontfile={FONT}:textfile={txt}:fontcolor=0xf4efdf:fontsize={size}:x=(w-tw)/2:y={y}')
    args+=['-t',str(section['duration']),'-vf',','.join(filters),'-map','0:v:0','-map','0:a:0' if section.get('audio') else '1:a:0',
      '-r','30','-fps_mode','cfr','-c:v','libx264','-preset','medium','-crf','20','-pix_fmt','yuv420p','-threads','2',
      '-c:a','aac','-b:a','128k','-ar','48000','-ac','2','-movflags','+faststart',str(outfile)]
    run(args)
    timeline.append({**{k:str(v.relative_to(ROOT)) if isinstance(v,Path) else v for k,v in section.items()},'editedStart':cursor,'editedEnd':round(cursor+section['duration'],3)})
    cursor+=section['duration']
playlist=WORK/'concat.txt';playlist.write_text(''.join(f"file '{WORK/f'edit-{i:02d}.mp4'}'\n" for i in range(len(segments))))
output=ROOT/'submission/Talk_Me_Home_Demo_Draft.mp4'
run(['ffmpeg','-y','-hide_banner','-loglevel','error','-f','concat','-safe','0','-i',str(playlist),'-c','copy','-movflags','+faststart',str(output)])
assert hashlib.sha256(LIVE.read_bytes()).hexdigest()==historical_sha
(WORK/'edit-timeline.json').write_text(json.dumps({'durationTargetSeconds':round(cursor,3),'historicalSourceSha256':historical_sha,'segments':timeline,'audioBoundary':'Retained real excerpt uses its original mixed digital audio. All Practice and explanatory sections use silence; no Pip reply or owner narration was generated or replaced. Cuts distinguish modes/builds. Historical audio/video alignment remains approximate.'},indent=2)+'\n')
print(output)
