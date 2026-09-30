from pathlib import Path
import json,wave
root=Path(__file__).resolve().parents[3]
plan=json.loads((root/'submission/goal-007/preview/preview-plan.json').read_text())
total=0
for segment in plan['segments']:
 with wave.open(str(root/'.validation/goal-007-preview/narration-timed-v4'/f"{segment['id']}.wav")) as w:
  segment['narrationSeconds']=w.getnframes()/w.getframerate();segment['durationSeconds']=segment['narrationSeconds']+0.65
  total+=segment['durationSeconds']
print(total)
(root/'.validation/goal-007-preview/timed-plan.json').write_text(json.dumps(plan,indent=2)+'\n')
