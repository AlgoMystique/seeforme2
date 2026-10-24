/* DOM-only engine. Internal API; wire messages only through contract/PROTOCOL.md. */
(function (root) {
  'use strict';
  function createEngine(doc, win) {
    const ids = new WeakMap(), elements = new Map(), used = new Set();
    const documentId = win.crypto.randomUUID();
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
      if (/\bcc-|password|passcode|one.time|otp|\bcvv\b|\bcvc\b|credit.?card|card.?number|security.?code|social.?security|\bssn\b|routing|bank.?account|payment/i.test(hint)) return false;
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
        if (f.autocomplete) out.autocomplete=f.autocomplete;
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
      return {context:{documentId:context.documentId,revision:context.revision},snapshot:{pageOrigin:context.pageOrigin,fields}};
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
    function invalidate() { highlight([]); disposed = true; elements.clear(); used.clear(); snapshotState = null; }
    win.addEventListener('pagehide', invalidate);
    return { capture, fill, captureProtocol, fillProtocol, protocolStatus, highlight, dispose: invalidate };
  }
  root.SeeForMeDOM = Object.freeze({ createEngine });
})(globalThis);
