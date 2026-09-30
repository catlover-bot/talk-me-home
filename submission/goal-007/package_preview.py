"""Package only explicit local preview deliverables; never publish or replace a ZIP."""
from datetime import datetime, timezone
from hashlib import sha256
import json
from pathlib import Path
from zipfile import ZipFile, ZIP_DEFLATED

root = Path(__file__).resolve().parent
output = root / 'Talk_Me_Home_Goal007_Preview_Package_v1.zip'
receipt = root / 'preview-package-manifest.json'
members = [
    'Talk_Me_Home_Goal007_Preview.mp4',
    'Talk_Me_Home_Goal007_Preview.srt',
    'Talk_Me_Home_Goal007_Deck.pptx',
    'Talk_Me_Home_Goal007_Deck.pdf',
    'cover-1920x1080.png',
    'screenshots/practice-cargo.png',
    'screenshots/practice-gallery.png',
    'screenshots/practice-dock.png',
    'screenshots/practice-home.png',
    'submission-form.md',
    'submission-form.json',
    'README.md',
    'media-components-manifest.json',
    'preview/preview-verification.json',
    'CREDITS.md',
    'third-party-notices.txt',
]
status = (
    'TALK ME HOME - LOCAL GOAL 007 PREVIEW\n\n'
    'This package contains current deterministic Practice gameplay and separately '
    'labelled local presentation narration. It is not current real AssemblyAI '
    'acceptance, human speech, physical playback or enjoyment evidence.\n\n'
    'Public HTTPS, the current hosted Voice acceptance pair, protected reviewer '
    'enablement, public source access and final release media remain pending. '
    'No URL, upload or event submission is asserted.\n\n'
    'The versioned preview ZIP and historical Goal 005/006 media are preserved; '
    'a later final release must use a different output name.\n'
)
if output.exists() or receipt.exists():
    raise SystemExit('Preserve the existing preview package and manifest; choose a new version explicitly.')
files = []
for name in members:
    source = root / name
    if not source.is_file() or source.is_symlink():
        raise SystemExit(f'Missing regular deliverable: {name}')
    content = source.read_bytes()
    files.append({'path': name, 'bytes': len(content), 'sha256': sha256(content).hexdigest()})
with output.open('xb') as stream:
    with ZipFile(stream, 'w', compression=ZIP_DEFLATED) as archive:
        archive.writestr('PREVIEW_STATUS.txt', status)
        archive.writestr('PACKAGE_CONTENTS.json', json.dumps(files, indent=2) + '\n')
        for name in members:
            archive.write(root / name, arcname=name)
with ZipFile(output) as archive:
    assert archive.testzip() is None
    assert set(archive.namelist()) == set(members + ['PREVIEW_STATUS.txt', 'PACKAGE_CONTENTS.json'])
    for item in files:
        assert sha256(archive.read(item['path'])).hexdigest() == item['sha256']
result = {
    'schemaVersion': 1, 'status': 'LOCAL_PREVIEW_PACKAGE_VERIFIED_PENDING_RELEASE',
    'createdAt': datetime.now(timezone.utc).isoformat(),
    'zip': {'path': output.name, 'bytes': output.stat().st_size, 'sha256': sha256(output.read_bytes()).hexdigest()},
    'entries': len(members) + 2, 'members': files,
    'providerCalls': 0, 'uploaded': False, 'eventSubmitted': False,
    'boundary': status,
}
with receipt.open('x', encoding='utf-8') as stream:
    json.dump(result, stream, indent=2)
    stream.write('\n')
print(json.dumps({'status': result['status'], 'zip': result['zip'], 'entries': result['entries']}))
