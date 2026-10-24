# SeeForMe Message Protocol — v1

Single source of truth for messages between the Safari extension (JavaScript, owned by Codex) and the native host (Swift, owned by Claude). Change this file only by agreement; bump `v` for breaking changes.

**Revision 1.1 (additive, `v` stays 1):** optional-field conversation (no wire change) and user-confirmed submission: `FORM_SNAPSHOT.submitAvailable`, `HOST_REPLY.status = "submit"`, and `SUBMIT_RESULT`. The host only sends `submit` when the snapshot reported `submitAvailable: true`, so an extension that never sets it keeps the old behaviour. See section 10.

**Revision 1.2 (additive, `v` stays 1):** `VOICE_STATE` push from the native app so the panel can show real voice activity. Extensions that ignore unknown push types are unaffected. See section 11.

**Revision 1.3 (additive, `v` stays 1):** `VOICE_START` / `VOICE_STOP` requests so voice can be controlled from Safari. See section 12.

**Revision 1.4 (additive, `v` stays 1):** Safari-first voice UI. `VOICE_STATE` gains `level` and `muted`; new `VOICE_MUTE` / `VOICE_UNMUTE`; mic-button flow and greeting. See section 13. Sections 11–12 remain valid.

## 1. Transport

| Direction | Mechanism | Shape |
|---|---|---|
| Extension → host (request/reply) | `browser.runtime.sendNativeMessage("com.seeforme.app", message)` from the **background script only** | Resolves to exactly one `HOST_REPLY` |
| Host → extension (push, voice/app input) | `browser.runtime.connectNative("com.seeforme.app")` port, `port.onMessage` | `USER_INPUT` (section 5), `VOICE_STATE` (section 11) |

- Content scripts never talk to the host directly. Content script ⇄ background uses ordinary `browser.runtime` / `browser.tabs` messaging (internal shape is Codex's choice).
- Safari routes native messages to the app's bundled extension handler; the application id argument is `"com.seeforme.app"`.
- Push messages may arrive either as a raw envelope or wrapped as `{ "name": "seeforme", "userInfo": <envelope> }` depending on Safari version. Accept both.
- If the background is unloaded the port closes; reconnect when the background wakes.

## 2. Envelope (all messages)

```json
{ "v": 1, "type": "FORM_SNAPSHOT", "sessionId": "8c1f…", "requestId": "41aa…" }
```

| Field | Type | Rule |
|---|---|---|
| `v` | int | Always `1`. Host replies `BAD_VERSION` otherwise. |
| `type` | string | One of the types below. |
| `sessionId` | string | UUID created by the extension per tab + page load. New id on navigation or origin change. |
| `requestId` | string | UUID per request. `HOST_REPLY` echoes it. |

Messages are flat: type-specific fields sit next to the envelope fields.

## 3. Extension → host

### 3.1 `FORM_SNAPSHOT`
Starts a session, or refreshes it (same `sessionId`) when the form changes, e.g. conditional fields appear. Host keeps already collected answers across refreshes.

| Field | Type | Rule |
|---|---|---|
| `pageOrigin` | string | From `sender.tab.url` in the background, **not** reported by the content script. Must be `https://…`, or `http://localhost` / `http://127.0.0.1` (any port) for test forms. |
| `pageTitle` | string | ≤ 120 chars. Optional. |
| `fields` | Field[] | ≤ 150 fields, document order. |
| `submitAvailable` | bool | Optional, default `false`. `true` only if the extension can submit this form safely (section 10.2). |

**Field**

| Field | Type | Rule |
|---|---|---|
| `id` | string | Stable extension-generated id (e.g. `f0`, `f1`), unique within the session. Not the raw DOM id. |
| `label` | string | Best human label (label element, aria-label, aria-labelledby, placeholder, name fallback). Trimmed, ≤ 120 chars. |
| `kind` | enum | `text` `email` `tel` `url` `number` `date` `time` `textarea` `select` `radio-group` `checkbox` |
| `required` | bool | `required` attribute or `aria-required="true"`. |
| `visible` | bool | Rendered and not `display:none` / `visibility:hidden` / zero-size. |
| `disabled` | bool | `disabled` or `readonly`. |
| `currentValuePresent` | bool | Field already has a non-empty value / checked state / non-placeholder selection. **Never send the value itself.** |
| `options` | Option[] | Only for `select` and `radio-group`. ≤ 50; set `optionsTruncated: true` if cut. Option = `{ "value": string, "label": string }`, label ≤ 80 chars. |
| `autocomplete` | string | Raw `autocomplete` attribute if present (e.g. `given-name`, `email`). Optional, high-value hint. |
| `placeholder` | string | ≤ 80 chars. Optional. |
| `maxLength` | int | Optional. |

**Do not include:** `password`, `hidden`, `file`, `submit`/`button`/`reset`/`image` inputs, payment-card fields (`autocomplete` starting `cc-`), or `select multiple`. Group same-`name` radios into one `radio-group` field. Each checkbox is its own `checkbox` field.

### 3.2 `USER_UTTERANCE`
| Field | Type | Rule |
|---|---|---|
| `text` | string | What the user typed or said. ≤ 1000 chars. |
| `source` | enum | `typed` \| `voice` \| `app` |

### 3.3 `FILL_RESULT`
Sent after applying the `actions` of a `HOST_REPLY`, once each field has been read back.

| Field | Type | Rule |
|---|---|---|
| `results` | Result[] | One per action. `{ "fieldId", "success": bool, "errorCode"? }` |
| `missingRequiredFieldIds` | string[] | Required + visible + enabled fields that are still empty after filling. |
| `validationIssues` | Issue[] | `{ "fieldId", "code", "message"? }`, see below. |

`Result.errorCode`: `NOT_FOUND` · `DISABLED` · `HIDDEN` · `HAS_VALUE` (populated and action lacked `overwrite`) · `OPTION_NOT_FOUND` · `VALUE_REJECTED` (value did not stick on read-back) · `ORIGIN_CHANGED`.

`Issue.code`: `REQUIRED_MISSING` · `TYPE_MISMATCH` · `PATTERN_MISMATCH` · `TOO_LONG` · `OTHER`. `message` is the browser's `validationMessage`, ≤ 120 chars (untrusted page text).

### 3.4 `FORM_STATUS`
Standalone re-check, e.g. after the user edits fields by hand or before showing review. Same `missingRequiredFieldIds` and `validationIssues` fields as `FILL_RESULT`, without `results`.

### 3.5 `SESSION_RESET`
No extra fields. Host discards everything for the session. Send on tab close, navigation, or user "start over".

### 3.6 `SUBMIT_RESULT`
Sent once, after acting on a `HOST_REPLY` with `status: "submit"`.

| Field | Type | Rule |
|---|---|---|
| `success` | bool | `true` if the extension called `requestSubmit` on the form and no validation error stopped it. |
| `errorCode` | string? | When `success` is `false`: `NO_SUBMIT_CONTROL` · `VALIDATION_FAILED` · `MISSING_REQUIRED` · `ORIGIN_CHANGED` · `FORM_CHANGED` · `OTHER`. |

The host replies `status: "ended"` on success, or `ready_for_review` with a message on failure, and never asks to submit again in that session.

## 4. Host → extension: `HOST_REPLY`

Every request gets exactly one reply.

| Field | Type | Rule |
|---|---|---|
| `requestId` | string | Echo of the request. |
| `sessionId` | string | Echo. |
| `status` | enum | `needs_input` · `ready_for_review` · `submit` · `ended` · `error`. `submit` always has empty `actions` and no `question` (section 10). |
| `actions` | Action[] | Possibly empty. Apply in order. |
| `question` | Question? | Next thing to ask the user. Show it (and the host may speak it). |
| `message` | string? | Short user-facing status line, e.g. "Filled first name and email." |
| `modelAvailable` | bool | `false` → host is using its non-AI fallback matcher; show a small notice. |
| `errorCode` | string? | Only when `status == "error"`. |

**Action** — `{ "fieldId": string, "value": string, "overwrite"?: bool }`

| `kind` | `value` format |
|---|---|
| text-like, `textarea` | Literal string. |
| `email` `tel` `url` `number` | Literal string, already normalised by host. |
| `date` | `YYYY-MM-DD` |
| `time` | `HH:MM` (24 h) |
| `select`, `radio-group` | Exactly one of the field's `options[].value`. |
| `checkbox` | `"true"` or `"false"` |

The extension must set values so frameworks notice (native value setter, then `input` and `change` events), then read the value back for `FILL_RESULT`. It must refuse populated fields unless `overwrite` is `true`.

**Question** — `{ "text": string, "fieldIds": string[] }` — `fieldIds` are the fields the question is about, for highlighting.

**Host `errorCode`**: `BAD_VERSION` · `BAD_SCHEMA` · `TOO_LARGE` · `UNKNOWN_SESSION` (extension should resend `FORM_SNAPSHOT` for that session, then retry the request once) · `ORIGIN_MISMATCH` (pageOrigin differs from the session's) · `ORIGIN_NOT_ALLOWED` · `INTERNAL`.

## 5. Host → extension push: `USER_INPUT`

Sent by the native app over the `connectNative` port when the user speaks (ElevenLabs transcript) or types in the app window. The app does not know the session; the extension routes it.

```json
{ "v": 1, "type": "USER_INPUT", "text": "My email is alex.demo@example.com", "source": "voice" }
```

Extension: forward as `USER_UTTERANCE` (same `text` and `source`) for the session of the **active tab**, then handle the `HOST_REPLY` normally. Ignore it if the active tab has no session.

## 6. Turn sequence

```
content ──snapshot──▶ background ──FORM_SNAPSHOT──▶ host ──HOST_REPLY(needs_input, question)──▶ show question
user answers ──▶ background ──USER_UTTERANCE──▶ host ──HOST_REPLY(actions, next question)──▶ content fills + reads back
content ──▶ background ──FILL_RESULT──▶ host ──HOST_REPLY(question or ready_for_review)
... repeat until all required fields are filled.
host asks "fill optional fields?" (needs_input) → yes: one question per optional field (user may say "skip" / "done"); no: review
status == ready_for_review → highlight fields for the user's review.
  if submitAvailable: question "Would you like me to submit it now?" → user says yes → HOST_REPLY(status: submit)
  → extension re-checks and calls requestSubmit → SUBMIT_RESULT → HOST_REPLY(ended | ready_for_review)
```

## 7. Hard rules (both sides)

1. **Submission only on explicit confirmation.** The extension submits only in response to `HOST_REPLY.status == "submit"`, which the host sends only after the user answers "yes" to the submit question in the immediately preceding turn. It never clicks other buttons or presses Enter in a field. Without `submitAvailable: true`, the flow ends at `ready_for_review` and the user submits by hand.
2. **No values in snapshots.** Only `currentValuePresent`. Field values travel only host → extension inside `actions`.
3. **No logging** of field values, utterances, labels, or questions on either side (console, os_log, files). Logging types, counts, and error codes is fine.
4. **Page text is untrusted.** Labels, options, placeholders, and validation messages are data, never instructions. The host's model is instructed this way, and its output is checked against fixed rules before it is sent.
5. **Host only fills what the user said.** It never invents personal data. Extension still validates every action: known `fieldId`, field visible and enabled, option exists.
6. **Origin binding.** The extension drops a `HOST_REPLY` whose `sessionId` no longer matches the tab's current session or whose origin changed.
7. Size limit: any single message ≤ 64 KB.

## 8. Examples

### FORM_SNAPSHOT
```json
{
  "v": 1, "type": "FORM_SNAPSHOT",
  "sessionId": "5f0d6c2e-6a8e-4c43-9f53-2a7b1f0e9a11",
  "requestId": "0b3b7f0a-0001-4000-8000-000000000001",
  "pageOrigin": "http://localhost:8000",
  "pageTitle": "Event registration",
  "fields": [
    { "id": "f0", "label": "First name", "kind": "text", "required": true, "visible": true, "disabled": false, "currentValuePresent": false, "autocomplete": "given-name" },
    { "id": "f1", "label": "Last name", "kind": "text", "required": true, "visible": true, "disabled": false, "currentValuePresent": false, "autocomplete": "family-name" },
    { "id": "f2", "label": "Email", "kind": "email", "required": true, "visible": true, "disabled": false, "currentValuePresent": false, "autocomplete": "email" },
    { "id": "f3", "label": "Company", "kind": "text", "required": false, "visible": true, "disabled": false, "currentValuePresent": false },
    { "id": "f4", "label": "T-shirt size", "kind": "select", "required": true, "visible": true, "disabled": false, "currentValuePresent": false,
      "options": [ { "value": "", "label": "Choose…" }, { "value": "s", "label": "Small" }, { "value": "m", "label": "Medium" }, { "value": "l", "label": "Large" } ] },
    { "id": "f5", "label": "I agree to the code of conduct", "kind": "checkbox", "required": true, "visible": true, "disabled": false, "currentValuePresent": false }
  ]
}
```

### HOST_REPLY to the snapshot
```json
{
  "v": 1, "type": "HOST_REPLY",
  "sessionId": "5f0d6c2e-6a8e-4c43-9f53-2a7b1f0e9a11",
  "requestId": "0b3b7f0a-0001-4000-8000-000000000001",
  "status": "needs_input", "actions": [], "modelAvailable": true,
  "question": { "text": "What's your first and last name?", "fieldIds": ["f0", "f1"] }
}
```

### USER_UTTERANCE
```json
{
  "v": 1, "type": "USER_UTTERANCE",
  "sessionId": "5f0d6c2e-6a8e-4c43-9f53-2a7b1f0e9a11",
  "requestId": "0b3b7f0a-0002-4000-8000-000000000002",
  "text": "I'm Alex Demo, email alex.demo@example.com, medium shirt",
  "source": "typed"
}
```

### HOST_REPLY with actions
```json
{
  "v": 1, "type": "HOST_REPLY",
  "sessionId": "5f0d6c2e-6a8e-4c43-9f53-2a7b1f0e9a11",
  "requestId": "0b3b7f0a-0002-4000-8000-000000000002",
  "status": "needs_input", "modelAvailable": true,
  "actions": [
    { "fieldId": "f0", "value": "Alex" },
    { "fieldId": "f1", "value": "Demo" },
    { "fieldId": "f2", "value": "alex.demo@example.com" },
    { "fieldId": "f4", "value": "m" }
  ],
  "message": "Filled first name, last name, email and T-shirt size.",
  "question": { "text": "Do you agree to the code of conduct?", "fieldIds": ["f5"] }
}
```

### FILL_RESULT
```json
{
  "v": 1, "type": "FILL_RESULT",
  "sessionId": "5f0d6c2e-6a8e-4c43-9f53-2a7b1f0e9a11",
  "requestId": "0b3b7f0a-0003-4000-8000-000000000003",
  "results": [
    { "fieldId": "f0", "success": true },
    { "fieldId": "f1", "success": true },
    { "fieldId": "f2", "success": true },
    { "fieldId": "f4", "success": true }
  ],
  "missingRequiredFieldIds": ["f5"],
  "validationIssues": []
}
```

### HOST_REPLY, ready for review
```json
{
  "v": 1, "type": "HOST_REPLY",
  "sessionId": "5f0d6c2e-6a8e-4c43-9f53-2a7b1f0e9a11",
  "requestId": "0b3b7f0a-0005-4000-8000-000000000005",
  "status": "ready_for_review", "actions": [], "modelAvailable": true,
  "message": "All required fields are filled. Please review the form and submit it yourself."
}
```

### HOST_REPLY, error
```json
{
  "v": 1, "type": "HOST_REPLY",
  "sessionId": "5f0d6c2e-6a8e-4c43-9f53-2a7b1f0e9a11",
  "requestId": "0b3b7f0a-0006-4000-8000-000000000006",
  "status": "error", "actions": [], "modelAvailable": true,
  "errorCode": "UNKNOWN_SESSION"
}
```

## 9. Repository layout and ownership

| Path | Owner |
|---|---|
| `contract/PROTOCOL.md` | Shared, change by agreement |
| `extension/Resources/` (background/content JS) and `extension/tests/` | Codex |
| `seeforme/SeeForMeExtension/manifest.json` (permissions, script load order) | Claude |
| Everything else under `seeforme/` including `seeforme.xcodeproj` | Claude |

Build wiring:
- The `SeeForMeExtension` target copies every file in `extension/Resources/` and `seeforme/SeeForMeExtension/manifest.json` flat into the extension bundle's `Contents/Resources/`. Keep `extension/Resources/` flat (no subfolders). New files there are picked up automatically, but a new script must also be added to `manifest.json` (ask Claude).
- Current load order: background `protocol.js`, `session.js`; content scripts `dom.js`, `content.js` at `document_idle`, top frame only.
- Native app id is `com.seeforme.app`; extension bundle id is `com.seeforme.app.extension`.
- Typed input UI (in-page panel) is extension-side and sends `USER_UTTERANCE` with `source: "typed"`.

## 10. Optional fields and confirmed submission (revision 1.1)

### 10.1 Optional fields (host only, no wire change)
After the required fields are filled, the host asks `needs_input` with a question such as *"All required fields are filled. Would you like to fill in optional fields, such as "Company"? Say yes or no."* and `fieldIds: []`. On yes it asks one optional field at a time (`fieldIds: [id]`); "skip" leaves that field blank and "done" ends optional fields. On no it moves to review. The extension treats these like any other question.

### 10.2 `submitAvailable` (extension decides)
Set `true` in `FORM_SNAPSHOT` only when **all** of these hold:
- All snapshot fields belong to one `<form>` element, and that form has exactly one enabled, visible submit control (`button[type=submit]`, a `<button>` with no type, or `input[type=submit]`).
- The form has no `password`, `file`, or payment-card (`autocomplete` `cc-*`) inputs.
- The page is the same top-level document the session started on.

Otherwise send `false` or omit it. The local test form has no submit control, so it reports `false` and is never submitted.

### 10.3 Handling `status: "submit"`
1. Check the reply's `sessionId` and the tab's origin and document are unchanged; otherwise `SUBMIT_RESULT` with `ORIGIN_CHANGED` / `FORM_CHANGED`.
2. Re-run the required-field and validity checks (`form.checkValidity()`); on failure send `MISSING_REQUIRED` or `VALIDATION_FAILED` and highlight the fields. Do not submit.
3. Call `form.requestSubmit(submitControl)` exactly once, so the page's own validation and handlers run. Never call `form.submit()`, never synthesize key presses, never click any other element.
4. Send `SUBMIT_RESULT` with `success: true`, then treat the session as finished (navigation will reset it anyway).
5. Show the host's `message` as returned (e.g. "Submitting the form now.").

### 10.4 Examples
```json
{ "v": 1, "type": "HOST_REPLY", "sessionId": "5f0d6c2e-6a8e-4c43-9f53-2a7b1f0e9a11", "requestId": "0b3b7f0a-0007-4000-8000-000000000007",
  "status": "ready_for_review", "actions": [], "modelAvailable": true,
  "message": "Everything is filled in. Please review the form.",
  "question": { "text": "Would you like me to submit it now? Say yes to submit, or no to submit it yourself.", "fieldIds": [] } }
```
```json
{ "v": 1, "type": "HOST_REPLY", "sessionId": "5f0d6c2e-6a8e-4c43-9f53-2a7b1f0e9a11", "requestId": "0b3b7f0a-0008-4000-8000-000000000008",
  "status": "submit", "actions": [], "modelAvailable": true, "message": "Submitting the form now." }
```
```json
{ "v": 1, "type": "SUBMIT_RESULT", "sessionId": "5f0d6c2e-6a8e-4c43-9f53-2a7b1f0e9a11", "requestId": "0b3b7f0a-0009-4000-8000-000000000009",
  "success": true }
```

## 11. Voice activity: `VOICE_STATE` push (revision 1.2)

Sent by the native app over the same `connectNative` port as `USER_INPUT`, on **every real change** of the voice pipeline's state, and repeated every 5 s while not `idle` (heartbeat). It contains no transcript, spoken text, or form content.

```json
{ "v": 1, "type": "VOICE_STATE", "state": "listening", "speechDetected": true,
  "instanceId": "3f6c0d1e-8a4b-4c1e-9b7a-0f2d5e6a7b8c", "seq": 42, "ttlMs": 15000 }
```

| Field | Type | Rule |
|---|---|---|
| `state` | enum | See table below. |
| `speechDetected` | bool? | Only with `listening`: `true` while the microphone is currently picking up speech. |
| `message` | string? | Only with `error`: short, content-free reason (e.g. "ElevenLabs quota or rate limit reached."). ≤ 200 chars. |
| `instanceId` | string | UUID per native app launch. |
| `seq` | int | Increases by 1 with every push from this `instanceId`, heartbeats included. |
| `ttlMs` | int | Show the state at most this long after receipt unless another `VOICE_STATE` arrives. |
| `level` | number? | Revision 1.4. 0…1 real audio loudness: microphone while `listening`, playback while `speaking`. Absent in other states. |
| `muted` | bool? | Revision 1.4. `true` while spoken replies are muted. Present on every push from 1.4 hosts. |

| `state` | Exactly when the native app sends it |
|---|---|
| `idle` | Voice is turned off, or the app is quitting. |
| `listening` | Microphone is live and accepting speech. Not sent while transcribing, thinking, or speaking (the microphone is ignored then). |
| `transcribing` | A finished utterance has been sent to ElevenLabs speech-to-text. |
| `thinking` | The transcript was sent to the extension and SeeForMe is reasoning and filling, **or** the reply's audio is being generated. |
| `speaking` | Reply audio is playing right now (starts when playback starts, not when audio is requested). |
| `error` | A voice step failed. The app returns to `listening` about 3 s later and sends that state. |

Extension rules:
1. **Display only.** `VOICE_STATE` never sends a request, advances the form, or fills anything. Do not infer voice state from anything else (transcripts, open port, pending questions).
2. **Ordering.** Keep the last `instanceId` and `seq`. Ignore a push with the same `instanceId` and a `seq` ≤ the last one. A new `instanceId` replaces the old one (the app restarted).
3. **Expiry.** If no `VOICE_STATE` arrives within `ttlMs` of the last one, show `idle`. (The app may have quit or crashed.)
4. **Where to show it.** Apply it to the panel in the **active tab** (where voice answers are routed, section 5). Tabs without a SeeForMe session ignore it.
5. Accept both raw and Safari-wrapped (`{ "name": "seeforme", "userInfo": … }`) pushes, as for `USER_INPUT`.
6. Suggested mapping to the avatar: `idle` → idle; `listening` → listening; `transcribing`/`thinking` → thinking; `speaking` → speaking; `error` → idle plus the `message` text.

## 12. Voice control from Safari: `VOICE_START` / `VOICE_STOP` (revision 1.3)

Voice runs in the native app (microphone, ElevenLabs, on-device reasoning). Safari starts and stops it with these requests over the normal `sendNativeMessage` transport. They carry no page or form content and need no session.

```json
{ "v": 1, "type": "VOICE_START", "requestId": "0b3b7f0a-0010-4000-8000-000000000010" }
```

Reply (not a `HOST_REPLY`):

```json
{ "v": 1, "type": "VOICE_ACK", "requestId": "0b3b7f0a-0010-4000-8000-000000000010", "accepted": true, "appLaunched": false }
```

- `VOICE_START`: starts a voice conversation; no-op if one is running. If the app isn't running, the extension process launches it with voice on (`appLaunched: true`).
- `VOICE_STOP`: ends the conversation immediately (same as the call bar's hang-up button).
- `accepted: false` means the app couldn't be reached or launched.
- Actual voice activity is reported by `VOICE_STATE` (section 11); `accepted` only means the command was delivered.

Native-owned implementation: `seeforme/SeeForMeExtension/voice-bridge.js` (background script) sends `VOICE_START` when the Safari toolbar button is clicked, and accepts `browser.runtime.sendMessage({ channel: "seeforme-voice", operation: "start" | "stop" })` from other extension scripts, so the panel can add its own start/stop controls later. It replies `{ ok: boolean }`.

During a conversation the native app shows a floating call bar above Safari (speaker/mute, live waveform driven by real microphone/playback levels, hang-up). It does not take focus, so the page and the SeeForMe panel stay usable.

## 13. Safari-first voice experience (revision 1.4)

The Safari extension is the whole user interface. The native voice host (microphone, ElevenLabs, playback) runs in the background and is launched on demand; the user never opens or switches to the Mac app.

### 13.1 Mic button → conversation
1. User clicks the SeeForMe mic in the in-page panel.
2. Content script runs the existing inspect flow (`operation: "start"` → `FORM_SNAPSHOT`) and **waits for its reply**, so the host knows the first question.
3. Content script sends `browser.runtime.sendMessage({ channel: "seeforme-voice", operation: "start" })`. Reply: `{ ok: boolean, appLaunched?: boolean }`. `ok: false` → show "Couldn't start voice" with a retry; do not show the call bar as active.
4. The host greets ("Hi, I'm SeeForMe.") followed by the current question, then listens. All of this is reported via `VOICE_STATE`.
5. Typed input stays available at all times; voice and typed answers go through the same session.

### 13.2 Call bar (in-page)
Show while the latest valid `VOICE_STATE` is not `idle` (and not expired per section 11). Visual spec: dark charcoal pill with fully rounded ends; left circular grey speaker button; centre waveform; right red circular hang-up button with a white phone icon; subtle shadow; smooth transitions; must not block form fields (keep the existing field-avoidance behaviour).

| `state` | Waveform |
|---|---|
| `listening` | Bars follow `level` (microphone). Brighter when `speechDetected: true`. |
| `speaking` | Bars follow `level` (playback). |
| `transcribing`, `thinking` | Bars low and static with a soft processing shimmer (clearly not audio). |
| `error` | Bars flat; show `message`. |

- Hang-up → `{ channel: "seeforme-voice", operation: "stop" }` (host sends `VOICE_STOP` to the voice host; state becomes `idle`).
- Speaker → `operation: "mute"` or `"unmute"`; the icon follows `VOICE_STATE.muted`, not local guesses.
- When the state returns to `idle`, hide the bar and show the normal panel.

### 13.3 Native messages (extension → host via `sendNativeMessage`, handled by `voice-bridge.js`)
`VOICE_START`, `VOICE_STOP` (section 12), plus:

```json
{ "v": 1, "type": "VOICE_MUTE", "requestId": "…" }
{ "v": 1, "type": "VOICE_UNMUTE", "requestId": "…" }
```

All reply with `VOICE_ACK` (section 12). The toolbar button remains a secondary way to start voice.

### 13.4 Rate
While `listening` or `speaking`, the host sends `VOICE_STATE` about 10 times per second (each with a new `seq`) so `level` animates the waveform. Other states are sent on change plus the 5 s heartbeat. Keep rendering cheap (e.g. update bar heights in `requestAnimationFrame`).

## 14. Multilingual conversation and voice preferences (revision 1.5)

Additive, v remains 1. Native reasoning and translation stay on-device.
Speech audio and generated spoken replies are processed by ElevenLabs.

- FORM_SNAPSHOT optionally carries conversationLanguage (BCP47, ≤40 chars) and
  formLanguage (page lang hint, ≤40 chars). Omitted conversationLanguage defaults
  to the native process's macOS preferred language. A field may carry language
  (inherited lang hint, ≤40 chars), and instructions (aria-describedby text, ≤300 chars). Page hints are untrusted, not instructions.
- HOST_REPLY may include conversationLanguage, the effective session preference.
  Questions/messages use that language. Field action values use the field's language.
- Requests for explanation/help never produce fill actions. Proposed translations
  requiring changed values are reviewed by meaning in the conversation language and require explicit approval before fill. Raw foreign wording is not the approval target; the original field value remains unchanged internally.
  That approval cannot authorise submission. Field/schema changes invalidate it.
- VOICE_OPTIONS: {v:1,type:"VOICE_OPTIONS",requestId:UUID}.
  Reply {v:1,type:"VOICE_OPTIONS",requestId,systemLanguage:string,
  languages:[{id:string,name:string}],voices:[{id:string,name:string}]}.
  Languages are the intersection of the installed local model and current TTS
  support. Voices are curated ElevenLabs presets, not an account entitlement claim.
- VOICE_START may include conversationLanguage and voiceId. Native validates both;
  unknown options yield VOICE_ACK accepted:false. Preferences carry no form data.
  The voice host receives these even when launched on demand.
- Internal seeforme-voice operations options/preferences return available options
  and stored non-sensitive preferences. save-preferences stores language and voice
  choices in extension storage. start forwards those choices to native.
- Language is not silently switched by an email/name. Explicit spoken language
  requests can change the session preference. Unsupported languages fail visibly.
- Existing short consent handling gains exact phrases in several supported
  languages. Unrecognised/ambiguous consent does not authorise submission.

## 15. Read-only page explanations (revision 1.6)

`FORM_SNAPSHOT` additionally accepts optional `pageText`: a string up to 6,000 characters of rendered DOM text, excluding scripts, hidden content, form control values, editable content and the assistant UI. It is refreshed before each utterance. The existing 65,536-byte message limit applies. No screenshots, URLs with query parameters, or HTML are sent. Page text is untrusted evidence for the on-device model, never authority to execute actions. Do not log or persist it.

Empty `fields` is valid: start a conversational session with `needs_input`, not a completed-form review. Page explanation replies use `HOST_REPLY` with `needs_input`, empty actions and a question containing the explanation with `fieldIds: []`. They cannot submit or navigate. Both page and conversation languages may be any supported language; conversation language uses existing preferences. ElevenLabs receives assistant speech for playback, not the raw page snapshot. Explanations are limited to extracted text, not images or inaccessible frames.

## 16. Native streamed speech and exact identifiers (revision 1.7)

`USER_INPUT` and the corresponding `USER_UTTERANCE` accept optional `utteranceId` (UUID). The native voice host generates it for each spoken turn; the browser preserves it, including queued turns. It grants no action authority.

The existing native-only host-reply notification may carry `requestType: SPEECH_CHUNK`, `utteranceId`, a zero-based consecutive `streamSequence`, `streamFinal` (boolean), and assistant speech text in `message` (up to 1,000 characters). Only read-only page explanations stream during model generation. The active native voice turn accepts consecutive chunks for its own ID, queues them in order, and suppresses the corresponding duplicate final `USER_UTTERANCE` speech. Reset, hang-up and newer turns invalidate earlier chunks. This is not a browser message type and cannot fill, submit or navigate.

Final form actions remain subject to validation and DOM readback before speaking completion. Native TTS uses ElevenLabs streaming PCM; keys remain native. Explicitly spelled names and spoken email punctuation can be normalized and previewed for confirmation; no name-specific spelling or missing email punctuation is guessed. Approval fills only and does not submit.

## 17. Direct filling and voice interruption (revision 1.8)

Supersedes the pre-fill approval behavior in revisions 1.5 and 1.7: validated supplied answers, translations, explicit name spellings and email addresses fill immediately. Ask for clarification only when a usable value cannot be determined. This does not change section 10: submission still requires fresh explicit approval and DOM revalidation.

The native microphone remains active during speech playback, using AVAudioEngine voice processing. Playback uses a separate native engine because the shared graph failed initialization on the test Mac; acoustic echo performance requires live verification. Sustained detected speech interrupts playback, clears queued speech, invalidates the old utterance ID and preserves captured pre-roll for transcription. No additional browser command or audio pipeline is introduced.
