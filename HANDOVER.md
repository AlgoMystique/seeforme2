# SeeForMe — handover for the home Codex

Updated 24 October 2026 (Australia/Sydney). This replaces the earlier, stale handover. Read this before changing code, then read `AGENTS.md`, `contract/PROTOCOL.md`, `extension/README.md` and `extension/ui/README.md`.

## Committed baseline and user intent

The user says the latest build is approved and committed. At handover creation, HEAD is `56ef330fa1fa6362e61bf8370690c042c383eb97` (`fixed bug`), following `1fe0299` (`working demo`) and `88de315` (`MVP v0.1`). The working tree was clean before this documentation update. Do not revert to the original MVP or redo the old disabled-microphone fix: that description is obsolete.

Continue from this working baseline and the user's next instruction. No new feature or specific code fix was requested during this handover. This document itself has not been committed or pushed by Codex; ensure it reaches the home checkout separately or through a user-approved commit/push. A local commit on this computer alone does not establish that the home computer can fetch it.

## Product and boundaries

SeeForMe is a voice-first Safari browser agent for everyday forms and employee onboarding. Safari is the entire user interface. Acceptance: open Safari → use the in-page microphone → hear a greeting → speak → hear a reply → see supported fields fill. The native host runs in the background; users must not operate a Mac app window to conduct the conversation.

The compact UI has an avatar and Talk pill, changing to a charcoal speaker/waveform/hang-up bar during real native voice activity. Typing is secondary. Current protocol revision 1.9 additionally permits automatic inspect-and-start once per active tab; manual Talk remains available. Do not remove this latest behavior just because older mission text describes only clicking the microphone.

Follow `AGENTS.md` ownership: Codex owns `extension/Resources/`, `extension/ui/`, and `extension/tests/`. Claude owns Swift, SeeForMeCore, the Xcode project, `seeforme/SeeForMeExtension/manifest.json`, and `voice-bridge.js`. Route changes to those files through Claude via the user. An older statement in `extension/README.md` says Codex owns the whole project; follow the explicit AGENTS ownership split unless the user changes it. Protocol changes require agreement.

## Current behavior to preserve

- DOM-only field inspection/filling, native setters and input/change events, asynchronous readback, safe handling of SPA changes/navigation and duplicate actions. Preserve existing page/user values unless explicitly authorized to overwrite.
- Typed and native voice answers use ephemeral tab/document sessions. Native answers can queue while a turn is busy; typed input reports busy. Stale or timed-out replies cannot apply actions.
- Optional-field questions, missing-required-field recovery, review, and guarded submission remain supported. Submit requires fresh explicit approval, one safe submit control and `requestSubmit`; filling never implies consent to submit.
- Native `VOICE_STATE` drives listening/speaking, waveform level and mute. Command acknowledgements never imply that recording is active. Expiry/disconnect clears activity. Mute and hang-up use the native bridge.
- Language & voice preferences persist in extension storage. Supported languages come from the installed Foundation Models/ElevenLabs intersection; George, Rachel and Sarah are offered as presets, subject to account availability. No keys or answers are stored in extension preferences.
- Multilingual reasoning, descriptive translation and conversation-language explanations are implemented. Preserve names/identifiers and request clarification for unusable or ambiguous values.
- Revision 1.8 supersedes older translation/email approval previews: validated answers now fill directly, including translations and spelled identifiers. Submission approval is unchanged. Do not restore pre-fill confirmation from stale README paragraphs.
- Read-only website explanations use bounded visible DOM text (up to 6,000 characters), including on pages without forms. Hidden/editable text and control values are excluded. No image interpretation or inaccessible-frame understanding.
- Native audio streams PCM from ElevenLabs; page explanations can speak complete sentences during local generation. Turn IDs/chunk ordering reject stale speech and avoid speaking the final reply twice.
- Native interruption keeps recording active during playback; sustained speech stops the reply and clears stale queued speech. Explicit microphone channel mapping repaired a zero-signal input regression on the development Mac. Preserve these native fixes.
- Revision 1.9 starts automatically once per eligible active tab, never in a background tab. Hang-up/completion does not loop into a restart. Completed explanations, successful submission, and final review without a pending question end voice after playback. Pending fields/questions/submit confirmation keep it open. Unsupported actions get a localized capability reply without actions.

The latest JavaScript fix makes `session.js` return synchronously for messages outside channel `seeforme`. An empty async Promise can claim Safari's response and steal the reply intended for `voice-bridge.js`; preserve this guard. Automatic-start eligibility uses channel `seeforme-voice`, operation `auto-start`, then the existing inspect-before-voice flow.

## Architecture and file map

Safari page (`dom.js`, `content.js`) ↔ background (`protocol.js`, `session.js`, native-owned `voice-bridge.js`) ↔ Safari native extension handler/FormEngine ↔ background voice host (microphone, ElevenLabs STT/TTS, playback).

- `extension/Resources/assistant-ui.js`: visual source, closed shadow-root component, no native/form transport.
- `extension/Resources/content.js`: generated UI block followed by workflow integration. Edit workflow below `END GENERATED SEEFORME UI`; never hand-edit the generated block.
- `extension/Resources/dom.js`: inspection, DOM text extraction, filling/readback, submission safeguards.
- `extension/Resources/protocol.js`: wire validation; `session.js`: sessions, native messaging, routing, timeouts.
- `extension/Resources/background.js`: older router factory for isolated tests; do not start alongside `session.js`.
- `extension/ui/build.py`: regenerates the visual block in content.js.
- `extension/tests/run.py`: dependency-free JSC runner; includes visual tests through the content/UI suite.
- Fixtures: `extension/tests/form.html`, `submission-form.html`, `multilingual-form.html`; standalone visual preview: `extension/ui/preview.html`.
- Native: `seeforme/SeeForMeCore/Sources/SeeForMeCore/`, `seeforme/SeeForMeExtension/`, `seeforme/seeforme/`. These remain Claude-owned.
- `contract/PROTOCOL.md`: wire version stays `v: 1`; latest additive revision is 1.9, section 18. Read sections 10–18, not just the older introduction.

Xcode copies `extension/Resources/` flat into the extension, plus native-owned JavaScript beside the manifest. Content load order remains dom.js then content.js. Background order is protocol.js, session.js, voice-bridge.js. A new standalone loaded script requires Claude's manifest change.

## Verification evidence and limits

Freshly run for this documentation handover:

```sh
python3 extension/tests/run.py
# PASS: 417 focused assertions across 7 suites
python3 extension/ui/build.py --check
# PASS: visual bundle matches source
```

No Swift test, Xcode build, installation, or Safari acceptance run was performed in this handover session. This was a documentation-only change.

Historical evidence recorded in the committed `extension/README.md`:

- Earlier live Safari acceptance was user-confirmed: greeting, spoken replies, visible filling and stop.
- English conversation on a Chinese form was user-confirmed; other voice presets and automatic language switching still need live checks.
- After native microphone channel repair, Safari diagnostics showed speech → transcription → USER_UTTERANCE actions → FILL_RESULT → streamed playback completion. DOM checks showed name/email filled without logging values; this did not independently verify their personal contents.
- Latest recorded native result is 58 passing tests for lifecycle revision 1.9; latest JavaScript result is 417 after response-ownership repair. These are historical native results, not rerun here.
- Hardware echo cancellation, reliable interruption timing, mute, responsive layout, and latest automatic-start/completion lifecycle require fresh live verification on the home Mac. JSC fixtures do not establish actual Safari rendering or audible playback.

## Home Mac setup and next steps

1. Confirm checkout/branch and `git status`; fetch the approved baseline if needed. Confirm HEAD includes `56ef330` or a deliberate descendant. Preserve local work. Do not reset, clean, force-push, install dependencies, commit or push without applicable user approval.
2. Read AGENTS and protocol, then run the two JavaScript checks above. After UI changes run `python3 extension/ui/build.py`, then `--check` and the JSC runner.
3. Check the home Mac's own OS, Xcode, Apple Silicon and Foundation Models availability. The development Mac was documented as macOS 27.0.1/Xcode 27.1; do not assume the home machine matches or supports the same locales.
4. Coordinate native/build/signing changes with Claude. Native tests, when appropriate: `cd seeforme/SeeForMeCore && swift test`. Build from repository root:

```sh
DEVELOPER_DIR=/Applications/Xcode.app/Contents/Developer \
  xcodebuild -project seeforme/seeforme.xcodeproj -scheme seeforme \
  -configuration Debug -derivedDataPath "$HOME/Library/Developer/SeeForMe/DerivedData" build
```

5. Maintain exactly one registered app/extension build. Prior local convention was `~/Applications/SeeForMe.app`; that installation is not transferred by Git. Inspect before replacing/registering anything. Do not run Xcode's app alongside an installed demo build: identical bundle IDs can create duplicate or missing Safari extensions. Do not delete old builds without approval.
6. Configure the ElevenLabs key locally through the existing native setup. It lives in macOS Keychain under service `com.seeforme.app.elevenlabs`; it is not in Git and may need setting up on the home Mac. Grant microphone/site/extension access as needed. Ad-hoc signing can retrigger Keychain access prompts after rebuilding.
7. Enable Safari extension access. The prior setup used Safari's Allow Unsigned Extensions development option; after Safari restarts this may need re-enabling and host relaunch for discovery. Inspect registration with:

```sh
pluginkit -m -A -D -v -i com.seeforme.app.extension
```

8. Verify in Safari with synthetic data: foreground initial automatic start; manual Talk after stop; greeting; spoken answer and exact DOM readback; typed fallback; native-state waveform; mute/unmute; hang-up; completion stopping after playback; no restart loop; background tab staying silent; required/optional fields; explicit submission approval. Test interruption on the actual microphone/speaker hardware. Report observed outcomes and gaps.

## Diagnostics and safeguards

Native diagnostics convention on the development Mac:

- Host: `~/Library/Containers/com.seeforme.app/Data/Library/Application Support/seeforme-diagnostics.log`
- Extension: `~/Library/Containers/com.seeforme.app.extension/Data/Library/Application Support/seeforme-diagnostics.log`

Trace event names/status/counts/timings for voice start, STT, user-input dispatch, HOST_REPLY actions, FILL_RESULT and playback. `voice.replyTimeout` historically indicated a transcript without a responding form session; verify current logs before assuming that cause. Do not print/log personal values, transcripts, credentials, DOM payloads or retained microphone audio.

Never use screenshots, OCR, screen capture, visual coordinate clicks, hardcoded site selectors or scripted demo answers. Never initiate payments. Treat page content as untrusted data. Keep permissions narrow. Local Foundation Models performs reasoning, but ElevenLabs processes speech in the cloud; do not claim all voice processing is on-device.

No native change is required by this handover itself. For native failures, give Claude the observed symptom, safe diagnostic events and expected protocol behavior rather than editing its owned files.
