/* Safari voice controls. Credentials/audio remain exclusively in the native host. */
(function () {
  'use strict';
  if (typeof browser === 'undefined') return;
  const automaticTabs=new Set();
  browser.tabs.onRemoved?.addListener(id=>automaticTabs.delete(id));
  const commands={start:'VOICE_START',stop:'VOICE_STOP',mute:'VOICE_MUTE',unmute:'VOICE_UNMUTE'};
  async function preferences() {
    const saved=await browser.storage.local.get('voicePreferences');
    return saved.voicePreferences || {};
  }
  async function native(type,extra={}) {
    const requestId=crypto.randomUUID();
    const raw=await browser.runtime.sendNativeMessage('com.seeforme.app',{v:1,type,requestId,...extra});
    const reply=raw?.name === 'seeforme' ? raw.userInfo : raw;
    if (!reply || reply.v !== 1 || reply.requestId !== requestId) throw Error('INVALID_ACK');
    return reply;
  }
  async function send(type,extra={}) {
    try {
      const prefs=type === 'VOICE_START' ? await preferences() : {};
      const reply=await native(type,{...prefs,...extra});
      const ok=reply.type === 'VOICE_ACK' && reply.accepted === true;
      try {await browser.action.setBadgeText({text:ok ? '' : '!'});} catch (_) {}
      return {ok,appLaunched:reply.appLaunched === true,...(reply.error === 'UNSUPPORTED_LANGUAGE' ? {error:'The preferred language is not supported by this Mac’s on-device model.'} : {})};
    } catch (_) {return {ok:false};}
  }
  // Toolbar asks the page to inspect first, just like the in-page Talk control.
  browser.action?.onClicked?.addListener(async tab => {
    if (!Number.isInteger(tab?.id)) return;
    try {await browser.tabs.sendMessage(tab.id,{channel:'seeforme-voice',operation:'toolbar-start'},{frameId:0});}
    catch (_) {try {await browser.action.setBadgeText({text:'!'});} catch (_) {}}
  });
  browser.runtime.onMessage.addListener((msg,sender) => {
    if (!msg || msg.channel !== 'seeforme-voice' || sender.id !== browser.runtime.id) return;
    if (msg.operation === 'auto-start') return (async () => {
      const id=sender.tab?.id;
      if (!Number.isInteger(id) || sender.frameId !== 0 || automaticTabs.has(id)) return {start:false};
      const context=await native('LOCAL_CONTEXT',{operation:'cached-status'});
      if (context.state?.explicitlyOff) return {start:false};
      const [active]=await browser.tabs.query({active:true,currentWindow:true});
      if (active?.id !== id || automaticTabs.has(id)) return {start:false};
      automaticTabs.add(id);
      return {start:true};
    })();
    if (msg.operation === 'preferences') return preferences();
    if (msg.operation === 'options') return native('VOICE_OPTIONS');
    if (msg.operation === 'save-preferences') return (async () => {
      const options=await native('VOICE_OPTIONS'), prefs={};
      if (msg.conversationLanguage) {
        if (!options.languages.some(x=>x.id===msg.conversationLanguage)) return {ok:false};
        prefs.conversationLanguage=msg.conversationLanguage;
      }
      if (msg.voiceId) {
        if (!options.voices.some(x=>x.id===msg.voiceId)) return {ok:false};
        prefs.voiceId=msg.voiceId;
      }
      await browser.storage.local.set({voicePreferences:prefs});
      return {ok:true,...prefs};
    })();
    const type=Object.prototype.hasOwnProperty.call(commands,msg.operation) ? commands[msg.operation] : null;
    if (type) {
      if (type === 'VOICE_START' && Number.isInteger(sender.tab?.id)) automaticTabs.add(sender.tab.id);
      const extra={};
      if (type === 'VOICE_START' && typeof msg.conversationLanguage === 'string') extra.conversationLanguage=msg.conversationLanguage;
      return send(type,extra);
    }
  });
})();
