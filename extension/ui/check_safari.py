#!/usr/bin/env python3
"""DOM-only Safari layout smoke test. No screenshots or external pages.
Requires Safari Remote Automation to have already been enabled by the user.
Does not change Safari preferences or install anything.
"""
import json
from pathlib import Path
import socket
import subprocess
import time
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

with socket.socket() as listener:
    listener.bind(('127.0.0.1', 0))
    port = listener.getsockname()[1]
base = 'http://127.0.0.1:' + str(port)
process = subprocess.Popen(['/usr/bin/safaridriver', '-p', str(port)], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
session = None

def call(method, path, data=None):
    body = json.dumps(data).encode() if data is not None else None
    request = Request(base + path, data=body, method=method, headers={'Content-Type': 'application/json'})
    try:
        with urlopen(request, timeout=15) as response:
            return json.load(response)['value']
    except HTTPError as error:
        info = json.load(error).get('value', {})
        raise RuntimeError(info.get('message', 'Safari automation request failed')) from None

try:
    for _ in range(50):
        try:
            call('GET', '/status')
            break
        except URLError:
            time.sleep(.1)
    session = call('POST', '/session', {'capabilities': {'alwaysMatch': {'browserName': 'safari'}}})['sessionId']
    endpoint = '/session/' + session
    preview = Path(__file__).with_name('preview.html').resolve().as_uri()
    call('POST', endpoint + '/url', {'url': preview})
    checks = []
    def evaluate(script):
        return call('POST', endpoint + '/execute/sync', {'script': script, 'args': []})
    for width, height in [(1280, 850), (700, 600), (390, 700)]:
        call('POST', endpoint + '/window/rect', {'width': width, 'height': height})
        result = evaluate('''
          const r=ui.panel.getBoundingClientRect();
          return {width:innerWidth,height:innerHeight,inside:r.left>=0 && r.right<=innerWidth+1 && r.top>=0 && r.bottom<=innerHeight+1,
            overflow:ui.panel.scrollWidth>ui.panel.clientWidth+1};
        ''')
        if not result['inside'] or result['overflow']:
            raise RuntimeError('Assistant overflow at viewport ' + str(result['width']) + 'x' + str(result['height']))
        checks.append('viewport ' + str(result['width']) + 'x' + str(result['height']))
    result = evaluate('''
      preview('thinking');const thinking=ui.panel.dataset.avatar==='thinking';
      preview('completed');const review=!ui.panel.querySelector('.review').hidden;
      ui.input.value='draft';ui.panel.querySelector('[aria-label="Make a correction"]').click();
      const preserved=ui.input.value==='draft' && !ui.panel.querySelector('.composer').hidden;
      ui.panel.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}));
      return {thinking,review,preserved,collapsed:ui.panel.dataset.collapsed==='true'};
    ''')
    if not all(result.values()):
        raise RuntimeError('Safari visual interaction check failed')
    print('PASS Safari DOM layout and interaction checks: ' + ', '.join(checks))
except Exception as error:
    print('Safari check unavailable/failed: ' + str(error))
    raise SystemExit(2)
finally:
    if session:
        try:
            call('DELETE', '/session/' + session)
        except Exception:
            pass
    process.terminate()
    try:
        process.wait(timeout=3)
    except subprocess.TimeoutExpired:
        process.kill()
