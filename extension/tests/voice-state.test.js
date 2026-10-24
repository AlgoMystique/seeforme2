// Native VOICE_STATE contract and display-only routing; no audio/network dependencies.
globalThis.URL=class {constructor(s){const m=/^(https?):\/\/([^/:?#]+)(:\d+)?/.exec(s);if(!m)throw Error('url');this.protocol=m[1]+':';this.hostname=m[2];this.origin=m[1]+'://'+m[2]+(m[3]||'');}};
load('extension/Resources/protocol.js');load('extension/Resources/session.js');
let checks=0;function check(value,label){if(!value)throw Error(label);checks++;}
const instance='aaaaaaaa-0000-4000-8000-000000000001', restarted='bbbbbbbb-0000-4000-8000-000000000002';
const state=(seq=1,extra={})=>({v:1,type:'VOICE_STATE',state:'listening',speechDetected:true,instanceId:instance,seq,ttlMs:15000,...extra});
const P=SeeForMeProtocol;
check(P.voiceState(state()).speechDetected,'real listening state accepted');
check(P.voiceState({name:'seeforme',userInfo:state()}).state==='listening','Safari-wrapped state accepted');
for(const value of ['idle','transcribing','thinking','speaking','error'])check(P.voiceState(state(1,{state:value,speechDetected:undefined})).state===value,'native '+value+' accepted');
for(const changes of [{instanceId:'not-a-uuid'},{seq:-1},{seq:1.5},{seq:'1'},{seq:Number.MAX_SAFE_INTEGER+1},{ttlMs:0},{ttlMs:-1},{ttlMs:1.5},{ttlMs:'15000'},{ttlMs:Infinity},{state:'recording'},{v:2},{speechDetected:'yes'},{state:'speaking'},{message:'not an error'}])check(P.voiceState(state(1,changes))===null,'invalid voice metadata rejected');
check(!P.voiceState(state(1,{state:'error',speechDetected:undefined,message:'x'.repeat(201)})),'oversized error rejected');
check(P.voiceState(state(1,{instanceId:instance.toUpperCase()})).instanceId===instance,'UUID case canonicalized');
check(!('text' in P.voiceState({...state(),text:'not part of voice state'})),'unrelated text is not forwarded');
check(P.push(state())===null,'activity is never treated as a transcript');
check(P.voiceState(state(1,{level:.7,muted:true})).level===.7,'real level preserved');
check(P.voiceState(state(1,{muted:true})).muted===true,'native mute preserved');
for(const extra of [{level:-1},{level:1.1},{level:NaN},{muted:'yes'},{state:'thinking',speechDetected:undefined,level:.4}])check(!P.voiceState(state(1,extra)),'invalid audio metadata rejected');
function event(){return {addListener(fn){this.fn=fn;},removeListener(){this.fn=null;}};}
function fixture(){
  let active=1,time=1000000,timerId=0,uuid=10,holdQueries=false;
  const timers=new Map(),queries=[],requests=[],messages=[],urls=new Map([[1,'https://example.test/form-one'],[2,'https://example.test/form-two'],[3,'https://example.test/no-session']]);
  const clock={now:()=>time,setTimeout(fn,delay){timers.set(++timerId,{at:time+delay,fn});return timerId;},clearTimeout(id){timers.delete(id);}};
  const port={onMessage:event(),onDisconnect:event(),disconnect(){}};
  const browser={runtime:{id:'extension',onMessage:event(),connectNative:()=>port,async sendNativeMessage(app,req){requests.push(req);return {v:1,type:'HOST_REPLY',sessionId:req.sessionId,requestId:req.requestId,status:'needs_input',actions:[],modelAvailable:true,question:{text:'Your answer?',fieldIds:['f1']}};}},tabs:{onUpdated:event(),onRemoved:event(),onActivated:event(),get:async id=>({id,url:urls.get(id)}),query:()=>holdQueries?new Promise(resolve=>queries.push(resolve)):Promise.resolve([{id:active}]),async sendMessage(id,message){messages.push({id,...message});if(message.operation==='capture')return {context:{documentId:'document-'+id,revision:1},snapshot:{pageOrigin:'https://example.test',fields:[]}};}},windows:{onFocusChanged:event()}};
  const manager=SeeForMeSession.start(browser,{randomUUID:()=> '00000000-0000-4000-8000-'+String(uuid++).padStart(12,'0')},clock);
  async function start(id){return browser.runtime.onMessage.fn({channel:'seeforme',operation:'start',documentId:'document-'+id,context:{documentId:'document-'+id,revision:1},snapshot:{fields:[]}},{id:'extension',frameId:0,tab:{id,url:urls.get(id)},url:urls.get(id)});}
  return {start,emit:raw=>port.onMessage.fn(raw),port,browser,manager,requests,messages,timers,urls,queries,clock,
    setActive:async id=>{active=id;return browser.tabs.onActivated.fn({tabId:id});},
    hold:()=>{holdQueries=true;},unhold:()=>{holdQueries=false;},
    async advance(ms){time+=ms;for(const [id,t]of [...timers])if(t.at<=time){timers.delete(id);await t.fn();}}};
}
const voiceMessages=f=>f.messages.filter(m=>['voice-state','voice-idle'].includes(m.operation));
async function drain(){for(let i=0;i<15;i++)await Promise.resolve();}
(async()=>{
  let f=fixture();await f.emit(state());check(f.requests.length===0 && voiceMessages(f).length===0,'no-session activity cannot create or advance a form');f.manager.dispose();
  f=fixture();await f.start(1);const baseline=f.requests.length;await f.emit({name:'seeforme',userInfo:state()});
  check(voiceMessages(f).at(-1).id===1 && voiceMessages(f).at(-1).voice.state==='listening','activity reaches active session');
  check(f.requests.length===baseline && !f.messages.some(m=>['fill','submit'].includes(m.operation)),'voice state has no native or automation side effects');
  const deadline=[...f.timers.values()][0].at;const delivered=voiceMessages(f).length;
  await f.advance(500);await f.emit(state());await f.emit(state(0));
  check(voiceMessages(f).length===delivered && [...f.timers.values()][0].at===deadline,'duplicate and older messages cannot extend TTL');
  await f.advance(14500);check(voiceMessages(f).at(-1).operation==='voice-idle','TTL expires to idle');
  await f.emit(state());check(voiceMessages(f).at(-1).operation==='voice-idle','expired old sequence cannot revive activity');
  await f.emit(state(2,{state:'speaking',speechDetected:undefined}));check(voiceMessages(f).at(-1).voice.state==='speaking','new sequence revives real activity');
  await f.emit(state(0,{instanceId:restarted,state:'thinking',speechDetected:undefined}));check(voiceMessages(f).at(-1).voice.instanceId===restarted,'new app instance resets native ordering');
  const nativeBefore=f.requests.length;f.port.onDisconnect.fn();await drain();check(voiceMessages(f).at(-1).operation==='voice-idle' && f.requests.length===nativeBefore,'disconnect clears display without native calls');f.manager.dispose();
  f=fixture();await f.start(1);await f.start(2);await f.emit(state());await f.advance(3000);await f.setActive(2);
  const routed=voiceMessages(f);check(routed.at(-2).id===1 && routed.at(-2).operation==='voice-idle','old tab stops displaying microphone activity');
  check(routed.at(-1).id===2 && routed.at(-1).voice.ttlMs===12000,'new active tab uses remaining native TTL');
  await f.setActive(3);check(voiceMessages(f).at(-1).id===2 && voiceMessages(f).at(-1).operation==='voice-idle','tab without session only clears previous display');
  const count=voiceMessages(f).length;await f.emit(state(2));check(voiceMessages(f).length===count,'uninitialised active tab ignores heartbeat');f.manager.dispose();
  f=fixture();await f.start(1);const requestsBefore=f.requests.length;f.urls.set(1,'https://example.test/navigated');await f.emit(state());
  check(voiceMessages(f).length===0 && f.requests.length===requestsBefore,'stale URL heartbeat does not reset native session');f.manager.dispose();
  f=fixture();await f.start(1);f.hold();const old=f.emit(state(1));const fresh=f.emit(state(2,{state:'speaking',speechDetected:undefined}));
  check(f.queries.length===2,'routing is pending');f.queries.shift()([{id:1}]);await old;f.queries.shift()([{id:1}]);await fresh;f.unhold();
  check(voiceMessages(f).length===1 && voiceMessages(f)[0].voice.seq===2,'late async routing cannot display an older state');
  const prior=voiceMessages(f).length;f.manager.dispose();await f.emit(state(3));await f.advance(15000);check(voiceMessages(f).length===prior && f.timers.size===0,'disposed background cancels voice timers and deliveries');
  f=fixture();await f.start(1);await f.emit(state(1,{ttlMs:1000}));await f.advance(900);await f.emit(state(2,{ttlMs:1000}));await f.advance(100);check(voiceMessages(f).at(-1).operation==='voice-state','real heartbeat renews activity');await f.advance(900);check(voiceMessages(f).at(-1).operation==='voice-idle','renewed state still expires');f.manager.dispose();
  print('PASS '+checks+' native voice-state assertions');
})().catch(error=>{print('FAIL '+error.message);quit(1);});
