// Planner: History panel (change log and versions). Server mode only.
// Classic script, no modules. Top-level names are shared globals across static/js/*.js;
// load order is set in index.html.

// ===================================================================== history
async function loadHist(more){
 const el=$('#hpl');if(!el)return;
 if(Store.mode!=='server'){el.innerHTML='<p class="none">Versions and the change log are kept by the local server. Start it with <code>python3 server.py</code> and open the address it prints.</p>';return}
 if(!cur)return;
 try{
  if(histTab==='versions'){
   const vs=await Store.api('GET',`api/plans/${encodeURIComponent(cur.id)}/versions?limit=300`);
   el.innerHTML=vs.length?vs.map((v,i)=>`<div class="hv"><div><b>${esc(v.note||'Autosaved edits')}</b>${i===0?' <span class="hnow">Current</span>':''}</div><div class="none">${esc(v.user||'')} · ${esc(dtFmt(v.ts))} · ${v.nchanges} ${v.nchanges===1?'change':'changes'}</div><div class="hacts">${i===0?'':`<button class="btn" data-restore="${v.id}">Restore</button>`}<button class="btn" data-vdl="${v.id}">Download</button></div></div>`).join(''):'<p class="none">No versions yet.</p>';
  }else{
   const before=more?`&before=${more}`:'';
   const cs=await Store.api('GET',`api/plans/${encodeURIComponent(cur.id)}/changes?limit=150${before}`);
   const html=cs.map(c=>`<div class="hc"><div class="hcm"><b>${esc(c.user||'')}</b> <span class="none">${esc(dtFmt(c.ts))}</span></div><div>${c.item_type&&c.item_type!=='plan'?`<span class="none">${esc(c.item_type)}</span> `:''}${map[c.item_id]?`<button class="lnk" style="display:inline;padding:0" data-go="${esc(c.item_id)}">${esc(c.item_name)}</button>`:`<b>${esc(c.item_name)}</b>`}: ${esc(c.field)}${(c.old||c.new)&&!['Created','Deleted','Plan created'].includes(c.field)?` <span class="hold">${esc(c.old||'empty')}</span> → <span class="hnew">${esc(c.new||'empty')}</span>`:''}</div></div>`).join('');
   if(more){el.querySelector('.hmore')?.remove();el.insertAdjacentHTML('beforeend',html)}else el.innerHTML=html||'<p class="none">No changes recorded yet.</p>';
   if(cs.length===150)el.insertAdjacentHTML('beforeend',`<button class="btn hmore" data-hmore="${cs[cs.length-1].id}">Load older changes</button>`);
  }
 }catch(e){el.innerHTML=`<p class="none">Could not load history: ${esc(e.message)}</p>`}
}
function renderHist(){
 const hp=$('#hp');hp.classList.toggle('open',histOpen);if(!histOpen){hp.innerHTML='';return}
 hp.innerHTML=`<div class="dh"><span>History</span><button class="x" data-hp="close" aria-label="Close history">×</button></div>
 <p class="dsay" style="margin-top:0">Every save is recorded. Autosaves from one person within two minutes are grouped into one version.</p>
 <div class="seg" role="tablist" style="margin:8px 0 12px"><button data-ht="changes" aria-pressed="${histTab==='changes'}">Change log</button><button data-ht="versions" aria-pressed="${histTab==='versions'}">Versions</button></div>
 <div id="hpl"><p class="none">Loading…</p></div>`;
 loadHist();
}
$('#hp').addEventListener('click',async e=>{
 const b=e.target.closest('button');if(!b)return;
 if(b.dataset.hp==='close'){histOpen=false;renderHist();return}
 if(b.dataset.ht){histTab=b.dataset.ht;renderHist();return}
 if(b.dataset.go){go(b.dataset.go);return}
 if(b.dataset.hmore){loadHist(b.dataset.hmore);return}
 if(b.dataset.vdl){try{const v=await Store.api('GET',`api/plans/${encodeURIComponent(cur.id)}/versions/${b.dataset.vdl}`);download(`${fileSafe(S.title)}-version-${v.id}.json`,JSON.stringify(v.data,null,1))}catch(err){toast(err.message)}return}
 if(b.dataset.restore){arm(b,'Click again to restore',async()=>{
  await flush();
  try{const r=await Store.api('POST',`api/plans/${encodeURIComponent(cur.id)}/restore`,{version_id:+b.dataset.restore});
   hist.push(JSON.stringify(S));S=norm(r.data)||S;cur.rev=r.rev;lastSaved=JSON.stringify(S);render();loadHist();toast('Version restored. The plan before the restore is kept as a version too.')}catch(err){toast('Restore failed: '+err.message)}});return}
});
dr.addEventListener('toggle',async e=>{
 const d=e.target;if(!d.matches||!d.matches('details[data-ih]')||!d.open)return;
 const el=d.querySelector('.ihl');
 if(Store.mode!=='server'){el.innerHTML='<p class="none">Item history needs the local server.</p>';return}
 try{const cs=await Store.api('GET',`api/plans/${encodeURIComponent(cur.id)}/changes?item=${encodeURIComponent(d.dataset.ih)}&limit=100`);
  el.innerHTML=cs.map(c=>`<div class="hc"><div class="hcm"><b>${esc(c.user||'')}</b> <span class="none">${esc(dtFmt(c.ts))}</span></div><div>${esc(c.field)}${(c.old||c.new)&&!['Created','Deleted','Plan created'].includes(c.field)?` <span class="hold">${esc(c.old||'empty')}</span> → <span class="hnew">${esc(c.new||'empty')}</span>`:''}</div></div>`).join('')||'<p class="none">No changes recorded yet.</p>'}
 catch(err){el.innerHTML=`<p class="none">${esc(err.message)}</p>`}
},true);
