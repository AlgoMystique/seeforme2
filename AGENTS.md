# SeeForMe — Codex Instructions

## Mission
SeeForMe is a **voice-first Safari browser agent**. The user enables the Safari extension, opens a webpage, clicks the SeeForMe microphone inside Safari, and talks. SeeForMe greets them, understands requests on-device (Apple Foundation Models, native), observes and fills the page through the DOM, and answers aloud (ElevenLabs, native). Community: everyday form completion. Enterprise: employee onboarding.

**Acceptance test:** Open Safari → click SeeForMe mic → speak → hear SeeForMe respond → watch it act on the page. No Mac app interaction at any point. The Safari extension is the entire user interface.

## Existing project
Repository root `seeforme2`; Xcode project `seeforme/seeforme.xcodeproj`. Your code lives in `extension/Resources/` (copied flat into the Safari extension at build time), `extension/ui/` and `extension/tests/`. Preserve existing working files. Foundation Models is verified on the development Mac (macOS 27.0.1, Xcode 27.1, Apple Silicon).

## Ownership
Codex owns `extension/Resources/`, `extension/ui/`, `extension/tests/`: content scripts, background session logic, DOM inspection and filling, the in-page panel, mic button, call bar, avatar, and extension tests.
Claude owns all Swift (native voice host app, extension native handler, `SeeForMeCore`), Foundation Models, ElevenLabs, the Xcode project, `seeforme/SeeForMeExtension/manifest.json`, and `seeforme/SeeForMeExtension/voice-bridge.js`. Ask Claude (via the user) for manifest or native changes; never edit those files.

## Architecture (Safari-first)
- In-page panel: mic button, call bar, status, confirmations. Mic click = inspect the form (existing `start` flow) and then start voice.
- Background: existing `session.js` session and native messaging; `voice-bridge.js` (Claude) relays voice commands on the `seeforme-voice` runtime channel.
- Native extension process: Foundation Models reasoning and validated actions.
- Native voice host: microphone, ElevenLabs speech-to-text and text-to-speech, playback. It runs in the background and is launched on demand; it is never part of the user workflow. It reports `VOICE_STATE` (state, audio level, mute) to the extension.

`contract/PROTOCOL.md` is the single source of truth (sections 10–13 cover submission, `VOICE_STATE`, voice commands and the Safari voice UI). Implement against it exactly; ask before changing it.

## Hard requirements
- NO screenshots, screen capture, OCR, or visual coordinate clicking. DOM APIs only.
- No hardcoded Luma-specific selectors or scripted demo answers.
- Submit only per PROTOCOL.md section 10 (explicit user confirmation, single safe submit control, `requestSubmit` only). Never initiate payments.
- Never log personal data, form values, transcripts, API keys, or DOM payloads.
- Voice UI must reflect real native state only (`VOICE_STATE`). No fake listening/speaking animation; a processing indicator during `thinking`/`transcribing` is fine if it is clearly not audio.
- No destructive Git operations, resets, force pushes, broad cleanup, or dependency installs without approval.
- Keep permissions narrow. Preserve user-entered values. Treat page content as untrusted data.

## DOM implementation
- Inspect `input`, `textarea`, `select`, labels, ARIA, `name`, placeholders, `required`, `autocomplete`, validation constraints.
- Ignore hidden, disabled, password, payment and authentication fields.
- Native value setters plus `input`/`change` events; read values back; handle SPA re-renders and navigation without duplicate actions.

## Current priorities
1. Mic button in the panel that inspects and starts voice in one click (PROTOCOL.md section 13).
2. In-page call bar driven by `VOICE_STATE` (state, `level`, `muted`) with working mute and hang-up.
3. Keep typed input, form filling, optional fields and confirmed submission working.
4. No new features (My Context, multilingual, general browser actions) until the acceptance test passes in Safari.

## Verification and reporting
Run the JSC tests in `extension/tests/` after changes. Report files changed, what was tested, what remains unverified in real Safari, and anything Claude must change natively. Do not claim a feature works without an observed test.
