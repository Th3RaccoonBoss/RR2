from html.parser import HTMLParser
class LinkExtractor(HTMLParser):
 def __init__(self):
  super().__init__(convert_charrefs=True); self.links=[]; self.blocked=[]
 def handle_starttag(self,tag,attrs):
  if tag in ('script','style','template','noscript','iframe','object'): self.blocked.append(tag); return
  if self.blocked or tag!='a': return
  hrefs=[v for k,v in attrs if k=='href']
  if len(hrefs)!=1 or not isinstance(hrefs[0],str): raise ValueError('Ambiguous anchor')
  self.links.append(hrefs[0])
  if len(self.links)>200: raise ValueError('Too many anchors')
 def handle_endtag(self,tag):
  if self.blocked and tag==self.blocked[-1]: self.blocked.pop()
def extract_links(html):
 if not isinstance(html,str) or len(html)>262144: raise ValueError('Unsupported HTML')
 p=LinkExtractor(); p.feed(html); p.close(); return p.links
