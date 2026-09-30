# Talk Me Home - Goal 007 local components

Status: **WORKING_LOCAL_COMPONENTS_PENDING_RELEASE_EVIDENCE**.

This directory contains a real, editable six-slide deck, its native LibreOffice PDF, the unchanged original cover, four current Practice screenshots, checked English form copy and a reusable video edit recipe. It is a working set for the release, not a substituted final release or submitted event form.

| Component | File |
| --- | --- |
| Editable six-slide deck | `Talk_Me_Home_Goal007_Deck.pptx` |
| Native LibreOffice PDF | `Talk_Me_Home_Goal007_Deck.pdf` |
| Original unchanged cover | `cover-1920x1080.png` |
| Four current screenshots | `screenshots/practice-{cargo,gallery,dock,home}.png` |
| English form copy | `submission-form.md` and structured `submission-form.json` |
| Reusable edit recipe | `video-edit-recipe.json` |
| Hashes, sizes and provenance | `media-components-manifest.json` |

All screenshots are actual 1920x1080 deterministic Practice captures. They show Cargo's exact pending Latch proposal, a manually marked Gallery route, the acknowledged Dock transfer and confirmed home with the optional flight recorder. They do not represent real Voice, microphone or human play evidence. The UI source is `66f1bd206057720275fc9d56a6c9fbe72e409bcd`, captured from documentation head `d9ee08bb13df9b45ea8bb15c51c0f7d2975af07d`; the source and compiled identities are recorded in `screenshots/capture-provenance.json`. These captures precede final hosted admission integration and must be compared with the final integrated UI before release.

The six slides use editable native titles, body text, architecture shapes and image crops. Full PNG originals remain separately available. The original cover is copied byte-for-byte from Goal 006, SHA256 `38aa0826a78448c03c99bf717d44817b5aa57b3133071ff05ff6bf0df740ec91`. The cover is an illustration, not footage of a rescue.

Every PDF page and all four screenshots were inspected. Review corrected architecture text overflow, availability spacing and the Cargo crop. The deck and form explicitly say public HTTPS and current Live acceptance are pending; source remains Private pending historical disclosure. No public URL has been invented. The form satisfies title 5-50 characters, summary 50-255, description 600-2000 plus at least 100 words, and additional information at most 2000 characters.

The capture reached all three chapters and confirmed recorder home, with Live disabled and zero token/provider requests. Its 18.84-second silent browser original is retained privately under the ignored `.validation/goal-007-media/` directory and identified by hash in the public provenance. Two earlier offline capture-helper runs reached home but failed an obsolete post-return proposal-strip assertion; their originals remain private and unchanged. The helper was corrected because debrief replaces the proposal strip. These are offline capture errors, not funded attempts or Live failures.

No final MP4 is produced by this component task. `video-edit-recipe.json` requires a preserved current-candidate Voice original and actual outcome/ending evidence before final editing. Any use of the silent Practice insert must be separately labelled. Historical Goal 005 Voice audio cannot be placed beneath current Practice screenshots. Goal 006 MP4/PPTX/PDF/ZIP and its recipes, and the Goal 005 original success, are checked against their preserved hashes and remain untouched.

## Reproduction and final update

1. Use the existing submission-tools Python environment to run `make_deck.py`. It verifies the copied cover and all screenshot hashes before producing six slides.
2. Export the resulting PPTX through native LibreOffice Impress, with a task-specific profile, to produce the PDF. The inspected export uses `libreoffice --headless --convert-to pdf`; it is not a raster approximation.
3. Render all six pages with `pdftoppm` into ignored `.validation/goal-007-media/review/`, then visually inspect them.
4. Run `validate_components.py` with the same Python environment. It checks form lengths, six native PDF pages, editable slide text, image sizes, the private Practice source and read-only historical hashes, then refreshes the manifest. It never contacts a provider.
5. After actual hosted verification, update availability/URLs, exact source identity, final Voice media and outcome statements from the real receipts. Re-render, re-inspect and rehash the final set.

`capture-practice.mjs` is an offline capture recipe pinned to its stated UI build. Run it only against that matching compiled identity or explicitly update its provenance after a new build. It owns local port 5489 and cleans up its browser and server. Raw browser recordings, LibreOffice profiles, review page renders and intermediate metadata stay ignored.
