// Local pilot adapter. Connector context must be supplied by trusted caller, not email content.
// Remains review-only; transport/task authority is never inferred from message headers.
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
function parseHtml(content){
 const r=spawnSync('python3',[fileURLToPath(new URL('./html_links_cli.py',import.meta.url))],{input:JSON.stringify({html:content}),encoding:'utf8',timeout:3000,maxBuffer:1048576,shell:false});
 if(r.status!==0)throw new Error('html_parse_failed');
 const links=JSON.parse(r.stdout);if(!Array.isArray(links)||links.some(x=>typeof x!=='string'))throw new Error('html_parse_failed');return links;
}
const ACCOUNT='link_00000000000000000000000000000000';
export function adaptGmailRead(result,context){
 const reject=reason=>({state:'reject',reason});
 if(!context||context.linkId!==ACCOUNT||typeof context.messageId!=='string'||!/^[a-f0-9]+$/.test(context.messageId))return reject('invalid_read_context');
 const m=result?.structuredContent;
 if(!m||typeof m!=='object'||m.id!==context.messageId)return reject('read_identity_mismatch');
 const p=m.payload;
 if(!p||!Array.isArray(p.headers))return reject('missing_headers');
 const header=name=>{const found=p.headers.filter(h=>h&&typeof h.name==='string'&&h.name.toLowerCase()===name);return found.length===1&&typeof found[0].value==='string'?found[0].value:null;};
 const subject=header('subject'),from=header('from');
 if(subject===null||from===null||/[\r\n]/.test(subject+from))return reject('ambiguous_headers');
 if(!['AccuLynx <do-not-reply@mail.acculynx.com>','do-not-reply@mail.acculynx.com'].includes(from))return reject('unrecognized_sender');
 let nodes=0,bytes=0,invalid=false;const hrefs=[];
 function walk(part,depth){
  if(depth>10||++nodes>100||!part||typeof part!=='object'||Array.isArray(part)){invalid=true;return;}
  if(part.filename||part.mime_type==='message/rfc822')return;
  if(part.parts!=null&&!Array.isArray(part.parts)){invalid=true;return;}
  if(part.mime_type==='text/html'||part.mime_type==='text/plain'){
   const body=part.body;
   if(!body||typeof body.content!=='string'||body.attachment_id){invalid=true;return;}
   const content=body.content;bytes+=content.length;
   if(bytes>262144){invalid=true;return;}
   if(part.mime_type==='text/html'){
    try{hrefs.push(...parseHtml(content));}catch{invalid=true;return;}
   }else for(const match of content.matchAll(/https:\/\/[^\s<>"']+/g))hrefs.push(match[0]);
  }
  for(const child of part.parts||[])walk(child,depth+1);
 }
 walk(p,0);
 if(invalid||hrefs.length>200)return reject('unsupported_or_oversized_mime');
 return {id:m.id,linkId:context.linkId,connectorRead:true,subject,from:'do-not-reply@mail.acculynx.com',transportVerified:false,extractedHrefs:hrefs};
}
