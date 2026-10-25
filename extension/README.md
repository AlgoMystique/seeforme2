# Safari JavaScript handoff

Approved resource location: `extension/Resources/`. Do not move these files.
Codex now owns the full project following the user's takeover instruction.
Existing native and DOM safeguards are preserved. `contract/PROTOCOL.md` revision 1.5 (`v: 1`) is the
single source of truth for native messages; this implementation does not edit it.

## Load order for Claude's target

Background scripts: `protocol.js`, `session.js` in that order. `session.js` starts
itself when the browser API exists. `background.js` retains the earlier generic
router factory for isolated tests; do not instantiate it alongside `session.js`.
Content scripts: `dom.js`, `content.js` in that order, top frame only, after the DOM
is ready. The content entry point creates an in-page panel using DOM APIs and an
isolated shadow root. All files are flat to simplify target resource copying.

The target needs nativeMessaging, plus the least site access and tabs capability
needed for sender validation, active-tab voice routing, and messaging. Request site
access only when the user enables a site. No manifest or project configuration was
changed by Codex. The shared protocol now references this resource directory.

## Behavior

- Click Help me fill this form to establish an ephemeral tab/document session. Metadata is
  extracted only for supported, visible, enabled ordinary HTML fields.
- Type an answer or speak through Claude's app. Native messages follow protocol v1:
  snapshot, utterance, HOST_REPLY actions, verified FILL_RESULT, then next question
  or review. Native pushes accept raw and Safari-wrapped USER_INPUT. Optional-field
  offers with empty fieldIds display normally without highlighting any field.
- Wire fields use protocol limits/kinds, grouped radios and string checkbox values.
  Internal DOM functions retain their own representation behind protocol adapters.
- Existing values require the protocol's explicit `overwrite: true`. The native
  host must only grant this from user intent. Page content is never authority.
- Native setters plus input/change events notify page frameworks. Values are read
  back asynchronously. Duplicate actions, changed elements/values, old revisions,
  and responses arriving after navigation are rejected.
- Voice/app turns arriving during processing queue in ephemeral memory (maximum
  five); each turn refreshes its form context. Typed input reports busy instead.
  Speech queued before a submit question cannot answer that question; a fresh
  answer is required. Unknown-session recovery never replays a confirmation.
- Session reset clears host session state. It preserves values already on the page.
- Submission requires the native agent’s explicit authorisation after a displayed
  review question. No screenshots, raw HTML dumps, or personal-data logging.
- The panel shows processing, filling, question/error and review states. Revision
  1.2 VOICE_STATE pushes on the existing native port drive real voice indicators
  in the active tab's session. UUID/sequence/TTL validation rejects malformed,
  duplicate and older updates; expiry and disconnect return the display to idle.
  Voice display never requests model work or changes form answers.
- The microphone inspects the form, waits for the reply, then uses the documented
  seeforme-voice start bridge (revision 1.4). Mute/unmute and hang-up use the same
  native-owned bridge. Acknowledgements do not simulate activity; the charcoal
  call bar appears only for valid real VOICE_STATE updates. Bars follow level,
  and speaker state follows muted. Audio and credentials remain native-owned.
- Privacy copy distinguishes on-device reasoning from ElevenLabs cloud voice.
  The local model claim is shown only when `modelAvailable` is true; fallback is
  labelled explicitly. Do not claim that all data stays on-device.

## Verification

From repository root:

```
python3 extension/tests/run.py
```

These exercise DOM fixtures and a mocked browser/native bridge, not actual Safari
or Foundation Models. `extension/tests/form.html` is a manual synthetic fixture;
serve on localhost for Safari integration with dummy details after target wiring.
Then test a real Luma form without submitting. Framework-specific widget behavior,
actual native pushes, and voice round trips remain unverified.

Initial scope: ordinary light-DOM inputs, textareas, native single selects, radio
groups and checkboxes. Custom widgets, shadow-DOM page forms, subframes and
contenteditable are excluded. IDs survive capture of the same element; replacement
nodes get new IDs. Metadata/value drift fails safely until the next inspection.
Page handlers can have side effects and later revert fields; immediate read-back
cannot promise future state. The only submission API used is requestSubmit with
the reviewed submit control, after the checks described below.

## Hackathon priorities

Deliver a reliable typed end-to-end Luma flow with real local Foundation Models
reasoning first, then two-way ElevenLabs voice, then polish and rehearsal. Apply
confirmed transcript turns promptly to show visible completion. Protocol v1 has
no interim/final flag: do not invent one or fill from speculative interim speech.

Judging evidence: real on-device model actions and PII-aware handling (Core AI),
clear interactions and visible verified filling (craft), a shared engine for
employee onboarding with local inference and narrow site access (enterprise),
and help completing everyday online forms (community). Present security/cost
benefits as architectural potential, not certified compliance or measured savings.
No administration or compliance engine today. Always review before submission;
unsupported forms remain manual.


## Confirmed submission — revision 1.1

`FORM_SNAPSHOT.submitAvailable` is true only for a supported top-level document
whose snapshot fields share one connected form and one visible, enabled native
submit control. Password, file, payment/authentication hints, CAPTCHA indicators,
opaque embedded controls, validation-bypassing attributes, and explicit click-only
confirmation handlers keep the form on the manual path. Non-native submit widgets
and ambiguous controls are not clicked or emulated.

When the native agent presents ready_for_review with its question, the content
script records the reviewed form/control identities, structure, destinations and
current values locally. Those values never enter snapshots or submission results.
Later snapshot refreshes do not silently transfer that review to a different form
or changed answers. The native agent owns interpretation of yes/no.

Only a validated HOST_REPLY(status: submit), responding to a fresh USER_UTTERANCE
following that review, can request submission. The DOM engine rechecks the document,
reviewed identities, current values/constraints, required fields, and native
checkValidity, then rechecks again after validation handlers. It calls
form.requestSubmit(control) once and observes native submit/invalid events.
Native form validation and submit handlers remain active, as specified by the
[HTML Standard](https://html.spec.whatwg.org/multipage/forms.html#dom-form-requestsubmit-dev).
It never calls form.submit, dispatches synthetic submit events, or clicks a page
control. Any additional site confirmation, CAPTCHA, payment or authentication
step remains the user's responsibility; none is automatically completed.

SUBMIT_RESULT contains only the standard envelope, success and a fixed error code.
Success means the native request reached the form's submit event without a native
validation failure; **it does not confirm server acceptance**. A page's submit
handler may cancel navigation or display another step. Lost replies are treated
as uncertain failures (OTHER), never as grounds to repeat the operation. The
background defers SESSION_RESET during submission long enough to report a known
result to the old host session. Browser termination can still prevent delivery.

A session attempts submission at most once, including failures. A document that
has called requestSubmit will not advertise submission again after Start over.
If the user needs another attempt, they must review the page and act manually or
reload and establish a fresh session. No automatic retries are performed.

## Live Safari verification still required

The focused tests use DOM/browser/native fixtures. Real Safari native messaging,
Foundation Models, voice timing, navigation during submission, and site-specific
validation/confirmation behavior remain unverified. Safari Remote Automation was
disabled at the previous renderer-check attempt; no preferences were changed.

Serve `extension/tests/submission-form.html` on localhost and use the real app:
fill required fields, answer the optional-field offer, review, then explicitly
confirm. The fixture cancels its submit event and counts it without sending data.
Also verify refusal for changed answers/controls and invalid fields. The original
`extension/tests/form.html` remains submit-free. Do not test real Luma submission
without a separate deliberate user-approved registration.

## Multilingual implementation status

The native language and conversation layer is implemented; see revision 1.5 below.
Speech detection no longer forces English. Language defaults, form explanations,
both mapping directions and explicit translation approval have native tests,
including real on-device model generations. Browser/native fixtures cover voice
preferences and routing. The user confirmed the English-speaking / Chinese-form live Safari path: explanations in English and a Chinese translation preview before filling. Other spoken language/voice combinations still need live checks.
No .env content was printed or copied; the existing Keychain credential is used.

## Takeover repair, 24 October

VoiceModel.start now enters preparingSpeech before invoking say. Previously it
remained off, so say's stopped-session guard discarded the greeting and never
entered listening. The Safari interface is now an avatar beside an idle Talk pill
or active speaker/waveform/hang-up pill, with typing behind Type instead.
Native build, signature validation, 28 Swift tests and JavaScript fixtures pass.
Live Safari acceptance passed at 16:48: the user confirmed greeting, spoken
replies and visible form filling. Diagnostics show two voice utterances with
one action each, FILL_RESULT, successful TTS/playback, and VOICE_STOP.
Remote Automation remains disabled; mute and responsive layout still need manual
verification. This run used 192 TTS characters and 4.987 seconds of transcription.

## Multilingual conversation — revision 1.5

Native sessions use macOS preferred language unless Safari preferences override it.
The compact Language & voice settings offer the intersection of the installed
Foundation Models locales and Flash v2.5 languages, plus George, Rachel and Sarah
voice presets. Availability of each voice still depends on the ElevenLabs account.
Preferences are stored in extension storage; no credentials or form answers are.

Scribe detects speech language automatically. Help/explanation requests in another
supported language can offer a language switch; names and emails do not silently
change the session language. Explicit language requests also change the session.
Form/field lang attributes and bounded aria-describedby text inform local reasoning.
Field IDs are opaque during generation and must map back to a known field.

The local model classifies intent, explains form metadata, extracts quoted evidence,
and separately translates descriptive text to the field language. It never treats
help/explanation as a value. Identifiers and names are preserved. Translated entries
are previewed and require explicit approval; approval only fills, never submits.
Schema drift invalidates pending translation approval. Unknown languages, model
failures, missing evidence and ambiguous consent fail without filling.

Live fixture: extension/tests/multilingual-form.html. It switches between Chinese
and English labels and cancels submission locally. Use synthetic details only.
Native model tests exercise both translation directions. The user confirmed the
English-speaking / Chinese-form Safari path. Other selected voices and automatic
language-switch behaviour still require live verification.

Validation for this update: 384 focused JavaScript assertions, 39 Swift tests,
successful Xcode build and codesign verification. One installed registration.
The pre-update English build is backed up at /tmp/SeeForMe-before-multilingual.zip.
No commit or push.

## Name and review UX correction

Original/legal name spelling is preserved, regardless of form language. Unexpected
script in a voice-supplied name prompts spelling clarification instead of filling.
Typing remains available for explicitly supplied original spellings. The app does
not invent an official translated name.

Translation approval now reviews the meaning in the conversation language, not raw
foreign wording. For example, an English speaker approves Small while the actual
Chinese option value is retained internally. Identity spellings remain protected.
On-device tests verify English review of Chinese options and exact option filling,
plus both translation directions, name safeguards and submission isolation.
43 native tests and the build pass; these latest fixes await live Safari retesting.

Question-label correction: standard HTML autocomplete meanings (name, email,
etc.) now produce semantic questions before localization. Mixed-language text
retaining foreign-script labels for Latin-script conversation languages gets a
bounded label-only translation check; failed translation is not spoken as-is.
45 native tests pass, including the exact Chinese name label in an English
conversation, and the corrected build is installed. Live audio retest pending.

### Required-field and busy-state recovery

Blank required fields reported as `REQUIRED_MISSING` now use ordinary missing-field questions (including select options), rather than the invalid-value correction prompt. Other validation issues still require correction. Talk is disabled while an inactive voice session's form operation is processing; an active conversation can still be stopped. Native form requests have a 60-second deadline and workflow tab requests a 10-second deadline; late replies cannot apply actions after timeout. Actions and submission are never automatically retried after timeout.

Validation: 402 JavaScript assertions across seven suites, including timed-out reply rejection and explicit retry recovery; 47 native tests, including missing dropdown and actual validation-error regressions. Live Safari dropdown completion and recovery still require a fresh user test after reload.

### Website explanations (protocol revision 1.6)

Talk can start on pages without form fields. Bounded visible DOM text (up to 6,000 characters) is refreshed per turn and interpreted by Foundation Models in the selected conversation language. Read-only explanations also use this context on pages with fields. Raw DOM text is not sent to ElevenLabs; the assistant's spoken explanation is. Hidden text, scripts, control values and editable content are excluded. Images, inaccessible frames and content beyond the extraction bound are not explained.

Validation: 407 JavaScript assertions and 50 native tests passed, including actual on-device English explanations of synthetic Chinese and French pages. Live Safari voice on the user's website remains to be verified. Reload the website, select the conversation language under Language & voice, click Talk and ask “Explain this website to me.”

### Spoken identifiers and streamed replies (revision 1.7)

A targeted voice answer containing explicit email punctuation (for example, “alex dot demo at example dot com”) or a letter-by-letter name is converted deterministically and previewed for approval. Ambiguous missing punctuation is not guessed. Name handling has no person-specific dictionary. Empty validated action sets now ask for exact wording instead of displaying internal model commentary.

ElevenLabs audio uses the native streaming PCM endpoint and incremental playback. Read-only page explanations additionally emit complete sentences while Foundation Models generates the answer. Turn UUIDs and consecutive chunk numbers prevent replaying older speech; the final reply is not spoken twice. Model streaming falls back to ordinary generation if it fails before emitting speech. Form actions still finish validation and DOM readback before completion is spoken. No credentials enter JavaScript.

Validation: 409 JavaScript assertions and 54 native tests passed. A separate live on-device test verified non-final sentence delivery and exact ordered reconstruction of the answer. Safari microphone recognition, audible playback and live email filling still require a user check after reloading.

Live synthetic ElevenLabs checks received streaming PCM in 17 chunks with first audio at 248–354 ms. Explicit spoken email punctuation plus confirmation recovered the exact address. Ordinary pronunciation lost punctuation in two STT samples; emails supplied by voice therefore require exact-value confirmation, including multi-field answers. These checks used approximately $0.0185 total in estimated ElevenLabs usage (441 TTS characters, 7 TTS requests; 14.8 seconds across 3 STT requests). They do not establish microphone accuracy or audible playback in Safari.

### Direct fill and interruption (revision 1.8)

Per the user's updated preference, answers now fill without a confirmation round, including translated values and spelled identifiers. Ambiguous/unusable values still need clarification; submission approval is unchanged. Voice recording remains active during playback with AVAudioEngine voice processing and a separate native playback engine. Sustained detected speech cuts off the reply and clears queued/stale speech while preserving the start of the user's utterance. Hardware echo cancellation and interruption timing require live Safari verification.


### Playback crash repair

Safari's persistent “Thinking” was caused by a native playback callback crash (`dispatch_assert_queue`, `SpeechPlayer.playStream`). Audio-thread callbacks are explicitly Sendable and only dispatch UI updates to MainActor. Playback completion/backpressure waits are bounded. Restored the independent playback engine after the shared graph failed hardware initialization. The real microphone plus one-second silent PCM playback test passed without a callback crash. This validates the audio graph, not acoustic echo cancellation or spoken interruption accuracy. `--audio-self-test` reproduces this check without network calls or retained microphone audio.

### Microphone channel mapping repair

Live user-assisted comparison on this Mac showed processed input delivered buffers but zero signal and no utterances. Explicit `AVAudioConverter.channelMap = [0]` restored the microphone channel: the repeat test detected two utterances with processing enabled, and two with processing disabled. No audio was retained or transcribed by this diagnostic. Safari DOM automation on a fresh synthetic test form also verified name/email filling and email readback; this is a DOM test, not a claim of full voice-flow verification.

Live Safari follow-up after installing channel mapping: diagnostics showed speech → transcription → USER_UTTERANCE actions → FILL_RESULT → streamed playback completion. DOM inspection returned filled=true for name and email without exposing values. One native turn took about 1.4 seconds and first audio followed in about 250 ms. This verifies the previously stalled listening path in the user's Safari session; it does not independently verify the correctness of personal field values.

### Demo lifecycle optimizations (revision 1.9)

The assistant automatically inspects and starts voice once when first loaded in an active tab. Background tabs do not activate voice; reload/completion does not repeatedly reopen it. Talk remains available for another task. Unsupported website actions receive a localized capability reply without actions. Completed explanations, successful submissions, and final review without a pending question stop voice after playback; submission confirmation still keeps the session open.

Validation: 415 JavaScript assertions and 58 native tests passed, including actual Foundation Models unsupported-action classification and the existing multilingual explanation tests. Audio capture/channel mapping, playback and form-filling code remain at the user-confirmed working baseline.

Automatic-start messaging fix: the form background listener now returns synchronously for other channels. Previously its empty async Promise could claim the reply intended for the voice bridge, so a granted automatic start was never observed by the content script. Regression checks cover both automatic and manual voice message response ownership. 417 JavaScript assertions passed; no native audio or form logic changed.

## Local context — revision 1.10

Local context controls live in the existing panel footer. Talk/Inspect turns
SeeForMe ON. Use the explicit ON/OFF control to end a context activation; hang-up
and navigation preserve it. Connect Folder selects a directory with the Mac
system picker. Refresh Context is the only way to reread the same folder while ON;
Change Folder replaces it and Disconnect removes its remembered permission.

The native host owns folder access, optional bookmark persistence and extraction. A private local
extracted-text cache persists through process interruptions and is cleared on OFF
or Disconnect. Original documents stay in place. Supported immediate children:
PDF text (no OCR), UTF-8 TXT/Markdown, DOCX. Limits and transport are documented in
PROTOCOL.md section 19. Ask explicitly, for example, “Use my context to write this
description in French.” Unknown facts still require clarification. Filled values
are visible to the website. Context-derived speech requires explicit ElevenLabs consent, revocable in Local context settings. Without consent, spoken replies are redacted; microphone transcription remains ElevenLabs. Original files and cached excerpts stay local.

Caches live separately in the host and native extension sandboxes. The existing
native push/message channel relays bounded snapshot chunks through the extension
background; document text never enters tabs, DOM, browser storage, diagnostics or
remote services. Complete snapshots commit atomically; sequence ordering rejects
older context after OFF/Disconnect. Original signing configuration and entitlements
are unchanged. No App Group or development-team provisioning is required.

The current host has read-only picker permission but lacks
`com.apple.security.files.bookmarks.app-scope`. It retains live folder access while
running and restores the active extracted-text cache after interruptions. After
the native host quits, Refresh/new activation requires reconnecting the folder to
reread originals. The controls disclose this. Durable permission restoration can be
enabled later with that standard bookmark entitlement; no signing change is made
for this prototype.

Focused native checks: `swift test --package-path seeforme/SeeForMeCore --filter
LocalContextTests` and `--filter LocalContextTransferTests`. JavaScript checks remain `python3 extension/tests/run.py`.
Real Safari picker presentation, chunk delivery through the native port, retained
folder access across Safari restarts, cached resume across host restarts,
cross-website ON/OFF behavior and voice integration require manual verification
with synthetic documents.


Bengali submission demo: the existing ElevenLabs key now authorizes a private text-only
ElevenLabs Agent for Bengali reasoning. Scribe handles transcription and Eleven v3
handles Bengali speech; non-Bengali speech/reasoning keeps its original providers.
Only matching context snippets and eligible form metadata are sent, never source files
or entire cached documents. Form values are validated and filled locally in the form's
language. Live synthetic tests cover Bengali greeting/audio/transcription, Bengali yes,
English/Japanese field values, name preservation and no submission. The extension's
native target now has outgoing-network capability; signing and JavaScript permissions
are unchanged. The private agent ID is in ElevenLabsReasoner.swift, and the key remains
in the native Keychain. No local-model service or model download is required.
