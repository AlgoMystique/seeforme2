# SeeForMe — Handover to Codex (2026-10-24, 16:45)

You are taking over the whole project. This file says what the founder wants, what exists, what works, what is broken, and what Claude got wrong. Read it with `AGENTS.md`, `CLAUDE.md` and `contract/PROTOCOL.md`. Nothing here has been committed; the last commit is `88de315` (MVP v0.1). Do not commit or push without the founder's approval.

## 1. What the founder wants

A **voice-first Safari browser agent**. All interaction happens in Safari; the Mac app is never part of the user's workflow.

Acceptance test: **Open Safari → click the SeeForMe mic → hear SeeForMe greet → speak → hear it reply → watch it fill the page.** No Mac app interaction.

UI the founder asked for (and has not got yet):
- A compact floating **audio pill** at the bottom of the page: dark charcoal, fully rounded ends, subtle shadow. Left: circular grey speaker button (mute). Centre: animated waveform driven by real audio. Right: red circular hang-up button with a white phone icon.
- The **animated emoji avatar directly next to the pill**, animating from real voice state (idle, listening, thinking, speaking).
- When idle, the pill is a mic button. One click starts everything.
- Typed input only as a small secondary option. No big text card. The current card panel ("Let's make this form easier", "Help me fill this form", "Start voice" greyed out) is exactly what the founder does not want.

Next after that works (not before): multilingual. A Mandarin speaker talks Mandarin; SeeForMe answers and explains in Mandarin; values are filled into the English form. Feasibility is confirmed: the on-device Foundation Models on this Mac support `zh-Hans-CN`, `zh-Hant`, `ja`, `ko`, `vi`, `es` and others; ElevenLabs Scribe v2 transcribes 90+ languages; Flash v2.5 speaks 32 including Mandarin.

## 2. Current state (verified from diagnostics, 16:39–16:41)

| Piece | State |
|---|---|
| Installed build | `~/Applications/SeeForMe.app`, the **only** registered SeeForMe build (`pluginkit -m -A -D -v -i com.seeforme.app.extension` shows one). Built at 16:29 from the repo, ad-hoc signed, signature valid. |
| Safari extension | **Loads and runs.** The panel appears on pages. |
| Safari → native form path | **Works.** At 16:39 `FORM_SNAPSHOT` ×2 and a typed `USER_UTTERANCE` reached the native handler (Foundation Models answered in 3.1 s) and the replies reached the voice host. |
| Voice button in the panel | **Disabled.** `content.js` never passes `onVoiceAction` to `SeeForMeAssistant.create(...)` and never calls `setVoiceControlAvailable(true)`, so it shows "Safari voice controls need the native app update". This is the immediate blocker. |
| Voice host (native) | Runs in the background (no Dock icon, menu-bar waveform icon for setup only). Handles `VOICE_START`/`VOICE_STOP`/`VOICE_MUTE`/`VOICE_UNMUTE`; greets "Hi, I'm SeeForMe." plus the current question; sends `VOICE_STATE` (with `level` ~10/s and `muted`). **Not yet verified end to end in Safari** after these changes. |
| Microphone + ElevenLabs speech-to-text | Verified working (several live turns today). |
| ElevenLabs text-to-speech | Worked in the founder's first successful voice test (~14:00). **No spoken reply has been produced since**, because no voice turn since then reached a form session in Safari. |
| Toolbar button | Exists (`manifest.json` `action`, no icon). Sends `VOICE_START`. Not verified in Safari. |

Total ElevenLabs usage today (app counters): 513 TTS characters, 40 transcriptions (162 s), about $0.03.

## 3. Do this first (smallest fix to pass the acceptance test)

In `extension/Resources/content.js` (workflow part, after `// END GENERATED SEEFORME UI`):

1. Pass `onVoiceAction` when creating the assistant, and call `assistant.setVoiceControlAvailable(true)`:
   - `start`: if no session yet, run the same steps as the `start` button handler (`capture()`, `request({operation:'start',...c})`) and await it; then `browser.runtime.sendMessage({channel:'seeforme-voice', operation:'start'})`. Reply `{ok, appLaunched}`; on `ok:false` call `voiceControlFailed()`.
   - `stop`: `browser.runtime.sendMessage({channel:'seeforme-voice', operation:'stop'})`.
   The background side (`seeforme/SeeForMeExtension/voice-bridge.js`) is already shipped and tested; `session.js` already routes `VOICE_STATE` to the panel (`voice-state` operation).
2. Then rebuild and test the acceptance test (section 6).
3. Then replace the card panel with the pill + avatar UI above (PROTOCOL.md section 13.2 is the spec). Add `level` and `muted` to `protocol.js` `voiceState()` validation and drive the waveform from `level`. Mute → `operation:'mute'|'unmute'`; icon follows `VOICE_STATE.muted`.

## 4. Architecture and files

```
Safari page (content.js, dom.js, assistant-ui.js → generated into content.js)
  ⇅ browser.runtime messages (channel "seeforme" = form session, "seeforme-voice" = voice commands)
Background (protocol.js, session.js = form session + native port; voice-bridge.js = voice commands)
  ⇅ browser.runtime.sendNativeMessage("com.seeforme.app", …)        ⇡ connectNative port: USER_INPUT, VOICE_STATE pushes
Native extension process  seeforme/SeeForMeExtension/SafariWebExtensionHandler.swift
  - FormEngine (SeeForMeCore): Foundation Models + deterministic checks → HOST_REPLY
  - relays VOICE_* commands to the voice host (DistributedNotification), launches it with --start-voice if not running
  - broadcasts each reply summary (status + question text only) to the voice host
Native voice host  seeforme/seeforme/*.swift  (AppModel = app-lifetime host, VoiceModel = voice pipeline)
  - mic capture + speech detection (UtteranceRecorder), ElevenLabs STT/TTS (ElevenLabsClient), playback (SpeechPlayer)
  - sends transcripts to Safari as USER_INPUT and state as VOICE_STATE via SFSafariApplication.dispatchMessage
```

Key files:
- Contract: `contract/PROTOCOL.md` (sections 10–13 are the newest: submission, VOICE_STATE, VOICE_START/STOP, Safari-first voice UI).
- Shared Swift: `seeforme/SeeForMeCore/Sources/SeeForMeCore/` — `FormEngine.swift`, `Extractors.swift` (Foundation Models prompt), `FieldRules.swift` (normalisation + "was it actually said" grounding), `ShortReply.swift` (yes/no/skip/done, English only), `Voice/` (ElevenLabs client, recorder, player, VOICE_STATE, commands, Keychain), `Diagnostics.swift`.
- Native extension: `seeforme/SeeForMeExtension/` — `SafariWebExtensionHandler.swift`, `manifest.json`, `voice-bridge.js`.
- Voice host app: `seeforme/seeforme/` — `MyApp.swift`, `AppModel.swift`, `VoiceModel.swift`, `ContentView.swift`/`VoiceSection.swift` (setup window only), `CallBar.swift` (native call bar, **off by default**, debug fallback only — not the product UI).
- Tests: `cd seeforme/SeeForMeCore && swift test` (28 pass); JSC tests in `extension/tests/` (all 7 suites pass as of 16:25).

ElevenLabs: key in the macOS Keychain (service `com.seeforme.app.elevenlabs`), read only by the voice host when voice starts. Speech-to-text currently hard-codes `language_code: "en"` in `ElevenLabsClient.swift` — remove for multilingual.

## 5. Build, install, register (exactly one build)

```
export DEVELOPER_DIR=/Applications/Xcode.app/Contents/Developer   # system xcode-select points to CommandLineTools
cd seeforme
xcodebuild -project seeforme.xcodeproj -scheme seeforme -configuration Debug \
  -derivedDataPath ~/Library/Developer/SeeForMe/DerivedData build
osascript -e 'tell application id "com.seeforme.app" to quit'
# replace the installed copy (ask before deleting; or move the old one aside)
ditto ~/Library/Developer/SeeForMe/DerivedData/Build/Products/Debug/seeforme.app ~/Applications/SeeForMe.app
LSR=/System/Library/Frameworks/CoreServices.framework/Frameworks/LaunchServices.framework/Support/lsregister
pluginkit -r ~/Library/Developer/SeeForMe/DerivedData/Build/Products/Debug/seeforme.app/Contents/PlugIns/SeeForMeExtension.appex
$LSR -u ~/Library/Developer/SeeForMe/DerivedData/Build/Products/Debug/seeforme.app
$LSR -f ~/Applications/SeeForMe.app
open ~/Applications/SeeForMe.app
pluginkit -m -A -D -v -i com.seeforme.app.extension   # must list exactly one path
```

Rules learned the hard way:
- All builds share bundle IDs. Any second registered build (Xcode Run, another DerivedData folder) makes Safari show two SeeForMe extensions or none. Do not run the project from Xcode while testing the installed app.
- The build step copies every file in `extension/Resources/` plus `seeforme/SeeForMeExtension/*.js` flat into the extension; `manifest.json` lists the scripts (background: `protocol.js`, `session.js`, `voice-bridge.js`; content: `dom.js`, `content.js`).
- After any Safari restart: Settings › Developer › Allow unsigned extensions, then quit and reopen SeeForMe.app, then enable SeeForMe in Settings › Extensions.
- Every rebuild changes the ad-hoc signature, so macOS asks for Keychain access (Always Allow) on the next voice start. No Apple ID is signed in to Xcode; a Personal Team would make signing stable.

## 6. How to verify (diagnostics, no content logged)

- Host: `~/Library/Containers/com.seeforme.app/Data/Library/Application Support/seeforme-diagnostics.log`
- Extension: `~/Library/Containers/com.seeforme.app.extension/Data/Library/Application Support/seeforme-diagnostics.log`

A good acceptance run shows, in order: `ext.voiceCommand command=VOICE_START` → `app.command` → `voice.start keyFound=true hasQuestion=true` → `voice.tts ok=true` → `voice.playback ok=true` → `voice.state …to=listening` → `voice.stt ok=true` → `app.dispatch.userInput ok=true` → `ext.request type=USER_UTTERANCE … actions=N` → `ext.request type=FILL_RESULT` → `voice.reply … decision=speak` → `voice.tts ok=true` → `voice.playback ok=true`.
`voice.replyTimeout` means a transcript reached Safari but no form session answered (usually: voice started without inspecting the form first).

## 7. What Claude did wrong

1. **Built the wrong product shape.** Voice was built as a feature of the native Mac app (start/stop in the app window), and Safari control was bolted on later through extra bridges. The founder wanted Safari-first from the start.
2. **Built a native floating call bar** (`CallBar.swift`) instead of the in-page audio pill the founder specified. It sat over Safari but was Mac-app UI.
3. **Shipped things as "ready" without verifying them in Safari**: the call bar, the toolbar button (it has no icon) and the Safari voice start were never observed working by Claude before being reported.
4. **Created build and registration chaos.** Several builds with identical bundle IDs (`dd`, `ddDemo` in a temporary scratch folder, plus the founder's Xcode run), repeated rebuilds, registering and unregistering. Result: Safari showed two SeeForMe extensions, then none; every rebuild re-triggered Keychain prompts; voice tests failed for reasons unrelated to code. Now consolidated to one installed build.
5. **Added features before the core loop was stable**: optional-field conversation, confirmed submission, usage tracking, VOICE_STATE revisions 1.2–1.4, a demo-build mechanism. Each was tested in isolation but the founder's actual experience stayed broken.
6. **Kept deferring the UI to "wait for Codex"** while the founder had no working voice UI in Safari, and never wired the panel's voice button (`onVoiceAction`) even though the bridge existed.
7. **Smaller bugs introduced and later fixed:** the app read the Keychain at launch (a pending prompt froze the app); the resource copy step left an invalid code signature after incremental builds; diagnostics were initially info-level (not persisted), so the first regression could not be traced.
8. **English-only assumptions**: speech-to-text hard-codes English; short replies and question templates are English only.

What is solid and worth keeping: the Foundation Models form engine and its deterministic checks (it does not invent values), the DOM engine, the protocol, the ElevenLabs client, speech detection, the Keychain storage, and the diagnostics.
