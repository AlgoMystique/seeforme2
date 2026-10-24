// BEGIN GENERATED SEEFORME UI
/* SeeForMe visual component. No browser messaging, field inspection or filling.
   Embedded into content.js by extension/ui/build.py; no manifest change required. */
(function (root) {
  'use strict';
  const CSS = `
    :host { all: initial; color-scheme: light; }
    *, *::before, *::after { box-sizing: border-box; }
    [hidden] { display: none !important; }
    .assistant {
      --paper: #fffefa; --ink: #242d2c; --muted: #5e6b68; --teal: #24665f;
      --mint: #e7f2ec; --line: #e2e6df;
      width: min(360px, calc(100vw - 24px)); max-height: calc(100dvh - 28px);
      overflow: auto; overscroll-behavior: contain;
      color: var(--ink); background: var(--paper); font: 14px/1.45 -apple-system, BlinkMacSystemFont, "Helvetica Neue", sans-serif;
      text-align: left; letter-spacing: -.015em; border: 1px solid #dbe2d9;
      border-radius: 22px; box-shadow: 0 4px 12px #253b3210, 0 18px 56px #253b3224;
      -webkit-font-smoothing: antialiased; isolation: isolate;
      animation: arrive 220ms ease-out;
    }
    button, textarea, summary { font: inherit; }
    button { cursor: pointer; color: inherit; border: 0; }
    button:disabled { cursor: default; opacity: .48; }
    button, summary, textarea { -webkit-tap-highlight-color: transparent; }
    button:focus-visible, summary:focus-visible { outline: 3px solid var(--teal); outline-offset: 3px; }
    button:not(:disabled):active { transform: translateY(1px); }
    button { transition: background 140ms ease, color 140ms ease, transform 140ms ease; }
    p, h2 { margin: 0; } svg { display: block; flex-shrink: 0; }
    .header { display: flex; align-items: center; gap: 10px; padding: 14px 14px 12px; }
    .identity { flex: 1; min-width: 0; }
    h2 { font-size: 26px; font-weight: 650; letter-spacing: -.035em; }
    .state-label { display: flex; align-items: center; gap: 5px; font-size: 11px; color: var(--muted); margin-top: 2px; }
    .state-dot { width: 5px; height: 5px; background: var(--teal); border-radius: 50%; }
    [data-state="error"] .state-dot, [data-voice="error"] .state-dot { background: #9a4d2a; }
    .tools { display: flex; gap: 1px; }
    .icon-button { display: grid; place-items: center; width: 32px; height: 32px; padding: 0; background: transparent; border-radius: 9px; color: #58645f; }
    .icon-button:hover { background: #edf1e9; }
    .body { padding: 1px 18px 0; }
    .eyebrow { color: var(--teal); font-size: 10px; font-weight: 650; letter-spacing: .12em; margin-bottom: 7px; }
    .question { font-size: 19px; font-weight: 550; line-height: 1.3; letter-spacing: -.04em; overflow-wrap: anywhere; max-height: 140px; overflow: auto; }
    .status { color: var(--muted); font-size: 12px; line-height: 1.5; margin-top: 8px; overflow-wrap: anywhere; max-height: 90px; overflow: auto; }
    [data-state="error"] .status { color: #884326; }
    .progress-section { margin: 17px 0 14px; }
    .progress-copy { display: flex; justify-content: space-between; gap: 8px; font-size: 11px; color: var(--muted); margin-bottom: 6px; }
    .progress-copy strong { color: var(--ink); font-weight: 550; }
    .track { height: 4px; background: #e8ece5; border-radius: 8px; overflow: hidden; }
    .bar { height: 100%; width: 0%; border-radius: inherit; background: var(--teal); transition: width 260ms ease; }
    .fill-note { min-height: 16px; font-size: 11px; color: var(--teal); margin-top: 6px; }
    .primary { display: flex; align-items: center; justify-content: center; gap: 8px; width: 100%; min-height: 42px; background: var(--teal); color: #fffefa; border-radius: 11px; font-weight: 550; font-size: 13px; }
    .primary:hover:not(:disabled) { background: #194f49; }
    .start { margin: 17px 0 14px; }
    .call-bar { display:flex; align-items:center; gap:14px; padding:10px; margin:0 14px 14px; border-radius:999px; background:#303231; box-shadow:0 8px 20px #0002; }
    .call-control { display:grid; place-items:center; width:46px; height:46px; border-radius:50%; color:white; background:#565957; flex-shrink:0; }
    .call-control svg { width:25px; height:25px; }
    .hangup { background:#df2028; }
    .waveform { display:flex; flex:1; align-items:center; justify-content:center; gap:4px; height:38px; }
    .waveform span { width:4px; height:4px; border-radius:4px; background:#f5f7f6; transition:height 90ms linear; }
    [data-voice="thinking"] .waveform, [data-voice="transcribing"] .waveform { opacity:.45; }
    [data-collapsed="true"] .call-bar { display:none; }
    .eyebrow, .keyboard-hint { display:none; }
    .question { font-size:17px; }
    .start { font-size:12px; }
    .composer { position: relative; margin-bottom: 12px; }
    .answer-row { display: flex; align-items: stretch; gap: 9px; }
    .text-entry { position: relative; flex: 1; min-width: 0; }
    .microphone { width: 66px; flex-shrink: 0; min-height: 77px; border-radius: 14px; background: var(--teal); color: var(--paper); display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 5px; box-shadow: 0 3px 10px #24665f22; }
    .microphone svg { width: 24px; height: 24px; }
    .microphone span { font-size: 11px; font-weight: 600; }
    .microphone:hover:not(:disabled) { background: #194f49; }
    .microphone[aria-pressed="true"] { background: #174f48; }
    .microphone[aria-pressed="true"]::after { content: ''; width: 5px; height: 5px; border-radius: 50%; background: #c7e8d4; }
    [data-speech="true"] .microphone { animation: mic-hearing 1s ease-in-out infinite; }
    .start { background: #edf1e9; color: var(--teal); }
    .start:hover:not(:disabled) { background: #e1e9dd; }
    .voice-hint[data-error="true"] { color: #884326; }
    @keyframes mic-hearing { 50% { box-shadow: 0 0 0 4px #24665f22; } }

    .input-label { display: block; font-size: 11px; color: var(--muted); margin-bottom: 6px; }
    textarea { display: block; width: 100%; min-height: 77px; max-height: 170px; resize: vertical; padding: 11px 47px 11px 12px; color: var(--ink); background: #f6f7f2; border: 1px solid #d9dfd5; border-radius: 12px; font-size: 13px; line-height: 1.5; letter-spacing: 0; }
    textarea::placeholder { color: #637168; }
    textarea:focus { outline: 2px solid var(--teal); outline-offset: 1px; }
    .send { position: absolute; right: 7px; bottom: 7px; width: 32px; height: 32px; border-radius: 9px; background: var(--teal); color: white; display: grid; place-items: center; }
    .send:hover:not(:disabled) { background: #194f49; }
    .keyboard-hint { margin-top: -5px; margin-bottom: 12px; font-size: 10px; color: var(--muted); }
    .review { padding: 11px 12px; background: #edf4ed; border: 1px solid #d8e6d9; border-radius: 12px; margin: 14px 0; font-size: 12px; line-height: 1.5; color: #36594d; }
    .review strong { display: block; color: #254c40; font-size: 13px; margin-bottom: 3px; }
    .review-actions { display: flex; gap: 8px; margin-bottom: 12px; }
    .review-actions .primary { flex: 1; }
    .text-button { border-radius: 7px; padding: 5px 0; font-size: 11px; background: transparent; color: var(--muted); text-decoration: underline; text-underline-offset: 3px; }
    .text-button:hover { color: var(--ink); }
    .footer { padding: 11px 18px 13px; border-top: 1px solid var(--line); }
    .footer-row { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
    details { min-width: 0; flex: 1; }
    summary { cursor: pointer; font-size: 11px; color: var(--muted); width: fit-content; border-radius: 4px; }
    .privacy, .fallback { display: block; font-size: 11px; line-height: 1.5; color: var(--muted); margin-top: 8px; }
    .fallback:empty { display: none; }
    .voice-hint { font-size: 11px; color: var(--muted); margin: 10px 0 12px; }
    .collapsed-progress { font-size: 10px; color: var(--teal); font-variant-numeric: tabular-nums; }
    [data-collapsed="true"] { width: min(214px, calc(100vw - 24px)); border-radius: 19px; }
    [data-collapsed="true"] .header { padding: 9px 10px; gap: 8px; }
    [data-collapsed="true"] .body, [data-collapsed="true"] .footer, [data-collapsed="true"] .move { display: none; }
    [data-collapsed="true"] .avatar { width: 36px; height: 36px; }
    [data-collapsed="true"] h2 { font-size: 13px; }
    [data-collapsed="false"] .collapsed-progress { display: none; }
    .avatar { width: 60px; height: 60px; position: relative; flex-shrink: 0; }
    .avatar svg { width: 100%; height: 100%; overflow: visible; }
    .eye { transform-box: fill-box; transform-origin: center; animation: blink 7s ease-in-out infinite; }
    .eye-right { animation-delay: .06s; }
    .smile, .closed-eye, .mouth-speaking, .rays, .thinking-dot, .voice-lines { opacity: 0; }
    .mouth-idle { opacity: 1; }
    [data-avatar="thinking"] .eyes { transform: translate(0,-2px); }
    [data-avatar="thinking"] .thinking-dot { opacity: 1; animation: ponder 1.8s ease-in-out infinite; transform-origin: 25px 25px; }
    [data-avatar="listening"] .avatar svg { transform: rotate(-5deg); }
    [data-avatar="listening"] .rays { opacity: 1; animation: listen 1.8s ease-in-out infinite; }
    [data-avatar="speaking"] .mouth-idle { opacity: 0; }
    [data-avatar="speaking"] .mouth-speaking { opacity: 1; transform-box: fill-box; transform-origin: center; animation: talk .65s ease-in-out infinite alternate; }
    [data-avatar="speaking"] .voice-lines { opacity: 1; animation: listen .8s ease-in-out infinite alternate; }
    [data-avatar="completed"] .eye, [data-avatar="completed"] .mouth-idle { opacity: 0; animation: none; }
    [data-avatar="completed"] .closed-eye, [data-avatar="completed"] .smile { opacity: 1; }
    [data-avatar="completed"] .avatar { animation: nod 450ms ease-out; }
    @keyframes arrive { from { opacity: 0; transform: translateY(5px); } to { opacity: 1; transform: none; } }
    @keyframes blink { 0%,43%,47%,100% { transform: scaleY(1); } 45% { transform: scaleY(.12); } }
    @keyframes ponder { 0%,100% { opacity: .35; transform: rotate(-15deg); } 50% { opacity: 1; transform: rotate(15deg); } }
    @keyframes listen { 0%,100% { opacity: .35; } 50% { opacity: 1; } }
    @keyframes talk { from { transform: scaleY(.45); } to { transform: scaleY(1); } }
    @keyframes nod { 0%,100% { transform: rotate(0); } 45% { transform: rotate(7deg); } }
    @media (max-width: 380px) { .assistant { width: calc(100vw - 24px); } .question { font-size: 18px; } }
    @media (max-height: 540px) { .assistant { max-height: calc(100dvh - 20px); } .question { max-height: 72px; } .body { padding-top: 0; } .progress-section { margin-top: 10px; } }
    @media (prefers-reduced-motion: reduce) { *, *::before, *::after { animation: none !important; transition: none !important; scroll-behavior: auto !important; } }
    @media (forced-colors: active) { .assistant, textarea { border: 1px solid CanvasText; } .primary, .send { border: 1px solid ButtonText; } .bar, .state-dot { background: Highlight; } }

    .assistant { display:grid; grid-template-columns:58px minmax(0,1fr); gap:8px 10px; width:min(370px,calc(100vw - 24px)); background:transparent; border:0; box-shadow:none; overflow:visible; padding:4px; }
    .header { display:contents; }
    .avatar { grid-column:1; grid-row:2; width:58px; height:58px; }
    .identity { grid-column:2; grid-row:1; padding-left:12px; }
    h2 { font-size:18px; }
    .state-label { font-size:11px; }
    .tools { grid-column:1; grid-row:1; align-self:center; }
    .icon-button { width:27px; height:27px; background:#fffefa; }
    .microphone { grid-column:2; grid-row:2; width:100%; min-height:58px; border-radius:999px; background:#303231; color:white; flex-direction:row; gap:12px; box-shadow:0 8px 24px #0002; }
    .microphone span { font-size:15px; }
    .call-bar { grid-column:2; grid-row:2; margin:0; padding:6px; gap:10px; min-width:0; }
    .call-control { width:46px; height:46px; }
    .waveform { gap:3px; }
    .waveform span { width:3px; }
    .body { grid-column:1 / -1; background:#fffefa; border:1px solid #e2e6df; border-radius:16px; padding:12px 14px; max-height: min(45dvh,330px); overflow:auto; box-shadow:0 4px 18px #0001; }
    .question { font-size:14px; line-height:1.4; max-height:90px; }
    .status { font-size:11px; }
    .voice-hint { margin:6px 0; }
    .progress-section { margin:10px 0; }
    .conversation-settings { margin-top:6px; font-size:12px; }
    .conversation-settings label { display:block; margin-top:10px; }
    .conversation-settings select { display:block; width:100%; padding:7px; border:1px solid var(--line); border-radius:8px; background:var(--paper); color:var(--ink); font:inherit; }
    .conversation-settings select:focus-visible { outline:3px solid var(--teal); }
    .typing { margin-top:8px; font-size:12px; }
    .typing summary { cursor:pointer; color:var(--teal); padding:4px 0; }
    .typing .start { margin-top:8px; }
    .footer { grid-column:1 / -1; background:#fffefa; border-radius:12px; border:0; padding:7px 12px; }
    [data-state="idle"] .question, [data-state="idle"] .status { display:none; }
    [data-state="idle"] .body { padding:6px 12px; }
    [data-collapsed="true"] .assistant { width:100%; }
    [data-collapsed="true"] .avatar { width:58px; height:58px; }
    [data-collapsed="true"] .call-bar { display:flex; }
  `;

  function create(doc, win, options = {}) {
    function el(tag, className, text) {
      const node=doc.createElement(tag);
      if (className) node.className=className;
      if (text !== undefined) node.textContent=text;
      return node;
    }
    function svgNode(tag, attributes) {
      const node=doc.createElementNS('http://www.w3.org/2000/svg',tag);
      for (const [key,value] of Object.entries(attributes || {})) node.setAttribute(key,String(value));
      return node;
    }
    function icon(path) {
      const svg=svgNode('svg',{viewBox:'0 0 20 20',width:18,height:18,fill:'none',stroke:'currentColor','stroke-width':1.5,'stroke-linecap':'round','stroke-linejoin':'round','aria-hidden':'true'});
      svg.append(svgNode('path',{d:path}));return svg;
    }
    function button(className,label,child) {
      const node=el('button',className,child ? undefined : label);node.type='button';node.setAttribute('aria-label',label);node.title=label;if (child) node.append(child);return node;
    }
    const host=el('div');
    host.style.cssText='all:initial;position:fixed;bottom:14px;right:14px;z-index:2147483647;display:block;max-width:calc(100vw - 24px);';
    const shadow=host.attachShadow({mode:'closed'}), style=el('style');style.textContent=CSS;
    const panel=el('section','assistant');panel.setAttribute('role','region');panel.setAttribute('aria-label','SeeForMe website assistant');
    panel.dataset.state='idle';panel.dataset.avatar='idle';panel.dataset.collapsed='false';
    const header=el('div','header'), avatar=el('div','avatar');avatar.setAttribute('aria-hidden','true');
    const face=svgNode('svg',{viewBox:'0 0 50 50',fill:'none'});
    face.append(svgNode('rect',{x:3,y:4,width:43,height:43,rx:16,fill:'#e5f0e7',stroke:'#bed5c7'}));
    face.append(svgNode('path',{d:'M10 15c1-5 5-7 10-7',stroke:'#fffefa','stroke-width':2.5,'stroke-linecap':'round',opacity:.8}));
    const eyes=svgNode('g',{class:'eyes'});
    eyes.append(svgNode('ellipse',{class:'eye eye-left',cx:18,cy:24,rx:2.3,ry:3.6,fill:'#285b50'}),svgNode('ellipse',{class:'eye eye-right',cx:31,cy:24,rx:2.3,ry:3.6,fill:'#285b50'}));
    eyes.append(svgNode('path',{class:'closed-eye',d:'M15 25q3-5 6 0M28 25q3-5 6 0',stroke:'#285b50','stroke-width':2,'stroke-linecap':'round'}));
    face.append(eyes,svgNode('path',{class:'mouth-idle',d:'M22 32q3 2 5 0',stroke:'#285b50','stroke-width':1.8,'stroke-linecap':'round'}),svgNode('ellipse',{class:'mouth-speaking',cx:25,cy:33,rx:3,ry:3.5,fill:'#285b50'}),svgNode('path',{class:'smile',d:'M21 32q4 6 8 0',stroke:'#285b50','stroke-width':2,'stroke-linecap':'round'}),svgNode('circle',{class:'thinking-dot',cx:39,cy:9,r:3,fill:'#367a6a',stroke:'#fffefa','stroke-width':2}),svgNode('path',{class:'rays',d:'M44 17q5 7 0 14M48 14q6 10 0 20',stroke:'#367a6a','stroke-width':1.5,'stroke-linecap':'round'}),svgNode('path',{class:'voice-lines',d:'M6 22v6M2 20v10',stroke:'#367a6a','stroke-width':1.5,'stroke-linecap':'round'}));
    avatar.append(face);
    const identity=el('div','identity'), title=el('h2','', 'SeeForMe'), stateLabel=el('div','state-label'), dot=el('span','state-dot'), stateText=el('span','', 'Ready when you are'), collapsedProgress=el('span','collapsed-progress');
    stateLabel.append(dot,stateText);identity.append(title,stateLabel,collapsedProgress);
    const tools=el('div','tools'), move=button('icon-button move','Move assistant to the left',icon('M4 10h12M7 6l-4 4 4 4m6-8 4 4-4 4')), minimize=button('icon-button','Minimize assistant',icon('M5 10h10'));
    minimize.setAttribute('aria-expanded','true');tools.append(move,minimize);header.append(avatar,identity,tools);
    const body=el('div','body'), eyebrow=el('p','eyebrow','YOUR BROWSER COMPANION'), question=el('p','question','A little help, in your words.'), status=el('p','status','Tap Talk to begin. Review every answer before submitting.');
    body.id='sfm-body';minimize.setAttribute('aria-controls',body.id);stateText.setAttribute('aria-live','off');
    question.setAttribute('aria-live','polite');question.setAttribute('aria-atomic','true');status.setAttribute('role','status');status.setAttribute('aria-live','polite');
    const progressSection=el('div','progress-section'), progressCopy=el('div','progress-copy'), progressText=el('strong','', 'Form progress'), progressCount=el('span','', '0 / 0'), track=el('div','track'), bar=el('div','bar'), fillNote=el('p','fill-note');
    track.setAttribute('role','progressbar');track.setAttribute('aria-label','Required fields completed');track.setAttribute('aria-valuemin','0');track.setAttribute('aria-valuemax','100');track.setAttribute('aria-valuenow','0');fillNote.setAttribute('role','status');fillNote.setAttribute('aria-live','polite');
    progressCopy.append(progressText,progressCount);track.append(bar);progressSection.append(progressCopy,track,fillNote);progressSection.hidden=true;
    const start=button('primary start','Help me fill this form'), composer=el('div','composer'), inputLabel=el('label','input-label','Or type your answer'), input=el('textarea'), send=button('send','Send answer',icon('M10 15V5m-4 4 4-4 4 4'));
    input.id='sfm-answer';input.rows=2;input.maxLength=1000;input.placeholder='Type your answer…';input.setAttribute('aria-label','Your answer');inputLabel.htmlFor=input.id;send.disabled=true;
    const voiceButton=button('microphone','Start voice'), voiceGlyph=icon('M7 4a3 3 0 0 1 6 0v6a3 3 0 0 1-6 0V4m-3 5v1a6 6 0 0 0 12 0V9m-6 7v3m-3 0h6'), voiceButtonLabel=el('span','', 'Talk');
    voiceButton.append(voiceGlyph,voiceButtonLabel);voiceButton.setAttribute('aria-pressed','false');voiceButton.disabled=true;
    const answerRow=el('div','answer-row'), textEntry=el('div','text-entry');textEntry.append(input,send);answerRow.append(textEntry);
    composer.append(inputLabel,answerRow);composer.hidden=false;
    const keyboardHint=el('p','keyboard-hint','⌘ / Ctrl + Enter to send'), voiceHint=el('p','voice-hint','Voice is powered by the SeeForMe Mac app.');keyboardHint.hidden=false;voiceHint.setAttribute('role','status');voiceHint.setAttribute('aria-live','polite');voiceHint.id='sfm-voice-status';voiceButton.setAttribute('aria-describedby',voiceHint.id);
    const review=el('div','review'), reviewHeading=el('strong','', 'A final look, then you’re done.'), reviewCopy=el('span','', 'Check your answers on the page. Submit when you’re happy with them.');review.append(reviewHeading,reviewCopy);review.hidden=true;
    const reviewActions=el('div','review-actions'), reviewButton=button('primary','Review form'), correct=button('text-button','Make a correction');reviewActions.append(reviewButton,correct);reviewActions.hidden=true;
    const typing=el('details','typing'), typingLabel=el('summary','','Type instead');
    typing.append(typingLabel,start,composer,keyboardHint);
    body.append(question,status,progressSection,review,reviewActions,voiceHint,typing);
    const footer=el('div','footer'), footerRow=el('div','footer-row'), details=el('details'), summary=el('summary','', 'Privacy & voice'), privacy=el('small','privacy','Visible page text is interpreted on-device. ElevenLabs processes your voice audio and spoken replies. Review answers before submitting.'), fallback=el('small','fallback'), reset=button('text-button','Start over');reset.hidden=true;
    details.append(summary,privacy,fallback);footerRow.append(details,reset);footer.append(footerRow);
    const settings=el('details','conversation-settings'), settingsTitle=el('summary','','Language & voice');
    const languageLabel=el('label','','Conversation language'), languageSelect=el('select'), voiceLabel=el('label','','Voice'), voiceSelect=el('select'), saveSettings=button('text-button','Save language and voice'), settingsNote=el('p','voice-hint');
    languageSelect.id='sfm-language';languageLabel.setAttribute('for',languageSelect.id);
    voiceSelect.id='sfm-voice';voiceLabel.setAttribute('for',voiceSelect.id);
    settingsNote.setAttribute('role','status');saveSettings.textContent='Save preferences';
    settings.append(settingsTitle,languageLabel,languageSelect,voiceLabel,voiceSelect,saveSettings,settingsNote);footer.append(settings);
    let settingsLoaded=false;
    settings.addEventListener('toggle',async () => {
      if (!settings.open || settingsLoaded || !options.onSettings) return;
      settingsNote.textContent='Loading supported languages and voices…';
      try {
        const result=await options.onSettings('load');
        languageSelect.replaceChildren();voiceSelect.replaceChildren();
        const system=el('option','','Mac language ('+(result.systemLanguage || 'default')+')');system.value='';languageSelect.append(system);
        for (const item of result.languages || []) {const option=el('option','',item.name);option.value=item.id;languageSelect.append(option);}
        for (const item of result.voices || []) {const option=el('option','',item.name);option.value=item.id;voiceSelect.append(option);}
        languageSelect.value=result.preferences?.conversationLanguage || '';voiceSelect.value=result.preferences?.voiceId || result.voices?.[0]?.id || '';
        settingsLoaded=true;settingsNote.textContent='Applies to your next conversation. Speech is cloud-processed by ElevenLabs.';
      } catch (_) {settingsNote.textContent='Could not load settings. Close and reopen to retry.';}
    });
    saveSettings.addEventListener('click',async () => {
      if (!settingsLoaded || !options.onSettings) return;
      saveSettings.disabled=true;
      try {
        const result=await options.onSettings('save',{conversationLanguage:languageSelect.value,voiceId:voiceSelect.value});
        settingsNote.textContent=result?.ok ? 'Saved. End voice and tap Talk to use these preferences.' : 'Could not save these preferences.';
      } catch (_) {settingsNote.textContent='Could not save these preferences.';}
      finally {saveSettings.disabled=false;}
    });
const callBar=el('div','call-bar'), speaker=button('call-control','Mute spoken replies',icon('M3 8h4l5-4v12l-5-4H3zM15 7q4 3 0 6')), hangup=button('call-control hangup','End conversation',icon('M3 12q7-8 14 0l-2 3-4-2v-2H9v2l-4 2z')), waveform=el('div','waveform');
    waveform.setAttribute('aria-hidden','true');
    const waveBars=Array.from({length:13},() => el('span'));waveform.append(...waveBars);
    callBar.append(speaker,waveform,hangup);callBar.hidden=true;
    panel.append(header,voiceButton,callBar,body,footer);shadow.append(style,panel);
    (doc.body || doc.documentElement).append(host);

    let started=false, collapsed=false, side='right', phase='idle', voice=null, correction=false, reviewQuestion=false, disposed=false;
    let audioLevel=0, muted=false;
    let voiceAvailable=false, voicePending=null, voiceTimer, voiceSeq=-1, voiceInstance=null, voiceMessage='', speechDetected=false;
    let fields=new Map(), invalid=new Set(), lastExternal=null, highlightedIds=[], flashIds=[], flashTimer, noteTimer;
    function attempt(callback) {try {callback();} catch (_) { /* Presentation must not interrupt automation. */ }}
    function setSide(next) {
      side=next;host.style.right=side === 'right' ? '14px' : 'auto';host.style.left=side === 'left' ? '14px' : 'auto';
      const label='Move assistant to the '+(side === 'right' ? 'left' : 'right');move.setAttribute('aria-label',label);move.title=label;
    }
    function setCollapsed(next,focus=false) {
      collapsed=next;panel.dataset.collapsed=String(next);stateText.setAttribute('aria-live',next ? 'polite' : 'off');minimize.setAttribute('aria-expanded',String(!next));
      const label=next ? 'Expand assistant' : 'Minimize assistant';minimize.setAttribute('aria-label',label);minimize.title=label;
      minimize.replaceChildren(icon(next ? 'M5 10h10M10 5v10' : 'M5 10h10'));
      if (focus) minimize.focus();
    }
    function renderAvatar() {
      panel.dataset.avatar=voice ? ({idle:'idle',listening:'listening',transcribing:'thinking',thinking:'thinking',speaking:'speaking',error:'idle'}[voice]) : (phase === 'ready_for_review' ? 'completed' : 'idle');
      const labels={idle:'Ready when you are',processing:'Thinking it through',filling:'Filling your form',submitting:'Submitting with your approval',needs_input:'Your turn',ready_for_review:'Ready to review',ended:'Ready for a fresh start',error:'Let’s try that again'};
      const voiceLabels={idle:'Voice off',listening:speechDetected ? 'Hearing you…' : 'Listening…',transcribing:'Transcribing…',thinking:'Thinking…',speaking:'Speaking…',error:'Voice needs attention'};
      stateText.textContent=voice ? voiceLabels[voice] : labels[phase] || 'Ready to talk';
      panel.dataset.voice=voice || 'idle';panel.dataset.speech=String(voice === 'listening' && speechDetected);
      renderVoiceControl();
    }
    function renderProgress() {
      const eligible=Array.from(fields.values()).filter(f => f.visible && !f.disabled), required=eligible.filter(f => f.required), tracked=required.length ? required : eligible;
      const total=tracked.length, done=tracked.filter(f => f.currentValuePresent && !invalid.has(f.id)).length;
      progressSection.hidden=!total;progressText.textContent=required.length ? 'Required fields' : 'Fields filled';progressCount.textContent=done+' / '+total;
      const percentage=total ? Math.round(done / total * 100) : 0;bar.style.width=percentage+'%';track.setAttribute('aria-valuenow',String(percentage));
      const text=done+' of '+total+(required.length ? ' required fields completed' : ' fields filled');track.setAttribute('aria-valuetext',text);track.setAttribute('aria-label',required.length ? 'Required fields completed' : 'Fields filled');collapsedProgress.textContent=done+' of '+total+' filled';
    }
    function renderVisibility() {
      const reviewing=phase === 'ready_for_review';
      start.hidden=started;composer.hidden=false;keyboardHint.hidden=false;
      review.hidden=!reviewing;reviewActions.hidden=!reviewing;voiceHint.hidden=false;reset.hidden=!started;
      eyebrow.textContent=reviewing ? 'ALL SET FOR YOUR REVIEW' : started ? 'ONE STEP AT A TIME' : 'YOUR BROWSER COMPANION';
    }
    function renderState(message, workflow={}) {
      if (disposed) return;
      phase=message.state || 'idle';panel.dataset.state=phase;reviewQuestion=!!message.question?.text;
      if (typeof workflow.started === 'boolean') started=workflow.started;
      if (phase === 'ended') {fields.clear();invalid.clear();started=false;flashIds=[];win.clearTimeout(flashTimer);win.clearTimeout(noteTimer);fillNote.textContent='';renderProgress();}
      if (phase !== 'ready_for_review') correction=false;
      const defaults={processing:'Finding the right fields for your answer.',filling:'Adding your answers and checking they’re in place.',submitting:'Sending the form with your approval. Follow any steps shown on the page.',needs_input:'Answer by voice, or type below.',ready_for_review:'Your answers are ready for a final check.',ended:'Inspect the form whenever you’re ready.',error:'Your answers are still here. Please try again.'};
      status.textContent=message.message || defaults[phase] || 'Tap Talk to begin. Review every answer before submitting.';
      if (message.question?.text) question.textContent=message.question.text;
      else if (!['processing','filling','submitting'].includes(phase)) question.textContent=phase === 'ready_for_review' ? 'Looks good. Take a final look.' : phase === 'error' ? 'A small pause.' : phase === 'ended' ? 'Ready for the next step.' : 'What would you like to add?';
      highlightedIds=Array.isArray(message.question?.fieldIds) ? message.question.fieldIds.slice() : Array.isArray(message.highlightFieldIds) ? message.highlightFieldIds.slice() : [];
      if (message.question && highlightedIds.length === 0) {flashIds=[];win.clearTimeout(flashTimer);if (options.highlightFields) attempt(() => options.highlightFields([]));}
      if (flashIds.length && options.highlightFields) attempt(() => options.highlightFields([...new Set([...highlightedIds,...flashIds])]));
      if (message.modelAvailable !== undefined) fallback.textContent=message.modelAvailable ? 'Form reasoning runs on your Mac.' : 'Local AI is unavailable. A fallback matcher is helping with your answers.';
      renderAvatar();renderVisibility();
    }
    function updateSnapshot(snapshot) {
      if (disposed || !Array.isArray(snapshot?.fields)) return;
      fields=new Map(snapshot.fields.map(f => [f.id,{id:f.id,required:!!f.required,visible:!!f.visible,disabled:!!f.disabled,currentValuePresent:!!f.currentValuePresent}]));
      invalid=new Set(Array.from(invalid).filter(id => fields.has(id)));renderProgress();
    }
    function updateStatus(result) {
      if (disposed) return;
      invalid=new Set([...(result.missingRequiredFieldIds || []),...(result.validationIssues || []).map(i => i.fieldId)]);renderProgress();
    }
    function showFillResult(result) {
      if (disposed || !Array.isArray(result?.results)) return;
      const success=result.results.filter(r => r.success === true).map(r => r.fieldId);
      // Counts come from fresh snapshots/status, not assumptions about action values.
      updateStatus(result);
      win.clearTimeout(noteTimer);fillNote.textContent=success.length ? success.length+' '+(success.length === 1 ? 'field' : 'fields')+' updated and checked' : 'Some answers need another look.';
      noteTimer=win.setTimeout(() => {fillNote.textContent='';},3500);
      if (success.length && options.highlightFields) {
        win.clearTimeout(flashTimer);flashIds=success;attempt(() => options.highlightFields([...new Set([...highlightedIds,...success])]));
        flashTimer=win.setTimeout(() => {flashIds=[];attempt(() => options.highlightFields(highlightedIds));},1200);
      }
    }
    function resetVisual() {
      fields.clear();invalid.clear();started=false;win.clearTimeout(voiceTimer);voice='idle';speechDetected=false;voicePending=null;voiceMessage='';correction=false;reviewQuestion=false;phase='idle';panel.dataset.state='idle';
      win.clearTimeout(flashTimer);win.clearTimeout(noteTimer);fillNote.textContent='';highlightedIds=[];flashIds=[];
      question.textContent='A fresh start, at your pace.';renderProgress();renderAvatar();renderVisibility();
    }
    function renderVoiceControl() {
      const active=voice !== null && voice !== 'idle';
      callBar.hidden=!active;voiceButton.hidden=active;
      speaker.disabled=!voiceAvailable || !!voicePending;
      hangup.disabled=!voiceAvailable || !!voicePending;
      speaker.setAttribute('aria-label',muted ? 'Unmute spoken replies' : 'Mute spoken replies');
      speaker.setAttribute('aria-pressed',String(muted));speaker.style.opacity=muted ? '.55' : '1';
      const level=['listening','speaking'].includes(voice) ? audioLevel : 0;
      waveBars.forEach((bar,i) => {bar.style.height=(4+level*(12+22*(1-Math.abs(i-6)/6)))+'px';});
      voiceButton.disabled=!voiceAvailable || !!voicePending || (!active && ['processing','filling','submitting'].includes(phase));
      voiceButton.setAttribute('aria-pressed',String(active));
      const label=voicePending === 'start' ? 'Starting voice…' : voicePending === 'stop' ? 'Stopping voice…' : active ? 'Stop voice' : 'Start voice';
      voiceButton.setAttribute('aria-label',label);voiceButton.title=label;voiceButtonLabel.textContent=voicePending ? 'Wait…' : active ? 'Stop' : 'Talk';
      voiceHint.dataset.error=String(voice === 'error' || !!voiceMessage);
      if (voiceMessage) voiceHint.textContent=voiceMessage;
      else if (voicePending) voiceHint.textContent=voicePending === 'start' ? 'Starting your conversation…' : 'Ending your conversation…';
      else if (voice === 'error') voiceHint.textContent='Voice encountered a problem. Use the Mac app’s voice controls or continue by typing.';
      else if (voice === 'listening') voiceHint.textContent=speechDetected ? 'I can hear you. Finish your answer naturally.' : 'Microphone is live. Tell me your answer.';
      else if (voice === 'transcribing') voiceHint.textContent='Turning your speech into text with ElevenLabs…';
      else if (voice === 'thinking') voiceHint.textContent='Working on your answer or preparing a spoken reply…';
      else if (voice === 'speaking') voiceHint.textContent=voiceAvailable ? 'Speaking. Tap the red button to end the conversation.' : 'The Mac app is speaking. Use its voice control to stop.';
      else voiceHint.textContent=voiceAvailable ? 'Tap Talk to begin your conversation.' : 'Safari voice controls need the native app update. Voice in the Mac app still works.';
    }
    function setVoiceControlAvailable(available,reason='') {voiceAvailable=available === true && typeof options.onVoiceAction === 'function';voiceMessage=reason;renderVoiceControl();}
    function setVoicePending(action) {voicePending=['start','stop'].includes(action) ? action : null;voiceMessage='';renderVoiceControl();}
    function voiceControlFailed(message) {voicePending=null;voiceMessage=String(message || 'Could not reach the Mac app. Please try again.').slice(0,200);renderVoiceControl();}
    function clearVoiceState(resetOrdering=false) {if (resetOrdering) {voiceInstance=null;voiceSeq=-1;}win.clearTimeout(voiceTimer);voice='idle';speechDetected=false;voicePending=null;voiceMessage='';renderAvatar();}
    function setVoiceState(activity) {
      if (disposed || !activity || activity.v !== 1 || activity.type !== 'VOICE_STATE' || !['idle','listening','transcribing','thinking','speaking','error'].includes(activity.state) ||
          typeof activity.instanceId !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(activity.instanceId) || !Number.isSafeInteger(activity.seq) || activity.seq < 0 || !Number.isSafeInteger(activity.ttlMs) || activity.ttlMs <= 0) return;
      const instance=activity.instanceId.toLowerCase();
      if (instance === voiceInstance && activity.seq <= voiceSeq) return;
      voiceInstance=instance;voiceSeq=activity.seq;voice=activity.state;
      speechDetected=voice === 'listening' && activity.speechDetected === true;
      audioLevel=Number.isFinite(activity.level) ? Math.max(0,Math.min(1,activity.level)) : 0;muted=activity.muted === true;
      voiceMessage=voice === 'error' ? String(activity.message || 'Voice encountered a problem.').slice(0,200) : '';
      if (voicePending === 'start' && voice !== 'idle' || voicePending === 'stop' && voice === 'idle') voicePending=null;
      win.clearTimeout(voiceTimer);voiceTimer=win.setTimeout(clearVoiceState,Math.min(activity.ttlMs,2147483647));
      renderAvatar();
    }
    async function callAction(action) {
      if (!voiceAvailable || voicePending) return;
      try {await options.onVoiceAction(action);} catch (_) {voiceControlFailed('Could not update voice. Please try again.');}
    }
    speaker.addEventListener('click',() => callAction(muted ? 'unmute' : 'mute'));
    hangup.addEventListener('click',() => callAction('stop'));
    voiceButton.addEventListener('click',() => {
      if (voiceButton.disabled || typeof options.onVoiceAction !== 'function') return;
      const action=voice !== null && voice !== 'idle' ? 'stop' : 'start';
      setVoicePending(action);
      Promise.resolve().then(() => options.onVoiceAction(action)).catch(error => voiceControlFailed(error?.code === 'BUSY' ? 'Please wait for the current form step to finish.' : undefined));
    });
    function onFocus(event) {
      const target=event.target;if (!target || target === host || shadow.contains(target)) return;
      lastExternal=target;
      if (!target.matches?.('input,textarea,select,[contenteditable="true"]')) return;
      attempt(() => {
        const field=target.getBoundingClientRect(), assistant=host.getBoundingClientRect();
        const overlaps=r => r.left < field.right+8 && r.right > field.left-8 && r.top < field.bottom+8 && r.bottom > field.top-8;
        if (!overlaps(assistant)) return;
        const alternateLeft=side === 'right' ? 14 : win.innerWidth-assistant.width-14;
        const alternate={left:alternateLeft,right:alternateLeft+assistant.width,top:assistant.top,bottom:assistant.bottom};
        if (!overlaps(alternate)) setSide(side === 'right' ? 'left' : 'right');
        else {setCollapsed(true);host.style.bottom='auto';host.style.top=field.top > win.innerHeight/2 ? '14px' : 'auto';if (field.top <= win.innerHeight/2) host.style.bottom='14px';}
      });
    }
    move.addEventListener('click',() => setSide(side === 'right' ? 'left' : 'right'));
    minimize.addEventListener('click',() => setCollapsed(!collapsed,true));
    reviewButton.addEventListener('click',() => {setCollapsed(true);if (lastExternal?.isConnected) attempt(() => lastExternal.focus({preventScroll:true}));else minimize.focus();});
    correct.addEventListener('click',() => {correction=true;typing.open=true;renderVisibility();input.focus();});
    input.addEventListener('keydown',event => {if ((event.metaKey || event.ctrlKey) && event.key === 'Enter' && !event.isComposing && !send.disabled) {event.preventDefault();send.click();}});
    panel.addEventListener('keydown',event => {if (event.key === 'Escape' && !collapsed) {event.preventDefault();event.stopPropagation();setCollapsed(true,true);}});
    doc.addEventListener('focusin',onFocus);
    renderVoiceControl();
    function dispose() {disposed=true;win.clearTimeout(voiceTimer);win.clearTimeout(flashTimer);win.clearTimeout(noteTimer);doc.removeEventListener('focusin',onFocus);host.remove();}
    return {host,panel,title,status,question,input,start,send,reset,privacy,fallback,renderState,updateSnapshot,updateStatus,showFillResult,resetVisual,setVoiceState,clearVoiceState,setVoiceControlAvailable,setVoicePending,voiceControlFailed,voiceButton,dispose};
  }
  root.SeeForMeAssistant=Object.freeze({create});
})(globalThis);
// END GENERATED SEEFORME UI
/* Content entry point: load dom.js before this file. Top frame only. */
(function () {
  'use strict';
  if (window.top !== window || globalThis.__seeForMeInstalled) return;
  globalThis.__seeForMeInstalled=true;
  let engine=SeeForMeDOM.createEngine(document,window), documentId, started=false, busy=false, lastUrl=location.href;
  let voiceRouteId=null, voiceRevision=-1;
  const retiredVoiceRoutes=new Set();
  let preferences={}, sessionLanguage;
  // Visual layer only. Workflow controls retain their existing event handlers below.
  const assistant=SeeForMeAssistant.create(document,window,{highlightFields:ids => engine.highlight(ids),onVoiceAction:voiceAction,onSettings:settingsAction});
  const {host,panel,title,status,question,input,start,send,reset,privacy,fallback}=assistant;
  function present(method,...args) {try {assistant[method](...args);} catch (_) { /* UI must not interrupt workflow. */ }}
  function capture() {const c=engine.captureProtocol();documentId=c.context.documentId;c.snapshot.pageTitle=document.title.slice(0,120);if (sessionLanguage || preferences.conversationLanguage) c.snapshot.conversationLanguage=sessionLanguage || preferences.conversationLanguage;present('updateSnapshot',c.snapshot);return c;}
  function state(msg) {
    if (msg.conversationLanguage) sessionLanguage=msg.conversationLanguage;
    busy=['processing','filling','submitting'].includes(msg.state);send.disabled=busy || !started;start.disabled=busy;
    engine.highlight(msg.question?.fieldIds || msg.highlightFieldIds || []);
    if (msg.state === 'ready_for_review' && msg.question) engine.reviewSubmission();
    else if (['needs_input','ended','error'].includes(msg.state)) engine.resetSubmissionReview();
    present('renderState',msg,{started,busy});
  }
  async function request(payload) {
    try {const result=await browser.runtime.sendMessage({channel:'seeforme',documentId,...payload}); if (result?.error || !result) state({state:'error',message:result?.error === 'BUSY' ? 'Please wait for the current step.' : 'Could not connect. Inspect the form to retry.'});return result;}
    catch (_) {state({state:'error',message:'Could not connect to the native app. Check that it is running.'});}
  }
  async function settingsAction(action,value) {
    if (action === 'save') return browser.runtime.sendMessage({channel:'seeforme-voice',operation:'save-preferences',...value});
    const [options,prefs]=await Promise.all([
      browser.runtime.sendMessage({channel:'seeforme-voice',operation:'options'}),
      browser.runtime.sendMessage({channel:'seeforme-voice',operation:'preferences'})
    ]);
    return {...options,preferences:prefs};
  }
  async function inspect() {if (busy) return false;state({state:'processing'});
    try {preferences=await browser.runtime.sendMessage({channel:'seeforme-voice',operation:'preferences'}) || {};} catch (_) {preferences={};}
    sessionLanguage=undefined;engine.resetSubmissionSession();const c=capture();started=true;state({state:'processing'});const result=await request({operation:'start',...c});return result?.ok === true;}
  start.addEventListener('click',inspect);
  async function voiceAction(operation) {
    if (operation === 'start' && busy) {const error=new Error('Form busy');error.code='BUSY';throw error;}
    if (operation === 'start' && !await inspect()) throw new Error('Inspection failed');
    if (operation === 'start' && busy) throw new Error('Please wait');
    const result=await browser.runtime.sendMessage({channel:'seeforme-voice',operation,...(operation === 'start' && sessionLanguage ? {conversationLanguage:sessionLanguage} : {})});
    if (result?.ok !== true) throw new Error('Voice command failed');
    present('setVoicePending',null);
  }
  present('setVoiceControlAvailable',true);
  send.addEventListener('click',async () => {if (busy || !started || !input.value.trim()) return;const text=input.value.trim();state({state:'processing'});const result=await request({operation:'utterance',text});if (result?.ok) input.value='';});
  reset.addEventListener('click',async () => {await request({operation:'reset'});engine.resetSubmissionSession();started=false;busy=false;engine.highlight([]);send.disabled=true;start.disabled=false;input.value='';question.textContent='';fallback.textContent='';status.textContent='Session cleared. Existing field values are preserved.';present('resetVisual');});
  browser.runtime.onMessage.addListener((msg,sender) => {
    if (sender.id === browser.runtime.id && msg?.channel === 'seeforme-voice' && msg.operation === 'toolbar-start') {
      return voiceAction('start').catch(() => present('voiceControlFailed'));
    }
    if (sender.id !== browser.runtime.id || msg?.channel !== 'seeforme' || msg.documentId !== documentId) return;
    if (msg.operation === 'voice-state' || msg.operation === 'voice-idle') {
      if (typeof msg.voiceRouteId !== 'string' || !Number.isSafeInteger(msg.voiceRevision) || msg.voiceRevision < 0 || retiredVoiceRoutes.has(msg.voiceRouteId)) return;
      if (msg.voiceRouteId !== voiceRouteId) {
        if (voiceRouteId) retiredVoiceRoutes.add(voiceRouteId);
        voiceRouteId=msg.voiceRouteId;voiceRevision=-1;present('clearVoiceState',true);
      }
      if (msg.voiceRevision <= voiceRevision) return;
      voiceRevision=msg.voiceRevision;
      if (msg.operation === 'voice-idle') {present('clearVoiceState',true);return;}
      const remaining=msg.voiceExpiresAt-Date.now();
      if (!Number.isSafeInteger(remaining) || remaining <= 0) {present('clearVoiceState');return;}
      present('setVoiceState',{...msg.voice,ttlMs:Math.min(remaining,msg.voice?.ttlMs)});
      return;
    }
    if (msg.operation === 'capture') return Promise.resolve(capture());
    if (msg.operation === 'status') {capture();const result=engine.protocolStatus();present('updateStatus',result);return Promise.resolve(result);}
    if (msg.operation === 'submit') return Promise.resolve(engine.submitProtocol(msg.context,msg.authorizationId));
    if (msg.operation === 'fill') {
      const result=engine.fillProtocol(msg.context,msg.actions);
      result.then(value => present('showFillResult',value),() => {});
      return result;
    }
    if (msg.operation === 'state') state(msg);
  });
  // Polling catches pushState/replaceState without patching page-world history APIs.
  let timer=setInterval(() => {if (location.href !== lastUrl) {lastUrl=location.href;void request({operation:'reset'});present('clearVoiceState',true);engine.dispose();engine=SeeForMeDOM.createEngine(document,window);started=false;busy=false;documentId=undefined;state({state:'ended',message:'Page changed. Inspect the new form to continue.'});}},500);
  window.addEventListener('pagehide',() => {present('clearVoiceState',true);clearInterval(timer);engine.dispose();started=false;documentId=undefined;});
  window.addEventListener('pageshow',event => {
    if (!event.persisted) return;
    engine=SeeForMeDOM.createEngine(document,window);lastUrl=location.href;
    state({state:'ended',message:'Page restored. Inspect the form to continue.'});
    timer=setInterval(() => {if (location.href !== lastUrl) {lastUrl=location.href;void request({operation:'reset'});present('clearVoiceState',true);engine.dispose();engine=SeeForMeDOM.createEngine(document,window);started=false;documentId=undefined;state({state:'ended',message:'Page changed. Inspect the new form to continue.'});}},500);
  });
})();
