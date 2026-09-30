"""Render a truthful Practice preview. No provider access or historical media substitution."""
from pathlib import Path
from datetime import datetime,timezone
import argparse,hashlib,json,math,re,subprocess,textwrap,wave
ROOT=Path(__file__).resolve().parents[3];OUT=ROOT/'submission/goal-007/free-publication';PUB=OUT;WORK=ROOT/'.validation/goal-007-free-media'
parser=argparse.ArgumentParser();parser.add_argument('--source-workspace',required=True);args=parser.parse_args();ORIGINAL=Path(args.source_workspace).resolve()
assert ORIGINAL.name=='goal-007-preview' and ORIGINAL.is_dir()
FONT='/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf';BOLD='/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf'
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
def save(p,v):p.write_text(json.dumps(v,indent=2,ensure_ascii=False)+'\n')
def run(args):subprocess.run(args,check=True,stdout=subprocess.DEVNULL)
def probe(p):return json.loads(subprocess.check_output(['ffprobe','-v','error','-show_format','-show_streams','-of','json',str(p)]))
plan=json.loads((OUT/'narration-plan.json').read_text());capture=json.loads((ORIGINAL/'capture-private.json').read_text())
raw=Path(capture['rawVideo']['path']);assert sha(raw)==capture['rawVideo']['sha256']
assert capture['sourceCommit']==plan['sourceCommit'] and capture['providerTokenRequests']==0
assert capture['confirmedHome'] and capture['recorderSecuredAtHome']
(WORK/'edit').mkdir(exist_ok=True)
for target in ['Talk_Me_Home_Free_Practice_v1.mp4','Talk_Me_Home_Free_Practice_v1.srt','video-manifest.json']:
 assert not (OUT/target).exists(),f'Preserve existing output: {target}'
for page in [5,6]:assert (OUT/'renders'/f'slide-{page:02}.png').is_file(),'Render the new deck cards first.'
timeline=[];cues=[];cursor=0.;pcm=bytearray();source_notes=[]

def subtitle_time(t):
 ms=round(t*1000);h,ms=divmod(ms,3600000);m,ms=divmod(ms,60000);s,ms=divmod(ms,1000)
 return f'{h:02}:{m:02}:{s:02},{ms:03}'

def phrase_cues(item,start,duration):
 text=item['narration'];marks=json.loads((WORK/'narration'/f"{item['id']}.words.json").read_text())
 assert marks and marks[0]['start']==0
 chunks=[];begin=0
 for k,mark in enumerate(marks):
  next_pos=marks[k+1]['start'] if k+1<len(marks) else len(text)
  candidate=text[marks[begin]['start']:next_pos].strip()
  if len(candidate)>=85 or (len(candidate)>=44 and re.search(r'[.!?]$',candidate)) or k+1==len(marks):
   end_seconds=marks[k+1]['seconds'] if k+1<len(marks) else duration-.04
   chunks.append({'start':start+marks[begin]['seconds'],'end':start+end_seconds,'text':'Presentation narration: '+candidate});begin=k+1
 assert ' '.join(c['text'].removeprefix('Presentation narration: ') for c in chunks)==text
 return chunks

for i,item in enumerate(plan['segments']):
 narr=WORK/'narration'/f"{item['id']}.wav"
 with wave.open(str(narr)) as w:narr_seconds=w.getnframes()/w.getframerate()
 # Updated presentation narration never changes the normal-speed gameplay interval.
 item['narrationSeconds']=narr_seconds
 if item['kind']=='practice':
  recorded=next(s for s in capture['segments'] if s['id']==item['id']);start=recorded['startSeconds'];duration=recorded['durationSeconds'];inputs=['-ss',str(start),'-i',str(raw)]
  source={'id':'preserved-local-practice-d22d39a','sha256':sha(raw),'startSeconds':start,'endSeconds':recorded['endSeconds']}
 else:
  page=5 if item['id']=='architecture' else 6;card=OUT/'renders'/f'slide-{page:02}.png';duration=max(item['durationSeconds'],narr_seconds+.6);inputs=['-loop','1','-i',str(card)]
  source={'id':f'editable-deck-page-{page}','sha256':sha(card),'sourceDeckSha256':sha(OUT/'Talk_Me_Home_Goal007_Free_Practice_v1.pptx')}
 duration=math.ceil(duration*30)/30;assert duration>=narr_seconds+.4
 mode=WORK/'edit'/f'{i:02}-mode.txt';chapter=WORK/'edit'/f'{i:02}-chapter.txt'
 mode.write_text('RECORDED LOCAL PRACTICE  |  SIMULATION  |  SOURCE d22d39a' if item['kind']=='practice' else 'PUBLIC PRACTICE VERIFIED  |  caa896d  |  LIVE VOICE UNAVAILABLE')
 chapter.write_text(item['chapter'])
 vf=f"setpts=PTS-STARTPTS,fps=30,scale=1600:900:flags=lanczos,setsar=1,pad=1920:1080:160:70:color=0x182C24,drawtext=fontfile={BOLD}:textfile={mode}:fontcolor=0xF4EFE2:fontsize=23:x=90:y=12,drawtext=fontfile={FONT}:textfile={chapter}:fontcolor=0xC7D4BE:fontsize=20:x=90:y=43,drawtext=fontfile={BOLD}:text='PRESENTATION NARRATION':fontcolor=0xC7D4BE:fontsize=18:x=1430:y=16"
 segment=WORK/'edit'/f'{i:02}-{item["id"]}.mp4'
 run(['ffmpeg','-nostdin','-y','-hide_banner','-loglevel','error',*inputs,'-t',str(duration),'-an','-vf',vf,'-r','30','-frames:v',str(round(duration*30)),'-c:v','libx264','-threads','2','-preset','veryfast','-crf','20','-pix_fmt','yuv420p',str(segment)])
 voice=subprocess.check_output(['ffmpeg','-nostdin','-hide_banner','-loglevel','error','-i',str(narr),'-f','s16le','-ac','1','-ar','48000','-'])
 lead=round(.20*48000)*2;length=round(duration*48000)*2;assert len(voice)+lead<=length
 pcm+=bytes(lead)+voice+bytes(length-lead-len(voice))
 cues+=phrase_cues(item,cursor+.20,narr_seconds)
 timeline.append({'id':item['id'],'kind':item['kind'],'startSeconds':cursor,'durationSeconds':duration,'endSeconds':cursor+duration,'source':source,'narrationSha256':sha(narr),'wordTimingSha256':sha(WORK/'narration'/f"{item['id']}.words.json"),'narration':item['narration']})
 cursor+=duration;print(json.dumps({'rendered':item['id'],'duration':duration}),flush=True)
assert 180<=cursor<=240
for i,cue in enumerate(cues):
 assert cue['end']>cue['start'] and cue['end']<=cursor
 if i:assert cue['start']>=cues[i-1]['end']-.001
srt='\n\n'.join(f"{i}\n{subtitle_time(c['start'])} --> {subtitle_time(c['end'])}\n"+'\n'.join(textwrap.wrap(c['text'],width=104,break_long_words=False,break_on_hyphens=False)) for i,c in enumerate(cues,1))+'\n'
(OUT/'Talk_Me_Home_Free_Practice_v1.srt').write_text(srt)
with wave.open(str(WORK/'presentation-narration.wav'),'wb') as w:w.setnchannels(1);w.setsampwidth(2);w.setframerate(48000);w.writeframes(pcm)
concat=WORK/'edit/segments.txt';concat.write_text(''.join(f"file '{(WORK/'edit'/f'{i:02}-{item["id"]}.mp4').as_posix()}'\n" for i,item in enumerate(plan['segments'])))
joined=WORK/'edit/joined-video.mp4';run(['ffmpeg','-nostdin','-y','-hide_banner','-loglevel','error','-f','concat','-safe','0','-i',str(concat),'-c','copy',str(joined)])
output=OUT/'Talk_Me_Home_Free_Practice_v1.mp4'
# Explicit 1920x1080 ASS coordinates keep readable subtitles below the full UI frame.
ass_header='''[Script Info]
ScriptType: v4.00+
PlayResX: 1920
PlayResY: 1080
WrapStyle: 0
[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Narration,Liberation Sans,31,&H00E2EFF4,&H00E2EFF4,&H00242C18,&H00242C18,0,0,0,0,100,100,0,0,1,0.5,0,2,90,90,21,1
[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
'''
def ass_time(value):
 h=int(value//3600);m=int(value//60)%60;s=value%60
 return f'{h}:{m:02}:{s:05.2f}'
ass_path=WORK/'presentation-subtitles.ass'
ass_lines=[]
for cue in cues:
 body=r'\N'.join(textwrap.wrap(cue['text'],width=100,break_long_words=False,break_on_hyphens=False))
 ass_lines.append(f"Dialogue: 0,{ass_time(cue['start'])},{ass_time(cue['end'])},Narration,,0,0,0,,{body}")
ass_path.write_text(ass_header+'\n'.join(ass_lines)+'\n')
# Only the separately identified presentation narration is mixed; Practice source is silent.
run(['ffmpeg','-nostdin','-y','-hide_banner','-loglevel','error','-i',str(joined),'-i',str(WORK/'presentation-narration.wav'),'-vf',f'ass={ass_path}','-map','0:v:0','-map','1:a:0','-c:v','libx264','-threads','2','-preset','veryfast','-crf','20','-pix_fmt','yuv420p','-c:a','aac','-b:a','160k','-ac','2','-ar','48000','-t',str(cursor),'-movflags','+faststart',str(output)])
manifest={'schemaVersion':1,'status':'LOCAL_PRACTICE_FILM_WITH_VERIFIED_HOSTED_STATUS','sourceCommit':plan['sourceCommit'],'generatedAtUtc':datetime.now(timezone.utc).isoformat(),'output':{'path':output.name,'bytes':output.stat().st_size,'sha256':sha(output)},'subtitles':{'path':'Talk_Me_Home_Free_Practice_v1.srt','sha256':sha(OUT/'Talk_Me_Home_Free_Practice_v1.srt'),'cues':len(cues),'timing':'Actual local synthesis word events','speaker':'Presentation narration; never Pip or provider speech'},'durationSeconds':cursor,'dimensions':[1920,1080],'providerTokenRequests':0,'practice':{'rawSourceSha256':sha(raw),'rawOriginalRetainedPrivately':True,'confirmedHome':capture['confirmedHome'],'recorderSecuredAtHome':capture['recorderSecuredAtHome'],'observedBlockedPassage':capture['observedBlockedPassage'],'physicalConfirmations':capture['physicalConfirmations']},'narration':{**plan['narration'],'assembledPcmSha256':sha(WORK/'presentation-narration.wav'),'audioSource':'Local Windows synthesis only; no historical or provider audio'},'timeline':timeline,'preservedLocalPracticeSourceUsed':True,'historicalLiveMediaUsed':False,'speedChanges':False,'gameplayLoops':False,'gameplayDurationSeconds':sum(s['durationSeconds'] for s in timeline if s['kind']=='practice'),'endingAck':'Not applicable: offline Practice has no provider session','publicHttps':'https://talk-me-home.onrender.com','hostedCommit':plan['hostedCommit'],'hostedPractice':'PASS; separately observed using fresh browsers','currentLiveAcceptance':'Not performed; disabled in public service','sourceAvailability':'Public GitHub repository observed','newProviderRequests':0,'newPublicApplicationRequests':0,'uploaded':False}
save(PUB/'video-manifest.json',manifest);save(WORK/'output-probe.json',probe(output));print(json.dumps({'output':str(output),'duration':cursor,'bytes':output.stat().st_size,'sha256':sha(output),'subtitleCues':len(cues)}),flush=True)
