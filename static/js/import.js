// Planner: CSV and .xlsx import.
// Classic script, no modules. Top-level names are shared globals across static/js/*.js;
// load order is set in index.html.

// ====================================================================== import
const IMP={rows:[],head:[],name:''};
const IFIELDS=[
 ['name','Name',true,['summary','task name','name','title','task','issue summary']],
 ['key','Ticket key',false,['issue key','key','ticket','ticket key','issue id','id']],
 ['type','Type (epic/story/task)',false,['issue type','type','level','work type']],
 ['feature','Feature or epic it belongs to',false,['epic link','epic name','parent summary','parent','feature','epic','custom field (epic link)','parent key','parent link']],
 ['objective','Objective',false,['objective','initiative','theme']],
 ['owner','Owner',false,['assignee','assigned to','owner','resource']],
 ['status','Status',false,['status','state']],
 ['startBy','Start by',false,['start date','start','planned start','target start','begin']],
 ['due','Due',false,['due date','due','finish','end date','target end','end']],
 ['startedOn','Started',false,['actual start','started','actual start date']],
 ['doneOn','Done',false,['resolved','resolution date','actual finish','completed','done date','actual end date']],
 ['deps','Depends on (keys or row numbers)',false,['predecessors','depends on','blocked by','inward issue link (blocks)','dependencies','dependency']],
 ['notes','Notes',false,['description','notes','comments','comment']]];
function parseCSV(text){
 text=text.replace(/^﻿/,'');const first=text.split(/\r?\n/)[0]||'';
 const d=(first.split('\t').length>first.split(',').length)?'\t':(first.split(';').length>first.split(',').length)?';':',';
 const rows=[];let row=[],f='',q=false;
 for(let i=0;i<text.length;i++){const c=text[i];
  if(q){if(c==='"'){if(text[i+1]==='"'){f+='"';i++}else q=false}else f+=c}
  else if(c==='"'&&f==='')q=true;
  else if(c===d){row.push(f);f=''}
  else if(c==='\n'||c==='\r'){if(c==='\r'&&text[i+1]==='\n')i++;row.push(f);rows.push(row);row=[];f=''}
  else f+=c}
 if(f!==''||row.length){row.push(f);rows.push(row)}
 return rows.filter(r=>r.some(v=>String(v).trim()!==''));
}
const colIdx=s=>{let n=0;for(const ch of s.toUpperCase())n=n*26+(ch.charCodeAt(0)-64);return n-1};
async function readXlsx(buf){
 const u8=new Uint8Array(buf),dv=new DataView(buf);let e=u8.length-22;
 while(e>=0&&dv.getUint32(e,true)!==0x06054b50)e--;if(e<0)throw new Error('This is not an .xlsx file.');
 const n=dv.getUint16(e+10,true);let p=dv.getUint32(e+16,true);const files={},td2=new TextDecoder();
 for(let i=0;i<n;i++){const meth=dv.getUint16(p+10,true),csz=dv.getUint32(p+20,true),nl=dv.getUint16(p+28,true),el=dv.getUint16(p+30,true),cl=dv.getUint16(p+32,true),lo=dv.getUint32(p+42,true);files[td2.decode(u8.subarray(p+46,p+46+nl))]={meth,csz,lo};p+=46+nl+el+cl}
 const read=async name=>{const f=files[name];if(!f)return null;const st=f.lo+30+dv.getUint16(f.lo+26,true)+dv.getUint16(f.lo+28,true),data=u8.slice(st,st+f.csz);
  if(f.meth===0)return td2.decode(data);if(typeof DecompressionStream==='undefined')throw new Error('This browser cannot open .xlsx files. Save the sheet as CSV instead.');
  return td2.decode(await new Response(new Blob([data]).stream().pipeThrough(new DecompressionStream('deflate-raw'))).arrayBuffer())};
 const X=s=>new DOMParser().parseFromString(s,'application/xml');
 const wb=X(await read('xl/workbook.xml')),sh=wb.getElementsByTagName('sheet')[0];
 const rid=sh&&(sh.getAttribute('r:id')||[...sh.attributes].find(a=>a.localName==='id')?.value);
 let target='worksheets/sheet1.xml';const relx=await read('xl/_rels/workbook.xml.rels');
 if(relx)for(const r of X(relx).getElementsByTagName('Relationship'))if(r.getAttribute('Id')===rid)target=r.getAttribute('Target');
 const path=target.startsWith('/')?target.slice(1):'xl/'+target.replace(/^\.\//,'');
 const ssx=await read('xl/sharedStrings.xml'),ss=ssx?[...X(ssx).getElementsByTagName('si')].map(si=>[...si.getElementsByTagName('t')].map(t=>t.textContent).join('')):[];
 const sx=X(await read(path)),rows=[];
 for(const r of sx.getElementsByTagName('row')){const row=[];
  for(const c of r.getElementsByTagName('c')){const col=colIdx((c.getAttribute('r')||'A').replace(/\d+/g,''));const t=c.getAttribute('t'),v=c.getElementsByTagName('v')[0]?.textContent??'';
   row[col]=t==='s'?(ss[+v]??''):t==='inlineStr'?[...c.getElementsByTagName('t')].map(x=>x.textContent).join(''):t==='b'?(v==='1'?'TRUE':'FALSE'):v}
  rows.push(Array.from(row,v=>v??''))}
 return rows.filter(r=>r.some(v=>String(v).trim()!==''));
}
function pdate(v){
 v=String(v??'').trim();if(!v)return '';
 if(/^\d{4}-\d{2}-\d{2}/.test(v))return v.slice(0,10);
 if(/^\d{4,5}(\.\d+)?$/.test(v)){const n=+v;if(n>20000&&n<80000)return iso(Math.floor(n)-25569)}
 let m=v.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})/);if(m){let y=+m[3];if(y<100)y+=2000;return iso(Math.round(Date.UTC(y,+m[1]-1,+m[2])/864e5))}
 m=v.match(/^(\d{1,2})[\/\- ]([A-Za-z]{3})[A-Za-z]*[\/\- ,]+(\d{2,4})/);if(m){const mi=MON.findIndex(x=>x.toLowerCase()===m[2].toLowerCase());let y=+m[3];if(y<100)y+=2000;if(mi>=0)return iso(Math.round(Date.UTC(y,mi,+m[1])/864e5))}
 const t=Date.parse(v);if(!isNaN(t)){const d=new Date(t);return iso(Math.round(Date.UTC(d.getFullYear(),d.getMonth(),d.getDate())/864e5))}
 return '';
}
function pstatus(s){s=String(s||'').toLowerCase();if(/done|closed|resolved|complete|released|finished|accepted/.test(s))return 'done';if(/progress|doing|review|active|testing|dev|started|implement/.test(s))return 'doing';if(/block|imped|hold/.test(s))return 'blocked';return 'todo'}
function guessMap(head){
 const lh=head.map(h=>String(h).trim().toLowerCase()),m={};
 for(const [f,,,alts] of IFIELDS){let i=-1;for(const a of alts){i=lh.indexOf(a);if(i>=0)break}if(i<0)for(const a of alts){i=lh.findIndex(h=>h.includes(a));if(i>=0)break}m[f]=i}
 if(m.name<0)m.name=0;return m;
}
function impRead(){const m={};for(const [f] of IFIELDS){const s=$('#im-'+f);m[f]=s?+s.value:-1}return m}
function buildImport(){
 const m=impRead(),rows=IMP.rows,head=IMP.head,objName=($('#im-objname').value||'Imported work').trim();
 const cols=f=>m[f]<0?[]:f==='deps'?head.map((h,i)=>h===head[m[f]]?i:-1).filter(i=>i>=0):[m[f]];
 const val=(r,f)=>cols(f).map(i=>String(r[i]??'').trim()).filter(Boolean).join(f==='deps'?',':' ');
 const items=[],objBy={},featBy={},byKey={},rowItem=[];
 const obj=name=>{const k=name.toLowerCase();if(!objBy[k]){const o=mk(nid(),'obj',null,name);items.push(o);objBy[k]=o}return objBy[k]};
 rows.forEach((r,ri)=>{const ty=val(r,'type').toLowerCase(),nm=val(r,'name');if(!nm)return;
  if(/^(initiative|objective|theme)/.test(ty)){const o=obj(nm);o.key=val(r,'key');o.owner=val(r,'owner');rowItem[ri]=o;if(o.key)byKey[o.key.toLowerCase()]=o}
 });
 rows.forEach((r,ri)=>{const ty=val(r,'type').toLowerCase(),nm=val(r,'name');if(!nm||rowItem[ri])return;
  if(/^(epic|feature|capability)/.test(ty)){const o=obj(val(r,'objective')||objName);const f=mk(nid(),'feat',o.id,nm,{owner:val(r,'owner'),notes:val(r,'notes')});f.key=val(r,'key');items.push(f);rowItem[ri]=f;featBy[nm.toLowerCase()]=f;if(f.key){featBy[f.key.toLowerCase()]=f;byKey[f.key.toLowerCase()]=f}}
 });
 rows.forEach((r,ri)=>{const nm=val(r,'name');if(!nm||rowItem[ri])return;
  const fv=val(r,'feature');let f=fv?featBy[fv.toLowerCase()]:null;
  if(!f){const fname=fv||'Ungrouped';f=featBy[fname.toLowerCase()];if(!f){f=mk(nid(),'feat',obj(val(r,'objective')||objName).id,fname);items.push(f);featBy[fname.toLowerCase()]=f}}
  const t=mk(nid(),'task',f.id,nm,{owner:val(r,'owner'),status:m.status>=0?pstatus(val(r,'status')):'todo',startBy:pdate(val(r,'startBy')),due:pdate(val(r,'due')),startedOn:pdate(val(r,'startedOn')),doneOn:pdate(val(r,'doneOn')),notes:val(r,'notes')});
  t.key=val(r,'key');if(t.status==='done'&&!t.doneOn&&t.due)t.doneOn='';items.push(t);rowItem[ri]=t;if(t.key)byKey[t.key.toLowerCase()]=t;
 });
 let nl=0,miss=0;
 rows.forEach((r,ri)=>{const it=rowItem[ri];if(!it||it.type==='obj')return;const v=val(r,'deps');if(!v)return;
  for(const tok of v.split(/[,;\n]+/)){const s=tok.trim();if(!s)continue;const mm=s.match(/([A-Za-z][A-Za-z0-9_]*-\d+|^\d+)\s*(FS|SS|FF|SF)?/i);if(!mm){miss++;continue}
   const src=/^\d+$/.test(mm[1])?rowItem[+mm[1]-1]:byKey[mm[1].toLowerCase()];
   if(!src||src===it||src.type==='obj'){miss++;continue}if(it.deps.some(d=>d.id===src.id))continue;it.deps.push(link(src.id,(mm[2]||'FS').toUpperCase()));nl++}
 });
 return {items,nl,miss,counts:{obj:items.filter(i=>i.type==='obj').length,feat:items.filter(i=>i.type==='feat').length,task:items.filter(i=>i.type==='task').length}};
}
function impPreview(){
 if(!IMP.rows.length){$('#impgo').disabled=true;return}
 const b=buildImport(),c=b.counts;
 $('#impsum').textContent=`Will create ${c.obj} ${c.obj===1?'objective':'objectives'}, ${c.feat} ${c.feat===1?'feature':'features'}, ${c.task} ${c.task===1?'task':'tasks'} and ${b.nl} ${b.nl===1?'link':'links'}${b.miss?`. ${b.miss} dependency ${b.miss===1?'entry was':'entries were'} not matched and will be skipped`:''}.`;
 $('#impgo').disabled=!(c.task||c.feat);
}
function impShow(rows,name){
 if(rows.length<2){$('#impmsg').textContent='That file has no data rows.';return}
 IMP.head=rows[0].map(h=>String(h).trim());IMP.rows=rows.slice(1);IMP.name=name;
 const g=guessMap(IMP.head),opts=sel2=>`<option value="-1">Not in file</option>`+IMP.head.map((h,i)=>`<option value="${i}"${i===sel2?' selected':''}>${esc(h||'Column '+(i+1))}</option>`).join('');
 const ex=f=>{const i=g[f];if(i<0)return '';const v=IMP.rows.map(r=>r[i]).find(v=>String(v??'').trim());return esc(String(v??'').slice(0,60))};
 $('#impmap').innerHTML=`<p class="none" style="margin:10px 0 6px">${IMP.rows.length} rows in ${esc(name)}. Check that each planner field reads from the right column.</p>
 <div class="imt">${IFIELDS.map(([f,l,req])=>`<label for="im-${f}">${l}${req?' *':''}</label><select id="im-${f}" data-imf="${f}">${opts(g[f])}</select><span class="none imex" id="ix-${f}">${ex(f)}</span>`).join('')}</div>
 <div class="two" style="margin-top:12px"><label class="f">Objective for rows that do not name one<input id="im-objname" value="${esc(name.replace(/\.[^.]+$/,''))}"></label><label class="f">Import into<select id="im-dest"><option value="new">A new plan</option>${cur?`<option value="cur">This plan (${esc(S.title)})</option>`:''}</select></label></div>
 <p id="impsum" class="dsay"></p>`;
 impPreview();
}
async function impFile(f){
 $('#impmsg').textContent='Reading '+f.name+'…';
 try{if(/\.json$/i.test(f.name)){const j=JSON.parse(await f.text());$('#impd').hidden=true;
   if(Array.isArray(j.plans)){let n=0;for(const p of j.plans){const d=norm(p.data||p);if(d){delete d.sample;await Store.create(p.name||d.title,d);n++}}plans=await Store.list(false);renderPlans();toast(`Restored ${n} ${n===1?'plan':'plans'} from the backup.`);return}
   const d=norm(j);if(!d)throw new Error('it is not a plan file from this planner');delete d.sample;await newPlan(d,d.title);toast('Plan file imported as a new plan.');return}
  let rows;if(/\.xlsx$/i.test(f.name))rows=await readXlsx(await f.arrayBuffer());else rows=parseCSV(await f.text());$('#impmsg').textContent='';impShow(rows,f.name)}
 catch(e){$('#impmsg').textContent='Could not read that file: '+e.message}
}
function openImport(){IMP.rows=[];IMP.head=[];$('#impmap').innerHTML='';$('#impf').value='';$('#impx').value='';$('#impmsg').textContent='';$('#impgo').disabled=true;$('#impd').hidden=false}
$('#impf').addEventListener('change',e=>{const f=e.target.files[0];if(f)impFile(f)});
$('#impparse').onclick=()=>{const t=$('#impx').value;if(!t.trim()){$('#impmsg').textContent='Paste CSV text first.';return}impShow(parseCSV(t),'pasted text')};
$('#impmap').addEventListener('change',e=>{const f=e.target.dataset.imf;if(f){const i=+e.target.value;const v=i<0?'':IMP.rows.map(r=>r[i]).find(v=>String(v??'').trim());$('#ix-'+f).textContent=String(v??'').slice(0,60)}impPreview()});
$('#impmap').addEventListener('input',e=>{if(e.target.id==='im-objname')impPreview()});
$('#impclose').onclick=()=>{$('#impd').hidden=true};
$('#impd').addEventListener('click',e=>{if(e.target.id==='impd')$('#impd').hidden=true});
$('#impgo').onclick=async()=>{
 const b=buildImport(),dest=$('#im-dest').value;$('#impd').hidden=true;
 if(dest==='cur'){mut(()=>{S.items.push(...b.items)});toast(`Imported ${b.counts.task} tasks into this plan.`)}
 else{const d=blank();d.items=b.items;d.title=IMP.name.replace(/\.[^.]+$/,'')||'Imported plan';await newPlan(d,d.title);toast(`Imported ${b.counts.task} tasks into a new plan.`)}
};
