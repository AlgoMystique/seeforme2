/* Dependency-free visual behavior tests. This fixture does not emulate layout/CSS. */
load('extension/Resources/assistant-ui.js');
let count=0;
function assert(value,name) {if (!value) throw Error(name);count++;}
class Node {
  constructor(tag,doc) {this.tagName=tag;this.doc=doc;this.children=[];this.attributes={};this.dataset={};this.style={};this.listeners={};this.hidden=false;this.disabled=false;this.value='';this.textContent='';this.isConnected=true;this.rect={left:700,right:1020,top:400,bottom:760,width:320,height:360};}
  setAttribute(key,value) {this.attributes[key]=String(value);}
  getAttribute(key) {return this.attributes[key] ?? null;}
  append(...nodes) {for (const node of nodes) {node.parent=this;this.children.push(node);}}
  replaceChildren(...nodes) {this.children=[];this.append(...nodes);}
  attachShadow() {this.shadow=new Node('#shadow',this.doc);return this.shadow;}
  contains(node) {return node === this || this.children.some(child => child.contains(node));}
  addEventListener(type,fn) {(this.listeners[type] ||= []).push(fn);}
  removeEventListener(type,fn) {this.listeners[type]=(this.listeners[type] || []).filter(x => x !== fn);}
  fire(type,event={}) {for (const fn of this.listeners[type] || []) fn(event);}
  click() {if (!this.disabled) this.fire('click',{target:this});}
  focus() {this.doc.activeElement=this;}
  remove() {this.isConnected=false;}
  getBoundingClientRect() {return this.rect;}
  matches() {return ['input','textarea','select'].includes(this.tagName);}
}
function fixture() {
  const doc={activeElement:null,listeners:{},createElement(tag) {return new Node(tag,this);},createElementNS(ns,tag){return new Node(tag,this);},addEventListener(type,fn){(this.listeners[type] ||= []).push(fn);},removeEventListener(type,fn){this.listeners[type]=(this.listeners[type] || []).filter(x => x !== fn);}};
  doc.body=new Node('body',doc);doc.documentElement=doc.body;
  let timerId=0;const timers=new Map();
  const win={innerWidth:1200,innerHeight:800,setTimeout(fn,delay){timers.set(++timerId,{fn,delay});return timerId;},clearTimeout(id){timers.delete(id);}};
  const highlights=[];const ui=SeeForMeAssistant.create(doc,win,{highlightFields:ids => highlights.push(ids)});
  function all(node=ui.panel) {return [node,...node.children.flatMap(child => all(child))];}
  const find=cls => all().find(n => n.className?.split(' ').includes(cls));
  return {doc,win,ui,all,find,timers,highlights};
}
try {
  const f=fixture(), {ui,find}=f;
  assert(ui.panel.dataset.avatar === 'idle','idle avatar by default');
  assert(ui.start.textContent === 'Help me fill this form','working start control retained');
  assert(f.all().filter(n => n.tagName === 'button').every(n => n.type === 'button'),'controls cannot submit page form');
  assert(ui.voiceButton.disabled && ui.voiceButton.getAttribute('aria-label') === 'Start voice','microphone prepared but unavailable until native commands exist');
  assert(ui.input.maxLength === 1000 && ui.send.disabled,'typed input protocol limit and initial state');
  const draft='Keep my draft';ui.input.value=draft;
  ui.renderState({state:'needs_input',question:{text:'What is your email?',fieldIds:['email']}},{started:true});
  assert(ui.question.textContent === 'What is your email?' && !find('composer').hidden,'current question and composer');
  ui.renderState({state:'processing'},{started:true});
  assert(ui.panel.dataset.avatar === 'idle','form processing does not invent native voice activity');
  assert(ui.question.textContent === 'What is your email?','question retained during processing');
  assert(ui.input.value === draft,'state changes preserve draft');
  ui.renderState({state:'needs_input',voiceState:'listening'},{started:true});
  assert(ui.panel.dataset.avatar === 'idle','unrecognised voice field cannot fake listening');
  let voiceSeq=0;
  const activity=(state,extra={}) => ({v:1,type:'VOICE_STATE',state,instanceId:'00000000-0000-4000-8000-000000000001',seq:++voiceSeq,ttlMs:15000,...extra});
  ui.setVoiceState(activity('listening'));assert(ui.panel.dataset.avatar === 'listening','confirmed listening visual');
  ui.setVoiceState(activity('speaking'));assert(ui.panel.dataset.avatar === 'speaking','confirmed speaking visual');
  ui.setVoiceState('unknown');assert(ui.panel.dataset.avatar === 'speaking','unknown visual voice state ignored');
  ui.clearVoiceState();
  ui.renderState({state:'ready_for_review'},{started:true});
  assert(ui.panel.dataset.avatar === 'idle' && !find('review').hidden,'review remains available with the confirmed idle avatar');
  assert(!find('composer').hidden && ui.voiceButton.disabled,'review keeps the prepared voice control and typed input accessible');
  const correction=f.all().find(n => n.getAttribute('aria-label') === 'Make a correction');correction.click();
  assert(!find('composer').hidden && f.doc.activeElement === ui.input,'correction restores typed input focus');
  assert(ui.input.value === draft,'review preserves draft');
  ui.renderState({state:'ready_for_review',question:{text:'Would you like to change anything?',fieldIds:[]}},{started:true});
  assert(!find('composer').hidden,'review questions retain typed answer access');
  const nativeListening=activity('listening',{speechDetected:true});ui.setVoiceState(nativeListening);
  assert(ui.panel.dataset.speech === 'true','speech indication comes from real detection');
  const timersBefore=f.timers.size;ui.setVoiceState(nativeListening);assert(f.timers.size === timersBefore,'duplicate native state does not restart expiry');
  ui.setVoiceState({...nativeListening,state:'speaking',seq:nativeListening.seq-1});assert(ui.panel.dataset.avatar === 'listening','older state ignored by visual component');
  ui.setVoiceState(activity('transcribing'));assert(ui.panel.dataset.avatar === 'thinking' && ui.panel.dataset.voice === 'transcribing','transcribing has real thinking treatment');
  ui.setVoiceState(activity('thinking'));assert(ui.panel.dataset.voice === 'thinking','native thinking displayed');
  ui.setVoiceState(activity('error',{message:'Microphone permission is off.'}));assert(ui.panel.dataset.avatar === 'idle' && find('voice-hint').textContent === 'Microphone permission is off.','native error displayed safely');
  assert(ui.input.value === draft,'voice updates preserve typed draft');
  ui.setVoiceState(activity('speaking'));ui.renderState({state:'ended'},{started:false});assert(ui.panel.dataset.avatar === 'speaking','form ending does not fabricate microphone shutdown');
  const expiry=Array.from(f.timers.values()).find(t => t.delay === 15000);expiry.fn();assert(ui.panel.dataset.avatar === 'idle','voice expires to idle locally');
  ui.renderState({state:'needs_input'},{started:true});
  const malicious='<img src=x onerror=alert(1)>';
  ui.renderState({state:'needs_input',question:{text:malicious,fieldIds:[]}},{started:true});
  assert(ui.question.textContent === malicious && ui.question.children.length === 0,'untrusted question rendered as text');
  ui.updateSnapshot({fields:[{id:'a',required:true,visible:true,disabled:false,currentValuePresent:true},{id:'b',required:true,visible:true,disabled:false,currentValuePresent:false},{id:'optional',required:false,visible:true,disabled:false,currentValuePresent:false}]});
  assert(find('track').getAttribute('aria-valuenow') === '50','required progress excludes optional fields');
  ui.updateStatus({missingRequiredFieldIds:['b'],validationIssues:[{fieldId:'a',code:'TYPE_MISMATCH'}]});
  assert(find('track').getAttribute('aria-valuenow') === '0','invalid filled field is not completed');
  ui.showFillResult({results:[{fieldId:'a',success:true},{fieldId:'b',success:false}],missingRequiredFieldIds:['b'],validationIssues:[]});
  assert(f.highlights.at(-1).join(',') === 'a','only verified successful fields flash');
  assert(find('fill-note').textContent === '1 field updated and checked','verified completion feedback');
  ui.renderState({state:'needs_input',question:{text:'Next?',fieldIds:['b']}},{started:true});
  assert(f.highlights.at(-1).includes('a') && f.highlights.at(-1).includes('b'),'verified fill highlight survives next question briefly');
  const flash=Array.from(f.timers.values()).find(t => t.delay === 1200);flash.fn();
  assert(f.highlights.at(-1).join(',') === 'b','flash restores latest question highlight');
  ui.renderState({state:'needs_input',question:{text:'Would you like to fill optional fields?',fieldIds:[]}},{started:true});
  assert(f.highlights.at(-1).length === 0 && !find('composer').hidden,'optional offer has no highlights and preserves typed answer');
  ui.updateSnapshot({fields:[{id:'optional',required:false,visible:true,disabled:false,currentValuePresent:false}]});
  ui.showFillResult({results:[{fieldId:'optional',success:true}],missingRequiredFieldIds:[],validationIssues:[]});
  assert(find('track').getAttribute('aria-valuenow') === '0','success alone does not fabricate filled state');
  let sent=0, prevented=0;ui.send.disabled=false;ui.send.addEventListener('click',() => sent++);
  ui.input.fire('keydown',{key:'Enter',metaKey:true,preventDefault(){prevented++;}});
  assert(sent === 1 && prevented === 1,'command-enter invokes existing send control');
  ui.input.fire('keydown',{key:'Enter',ctrlKey:true,isComposing:true,preventDefault(){throw Error('IME should not submit');}});
  ui.input.fire('keydown',{key:'Enter',preventDefault(){throw Error('plain Enter should stay multiline');}});
  ui.send.disabled=true;ui.input.fire('keydown',{key:'Enter',ctrlKey:true});assert(sent === 1,'IME and disabled send protected');
  ui.panel.fire('keydown',{key:'Escape',preventDefault(){},stopPropagation(){}});
  assert(ui.panel.dataset.collapsed === 'true','escape minimizes');
  const expand=f.all().find(n => n.getAttribute('aria-label') === 'Expand assistant');
  assert(expand.getAttribute('aria-expanded') === 'false' && f.doc.activeElement === expand,'collapse focus and aria state');
  expand.click();assert(ui.panel.dataset.collapsed === 'false','keyboard-operable expansion');
  find('move').click();assert(ui.host.style.left === '14px','move control changes dock side');
  find('move').click();
  const pageInput=new Node('input',f.doc);pageInput.rect={left:750,right:1000,top:500,bottom:540,width:250,height:40};
  f.doc.listeners.focusin[0]({target:pageInput});assert(ui.host.style.left === '14px','focused field avoids assistant');
  ui.renderState({state:'ready_for_review'},{started:true});
  f.all().find(n => n.getAttribute('aria-label') === 'Review form').click();
  assert(ui.panel.dataset.collapsed === 'true' && f.doc.activeElement === pageInput,'review returns user to page without submission');
  ui.renderState({state:'needs_input',modelAvailable:false},{started:true});assert(/fallback/.test(ui.fallback.textContent),'accurate model-unavailable copy');
  ui.renderState({state:'needs_input',modelAvailable:true},{started:true});assert(/on your Mac/.test(ui.fallback.textContent),'local claim requires host availability');
  ui.resetVisual();assert(find('progress-section').hidden && ui.panel.dataset.avatar === 'idle','reset clears visual progress');
  assert(ui.input.value === draft,'visual reset does not mutate workflow-owned input');
  ui.dispose();assert(!ui.host.isConnected && !f.doc.listeners.focusin.length && !f.timers.size,'visual lifecycle cleans listeners and timers');
  const css=f.ui.host.shadow.children[0].textContent;
  assert(css.includes('prefers-reduced-motion: reduce') && css.includes('animation: none !important'),'reduced motion styling');
  assert(css.includes('forced-colors: active') && css.includes('100dvh'),'high contrast and viewport bounds');
  function luminance(hex) {const rgb=hex.match(/\w\w/g).map(c => parseInt(c,16)/255).map(c => c <= .04045 ? c/12.92 : ((c+.055)/1.055)**2.4);return rgb[0]*.2126+rgb[1]*.7152+rgb[2]*.0722;}
  for (const [foreground,background] of [['242d2c','fffefa'],['5e6b68','fffefa'],['fffefa','24665f'],['637168','f6f7f2']]) {const a=luminance(foreground),b=luminance(background);assert((Math.max(a,b)+.05)/(Math.min(a,b)+.05) >= 4.5,'text contrast '+foreground);}
  print('PASS '+count+' visual behavior assertions');
} catch(e) {print('FAIL '+e.message);quit(1);}
