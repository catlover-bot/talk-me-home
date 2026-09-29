"""Decode and inspect local outputs, make a public-safe package. No network access."""
from pathlib import Path
import array, hashlib, json, math, shutil, subprocess, wave, zipfile
from PIL import Image, ImageDraw
from pptx import Presentation
from make_media import ROOT, OUT, WORK, ORIGINAL, RAW, SOURCE, EXPECTED, BUILD, PRACTICE, probe, sha, savej, run

video=OUT/'Talk_Me_Home_Submission.mp4'
run(['ffmpeg','-nostdin','-v','error','-i',str(video),'-f','null','-'])
decoded=WORK/'review/final-audio.wav'
run(['ffmpeg','-nostdin','-y','-v','error','-i',str(video),'-vn','-ac','1','-ar','48000','-c:a','pcm_s16le',str(decoded)])
with wave.open(str(decoded)) as w:
 samples=array.array('h',w.readframes(w.getnframes())); rate=w.getframerate()
audio=dict(sampleRate=rate,seconds=len(samples)/rate,peak=max(abs(v) for v in samples),fullScaleSamples=sum(abs(v)>=32767 for v in samples),rms=math.sqrt(sum(v*v for v in samples)/len(samples)))
plot=Image.new('RGB',(1800,260),'#24382f');d=ImageDraw.Draw(plot);step=math.ceil(len(samples)/1800)
for x in range(1800):
 block=samples[x*step:(x+1)*step]
 if block:
  v=max(abs(n) for n in block)/32768*118;d.line((x,130-v,x,130+v),fill='#ccb782')
plot.save(WORK/'review/audio-waveform.png')

plan=json.loads((OUT/'edit-plan.json').read_text());frames=[]
for i,s in enumerate(plan['segments']):
 t=s['outputStart']+min(s['duration']/2,4)
 p=WORK/'review'/f'film-{i:02}.png'
 run(['ffmpeg','-nostdin','-y','-v','error','-ss',str(t),'-i',str(video),'-frames:v','1',str(p)])
 frames.append((p,t))
sheet=Image.new('RGB',(1440,math.ceil(len(frames)/3)*294),'#24382f');d=ImageDraw.Draw(sheet)
for i,(p,t) in enumerate(frames):
 im=Image.open(p);im.thumbnail((470,264));x=(i%3)*480;y=(i//3)*294;sheet.paste(im,(x,y));d.text((x+8,y+270),f'{t:.2f} s | {plan["segments"][i]["kind"]}',fill='white')
sheet.save(WORK/'review/film-contact-sheet.png')

screens=[]
if PRACTICE:
 for source in PRACTICE['screenshots']:
  src=ROOT/source['path'];dst=OUT/'screenshots'/f"practice-{source['name']}.png";shutil.copyfile(src,dst)
  screens.append(dict(path=str(dst.relative_to(OUT)),sha256=sha(dst),mode=PRACTICE['mode'],sourceCommit=source['sourceCommit'],sourceDirty=source['sourceDirty'],runtimeManifestSha256=source.get('runtimeManifestSha256',PRACTICE['runtimeManifestSha256']),source=source['path'],currentGoal006Build=True))
 for name in ('cargo','gallery','dock','home'):
  old=OUT/'screenshots'/f'historical-{name}.png'
  if old.exists():old.unlink() # Exact generated Goal006 paths; originals and TrackA archive remain untouched.
else:
 for name in ('cargo','gallery','dock','home'):
  src=WORK/'review'/f'historical-{name}.png';dst=OUT/'screenshots'/f'historical-{name}.png';shutil.copyfile(src,dst)
  screens.append(dict(path=str(dst.relative_to(OUT)),sha256=sha(dst),mode='Real AssemblyAI Voice; synthetic microphone input',build=BUILD,attempt=12,source='Preserved uncut successful recording',currentGoal006Build=False))
savej(OUT/'screenshots/mode-build-manifest.json',dict(stage='TRACK_B_CURRENT_PRACTICE' if PRACTICE else 'TRACK_A_EXISTING_EVIDENCE_BASELINE',screenshots=screens))

form='''# Talk Me Home

Title: Talk Me Home

Summary: You have the map. Pip has eyes and hands. Share clues, revise your route and confirm each action to bring an AI partner home in a voice-led cooperative rescue.

## Description

Talk Me Home is a cooperative puzzle prototype built around two incomplete views of the same station. You sit at Mission Control with private documents and remote equipment controls. Pip, your AI partner, can observe the space nearby, inspect local objects and propose physical actions. Neither side has enough information alone. Conversation is how you build a shared understanding.

The rescue unfolds across Cargo Bay, Relay Gallery and Return Dock. A shared power supply demands a joint plan. A passage that looks connected on a map may be blocked by cargo, so a useful report can change your route. At the dock, one partner holds a contact while the other stores energy for the return. Every physical proposal still needs an exact human console confirmation; spoken agreement is not an automatic commit.

The video uses edited excerpts from one successful real AssemblyAI run, with synthetic microphone input and original provider speech. It is not a human playtest. Another run on that same build stalled, so repeat-run reliability remains in development. The local package preserves these limits openly.

## Technologies

AssemblyAI Voice Agent API; TypeScript; Node.js 24; React; Vite; browser Web Audio; authoritative in-memory game server; Playwright.

## Availability

Local working prototype and local media package. Public hosting, public repository access, authenticated upload and event submission have not been performed. The creator must verify the current authenticated event form and cutoff before submission.

- Public demo URL: unavailable
- Public repository URL: unavailable (owner access/visibility decision remains separate)
- Uploaded video URL: unavailable
- Pitch deck URL: unavailable (local editable PPTX and native PDF provided)
'''
if PRACTICE:
 form=form.replace('## Technologies','The new gameplay build adds an explicitly selected, optional flight-recorder objective. You can head home directly or visit the archive. A locally observed recorder can be secured only after an exact pickup confirmation, and its shelf item appears only after confirmed home. This mechanic is shown in separately labelled deterministic Practice footage; it has not been demonstrated in a new real Voice run. These are design hypotheses, not measured enjoyment results.\n\n## Technologies')
(OUT/'submission-form.md').write_text(form)
assert len('Talk Me Home')<=50
summary=form.split('Summary: ')[1].split('\n')[0];assert len(summary)<=255
assert len(form.split('## Description')[1].split('## Technologies')[0].split())>=100

readme='''# Talk Me Home — Goal 006 local media

This is the complete Track A package rendered before new gameplay implementation. Its single historical real story is Goal 005 attempt 12 on build `2edf7914a008143843923b04a9bf3a1fe41f1f68`. It reached server-confirmed home with 11 exact confirmations and an ending ACK. Attempt 13 on the same candidate stalled without an ending ACK; the two-pass reliability target was not met. `RELEASE_NOT_LIVE_VERIFIED` remains.

The MP4 retains original player/Pip audio at natural speed. Player microphone input was synthetic. Cuts are visible, all real footage is from one attempt, and no dialogue is generated, rewritten or projected onto another build. The separately authored cards have no narrator track. The selectable English subtitle track and SRT identify Player (synthetic) and Pip; card text is not fabricated speech. Original in-game transcript wording remains unchanged.

The six-slide PPTX uses native editable text, shapes and architecture diagrams, plus actual screenshots and existing original illustration. The PDF is a native LibreOffice export of that PPTX. The cover is an original-product-art composition, not a gameplay screenshot. No music, purchased asset, paid TTS, new provider request or voice cloning was used.

The source's approximate 80.2 ms video/audio alignment is retained. Subtitle starts use captured rendered-audio/synthetic-speech onsets rather than final transcript timestamps; cue splitting is phrase-proportional, not claimed word-level forced alignment. Fixed gain levels the original mix. Existing input clipping cannot be repaired by gain. Full decode, digital sample inspection and visual waveform review do not constitute human listening, physical audio verification or enjoyment measurement.

Local source: `../talk-me-home/.validation/goal-005-media/Goal005_Attempt12_Success_Uncut.mp4`, SHA-256 `d69a0b9a1e793294399e8731cffb7a4c8765772e685510598ff8b7d04e8d4812`. The original source, raw recordings, transcripts, ledgers and earlier media packages are never written by these recipes. `edit-plan.json` lists the actual cuts. Technical review frames and raw diagnostics stay outside the submission zip.

Local reproduction requires the original ignored source and the existing Python Pillow/python-pptx environment, FFmpeg, LibreOffice and Poppler. Run `make_media.py`, native-export the PPTX to PDF, render every page, then `inspect_and_package.py`. Review the actual frames/pages before finalizing the manifest. No network calls are performed by the media recipes.

General platform guidance is provisional: [hackathon guidelines](https://lablab.ai/ai-articles/hackathon-guidelines), [guide](https://lablab.ai/guide). The authenticated event form and its exact cutoff have not been verified. No hosting, upload, visibility change or submission has occurred.
'''
if PRACTICE:
 readme=readme.replace('This is the complete Track A package rendered before new gameplay implementation.','This final package combines the historical real demonstration with a clearly separated new Practice insert. The complete earlier Track A package is preserved locally under `.validation/goal-006-media/baseline-track-a/`; its hashes are in `baseline-track-a-receipt.json`.')
 readme=readme.replace('cue splitting is phrase-proportional, not claimed word-level forced alignment.','original digital-channel activity refines each speech boundary, and balanced phrase splits avoid isolated final words. This is not claimed word-level forced alignment. The edit uses a sample-exact 48 kHz PCM timeline and one final AAC encode, avoiding per-segment encoder-priming accumulation.')
 readme += '\nThe 12-second new insert is actual, silent Practice browser capture: explicit recorder selection, exact local pickup confirmation and the secured-recorder home scene. Historical provider audio never plays underneath it. The four standalone screenshots are current actual Practice screens, with their own source commits, dirty-state evidence and runtime-manifest hash retained in `screenshots/mode-build-manifest.json`. The recorded video snapshot is `'+PRACTICE['build']+'`; its video runtime-manifest SHA-256 is `'+PRACTICE['runtimeManifestSha256']+'`. Later screenshots are not used to relabel that recording. The detailed cut/source record and any subsequent delta are in `practice-source.json`. No new real completion is claimed.\n'
if PRACTICE:
 current=PRACTICE['screenshots'][0]
 readme += '\nCurrent screenshot runtime: source `'+current['sourceCommit']+'`, runtime-manifest SHA-256 `'+current['runtimeManifestSha256']+'`. The later game-source delta changes the Training debrief wrapper only; Rescue retains the same details container and content. The film remains the earlier recorded Practice snapshot. Both captures retain their dirty-source flags.\n'
(OUT/'README.md').write_text(readme)
check='''# Local submission checklist

- [x] Actual H.264/AAC 1080p MP4 below 5 minutes / 300 MB; original-speed gameplay exceeds 60%.
- [x] One historical attempt supplies the complete real story. Synthetic microphone and edits are labelled.
- [x] Natural-speed blocked-passage exchange and its consequence retained; Cargo, Gallery, Dock and home visible.
- [x] Speaker-labelled subtitles follow the edited audio, with selectable MP4 subtitles and a separate SRT.
- [x] Six editable English PPTX slides, native six-page PDF, and rendered-page review.
- [x] 1920×1080 original-product cover and actual screenshots with build/mode manifest.
- [x] Title, summary, long description, technologies and accurate local availability supplied.
- [x] Full video/audio decode and digital mix inspection; no narration or copyrighted music added.
- [x] Public-safe zip excludes secrets, raw paid-run dumps, fonts, dependencies and diagnostic logs.
- [ ] Current Goal 006 Practice insert: added after implementation/capture, never labelled real Voice.
- [ ] Human playtest, physical microphone/speaker evaluation and repeat-run reliability: not claimed.
- [ ] Owner decisions: public hosting/access, authenticated URLs/uploads, precise event cutoff and actual submission.

Baseline package status is Track A. Existing original packages and run records remain preserved. Technical inspection is digital/visual; no human listening is claimed.
'''
if PRACTICE:
 check=check.replace('- [ ] Current Goal 006 Practice insert: added after implementation/capture, never labelled real Voice.','- [x] Current Goal 006 Practice insert: actual capture, explicit mode/build separation, exact pickup and truthful home consequence.')
 check=check.replace('Baseline package status is Track A.','Final package combines historical real Voice with current new-build Practice. The complete Track A baseline remains preserved separately.')
(OUT/'submission-checklist.md').write_text(check)

native=Presentation(OUT/'Talk_Me_Home_Pitch.pptx');assert len(native.slides)==6
pages=subprocess.check_output(['pdfinfo',str(OUT/'Talk_Me_Home_Pitch.pdf')],text=True)
assert 'Pages:           6' in pages
vp=probe(video);assert float(vp['format']['duration'])<300;assert int(vp['format']['size'])<200_000_000
assert plan['actualGameplaySeconds']/plan['durationSeconds']>=.6
assert sha(SOURCE)==EXPECTED
if 'audioAssembly' in plan:
 assert abs(audio['seconds']-plan['durationSeconds'])<=1024/48000
 assert sum(s['audioSamples'] for s in plan['segments'])==round(plan['durationSeconds']*48000)
deliverables=['Talk_Me_Home_Submission.mp4','Talk_Me_Home_Pitch.pptx','Talk_Me_Home_Pitch.pdf','cover-1920x1080.png','submission-form.md','video-subtitles.srt','README.md','submission-checklist.md']
manifest=dict(schemaVersion=1,status='TRACK_A_RENDERED_REVIEWED_BASELINE',historicalSource=dict(path='.validation/goal-005-media/Goal005_Attempt12_Success_Uncut.mp4',sha256=EXPECTED,build=BUILD,attempt=12,remoteEndingAck=True,syntheticMicrophone=True),currentCandidateLiveVerified=False,acceptance='RELEASE_NOT_LIVE_VERIFIED',narrationUsed=False,newProviderRequests=0,video=dict(durationSeconds=float(vp['format']['duration']),bytes=int(vp['format']['size']),width=1920,height=1080,videoCodec='h264',audioCodec='aac',frameRate=30,actualGameplaySeconds=plan['actualGameplaySeconds'],gameplayFraction=plan['actualGameplaySeconds']/plan['durationSeconds']),inspection=dict(fullDecode='PASS',digitalAudio=audio,nativeEditableSlides=6,nativePdfPages=6,renderedSlidePages=6,allSlidePagesVisuallyInspected=True,videoFramesVisuallyInspected=True,humanListening=False,physicalAudioVerified=False,subtitles='Onset-aligned original transcript, phrase split; original approximate synchronization retained'),outputs=[dict(path=f,bytes=(OUT/f).stat().st_size,sha256=sha(OUT/f)) for f in deliverables],screenshots=screens,limitations=['One demonstrated real completion is not the two-pass reliability target.','Attempt13 stalled with no remote ending ACK.','New Goal006 gameplay is not claimed in this historical recording.','Public hosting, upload and submission are separate owner decisions.'])
if PRACTICE:
 review_path=WORK/'review/final-visual-review.json';review=json.loads(review_path.read_text()) if review_path.exists() else {}
 reviewed=all(review.get('sha256',{}).get(f)==sha(OUT/f) for f in ['Talk_Me_Home_Submission.mp4','Talk_Me_Home_Pitch.pptx','Talk_Me_Home_Pitch.pdf','cover-1920x1080.png']) and review.get('allSixSlidesInspected') is True and review.get('practiceTransitionPickupAndHomeInspected') is True
 manifest['status']='FINAL_LOCAL_MEDIA_RENDERED_AND_INSPECTED' if reviewed else 'FINAL_RENDER_REQUIRES_VISUAL_REVIEW'
 manifest['practiceSource']=PRACTICE
 manifest['baselinePreservationReceipt']='baseline-track-a-receipt.json'
 manifest['video'].update(historicalVoiceSeconds=plan['historicalVoiceSeconds'],practiceSeconds=plan['practiceSeconds'])
 manifest['inspection'].update(allSlidePagesVisuallyInspected=reviewed,videoFramesVisuallyInspected=reviewed,subtitles='Original digital-channel speech bounds, balanced phrases, one continuous PCM timeline and one AAC encode; retained approximate source synchronization',audioAssembly=plan['audioAssembly'],visualReview=review)
 manifest['limitations'][2]='New optional recorder and presentation are demonstrated only in deterministic Practice, not new real Voice.'
savej(OUT/'media-manifest.json',manifest)
zipfiles=deliverables+['media-manifest.json','edit-plan.json']+[str(p.relative_to(OUT)) for p in (OUT/'screenshots').iterdir() if p.is_file()]
if PRACTICE:zipfiles+=['practice-source.json','baseline-track-a-receipt.json']
with zipfile.ZipFile(OUT/'Talk_Me_Home_Submission_Package.zip','w',zipfile.ZIP_DEFLATED,compresslevel=6) as z:
 for f in zipfiles:z.write(OUT/f,f)
savej(WORK/'review/technical-inspection.json',dict(video=vp,audio=audio,frameTimes=[t for p,t in frames],zip=dict(bytes=(OUT/'Talk_Me_Home_Submission_Package.zip').stat().st_size,sha256=sha(OUT/'Talk_Me_Home_Submission_Package.zip'),files=zipfiles)))
print(json.dumps(dict(duration=manifest['video']['durationSeconds'],bytes=manifest['video']['bytes'],gameplay=manifest['video']['gameplayFraction'],subtitleCues=len(plan['subtitles']),slides=6,pdfPages=6,zipBytes=(OUT/'Talk_Me_Home_Submission_Package.zip').stat().st_size)))
