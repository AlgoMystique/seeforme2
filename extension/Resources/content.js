/* Content entry point: load dom.js before this file. Top frame only. */
(function () {
  'use strict';
  if (window.top !== window || globalThis.__seeForMeInstalled) return;
  globalThis.__seeForMeInstalled=true;
  let engine=SeeForMeDOM.createEngine(document,window), documentId, started=false, busy=false, lastUrl=location.href;
  const host=document.createElement('div');
  // A shadow root keeps page styling from disrupting the small interaction panel.
  host.style.cssText='position:fixed;bottom:20px;right:20px;z-index:2147483647';
  const shadow=host.attachShadow({mode:'closed'});
  const style=document.createElement('style');
  style.textContent=':host{all:initial}section{font:14px system-ui;color:#17252b;background:#fff;border:1px solid #c8d5d9;border-radius:16px;padding:18px;width:290px;box-shadow:0 8px 32px #0003}h2{font-size:18px;margin:0 0 8px}p{line-height:1.45}textarea{box-sizing:border-box;width:100%;min-height:65px;font:inherit;border:1px solid #81979f;border-radius:8px;padding:8px}button{font:inherit;border-radius:8px;border:1px solid #2c656c;background:#175e66;color:white;padding:8px 12px;margin:8px 6px 0 0}button:disabled{opacity:.55}small{display:block;color:#4c6068;line-height:1.4;margin-top:12px}';
  const panel=document.createElement('section'), title=document.createElement('h2'), status=document.createElement('p'), question=document.createElement('p'), input=document.createElement('textarea'), start=document.createElement('button'), send=document.createElement('button'), reset=document.createElement('button'), privacy=document.createElement('small'), fallback=document.createElement('small');
  title.textContent='SeeForMe';status.textContent='Ready to help with this form.';status.setAttribute('role','status');status.setAttribute('aria-live','polite');question.setAttribute('aria-live','polite');input.setAttribute('aria-label','Your answer');input.maxLength=1000;start.textContent='Inspect form';send.textContent='Send answer';reset.textContent='Start over';send.disabled=true;
  privacy.textContent='Voice, when enabled in the app, is processed by ElevenLabs. Review all fields before submitting yourself.';
  panel.append(title,status,question,input,start,send,reset,fallback,privacy);shadow.append(style,panel);
  (document.body || document.documentElement).append(host);
  function capture() {const c=engine.captureProtocol();documentId=c.context.documentId;c.snapshot.pageTitle=document.title.slice(0,120);return c;}
  function state(msg) {
    const labels={processing:'Processing your answer…',filling:'Filling and checking fields…',needs_input:'Ready for your answer.',ready_for_review:'Ready for your review. Submit the form yourself.',ended:'Session ended.',error:'Please try again.'};
    busy=['processing','filling'].includes(msg.state);send.disabled=busy || !started;start.disabled=busy;
    status.textContent=msg.message || labels[msg.state] || 'Ready.';
    question.textContent=msg.question?.text || '';
    engine.highlight(msg.question?.fieldIds || []);
    if (msg.modelAvailable !== undefined) fallback.textContent=msg.modelAvailable ? 'Form reasoning runs on your Mac.' : 'Local AI is unavailable. Using the fallback matcher.';
  }
  async function request(payload) {
    try {const result=await browser.runtime.sendMessage({channel:'seeforme',documentId,...payload}); if (result?.error || !result) state({state:'error',message:result?.error === 'BUSY' ? 'Please wait for the current step.' : 'Could not connect. Inspect the form to retry.'});return result;}
    catch (_) {state({state:'error',message:'Could not connect to the native app. Check that it is running.'});}
  }
  start.addEventListener('click',async () => {const c=capture();if (!c.snapshot.fields.length) {state({state:'error',message:'No supported form fields found on this page.'});return;}started=true;state({state:'processing'});await request({operation:'start',...c});});
  send.addEventListener('click',async () => {if (busy || !started || !input.value.trim()) return;const text=input.value.trim();state({state:'processing'});const result=await request({operation:'utterance',text});if (result?.ok) input.value='';});
  reset.addEventListener('click',async () => {await request({operation:'reset'});started=false;busy=false;engine.highlight([]);send.disabled=true;start.disabled=false;input.value='';question.textContent='';fallback.textContent='';status.textContent='Session cleared. Existing field values are preserved.';});
  browser.runtime.onMessage.addListener((msg,sender) => {
    if (sender.id !== browser.runtime.id || msg?.channel !== 'seeforme' || msg.documentId !== documentId) return;
    if (msg.operation === 'capture') return Promise.resolve(capture());
    if (msg.operation === 'status') {capture();return Promise.resolve(engine.protocolStatus());}
    if (msg.operation === 'fill') return engine.fillProtocol(msg.context,msg.actions);
    if (msg.operation === 'state') state(msg);
  });
  // Polling catches pushState/replaceState without patching page-world history APIs.
  let timer=setInterval(() => {if (location.href !== lastUrl) {lastUrl=location.href;void request({operation:'reset'});engine.dispose();engine=SeeForMeDOM.createEngine(document,window);started=false;busy=false;documentId=undefined;state({state:'ended',message:'Page changed. Inspect the new form to continue.'});}},500);
  window.addEventListener('pagehide',() => {clearInterval(timer);engine.dispose();started=false;documentId=undefined;});
  window.addEventListener('pageshow',event => {
    if (!event.persisted) return;
    engine=SeeForMeDOM.createEngine(document,window);lastUrl=location.href;
    state({state:'ended',message:'Page restored. Inspect the form to continue.'});
    timer=setInterval(() => {if (location.href !== lastUrl) {lastUrl=location.href;void request({operation:'reset'});engine.dispose();engine=SeeForMeDOM.createEngine(document,window);started=false;documentId=undefined;state({state:'ended',message:'Page changed. Inspect the new form to continue.'});}},500);
  });
})();
