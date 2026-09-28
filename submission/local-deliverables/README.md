# Local submission deliverables

This folder contains the editable presentation sources, capture recipe, editing recipe and provenance for a local submission draft. It does not upload, deploy, submit an entry or authorize provider calls.

## Outputs

- `submission/Talk_Me_Home_Pitch.pptx`: six editable 16:9 slides. Headings, body copy, diagrams and shapes are native PowerPoint elements; original artwork and actual game captures remain images.
- `submission/Talk_Me_Home_Pitch.pdf`: rendered from the actual PPTX by LibreOffice Impress, not a separate HTML approximation.
- `submission/Talk_Me_Home_Demo_Draft.mp4`: local, ignored editing draft. Its exact duration, codecs, size and SHA-256 are in `provenance.json`.

Full real Live Rescue remains unverified. Public HTTPS, judge access, uploads and event submission remain pending.

## Reproduction

Use the unchanged game dependencies and a separate local Python environment:

```sh
python3 -m venv .validation/submission-tools
.validation/submission-tools/bin/pip install -r submission/local-deliverables/requirements.txt
```

The deck and video scripts also use locally installed LibreOffice Impress, Poppler (`pdftoppm`) and FFmpeg/FFprobe. These tools run locally. No cloud rendering or paid media service was used. Linux Liberation fonts were used for the recorded render; an editable deck can substitute fonts on another computer.

After the intended production build is already present, record deterministic Practice on the reserved local port 4177:

```sh
GAME_DISABLE_LIVE=1 node submission/local-deliverables/record_practice.mjs
```

This script starts and closes only its own production service and browser. It rejects token endpoints, external requests and WebSockets, uses the ordinary typed Practice UI, and explicitly confirms exact proposed actions. It does not load `.env`, read an allowance, force a Gallery configuration, or operate robot tools directly. Capture provenance and the complete local recording are written under ignored `.validation/goal-004e-follow-up-media/`.

Create and render the native deck:

```sh
.validation/submission-tools/bin/python submission/local-deliverables/make_pitch.py
libreoffice -env:UserInstallation=file:///tmp/tmh-impress-render --headless --convert-to pdf --outdir submission submission/Talk_Me_Home_Pitch.pptx
mkdir -p .validation/goal-004e-follow-up-media/rendered-slides
pdftoppm -scale-to 1280 -png submission/Talk_Me_Home_Pitch.pdf .validation/goal-004e-follow-up-media/rendered-slides/slide
.validation/submission-tools/bin/python submission/local-deliverables/make_video.py
```

After visually inspecting all six final native slide renders and the actual video's mode/chapter transitions, record the receipt with `inspect_outputs.py --visual-review-complete`. The receipt flag records that manual review; it does not replace it.

Do not overwrite preserved historical evidence. The editor verifies the existing real MP4's known SHA-256 before and after reading it. A rerender of the local draft is not another Live test.

## Video evidence boundary

The historical excerpt comes from the real synthetic-input Voice + UI confirmation run on `bb6dfd2`. It retains the pending Latch proposal, exact UI confirmation, later status doubt, crossing request without a movement proposal, and the failed Cargo continuation. Original audio/video alignment is approximate, as recorded in the original media manifest. This excerpt neither proves human speech nor a full Rescue.

An explicit mode/build transition separates that excerpt from newly captured deterministic Practice on the corrected follow-up build. Practice segments show selected moments from one completed offline mission; the ending footage belongs to that same mission. They are labelled throughout and are not presented as a continuous Live clear. Practice and explanatory sections are silent; only the retained Live excerpt contains actual original synthetic input and shipped digital provider output. No owner narration, successful reply, or Pip speech was generated or substituted.

The exact edit decision list is retained in `edit-timeline.json`. Cuts are explanatory editing, not latency measurement or proof of event compliance. Complete original evidence stays unchanged in its original ignored directory.

## Inspection

Final inspection results, six-slide native editability counts, render dimensions, video codecs, representative transition-frame checks and file hashes are recorded in `provenance.json` and the follow-up media receipt. The deck contains source notes. Screenshots retain Practice labels and come from the actual local compiled game.
