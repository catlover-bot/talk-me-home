"""Verify actual preview streams, full decode, captions, sound and transition frames."""
from pathlib import Path
from datetime import datetime,timezone
import array,hashlib,json,math,re,subprocess
ROOT=Path(__file__).resolve().parents[3];OUT=ROOT/'submission/goal-007';PUB=OUT/'preview';WORK=ROOT/'.validation/goal-007-preview'
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
manifest=json.loads((PUB/'preview-manifest.json').read_text());plan=json.loads((PUB/'preview-plan.json').read_text());video=OUT/manifest['output']['path']
assert sha(video)==manifest['output']['sha256']
probe=json.loads(subprocess.check_output(['ffprobe','-v','error','-show_format','-show_streams','-of','json',str(video)]))
v,a=probe['streams'];assert v['codec_type']=='video' and v['codec_name']=='h264' and v['width']==1920 and v['height']==1080 and v['pix_fmt']=='yuv420p' and v['r_frame_rate']=='30/1'
assert a['codec_type']=='audio' and a['codec_name']=='aac' and int(a['sample_rate'])==48000 and a['channels']==2
assert 180<=float(probe['format']['duration'])<=240
assert abs(float(v['duration'])-float(a['duration']))<.06
subprocess.run(['ffmpeg','-nostdin','-hide_banner','-v','error','-i',str(video),'-f','null','-'],check=True)
audio=array.array('h',subprocess.check_output(['ffmpeg','-nostdin','-hide_banner','-v','error','-i',str(video),'-map','0:a:0','-ar','48000','-ac','1','-f','s16le','-']))
peak=max(abs(x) for x in audio);rms=math.sqrt(sum(x*x for x in audio)/len(audio));assert peak>2000 and rms>200
srt=(OUT/'Talk_Me_Home_Goal007_Preview.srt').read_text();blocks=srt.strip().split('\n\n')
spoken=[];cue_rows=[]
def seconds(text):
 h,m,s=text.replace(',','.').split(':');return int(h)*3600+int(m)*60+float(s)
last=0
for block in blocks:
 lines=block.splitlines();start,end=map(seconds,lines[1].split(' --> '));body=' '.join(lines[2:]);assert start>=last-.001 and end>start and body.startswith('Presentation narration: ')
 assert end<=manifest['durationSeconds']+.01
 spoken.append(body.removeprefix('Presentation narration: '));cue_rows.append({'start':start,'end':end,'characters':len(body),'charactersPerSecond':len(body)/(end-start)});last=end
assert ' '.join(spoken)==' '.join(s['narration'] for s in plan['segments'])
review=WORK/'review';review.mkdir(exist_ok=True);frames=[]
for i,item in enumerate(manifest['timeline']):
 fraction=.68 if item['id'] in ('latch','recorder','gallery','dock') else .5
 t=item['startSeconds']+item['durationSeconds']*fraction;path=review/f'{i:02}-{item["id"]}.png'
 subprocess.run(['ffmpeg','-nostdin','-y','-hide_banner','-v','error','-ss',str(t),'-i',str(video),'-frames:v','1',str(path)],check=True)
 frames.append({'section':item['id'],'atSeconds':t,'sha256':sha(path),'file':path.name})
for name,fraction,label in [('route',.15,'obstruction-report'),('dock',.91,'stored-energy'),('return',.95,'confirmed-return')]:
 item=next(x for x in manifest['timeline'] if x['id']==name);t=item['startSeconds']+item['durationSeconds']*fraction;path=review/f'evidence-{label}.png'
 subprocess.run(['ffmpeg','-nostdin','-y','-hide_banner','-v','error','-ss',str(t),'-i',str(video),'-frames:v','1',str(path)],check=True)
 frames.append({'section':label,'atSeconds':t,'sha256':sha(path),'file':path.name})
transitions=[]
for name in ['gallery','recorder','dock','return','home','architecture','availability']:
 item=next(x for x in manifest['timeline'] if x['id']==name)
 for offset,label in [(-.10,'before'),(.10,'after')]:
  t=item['startSeconds']+offset;path=review/f'transition-{name}-{label}.png'
  subprocess.run(['ffmpeg','-nostdin','-y','-hide_banner','-v','error','-ss',str(t),'-i',str(video),'-frames:v','1',str(path)],check=True)
  transitions.append({'section':name,'side':label,'atSeconds':t,'sha256':sha(path),'file':path.name})
receipt={'schemaVersion':1,'status':'DECODE_STREAMS_CAPTIONS_PASS_VISUAL_REVIEW_PENDING','checkedAtUtc':datetime.now(timezone.utc).isoformat(),'sourceCommit':manifest['sourceCommit'],'output':manifest['output'],'durationSeconds':float(probe['format']['duration']),'video':{k:v[k] for k in ['codec_name','width','height','pix_fmt','r_frame_rate','duration']},'audio':{k:a[k] for k in ['codec_name','sample_rate','channels','duration']},'fullDecode':'PASS','avDurationDifferenceSeconds':abs(float(v['duration'])-float(a['duration'])),'audioPeakDbfs':20*math.log10(peak/32768),'audioRmsDbfs':20*math.log10(rms/32768),'clippedDecodedSamples':sum(1 for x in audio if abs(x)>=32767),'subtitleCues':len(blocks),'subtitleWordsMatchNarrationExactly':True,'shortestCueSeconds':min(c['end']-c['start'] for c in cue_rows),'representativeFrames':frames,'transitionFrames':transitions,'historicalProviderAudioUsed':False,'providerTokenRequests':0,'endingAck':'Not applicable to offline Practice'}
receipt.update({'previewOnly':True,'mode':'Current deterministic Practice, typed requests and exact UI confirmations','narration':manifest['narration'],'subtitles':{**manifest['subtitles'],'bytes':(OUT/'Talk_Me_Home_Goal007_Preview.srt').stat().st_size},'practice':manifest['practice'],'gameplayDurationSeconds':manifest['gameplayDurationSeconds'],'gameplayLoops':False,'speedChanges':False,'providerEstimatedUsageUsd':0,'publicHttps':'pending','currentLiveAcceptance':'pending','sourceAvailability':'Private pending historical disclosure','uploadPerformed':False,'eventSubmissionPerformed':False})
review_path=PUB/'visual-review.json'
if review_path.exists():
 recorded_review=json.loads(review_path.read_text())
 if recorded_review['outputSha256']==manifest['output']['sha256'] and recorded_review['subtitleSha256']==manifest['subtitles']['sha256']:
  receipt['status']='LOCAL_PREVIEW_MEDIA_CHECKS_PASS_LIVE_PENDING';receipt['visualReview']=recorded_review
(PUB/'preview-verification.json').write_text(json.dumps(receipt,indent=2)+'\n')
print(json.dumps({k:receipt[k] for k in ['durationSeconds','video','audio','fullDecode','avDurationDifferenceSeconds','audioPeakDbfs','audioRmsDbfs','clippedDecodedSamples','subtitleCues','shortestCueSeconds']},indent=2))
