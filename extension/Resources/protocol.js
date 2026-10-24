/* Wire validation for contract/PROTOCOL.md v1. No values are logged. */
(function (root) {
  'use strict';
  const kinds = new Set(['text','email','tel','url','number','date','time','textarea','select','radio-group','checkbox']);
  const errors = new Set(['NOT_FOUND','DISABLED','HIDDEN','HAS_VALUE','OPTION_NOT_FOUND','VALUE_REJECTED','ORIGIN_CHANGED']);
  const issues = new Set(['REQUIRED_MISSING','TYPE_MISMATCH','PATTERN_MISMATCH','TOO_LONG','OTHER']);
  const submitErrors = new Set(['NO_SUBMIT_CONTROL','VALIDATION_FAILED','MISSING_REQUIRED','ORIGIN_CHANGED','FORM_CHANGED','OTHER']);
  const uuid = x => typeof x === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(x);
  const str = (x,n=10000) => typeof x === 'string' && x.length <= n;
  const list = (x,n,fn) => Array.isArray(x) && x.length <= n && x.every(fn);
  const size = x => { try { const s = JSON.stringify(x); return typeof s === 'string' && unescape(encodeURIComponent(s)).length <= 65536; } catch (_) { return false; } };
  const envelope = x => x && x.v === 1 && uuid(x.sessionId) && uuid(x.requestId) && size(x);
  function originAllowed(value) {
    try { const u = new URL(value); return u.origin === value && (u.protocol === 'https:' || (u.protocol === 'http:' && ['localhost','127.0.0.1'].includes(u.hostname))); } catch (_) { return false; }
  }
  function field(f) {
    return f && str(f.id,200) && f.id.length > 0 && str(f.label,120) && kinds.has(f.kind) &&
      ['required','visible','disabled','currentValuePresent'].every(k => typeof f[k] === 'boolean') &&
      (f.options === undefined || list(f.options,50,o => o && str(o.value) && str(o.label,80))) &&
      (f.optionsTruncated === undefined || typeof f.optionsTruncated === 'boolean') &&
      (f.autocomplete === undefined || str(f.autocomplete,300)) && (f.placeholder === undefined || str(f.placeholder,80)) &&
      (f.instructions === undefined || str(f.instructions,300)) &&
      (f.language === undefined || str(f.language,40)) &&
      (f.maxLength === undefined || Number.isInteger(f.maxLength) && f.maxLength >= 0);
  }
  function status(x) {
    return list(x.missingRequiredFieldIds,150,id => str(id,200)) && list(x.validationIssues,150,i => i && str(i.fieldId,200) && issues.has(i.code) && (i.message === undefined || str(i.message,120)));
  }
  function request(x) {
    if (!envelope(x)) return false;
    switch(x.type) {
      case 'FORM_SNAPSHOT': return (x.pageText === undefined || str(x.pageText,6000)) && originAllowed(x.pageOrigin) && (x.conversationLanguage === undefined || str(x.conversationLanguage,40)) && (x.formLanguage === undefined || str(x.formLanguage,40)) && (x.pageTitle === undefined || str(x.pageTitle,120)) && (x.submitAvailable === undefined || typeof x.submitAvailable === 'boolean') && list(x.fields,150,field) && new Set(x.fields.map(f => f.id)).size === x.fields.length;
      case 'USER_UTTERANCE': return (x.utteranceId === undefined || uuid(x.utteranceId)) && str(x.text,1000) && x.text.trim().length > 0 && ['typed','voice','app'].includes(x.source);
      case 'FILL_RESULT': return status(x) && list(x.results,150,r => r && str(r.fieldId,200) && typeof r.success === 'boolean' && (r.errorCode === undefined || errors.has(r.errorCode)));
      case 'FORM_STATUS': return status(x);
      case 'SESSION_RESET': return true;
      case 'SUBMIT_RESULT': return typeof x.success === 'boolean' && (x.success ? x.errorCode === undefined : submitErrors.has(x.errorCode));
      default: return false;
    }
  }
  function reply(x, req) {
    return !!(envelope(x) && x.type === 'HOST_REPLY' && x.sessionId === req.sessionId && x.requestId === req.requestId &&
      ['needs_input','ready_for_review','submit','ended','error'].includes(x.status) && typeof x.modelAvailable === 'boolean' &&
      list(x.actions,150,a => a && str(a.fieldId,200) && typeof a.value === 'string' && a.value.length <= 10000 && (a.overwrite === undefined || typeof a.overwrite === 'boolean')) &&
      new Set(x.actions.map(a => a.fieldId)).size === x.actions.length &&
      (!['error','ended'].includes(x.status) || x.actions.length === 0) &&
      (x.status !== 'submit' || x.actions.length === 0 && x.question == null) &&
      (x.question == null || str(x.question.text,1000) && list(x.question.fieldIds,150,id => str(id,200))) &&
      (x.conversationLanguage === undefined || str(x.conversationLanguage,40)) && (x.message == null || str(x.message,1000)) && (x.errorCode === undefined || str(x.errorCode,100)));
  }
  function push(raw) {
    const x = raw?.name === 'seeforme' ? raw.userInfo : raw;
    return x && size(x) && x.v === 1 && x.type === 'USER_INPUT' && (x.utteranceId === undefined || uuid(x.utteranceId)) && str(x.text,1000) && x.text.trim() && ['typed','voice','app'].includes(x.source) ? x : null;
  }
  function voiceState(raw) {
    const x = raw?.name === 'seeforme' ? raw.userInfo : raw;
    if (!x || !size(x) || x.v !== 1 || x.type !== 'VOICE_STATE' || !uuid(x.instanceId) ||
        !Number.isSafeInteger(x.seq) || x.seq < 0 || !Number.isSafeInteger(x.ttlMs) || x.ttlMs <= 0 ||
        !['idle','listening','transcribing','thinking','speaking','error'].includes(x.state) ||
        (x.speechDetected !== undefined && (x.state !== 'listening' || typeof x.speechDetected !== 'boolean')) ||
        (x.level !== undefined && (!['listening','speaking'].includes(x.state) || typeof x.level !== 'number' || !Number.isFinite(x.level) || x.level < 0 || x.level > 1)) ||
        (x.muted !== undefined && typeof x.muted !== 'boolean') ||
        (x.message !== undefined && (x.state !== 'error' || !str(x.message,200)))) return null;
    const result = {v:1,type:'VOICE_STATE',state:x.state,instanceId:x.instanceId.toLowerCase(),seq:x.seq,ttlMs:x.ttlMs};
    if (x.speechDetected !== undefined) result.speechDetected=x.speechDetected;
    if (x.message !== undefined) result.message=x.message;
    if (x.level !== undefined) result.level=x.level;
    if (x.muted !== undefined) result.muted=x.muted;
    return result;
  }
  root.SeeForMeProtocol = Object.freeze({ request, reply, push, voiceState, originAllowed, size });
})(globalThis);
