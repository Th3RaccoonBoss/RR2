from html_links_prototype import extract_links
tests=[
('<a href="https://example.test/?a=1&amp;b=2">x</a>',['https://example.test/?a=1&b=2']),
('<A HREF=https://example.test/>x</A>',['https://example.test/']),
('<!-- <a href="https://attacker.test"> -->',[]),
('<script>const x = "<a href=bad>";</script>',[]),
('<style>/* <a href=bad> */</style>',[]),
('<template><a href=bad>x</a></template><a href=good>x</a>',['good']),
('<noscript><a href=bad>x</a></noscript>',[]),
('<base href="https://attacker.test"><a href="/relative">x</a>',['/relative']),
('<a href="https&#58;//example.test/?a=1&#38;b=2">x</a>',['https://example.test/?a=1&b=2']),
('<a title="href=bad" href=good>x</a>',['good'])]
for html,expected in tests: assert extract_links(html)==expected
for html in ['<a href=good href=bad>x</a>',None,'x'*262145]:
 try: extract_links(html)
 except ValueError: pass
 else: raise AssertionError('Expected rejection')
print('13 parser checks passed')
