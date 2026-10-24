# SeeForMe Message Protocol — v1

Single source of truth for messages between the Safari extension (JavaScript, owned by Codex) and the native host (Swift, owned by Claude). Change this file only by agreement; bump `v` for breaking changes.

## 1. Transport

| Direction | Mechanism | Shape |
|---|---|---|
| Extension → host (request/reply) | `browser.runtime.sendNativeMessage("com.seeforme.app", message)` from the **background script only** | Resolves to exactly one `HOST_REPLY` |
| Host → extension (push, voice/app input) | `browser.runtime.connectNative("com.seeforme.app")` port, `port.onMessage` | `USER_INPUT` (section 5) |

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

## 4. Host → extension: `HOST_REPLY`

Every request gets exactly one reply.

| Field | Type | Rule |
|---|---|---|
| `requestId` | string | Echo of the request. |
| `sessionId` | string | Echo. |
| `status` | enum | `needs_input` · `ready_for_review` · `ended` · `error` |
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
... repeat until status == ready_for_review → highlight fields for the user's review. Never submit.
```

## 7. Hard rules (both sides)

1. **No submission.** The extension never submits a form, clicks buttons, or presses Enter in a field. The protocol has no submit action. The flow ends at `ready_for_review`, and the user submits by hand.
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
