/* Background entry point. Load protocol.js, background.js, then session.js. */
(function (root) {
  'use strict';
  function start(browser, crypto) {
    const P = root.SeeForMeProtocol, sessions = new Map();
    let port;
    const envelope = (s,type,payload={}) => ({v:1,type,sessionId:s.id,requestId:crypto.randomUUID(),...payload});
    const current = (tabId,s) => sessions.get(tabId) === s;
    async function send(s, type, payload) {
      if (s.cancelled && type !== 'SESSION_RESET') throw Error('SESSION_ENDED');
      const req = envelope(s,type,payload);
      if (!P.request(req)) throw Error('BAD_SCHEMA');
      const res = await browser.runtime.sendNativeMessage('com.seeforme.app',req);
      if (!P.reply(res,req)) throw Error('BAD_HOST_REPLY');
      return res;
    }
    async function reset(tabId) {
      const s = sessions.get(tabId); sessions.delete(tabId);
      if (s) { s.cancelled = true; try { await send(s,'SESSION_RESET',{}); } catch (_) {} }
    }
    async function emit(tabId,s,data) {
      if (!current(tabId,s)) return;
      const tab = await browser.tabs.get(tabId);
      if (!current(tabId,s) || tab.url !== s.url) { await reset(tabId); return; }
      return browser.tabs.sendMessage(tabId,{channel:'seeforme',documentId:s.documentId,...data},{frameId:0});
    }
    async function handle(tabId,s,res,depth=0) {
      if (!current(tabId,s)) return;
      if (depth > 3) throw Error('HOST_ACTION_LOOP');
      const known = new Set(s.snapshot.fields.map(f => f.id));
      if (res.actions.some(a => !known.has(a.fieldId))) throw Error('UNKNOWN_FIELD');
      if (res.actions.length) {
        await emit(tabId,s,{operation:'state',state:'filling'});
        const result = await emit(tabId,s,{operation:'fill',context:s.context,actions:res.actions});
        if (!current(tabId,s) || !result) return;
        const next = await send(s,'FILL_RESULT',result);
        // Refresh the local fill context after applying actions, without changing field IDs.
        const snapshot = await emit(tabId,s,{operation:'capture'});
        if (!snapshot || !current(tabId,s)) return;
        s.context = snapshot.context; s.snapshot = snapshot.snapshot;
        return handle(tabId,s,next,depth+1);
      }
      if (res.status === 'ready_for_review') {
        const status = await emit(tabId,s,{operation:'status'});
        if (!status || !current(tabId,s)) return;
        if (status.missingRequiredFieldIds.length || status.validationIssues.length) {
          await emit(tabId,s,{operation:'state',state:'needs_input',message:'Some fields still need attention. Review the highlighted form.'});
          return;
        }
      }
      await emit(tabId,s,{operation:'state',state:res.status,question:res.question,message:res.message,modelAvailable:res.modelAvailable});
    }
    function queue(tabId,s,task) {
      // Typed requests report busy; app/voice pushes queue bounded turns and recapture before each.
      if (s.busy) return Promise.resolve({error:'BUSY'});
      s.busy = true;
      return (async () => {try { return await task(); } catch (_) {await emit(tabId,s,{operation:'state',state:'error',message:'Could not complete that step. Try again or start over.'}).catch(() => {}); return {error:'REQUEST_FAILED'};} finally {s.busy=false;const next=s.queued?.shift();if (next && current(tabId,s)) void utterance(tabId,next.text,next.source);} })();
    }
    async function requestWithRecovery(s,type,payload) {
      let res = await send(s,type,payload);
      if (res.errorCode === 'UNKNOWN_SESSION') {
        const recovery = await send(s,'FORM_SNAPSHOT',s.snapshot);
        if (recovery.status === 'error') return recovery;
        res = await send(s,type,payload);
      }
      return res;
    }
    async function utterance(tabId,text,source) {
      const s = sessions.get(tabId); if (!s) return {error:'NO_SESSION'};
      return queue(tabId,s,async () => {
        // Reinspect before every turn so manual edits and conditional fields are current.
        const capture = await emit(tabId,s,{operation:'capture'});
        if (!capture || !current(tabId,s)) return;
        s.context=capture.context; s.snapshot=capture.snapshot;
        await emit(tabId,s,{operation:'state',state:'processing'});
        const refresh = await send(s,'FORM_SNAPSHOT',s.snapshot);
        if (refresh.status === 'error') return handle(tabId,s,refresh);
        if (refresh.actions.length) await handle(tabId,s,refresh);
        if (!current(tabId,s)) return;
        const res = await requestWithRecovery(s,'USER_UTTERANCE',{text,source});
        await handle(tabId,s,res);
        return {ok:true};
      });
    }
    async function listener(msg,sender) {
      if (msg?.channel !== 'seeforme' || sender.id !== browser.runtime.id || !Number.isInteger(sender.tab?.id) || sender.frameId !== 0) return;
      let origin;
      try { origin = new URL(sender.tab.url).origin; } catch (_) { return; }
      if (!P.originAllowed(origin) || sender.url !== sender.tab.url) return;
      const tabId=sender.tab.id;
      if (msg.operation === 'start') {
        await reset(tabId);
        if (!msg.context || msg.context.documentId !== msg.documentId || !Number.isInteger(msg.context.revision) || typeof msg.documentId !== 'string' || !msg.snapshot) return;
        const s={id:crypto.randomUUID(),url:sender.tab.url,documentId:msg.documentId,context:msg.context,snapshot:{...msg.snapshot,pageOrigin:origin},busy:false};
        sessions.set(tabId,s);
        return queue(tabId,s,async () => { await handle(tabId,s,await send(s,'FORM_SNAPSHOT',s.snapshot)); return {ok:true}; });
      }
      const s=sessions.get(tabId);
      if (!s || s.documentId !== msg.documentId) return;
      if (msg.operation === 'reset') {await reset(tabId); return {ok:true};}
      if (msg.operation === 'utterance' && typeof msg.text === 'string' && msg.text.trim() && msg.text.length <= 1000) return utterance(tabId,msg.text,'typed');
    }
    function connect() {
      if (port) return;
      try {
        port=browser.runtime.connectNative('com.seeforme.app');
        port.onMessage.addListener(async raw => {
          const input=P.push(raw); if (!input) return;
          try {
            const [tab]=await browser.tabs.query({active:true,currentWindow:true});
            const s=tab && sessions.get(tab.id);
            if (!s) return;
            if (s.busy) {
              s.queued ||= [];
              if (s.queued.length < 5) s.queued.push({text:input.text,source:input.source});
              else await emit(tab.id,s,{operation:'state',state:'error',message:'Please pause and repeat your last answer after processing finishes.'});
            } else await utterance(tab.id,input.text,input.source);
          } catch (_) {}
        });
        port.onDisconnect.addListener(() => {port=null;});
      } catch (_) {port=null;}
    }
    const onMessage=(msg,sender) => {connect(); return listener(msg,sender);};
    const updated=(id,info) => {if (info.url || info.status === 'loading') void reset(id);};
    const removed=id => {void reset(id);};
    browser.runtime.onMessage.addListener(onMessage);
    browser.tabs.onUpdated.addListener(updated); browser.tabs.onRemoved.addListener(removed);
    connect();
    return {dispose() {browser.runtime.onMessage.removeListener(onMessage); browser.tabs.onUpdated.removeListener(updated);browser.tabs.onRemoved.removeListener(removed);port?.disconnect();sessions.clear();}};
  }
  root.SeeForMeSession=Object.freeze({start});
  if (typeof browser !== 'undefined') start(browser,globalThis.crypto);
})(globalThis);
