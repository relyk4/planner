// Planner: storage (LS, Store), autosave, conflict dialog, plan list, boot().
// Classic script, no modules. Top-level names are shared globals across static/js/*.js;
// load order is set in index.html.

// ===================================================================== storage
const LS={get:k=>{try{return localStorage.getItem(k)}catch(e){return null}},set:(k,v)=>{try{localStorage.setItem(k,v)}catch(e){}}};
const Store={
 mode:'local',
 async init(){if(/^https?:$/.test(location.protocol)){try{const r=await fetch('api/health',{cache:'no-store'});if(r.ok){const j=await r.json();if(j.ok)this.mode='server'}}catch(e){}}},
 user(){return (LS.get('planner.user')||'').trim()||'me'},
 async api(method,url,body){
  const r=await fetch(url,{method,headers:{'Content-Type':'application/json','X-User':encodeURIComponent(this.user())},body:body===undefined?undefined:JSON.stringify(body),cache:'no-store'});
  let j={};try{j=await r.json()}catch(e){}
  if(!r.ok){const e=new Error(j.error||('HTTP '+r.status));e.status=r.status;e.body=j;throw e}
  return j;
 },
 lidx(){try{return JSON.parse(LS.get('planner.index')||'[]')}catch(e){return []}},
 lput(idx){LS.set('planner.index',JSON.stringify(idx))},
 async list(arch){
  if(this.mode==='server')return this.api('GET','api/plans'+(arch?'?archived=1':''));
  return this.lidx().filter(p=>!!p.archived===!!arch).sort((a,b)=>b.updated-a.updated);
 },
 async get(id){
  if(this.mode==='server')return this.api('GET','api/plans/'+encodeURIComponent(id));
  const p=this.lidx().find(p=>p.id===id);if(!p)throw new Error('Plan not found');
  let d=null;try{d=JSON.parse(LS.get('planner.plan.'+id))}catch(e){}
  return {...p,data:d||blank()};
 },
 async create(name,data,copyFrom){
  if(this.mode==='server')return this.api('POST','api/plans',{name,data,copy_from:copyFrom});
  let d=data;if(copyFrom){const src=await this.get(copyFrom);d=src.data;delete d.sample;name=name||('Copy of '+src.name)}
  d={...(d||blank()),title:name||(d&&d.title)||'Untitled plan'};
  const id='p'+nid(),now=Date.now()/1000,idx=this.lidx(),p={id,name:d.title,created:now,updated:now,updated_by:this.user(),rev:1,archived:false};
  idx.push(p);this.lput(idx);LS.set('planner.plan.'+id,JSON.stringify(d));return {...p,data:d};
 },
 async save(id,data,rev,force){
  if(this.mode==='server')return this.api('PUT','api/plans/'+encodeURIComponent(id),{data,base_rev:rev,force:!!force});
  const idx=this.lidx(),p=idx.find(p=>p.id===id);if(!p)throw new Error('Plan not found');
  p.updated=Date.now()/1000;p.rev=(p.rev||0)+1;p.name=data.title;p.updated_by=this.user();
  LS.set('planner.plan.'+id,JSON.stringify(data));this.lput(idx);return {rev:p.rev,updated:p.updated};
 },
 async patch(id,b){
  if(this.mode==='server')return this.api('PATCH','api/plans/'+encodeURIComponent(id),b);
  const idx=this.lidx(),p=idx.find(p=>p.id===id);if(p&&b.archived!==undefined)p.archived=!!b.archived;this.lput(idx);return p;
 },
 async exportAll(){
  if(this.mode==='server')return this.api('GET','api/export');
  const all=[];for(const p of [...this.lidx()])all.push(await this.get(p.id));return {exported:Date.now()/1000,plans:all};
 }
};
let cur=null,plans=[],archList=[],showArch=false,lastSaved='',saveT=0,saving=false,histOpen=false,histTab='changes',view='map',relPage=null,gsel=null,gedit=null,lastVW=0;
const tmFmt=ts=>{const d=new Date(ts*1000);return d.toLocaleTimeString([],{hour:'numeric',minute:'2-digit'})};
const dtFmt=ts=>{const d=new Date(ts*1000);return d.toLocaleDateString([],{month:'short',day:'numeric'})+' '+tmFmt(ts)};
const ago=ts=>{const s=Date.now()/1000-ts;return s<60?'just now':s<3600?Math.floor(s/60)+'m ago':s<86400?Math.floor(s/3600)+'h ago':new Date(ts*1000).toLocaleDateString([],{month:'short',day:'numeric'})};
function setSave(t,cls){const e=$('#save');e.textContent=t;e.className='save'+(cls?' '+cls:'')}
function save(){
 if(!cur)return;const s=JSON.stringify(S);if(s===lastSaved)return;
 setSave('Unsaved changes');clearTimeout(saveT);saveT=setTimeout(flush,900);
 const p=plans.find(p=>p.id===cur.id);if(p&&p.name!==S.title){p.name=S.title;renderPlans()}
}
async function flush(force){
 clearTimeout(saveT);if(!cur||saving)return;const s=JSON.stringify(S);if(s===lastSaved&&!force)return;
 saving=true;setSave('Saving…');const id=cur.id;let retry=false;
 try{
  const r=await Store.save(id,JSON.parse(s),cur.rev,force===true);
  if(cur&&cur.id===id){cur.rev=r.rev;cur.updated=r.updated}
  lastSaved=s;const p=plans.find(p=>p.id===id);if(p){p.updated=r.updated;p.name=S.title;p.updated_by=Store.user()}
  plans.sort((a,b)=>b.updated-a.updated);renderPlans();
  setSave((Store.mode==='server'?'Saved ':'Saved in this browser ')+tmFmt(r.updated),'ok');
  if(histOpen)loadHist();
 }catch(e){
  if(e.status===409)conflict(e.body);
  else{setSave('Not saved: '+(e.message||'cannot reach the server')+'. Retrying…','err');retry=true;saveT=setTimeout(flush,5000)}
 }finally{saving=false;if(!retry&&cur&&JSON.stringify(S)!==lastSaved)save()}
}
window.addEventListener('beforeunload',e=>{if(cur&&JSON.stringify(S)!==lastSaved){flush();e.preventDefault();e.returnValue=''}});
function conflict(b){
 const d=$('#cfd');d.hidden=false;
 $('#cft').textContent=`${b&&b.updated_by?b.updated_by:'Someone'} saved this plan${b&&b.updated?' at '+dtFmt(b.updated):''} after you opened it.`;
 setSave('Not saved: changed elsewhere','err');
}
async function openPlan(id){
 if(cur&&JSON.stringify(S)!==lastSaved)await flush();
 let p;try{p=await Store.get(id)}catch(e){toast('Could not open that plan: '+e.message);return}
 S=norm(p.data)||blank();if(!S.title)S.title=p.name;
 cur={id:p.id,rev:p.rev,name:p.name,archived:p.archived};view=S.view||'map';fltLoad();
 hist=[];sel=null;selRel=null;relPage=null;calOpen=false;focus=null;gsel=null;gedit=null;tlReset=true;
 lastSaved=JSON.stringify(S);LS.set('planner.last',p.id);
 setSave(p.updated?('Last saved '+dtFmt(p.updated)+(p.updated_by?' by '+p.updated_by:'')):'');
 $('#app').classList.remove('railopen');render();renderPlans();if(histOpen)loadHist();
}
async function refreshPlans(){
 try{plans=await Store.list(false);if(showArch)archList=await Store.list(true)}catch(e){}
 renderPlans();
}
function renderPlans(){
 const qv=$('#plan-q').value.trim().toLowerCase(),list=(showArch?archList:plans).filter(p=>!qv||String(p.name).toLowerCase().includes(qv));
 $('#plans').innerHTML=list.map(p=>`<div class="pl${cur&&p.id===cur.id?' on':''}" data-plan="${esc(p.id)}" role="button" tabindex="0" title="${esc(p.name)}"><span class="pdot"></span><span class="pn">${esc(p.name)||'Untitled plan'}</span><span class="pt">${esc(ago(p.updated))}</span>${showArch?`<button class="pa" data-unarch="${esc(p.id)}">Restore</button>`:''}</div>`).join('')||`<p class="pe">${showArch?'No archived plans.':qv?'No plans match.':'No plans yet.'}</p>`;
 $('#show-arch').textContent=showArch?'Back to plans':'Show archived';
 $('#show-arch').setAttribute('aria-pressed',showArch);
 const c=$('#conn');c.className='conn'+(Store.mode==='server'?'':' off');
 c.innerHTML=Store.mode==='server'?'<i></i>Saved on the local server':'<i></i>Saved in this browser only';
 c.title=Store.mode==='server'?'Plans, versions and the change log are kept in planner.db':'Run server.py to keep plans on disk with versions and history';
 $('#hist-btn').disabled=false;$('#ver-btn').disabled=Store.mode!=='server';
}
async function newPlan(data,name){
 await flush();
 try{const p=await Store.create(name||data?.title||'Untitled plan',data||blank());plans.unshift(p);await openPlan(p.id);return p}catch(e){toast('Could not create the plan: '+e.message)}
}
async function boot(){
 await Store.init();
 if(!LS.get('planner.user')&&Store.mode==='server')setTimeout(()=>{$('#me').focus();toast('Add your name at the bottom left so history shows who changed what.')},600);
 $('#me').value=LS.get('planner.user')||'';
 try{plans=await Store.list(false)}catch(e){plans=[]}
 if(!plans.length){
  let legacy=null;try{legacy=norm(JSON.parse(LS.get('depmap.v3')))}catch(e){}
  try{
   if(legacy&&!legacy.sample)await Store.create(legacy.title||'My plan',legacy);
   await Store.create('Sample plan',sample());
   plans=await Store.list(false);
  }catch(e){toast('Could not create the first plan: '+e.message)}
 }
 renderPlans();
 const last=LS.get('planner.last');
 if(plans.length)await openPlan((plans.find(p=>p.id===last)||plans[0]).id);
}
function download(name,text,type){
 const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([text],{type:type||'application/json'}));a.download=name;document.body.appendChild(a);a.click();
 setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove()},500);
}
const fileSafe=s=>String(s||'plan').replace(/[^\w\- ]+/g,'').trim().replace(/\s+/g,'-').slice(0,60)||'plan';
