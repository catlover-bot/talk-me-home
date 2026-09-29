"""Local Goal 005 editor. Requires a reviewed, hash-pinned edit list; never runs a game/provider."""
from pathlib import Path
import hashlib, json, subprocess

ROOT = Path(__file__).resolve().parents[2]
PLAN = json.loads((Path(__file__).parent / 'video-plan.json').read_text())
WORK = ROOT / '.validation/goal-005-media/edit'
OUTPUT = ROOT / 'submission/Talk_Me_Home_Goal005_Demo.mp4'
FONT = '/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf'

def sha(p): return hashlib.sha256(p.read_bytes()).hexdigest()
def run(args): subprocess.run(args, cwd=ROOT, check=True, stdout=subprocess.DEVNULL)
def local_path(value):
    p = (ROOT / value).resolve()
    if not p.is_relative_to(ROOT) or not p.is_file(): raise ValueError('Media inputs must be existing files inside this workspace.')
    return p

if PLAN['status'] != 'READY_FOR_LOCAL_RENDER' or not PLAN['segments']:
    raise SystemExit('No video rendered: select actual sources and reviewed cuts after the result, then set READY_FOR_LOCAL_RENDER.')
assert PLAN['output'] == str(OUTPUT.relative_to(ROOT))
sources = {}
for key, value in PLAN['sources'].items():
    p = local_path(value['path'])
    assert sha(p) == value['sha256'], f'Changed input: {key}'
    assert value['mode'] in ('card', 'practice', 'real_voice', 'real_text')
    if value['mode'] != 'card': assert value['build'] and value['attemptId']
    sources[key] = p
WORK.mkdir(parents=True, exist_ok=True)
timeline = []; cursor = 0; prior = None
for index, segment in enumerate(PLAN['segments']):
    definition = PLAN['sources'][segment['source']]; source = sources[segment['source']]
    mode = definition['mode']; duration = float(segment['duration']); start = float(segment.get('start', 0))
    assert 0 < duration <= 180 and start >= 0
    assert segment.get('label') and segment.get('caption')
    if mode != 'card':
        identity = (mode, definition['build'], definition['attemptId'])
        if prior and prior != identity: assert segment.get('disclosedTransition') is True
        prior = identity
    if mode == 'real_voice':
        assert segment.get('audio') is True
        assert 'SYNTHETIC' in segment['label'] and 'VOICE' in segment['label']
    if mode == 'practice': assert 'PRACTICE' in segment['label']
    if mode == 'real_text': assert 'TEXT' in segment['label']
    if segment.get('showsHome'):
        assert definition.get('serverConfirmedHome') is True and definition.get('homeEvidencePath')
        local_path(definition['homeEvidencePath'])
    outfile = WORK / f'segment-{index:02d}.mp4'
    args = ['ffmpeg', '-nostdin', '-y', '-hide_banner', '-loglevel', 'error']
    args += ['-loop', '1', '-i', str(source)] if mode == 'card' else ['-ss', str(start), '-i', str(source)]
    if not segment.get('audio'): args += ['-f', 'lavfi', '-i', 'anullsrc=r=48000:cl=stereo']
    filters = ['scale=1840:1000:force_original_aspect_ratio=decrease', 'pad=1920:1080:(ow-iw)/2:(oh-ih)/2:color=0x24382f', 'setsar=1']
    for field, y, size in [('label', 10, 24), ('caption', 1044, 22)]:
        content = segment[field]; assert '\n' not in content and len(content) <= 145
        txt = WORK / f'segment-{index:02d}-{field}.txt'; txt.write_text(content, encoding='utf-8')
        filters.append(f'drawtext=fontfile={FONT}:textfile={txt}:fontcolor=0xf4efdf:fontsize={size}:x=(w-tw)/2:y={y}')
    if segment.get('audio'): args += ['-af', 'apad']
    args += ['-t', str(duration), '-vf', ','.join(filters), '-map', '0:v:0', '-map', '0:a:0' if segment.get('audio') else '1:a:0', '-r', '30', '-fps_mode', 'cfr', '-c:v', 'libx264', '-preset', 'medium', '-crf', '20', '-pix_fmt', 'yuv420p', '-threads', '2', '-c:a', 'aac', '-b:a', '128k', '-ar', '48000', '-ac', '2', '-movflags', '+faststart', str(outfile)]
    run(args)
    timeline.append({**segment, 'editedStart': cursor, 'editedEnd': cursor+duration}); cursor += duration
playlist = WORK / 'concat.txt'
playlist.write_text(''.join(f"file '{WORK / f'segment-{index:02d}.mp4'}'\n" for index in range(len(timeline))))
run(['ffmpeg', '-nostdin', '-y', '-hide_banner', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', str(playlist), '-c', 'copy', '-movflags', '+faststart', str(OUTPUT)])
for key, source in sources.items(): assert sha(source) == PLAN['sources'][key]['sha256']
receipt = {'status': 'RENDERED_REQUIRES_INSPECTION', 'output': {'path': str(OUTPUT.relative_to(ROOT)), 'bytes': OUTPUT.stat().st_size, 'sha256': sha(OUTPUT)}, 'sources': PLAN['sources'], 'segments': timeline, 'durationTargetSeconds': cursor, 'audioBoundary': 'Only original selected source audio. Silent cards/Practice unless explicitly captured otherwise. No speech generated or replaced. Source synchronization limitations remain.'}
(WORK / 'edit-receipt.json').write_text(json.dumps(receipt, indent=2)+'\n')
print(OUTPUT)
