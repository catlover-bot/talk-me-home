# Goal 005 local deliverables

The MP4, editable six-slide PPTX and its native PDF are separate Goal 005 outputs. Earlier `Talk_Me_Home_Pitch.pptx`, `Talk_Me_Home_Pitch.pdf` and `Talk_Me_Home_Demo_Draft.mp4` remain byte-identical.

Files: [local demo MP4](../Talk_Me_Home_Goal005_Demo.mp4) (178.021354 seconds, 1920×1080 H.264/AAC), [editable PPTX](../Talk_Me_Home_Goal005_Pitch.pptx), and [six-page PDF](../Talk_Me_Home_Goal005_Pitch.pdf). Exact sizes and hashes are in [media-provenance.json](media-provenance.json).

Final runtime: `2edf7914a008143843923b04a9bf3a1fe41f1f68`, runtime SHA-256 `bf8fe9ef044561064164cf537380559d1a5e92d06f290399d20c472cae6fa401`. Attempt 12 completed Rescue with eleven exact confirmations, actual digital playback, home and an ending ACK. Attempt 13 stalled in the Gallery and had no ACK. There is **one final-candidate pass; the required two-pass target was not met**. All eight Goal 005 slots are consumed. See [the report](../../docs/goal-005-gallery-live-completion.md).

## What the demo shows

The opening Gallery interaction is separately recorded **silent Practice**, with deliberate route marks, exact quote associations, freshness changes and accurately labelled selected requests. The following real footage comes only from **attempt 12**, with synthetic microphone input, real AssemblyAI responses and explicit UI confirmations. Visible cut labels disclose the omitted time. A blocked passage leads to a checked alternative and a backtrack; a later empty response is followed by a fresh check and confirmed home. No other real attempt is spliced into that mission.

Private originals remain under `.validation/goal-004c-live/2026-09-29T11-10-24-116Z-voice-mission/`. The full successful run is retained locally at `.validation/goal-005-media/Goal005_Attempt12_Success_Uncut.mp4`. Its original input and rendered provider PCM are mixed at half gain each. Audio is shifted by **80.2 ms**, estimated from the recorded page-creation interval (half-width 38.5 ms); additional recording delay is unknown. Synchronization is approximate. The original input includes full-scale samples; mixing does not repair their source clipping. No narration, Pip speech or transcript was generated or replaced.

`status.json` controls the deck's result statement. `video-plan.json` pins every input hash and records the cut list, mode and build. `media-provenance.json` records final hashes, stream probes, original-file preservation and inspection. Native slide renders and video frames are inspected locally. Audio receives full decode and sample/waveform checks; no human listening, physical microphone/loudspeaker or enjoyment claim is made.

## Reproduce locally

The existing `.validation/submission-tools` environment provides python-pptx and Pillow. LibreOffice Impress, Poppler and FFmpeg/FFprobe are installed. These recipes use local files only and make no provider calls. Raw recordings and private source renders are required to reproduce the video.

```sh
.validation/submission-tools/bin/python submission/goal-005-deliverables/make_pitch.py
libreoffice -env:UserInstallation=file:///tmp/tmh-goal005-final-impress --headless --convert-to pdf --outdir submission submission/Talk_Me_Home_Goal005_Pitch.pptx
mkdir -p .validation/goal-005-media/final-slides
pdftoppm -scale-to 1920 -png submission/Talk_Me_Home_Goal005_Pitch.pdf .validation/goal-005-media/final-slides/slide
.validation/submission-tools/bin/python submission/goal-005-deliverables/make_video.py
ffprobe -v error -show_format -show_streams -of json submission/Talk_Me_Home_Goal005_Demo.mp4
```

Changing a source requires reviewing its provenance and refreshing its hash before rendering. A mode/build transition is explicit; a home segment requires the same attempt's actual home evidence. The PDF is rendered from the editable PPTX, with original artwork preserved as images. Public URLs remain blank. No upload, deployment, public allowance or event submission was performed.
