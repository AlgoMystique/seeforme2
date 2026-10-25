/* Background entry point. Load protocol.js, background.js, then session.js. */
(function (root) {
  'use strict';
  function start(browser, crypto, clock=globalThis) {
    const P = root.SeeForMeProtocol, sessions = new Map(), replySources = new WeakMap();
    let port, contextEpoch=0;
    let lastVoice = null, voiceInstance = null, voiceSeq = -1, voiceTimer, voiceTarget = null, voiceRevision = 0;
    const voiceRouteId = crypto.randomUUID();
    let voiceDisposed = false;
    const now = () => clock.now ? clock.now() : Date.now();
    const envelope = (s,type,payload={}) => ({v:1,type,sessionId:s.id,requestId:crypto.randomUUID(),...payload});
    const current = (tabId,s) => sessions.get(tabId) === s;
    function deadline(promise,ms) {
      if (typeof clock.setTimeout !== 'function' || typeof clock.clearTimeout !== 'function') return promise;
      let timer;
      const timeout=new Promise((_,reject) => {timer=clock.setTimeout(() => reject(Error('BRIDGE_TIMEOUT')),ms);});
      return Promise.race([promise,timeout]).finally(() => clock.clearTimeout(timer));
    }
    async function send(s, type, payload) {
      if (s.cancelled && type !== 'SESSION_RESET' && !(type === 'SUBMIT_RESULT' && s.submissionInFlight)) throw Error('SESSION_ENDED');
      const req = envelope(s,type,payload);
      if (!P.request(req)) throw Error('BAD_SCHEMA');
      const res = await deadline(browser.runtime.sendNativeMessage('com.seeforme.app',req),60000);
      if (!P.reply(res,req)) throw Error('BAD_HOST_REPLY');
      replySources.set(res,type);
      return res;
    }
    async function reset(tabId) {
      const s = sessions.get(tabId); sessions.delete(tabId);
      if (s) {
        s.cancelled = true; s.queued = [];
        // requestSubmit may navigate before the content reply arrives. Report its
        // result to the old host session before discarding that session.
        if (s.submissionInFlight) return;
        try { await send(s,'SESSION_RESET',{}); } catch (_) {}
      }
    }
    async function emit(tabId,s,data) {
      if (!current(tabId,s)) return;
      const tab = await deadline(browser.tabs.get(tabId),10000);
      if (!current(tabId,s) || tab.url !== s.url) { await reset(tabId); return; }
      return deadline(browser.tabs.sendMessage(tabId,{channel:'seeforme',documentId:s.documentId,...data},{frameId:0}),10000);
    }
    async function routeVoice() {
      if (voiceDisposed) return;
      const revision = ++voiceRevision;
      try {
        const [tab] = await browser.tabs.query({active:true,currentWindow:true});
        if (voiceDisposed || revision !== voiceRevision) return;
        const session = tab && sessions.get(tab.id);
        if (voiceTarget && (voiceTarget.tabId !== tab?.id || voiceTarget.session !== session || !lastVoice || lastVoice.expiresAt <= now())) {
          const old = voiceTarget; voiceTarget = null;
          await emitVoice(old.tabId,old.session,{operation:'voice-idle',voiceRevision:revision}).catch(() => {});
        }
        if (voiceDisposed || revision !== voiceRevision || !session || !lastVoice || lastVoice.expiresAt <= now()) return;
        voiceTarget = {tabId:tab.id,session};
        await emitVoice(tab.id,session,{operation:'voice-state',voiceRevision:revision,voiceExpiresAt:lastVoice.expiresAt,voice:{...lastVoice.message,ttlMs:Math.max(1,lastVoice.expiresAt-now())}});
      } catch (_) { /* Voice display cannot interrupt the form workflow. */ }
    }
    async function emitVoice(tabId,s,data) {
      // Display-only: a stale tab must not trigger SESSION_RESET or any other
      // native request as a side effect of a voice heartbeat.
      if (voiceDisposed || !current(tabId,s)) return;
      const tab = await browser.tabs.get(tabId);
      if (voiceDisposed || !current(tabId,s) || tab.url !== s.url || data.voiceRevision !== voiceRevision) return;
      if (data.operation === 'voice-state' && data.voiceExpiresAt <= now()) data={operation:'voice-idle',voiceRevision:data.voiceRevision};
      return browser.tabs.sendMessage(tabId,{channel:'seeforme',documentId:s.documentId,voiceRouteId,...data},{frameId:0});
    }
    function receiveVoiceState(message) {
      if (voiceDisposed) return;
      if (message.instanceId === voiceInstance && message.seq <= voiceSeq) return;
      voiceInstance=message.instanceId; voiceSeq=message.seq;
      if (voiceTimer !== undefined) clock.clearTimeout(voiceTimer);
      const ttl = Math.min(message.ttlMs,2147483647);
      lastVoice={message,expiresAt:now()+ttl};
      voiceTimer=clock.setTimeout(() => {lastVoice=null;return routeVoice();},ttl);
      return routeVoice();
    }
    async function submit(tabId,s,res,confirming) {
      if (s.submitStarted) return; // Never replay a submission, even after a lost reply.
      s.submitStarted = true; s.submissionInFlight = true; s.awaitingSubmitConfirmation = false; s.queued = [];
      let result = {success:false,errorCode:'OTHER'};
      try {
        if (confirming && replySources.get(res) === 'USER_UTTERANCE' && s.snapshot.submitAvailable === true) {
          try {
            await emit(tabId,s,{operation:'state',state:'submitting',message:res.message,modelAvailable:res.modelAvailable});
            const raw = await emit(tabId,s,{operation:'submit',context:s.context,authorizationId:res.requestId});
            const codes = ['NO_SUBMIT_CONTROL','VALIDATION_FAILED','MISSING_REQUIRED','ORIGIN_CHANGED','FORM_CHANGED','OTHER'];
            result = raw?.success === true ? {success:true} : {success:false,errorCode:codes.includes(raw?.errorCode) ? raw.errorCode : !current(tabId,s) ? 'ORIGIN_CHANGED' : 'OTHER'};
          } catch (_) { result = {success:false,errorCode:'OTHER'}; }
        } else if (s.snapshot.submitAvailable !== true) result = {success:false,errorCode:'NO_SUBMIT_CONTROL'};
        if (result.success) {s.finished = true; s.queued = [];}
        const reply = await send(s,'SUBMIT_RESULT',result);
        if (reply.actions.length || !['ended','ready_for_review','error'].includes(reply.status)) throw Error('BAD_SUBMIT_ACK');
        if (current(tabId,s)) await handle(tabId,s,reply);
      } finally {
        s.submissionInFlight = false;
        if (s.cancelled) {try {await send(s,'SESSION_RESET',{});} catch (_) {}}
      }
    }
    async function handle(tabId,s,res,depth=0,confirming=false) {
      if (!current(tabId,s)) return;
      if (s.contextEpoch !== contextEpoch) {
        s.awaitingSubmitConfirmation=false;
        await emit(tabId,s,{operation:'state',state:'needs_input',message:'Local context changed. Please repeat your request.'});
        return;
      }
      if (depth > 3) throw Error('HOST_ACTION_LOOP');
      if (res.status === 'submit') return submit(tabId,s,res,confirming);
      s.awaitingSubmitConfirmation = false;
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
          const highlightFieldIds = [...new Set([...status.missingRequiredFieldIds,...status.validationIssues.map(issue => issue.fieldId)])];
          await emit(tabId,s,{operation:'state',state:'needs_input',highlightFieldIds,message:res.message || 'Some fields still need attention. Review the highlighted form.'});
          return;
        }
      }
      await emit(tabId,s,{operation:'state',state:res.status,question:res.question,message:res.message,modelAvailable:res.modelAvailable,conversationLanguage:res.conversationLanguage});
      s.awaitingSubmitConfirmation = current(tabId,s) && !s.submitStarted && s.snapshot.submitAvailable === true && res.status === 'ready_for_review' && !!res.question;
      s.confirmationQuestion = s.awaitingSubmitConfirmation ? res.question : null;
      if (res.status === 'ended') {s.finished = true; s.queued = [];}
    }
    function queue(tabId,s,task) {
      // Typed requests report busy; app/voice pushes queue bounded turns and recapture before each.
      if (s.finished) return Promise.resolve({error:'SESSION_ENDED'});
      if (s.busy) return Promise.resolve({error:'BUSY'});
      s.busy = true; s.contextEpoch=contextEpoch;
      return (async () => {try { return await task(); } catch (_) {await emit(tabId,s,{operation:'state',state:'error',message:'Could not complete that step. Try again or start over.'}).catch(() => {}); return {error:'REQUEST_FAILED'};} finally {s.busy=false;const next=s.queued?.shift();if (next && current(tabId,s)) void utterance(tabId,next.text,next.source,false,next.utteranceId);} })();
    }
    async function requestWithRecovery(s,type,payload,confirming=false) {
      let res = await send(s,type,payload);
      if (res.errorCode === 'UNKNOWN_SESSION') {
        const recovery = await send(s,'FORM_SNAPSHOT',s.snapshot);
        // A lost confirmation session must ask again; never replay "yes" against
        // a newly created host session or a newly presented submit question.
        if (recovery.status === 'error' || confirming) return recovery;
        res = await send(s,type,payload);
      }
      return res;
    }
    async function utterance(tabId,text,source,mayConfirm=true,utteranceId) {
      const s = sessions.get(tabId); if (!s) return {error:'NO_SESSION'};
      if (s.awaitingSubmitConfirmation && !mayConfirm) {
        s.queued = [];
        await emit(tabId,s,{operation:'state',state:'ready_for_review',question:s.confirmationQuestion,message:'Please review the form and answer the submission question now.'});
        return {error:'FRESH_CONFIRMATION_REQUIRED'};
      }
      const contextChanged=s.contextEpoch !== contextEpoch;
      return queue(tabId,s,async () => {
        const confirming = s.awaitingSubmitConfirmation === true;
        s.awaitingSubmitConfirmation = false;
        // Reinspect before every turn so manual edits and conditional fields are current.
        const capture = await emit(tabId,s,{operation:'capture'});
        if (!capture || !current(tabId,s)) return;
        s.context=capture.context; s.snapshot={...capture.snapshot,pageOrigin:new URL(s.url).origin};
        await emit(tabId,s,{operation:'state',state:'processing'});
        const refresh = await send(s,'FORM_SNAPSHOT',s.snapshot);
        if (refresh.status === 'error') return handle(tabId,s,refresh);
        if (refresh.actions.length) await handle(tabId,s,refresh);
        if (!current(tabId,s)) return;
        if (contextChanged && s.awaitingSubmitConfirmation) return {ok:true}; // The new review needs a fresh answer.
        const res = await requestWithRecovery(s,'USER_UTTERANCE',{text,source,...(utteranceId ? {utteranceId} : {})},confirming);
        await handle(tabId,s,res,0,confirming);
        return {ok:true};
      });
    }
    async function contextRequest(operation) {
      const requestId=crypto.randomUUID();
      const attempts=['connect','change'].includes(operation) ? 600 : 60;
      for (let attempt=0;attempt<attempts;attempt++) {
        const reply=await deadline(browser.runtime.sendNativeMessage('com.seeforme.app',{v:1,type:'LOCAL_CONTEXT',requestId,operation:attempt % 10 === 0 ? operation : 'poll'}),10000);
        if (reply?.v !== 1 || reply.type !== 'CONTEXT_STATE' || reply.requestId !== requestId || typeof reply.ok !== 'boolean') throw Error('BAD_CONTEXT_REPLY');
        if (reply.pending !== true) return {...reply,changed:reply.ok && ['off','connect','refresh','change','disconnect'].includes(operation)};
        await new Promise(resolve=>clock.setTimeout(resolve,200));
      }
      throw Error('CONTEXT_TIMEOUT');
    }

    async function contextListener(msg,sender) {
      if (sender.id !== browser.runtime.id || !Number.isInteger(sender.tab?.id) || sender.frameId !== 0 || sender.url !== sender.tab.url) return;
      try {if (!P.originAllowed(new URL(sender.url).origin)) return;} catch (_) {return;}
      if (!['status','activate','off','connect','refresh','change','disconnect','allow-speech','private-speech'].includes(msg.operation)) return;
      try {
        const reply=await contextRequest(msg.operation);
        if (reply.ok && reply.changed === true && ['off','connect','refresh','change','disconnect'].includes(msg.operation)) {
          contextEpoch++;
          for (const session of sessions.values()) session.awaitingSubmitConfirmation=false;
        }
        // Explicit OFF ends workflows across tabs, without touching values already filled.
        if (msg.operation === 'off' && reply.ok) {
          await Promise.all([...sessions.keys()].map(id => reset(id)));
        }
        return reply;
      } catch (_) {return {ok:false,error:'Could not reach local context. Try reopening these controls.'};}
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
        return queue(tabId,s,async () => { await contextRequest('activate'); if (!current(tabId,s)) return; await handle(tabId,s,await send(s,'FORM_SNAPSHOT',s.snapshot)); if (lastVoice) await routeVoice(); return {ok:true}; });
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
          const cache=raw?.name === 'seeforme' ? raw.userInfo : raw;
          if (cache?.type === 'CONTEXT_CACHE_PART') {
            // Native-only relay: never send context into tabs, DOM, storage or logs.
            if (cache.v !== 1 || typeof cache.requestId !== 'string' || !/^[0-9a-f-]{36}$/i.test(cache.requestId) ||
                !Number.isSafeInteger(cache.sequence) || cache.sequence < 1 || !Number.isInteger(cache.index) ||
                !Number.isInteger(cache.total) || cache.total < 1 || cache.total > 128 || cache.index < 0 || cache.index >= cache.total ||
                typeof cache.chunk !== 'string' || cache.chunk.length > 21848) return;
            try {
              await browser.runtime.sendNativeMessage('com.seeforme.app',{v:1,type:'CONTEXT_CACHE_PART',requestId:cache.requestId,
                sequence:cache.sequence,index:cache.index,total:cache.total,chunk:cache.chunk});
            } catch (_) { /* The original native command reports a delivery timeout. */ }
            return;
          }
          if (cache?.v === 1 && cache.type === 'VOICE_TRANSCRIPT' && ['assistant','user'].includes(cache.role) && typeof cache.text === 'string' && cache.text.length <= 4000) {
            const [tab]=await browser.tabs.query({active:true,currentWindow:true});
            const s=tab && sessions.get(tab.id);
            if (s) await emit(tab.id,s,{operation:'transcript',role:cache.role,text:cache.text});
            return;
          }
          const activity=P.voiceState(raw);
          if (activity) return receiveVoiceState(activity);
          const input=P.push(raw); if (!input) return;
          try {
            const [tab]=await browser.tabs.query({active:true,currentWindow:true});
            const s=tab && sessions.get(tab.id);
            if (!s || s.finished) return;
            if (s.busy) {
              s.queued ||= [];
              if (s.queued.length < 5) s.queued.push({text:input.text,source:input.source,utteranceId:input.utteranceId});
              else await emit(tab.id,s,{operation:'state',state:'error',message:'Please pause and repeat your last answer after processing finishes.'});
            } else await utterance(tab.id,input.text,input.source,true,input.utteranceId);
          } catch (_) {}
        });
        port.onDisconnect.addListener(() => {port=null;lastVoice=null;if (voiceTimer !== undefined) clock.clearTimeout(voiceTimer);void routeVoice();});
      } catch (_) {port=null;}
    }
    const onMessage=(msg,sender) => {
      // Returning even an empty Promise claims the response in Safari. Leave
      // voice messages entirely to voice-bridge.js.
      if (msg?.channel === 'seeforme-context') {connect();return contextListener(msg,sender);}
      if (msg?.channel !== 'seeforme') return;
      connect(); return listener(msg,sender);
    };
    const updated=(id,info) => {if (info.url || info.status === 'loading') void reset(id);};
    const removed=id => {void reset(id);};
    browser.runtime.onMessage.addListener(onMessage);
    browser.tabs.onUpdated.addListener(updated); browser.tabs.onRemoved.addListener(removed);
    const activated=() => {if (lastVoice || voiceTarget) return routeVoice();};
    browser.tabs.onActivated?.addListener(activated);
    browser.windows?.onFocusChanged?.addListener(activated);
    connect();
    return {dispose() {voiceDisposed=true;if (voiceTimer !== undefined) clock.clearTimeout(voiceTimer);lastVoice=null;voiceRevision++;browser.runtime.onMessage.removeListener(onMessage); browser.tabs.onUpdated.removeListener(updated);browser.tabs.onRemoved.removeListener(removed);browser.tabs.onActivated?.removeListener(activated);browser.windows?.onFocusChanged?.removeListener(activated);port?.disconnect();sessions.clear();}};
  }
  root.SeeForMeSession=Object.freeze({start});
  if (typeof browser !== 'undefined') start(browser,globalThis.crypto);
})(globalThis);
