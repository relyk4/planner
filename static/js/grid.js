// Planner: Grid view (spreadsheet editing).
// Classic script, no modules. Top-level names are shared globals across static/js/*.js;
// load order is set in index.html.

// ----------------------------------------------------------------------- grid
const GCOLS=[
 {k:'name',l:'Name',w:320},{k:'key',l:'Ticket',w:110},{k:'kind',l:'Type',w:120},{k:'owner',l:'Owner',w:130},
 {k:'status',l:'Status',w:150},{k:'startBy',l:'Start by',w:112,d:1},{k:'due',l:'Due',w:112,d:1},{k:'startedOn',l:'Started',w:112,d:1},{k:'doneOn',l:'Done',w:112,d:1},
 {k:'rel',l:'Release',w:150},{k:'deps',l:'Depends on',w:230},{k:'step',l:'Step',w:64},{k:'flags',l:'Flags',w:190},{k:'notes',l:'Notes',w:280}];
const GEDIT={obj:['name','key','owner','notes'],feat:['name','key','owner','rel','deps','notes'],task:['name','key','owner','status','startBy','due','startedOn','doneOn','rel','deps','notes'],ms:['name','owner','status','due','deps','notes'],ext:['name','key','owner','status','due','doneOn','deps','notes']};
const canEdit=(it,k)=>!!(it&&GEDIT[it.type]&&GEDIT[it.type].includes(k));
// The shown ID, unless typing it back would not find this item (duplicate key, or a key that reads as an outline number).
const refTxt=id=>findRef(C.lbl[id])===map[id]?C.lbl[id]:C.code[id];
const depsText=it=>C.own(it).map(l=>`${refTxt(l.id)} ${l.type}${lagTxt(l).replace('−','-')}${l.st==='blocked'?' (blocked)':''}`).join(', ');
function statusLabel(it){if(it.type==='task')return {todo:'Not started',doing:'In progress',done:'Done',blocked:'Blocked'}[it.status];if(it.type==='ms')return C.done(it.id)?'Reached':'Open';if(it.type==='ext')return XSL[it.status];return ''}
function flagsHtml(it){
 if(!['task','ms','ext'].includes(it.type))return '';
 const f=C.df[it.id]||{},o=[];
 if(it.type==='task'&&C.eff[it.id]==='blocked')o.push('<i class="lt" style="color:var(--red);border-color:var(--red)">Blocked</i>');
 else if(held(it.id))o.push('<i class="lt" style="color:var(--red);border-color:var(--red)">Held by blocker</i>');
 if(f.od)o.push(`<i class="lt">Overdue ${f.od}d</i>`);else if(f.ls)o.push(`<i class="lt">Late start ${f.ls}d</i>`);
 if(f.rk&&!f.od)o.push('<i class="lt rk">At risk</i>');
 if(lateHeld(it.id)&&!f.od)o.push('<i class="lt rk">Held by overdue</i>');
 if(C.warn[it.id])o.push('<i class="lt" style="color:var(--red);border-color:var(--red)">Link conflict</i>');
 return o.join(' ');
}
function cellHtml(it,k){
 const dv=v=>v?`<span title="${esc(v)}">${fd(dn(v))}</span>`:'';
 switch(k){
  case 'key':return esc(it.type==='ext'?it.ref:it.key||'');
  case 'kind':return esc(KIND[it.type]+(it.type==='ext'&&it.team?' · '+it.team:''));
  case 'owner':return esc(it.owner);
  case 'status':{const s=statusLabel(it);if(!s)return '';const ef=C.eff[it.id];return `<span class="gst"><i class="${it.type==='ms'?'dia':it.type==='ext'?'xq':'dot'} ${ef}" style="margin:0 6px 0 0;${it.type==='task'?'width:10px;height:10px':it.type==='ms'?'width:9px;height:9px':'width:10px;height:10px'}"></i>${esc(s)}</span>`}
  case 'startBy':case 'startedOn':return it.type==='task'?dv(it[k]):'';
  case 'due':return ['task','ms','ext'].includes(it.type)?dv(it.due):'';
  case 'doneOn':return it.type==='task'||it.type==='ext'?dv(it.doneOn):'';
  case 'rel':{if(it.type==='feat')return esc(S.releases.find(r=>r.id===it.rel)?.name||'');if(it.type!=='task')return '';const own=it.rel==='-'?'None':S.releases.find(r=>r.id===it.rel)?.name;const inh=S.releases.find(r=>r.id===C.relOf[it.id])?.name;return own?esc(own):inh?`<span class="none">${esc(inh)}</span>`:''}
  case 'deps':return ['task','feat','ms','ext'].includes(it.type)?esc(depsText(it)):'';
  case 'step':return it.type==='task'?String(C.step[it.id]):it.type==='ms'||it.type==='ext'?'after '+C.step[it.id]:'';
  case 'flags':return flagsHtml(it);
  case 'notes':return esc(String(it.notes||'').split('\n')[0]);
 }
 return '';
}
function gridRows(){
 const vis=rowsVisible(),res=[];
 // A milestone or external shown under a feature or objective counts as part of that group, so the "+ Add" rows come after it.
 const featOf=x=>x&&(x.type==='feat'?x:map[x.parent]?.type==='feat'?map[x.parent]:null);
 const objOf=x=>x&&(x.type==='obj'?x:map[x.parent]?objOf(map[x.parent]):null);
 vis.forEach((r,i)=>{res.push(r);const nx=vis[i+1];
  const f=featOf(r);if(f&&!f.collapsed&&featOf(nx)!==f)res.push({add:'task',parent:f.id,lvl:2});
  const o=objOf(r);if(o&&!o.collapsed&&objOf(nx)!==o)res.push({add:'feat',parent:o.id,lvl:1});
 });
 res.push({add:'obj',lvl:0});return res;
}
function renderGrid(){
 const el=$('#gridv'),rows=gridRows(),sl=el.scrollLeft,st=el.scrollTop;let n=0;
 const head=`<tr><th class="rn">#</th>${GCOLS.map((c,i)=>`<th class="${i===0?'nmc':''}" style="min-width:${c.w}px">${c.l}</th>`).join('')}</tr>`;
 const body=rows.map(r=>{
  if(r.add){const lab={task:'Add task',feat:'Add feature',obj:'Add objective'}[r.add];return `<tr class="addr"><td class="rn"></td><td class="nmc" data-add="${r.add}" data-p="${r.parent||''}" style="padding-left:${12+r.lvl*20}px">+ ${lab}</td><td colspan="${GCOLS.length-1}"></td></tr>`}
  if(r.type==='msh'||r.type==='exth'){const ms=r.type==='msh';return `<tr class="lane"><td class="rn"></td><td class="nmc" data-tog="${r.id}"><span class="gcar">${(ms?S.msCollapsed:S.extCollapsed)?'▸':'▾'}</span>${ms?'Milestones':'External dependencies'}</td><td colspan="${GCOLS.length-1}"><button class="glink" data-gadd="${ms?'ms':'ext'}">+ Add ${ms?'milestone':'external dependency'}</button></td></tr>`}
  n++;const it=r,lvl=lvlOf(it);
  const cells=GCOLS.map((c,ci)=>{
   const ed=canEdit(it,c.k),on=gsel&&gsel.id===it.id&&gsel.k===c.k;
   if(ci===0){const car=it.type==='obj'||it.type==='feat'?`<span class="gcar" data-tog="${it.id}">${it.collapsed?'▸':'▾'}</span>`:'<span class="gcar"></span>';
    const ic=it.type==='task'?`<i class="dot ${C.eff[it.id]}" style="margin:0 6px 0 0;width:10px;height:10px"></i>`:it.type==='ms'?`<i class="dia ${C.eff[it.id]}" style="margin:0 7px 0 2px;width:9px;height:9px"></i>`:it.type==='ext'?`<i class="xq ${C.eff[it.id]}" style="margin:0 6px 0 0;width:10px;height:10px"></i>`:'';
    return `<td class="nmc ed${on?' sel':''}" data-id="${it.id}" data-k="name" style="padding-left:${8+lvl*20}px">${fcs(it)}${car}${ic}<span class="gcd${idk(it.id)}">${esc(C.lbl[it.id]||'')}</span>${esc(it.name)||'<span class="none">Untitled</span>'}</td>`}
   return `<td class="${ed?'ed':'ro'}${on?' sel':''}" data-id="${it.id}" data-k="${c.k}">${cellHtml(it,c.k)}</td>`}).join('');
  return `<tr class="${it.type}"><td class="rn" data-open="${it.id}" title="Open in editor">${n}</td>${cells}</tr>`;
 }).join('');
 el.innerHTML=`<table class="gt"><thead>${head}</thead><tbody>${body}</tbody></table>`;
 el.scrollLeft=sl;el.scrollTop=st;
}
function gridCells(){return [...$('#gridv').querySelectorAll('td[data-k]')].map(td=>({id:td.dataset.id,k:td.dataset.k}))}
function gridMove(dr2,dc){
 const rows=[...$('#gridv').querySelectorAll('tbody tr')].filter(tr=>tr.querySelector('td[data-k]'));
 if(!gsel){const td=rows[0]?.querySelector('td[data-k]');if(td)gsel={id:td.dataset.id,k:td.dataset.k};renderGrid();return}
 let ri=rows.findIndex(tr=>tr.querySelector(`td[data-id="${gsel.id}"]`));if(ri<0)ri=0;
 let ci=GCOLS.findIndex(c=>c.k===gsel.k);ri=Math.max(0,Math.min(rows.length-1,ri+dr2));ci=Math.max(0,Math.min(GCOLS.length-1,ci+dc));
 const td=rows[ri].querySelectorAll('td[data-k]')[ci];if(td){gsel={id:td.dataset.id,k:td.dataset.k};renderGrid();const n=$('#gridv').querySelector('td.sel');if(n)n.scrollIntoView({block:'nearest',inline:'nearest'})}
}
function applyStatus(it,v){const td2=todayIso();it.status=v;if(v==='done')it.blocker='';
 if(it.type==='ext'){if(v==='delivered'){if(!it.doneOn)it.doneOn=td2}else it.doneOn=''}
 if(it.type==='task'){if(v==='doing'){if(!it.startedOn)it.startedOn=td2;it.doneOn=''}else if(v==='done'){if(!it.startedOn)it.startedOn=td2;if(!it.doneOn)it.doneOn=td2}else if(v==='todo'){it.startedOn='';it.doneOn=''}else it.doneOn=''}}
function findRef(tok){
 const t=tok.toLowerCase();
 for(const [id,c] of Object.entries(C.code))if(String(c).toLowerCase()===t&&map[id]&&map[id].type!=='obj')return map[id];
 return S.items.find(i=>i.type!=='obj'&&((i.key&&i.key.trim().toLowerCase()===t)||(i.type==='ext'&&i.ref&&i.ref.toLowerCase()===t)))||null;
}
function parseDeps(it,text){
 const out=[],errs=[],base=it.type==='feat'?tasksUnder(it).map(t=>t.id):[it.id],bad=new Set([...base,...downOf(base)]);
 // "REF [type][±lag] [(blocked)]". Try the longest reference first, so a key like UDM-1031
 // isn't read as UDM with a lag of -1031.
 const tail=/^(?:\s*\b(FS|SS|FF|SF)\b)?\s*(?:([+\-−])\s*(\d+)\s*[a-z]*)?\s*(\(?\s*blocked\s*\)?)?$/i;
 for(const raw of String(text||'').split(/[,;\n]+/)){
  const s=raw.trim();if(!s)continue;
  let ref=null,m=null;
  for(let i=s.length;i>0&&!ref;i--){m=s.slice(i).match(tail);if(m)ref=findRef(s.slice(0,i).trim())}
  if(!ref){errs.push(s);continue}
  if(bad.has(ref.id)){errs.push(s+' (would loop)');continue}
  if(out.some(l=>l.id===ref.id))continue;
  const old=it.deps.find(l=>l.id===ref.id),lag=m[3]?(m[2]==='+'?1:-1)*+m[3]:0;
  out.push(link(ref.id,(m[1]||old?.type||'FS').toUpperCase(),clampLag(lag),m[4]?'blocked':'auto',old?.note||''));
 }
 return {out,errs};
}
function setCell(it,k,v){
 if(k==='deps'){const {out,errs}=parseDeps(it,v);if(errs.length){toast(`Could not use: ${errs.join(', ')}. Use codes like 1.2.2, ticket keys or X3, with an optional type such as SS+1.`);return false}
  const keep=it.deps.filter(l=>!C.isN(l.id));mut(()=>{it.deps=[...out,...keep]});return true}
 mut(()=>{
  if(k==='status')applyStatus(it,v);
  else if(k==='key'){if(it.type==='ext')it.ref=v;else it.key=v}
  else if(['startBy','due','startedOn','doneOn'].includes(k))it[k]=okd(v);
  else it[k]=v;
 });return true;
}
function gridEdit(initial){
 if(!gsel)return;const it=map[gsel.id],k=gsel.k;if(!canEdit(it,k))return;
 const td=$('#gridv').querySelector(`td[data-id="${it.id}"][data-k="${k}"]`);if(!td)return;
 const col=GCOLS.find(c=>c.k===k);let inp;
 if(k==='status'){const opts=it.type==='task'?[['todo','Not started'],['doing','In progress'],['done','Done'],['blocked','Blocked']]:it.type==='ms'?[['todo','When links are met'],['done','Mark as reached']]:XS;
  inp=`<select>${opts.map(([v,l])=>`<option value="${v}"${it.status===v?' selected':''}>${l}</option>`).join('')}</select>`}
 else if(k==='rel')inp=`<select>${it.type==='task'?`<option value="">Same as feature</option><option value="-"${it.rel==='-'?' selected':''}>No release</option>`:'<option value="">No release</option>'}${S.releases.map(r=>`<option value="${r.id}"${it.rel===r.id?' selected':''}>${esc(r.name)}</option>`).join('')}</select>`;
 else if(col.d)inp=`<input type="date" value="${esc(it[k]||'')}">`;
 else{const v=initial!==undefined?initial:k==='deps'?depsText(it):k==='key'?(it.type==='ext'?it.ref:it.key||''):it[k]||'';inp=`<input type="text" value="${esc(v)}"${k==='deps'?' placeholder="e.g. 1.2.2, X3 SS+1, UDM-1031"':''}>`}
 td.classList.add('editing');td.innerHTML=inp;const e=td.firstChild,G={id:it.id,k,el:e,done:false};gedit=G;
 e.focus();if(e.select&&initial===undefined&&e.type==='text')e.select();else if(e.type==='text'){const n=e.value.length;e.setSelectionRange(n,n)}
 const commit=(mv)=>{if(G.done)return;G.done=true;const val=e.value;if(gedit===G)gedit=null;
  const before=JSON.stringify(S);const cur2=k==='deps'?depsText(it):k==='key'?(it.type==='ext'?it.ref:it.key||''):it[k]||'';
  if(String(val)!==String(cur2))setCell(it,k,val);if(JSON.stringify(S)===before)renderGrid();
  if(mv)gridMove(mv[0],mv[1]);$('#gridv').focus({preventScroll:true})};
 e.addEventListener('keydown',ev=>{
  if(ev.key==='Enter'){ev.preventDefault();commit([1,0])}
  else if(ev.key==='Tab'){ev.preventDefault();commit([0,ev.shiftKey?-1:1])}
  else if(ev.key==='Escape'){ev.preventDefault();G.done=true;if(gedit===G)gedit=null;renderGrid();$('#gridv').focus({preventScroll:true})}
  ev.stopPropagation();
 });
 e.addEventListener('blur',()=>commit(null));
 if(e.tagName==='SELECT')e.addEventListener('change',()=>commit(null));
}
function gridAdd(type,parent){
 const it=mk(nid(),type,parent||null,{obj:'New objective',feat:'New feature',task:'New task',ms:'New milestone',ext:'New external dependency'}[type]);
 if(type==='ext')it.status='pending';
 mut(()=>{S.items.push(it);if(parent)map[parent].collapsed=false;if(type==='ms')S.msCollapsed=false;if(type==='ext')S.extCollapsed=false});
 gsel={id:it.id,k:'name'};renderGrid();gridEdit();
}
$('#gridv').addEventListener('click',e=>{
 if(gedit)return;
 const ad=e.target.closest('[data-add]');if(ad){gridAdd(ad.dataset.add,ad.dataset.p||null);return}
 const ga=e.target.closest('[data-gadd]');if(ga){gridAdd(ga.dataset.gadd);return}
 const tg=e.target.closest('[data-tog]');if(tg){const id=tg.dataset.tog;if(id==='__ms')S.msCollapsed=!S.msCollapsed;else if(id==='__ext')S.extCollapsed=!S.extCollapsed;else map[id].collapsed=!map[id].collapsed;render();return}
 const op=e.target.closest('[data-open]');if(op){sel=op.dataset.open;selRel=null;q='';render();return}
 const td=e.target.closest('td[data-k]');if(!td)return;
 const was=gsel&&gsel.id===td.dataset.id&&gsel.k===td.dataset.k;gsel={id:td.dataset.id,k:td.dataset.k};renderGrid();$('#gridv').focus({preventScroll:true});
 if(was)gridEdit();
});
$('#gridv').addEventListener('dblclick',e=>{const td=e.target.closest('td[data-k]');if(!td||gedit)return;gsel={id:td.dataset.id,k:td.dataset.k};renderGrid();gridEdit()});
$('#gridv').addEventListener('keydown',e=>{
 if(gedit||e.target!==$('#gridv'))return;
 const k=e.key;
 if(k==='ArrowDown'){e.preventDefault();gridMove(1,0)}else if(k==='ArrowUp'){e.preventDefault();gridMove(-1,0)}
 else if(k==='ArrowRight'||(k==='Tab'&&!e.shiftKey)){e.preventDefault();gridMove(0,1)}else if(k==='ArrowLeft'||(k==='Tab'&&e.shiftKey)){e.preventDefault();gridMove(0,-1)}
 else if(k==='Enter'||k==='F2'){e.preventDefault();gridEdit()}
 else if(k==='Escape'){gsel=null;renderGrid()}
 else if((k==='Delete'||k==='Backspace')&&gsel){const it=map[gsel.id];if(it&&canEdit(it,gsel.k)&&gsel.k!=='name'&&gsel.k!=='status'&&gsel.k!=='rel'){e.preventDefault();setCell(it,gsel.k,'')}}
 else if(k.length===1&&!e.ctrlKey&&!e.metaKey&&gsel){const col=GCOLS.find(c=>c.k===gsel.k);if(col&&!col.d&&!['status','rel'].includes(gsel.k)&&canEdit(map[gsel.id],gsel.k)){e.preventDefault();gridEdit(k)}}
});
