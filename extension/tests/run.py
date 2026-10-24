#!/usr/bin/env python3
"""Focused dependency-free extension suites; detect asynchronous JSC failures too."""
from pathlib import Path
import re
import subprocess
import sys

root = Path(__file__).resolve().parents[2]
jsc = '/System/Library/Frameworks/JavaScriptCore.framework/Versions/A/Helpers/jsc'
suites = ['dom.test.js', 'protocol.test.js', 'content-ui.test.js', 'submission.test.js', 'session-submission.test.js', 'voice-state.test.js', 'voice-preferences.test.js']
total = 0
for suite in suites:
    result = subprocess.run([jsc, 'extension/tests/' + suite], cwd=root, text=True, capture_output=True, timeout=30)
    output = result.stdout + result.stderr
    print(output.strip())
    if result.returncode or 'FAIL' in output or not re.search(r'PASS \d+', output):
        sys.exit('Failed suite: ' + suite)
    total += sum(map(int, re.findall(r'PASS (\d+)', output)))
print('PASS: ' + str(total) + ' focused assertions across ' + str(len(suites)) + ' suites')
