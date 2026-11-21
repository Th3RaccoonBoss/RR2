"""New recovery UI synchronization. Safe to rerun; no network."""
from pathlib import Path
import re,json
p=Path(__file__).parent
s=(p/'standalone-demo.html').read_text()
engine=(p/'readiness.mjs').read_text().replace('export function assessPermit','function assessPermit')
s=re.sub(r'(<script type="module">).*?(\nconst NOW=)',lambda m:m[1]+engine+m[2],s,count=1,flags=re.S)
s=s.replace('const base={candidate:', 'const base={unresolvedConflict:false,candidate:')
s=s.replace("review:{source:'owner_confirmation',candidateKey:","review:{jurisdictionId:'sample-city',source:'owner_confirmation',candidateKey:")
s=s.replace('City requirement conflict','Detached reroof exception').replace('Clarification needed','Scope review required')
s=re.sub(r" conflict:\{.*?\n ready:"," conflict:{title:'Tinley Park: narrow reroof exception',summary:'Published code exempts single-family detached reroofing. This synthetic example remains blocked until exact-job scope and jurisdiction are reviewed.',input:{...base,review:undefined,job:{...base.job,jurisdictionId:'tinley-park'},rules:[],documents:[]},evidence:['Published §155.05: reroofing for single-family detached structures is exempt from permit. Observed November 12, 2026.','This does not cover siding, attached homes, commercial roofing, structural work or separate right-of-way/dumpster permits.','Evidence only: no active rule and no automated exemption, COI or bond request. Current applicability must be verified for each job.'],link:'https://codelibrary.amlegal.com/codes/tinleypark/latest/tinleypark_il/0-0-0-96799'},\n ready:",s,count=1)
s=s.replace("document.querySelector('#case-status').textContent=s.status;document.querySelector('#case-status').className='tag '+s.tone;", "const ready=result.state==='packet_ready_for_owner_review';document.querySelector('#case-status').textContent=ready?'Synthetic packet ready for review':'Blocked / needs review';document.querySelector('#case-status').className='tag '+(ready?'green':'amber');")
s=s.replace("if(key==='ready')li.className='done';","if(result.state==='packet_ready_for_owner_review')li.className='done';")
record={'id':'tinley-detached-reroof-2026-11-12','city':'Tinley Park','status':'scope-review-required','observedAt':'2026-11-12','sourceKind':'official','verified':False,'sourceUrl':'https://codelibrary.amlegal.com/codes/tinleypark/latest/tinleypark_il/0-0-0-96799','scope':'Single-family detached reroof only','observation':'Published §155.05 exempts reroofing for single-family detached structures. This is evidence, not an activated rule; verify current applicability for each job.','unknowns':['Exact parcel jurisdiction and detached-residential reroof scope','Structural, siding, commercial and attached-home work are outside this exemption','Separate right-of-way, dumpster, registration, COI or bond requirements require review']}
s=re.sub(r' \{"id":"tinley-official-2026-11-12"[^\n]*', lambda m:' '+json.dumps(record),s)
s=s.replace('Synthetic jobs, real workflow.','Synthetic examples only. No operational queue.')
s=s.replace('assessPermit(s.input,NOW)','assessPermit(s.input,Date.now())')
(p/'standalone-demo.html').write_text(s)
