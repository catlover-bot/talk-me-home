"""Create a local explicit-allowlist Free Practice package; never upload or overwrite."""
from pathlib import Path
from datetime import datetime, timezone
from hashlib import sha256
from zipfile import ZipFile, ZIP_DEFLATED
import json
ROOT=Path(__file__).resolve().parents[3]; OUT=Path(__file__).resolve().parent
TARGET=OUT/'Talk_Me_Home_Free_Practice_Package_v2.zip'; RECEIPT=OUT/'package-manifest-v2.json'
assert not TARGET.exists() and not RECEIPT.exists(), 'Preserve existing package; choose a new version.'
local=['Talk_Me_Home_Free_Practice_v1.mp4','Talk_Me_Home_Free_Practice_v1.srt','Talk_Me_Home_Goal007_Free_Practice_v1.pptx','Talk_Me_Home_Goal007_Free_Practice_v1.pdf','README.md','video-manifest.json','video-verification.json','visual-review.json','deck-verification-v1.json']
entries={name:OUT/name for name in local}
entries['README.md']=OUT/'PACKAGE_README.md'
for name in ['cover-1920x1080.png','current-publication-fields.md','current-publication-fields.json','CREDITS.md','third-party-notices.txt']:
 entries[name]=OUT.parent/name
for name in ['free-hosted-verification.json','hosted-free/entrance-1280.png','hosted-free/collected-home.png','hosted-free/selected-skipped-home.png','hosted-free/voice-unavailable.png']:
 entries['evidence/'+name]=ROOT/'artifacts/goal-007'/name
verified=json.loads((OUT/'video-verification.json').read_text())
assert verified['status']=='LOCAL_FREE_PRACTICE_MEDIA_CHECKS_PASS' and verified['fullDecode']=='PASS'
deck=json.loads((OUT/'deck-verification-v1.json').read_text())
assert isinstance(deck['visualInspection'],dict) and deck['visualInspection']['status']=='PASS'
for row in deck['outputs']:
 assert sha256((ROOT/row['path']).read_bytes()).hexdigest()==row['sha256']
assert sha256((OUT/verified['subtitles']['path']).read_bytes()).hexdigest()==verified['subtitles']['sha256']
files=[]
for name,path in entries.items():
 assert path.is_file() and not path.is_symlink(),name
 content=path.read_bytes(); files.append({'path':name,'bytes':len(content),'sha256':sha256(content).hexdigest()})
movie=next(x for x in files if x['path'].endswith('.mp4'))
assert movie['sha256']==verified['output']['sha256']
status='Public demo: https://talk-me-home.onrender.com\nHosted Practice: PASS, version0.7.0/caa896d.\nPlatform: Other. Repository: https://github.com/catlover-bot/talk-me-home\nFree plan, no disk; cold starts and in-memory progress limitations.\nLive Voice and Live Text unavailable. This is not a real Voice pass.\nMovie: preserved local Practice d22d39a with separate presentation narration; hosted evidence is separately labelled.\nNo upload, deployment or final LABLAB submission performed.\n'
with TARGET.open('xb') as stream:
 with ZipFile(stream,'w',compression=ZIP_DEFLATED) as archive:
  archive.writestr('PUBLICATION_STATUS.txt',status)
  archive.writestr('PACKAGE_CONTENTS.json',json.dumps(files,indent=2)+'\n')
  for name,path in entries.items():archive.write(path,arcname=name)
with ZipFile(TARGET) as archive:
 assert archive.testzip() is None
 assert set(archive.namelist())==set(entries)|{'PUBLICATION_STATUS.txt','PACKAGE_CONTENTS.json'}
 for row in files:assert sha256(archive.read(row['path'])).hexdigest()==row['sha256']
receipt={'schemaVersion':1,'status':'LOCAL_FREE_PRACTICE_PACKAGE_VERIFIED','createdAt':datetime.now(timezone.utc).isoformat(),'zip':{'path':TARGET.name,'bytes':TARGET.stat().st_size,'sha256':sha256(TARGET.read_bytes()).hexdigest()},'entries':len(entries)+2,'members':files,'providerCalls':0,'newPublicApplicationRequests':0,'uploaded':False,'eventSubmitted':False}
with RECEIPT.open('x') as stream:json.dump(receipt,stream,indent=2);stream.write('\n')
print(json.dumps({key:receipt[key] for key in ['status','zip','entries']}))
