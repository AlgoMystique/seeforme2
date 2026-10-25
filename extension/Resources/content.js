// BEGIN GENERATED SEEFORME UI
/* SeeForMe visual component. No browser messaging, field inspection or filling.
   Embedded into content.js by extension/ui/build.py; no manifest change required. */
(function (root) {
  'use strict';
  const CSS = `
    :host { all:initial; color-scheme:light; }
    *, *::before, *::after { box-sizing:border-box; }
    [hidden] { display:none !important; }
    .assistant { --paper:#fff; --ink:#14171f; --muted:#626775; --teal:#19675e; --line:#e7e7ed; --lavender:#d8b4f8;
      display:flex; flex-direction:column; gap:8px; width:min(500px,calc(100vw - 28px)); max-height:calc(100dvh - 28px);
      padding:12px 10px 14px; overflow:auto; overflow-x:hidden; overscroll-behavior:contain; background:linear-gradient(145deg,#fff,#fefeff);
      border:1px solid #dedee5; border-radius:22px; box-shadow:0 12px 45px #25213320,0 2px 10px #25213308;
      color:var(--ink); font:14px/1.45 -apple-system,BlinkMacSystemFont,'Helvetica Neue',sans-serif; letter-spacing:-.02em; text-align:left;
      -webkit-font-smoothing:antialiased; isolation:isolate; }
    button,textarea,select,summary { font:inherit; }
    button { cursor:pointer; border:0; color:inherit; transition:background 130ms ease; }
    button:disabled { opacity:.45; cursor:default; }
    button:focus-visible,summary:focus-visible,textarea:focus-visible,select:focus-visible { outline:3px solid #7460d8; outline-offset:3px; }
    button:not(:disabled):active { transform:translateY(1px); }
    p,h2 { margin:0; } svg { display:block; flex-shrink:0; }
    .window-chrome { display:flex; align-items:center; justify-content:space-between; min-height:16px; padding:0 4px; }
    .exit-button { background:#ff6059 !important; color:#641911 !important; border-radius:50% !important; }
    .exit-button:hover { background:#ff817b !important; }
    .tools { display:flex; gap:3px; } .icon-button { width:22px; height:22px; display:grid; place-items:center; padding:0; background:transparent; border-radius:6px; color:#5b6170; }
    .icon-button:hover { background:#eeeaf8; }
    .header { position:relative; display:grid; grid-template-columns:96px minmax(0,1fr); grid-template-rows:96px 34px; align-items:center; gap:1px 8px; padding:0 10px 2px; flex-shrink:0; }
    .avatar { grid-column:1; grid-row:1; width:88px; height:88px; position:relative; align-self:end; } .avatar svg { width:100%; height:100%; overflow:visible; }
    .eye { transform-box:fill-box; transform-origin:center; }
    .closed-eye,.smile,.mouth-speaking,.thinking-dot,.rays,.voice-lines { opacity:0; }
    .mouth-idle { opacity:1; } [data-avatar="listening"] .rays { opacity:1; }
    [data-avatar="speaking"] .mouth-idle { opacity:0; } [data-avatar="speaking"] .mouth-speaking { opacity:1; }
    [data-avatar="completed"] .closed-eye,[data-avatar="completed"] .smile { opacity:1; }
    [data-avatar="completed"] .eye,[data-avatar="completed"] .mouth-idle { opacity:0; }
    .identity { display:flex; align-items:center; gap:15px; grid-column:1 / -1; grid-row:2; min-width:0; padding-right:166px; }
    h2 { font-size:21px; line-height:1.1; font-weight:720; letter-spacing:-.055em; white-space:nowrap; }
    .state-label { display:flex; align-items:center; gap:7px; color:#565d6c; font-size:13px; white-space:nowrap; }
    .state-dot { width:9px; height:9px; background:#b5bbc6; border-radius:50%; flex-shrink:0; }
    [data-voice="listening"] .state-dot,[data-voice="speaking"] .state-dot { background:#00c894; }
    [data-voice="thinking"] .state-dot,[data-voice="transcribing"] .state-dot { background:#aa83df; }
    [data-voice="error"] .state-dot { background:#c05d45; }
    .collapsed-progress { display:none; }
    .cloud { grid-column:2; grid-row:1; --cloud-fill:#e2f5eb; --cloud-glow:#36d5a780; position:relative; align-self:center; min-width:0; width:min(245px,100%); height:110px; margin-top:-10px; filter:drop-shadow(0 0 6px var(--cloud-glow)) drop-shadow(0 0 18px var(--cloud-glow)); }
    .cloud-silhouette { position:absolute; inset:0; width:100%; height:100%; overflow:visible; }
    .cloud-outline { fill:var(--cloud-fill); stroke:#a8dfc7; stroke-width:2; transition:fill 180ms ease; }
    .cloud-content { position:absolute; inset:14% 9% 15% 16%; display:flex; align-items:center; justify-content:center; gap:12px; color:#115653; }
    .cloud-label { font-size:18px; font-weight:650; letter-spacing:-.04em; overflow-wrap:anywhere; line-height:1.2; }
    .cloud-bars { display:flex; align-items:center; justify-content:center; gap:3px; height:33px; flex-shrink:0; }
    .cloud-bars span { width:4px; height:4px; border-radius:4px; background:#009b7b; transition:height 85ms linear; }
    .cloud-dots { display:none; align-items:center; gap:4px; }
    .cloud-dots span { width:5px; height:5px; border-radius:50%; background:#8b65bc; }
    [data-voice="listening"] .cloud { grid-column:2; grid-row:1; --cloud-fill:#eafaf3; --cloud-glow:#13db9b99; }
    [data-voice="speaking"] .cloud { grid-column:2; grid-row:1; --cloud-fill:#fff0e5; --cloud-glow:#f6b38b99; animation:cloud-speaking 1.25s ease-in-out infinite; transform-origin:center; }
    [data-voice="speaking"] .cloud-bars span { background:#b77450; }
    [data-voice="thinking"] .cloud,[data-voice="transcribing"] .cloud { grid-column:2; grid-row:1; --cloud-fill:#f1eafd; --cloud-glow:#ba95ed66; }
    [data-voice="thinking"] .cloud-content,[data-voice="transcribing"] .cloud-content { color:#694d8b; }
    [data-voice="thinking"] .cloud-bars,[data-voice="transcribing"] .cloud-bars,[data-voice="idle"] .cloud-bars,[data-voice="error"] .cloud-bars { display:none; }
    [data-voice="thinking"] .cloud-dots,[data-voice="transcribing"] .cloud-dots { display:flex; }
    [data-voice="thinking"] .cloud-dots span,[data-voice="transcribing"] .cloud-dots span { animation:thinking-dot 1.2s ease-in-out infinite; }
    .cloud-dots span:nth-child(2) { animation-delay:.16s; } .cloud-dots span:nth-child(3) { animation-delay:.32s; }
    @keyframes cloud-speaking { 0%,100% { transform:scale(1); filter:drop-shadow(0 0 6px var(--cloud-glow)) drop-shadow(0 0 14px var(--cloud-glow)); } 50% { transform:scale(1.025); filter:drop-shadow(0 0 10px var(--cloud-glow)) drop-shadow(0 0 24px var(--cloud-glow)); } }
    @keyframes thinking-dot { 0%,75%,100% { opacity:.35; transform:translateY(0); } 35% { opacity:1; transform:translateY(-3px); } }
    .context-entry { position:absolute; right:2px; bottom:0; }
    .context-entry-button { display:flex; align-items:center; justify-content:center; gap:8px; padding:11px 16px; border-radius:999px; background:linear-gradient(115deg,#e3e3ff,#e5dfff); color:#171436; font-size:14px; font-weight:550; white-space:nowrap; }
    .context-entry-button svg { width:21px; height:21px; color:#5f6cff; }
    .context-entry-button:hover { background:#d8cff9; }
    .body { display:flex; flex-direction:column; min-height:170px; max-height:min(46dvh,310px); padding:21px 24px 16px; background:linear-gradient(125deg,#1b1c1f,#222325); color:#f8f8fb; border:1px solid #17181b; border-radius:26px; flex:1 1 auto; overflow:hidden; }
    .conversation { min-height:0; overflow:auto; overflow-x:hidden; flex:1 1 auto; padding-right:2px; scrollbar-width:thin; scrollbar-color:#55545f transparent; }
    .message { display:grid; grid-template-columns:35px minmax(0,1fr); gap:14px; padding:0 0 18px; position:relative; }
    .message:not(:last-child)::after { content:''; position:absolute; width:1px; background:#3b3c43; left:17px; top:42px; bottom:6px; }
    .message-icon { width:35px; height:35px; border-radius:13px; flex-shrink:0; }
    .message-icon svg { width:100%; height:100%; }
    .message-content { min-width:0; overflow-wrap:anywhere; }
    .question { font-size:16px; font-weight:550; line-height:1.4; white-space:pre-wrap; }
    .status { color:#bfc0c8; font-size:14px; line-height:1.55; margin-top:8px; white-space:pre-wrap; overflow-wrap:anywhere; }
    .message[data-pending="true"] .question { display:none; }
    .history-text { white-space:pre-wrap; font-size:15px; line-height:1.5; overflow-wrap:anywhere; }
    .history-detail { color:#bfc0c8; font-size:14px; line-height:1.55; margin-top:8px; white-space:pre-wrap; }
    .user-message .message-content { justify-self:start; background:linear-gradient(130deg,#30313a,#32343b); border-radius:18px; padding:10px 14px; color:#fff; }
    .progress-section { flex-shrink:0; margin:10px 0 0; padding-top:3px; }
    .progress-copy { display:flex; justify-content:space-between; gap:8px; color:#b9bac3; font-size:13px; margin-bottom:6px; }
    .progress-copy strong { font-weight:450; } .track { height:8px; background:#494b55; border-radius:9px; overflow:hidden; }
    .bar { height:100%; width:0%; background:linear-gradient(90deg,#d7b3f3,#cfa4f3); border-radius:inherit; transition:width 200ms ease; }
    .fill-note { font-size:11px; color:#d5c0ef; margin-top:4px; } .fill-note:empty { display:none; }
    .eyebrow { display:none; }
    .audio-panel { display:flex; align-items:center; gap:12px; flex-shrink:0; min-height:80px; padding:11px 14px; border-radius:25px; background:linear-gradient(125deg,#1c1d20,#242528); color:#fbfbff; }
    .audio-info { display:flex; align-items:center; gap:14px; flex:1; min-width:0; }
    .audio-mark { display:flex; align-items:center; justify-content:center; gap:3px; width:45px; height:36px; flex-shrink:0; }
    .audio-mark span { width:4px; height:10px; background:#d2a6f2; border-radius:5px; transition:height 85ms linear; }
    .audio-mark span:nth-child(2),.audio-mark span:nth-child(4) { height:22px; } .audio-mark span:nth-child(3) { height:32px; }
    .audio-title { font-size:16px; font-weight:550; } .audio-subtitle { font-size:12px; color:#bbbcc5; margin-top:2px; }
    .microphone { display:flex; align-items:center; justify-content:center; gap:12px; min-width:126px; min-height:56px; padding:10px 20px; border-radius:999px; background:linear-gradient(115deg,#dfbcfa,#cca2f2); color:#17111f; flex-shrink:0; }
    .microphone svg { width:28px; height:28px; } .microphone span { font-size:17px; font-weight:550; }
    .microphone:hover:not(:disabled) { background:#e3c7fd; }
    .call-bar { display:flex; align-items:center; gap:6px; flex-shrink:0; }
    .call-control { display:grid; place-items:center; width:32px; height:32px; padding:7px; border-radius:50%; background:#48494f; color:#fff; }
    .call-control svg { width:18px; height:18px; } .hangup { background:#da3041; } .waveform { display:none; }
    .voice-hint { font-size:12px; margin:6px 0; color:var(--muted); overflow-wrap:anywhere; }
    .voice-hint[data-error="true"] { color:#994331; }
    .bottom-controls { display:grid; grid-template-columns:minmax(0,1fr) minmax(0,1fr); gap:8px; padding:2px 12px 0; flex-shrink:0; }
    details { min-width:0; }
    summary { cursor:pointer; border-radius:5px; color:#555c6b; font-size:14px; list-style:none; }
    summary::-webkit-details-marker { display:none; }
    .typing > summary,.settings-drawer > summary { display:flex; align-items:center; gap:9px; min-height:30px; width:fit-content; }
    .typing > summary svg,.settings-drawer > summary svg { width:22px; height:22px; }
    .settings-drawer { justify-self:end; }
    .typing[open],.settings-drawer[open] { grid-column:1 / -1; width:100%; }
    .settings-drawer > summary { margin-left:auto; }
    .footer { padding:10px 0 0; font-size:12px; color:var(--muted); }
    .footer-row { display:flex; justify-content:space-between; gap:10px; align-items:start; }
    .conversation-settings { margin-top:12px; padding-top:10px; border-top:1px solid var(--line); }
    .conversation-settings summary { font-size:13px; font-weight:600; } .conversation-settings label { display:block; margin-top:10px; }
    .conversation-settings select { display:block; width:100%; padding:8px; border:1px solid #ddd8e7; border-radius:9px; background:#faf8fd; color:var(--ink); }
    .privacy,.fallback { display:block; margin-top:8px; font-size:11px; line-height:1.6; } .fallback:empty { display:none; }
    .text-button { background:transparent; color:#65547a; font-size:12px; border-radius:6px; padding:5px 0; text-decoration:underline; text-underline-offset:3px; }
    .context-entry-button { background:linear-gradient(115deg,#e3e3ff,#e5dfff); padding:11px 16px; text-decoration:none; font-size:14px; color:#171436; }
    .conversation-settings .text-button { margin-right:13px; }
    .primary { min-height:38px; width:100%; border-radius:11px; padding:9px; background:#e8def7; color:#473556; font-size:13px; }
    .start { margin:10px 0; }
    .composer { margin:10px 0 0; } .input-label { display:block; margin-bottom:5px; font-size:12px; color:var(--muted); }
    .text-entry { position:relative; } textarea { display:block; width:100%; min-height:68px; max-height:140px; resize:vertical; padding:10px 42px 10px 12px; border:1px solid #dad5e3; border-radius:12px; background:#faf8fd; color:var(--ink); font-size:14px; }
    .send { display:grid; place-items:center; position:absolute; right:7px; bottom:7px; width:29px; height:29px; border-radius:9px; background:#79629b; color:#fff; }
    .keyboard-hint { color:var(--muted); font-size:10px; margin:5px 0; }
    .review { background:#34303e; padding:10px; border-radius:10px; margin:8px 0; font-size:12px; color:#e8dcfa; } .review strong { display:block; }
    .review-actions { display:flex; gap:8px; margin-top:6px; } .review-actions .text-button { color:#e4d0fc; }
    [data-collapsed="true"] { display:grid; grid-template-columns:54px minmax(0,1fr); width:min(390px,calc(100vw - 28px)); padding:8px 10px; gap:5px 10px; }
    [data-collapsed="true"] .window-chrome { grid-column:1 / -1; }
    [data-collapsed="true"] .header { display:flex; grid-column:1; padding:0; min-height:54px; }
    [data-collapsed="true"] .avatar { width:54px; height:54px; }
    [data-collapsed="true"] .audio-panel { grid-column:2; min-width:0; min-height:62px; padding:8px; border-radius:22px; justify-content:center; gap:6px; }
    [data-collapsed="true"] .microphone { min-width:82px; padding:8px 12px; min-height:44px; }
    [data-collapsed="true"] .microphone span { font-size:15px; }
    [data-collapsed="true"] .identity,[data-collapsed="true"] .cloud,[data-collapsed="true"] .context-entry,[data-collapsed="true"] .body,[data-collapsed="true"] .bottom-controls,[data-collapsed="true"] .audio-info { display:none; }
    @media (max-width:480px) { .assistant { padding:10px 8px; } .header { grid-template-columns:74px minmax(0,1fr); grid-template-rows:86px 36px; padding:0 4px; gap:2px 4px; } .avatar { width:72px; height:72px; } .cloud { height:100px; } .cloud-label { font-size:16px; } .cloud-content { gap:7px; } .identity { gap:9px; padding-right:140px; } h2 { font-size:18px; } .state-label { font-size:11px; gap:5px; } .state-dot { width:7px; height:7px; } .context-entry-button { padding:9px 11px; font-size:12px; gap:5px; } .context-entry-button svg { width:17px; height:17px; } .body { padding:18px 16px 14px; } .message { gap:10px; grid-template-columns:32px minmax(0,1fr); } .message-icon { width:32px; height:32px; } .question { font-size:15px; } .status { font-size:13px; } .audio-panel { padding:10px 12px; gap:8px; } .audio-mark { width:30px; gap:2px; } .audio-info { gap:8px; } .audio-title { font-size:14px; } .audio-subtitle { font-size:11px; } .microphone { min-width:104px; padding:9px 15px; gap:8px; } .microphone span { font-size:16px; } .call-control { width:29px; height:29px; } [data-voice="listening"] .audio-mark,[data-voice="speaking"] .audio-mark,[data-voice="thinking"] .audio-mark,[data-voice="transcribing"] .audio-mark { display:none; } }
    @media (max-width:370px) { .identity { display:block; } .state-label { font-size:10px; } .identity { gap:7px; padding-right:126px; } h2 { font-size:16px; } .context-entry-button { font-size:11px; padding:9px; } .audio-mark { display:none; } .audio-title { font-size:12px; } .audio-subtitle { display:none; } .microphone { min-width:86px; padding:9px 12px; } }
    @media (max-height:650px) { .header { grid-template-rows:76px 30px; } .avatar { width:68px; height:68px; } .cloud { height:90px; } .body { min-height:100px; max-height:40dvh; padding-top:14px; } .audio-panel { min-height:68px; } .microphone { min-height:47px; } }
    @media (prefers-reduced-motion: reduce) { *,*::before,*::after { animation:none !important; transition:none !important; scroll-behavior:auto !important; } }
    @media (forced-colors: active) { .assistant,.body,.audio-panel,textarea { border:1px solid CanvasText; } button { border:1px solid ButtonText; } .bar,.state-dot { background:Highlight; } }
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
    const host=el('div');host.setAttribute('data-seeforme-assistant','');
    host.style.cssText='all:initial;position:fixed;bottom:14px;right:14px;z-index:2147483647;display:block;max-width:calc(100vw - 24px);';
    const shadow=host.attachShadow({mode:'closed'}), style=el('style');style.textContent=CSS;
    const panel=el('section','assistant');panel.setAttribute('role','region');panel.setAttribute('aria-label','SeeForMe website assistant');
    panel.dataset.state='idle';panel.dataset.voice='idle';panel.dataset.avatar='idle';panel.dataset.collapsed='false';
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
    const tools=el('div','tools'), move=button('icon-button move','Move assistant to the left',icon('M4 10h12M7 6l-4 4 4 4m6-8 4 4-4 4')), minimize=button('icon-button','Make smaller',icon('M5 10h10'));
    minimize.setAttribute('aria-expanded','true');tools.append(minimize);header.append(avatar,identity);
    const chrome=el('div','window-chrome'), exitButton=button('icon-button exit-button','Exit SeeForMe',icon('M6 6l8 8M14 6l-8 8'));
    exitButton.title='Exit SeeForMe';chrome.append(exitButton,tools);
    const cloud=el('div','cloud'), cloudShape=svgNode('svg',{class:'cloud-silhouette',viewBox:'0 0 400 210',preserveAspectRatio:'none','aria-hidden':'true'});
    cloudShape.append(svgNode('path',{class:'cloud-outline',d:'M47 117C43 88 65 65 94 62C110 18 151 10 185 31C222-7 285 3 307 45C368 24 408 64 394 116C387 153 355 174 322 171C300 207 252 206 225 186C192 215 140 209 117 184C77 195 47 177 43 151C25 151 9 148 3 145Z'}));
    const cloudContent=el('div','cloud-content'), cloudBars=el('div','cloud-bars'), cloudLabel=el('span','cloud-label','Ready to help'), cloudDots=el('div','cloud-dots');
    cloudLabel.setAttribute('role','status');cloudLabel.setAttribute('aria-live','polite');cloudLabel.setAttribute('aria-atomic','true');
    cloudBars.setAttribute('aria-hidden','true');cloudDots.setAttribute('aria-hidden','true');
    const cloudBarNodes=Array.from({length:5},()=>el('span'));cloudBars.append(...cloudBarNodes);cloudDots.append(el('span'),el('span'),el('span'));
    cloudContent.append(cloudBars,cloudDots,cloudLabel);cloud.append(cloudShape,cloudContent);header.append(cloud);
    const body=el('div','body'), eyebrow=el('p','eyebrow','YOUR BROWSER COMPANION'), question=el('p','question','A little help, in your words.'), status=el('p','status','Tap Talk to begin. Review every answer before submitting.');
    body.id='sfm-body';minimize.setAttribute('aria-controls',body.id);stateText.setAttribute('aria-live','off');
    question.setAttribute('aria-live','polite');question.setAttribute('aria-atomic','true');status.setAttribute('role','status');status.setAttribute('aria-live','polite');
    const progressSection=el('div','progress-section'), progressCopy=el('div','progress-copy'), progressText=el('strong','', 'Form progress'), progressCount=el('span','', '0 / 0'), track=el('div','track'), bar=el('div','bar'), fillNote=el('p','fill-note');
    track.setAttribute('role','progressbar');track.setAttribute('aria-label','Required fields completed');track.setAttribute('aria-valuemin','0');track.setAttribute('aria-valuemax','100');track.setAttribute('aria-valuenow','0');fillNote.setAttribute('role','status');fillNote.setAttribute('aria-live','polite');
    progressCopy.append(progressText,progressCount);track.append(bar);progressSection.append(progressCopy,track);progressSection.hidden=true;
    const start=button('primary start','Help me fill this form'), composer=el('div','composer'), inputLabel=el('label','input-label','Or type your answer'), input=el('textarea'), send=button('send','Send answer',icon('M10 15V5m-4 4 4-4 4 4'));
    input.id='sfm-answer';input.rows=2;input.maxLength=1000;input.placeholder='Type your answer…';input.setAttribute('aria-label','Your answer');inputLabel.htmlFor=input.id;send.disabled=true;
    const voiceButton=button('microphone','Start voice'), voiceGlyph=icon('M7 4a3 3 0 0 1 6 0v6a3 3 0 0 1-6 0V4m-3 5v1a6 6 0 0 0 12 0V9m-6 7v3m-3 0h6'), voiceButtonLabel=el('span','', 'Talk');
    voiceButton.replaceChildren(voiceGlyph,voiceButtonLabel);voiceButton.setAttribute('aria-pressed','false');voiceButton.disabled=true;
    const answerRow=el('div','answer-row'), textEntry=el('div','text-entry');textEntry.append(input,send);answerRow.append(textEntry);
    composer.append(inputLabel,answerRow);composer.hidden=false;
    const keyboardHint=el('p','keyboard-hint','⌘ / Ctrl + Enter to send'), voiceHint=el('p','voice-hint','Voice is powered by the SeeForMe Mac app.');keyboardHint.hidden=false;voiceHint.setAttribute('role','status');voiceHint.setAttribute('aria-live','polite');voiceHint.id='sfm-voice-status';voiceButton.setAttribute('aria-describedby',voiceHint.id);
    const review=el('div','review'), reviewHeading=el('strong','', 'A final look, then you’re done.'), reviewCopy=el('span','', 'Check your answers on the page. Submit when you’re happy with them.');review.append(reviewHeading,reviewCopy);review.hidden=true;
    const reviewActions=el('div','review-actions'), reviewButton=button('primary','Review form'), correct=button('text-button','Make a correction');reviewActions.append(reviewButton,correct);reviewActions.hidden=true;
    const typing=el('details','typing'), typingLabel=el('summary','','Type instead');
    typing.append(typingLabel,start,composer,keyboardHint);
        function messageIcon(user=false) {
      const node=el('div','message-icon'), svg=svgNode('svg',{viewBox:'0 0 50 50',fill:'none','aria-hidden':'true'});
      svg.append(svgNode('rect',{x:1,y:1,width:48,height:48,rx:17,fill:user ? '#cda5f2' : '#dcf8eb',stroke:user ? '#e2c4ff' : '#edfff8'}));
      if (user) svg.append(svgNode('circle',{cx:25,cy:19,r:7,fill:'#7b4fbc'}),svgNode('path',{d:'M12 40c0-13 26-13 26 0',fill:'#7b4fbc'}));
      else svg.append(svgNode('path',{d:'M7 13q2-7 10-7',stroke:'#fff','stroke-width':3,'stroke-linecap':'round'}),svgNode('ellipse',{cx:17,cy:23,rx:2.6,ry:4,fill:'#176257'}),svgNode('ellipse',{cx:32,cy:23,rx:2.6,ry:4,fill:'#176257'}),svgNode('path',{d:'M22 32q3 4 6 0',stroke:'#176257','stroke-width':2.5,'stroke-linecap':'round'}));
      node.append(svg);return node;
    }
    const conversation=el('div','conversation'), currentMessage=el('div','message'), currentContent=el('div','message-content');
    conversation.setAttribute('role','log');conversation.setAttribute('aria-label','Conversation');conversation.setAttribute('aria-live','off');
    currentContent.append(question,status);currentMessage.hidden=true;currentMessage.append(messageIcon(),currentContent);conversation.append(currentMessage);
    body.append(conversation,progressSection);
    review.hidden=true;reviewActions.hidden=true;

    const footer=el('div','footer'), footerRow=el('div','footer-row'), details=el('details'), summary=el('summary','', 'Privacy & voice'), privacy=el('small','privacy','Visible page text is interpreted on-device. ElevenLabs processes your voice audio and spoken replies. Review answers before submitting.'), fallback=el('small','fallback'), reset=button('text-button','Start over');reset.hidden=true;
    details.append(summary,privacy,fallback);footerRow.append(details,reset);footer.append(voiceHint,footerRow,fillNote);
    const settings=el('details','conversation-settings'), settingsTitle=el('summary','','Language & voice');
    const languageLabel=el('label','','Conversation language'), languageSelect=el('select'), voiceLabel=el('label','','Voice'), voiceSelect=el('select'), saveSettings=button('text-button','Save language and voice'), settingsNote=el('p','voice-hint');
    languageSelect.id='sfm-language';languageLabel.setAttribute('for',languageSelect.id);
    voiceSelect.id='sfm-voice';voiceLabel.setAttribute('for',voiceSelect.id);
    settingsNote.setAttribute('role','status');saveSettings.textContent='Save preferences';
    settings.append(settingsTitle,languageLabel,languageSelect,voiceLabel,voiceSelect,saveSettings,settingsNote);footer.append(settings);
    const contextSettings=el('details','conversation-settings'), contextTitle=el('summary','','Local context');
    const contextOn=button('text-button','Turn SeeForMe ON'), connectContext=button('text-button','Connect Folder'), refreshContext=button('text-button','Refresh Context'), changeContext=button('text-button','Change Folder'), disconnectContext=button('text-button','Disconnect');
    const contextNote=el('p','voice-hint','Connect a local folder to use your documents in forms.'), contextPrivacy=el('small','privacy','PDF, TXT, Markdown and DOCX. Originals stay in place. A private local text cache lasts until OFF or Disconnect. Spoken context replies go to ElevenLabs only with permission. Original files are never uploaded. Values filled into a website are visible to that website.');
    contextNote.setAttribute('role','status');
    const contextEntry=el('div','context-entry'), contextEntryButton=button('text-button context-entry-button','Connect Context');
    contextEntryButton.replaceChildren(icon('M10 2 2 6l8 4 8-4-8-4M2 10l8 4 8-4M2 14l8 4 8-4'),el('span','','Connect Context'));
    contextEntry.append(contextEntryButton);
    let contextConnected=false, remoteSpeech=false;
    const speechConsent=button('text-button','Allow spoken context replies via ElevenLabs');
    speechConsent.addEventListener('click',() => contextAction(remoteSpeech ? 'private-speech' : 'allow-speech'));
    contextSettings.append(speechConsent);
    const contextButtons=[contextEntryButton,contextOn,connectContext,refreshContext,changeContext,disconnectContext];
    contextSettings.append(contextTitle,contextOn,connectContext,refreshContext,changeContext,disconnectContext,contextNote,contextPrivacy);footer.append(contextSettings);
    let contextActive=false, contextLoading=false, contextError='';
    function renderContext(result) {
      const value=result?.state;
      if (value) {
        contextActive=value.active === true;contextConnected=value.connected === true;
        if (result.ok && value.connected) contextLoading=false;remoteSpeech=value.allowRemoteSpeech === true;
        speechConsent.textContent=remoteSpeech ? 'Stop sending context replies to ElevenLabs' : 'Allow spoken context replies via ElevenLabs';
        contextEntryButton.title='Choose your context folder';
        contextEntryButton.setAttribute('aria-label','Connect Context');
        contextOn.textContent=contextActive ? 'Turn SeeForMe OFF' : 'Turn SeeForMe ON';contextOn.setAttribute('aria-label',contextOn.textContent);
        connectContext.hidden=value.connected === true;changeContext.hidden=disconnectContext.hidden=value.connected !== true;
        refreshContext.hidden=value.connected !== true;refreshContext.disabled=!contextActive;
        contextNote.textContent=(contextActive ? 'ON. ' : 'OFF. ')+(value.connected ? value.folderName+': '+value.documentCount+' documents cached. ' : 'No folder connected. ')+(value.skipped ? value.skipped+' files skipped. ' : '')+(value.truncated ? 'Context limit reached. ' : '')+(value.connected && !value.permissionPersistent ? 'Reconnect after the native host restarts to reread originals. Cached context remains available while ON. ' : '')+(value.error || '');
      }
      if (result?.ok === false) {contextError='Context connection failed. Try again.';contextNote.textContent=result.error || contextError;}
      renderAvatar();
    }
    async function contextAction(operation) {
      if (!options.onContext) return;
      contextError='';contextLoading=['connect','change','refresh','activate'].includes(operation);renderAvatar();
      contextButtons.forEach(item => {item.disabled=true;});
      contextNote.textContent=['connect','change'].includes(operation) ? 'Choose a folder in the Mac folder picker…' : 'Updating local context…';
      try {renderContext(await options.onContext(operation));}
      catch (error) {contextError=String(error?.message || 'Could not start voice. Tap Talk to retry.').slice(0,200);contextNote.textContent=contextError;}
      finally {contextLoading=false;renderAvatar();contextButtons.forEach(item => {item.disabled=false;});refreshContext.disabled=!contextActive;}
    }
    contextSettings.addEventListener('toggle',() => {if (contextSettings.open) void contextAction('status');});
    contextEntryButton.addEventListener('click',() => contextAction('connect'));
    contextOn.addEventListener('click',() => contextAction(contextActive ? 'off' : 'activate'));
    connectContext.addEventListener('click',() => contextAction('connect'));
    refreshContext.addEventListener('click',() => contextAction('refresh'));
    changeContext.addEventListener('click',() => contextAction('change'));
    disconnectContext.addEventListener('click',() => contextAction('disconnect'));
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
    const audioPanel=el('div','audio-panel'), audioInfo=el('div','audio-info'), audioMark=el('div','audio-mark'), audioCopy=el('div','audio-copy'), audioTitle=el('p','audio-title','Voice assistant'), audioSubtitle=el('p','audio-subtitle','Tap to start a conversation');
    audioMark.setAttribute('aria-hidden','true');const audioBars=Array.from({length:5},()=>el('span'));audioMark.append(...audioBars);audioCopy.append(audioTitle,audioSubtitle);audioInfo.append(audioMark,audioCopy);audioPanel.append(audioInfo,voiceButton,callBar);
    const bottomControls=el('div','bottom-controls'), settingsDrawer=el('details','settings-drawer'), settingsSummary=el('summary');
    settingsSummary.append(icon('M8 2h4l1 3 3 1 2 3-2 3-1 3-3 1-2 2-3-2-3-1-1-3L2 9l2-3 3-1 1-3M13 10a3 3 0 1 1-6 0 3 3 0 0 1 6 0'),el('span','','Settings'));
    typingLabel.replaceChildren(icon('M2 5h16v11H2V5M5 8h.1M8 8h.1M11 8h.1M14 8h.1M5 11h.1M8 11h.1M11 11h.1M14 11h.1M6 14h8'),el('span','','Type instead'));
    settingsDrawer.append(settingsSummary,footer);footer.append(move,typing,review,reviewActions);bottomControls.append(settingsDrawer);header.append(contextEntry);
    bottomControls.hidden=true;
    panel.append(chrome,header,body,audioPanel,bottomControls);shadow.append(style,panel);
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
      const label=next ? 'Expand assistant' : 'Make smaller';minimize.setAttribute('aria-label',label);minimize.title=label;
      minimize.replaceChildren(icon(next ? 'M5 10h10M10 5v10' : 'M5 10h10'));
      if (focus) minimize.focus();
    }
    let currentActual=false, historyCount=0, lastAssistantKey='', currentActualText='', currentActualDetail='';
    function historyRow(user,text,detail='') {
      const row=el('div',user ? 'message user-message' : 'message assistant-message'), content=el('div','message-content');
      content.append(el('p','history-text',text));if (detail) content.append(el('p','history-detail',detail));row.append(messageIcon(user),content);
      conversation.append(row,currentMessage);historyCount++;
      while (historyCount>30) {conversation.children[0].remove();historyCount--;}
      conversation.scrollTop=conversation.scrollHeight;
    }
    function archiveAssistant() {
      if (!currentActual) return;
      const key=currentActualText+'\n'+currentActualDetail;
      if (key !== lastAssistantKey) {historyRow(false,currentActualText,currentActualDetail);lastAssistantKey=key;}
      currentActual=false;
    }
    function appendUserMessage(text) {
      if (disposed || typeof text !== 'string' || !text.trim()) return;
      historyRow(true,text.slice(0,1000));currentMessage.hidden=true;
    }
    function appendTranscript(role,text) {
      if (disposed || !['assistant','user'].includes(role) || typeof text !== 'string' || !text.trim()) return;
      historyRow(role === 'user',text.slice(0,4000));currentMessage.hidden=true;
    }
    function renderAvatar() {
      panel.dataset.avatar=voice ? ({idle:'idle',listening:'listening',transcribing:'thinking',thinking:'thinking',speaking:'speaking',error:'idle'}[voice]) : (phase === 'ready_for_review' ? 'completed' : 'idle');
      const labels={idle:'Ready when you are',processing:'Thinking it through',filling:'Filling your form',submitting:'Submitting with your approval',needs_input:'Your turn',ready_for_review:'Ready to review',ended:'Ready for a fresh start',error:'Let’s try that again'};
      const voiceLabels={idle:'Voice off',listening:speechDetected ? 'Hearing you…' : 'Listening…',transcribing:'Transcribing…',thinking:'Thinking…',speaking:'Speaking…',error:'Voice needs attention'};
      stateText.textContent=voice && !['idle','error'].includes(voice) ? 'Voice on' : voice === 'error' ? 'Voice error' : 'Voice off';
      stateText.title=voice ? voiceLabels[voice] : labels[phase] || 'Ready to talk';
      const cloudText=voiceMessage || (voicePending === 'start' ? 'Starting voice...' : contextLoading ? 'Learning context...' : ({listening:"I’m listening...",thinking:'Let me think...',transcribing:'Let me think...',speaking:'Speaking...',error:'Voice needs attention'}[voice]) || 'Tap Talk for form help');
      if (cloudLabel.textContent !== cloudText) cloudLabel.textContent=cloudText;
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
      const defaults={processing:'Finding the right fields for your answer.',filling:'Adding your answers and checking they’re in place.',submitting:'Sending the form with your approval. Follow any steps shown on the page.',needs_input:'Tell me your answer.',ready_for_review:'Your answers are ready for a final check.',ended:'Inspect the form whenever you’re ready.',error:'Your answers are still here. Please try again.'};
      status.textContent=message.message || defaults[phase] || 'Tap Talk to begin. Review every answer before submitting.';
      if (message.question?.text) question.textContent=message.question.text;
      else if (!['processing','filling','submitting'].includes(phase)) question.textContent=phase === 'ready_for_review' ? 'Looks good. Take a final look.' : phase === 'error' ? 'A small pause.' : phase === 'ended' ? 'Ready for the next step.' : 'What would you like to add?';
      highlightedIds=Array.isArray(message.question?.fieldIds) ? message.question.fieldIds.slice() : Array.isArray(message.highlightFieldIds) ? message.highlightFieldIds.slice() : [];
      if (message.question && highlightedIds.length === 0) {flashIds=[];win.clearTimeout(flashTimer);if (options.highlightFields) attempt(() => options.highlightFields([]));}
      if (flashIds.length && options.highlightFields) attempt(() => options.highlightFields([...new Set([...highlightedIds,...flashIds])]));
      if (message.modelAvailable !== undefined) fallback.textContent=message.modelAvailable ? 'Form reasoning runs on your Mac.' : 'Local AI is unavailable. A fallback matcher is helping with your answers.';
      currentMessage.hidden=true;
      renderAvatar();renderVisibility();conversation.scrollTop=conversation.scrollHeight;
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
      conversation.replaceChildren(currentMessage);historyCount=0;currentActual=false;lastAssistantKey='';currentMessage.dataset.pending='false';
      fields.clear();invalid.clear();started=false;win.clearTimeout(voiceTimer);voice='idle';speechDetected=false;voicePending=null;voiceMessage='';correction=false;reviewQuestion=false;phase='idle';panel.dataset.state='idle';
      win.clearTimeout(flashTimer);win.clearTimeout(noteTimer);fillNote.textContent='';highlightedIds=[];flashIds=[];
      question.textContent='A fresh start, at your pace.';renderProgress();renderAvatar();renderVisibility();
    }
    function renderVoiceControl() {
      const active=voice !== null && voice !== 'idle';
      callBar.hidden=!active;voiceButton.hidden=false;
      speaker.disabled=!voiceAvailable || !!voicePending;
      hangup.disabled=!voiceAvailable || !!voicePending;
      speaker.setAttribute('aria-label',muted ? 'Unmute spoken replies' : 'Mute spoken replies');
      speaker.setAttribute('aria-pressed',String(muted));speaker.style.opacity=muted ? '.55' : '1';
      const level=['listening','speaking'].includes(voice) ? audioLevel : 0;
      cloudBarNodes.forEach((bar,i) => {bar.style.height=(4+level*(12+23*(1-Math.abs(i-2)/2)))+'px';});
      audioBars.forEach((bar,i) => {bar.style.height=(active ? 4+level*(12+23*(1-Math.abs(i-2)/2)) : [10,22,32,22,10][i])+'px';});
      audioSubtitle.textContent=active ? ({listening:'Listening to you',thinking:'Working on your answer',transcribing:'Transcribing your speech',speaking:'Speaking to you',error:'Voice needs attention'}[voice] || '') : 'Tap to start a conversation';
      waveBars.forEach((bar,i) => {bar.style.height=(4+level*(12+22*(1-Math.abs(i-6)/6)))+'px';});
      voiceButton.disabled=!voiceAvailable || !!voicePending || (!active && ['processing','filling','submitting'].includes(phase));
      voiceButton.setAttribute('aria-pressed',String(active));
      const label=voicePending === 'start' ? 'Starting voice…' : voicePending === 'stop' ? 'Stopping voice…' : active ? 'Stop voice' : 'Start voice';
      voiceButton.setAttribute('aria-label',label);voiceButton.title=label;voiceButtonLabel.textContent=voicePending ? 'Wait…' : 'Talk';
      voiceHint.dataset.error=String(voice === 'error' || !!voiceMessage);
      if (voiceMessage) voiceHint.textContent=voiceMessage;
      else if (voicePending) voiceHint.textContent=voicePending === 'start' ? 'Starting your conversation…' : 'Ending your conversation…';
      else if (voice === 'error') voiceHint.textContent='Voice encountered a problem. Check microphone access and try Talk again.';
      else if (voice === 'listening') voiceHint.textContent=speechDetected ? 'I can hear you. Finish your answer naturally.' : 'Microphone is live. Tell me your answer.';
      else if (voice === 'transcribing') voiceHint.textContent='Turning your speech into text with ElevenLabs…';
      else if (voice === 'thinking') voiceHint.textContent='Working on your answer or preparing a spoken reply…';
      else if (voice === 'speaking') voiceHint.textContent=voiceAvailable ? 'Speaking. Tap the red button to end the conversation.' : 'The Mac app is speaking. Use its voice control to stop.';
      else voiceHint.textContent=voiceAvailable ? 'Tap Talk to begin your conversation.' : 'Safari voice controls need the native app update. Voice in the Mac app still works.';
    }
    function setVoiceControlAvailable(available,reason='') {voiceAvailable=available === true && typeof options.onVoiceAction === 'function';voiceMessage=reason;renderVoiceControl();}
    function setVoicePending(action) {voicePending=['start','stop'].includes(action) ? action : null;voiceMessage='';renderVoiceControl();}
    function voiceControlFailed(message) {voicePending=null;voiceMessage=String(message || 'Could not reach the Mac app. Please try again.').slice(0,200);renderAvatar();}
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
    exitButton.addEventListener('click',async () => {
      panel.hidden=true;
      exitButton.disabled=true;
      try {
        const result=await (options.onExit ? options.onExit() : options.onContext?.('off'));
        if (!result?.ok) throw Error('EXIT_FAILED');
        panel.hidden=true;
      } catch (_) {voiceControlFailed('Window closed, but stopping SeeForMe could not be confirmed.');}
      finally {exitButton.disabled=false;}
    });
    function show() {panel.hidden=false;}
    minimize.addEventListener('click',() => setCollapsed(!collapsed,true));
    reviewButton.addEventListener('click',() => {setCollapsed(true);if (lastExternal?.isConnected) attempt(() => lastExternal.focus({preventScroll:true}));else minimize.focus();});
    correct.addEventListener('click',() => {correction=true;typing.open=true;renderVisibility();input.focus();});
    input.addEventListener('keydown',event => {if ((event.metaKey || event.ctrlKey) && event.key === 'Enter' && !event.isComposing && !send.disabled) {event.preventDefault();send.click();}});
    panel.addEventListener('keydown',event => {if (event.key === 'Escape' && !collapsed) {event.preventDefault();event.stopPropagation();setCollapsed(true,true);}});
    doc.addEventListener('focusin',onFocus);
    renderAvatar();
    function dispose() {disposed=true;win.clearTimeout(voiceTimer);win.clearTimeout(flashTimer);win.clearTimeout(noteTimer);doc.removeEventListener('focusin',onFocus);host.remove();}
    return {host,panel,title,status,question,input,start,send,reset,privacy,fallback,renderState,updateSnapshot,updateStatus,showFillResult,resetVisual,setVoiceState,clearVoiceState,setVoiceControlAvailable,setVoicePending,voiceControlFailed,voiceButton,show,appendUserMessage,appendTranscript,renderContext,dispose};
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
  let preferences={}, sessionLanguage, dismissed=false, exitTask=null;
  // Visual layer only. Workflow controls retain their existing event handlers below.
  const assistant=SeeForMeAssistant.create(document,window,{highlightFields:ids => engine.highlight(ids),onVoiceAction:voiceAction,onSettings:settingsAction,onContext:contextAction,onExit:exitAssistant});
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
  function exitAssistant() {
    dismissed=true;started=false;busy=false;engine.highlight([]);send.disabled=true;
    present('clearVoiceState',true);
    exitTask=(async () => {
      // Stop audio independently of cache acknowledgement; closing is immediate.
      const results=await Promise.allSettled([
        browser.runtime.sendMessage({channel:'seeforme-voice',operation:'stop'}),
        contextAction('off')
      ]);
      return {ok:results.every(result=>result.status === 'fulfilled' && result.value?.ok === true)};
    })();
    return exitTask;
  }
  async function contextAction(operation) {
    let result=await browser.runtime.sendMessage({channel:'seeforme-context',operation});
    if (operation === 'off' && result?.ok) {
      started=false;busy=false;engine.highlight([]);send.disabled=true;start.disabled=false;
      present('clearVoiceState',true);present('resetVisual');
      status.textContent='SeeForMe is OFF. Existing field values are preserved. Tap Talk to turn it ON.';
    }
    present('renderContext',result);
    if (['connect','change'].includes(operation) && result?.ok && result.state?.connected) {
      result=await browser.runtime.sendMessage({channel:'seeforme-context',operation:'activate'});
      present('renderContext',result);
      if (!dismissed && result?.ok && result.state?.active && !result.state?.error) {
        present('setVoicePending','start');
        try {await voiceAction('start',true);} catch (error) {present('voiceControlFailed',error.message);throw error;}
      }
    }
    return result;
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
  async function voiceAction(operation,contextReady=false) {
    if (operation === 'start' && dismissed) return;
    if (operation === 'start' && busy) {const error=new Error('Form busy');error.code='BUSY';throw error;}
    if (operation === 'start' && !await inspect()) throw new Error('Inspection failed');
    if (operation === 'start' && dismissed) return;
    if (operation === 'start' && busy) throw new Error('Please wait');
    const result=await browser.runtime.sendMessage({channel:'seeforme-voice',operation,...(operation === 'start' && sessionLanguage ? {conversationLanguage:sessionLanguage} : {})});
    if (result?.ok !== true) throw new Error(result?.error || 'Voice command failed');
    present('setVoicePending',null);
  }
  present('setVoiceControlAvailable',true);
  send.addEventListener('click',async () => {if (busy || !started || !input.value.trim()) return;const text=input.value.trim();present('appendUserMessage',text);state({state:'processing'});const result=await request({operation:'utterance',text});if (result?.ok) input.value='';});
  reset.addEventListener('click',async () => {await request({operation:'reset'});engine.resetSubmissionSession();started=false;busy=false;engine.highlight([]);send.disabled=true;start.disabled=false;input.value='';question.textContent='';fallback.textContent='';status.textContent='Session cleared. Existing field values are preserved.';present('resetVisual');});
  browser.runtime.onMessage.addListener((msg,sender) => {
    if (sender.id === browser.runtime.id && msg?.channel === 'seeforme-voice' && msg.operation === 'toolbar-start') {
      return (async () => {
        if (exitTask) await exitTask;
        dismissed=false;present('show');
        await voiceAction('start');
      })().catch(() => present('voiceControlFailed'));
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
    if (msg.operation === 'transcript') {present('appendTranscript',msg.role,msg.text);return;}
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
  // One automatic start per active tab; completion/hang-up never loops into a restart.
  async function automaticStart() {
    if (dismissed || document.visibilityState !== 'visible' || started || busy) return;
    try {
      const context=await contextAction('status');
      if (!context?.state?.connected) return;
      const result=await browser.runtime.sendMessage({channel:'seeforme-voice',operation:'auto-start'});
      if (result?.start && !started && !busy) {present('setVoicePending','start');await voiceAction('start');}
    } catch (_) { present('voiceControlFailed'); }
  }
  window.setTimeout(automaticStart,500);
  document.addEventListener('visibilitychange',automaticStart);
})();
