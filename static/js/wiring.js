// Planner: menus, filter menu, dialogs, rail, tabs, keyboard. Runs boot(); load last.
// Classic script, no modules. Top-level names are shared globals across static/js/*.js;
// load order is set in index.html.

// ====================================================================== wiring
function closeMenu(){$('#more').hidden=true;$('#more-btn').setAttribute('aria-expanded','false')}
$('#more-btn').onclick=e=>{e.stopPropagation();fltMenu(false);const h=$('#more').hidden;$('#more').hidden=!h;$('#more-btn').setAttribute('aria-expanded',String(h))};
document.addEventListener('click',e=>{if(!$('#more').hidden&&e.target.closest('.menu')!==$('#more').parentNode)closeMenu()});
function renderFlt(){
 const on=fltOn(),c={};C.order.forEach(t=>{c[C.eff[t.id]]=(c[C.eff[t.id]]||0)+1});
 const shown=on?C.order.filter(t=>C.fs.has(t.id)).length:C.order.length,b=$('#flt-btn');
 b.setAttribute('aria-pressed',String(on));b.textContent=on?`Filter (${flt.hide.length})`:'Filter';
 const m=$('#flt'),ae=document.activeElement,af=ae&&m.contains(ae)?(ae.dataset.fs||(ae.hasAttribute('data-fc')?'*':ae.dataset.fp?'p'+ae.dataset.fp:'')):'';
 m.innerHTML=`<p class="fh">Show tasks that are</p>${FST.map(([k,l])=>`<label class="fo"><input type="checkbox" data-fs="${k}"${flt.hide.includes(k)?'':' checked'}><span class="dot ${k}"></span><span class="fl1">${l}</span><span class="fc">${c[k]||0}</span></label>`).join('')}<hr><label class="fo"><input type="checkbox" data-fc${flt.compact?' checked':''}><span class="fl1">Close up empty steps on the map</span></label><hr><div class="fq"><button class="btn" data-fp="done">Hide done</button><button class="btn" data-fp="stuck">Only blocked and waiting</button><button class="btn" data-fp="all"${on?'':' disabled'}>Show all</button></div><p class="fn">Applies to the map, grid and Gantt. Milestones and external items hide with Done once reached or delivered. The item you have open always stays visible.</p>`;
 if(af){const t=af==='*'?m.querySelector('[data-fc]'):af[0]==='p'?m.querySelector(`[data-fp="${af.slice(1)}"]`):m.querySelector(`[data-fs="${af}"]`);if(t&&!t.disabled)t.focus()}
 const sm=$('#fltsum');sm.hidden=!on;
 sm.innerHTML=on?`Showing <b>${shown}</b> of ${C.order.length} tasks<button data-fp="all">Clear</button>`:'';
}
function fltSave(){if(cur)LS.set('planner.flt.'+cur.id,JSON.stringify(flt))}
function fltLoad(){let v=null;try{v=JSON.parse(LS.get('planner.flt.'+(cur?cur.id:''))||'null')}catch(e){}flt={hide:Array.isArray(v&&v.hide)?FST.map(f=>f[0]).filter(k=>v.hide.includes(k)):[],compact:!(v&&v.compact===false)}}
function fltMenu(open){$('#flt').hidden=!open;$('#flt-btn').setAttribute('aria-expanded',String(open))}
$('#flt-btn').onclick=e=>{e.stopPropagation();closeMenu();fltMenu($('#flt').hidden)};
document.addEventListener('click',e=>{if(!$('#flt').hidden&&e.target.isConnected&&!e.target.closest('#flt-m'))fltMenu(false)});
$('#flt').addEventListener('change',e=>{const k=e.target.dataset.fs;if(k){const h=new Set(flt.hide);if(e.target.checked)h.delete(k);else h.add(k);flt.hide=FST.map(f=>f[0]).filter(x=>h.has(x))}else if(e.target.hasAttribute('data-fc'))flt.compact=e.target.checked;else return;fltSave();render()});
document.addEventListener('click',e=>{const p=e.target.closest('[data-fp]');if(!p)return;e.preventDefault();const v=p.dataset.fp;flt.hide=v==='done'?['done']:v==='stuck'?['ready','doing','done']:[];fltSave();render()});
$('#more').addEventListener('click',async e=>{
 const b=e.target.closest('[data-m]');if(!b)return;closeMenu();const m=b.dataset.m;
 if(m==='dup'){await flush();try{const p=await Store.create(null,null,cur.id);plans.unshift(p);await openPlan(p.id);toast('Copied. You are now editing the copy.')}catch(err){toast(err.message)}}
 else if(m==='arch'){await flush();try{await Store.patch(cur.id,{archived:true});plans=plans.filter(p=>p.id!==cur.id);cur=null;if(plans.length)await openPlan(plans[0].id);else await newPlan(blank(),'Untitled plan');toast('Plan archived. Find it under Show archived in the sidebar.')}catch(err){toast(err.message)}}
 else if(m==='csvimp')openImport();
 else if(m==='impjson')ov('Import plan file','Paste a plan file downloaded from this planner (JSON). It opens as a new plan.','','imp');
 else if(m==='json')download(fileSafe(S.title)+'.json',exportText());
 else if(m==='csv')download(fileSafe(S.title)+'.csv',csv(),'text/csv');
 else if(m==='backup'){try{const all=await Store.exportAll();download('planner-backup-'+todayIso()+'.json',JSON.stringify(all))}catch(err){toast(err.message)}}
 else if(m==='sample')await newPlan(sample(),'Sample plan');
});
$('#plans').addEventListener('click',async e=>{
 const u=e.target.closest('[data-unarch]');
 if(u){e.stopPropagation();try{await Store.patch(u.dataset.unarch,{archived:false});archList=archList.filter(p=>p.id!==u.dataset.unarch);plans=await Store.list(false);renderPlans();toast('Plan restored to the list.')}catch(err){toast(err.message)}return}
 const p=e.target.closest('[data-plan]');if(p&&(!cur||p.dataset.plan!==cur.id))openPlan(p.dataset.plan);else $('#app').classList.remove('railopen');
});
$('#plans').addEventListener('keydown',e=>{if((e.key==='Enter'||e.key===' ')&&e.target.dataset&&e.target.dataset.plan){e.preventDefault();openPlan(e.target.dataset.plan)}});
$('#plan-q').addEventListener('input',renderPlans);
$('#show-arch').onclick=async()=>{showArch=!showArch;if(showArch){try{archList=await Store.list(true)}catch(e){archList=[]}}renderPlans()};
$('#new-plan').onclick=async()=>{await newPlan(blank(),'Untitled plan');ttl.focus();ttl.select()};
$('#imp-file').onclick=()=>{$('#app').classList.remove('railopen');openImport()};
$('#me').addEventListener('change',()=>{LS.set('planner.user',$('#me').value.trim());toast('Name saved. Your next changes will show it in History.')});
$('#rail-tg').onclick=()=>$('#app').classList.toggle('railopen');
$('#scrim').onclick=()=>$('#app').classList.remove('railopen');
document.querySelector('.tabs').addEventListener('click',e=>{const b=e.target.closest('[data-view]');if(!b)return;view=b.dataset.view;tlReset=true;gsel=null;render();if(view==='grid')$('#gridv').focus({preventScroll:true})});
$('#hist-btn').onclick=()=>{histOpen=!histOpen;if(histOpen&&(sel||selRel||calOpen)){sel=null;selRel=null;calOpen=false;render()}renderHist()};
$('#ver-btn').onclick=()=>{if(Store.mode!=='server'){toast('Named versions need the local server.');return}$('#vdn').value='';$('#vdl').hidden=false;$('#vdn').focus()};
$('#vd-close').onclick=()=>{$('#vdl').hidden=true};
$('#vd-save').onclick=async()=>{
 const note=$('#vdn').value.trim()||'Saved version';$('#vdl').hidden=true;await flush();
 try{const r=await Store.api('POST',`api/plans/${encodeURIComponent(cur.id)}/versions`,{note});cur.rev=r.rev;toast('Version saved: '+note);if(histOpen){histTab='versions';renderHist()}}catch(err){toast('Could not save the version: '+err.message)}
};
$('#vdn').addEventListener('keydown',e=>{if(e.key==='Enter')$('#vd-save').click()});
$('#cf-load').onclick=async()=>{$('#cfd').hidden=true;const id=cur.id;lastSaved=JSON.stringify(S);await openPlan(id)};
$('#cf-keep').onclick=async()=>{$('#cfd').hidden=true;await flush(true)};
const ro=new ResizeObserver(()=>{if(C&&Math.abs(views.clientWidth-lastVW)>2)renderView()});
ro.observe(views);
window.addEventListener('resize',()=>{if(view==='gantt'&&C)renderGantt()});
boot();
