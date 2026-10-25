#!/usr/bin/env python3
"""DOM-only approved-design checks in a dedicated Safari preview window.
Uses already-enabled Apple Events JavaScript. No screenshots, preference changes,
native voice, user pages, context files or external network calls.
"""
import json
from pathlib import Path
import subprocess


def apple(script):
    result = subprocess.run(['osascript', '-e', script], capture_output=True, text=True, timeout=25)
    if result.returncode:
        raise RuntimeError(result.stderr.strip())
    return result.stdout.strip()


url = Path(__file__).with_name('preview.html').resolve().as_uri()
window_id = None


def evaluate(script):
    return json.loads(apple('tell application "Safari" to do JavaScript ' + json.dumps(script, ensure_ascii=False)
                            + ' in current tab of window id ' + str(window_id)))


try:
    window_id = int(apple('''tell application "Safari"
      make new document with properties {URL:''' + json.dumps(url) + '''}
      set previewID to id of front window
      delay 1
      return previewID
    end tell'''))
    checks = []
    for width, height in [(1280, 850), (700, 640), (500, 600)]:
        apple('tell application "Safari"\nset bounds of window id ' + str(window_id)
              + ' to {40, 40, ' + str(40 + width) + ', ' + str(40 + height) + '}\ndelay 0.3\nend tell')
        result = evaluate('''JSON.stringify((()=>{
          ui.resetVisual();ui.panel.querySelectorAll('details').forEach(e=>e.open=false);
          ui.renderState({state:'needs_input',question:{text:'Synthetic multilingual question — お名前 / 姓名 / الاسم',fieldIds:[]},message:'Synthetic renderer fixture. No information is submitted.'},{started:true});
          ui.appendTranscript('assistant','Synthetic spoken reply — Français 日本語');
          ui.appendUserMessage('Synthetic renderer answer — 日本語 中文 العربية Français');
          ui.renderState({state:'needs_input',question:{text:'Synthetic next question?',fieldIds:[]},message:'A long synthetic description '.repeat(20)},{started:true});
          ui.updateSnapshot({fields:Array.from({length:7},(_,i)=>({id:'fixture-'+i,visible:true,disabled:false,required:true,currentValuePresent:i===0}))});
          const q=s=>ui.panel.querySelector(s), r=ui.panel.getBoundingClientRect(), c=q('.cloud').getBoundingClientRect(), a=q('.avatar').getBoundingClientRect();
          const inside=r.left>=0 && r.top>=0 && r.right<=innerWidth+1 && r.bottom<=innerHeight+1;
          return {viewport:innerWidth+'x'+innerHeight,inside,noOverflow:ui.panel.scrollWidth<=ui.panel.clientWidth+1 && q('.conversation').scrollWidth<=q('.conversation').clientWidth+1,
            cloudBesideAvatar:c.left>=a.right-1, contextAboveConversation:q('.context-entry').getBoundingClientRect().bottom<=q('.body').getBoundingClientRect().top,
            progress:q('.track').getAttribute('aria-valuenow')==='14',audioBelowConversation:q('.audio-panel').getBoundingClientRect().top>=q('.body').getBoundingClientRect().bottom,
            surface:getComputedStyle(ui.panel).backgroundImage.includes('gradient'),lavender:getComputedStyle(q('.context-entry-button')).backgroundImage.includes('gradient') || getComputedStyle(q('.context-entry-button')).backgroundColor==='rgb(216, 207, 249)'};
        })())''')
        if not all(value for key, value in result.items() if key != 'viewport'):
            raise RuntimeError('Layout failure: ' + json.dumps(result))
        checks.append(result['viewport'])
    result = evaluate('''JSON.stringify((()=>{
      const q=s=>ui.panel.querySelector(s), instanceId='00000000-0000-4000-8000-000000000099';let seq=0;
      const state=(value,level=.7)=>ui.setVoiceState({v:1,type:'VOICE_STATE',state:value,level,instanceId,seq:++seq,ttlMs:15000});
      ui.renderContext({state:{active:true,connected:true,documentCount:1}});
      ui.clearVoiceState(true);state('listening');const listening=q('.cloud-label').textContent==='I’m listening...' && getComputedStyle(q('.cloud-bars')).display!=='none';
      state('thinking');const thinking=q('.cloud-label').textContent==='Let me think...' && getComputedStyle(q('.cloud-dots')).display==='flex';
      state('speaking');const speaking=q('.cloud-label').textContent==='Speaking...' && getComputedStyle(q('.cloud')).getPropertyValue('--cloud-fill').trim()==='#fff0e5';
      const pulse=getComputedStyle(q('.cloud')).animationName==='cloud-speaking';
      ui.clearVoiceState();const idle=getComputedStyle(q('.cloud-bars')).display==='none' && getComputedStyle(q('.cloud')).animationName==='none';
      q('[aria-label="Make smaller"]').click();
      const compact=getComputedStyle(q('.body')).display==='none' && q('.avatar').getBoundingClientRect().width>0 && q('.audio-panel').getBoundingClientRect().width>0 && ui.panel.scrollWidth<=ui.panel.clientWidth+1;
      q('[aria-label="Expand assistant"]').click();
      const context=q('[aria-label="Connect Context"]').getBoundingClientRect().width>0;
      const noFooter=getComputedStyle(q('.bottom-controls')).display==='none';
      q('[aria-label="Exit SeeForMe"]').click();
      const exitImmediate=getComputedStyle(ui.panel).display==='none';
      ui.show();const reopen=getComputedStyle(ui.panel).display!=='none';
      return {listening,thinking,speaking,pulse,idle,compact,context,noFooter,exitImmediate,reopen};
    })())''')
    if not all(result.values()):
        raise RuntimeError('Presentation event failure: ' + json.dumps(result))
    print('PASS Safari DOM: bounds, multilingual wrapping, cloud placement, progress, audio layout, context and no footer at ' + ', '.join(checks))
    print('PASS Safari cloud presentation for native-shaped fixture events; live microphone/voice timing requires a user check.')
except Exception as error:
    print('Safari approved-design check unavailable/failed: ' + str(error))
    raise SystemExit(2)
finally:
    if window_id:
        # This window was created solely for the synthetic check.
        try:
            apple('tell application "Safari" to close window id ' + str(window_id))
        except Exception:
            pass
