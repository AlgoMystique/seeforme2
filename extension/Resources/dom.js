/* DOM-only engine. Internal API; wire messages only through contract/PROTOCOL.md. */
(function (root) {
  'use strict';
  function createEngine(doc, win) {
    const ids = new WeakMap(), elements = new Map(), used = new Set();
    const documentId = win.crypto.randomUUID();
    const initialURL = win.location.href, initialOrigin = win.location.origin;
    const nativeCheckValidity = win.HTMLFormElement?.prototype.checkValidity;
    const nativeRequestSubmit = win.HTMLFormElement?.prototype.requestSubmit;
    let submissionCandidate = null, reviewedSubmission = null, submitAttempted = false, submitExecuted = false;
    let sequence = 0, revision = 0, snapshotState = null, disposed = false;
    const clean = value => String(value || '').replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, 300);
    function label(el) {
      const refs = (el.getAttribute('aria-labelledby') || '').split(/\s+/).filter(Boolean);
      return clean(refs.map(id => doc.getElementById(id)?.textContent || '').join(' ') ||
        el.getAttribute('aria-label') || Array.from(el.labels || [], l => l.textContent).join(' ') ||
        el.getAttribute('placeholder') || el.name);
    }
    function eligible(el) {
      const tag = el.tagName.toLowerCase(), type = (el.type || '').toLowerCase();
      if (!['input', 'select', 'textarea'].includes(tag) || !el.isConnected || el.disabled ||
          el.matches(':disabled') || el.readOnly || el.multiple || el.closest('[inert], [hidden], [aria-hidden="true"]')) return false;
      if (tag === 'input' && !['text', 'email', 'tel', 'url', 'search', 'number', 'date', 'time', 'checkbox', 'radio'].includes(type)) return false;
      const hint = [el.autocomplete, el.name, el.id, label(el)].join(' ');
      if (/\bcc-|password|passcode|one.time|otp|\bcvv\b|\bcvc\b|credit.?card|card.?number|security.?code|social.?security|\bssn\b|routing|bank.?account|payment|captcha|turnstile|\busername\b|webauthn|transaction-(amount|currency)/i.test(hint)) return false;
      const style = win.getComputedStyle(el);
      return style.display !== 'none' && style.visibility !== 'hidden' && style.visibility !== 'collapse' && el.getClientRects().length > 0;
    }
    function value(el) { return ['checkbox', 'radio'].includes(el.type) ? el.checked : el.value; }
    function metadata(el) {
      let id = ids.get(el);
      if (!id) { id = documentId + ':' + (++sequence); ids.set(el, id); elements.set(id, el); }
      const choice = ['checkbox', 'radio'].includes(el.type);
      return { id, label: label(el), type: el.tagName.toLowerCase() === 'textarea' ? 'textarea' : el.type,
        name: clean(el.name), autocomplete: clean(el.autocomplete), required: !!el.required || el.getAttribute('aria-required') === 'true',
        visible: true, disabled: false, currentValuePresent: choice ? el.checked : el.value !== '',
        options: el.tagName === 'SELECT' ? Array.from(el.options).slice(0, 200).map(o => ({ value: o.value, label: clean(o.label), disabled: !!o.disabled || !!o.parentElement?.disabled })) : [],
        group: el.type === 'radio' ? clean(el.name) : null,
        constraints: Object.fromEntries(['min', 'max', 'step', 'minlength', 'maxlength', 'pattern'].map(k => [k, el.getAttribute(k)]).filter(([, v]) => v !== null)) };
    }
    function capture() {
      if (disposed) throw new Error('INACTIVE_DOCUMENT');
      used.clear();
      const records = Array.from(doc.querySelectorAll('input,textarea,select')).filter(eligible).slice(0, 500).map(el => ({ el, field: metadata(el), value: value(el), form: el.form, name: el.name }));
      snapshotState = { url: win.location.href, revision: ++revision, records };
      // Do not retain detached nodes across snapshots.
      elements.clear(); records.forEach(r => elements.set(r.field.id, r.el));
      return { documentId, revision, pageOrigin: win.location.origin, fields: records.map(r => r.field) };
    }
    function contextValid(context) {
      return !!context && !disposed && snapshotState && context.documentId === documentId && context.revision === snapshotState.revision && win.location.href === snapshotState.url;
    }
    function setNative(el, property, next) {
      const proto = el.tagName === 'INPUT' ? win.HTMLInputElement.prototype : el.tagName === 'SELECT' ? win.HTMLSelectElement.prototype : win.HTMLTextAreaElement.prototype;
      Object.getOwnPropertyDescriptor(proto, property).set.call(el, next);
    }
    async function fill(context, actions, overwriteIds = []) {
      if (!context || !contextValid(context)) return { error: 'STALE_CONTEXT', results: [] };
      if (!Array.isArray(actions) || actions.length > 100 || !Array.isArray(overwriteIds)) return { error: 'INVALID_ACTIONS', results: [] };
      const seen = new Set(), results = [];
      for (const action of actions) {
        const fieldId = action?.fieldId;
        const fail = errorCode => results.push({ fieldId: typeof fieldId === 'string' ? fieldId : '', success: false, errorCode });
        if (!contextValid(context)) { fail('STALE_CONTEXT'); continue; }
        if (!action || typeof fieldId !== 'string' || seen.has(fieldId)) { fail('INVALID_ACTION'); continue; }
        seen.add(fieldId);
        const key = context.revision + ':' + fieldId;
        if (used.has(key)) { fail('DUPLICATE_ACTION'); continue; }
        const record = snapshotState.records.find(r => r.field.id === fieldId), el = elements.get(fieldId);
        if (!record || !el || !eligible(el) || el.form !== record.form || el.name !== record.name || JSON.stringify(metadata(el)) !== JSON.stringify(record.field) || value(el) !== record.value) { fail('FIELD_CHANGED'); continue; }
        const isChoice = ['checkbox', 'radio'].includes(el.type), next = action.value;
        if ((isChoice && typeof next !== 'boolean') || (!isChoice && typeof next !== 'string') || (!isChoice && next.length > 10000)) { fail('INVALID_VALUE'); continue; }
        if (record.field.currentValuePresent && !overwriteIds.includes(fieldId)) { fail('OVERWRITE_DENIED'); continue; }
        if (el.tagName === 'SELECT' && (el.multiple || !Array.from(el.options).some(o => o.value === next && !o.disabled && !o.parentElement?.disabled))) { fail('INVALID_OPTION'); continue; }
        if (el.type === 'radio' && next && Array.from(doc.querySelectorAll('input')).some(other => other !== el && other.type === 'radio' && other.name === el.name && other.form === el.form && other.checked && !overwriteIds.includes(ids.get(other)))) { fail('OVERWRITE_DENIED'); continue; }
        used.add(key);
        const previous = value(el), property = isChoice ? 'checked' : 'value';
        try {
          setNative(el, property, next);
          // Reject constraint failures before notifying page code.
          if (el.validity && !el.validity.valid) { setNative(el, property, previous); fail('INVALID_VALUE'); continue; }
          el.dispatchEvent(new win.Event('input', { bubbles: true, composed: true }));
          el.dispatchEvent(new win.Event('change', { bubbles: true, composed: true }));
          await new Promise(resolve => win.setTimeout(resolve, 0));
          if (!contextValid(context) || !eligible(el) || value(el) !== next) { fail('VERIFICATION_FAILED'); continue; }
          results.push({ fieldId, success: true });
        } catch (_) { fail('FILL_FAILED'); }
      }
      return { results };
    }
    // Protocol adapter state is local to this document; no DOM values cross snapshots.
    let wireGroups = new Map();
    const highlighted = new Map();
    function highlight(fieldIds) {
      for (const [el,previous] of highlighted) {el.style.outline=previous.outline;el.style.outlineOffset=previous.offset;}
      highlighted.clear();
      for (const id of fieldIds) for (const r of wireGroups.get(id)?.members || []) {
        if (!eligible(r.el)) continue;
        highlighted.set(r.el,{outline:r.el.style.outline,offset:r.el.style.outlineOffset});
        r.el.style.outline='3px solid #167580';r.el.style.outlineOffset='3px';
      }
    }
    // Read only rendered semantic text, never input values or editable content.
    function pageText() {
      if (!doc.createTreeWalker || !doc.body) return '';
      const walker=doc.createTreeWalker(doc.body,4), parts=[];let length=0,node,visited=0;
      while ((node=walker.nextNode()) && visited++ < 20000 && length < 6000) {
        const el=node.parentElement;
        if (!el || el.closest('script,style,noscript,template,input,textarea,select,[contenteditable]:not([contenteditable="false"]),[hidden],[aria-hidden="true"],seeforme-assistant')) continue;
        if (!el.getClientRects().length || win.getComputedStyle(el).visibility !== 'visible') continue;
        const text=node.textContent.replace(/\s+/g,' ').trim();
        if (!text) continue;
        const part=text.slice(0,6000-length);parts.push(part);length+=part.length+1;
      }
      return parts.join('\n').slice(0,6000);
    }
    function captureProtocol() {
      const context = capture(), fields = [], grouped = new Set();
      wireGroups = new Map();
      for (const record of snapshotState.records) {
        const {el,field:f} = record;
        if (grouped.has(el)) continue;
        let members = [record], kind = el.tagName === 'SELECT' ? 'select' : f.type === 'search' ? 'text' : f.type;
        if (el.type === 'radio') {
          kind = 'radio-group';
          members = snapshotState.records.filter(r => r.el.type === 'radio' && (el.name ? r.el.name === el.name && r.el.form === el.form && r.el.getRootNode?.() === el.getRootNode?.() : r.el === el));
          members.forEach(r => grouped.add(r.el));
        }
        const groupLabel = kind === 'radio-group' ? clean(el.closest('fieldset')?.querySelector('legend')?.textContent || el.getAttribute('aria-label') || el.name) : f.label;
        const out = {id:f.id,label:groupLabel.slice(0,120),kind,required:members.some(r => r.field.required),visible:true,disabled:false,currentValuePresent:members.some(r => r.field.currentValuePresent)};
        const language=el.closest('[lang]')?.getAttribute('lang');
        if (language && /^[a-zA-Z]{2,3}(?:-[a-zA-Z0-9]{2,8})*$/.test(language)) out.language=language.slice(0,40);
        if (f.autocomplete) out.autocomplete=f.autocomplete;
        const describedBy=(el.getAttribute('aria-describedby') || '').split(/\s+/).filter(Boolean).slice(0,4);
        const instructions=describedBy.map(id => doc.getElementById?.(id)?.textContent || '').join(' ');
        if (instructions.trim()) out.instructions=clean(instructions).slice(0,300);
        const placeholder=el.getAttribute('placeholder'); if (placeholder) out.placeholder=clean(placeholder).slice(0,80);
        if (Number.isInteger(el.maxLength) && el.maxLength >= 0) out.maxLength=el.maxLength;
        if (kind === 'select' || kind === 'radio-group') {
          const options = kind === 'select' ? f.options.filter(o => !o.disabled) : members.map(r => ({value:r.el.value,label:r.field.label}));
          out.options=options.slice(0,50).map(o => ({value:o.value,label:clean(o.label).slice(0,80)}));
          if (options.length > 50 || (kind === 'select' && el.options.length > 200)) out.optionsTruncated=true;
        }
        wireGroups.set(out.id,{members,field:out}); fields.push(out);
        if (fields.length === 150) break;
      }
      const target = submissionTarget();
      submissionCandidate = target.candidate || null;
      return {context:{documentId:context.documentId,revision:context.revision},snapshot:{pageOrigin:context.pageOrigin,pageText:pageText(),fields,formLanguage:(/^[a-zA-Z]{2,3}(?:-[a-zA-Z0-9]{2,8})*$/.test(doc.documentElement?.getAttribute('lang') || '') ? doc.documentElement.getAttribute('lang') : '').slice(0,40),submitAvailable:!!submissionCandidate && !submitAttempted && !submitExecuted}};
    }
    function rendered(el) {
      if (!el.isConnected || el.closest('[hidden], [inert], [aria-hidden="true"]')) return false;
      const style = win.getComputedStyle(el);
      if (style.display === 'none' || ['hidden','collapse'].includes(style.visibility) || Number(style.opacity) === 0) return false;
      for (let parent = el.parentElement; parent; parent = parent.parentElement) if (Number(win.getComputedStyle(parent).opacity) === 0) return false;
      return Array.from(el.getClientRects()).some(r => r.width > 0 && r.height > 0);
    }
    function submissionFingerprint(el) {
      // Kept in document memory only; never included in a wire message or log.
      return JSON.stringify({type:el.type,name:el.name,value:el.value,checked:el.checked,
        label:label(el),text:el.tagName === 'BUTTON' ? clean(el.textContent) : '',
        disabled:el.disabled || el.matches(':disabled'),visible:rendered(el),
        attributes:['required','readonly','autocomplete','min','max','step','pattern','minlength','maxlength','aria-required','formaction','formmethod','formenctype','formtarget','formnovalidate'].map(k => el.getAttribute(k)),
        options:el.tagName === 'SELECT' ? Array.from(el.options).map(o => [o.value,o.disabled,o.parentElement?.disabled]) : undefined});
    }
    function submissionTarget() {
      const fail = errorCode => ({errorCode});
      if (disposed || win.top !== win || win.document !== doc || win.location.href !== initialURL || win.location.origin !== initialOrigin) return fail('ORIGIN_CHANGED');
      const members = Array.from(wireGroups.values()).flatMap(g => g.members);
      const form = members[0]?.el.form;
      if (!form || !form.isConnected || form.ownerDocument !== doc || members.some(r => !r.el.isConnected || r.el.form !== form)) return fail('FORM_CHANGED');
      if (!nativeCheckValidity || !nativeRequestSubmit || form.checkValidity !== nativeCheckValidity || form.requestSubmit !== nativeRequestSubmit || form.noValidate || form.method === 'dialog') return fail('OTHER');
      if (!/^https?:\/\//i.test(form.action)) return fail('OTHER');
      const protectedRoute = /(?:^|[\/._-])(checkout|payment|login|signin|authenticate)(?:[\/?.#_-]|$)/i;
      if ([form.action,form.id,form.name].some(value => protectedRoute.test(value || ''))) return fail('OTHER');
      const controls = Array.from(form.elements);
      const sensitive = /\bcc-|password|passcode|one.time|\botp\b|\bcvv\b|\bcvc\b|credit.?card|card.?number|security.?code|payment|bank.?account|routing|captcha|turnstile|\busername\b|webauthn|transaction-(amount|currency)/i;
      const sensitiveControls = [...new Set([...controls,...Array.from(form.querySelectorAll?.('input') || [])])];
      if (sensitiveControls.some(el => ['password','file'].includes(el.type) || sensitive.test([el.autocomplete,el.name,el.id,label(el)].join(' ')))) return fail('OTHER');
      if (doc.querySelector?.('[data-sitekey], .g-recaptcha, .h-captcha, .cf-turnstile, iframe[src*="recaptcha"], iframe[src*="hcaptcha"], iframe[src*="challenges.cloudflare.com"]')) return fail('OTHER');
      // Opaque embedded checkout/auth/challenge controls require manual completion.
      if (form.querySelector('iframe, object, embed, [data-sitekey], .g-recaptcha, .h-captcha, .cf-turnstile')) return fail('OTHER');
      const buttons = Array.from(doc.querySelectorAll('button,input')).filter(el => el.form === form && ['submit','image'].includes(el.type) && !el.disabled && !el.matches(':disabled') && rendered(el));
      if (buttons.length !== 1 || buttons[0].type !== 'submit') return fail('NO_SUBMIT_CONTROL');
      const control = buttons[0];
      if (control.ownerDocument !== doc || control.formNoValidate || control.formMethod === 'dialog' || control.getAttribute('aria-disabled') === 'true' || control.onclick || control.getAttribute('onclick')) return fail('OTHER');
      if (control.getAttribute('formaction') !== null && !/^https?:\/\//i.test(control.formAction)) return fail('OTHER');
      if (protectedRoute.test(control.formAction || '')) return fail('OTHER');
      if (/\b(pay|payment|purchase|buy|checkout|charge|authenticate)\b|place.?order|sign.?in|log.?in|confirm.?payment/i.test([label(control),control.textContent,control.value].join(' '))) return fail('OTHER');
      const route = JSON.stringify([form.action,form.method,form.enctype,form.target,control.formAction,control.formMethod,control.formEnctype,control.formTarget]);
      return {candidate:{form,control,controls,route,fingerprints:controls.map(submissionFingerprint)}};
    }
    function sameSubmission(a,b) {
      return !!a && !!b && a.form === b.form && a.control === b.control && a.route === b.route && a.controls.length === b.controls.length && a.controls.every((el,i) => el === b.controls[i] && a.fingerprints[i] === b.fingerprints[i]);
    }
    function reviewSubmission() {
      const current = submissionTarget().candidate;
      reviewedSubmission = !submitAttempted && !submitExecuted && sameSubmission(submissionCandidate,current) ? current : null;
    }
    function resetSubmissionReview() { reviewedSubmission = null; }
    function resetSubmissionSession() {
      reviewedSubmission = null; submissionCandidate = null; submitAttempted = false;
      snapshotState = null; wireGroups.clear(); elements.clear(); used.clear();
    }
    function submitProtocol(context, authorizationId) {
      const fail = errorCode => ({success:false,errorCode});
      if (submitAttempted || submitExecuted || typeof authorizationId !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(authorizationId)) return fail('OTHER');
      submitAttempted = true;
      if (disposed || win.location.origin !== initialOrigin || win.location.href !== initialURL) return fail('ORIGIN_CHANGED');
      if (!contextValid(context)) return fail('FORM_CHANGED');
      let target = submissionTarget();
      if (!target.candidate) return fail(target.errorCode);
      if (!sameSubmission(reviewedSubmission,target.candidate) || !sameSubmission(submissionCandidate,target.candidate)) return fail('FORM_CHANGED');
      const {form,control} = target.candidate;
      const status = protocolStatus();
      if (status.missingRequiredFieldIds.length || target.candidate.controls.some(el => el.willValidate !== false && el.validity?.valueMissing)) {
        highlight(status.missingRequiredFieldIds); return fail('MISSING_REQUIRED');
      }
      try {
        if (!form.checkValidity() || status.validationIssues.length) {
          highlight(status.validationIssues.map(i => i.fieldId)); return fail('VALIDATION_FAILED');
        }
        // checkValidity may run page event handlers. Recheck identities and values
        // after those handlers and immediately before the native operation.
        target = submissionTarget();
        if (!target.candidate) return fail(target.errorCode);
        if (!contextValid(context) || !sameSubmission(reviewedSubmission,target.candidate)) return fail('FORM_CHANGED');
        let invalid = false, submitted = false;
        const onInvalid = event => {if (event.target.form === form) invalid = true;};
        const onSubmit = event => {if (event.target === form && event.submitter === control) submitted = true;};
        doc.addEventListener('invalid',onInvalid,true);
        doc.addEventListener('submit',onSubmit,true);
        try {
          submitExecuted = true;
          // Preserve browser validation, submitter semantics and page submit handlers.
          // Never call form.submit(), click the control, or synthesize Enter.
          form.requestSubmit(control);
        } finally {
          doc.removeEventListener('invalid',onInvalid,true);
          doc.removeEventListener('submit',onSubmit,true);
        }
        return invalid ? fail('VALIDATION_FAILED') : submitted ? {success:true} : fail('OTHER');
      } catch (_) { return fail('OTHER'); }
    }
    function protocolStatus() {
      const missingRequiredFieldIds=[], validationIssues=[];
      for (const [id,group] of wireGroups) {
        const live=group.members.filter(r => eligible(r.el));
        if (!live.length) continue;
        const empty = group.field.kind === 'radio-group' || group.field.kind === 'checkbox' ? !live.some(r => r.el.checked) : live[0].el.value === '';
        if (group.field.required && empty) {missingRequiredFieldIds.push(id);validationIssues.push({fieldId:id,code:'REQUIRED_MISSING'});continue;}
        const bad=live.find(r => r.el.validity && !r.el.validity.valid);
        if (bad) {const v=bad.el.validity;validationIssues.push({fieldId:id,code:v.typeMismatch ? 'TYPE_MISMATCH' : v.patternMismatch ? 'PATTERN_MISMATCH' : v.tooLong ? 'TOO_LONG' : 'OTHER'});}
      }
      return {missingRequiredFieldIds,validationIssues};
    }
    async function fillProtocol(context, actions) {
      if (!contextValid(context)) return {results:actions.map(a => ({fieldId:a.fieldId,success:false,errorCode:'ORIGIN_CHANGED'})),...protocolStatus()};
      const results=[], seen=new Set();
      for (const a of actions) {
        const fail=code => results.push({fieldId:a.fieldId,success:false,errorCode:code});
        const group=wireGroups.get(a.fieldId);
        if (!group) {fail('NOT_FOUND');continue;}
        if (seen.has(a.fieldId)) {fail('VALUE_REJECTED');continue;} seen.add(a.fieldId);
        if (typeof a.value !== 'string') {fail('VALUE_REJECTED');continue;}
        if (group.field.currentValuePresent && a.overwrite !== true) {fail('HAS_VALUE');continue;}
        let target=group.members[0], next=a.value;
        if (group.field.kind === 'radio-group') {
          const matches=group.members.filter(r => r.el.value === next);
          if (matches.length !== 1 || !group.field.options.some(o => o.value === next)) {fail('OPTION_NOT_FOUND');continue;}
          target=matches[0];next=true;
        } else if (group.field.kind === 'checkbox') {
          if (!['true','false'].includes(next)) {fail('VALUE_REJECTED');continue;} next=next === 'true';
        }
        if (!target.el.isConnected) {fail('NOT_FOUND');continue;}
        if (target.el.disabled || target.el.readOnly || target.el.matches(':disabled')) {fail('DISABLED');continue;}
        if (!eligible(target.el)) {fail('HIDDEN');continue;}
        // Every radio member must still match the snapshot, including checked state.
        if (group.members.some(r => !r.el.isConnected || !eligible(r.el) || r.el.form !== r.form || r.el.name !== r.name || value(r.el) !== r.value || JSON.stringify(metadata(r.el)) !== JSON.stringify(r.field))) {fail('VALUE_REJECTED');continue;}
        const overwrite = a.overwrite === true ? group.members.map(r => r.field.id) : [];
        const applied=await fill(context,[{fieldId:target.field.id,value:next}],overwrite);
        const result=applied.results[0];
        const errorMap={STALE_CONTEXT:'ORIGIN_CHANGED',INVALID_OPTION:'OPTION_NOT_FOUND',OVERWRITE_DENIED:'HAS_VALUE',FIELD_CHANGED:'VALUE_REJECTED'};
        results.push(result?.success ? {fieldId:a.fieldId,success:true} : {fieldId:a.fieldId,success:false,errorCode:errorMap[result?.errorCode || applied.error] || 'VALUE_REJECTED'});
      }
      return {results,...protocolStatus()};
    }
    function invalidate() { highlight([]); disposed = true; elements.clear(); used.clear(); snapshotState = null; submissionCandidate = null; reviewedSubmission = null; }
    win.addEventListener('pagehide', invalidate);
    return { capture, fill, captureProtocol, fillProtocol, protocolStatus, highlight, reviewSubmission, resetSubmissionReview, resetSubmissionSession, submitProtocol, dispose: invalidate };
  }
  root.SeeForMeDOM = Object.freeze({ createEngine });
})(globalThis);
