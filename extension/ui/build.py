#!/usr/bin/env python3
"""Embed the visual component in the existing content entry point, without
changing manifest load order or the workflow below the generated block.
Use --check to validate the bundle without writing anything.
"""
from pathlib import Path
import sys

root = Path(__file__).resolve().parents[1]
source = root / 'Resources' / 'assistant-ui.js'
target = root / 'Resources' / 'content.js'
begin = '// BEGIN GENERATED SEEFORME UI'
end = '// END GENERATED SEEFORME UI\n'
original = target.read_text()
workflow = original
if original.startswith(begin):
    if end not in original:
        raise SystemExit('Missing UI end marker; refusing to edit content.js.')
    workflow = original.split(end, 1)[1]
expected = begin + '\n' + source.read_text() + end + workflow
if '--check' in sys.argv:
    if original != expected:
        raise SystemExit('UI bundle is stale. Run python3 extension/ui/build.py.')
    print('PASS: visual bundle matches source')
elif original != expected:
    if target.read_text() != original:
        raise SystemExit('content.js changed concurrently; inspect and retry.')
    target.write_text(expected)
    print('Updated visual block; workflow preserved')
