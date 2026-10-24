load('extension/Resources/dom.js');
load('extension/Resources/background.js');
// JavaScriptCore CLI lacks the browser URL API.
 globalThis.URL = class { constructor(url) {this.protocol = url.split(':')[0] + ':';} };
let passed = 0;
function assert(ok, name) { if (!ok) throw Error(name); passed++; }
class Input {
  constructor(type = 'text') { this.tagName = 'INPUT'; this.type = type; this.name = 'answer'; this.id = ''; this.autocomplete = ''; this.isConnected = true; this.disabled = false; this.readOnly = false; this.required = false; this.labels = [{textContent: 'Answer'}]; this.attributes = {}; this._value = ''; this.checked = false; this.events = []; this.validity = {valid: true}; this.form = null; }
  get value() { return this._value; }
  set value(v) { this._value = v; }
  getAttribute(k) { return this.attributes[k] ?? null; }
  matches() { return this.disabled; }
  closest() { return null; }
  getClientRects() { return this.hidden ? [] : [{}]; }
  dispatchEvent(e) { this.events.push(e.type); if (this.onEvent) this.onEvent(e); }
}
const checked = new WeakMap();
Object.defineProperty(Input.prototype, 'checked', {get() {return checked.get(this) || false;}, set(v) {checked.set(this, v);}});
function fixture(fields) {
  const listeners = {};
  const win = {crypto: {randomUUID: () => 'document'}, location: {href:'https://example.test/form', origin:'https://example.test'}, getComputedStyle: () => ({display:'block', visibility:'visible'}), HTMLInputElement: Input, HTMLSelectElement: Input, HTMLTextAreaElement: Input, Event: class {constructor(type) {this.type = type;}}, setTimeout: f => f(), addEventListener: (n,f) => listeners[n] = f};
  const doc = {querySelectorAll: () => fields, getElementById: () => null};
  return {engine: SeeForMeDOM.createEngine(doc,win), win, listeners};
}
(async function () {
  const text = new Input(), password = new Input('password'), payment = new Input(); payment.autocomplete = 'cc-number';
  const f = fixture([text,password,payment]);
  let snap = f.engine.capture();
  assert(snap.fields.length === 1, 'blocked fields omitted');
  assert(!('value' in snap.fields[0]), 'values omitted');
  const id = snap.fields[0].id;
  snap = f.engine.capture(); assert(id === snap.fields[0].id, 'stable ID');
  let result = await f.engine.fill(snap,[{fieldId:id,value:'hello'}]);
  assert(result.results[0].success && text.value === 'hello', 'fill verified');
  assert(text.events.join(',') === 'input,change', 'events dispatched');
  result = await f.engine.fill(snap,[{fieldId:id,value:'again'}]); assert(result.results[0].errorCode === 'DUPLICATE_ACTION', 'duplicate rejected');
  snap = f.engine.capture(); result = await f.engine.fill(snap,[{fieldId:id,value:'other'}]); assert(result.results[0].errorCode === 'OVERWRITE_DENIED', 'occupied protected');
  snap = f.engine.capture(); text.value = 'user edit'; result = await f.engine.fill(snap,[{fieldId:id,value:'other'}],[id]); assert(result.results[0].errorCode === 'FIELD_CHANGED', 'concurrent edit protected');
  snap = f.engine.capture(); f.win.location.href += '/next'; result = await f.engine.fill(snap,[]); assert(result.error === 'STALE_CONTEXT','navigation rejected');
  const g = fixture([new Input()]); const old = g.engine.capture(); g.engine.capture(); assert((await g.engine.fill(old,[])).error === 'STALE_CONTEXT','old snapshot rejected');
  const h = fixture([new Input()]); const hs = h.engine.capture(); h.listeners.pagehide(); assert((await h.engine.fill(hs,[])).error === 'STALE_CONTEXT','pagehide invalidates');
  const reverting = new Input(); reverting.onEvent = () => reverting.value = ''; const r = fixture([reverting]); const rs = r.engine.capture(); assert((await r.engine.fill(rs,[{fieldId:rs.fields[0].id,value:'x'}])).results[0].errorCode === 'VERIFICATION_FAILED','page rejection detected');
  const cb = new Input('checkbox'), c = fixture([cb]), cs = c.engine.capture(); assert((await c.engine.fill(cs,[{fieldId:cs.fields[0].id,value:true}])).results[0].success && cb.checked,'checkbox supported');
  let blocked = false; try {SeeForMeBackground.createRouter({},null);} catch (_) {blocked = true;} assert(blocked,'protocol adapter required');
  function eventSource() { return { addListener(f) {this.listener = f;}, removeListener() {} }; }
  const runtime = {id:'extension', onMessage:eventSource()}, tabs = {onUpdated:eventSource(), onRemoved:eventSource(), get:async () => ({url:'https://example.test/form'})};
  let nativeCalls = 0, finish;
  const adapter = {validateRequest: m => m.valid === true, validateResponse: r => r.valid === true, sendNative: () => {nativeCalls++; return new Promise(resolve => finish = resolve);} };
  const router = SeeForMeBackground.createRouter({runtime,tabs},adapter);
  const sender = {id:'extension',frameId:0,tab:{id:1},url:'https://example.test/form'};
  await runtime.onMessage.listener({valid:true},{...sender,id:'foreign'});
  await runtime.onMessage.listener({valid:true},{...sender,frameId:2});
  await runtime.onMessage.listener({valid:false},sender);
  assert(nativeCalls === 0,'foreign, frame and invalid messages rejected');
  let reply = runtime.onMessage.listener({valid:true},sender); finish({valid:true});
  assert((await reply).valid,'validated response routed');
  reply = runtime.onMessage.listener({valid:true},sender); tabs.onUpdated.listener(1,{status:'loading'}); finish({valid:true});
  assert(await reply === undefined,'navigation drops pending reply');
  reply = runtime.onMessage.listener({valid:true},sender); finish({valid:false});
  assert(await reply === undefined,'invalid native response rejected');
  router.dispose();
  const select = new Input('select-one'); select.tagName = 'SELECT'; select.options = [{value:'a',label:'A',disabled:false},{value:'b',label:'B',disabled:true}];
  const sf = fixture([select]); let ss = sf.engine.capture();
  assert((await sf.engine.fill(ss,[{fieldId:ss.fields[0].id,value:'b'}])).results[0].errorCode === 'INVALID_OPTION','disabled option rejected');
  ss = sf.engine.capture(); assert((await sf.engine.fill(ss,[{fieldId:ss.fields[0].id,value:'a'}])).results[0].success,'native select filled');
  const detached = new Input(), df = fixture([detached]), ds = df.engine.capture(); detached.isConnected = false;
  assert((await df.engine.fill(ds,[{fieldId:ds.fields[0].id,value:'x'}])).results[0].errorCode === 'FIELD_CHANGED','detached field rejected');
  const radioA=new Input('radio'), radioB=new Input('radio'); radioA.name=radioB.name='size';radioA.value='s';radioB.value='m';radioA.labels=[{textContent:'Small'}];radioB.labels=[{textContent:'Medium'}];
  const rg=fixture([radioA,radioB]);const rgs=rg.engine.captureProtocol();
  assert(rgs.snapshot.fields.length === 1 && rgs.snapshot.fields[0].kind === 'radio-group','radios grouped');
  assert(rgs.snapshot.fields[0].options.length === 2,'radio options extracted');
  let rr=await rg.engine.fillProtocol(rgs.context,[{fieldId:rgs.snapshot.fields[0].id,value:'m'}]);
  assert(rr.results[0].success && radioB.checked,'radio group option filled');
  const protocolCb=new Input('checkbox'), cf=fixture([protocolCb]), cfs=cf.engine.captureProtocol();
  assert((await cf.engine.fillProtocol(cfs.context,[{fieldId:cfs.snapshot.fields[0].id,value:'true'}])).results[0].success,'wire checkbox string converted');
  const required=new Input();required.required=true;const rf=fixture([required]);rf.engine.captureProtocol();
  assert(rf.engine.protocolStatus().missingRequiredFieldIds.length === 1,'required status');
  const sf2=fixture([select]);const ss2=sf2.engine.captureProtocol();assert(ss2.snapshot.fields[0].kind === 'select','select wire kind');
  const other=new Input('text');other.autocomplete='one-time-code';assert(fixture([other]).engine.captureProtocol().snapshot.fields.length === 0,'authentication excluded');
  const ms=new Input('select-multiple');ms.tagName='SELECT';ms.multiple=true;assert(fixture([ms]).engine.captureProtocol().snapshot.fields.length === 0,'multiple select excluded');
  print('PASS ' + passed + ' focused assertions');
})().catch(e => {print('FAIL ' + e.message); quit(1);});
