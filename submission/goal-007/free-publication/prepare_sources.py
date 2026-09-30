"""Copy unchanged local narration and verify raw source without replacing any original."""
from pathlib import Path
from hashlib import sha256
import argparse,json,shutil
ROOT=Path(__file__).resolve().parents[3]; OUT=Path(__file__).resolve().parent; WORK=ROOT/'.validation/goal-007-free-media'
parser=argparse.ArgumentParser();parser.add_argument('--source-workspace',required=True);args=parser.parse_args();source=Path(args.source_workspace).resolve()
assert source.name=='goal-007-preview'
plan=json.loads((OUT/'narration-plan.json').read_text());old=json.loads((OUT.parent/'preview/preview-manifest.json').read_text());capture=json.loads((source/'capture-private.json').read_text())
assert plan['sourceCommit']==old['sourceCommit']==capture['sourceCommit']
sha=lambda p:sha256(p.read_bytes()).hexdigest()
raw=Path(capture['rawVideo']['path']);assert sha(raw)==capture['rawVideo']['sha256']==old['practice']['rawSourceSha256']
assert capture['providerTokenRequests']==0 and capture['confirmedHome']
(WORK/'narration').mkdir(parents=True,exist_ok=True)
rows=[]
for segment in plan['segments']:
 previous=next(item for item in old['timeline'] if item['id']==segment['id'])
 if previous['narration']!=segment['narration']:continue
 for ext,hashkey in [('wav','narrationSha256'),('words.json','wordTimingSha256')]:
  name=f"{segment['id']}.{ext}";original=source/'narration-timed-v4'/name;target=WORK/'narration'/name
  assert sha(original)==previous[hashkey]
  if target.exists():assert sha(target)==sha(original)
  else:shutil.copy2(original,target)
  rows.append({'file':name,'sha256':sha(target),'originalVerified':True})
receipt={'status':'PRESERVED_LOCAL_SOURCE_VERIFIED','gameplayCommit':plan['sourceCommit'],'rawSha256':sha(raw),'unchangedNarrationFiles':rows,'newProviderRequests':0,'newPublicApplicationRequests':0}
(WORK/'source-verification.json').write_text(json.dumps(receipt,indent=2)+'\n')
print(json.dumps({'status':receipt['status'],'unchangedNarrationFiles':len(rows),'rawSha256':sha(raw)}))
