load('extension/Resources/dom.js');
let assertions=0;
const authorization='00000000-0000-4000-8000-000000000099';
function check(value,name) {if (!value) throw Error(name);assertions++;}
class Control {
  constructor(type='text',tag='INPUT') {this.tagName=tag;this.type=type;this.value=type === 'text' ? 'Synthetic answer' : '';this.checked=false;this.name=type;this.id='';this.autocomplete='';this.required=false;this.disabled=false;this.readOnly=false;this.isConnected=true;this.labels=[{textContent:type === 'submit' ? 'Register' : 'Name'}];this.attributes={};this.style={};this.form=null;this.validity={valid:true};this.willValidate=true;this.textContent=type === 'submit' ? 'Register' : '';this.width=160;this.height=32;}
  getAttribute(key) {return this.attributes[key] ?? null;}
  matches() {return this.disabled;}
  closest() {return null;}
  getClientRects() {return [{width:this.width,height:this.height}];}
}
class Form {
  constructor(doc) {this.ownerDocument=doc;this.isConnected=true;this.elements=[];this.noValidate=false;this.action='https://example.test/register';this.method='post';this.target='';this.enctype='application/x-www-form-urlencoded';this.calls=0;this.checks=0;}
  querySelector() {return this.blockedEmbed || null;}
  querySelectorAll() {return this.descendantInputs || [];}
  checkValidity() {this.checks++;if (this.onCheck) this.onCheck();return this.elements.every(el => el.validity.valid);}
  requestSubmit(control) {this.calls++;this.lastControl=control;if (this.onRequest) this.onRequest();const bad=this.elements.find(el => !el.validity.valid);if (bad) {this.ownerDocument.emit('invalid',{target:bad});return;}if (!this.noSubmitEvent) this.ownerDocument.emit('submit',{target:this,submitter:control});if (this.onSubmit) this.onSubmit();}
}
function fixture() {
  const nodes=[],events={};
  const doc={querySelector(){return this.challenge || null;},querySelectorAll(selector) {return selector === 'button,input' ? nodes.filter(el => ['INPUT','BUTTON'].includes(el.tagName)) : nodes.filter(el => ['INPUT','SELECT','TEXTAREA'].includes(el.tagName));},getElementById(){return null;},addEventListener(name,fn){(events[name] ||= []).push(fn);},removeEventListener(name,fn){events[name]=(events[name] || []).filter(f => f !== fn);},emit(name,event){for (const fn of events[name] || []) fn(event);}};
  const win={document:doc,crypto:{randomUUID:() => '00000000-0000-4000-8000-000000000001'},location:{href:'https://example.test/form',origin:'https://example.test'},HTMLFormElement:Form,getComputedStyle:() => ({display:'block',visibility:'visible'}),addEventListener(){}};win.top=win;
  const form=new Form(doc), field=new Control(), control=new Control('submit','BUTTON');
  function add(el,owner=form) {el.ownerDocument=doc;el.form=owner;nodes.push(el);if (owner) owner.elements.push(el);return el;}
  add(field);add(control);
  const engine=SeeForMeDOM.createEngine(doc,win);
  function ready() {engine.captureProtocol();engine.reviewSubmission();return engine.captureProtocol();}
  return {engine,form,field,control,doc,win,nodes,events,add,ready};
}
try {
  let f=fixture();let snapshot=f.ready();
  check(snapshot.snapshot.submitAvailable === true,'ordinary single form advertises submission');
  check(!JSON.stringify(snapshot.snapshot).includes('Synthetic answer'),'snapshot omits current values');
  let result=f.engine.submitProtocol(snapshot.context,authorization);
  check(result.success && f.form.calls === 1 && f.form.lastControl === f.control,'authorised native requestSubmit uses exact control once');
  check(!f.engine.submitProtocol(snapshot.context,authorization).success && f.form.calls === 1,'duplicate authorisation cannot resubmit');
  f.engine.resetSubmissionSession();check(!f.engine.captureProtocol().snapshot.submitAvailable,'new session cannot repeat an executed submission in the same document');
  check(!f.events.submit.length && !f.events.invalid.length,'native event observation cleaned up');
  f=fixture();snapshot=f.engine.captureProtocol();check(f.engine.submitProtocol(snapshot.context,authorization).errorCode === 'FORM_CHANGED' && !f.form.calls,'unreviewed form cannot submit');
  f=fixture();snapshot=f.ready();check(f.engine.submitProtocol(snapshot.context,'not-native-id').errorCode === 'OTHER' && !f.form.calls,'malformed authorisation rejected');
  for (const type of ['password','file']) {f=fixture();f.add(new Control(type));check(!f.engine.captureProtocol().snapshot.submitAvailable,type+' prevents capability');}
  for (const hint of ['cc-number','one-time-code','g-recaptcha-response','payment-token','username','transaction-amount']) {f=fixture();const protectedInput=f.add(new Control('hidden'));protectedInput.autocomplete=hint;check(!f.engine.captureProtocol().snapshot.submitAvailable,hint+' gate prevents capability');}
  f=fixture();f.form.descendantInputs=[new Control('password')];check(!f.engine.captureProtocol().snapshot.submitAvailable,'protected descendant input remains blocked even with different form association');
  f=fixture();f.form.blockedEmbed={};check(!f.engine.captureProtocol().snapshot.submitAvailable,'embedded gate requires manual flow');
  f=fixture();f.doc.challenge={};check(!f.engine.captureProtocol().snapshot.submitAvailable,'page-level CAPTCHA remains manual');
  f=fixture();f.form.action='https://example.test/login';check(!f.engine.captureProtocol().snapshot.submitAvailable,'authentication destination remains manual');
  f=fixture();f.control.textContent='Pay now';check(!f.engine.captureProtocol().snapshot.submitAvailable,'payment control requires manual flow');
  f=fixture();f.control.onclick=() => {};check(!f.engine.captureProtocol().snapshot.submitAvailable,'click confirmation handler is not bypassed');
  f=fixture();f.form.noValidate=true;check(!f.engine.captureProtocol().snapshot.submitAvailable,'novalidate form not advertised');
  f=fixture();f.control.attributes['aria-disabled']='true';check(!f.engine.captureProtocol().snapshot.submitAvailable,'ARIA-disabled gate stays manual');
  f=fixture();f.control.formMethod='dialog';check(!f.engine.captureProtocol().snapshot.submitAvailable,'dialog confirmation is not treated as submission');
  f=fixture();f.form.action='javascript:void(0)';check(!f.engine.captureProtocol().snapshot.submitAvailable,'non-HTTP form action rejected');
  f=fixture();f.control.formNoValidate=true;check(!f.engine.captureProtocol().snapshot.submitAvailable,'formnovalidate control not advertised');
  f=fixture();f.form.requestSubmit=() => {};check(!f.engine.captureProtocol().snapshot.submitAvailable,'overridden requestSubmit not bypassed');
  f=fixture();f.add(new Control(),new Form(f.doc));check(!f.engine.captureProtocol().snapshot.submitAvailable,'mixed forms rejected');
  f=fixture();f.add(new Control(),null);check(!f.engine.captureProtocol().snapshot.submitAvailable,'unowned snapshot field rejected');
  f=fixture();f.add(new Control('submit','BUTTON'));check(!f.engine.captureProtocol().snapshot.submitAvailable,'ambiguous submit controls rejected');
  f=fixture();f.control.disabled=true;check(!f.engine.captureProtocol().snapshot.submitAvailable,'disabled submit control rejected');
  f=fixture();f.control.width=0;check(!f.engine.captureProtocol().snapshot.submitAvailable,'zero-sized submit control rejected');
  f=fixture();const hiddenSubmit=f.add(new Control('submit','BUTTON'));hiddenSubmit.height=0;check(f.engine.captureProtocol().snapshot.submitAvailable,'hidden alternative is not an enabled visible control');
  f=fixture();f.win.top={};check(!f.engine.captureProtocol().snapshot.submitAvailable,'non-top document rejected');
  f=fixture();snapshot=f.ready();f.win.location.href+='?next';check(f.engine.submitProtocol(snapshot.context,authorization).errorCode === 'ORIGIN_CHANGED' && !f.form.calls,'same-origin navigation invalidates authorisation');
  f=fixture();snapshot=f.ready();f.win.location.origin='https://other.test';check(f.engine.submitProtocol(snapshot.context,authorization).errorCode === 'ORIGIN_CHANGED','changed origin rejected');
  f=fixture();snapshot=f.ready();f.control.isConnected=false;check(!f.engine.submitProtocol(snapshot.context,authorization).success && !f.form.calls,'detached submit control rejected');
  f=fixture();snapshot=f.ready();f.form.isConnected=false;check(f.engine.submitProtocol(snapshot.context,authorization).errorCode === 'FORM_CHANGED','detached form rejected');
  f=fixture();f.ready();f.field.value='Changed after review';snapshot=f.engine.captureProtocol();check(f.engine.submitProtocol(snapshot.context,authorization).errorCode === 'FORM_CHANGED' && !f.form.calls,'refresh cannot transfer consent to changed values');
  f=fixture();snapshot=f.ready();f.control.form=null;f.form.elements=f.form.elements.filter(el => el !== f.control);f.add(new Control('submit','BUTTON'));check(f.engine.submitProtocol(snapshot.context,authorization).errorCode === 'FORM_CHANGED' && !f.form.calls,'lookalike replacement submit control rejected');
  f=fixture();snapshot=f.ready();const replacement=new Form(f.doc);for (const el of f.form.elements) {el.form=replacement;replacement.elements.push(el);}check(f.engine.submitProtocol(snapshot.context,authorization).errorCode === 'FORM_CHANGED','replacement form identity rejected');
  f=fixture();snapshot=f.ready();f.form.action='https://example.test/changed';check(f.engine.submitProtocol(snapshot.context,authorization).errorCode === 'FORM_CHANGED','changed destination rejected');
  f=fixture();snapshot=f.ready();f.control.formAction='https://example.test/other';check(f.engine.submitProtocol(snapshot.context,authorization).errorCode === 'FORM_CHANGED','changed submit override rejected');
  f=fixture();snapshot=f.ready();f.add(new Control());check(f.engine.submitProtocol(snapshot.context,authorization).errorCode === 'FORM_CHANGED','new controls require new review');
  f=fixture();f.field.required=true;f.field.value='';f.field.validity={valid:false,valueMissing:true};snapshot=f.ready();check(f.engine.submitProtocol(snapshot.context,authorization).errorCode === 'MISSING_REQUIRED' && !f.form.calls,'required field revalidated');
  f=fixture();f.field.attributes['aria-required']='true';f.field.value='';snapshot=f.ready();check(f.engine.submitProtocol(snapshot.context,authorization).errorCode === 'MISSING_REQUIRED','aria-required respected');
  f=fixture();f.field.validity={valid:false,patternMismatch:true};snapshot=f.ready();check(f.engine.submitProtocol(snapshot.context,authorization).errorCode === 'VALIDATION_FAILED' && !f.form.calls,'constraint validation preserved');
  f=fixture();snapshot=f.ready();f.form.onCheck=() => f.control.formNoValidate=true;check(!f.engine.submitProtocol(snapshot.context,authorization).success && !f.form.calls,'validation-handler mutation checked before submit');
  f=fixture();snapshot=f.ready();f.form.onRequest=() => f.field.validity={valid:false};check(f.engine.submitProtocol(snapshot.context,authorization).errorCode === 'VALIDATION_FAILED' && f.form.calls === 1,'native second validation can stop submission');
  f=fixture();snapshot=f.ready();f.form.noSubmitEvent=true;check(f.engine.submitProtocol(snapshot.context,authorization).errorCode === 'OTHER','missing submit observation is not reported as success');
  f=fixture();snapshot=f.ready();let pageConfirmation=false;f.form.onSubmit=() => pageConfirmation=true;result=f.engine.submitProtocol(snapshot.context,authorization);check(result.success && pageConfirmation,'page submit handlers remain in control');
  check(Object.keys(result).join(',') === 'success','success result contains no field data');
  f=fixture();snapshot=f.ready();f.engine.dispose();result=f.engine.submitProtocol(snapshot.context,authorization);check(result.errorCode === 'ORIGIN_CHANGED' && Object.keys(result).sort().join(',') === 'errorCode,success','disposed document reports only fixed failure code');
  print('PASS '+assertions+' guarded submission assertions');
} catch(e) {print('FAIL '+e.message);quit(1);}
