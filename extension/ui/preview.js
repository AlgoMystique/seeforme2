/* Visual fixture only. Simulated events are deliberately separate from the extension. */
const ui=SeeForMeAssistant.create(document,window,{highlightFields(ids) {
  for (const id of ['first','last','email']) document.getElementById(id).style.outline=ids.includes(id) ? '3px solid #24665f' : '';
}});
const fields=['first','last','email'].map(id => ({id,required:true,visible:true,disabled:false,currentValuePresent:false}));
let previewSeq=0;
function preview(state) {
  ui.clearVoiceState(true);ui.updateSnapshot({fields:fields.map((f,i) => ({...f,currentValuePresent:state === 'completed' || i === 0}))});
  const states={idle:'needs_input',listening:'needs_input',thinking:'processing',speaking:'needs_input',completed:'ready_for_review'};
  ui.renderState({state:states[state],question:state === 'completed' ? null : {text:'What’s the best email to reach you?',fieldIds:['email']},modelAvailable:true},{started:true});
  ui.send.disabled=state === 'thinking';
  if (['listening','speaking','thinking'].includes(state)) ui.setVoiceState({v:1,type:'VOICE_STATE',state,instanceId:'00000000-0000-4000-8000-000000000001',seq:++previewSeq,ttlMs:15000});
  if (state === 'completed') ui.showFillResult({results:fields.map(f => ({fieldId:f.id,success:true})),missingRequiredFieldIds:[],validationIssues:[]});
  document.querySelectorAll('[data-state]').forEach(button => button.setAttribute('aria-pressed',String(button.dataset.state === state)));
}
document.querySelectorAll('[data-state]').forEach(button => button.addEventListener('click',() => preview(button.dataset.state)));
ui.start.addEventListener('click',() => preview('idle'));
ui.send.addEventListener('click',() => {ui.status.textContent='Preview only — your answer has not been sent.';});
ui.reset.addEventListener('click',() => {ui.input.value='';ui.resetVisual();});
