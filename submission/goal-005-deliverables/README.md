# Goal 005 local deliverables

These are separate versioned deliverables. Existing `Talk_Me_Home_Pitch.pptx`, `Talk_Me_Home_Pitch.pdf` and `Talk_Me_Home_Demo_Draft.mp4` remain preserved.

The six-slide native draft uses actual Goal 005 Practice screenshots. Every slide identifies the draft and pending live acceptance. Edit `status.json` from the final evidence before generating the final deck; do not turn planned tests into observed passes.

## Local toolchain

The existing `.validation/submission-tools` environment has python-pptx 1.0.2 and Pillow 12.3.0. LibreOffice Impress 24.2.7.2, Poppler 24.02.0 and FFmpeg/FFprobe are available locally. No installation, external rendering or provider call is required.

```sh
.validation/submission-tools/bin/python submission/goal-005-deliverables/make_pitch.py
libreoffice -env:UserInstallation=file:///tmp/tmh-goal005-impress --headless --convert-to pdf --outdir submission submission/Talk_Me_Home_Goal005_Pitch.pptx
mkdir -p .validation/goal-005-media/rendered-slides
pdftoppm -scale-to 1280 -png submission/Talk_Me_Home_Goal005_Pitch.pdf .validation/goal-005-media/rendered-slides/slide
```

The PDF is rendered from the actual editable PPTX. Inspect all six native renders after each substantive edit. Original artwork remains an image; titles, body text, diagrams and labels are editable PowerPoint elements. The private render folder is not a new gameplay capture.

## Video recipe, waiting for actual results

`video-plan.json` contains the story and evidence boundaries. It intentionally has no selected segments yet. `make_video.py` refuses to render until the plan is populated and marked `READY_FOR_LOCAL_RENDER`. The intended output is `submission/Talk_Me_Home_Goal005_Demo.mp4`.

Use original captured video and digital audio from meaningful Goal 005 attempts. Keep one complete successful run locally if one exists. Preserve hashes of every input and record the source build, mode and attempt. A mode/build/attempt transition must be explicitly disclosed; do not join different missions into a fictional continuous clear. Captions and original Pip speech remain untouched. The editor adds labels outside the game frame, normalizes encoding and makes disclosed cuts; it does not synthesize replies or narration.

Source records use `{path,sha256,mode,build,attemptId}`. Modes are `card`, `practice`, `real_voice`, or `real_text`; real Voice labels must explicitly say synthetic input. Segments use `{source,start,duration,audio,label,caption}`. `disclosedTransition:true` is required when changing mission identity. A segment marked `showsHome:true` requires the same source's `serverConfirmedHome:true` and a local `homeEvidencePath`. These are evidence declarations to review, not a substitute for checking the actual run.

```sh
.validation/submission-tools/bin/python submission/goal-005-deliverables/make_video.py
ffprobe -v error -show_format -show_streams -of json submission/Talk_Me_Home_Goal005_Demo.mp4
```

Inspect representative frames around each cut and all mode/chapter transitions, and inspect audio through an audio-capable review path if available. Record unperformed listening honestly. Hashes and a nonzero waveform are not human listening or physical microphone/loudspeaker evidence. If no final Live clear exists, show a truthful prototype and actual stopping point. Public URLs remain blank. No upload, deployment or event submission is performed by these recipes.
