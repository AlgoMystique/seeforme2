// Native options and preference bridge: no API key, audio, or live native calls.
(async function () {
  let count=0, listener, toolbar, stored={}, wrongId=false, requests=[], tabMessages=[], explicitlyOff=false;
  const check=(ok,name)=>{if(!ok)throw Error(name);count++;};
  globalThis.crypto={randomUUID:()=> '00000000-0000-4000-8000-000000000001'};
  globalThis.browser={
    storage:{local:{get:async()=>({voicePreferences:stored}),set:async x=>{stored=x.voicePreferences;}}},
    action:{onClicked:{addListener(fn){toolbar=fn;}},setBadgeText:async()=>{}},
    tabs:{query:async()=>[{id:5}],onRemoved:{addListener(){}},sendMessage:async(id,msg)=>{tabMessages.push({id,...msg});}},
    runtime:{id:'extension',onMessage:{addListener(fn){listener=fn;}},sendNativeMessage:async(app,req)=>{
if (req.type === 'LOCAL_CONTEXT') return {v:1,type:'CONTEXT_STATE',requestId:req.requestId,ok:true,state:{active:!explicitlyOff,explicitlyOff,connected:false}};
      requests.push(req);
      if(req.type==='VOICE_OPTIONS')return {v:1,type:'VOICE_OPTIONS',requestId:req.requestId,systemLanguage:'fr-FR',languages:[{id:'fr',name:'French'},{id:'en',name:'English'}],voices:[{id:'voice-one',name:'One'}]};
      return {v:1,type:'VOICE_ACK',requestId:wrongId?'wrong':req.requestId,accepted:true,appLaunched:false};
    }}
  };
  load('seeforme/SeeForMeExtension/voice-bridge.js');
  const call=(operation,extra={})=>listener({channel:'seeforme-voice',operation,...extra},{id:'extension'});
  check(listener({channel:'seeforme-voice',operation:'start'},{id:'foreign'})===undefined,'foreign sender rejected');
  const options=await call('options');
  check(options.systemLanguage==='fr-FR','Mac preferred language returned');
  check((await call('save-preferences',{conversationLanguage:'xx',voiceId:'voice-one'})).ok===false,'unsupported language refused');
  check((await call('save-preferences',{conversationLanguage:'fr',voiceId:'unknown'})).ok===false,'unknown voice refused');
  check((await call('save-preferences',{conversationLanguage:'fr',voiceId:'voice-one'})).ok,'supported preferences saved');
  check((await call('preferences')).conversationLanguage==='fr','preference persists separately from form data');
  check((await call('start')).ok,'voice command acknowledgement accepted');
  check(requests.at(-1).conversationLanguage==='fr' && requests.at(-1).voiceId==='voice-one','start forwards native choices');
  await call('start',{conversationLanguage:'en'});
  check(requests.at(-1).conversationLanguage==='en','effective session language overrides saved default');
  await call('stop');
  check(!('voiceId' in requests.at(-1)),'stop carries no unnecessary configuration');
  wrongId=true;
  check(!(await call('start')).ok,'mismatched acknowledgement refused');
  await toolbar({id:5});
  check(tabMessages.at(-1).operation==='toolbar-start','toolbar starts through page inspection');
  await call('save-preferences',{conversationLanguage:'',voiceId:'voice-one'});
  check(!('conversationLanguage' in stored),'Mac default remains an omitted override');
  const auto=(id)=>listener({channel:'seeforme-voice',operation:'auto-start'},{id:'extension',frameId:0,tab:{id}});
  check(!(await auto(6)).start,'background tab cannot auto-start voice');
  explicitlyOff=true;
  check(!(await auto(5)).start,'explicit OFF survives automatic-start checks');
  explicitlyOff=false;
  check((await auto(5)).start,'active tab receives one automatic start');
  check(!(await auto(5)).start,'completion or reload cannot repeatedly auto-start');
  print('PASS '+count+' voice preference assertions');
})().catch(e=>{print('FAIL '+e.message);quit(1);});
