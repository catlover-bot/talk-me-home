# Goal 003 browser evidence

These 16 PNGs were copied from the final passing local Playwright run on 2026-09-08. They render the frozen production source at `37bc1c78be36e9aa7cda5c878bfc71e3604781b2` (assets `index-BH2erb3C.js` and `index-BXvttxsD.css`). Documentation-only commits do not change that bundle. They are full-page captures taken at the named viewport widths; image height can exceed viewport height. No concept art or external generated image is used as evidence.

| View | Evidence |
| --- | --- |
| Recommended Rescue briefing / optional guide | [1280](briefing-chromium-1280.png) |
| Preserved Training | [Classic 1280](training-classic-chromium-1280.png), [Maintenance 1440](training-maintenance-chromium-1440.png) |
| Rescue initial Cargo, before local report | [1280](cargo-initial-chromium-1280.png) |
| Gallery atlas and private inferred marker | [1280](gallery-chromium-1280.png), [1440](gallery-chromium-1440.png), [1920](gallery-1920-chromium-1280.png) |
| Nonmodal history during play | [1280](history-during-gallery-chromium-1280.png) |
| Presentation with honest Practice label | [1280](presentation-gallery-chromium-1280.png) |
| Return procedure and acknowledged instruments | [Practice 1280](return-dock-chromium-1280.png), [simulated provider ready 1440](simulated-return-ready-chromium-1440.png) |
| Blocked route, safe recovery | [1280](blocked-route-chromium-1280.png) |
| Actual server-confirmed finale | [Practice 1280](homecoming-chromium-1280.png), [simulated provider 1440](simulated-home-chromium-1440.png) |
| Reflow | [390px](gallery-narrow-chromium-1280.png), [200% CSS enlargement](gallery-enlarged-chromium-1280.png) |

The `chromium-1280` suffix on wide/narrow/enlarged files identifies the test project, not its temporary viewport. Gallery layout explicitly resizes that project. The corresponding browser assertions also run in the 1440 project without keeping duplicate wide/narrow evidence.

Compare the preserved [Goal 002 active Cargo view](../goal-002/g2-classic-chromium-1280.png) with the new Classic Training image. Final independent visual review covered briefing, both main desktop layouts, wide/narrow/enlarged Gallery, open history, Presentation, Dock readiness, wrong-route feedback and the actual three-chapter finale. Selected contrast measurements are in [validation](../../goal-003-validation.md).

Narrow/enlarged layouts intentionally use document scrolling. Expanded private annotations can place Relay below the first 720 pixels; close the drawer when returning to the main control. History and long captions are bounded scroll areas with cues; a long entry's Pin button can require scrolling. These are disclosed usability tradeoffs, not evidence of native Windows zoom or assistive-technology certification.

Files beginning `simulated-` visibly carry an offline-provider/fake-audio stamp. They validate browser/server/protocol plumbing only, not a human hearing Pip or completing the mission through natural speech. Practice likewise does not exercise AI reasoning. [measurements.json](measurements.json) retains source identity, bundle byte counts, allowlisted local render timings and PNG hashes. [Owner Live checks](../../goal-003-live-acceptance.md) remain pending.
