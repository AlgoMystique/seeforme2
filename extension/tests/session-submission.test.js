globalThis.URL=class {constructor(s) {const m=/^(https?):\/\/([^/:?#]+)(:\d+)?/.exec(s);if (!m) throw Error('url');this.protocol=m[1]+':';this.hostname=m[2];this.origin=m[1]+'://'+m[2]+(m[3] || '');}};
load('extension/Resources/protocol.js');load('extension/Resources/session.js');
let assertions=0;function check(value,name) {if (!value) throw Error(name);assertions++;}
function event(){return {addListener(fn){this.fn=fn;},removeListener(){}};}
const documentId='00000000-0000-4000-8000-000000000001';
function fixture(options={}) {
  let sequence=2,submitCalls=0,unknown=options.unknownOnce,release,hold=options.hold;
  const requests=[],messages=[],port={onMessage:event(),onDisconnect:event(),disconnect(){}};
  const snapshot={pageOrigin:'https://example.test',submitAvailable:options.available !== false,fields:[{id:'f1',kind:'text',label:'Name',required:true,visible:true,disabled:false,currentValuePresent:true}]};
  const context={documentId,revision:1};
  const reply=(req,fields) => ({v:1,type:'HOST_REPLY',sessionId:req.sessionId,requestId:req.requestId,modelAvailable:true,actions:[],...fields});
  const review={status:'ready_for_review',question:{text:'Would you like me to submit it now?',fieldIds:[]}};
  const browser={runtime:{id:'extension',onMessage:event(),connectNative:() => port,async sendNativeMessage(app,req) {
if (req.type === 'LOCAL_CONTEXT') return {v:1,type:'CONTEXT_STATE',requestId:req.requestId,ok:true,state:{active:true,connected:false}};
    check(SeeForMeProtocol.request(req),'valid outbound message');requests.push(req);
    if (hold === req.type) {hold=null;await new Promise(resolve => release=resolve);}
    if (req.type === 'FORM_SNAPSHOT') return reply(req,options.snapshotReply || review);
    if (req.type === 'USER_UTTERANCE') {
      if (unknown) {unknown=false;return reply(req,{status:'error',errorCode:'UNKNOWN_SESSION'});}
      return reply(req,options.utteranceReply || {status:'submit',message:'Submitting the form now.'});
    }
    if (req.type === 'SUBMIT_RESULT') {if (options.lostAck) throw Error('lost acknowledgement');return reply(req,req.success ? {status:'ended',message:'Check the page to confirm it went through.'} : {status:'ready_for_review',message:'Please submit manually.'});}
    return reply(req,{status:'ended'});
  }},tabs:{onUpdated:event(),onRemoved:event(),get:async () => ({url:'https://example.test/form'}),query:async () => [{id:1}],async sendMessage(tabId,msg) {
    messages.push(msg);
    if (msg.operation === 'capture') return {context,snapshot};
    if (msg.operation === 'status') return {missingRequiredFieldIds:[],validationIssues:[]};
    if (msg.operation === 'submit') {
      submitCalls++;
      check(msg.authorizationId === requests.filter(r => r.type === 'USER_UTTERANCE').at(-1)?.requestId,'submission bound to native authorisation request');
      if (options.navigateOnSubmit) browser.tabs.onUpdated.fn(1,{status:'loading'});
      if (options.lostContentReply) throw Error('document reply lost');
      return options.result || {success:true};
    }
  }}};
  const session=SeeForMeSession.start(browser,{randomUUID:() => '00000000-0000-4000-8000-'+String(sequence++).padStart(12,'0')});
  const sender={id:'extension',frameId:0,tab:{id:1,url:'https://example.test/form'},url:'https://example.test/form'};
  const call=payload => browser.runtime.onMessage.fn({channel:'seeforme',documentId,...payload},sender);
  return {start:() => call({operation:'start',context,snapshot}),answer:() => call({operation:'utterance',text:'yes'}),voice:() => port.onMessage.fn({v:1,type:'USER_INPUT',text:'yes',source:'voice'}),calls:() => submitCalls,requests,messages,browser,session,release:() => release(),isHeld:() => !!release};
}
async function drain(until=() => false) {for (let i=0;i<80;i++) {if (until()) return;await Promise.resolve();}}
(async () => {
  let f=fixture();await f.start();await f.answer();
  check(f.calls() === 1,'typed confirmation submits once');
  check(f.requests.filter(r => r.type === 'SUBMIT_RESULT').length === 1,'one submission report');
  check(f.messages.some(m => m.state === 'submitting' && m.message === 'Submitting the form now.'),'native submitting message displayed');
  const before=f.requests.length;await f.answer();await f.voice();check(f.calls() === 1 && f.requests.length === before,'finished session ignores further typed and voice input');f.session.dispose();
  f=fixture();await f.start();await f.voice();check(f.calls() === 1 && f.requests.some(r => r.type === 'USER_UTTERANCE' && r.source === 'voice'),'real voice turn follows same confirmation path');f.session.dispose();
  f=fixture({utteranceReply:{status:'ready_for_review',message:'Submit it yourself.'}});await f.start();await f.answer();check(f.calls() === 0,'text yes alone never submits without native authorisation');f.session.dispose();
  f=fixture({available:false});await f.start();await f.answer();check(!f.calls() && f.requests.find(r => r.type === 'SUBMIT_RESULT').errorCode === 'NO_SUBMIT_CONTROL','capability required');f.session.dispose();
  f=fixture({snapshotReply:{status:'needs_input',question:{text:'Fill optional fields?',fieldIds:[]}}});await f.start();await f.answer();check(!f.calls(),'optional-field yes cannot authorise submission');check(f.messages.some(m => m.question?.fieldIds.length === 0),'optional question forwarded intact');f.session.dispose();
  f=fixture({snapshotReply:{status:'submit'}});await f.start();check(!f.calls(),'snapshot response cannot submit');f.session.dispose();
  f=fixture({utteranceReply:{status:'submit',question:{text:'Submit?',fieldIds:[]}}});await f.start();await f.answer();check(!f.calls(),'malformed submit reply rejected');f.session.dispose();
  f=fixture({result:{success:false,errorCode:'VALIDATION_FAILED',privateValue:'must not leave content'}});await f.start();await f.answer();const report=f.requests.find(r => r.type === 'SUBMIT_RESULT');check(report.errorCode === 'VALIDATION_FAILED' && !('privateValue' in report),'failure report strips nonprotocol data');await f.answer();check(f.calls() === 1,'failed submission is not automatically retried');f.session.dispose();
  f=fixture({navigateOnSubmit:true});await f.start();await f.answer();const types=f.requests.map(r => r.type);check(types.at(-2) === 'SUBMIT_RESULT' && types.at(-1) === 'SESSION_RESET','navigation reports result before host reset');check(f.requests.find(r => r.type === 'SUBMIT_RESULT').success,'navigation does not discard known success');f.session.dispose();
  f=fixture({lostContentReply:true});await f.start();await f.answer();check(f.requests.find(r => r.type === 'SUBMIT_RESULT').errorCode === 'OTHER','lost document reply reported without inventing success');await f.answer();check(f.calls() === 1,'lost document reply never triggers retry');f.session.dispose();
  f=fixture({lostAck:true});await f.start();await f.answer();await f.answer();check(f.calls() === 1,'lost native acknowledgement never triggers repeat');f.session.dispose();
  f=fixture({unknownOnce:true});await f.start();await f.answer();check(!f.calls() && f.requests.filter(r => r.type === 'USER_UTTERANCE').length === 1,'unknown session does not replay yes');await f.answer();check(f.calls() === 1,'fresh confirmation after recovery works');f.session.dispose();
  f=fixture({hold:'USER_UTTERANCE'});await f.start();const waiting=f.answer();await drain(f.isHeld);f.browser.tabs.onUpdated.fn(1,{status:'loading'});f.release();await waiting;check(!f.calls(),'late native authorisation after navigation dropped');f.session.dispose();
  f=fixture({hold:'FORM_SNAPSHOT'});const starting=f.start();await drain(f.isHeld);await f.voice();f.release();await starting;await drain();check(!f.requests.some(r => r.type === 'USER_UTTERANCE') && !f.calls(),'speech queued before prompt cannot confirm');check(f.messages.some(m => m.message?.includes('answer the submission question now')),'fresh answer requested after early queued speech');f.session.dispose();
  print('PASS '+assertions+' submission-session assertions');
})().catch(e => {print('FAIL '+e.message);quit(1);});
