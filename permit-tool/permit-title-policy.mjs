// Bounded request vocabulary. No fuzzy matching or body-based authorization.
const PREFIX=/^\[AccuLynx\] New Task:\s*/i;
const terms=['permit','permits'];
const trades=['','roof','roofing','siding','building'];
const phrases=new Map();
function put(s,trade){phrases.set(s,trade==='roof'||trade==='roofing'?'roof':trade==='siding'?'siding':null);}
for(const p of terms)for(const t of trades){
 const noun=(t?t+' ':'')+p;
 for(const action of ['pull','request','obtain','get','apply for'])for(const article of ['','a ','the ']){
  if(p==='permits'&&article==='a ')continue;
  put(action+' '+article+noun,t);
  if(t)put(action+' '+article+p+' '+t,t);
  if(t&&t!=='building')put(action+' '+article+p+' for '+t,t);
 }
 put(noun+' request',t);put(noun+' needed',t);put('need '+noun,t);put('need a '+noun,t);
 put('request '+noun,t);
 if(t){put(p+' request '+t,t);put(p+' '+t,t);}
}
put('permit request',null);
export function classifyPermitTitle(subject){
 if(typeof subject!=='string'||subject.length>300||/[\r\n\u0000-\u001f]/.test(subject)||!PREFIX.test(subject))return {kind:'ignore'};
 let title=subject.replace(PREFIX,'').trim().toLowerCase();
 const truncated=/(?:\.\.\.|…)\s*$/.test(title);
 if(truncated)title=title.replace(/(?:\.\.\.|…)\s*$/,'').trim();
 title=title.replace(/[–—:-]/g,' ').replace(/\s+/g,' ').trim().replace(/^please /,'').replace(/ please$/,'').replace(/[.!]$/,'').trim();
 // Reject rather than guessing the intended meaning of negations, completion and other work.
 if(/\b(no|not|don't|do not|cancel|cancelled|canceled|complete|completed|obtained|pulled|issued|approved|paid|invoice|fee|fees|inspection|status|renewal)\b/.test(title))return {kind:'ignore'};
 if(!truncated&&phrases.has(title))return {kind:'request',tradeHint:phrases.get(title)};
 // Truncation never grants even a trade hint; route a plausible incomplete request to owner review.
 if(truncated&&/\bpermits?\b/.test(title)&&[...phrases.keys()].some(p=>p.startsWith(title)))return {kind:'title_review',tradeHint:null};
 return {kind:'ignore'};
}
