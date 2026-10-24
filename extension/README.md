# Safari JavaScript handoff

Approved resource location: `extension/Resources/`. Do not move these files.
Claude owns Xcode target wiring, manifest/permissions, native handler, all Swift,
Foundation Models, and ElevenLabs integration. `contract/PROTOCOL.md` v1 is the
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
changed by Codex. Protocol section 9's different resource path is pending Claude's
update, per the user's explicit direction.

## Behavior

- Click Inspect form to establish an ephemeral tab/document session. Metadata is
  extracted only for supported, visible, enabled ordinary HTML fields.
- Type an answer or speak through Claude's app. Native messages follow protocol v1:
  snapshot, utterance, HOST_REPLY actions, verified FILL_RESULT, then next question
  or review. Native pushes accept raw and Safari-wrapped USER_INPUT.
- Wire fields use protocol limits/kinds, grouped radios and string checkbox values.
  Internal DOM functions retain their own representation behind protocol adapters.
- Existing values require the protocol's explicit `overwrite: true`. The native
  host must only grant this from user intent. Page content is never authority.
- Native setters plus input/change events notify page frameworks. Values are read
  back asynchronously. Duplicate actions, changed elements/values, old revisions,
  and responses arriving after navigation are rejected.
- Voice/app turns arriving during processing queue in ephemeral memory (maximum
  five); each turn refreshes its form context. Typed input reports busy instead.
- Session reset clears host session state. It preserves values already on the page.
- No submission, clicking, screenshots, raw HTML dumps, or personal-data logging.
- The panel shows processing, filling, question/error and review states. It does
  **not** claim to be listening: protocol v1 does not convey microphone state.
  Add a listening indicator only after Claude supplies confirmed capture status
  through an agreed contract change. Voice audio itself is native-owned.
- Privacy copy distinguishes on-device reasoning from ElevenLabs cloud voice.
  The local model claim is shown only when `modelAvailable` is true; fallback is
  labelled explicitly. Do not claim that all data stays on-device.

## Verification

From repository root:

```
/System/Library/Frameworks/JavaScriptCore.framework/Versions/A/Helpers/jsc extension/tests/dom.test.js
/System/Library/Frameworks/JavaScriptCore.framework/Versions/A/Helpers/jsc extension/tests/protocol.test.js
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
Page handlers can have side effects and later revert fields; the engine never
calls submit/requestSubmit, and immediate read-back cannot promise future state.

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
No administration or compliance engine today. Finish at user review every time.
