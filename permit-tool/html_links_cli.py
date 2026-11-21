"""Bounded local parser bridge; input is JSON data, never executable code."""
import sys,json
from html_links_prototype import extract_links
try:
 raw=sys.stdin.read(1048577)
 if len(raw)>1048576:raise ValueError('input limit')
 obj=json.loads(raw)
 if not isinstance(obj,dict) or set(obj)!={'html'}:raise ValueError('shape')
 print(json.dumps(extract_links(obj['html'])))
except Exception:
 print(json.dumps({'error':'unsupported_html'}));sys.exit(1)
