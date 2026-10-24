# SeeForMe visual layer

The visual source is `extension/Resources/assistant-ui.js`. It creates a closed
shadow-root assistant using inline SVG, CSS, and DOM elements. It has no browser
API, native transport, form inspection, or field-filling capability.

`content.js` embeds a generated copy of this component before its existing
workflow. This keeps the currently configured `dom.js`, `content.js` load order
working without a manifest/Xcode change. Do not add assistant-ui.js to the
manifest or edit its generated copy directly.

After visual-source edits:

```
python3 extension/ui/build.py
python3 extension/ui/build.py --check
```

The builder replaces only the marked visual block and preserves the latest
workflow beneath it. It checks for a concurrent content.js edit before writing.
Claude can continue editing the workflow after `END GENERATED SEEFORME UI`.

## Display-only integration points

- The component returns the original input/start/send/reset DOM controls. Existing
  content.js handlers still own requests, disabled state, input clearing and reset.
- `renderState(message, { started, busy })` displays existing workflow states and
  questions. It never sends a request or advances the form.
- `updateSnapshot(snapshot)` retains only IDs and progress booleans. No values or
  labels are copied into the visual model.
- `updateStatus(result)` excludes missing/invalid required fields from progress.
- `showFillResult(result)` briefly highlights only verified successful IDs through
  the existing engine highlight API. It does not change action values or results.
  The original fill promise is returned unchanged to the background.
- Progress reflects existing snapshots/status reports; this layer does not add
  form observers, captures, retries, or status messages.
- Reset/navigation clear visual progress. Minimize, move, review and correction
  controls affect only the panel. Review never submits or clicks page controls.

## Voice and motion

Avatar treatments: idle, listening, thinking, speaking, completed. Real revision
1.2 VOICE_STATE pushes drive listening/thinking/speaking; transcribing maps to
thinking and error maps to idle with its message. Form processing does not imply
microphone activity. Review can show completed when no native voice state is active.

The existing native port accepts raw and Safari-wrapped pushes. Background
validation checks instanceId, seq, ttlMs and state-specific fields, rejects older
sequences, and routes display updates only to the active tab's session. Background
and panel expiry return the display to idle. Internal routing revisions reject
delayed deliveries across tab switches and background restarts.

`setVoiceState(activity)` takes the structured native envelope.
`clearVoiceState()` clears its display timer. Neither API changes the current
question, draft, or form workflow. Never infer listening from a transcript, open
port or pending question.

The microphone beside the typed input now uses the documented revision 1.4
native bridge after form inspection completes. The reference-inspired mint avatar
and SeeForMe heading sit above a charcoal call bar with speaker and red hang-up
controls. The bar is shown only for real non-idle voice states. Its waveform uses
validated native level values; mute state comes from native muted updates.
Acknowledgements never imply listening. Native command failures leave typed input
available. No audio pipeline or credentials are introduced in JavaScript.

The palette uses warm white, charcoal and teal. The SVG avatar is local, with CSS
animations. Reduced-motion disables all animations/transitions. Keyboard users
can use Escape to minimize, the labelled expand/move controls, and Command/Ctrl +
Enter to send (plain Enter remains multiline, IME composition is respected).
The panel moves or minimizes to avoid a focused page input, using DOM rectangles.
It never captures the screen or uses coordinates to click anything.

## Preview and tests

Open `extension/ui/preview.html` for a standalone visual fixture. The top controls
simulate all five avatar states; the page explicitly labels these as simulated.
It has no native connection, microphone capture, external requests or submission.
Resize the window, enable Reduce Motion, and test Tab/Escape and the move control.

From repository root:

```
/System/Library/Frameworks/JavaScriptCore.framework/Versions/A/Helpers/jsc extension/tests/content-ui.test.js
/System/Library/Frameworks/JavaScriptCore.framework/Versions/A/Helpers/jsc extension/tests/dom.test.js
/System/Library/Frameworks/JavaScriptCore.framework/Versions/A/Helpers/jsc extension/tests/protocol.test.js
```

The content/UI suite includes the visual suite. Tests use a lightweight DOM fixture,
not a rendering engine. They cover visual states, honest voice behavior, progress,
verified-fill feedback, draft preservation, keyboard interactions, field avoidance,
review, text safety, palette contrast, cleanup, and unchanged request/fill paths.
Safari layout, real screen-reader announcements and live native voice integration
still require in-browser validation; no screenshots are used by these tests.

Safari renderer check was attempted with `python3 extension/ui/check_safari.py`.
Safari refused the session because Allow remote automation is disabled. The
script did not change that setting, and no screenshot was taken. Once enabled
by the user, the same script can check viewport bounds and interactions using
DOM measurements only.

Claude revised the shared protocol during this UI work. That concurrent change
was preserved. This visual layer does not advertise new submission capabilities
or change any workflow/transport schema. Active review questions keep typed
answer access, while the Review form button only minimizes the assistant.


Revision 1.1 integration adds a submitting display state, retains typed input for
review questions, and clears any transient fill highlight when the native agent
asks an optional-field question with fieldIds: []. Submission policy and execution
remain in session.js/dom.js, not in this visual component. The current protocol
capability is now advertised by that guarded workflow, independently of the UI.

Revision 1.5 adds Language & voice settings inside the existing compact footer.
Language and voice preferences persist in extension storage; defaults come from
the native Mac language. The dropdown lists supported local-model/TTS language
intersections and curated voice presets. Settings take effect on the next Talk
start; no credentials or form answers are persisted.
