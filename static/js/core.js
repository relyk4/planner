// Planner: constants, date helpers, model (mk, sample, blank, norm), mut/undo,
// compute(), relStats(), calc(), recalc(), status filter, rowsVisible(), focusSet().
// Classic script, no modules. Top-level names are shared globals across static/js/*.js;
// load order is set in index.html.

const KEY='depmap.v3',OLDS=['depmap.v2','depmap.v1'];
const $=s=>document.querySelector(s);
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let uid=Date.now()%1e6;
const nid=()=>'i'+(uid++).toString(36)+Math.random().toString(36).slice(2,5);
const TYPES={FS:'Finish to start',SS:'Start to start',FF:'Finish to finish',SF:'Start to finish'};
const LBL={done:'Done',doing:'In progress',ready:'Ready to start',waiting:'Waiting on links',blocked:'Blocked',reached:'Reached',open:'Open',pending:'Not delivered',committed:'Committed',atrisk:'At risk',delivered:'Delivered'};
const RST={planned:'Planned',active:'In progress',released:'Released'};
const KIND={obj:'Objective',feat:'Feature',task:'Task',ms:'Milestone',ext:'External dependency'};
const XS=[['pending','Not delivered yet'],['committed','Committed to a date'],['atrisk','At risk (their call)'],['blocked','Blocked'],['delivered','Delivered']],XSV=XS.map(x=>x[0]),XSL=Object.fromEntries(XS);
const lagTxt=l=>l.lag?(l.lag>0?'+':'−')+Math.abs(l.lag):'';
const tag=l=>l.type+lagTxt(l)+(l.st==='blocked'?' blocked':'');
const clampLag=v=>{v=Math.round(+v);return Number.isFinite(v)?Math.max(-9,Math.min(9,v)):0};
const ISO=/^\d{4}-\d{2}-\d{2}$/,okd=v=>ISO.test(String(v??''))?String(v):'';
const dn=v=>{if(!ISO.test(String(v??'')))return null;const [y,m,d]=String(v).split('-').map(Number);return Math.round(Date.UTC(y,m-1,d)/864e5)};
const iso=n=>new Date(n*864e5).toISOString().slice(0,10);
const todayIso=()=>{const d=new Date();return iso(Math.round(Date.UTC(d.getFullYear(),d.getMonth(),d.getDate())/864e5))};
const MON=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const fd=n=>{const d=new Date(n*864e5);return MON[d.getUTCMonth()]+' '+d.getUTCDate()};
const fr=(a,b)=>{const A=new Date(a*864e5),B=new Date(b*864e5);return a===b?fd(a):A.getUTCMonth()===B.getUTCMonth()?`${fd(a)}–${B.getUTCDate()}`:`${fd(a)} – ${fd(b)}`};
const days=n=>n+(n===1?' day':' days');
const defCal=()=>({asof:''});
const ZO={days:{label:'Days',ppd:28,bot:'day',top:'month'},weeks:{label:'Weeks',ppd:9,bot:'week',top:'month'},months:{label:'Months',ppd:2.6,bot:'month',top:'year'},quarters:{label:'Quarters',ppd:1,bot:'quarter',top:'year'}};
const dObj=n=>new Date(n*864e5);
const uStart=(n,u)=>{const d=dObj(n),y=d.getUTCFullYear(),m=d.getUTCMonth(),U=(Y,M)=>Math.round(Date.UTC(Y,M,1)/864e5);return u==='day'?n:u==='week'?n-((d.getUTCDay()+6)%7):u==='month'?U(y,m):u==='quarter'?U(y,m-m%3):U(y,0)};
const uNext=(n,u)=>{const d=dObj(n),y=d.getUTCFullYear(),m=d.getUTCMonth(),U=(Y,M)=>Math.round(Date.UTC(Y,M,1)/864e5);return u==='day'?n+1:u==='week'?n+7:u==='month'?U(y,m+1):u==='quarter'?U(y,m+3):U(y+1,0)};
const uLabel=(n,u,top)=>{const d=dObj(n),m=d.getUTCMonth(),y=d.getUTCFullYear();return u==='day'?String(d.getUTCDate()):u==='week'?MON[m]+' '+d.getUTCDate():u==='month'?(top?'':MON[m]):u==='quarter'?'Q'+(Math.floor(m/3)+1):String(y)};
const link=(id,type='FS',lag=0,st='auto',note='')=>({id,type,lag,st,note});
const mk=(id,type,parent,name,o={})=>({id,type,parent,name,owner:o.owner||'',status:o.status||'todo',deps:o.deps||[],blocker:o.blocker||'',earliest:o.earliest||null,gate:o.gate||null,collapsed:false,notes:o.notes||'',rel:o.rel||'',target:o.target||'',due:o.due||'',startBy:o.startBy||'',startedOn:o.startedOn||'',doneOn:o.doneOn||'',team:o.team||'',ref:o.ref||'',color:o.color||'',key:o.key||''});
const DEFS=`<defs>${['FS','SS','FF','SF','bk','ok','ovd'].map(c=>`<marker id="m${c}" viewBox="0 0 8 8" refX="8" refY="4" markerWidth="9" markerHeight="9" markerUnits="userSpaceOnUse" orient="auto"><path class="ah ${c}" d="M0,0L8,4L0,8z"/></marker>`).join('')}</defs>`;

function sample(){
 const items=[],ids={},R0=nid(),R1=nid(),R2=nid(),T0=dn(todayIso()),rd=n=>iso(T0+n);
 const a=(code,type,name,o={})=>{const id=nid();ids[code]=id;const p=type==='ms'||type==='ext'?null:code.includes('.')?ids[code.split('.').slice(0,-1).join('.')]:null;const it=mk(id,type,p,name,{...o,deps:(o.deps||[]).map(d=>Array.isArray(d)?link(ids[d[0]],d[1],d[2]||0,d[3]||'auto',d[4]||''):link(ids[d]))});if(o.earliest)it.earliest=o.earliest;items.push(it)};
 // milestones (gates)
 a('M1','ms','Dev environment ready',{owner:'Alex',status:'done',target:'Before PI planning',due:rd(-20),notes:'Marked reached by hand: it depended on work outside this plan.'});
 // external team dependencies
 a('X1','ext','Firewall rule change for source systems',{owner:'Pat Moreno',team:'Network team',status:'delivered',due:rd(-10),doneOn:rd(-12),ref:'NET-2291'});
 a('X2','ext','Identity service v2.3 release',{owner:'J. Rivera',team:'Platform team',status:'committed',due:rd(12),ref:'PLAT-412',notes:'Row-level access needs the new role claims that ship in v2.3. The whole Access control feature waits on it.'});
 a('X3','ext','Approved source extracts',{owner:'Data office lead',team:'Data office',status:'atrisk',due:rd(20),ref:'DO-88',gate:2,notes:'Data office warned the approval board may slip a sprint. Pinned after step 2 to line up with the board meeting.'});
 a('X4','ext','Shared logging cluster upgrade',{owner:'Ops on-call',team:'Ops team',status:'blocked',due:rd(-2),ref:'OPS-1177',notes:'Upgrade halted on a vendor licence issue. Dashboards cannot ship without it.'});
 // objective 1
 a('1','obj','Stand up data ingest',{owner:'Alex'});
 a('1.1','feat','Connector framework',{color:'#2f6fdb',owner:'Sam',rel:R0});
 a('1.1.1','task','Define source schema contract',{owner:'Sam',status:'done',startBy:rd(-30),due:rd(-25),startedOn:rd(-30),doneOn:rd(-26)});
 a('1.1.2','task','Build connector framework',{owner:'Jo',status:'done',startBy:rd(-25),due:rd(-16),startedOn:rd(-24),doneOn:rd(-13),deps:['1.1.1','M1'],notes:'Finished three days after its due date.'});
 a('1.1.3','task','Framework developer guide',{owner:'Priya',status:'done',startBy:rd(-22),due:rd(-13),startedOn:rd(-20),doneOn:rd(-13),deps:[['1.1.2','FF',0,'auto','Guide can be written alongside, but closes only when the framework is done.']]});
 a('M2','ms','Foundations released',{owner:'Alex',due:rd(-10),deps:['1.1.1','1.1.2','1.1.3'],target:'Sprint 1',notes:'Reached automatically once every input was done.'});
 a('1.2','feat','Source connectors',{color:'#0c8599',owner:'Jo',rel:R1});
 a('1.2.1','task','Request schema registry access',{owner:'Jo',status:'done',startBy:rd(-9),due:rd(-7),startedOn:rd(-8),doneOn:rd(-7)});
 a('X5','ext','Schema registry access granted',{owner:'Platform service desk',team:'Platform team',status:'pending',due:rd(14),ref:'PLAT-430',deps:['1.2.1'],notes:'They needed our access request (1.2.1) before they could start.'});
 a('1.2.2','task','Connector for system A',{owner:'Jo',status:'doing',startBy:rd(-6),due:rd(6),startedOn:rd(-4),deps:['1.1.2','X1']});
 a('1.2.3','task','Connector for system B',{owner:'Priya',startBy:rd(10),due:rd(22),rel:R2,deps:['1.1.2',['1.2.2','SS',1,'auto','Start a step after system A starts so the pattern is proven.'],'X5'],notes:'Deferred to R2 at PI planning (this task overrides its feature release).'});
 a('1.3','feat','Validation layer',{color:'#7048e8',owner:'Priya',rel:R1});
 a('1.3.1','task','Write validation rules',{owner:'Priya',status:'doing',startBy:rd(-5),due:rd(-1),startedOn:rd(-5),deps:['1.1.1']});
 a('1.3.2','task','Wire validation into pipeline',{owner:'Jo',startBy:rd(8),due:rd(18),deps:['1.2.2','1.3.1','X3']});
 a('1.3.3','task','Reject queue and alerting',{owner:'Sam',startBy:rd(19),due:rd(28),deps:['1.3.2']});
 a('1.3.4','task','Retire legacy ingest feed',{owner:'Jo',startBy:rd(24),due:rd(33),deps:[['1.3.3','SF',0,'auto','Legacy feed cannot be switched off until the reject queue is running.']]});
 a('M3','ms','Ingest pipeline live',{owner:'Alex',due:rd(24),deps:['1.3.3'],target:'Sprint 3'});
 // objective 2
 a('2','obj','Deliver unified query API',{owner:'Lee'});
 a('2.1','feat','Query service',{color:'#c2255c',owner:'Lee',rel:R2});
 a('2.1.1','task','API design review',{owner:'Lee',status:'done',startBy:rd(-20),due:rd(-15),startedOn:rd(-20),doneOn:rd(-16)});
 a('2.1.2','task','Build read model tables',{owner:'Lee',startBy:rd(20),due:rd(34),deps:[['1.3.2','FS',0,'blocked','Schema change request pending with data owners.']]});
 a('2.1.3','task','Query endpoints',{owner:'Max',status:'doing',startBy:rd(-3),due:rd(40),startedOn:rd(-2),deps:['2.1.1',['2.1.2','FF',0,'auto','Endpoints can be built now but only finish once the tables exist.']]});
 a('2.1.4','task','Load and soak test',{owner:'Lee',startBy:rd(44),due:rd(50),earliest:8,deps:[['2.1.3','FS',1,'auto','One step of buffer after endpoints for test data prep.']],notes:'Pinned one step later than its links need, to line up with the perf environment booking.'});
 a('2.2','feat','Access control',{color:'#f59f00',owner:'Max',rel:R2,deps:['X2']});
 a('2.2.1','task','Role mapping with security office',{owner:'Max',status:'blocked',startBy:rd(-10),due:rd(8),blocker:'Waiting on the approved role list from the security office'});
 a('2.2.2','task','Enforce row-level access',{owner:'Max',startBy:rd(36),due:rd(46),deps:['2.2.1','2.1.3']});
 a('2.2.3','task','Access audit report',{owner:'Lee',status:'done',startedOn:rd(-4),doneOn:rd(-1),due:rd(48),deps:[['2.2.2','FF']],notes:'Marked done early, before row-level access finished. The FF link flags the conflict.'});
 a('M4','ms','API feature complete',{owner:'Lee',due:rd(60),deps:['2.2.2','2.1.4'],target:'Sprint 5'});
 // objective 3
 a('3','obj','Operational readiness',{owner:'Alex'});
 a('3.1','feat','Monitoring',{color:'#2b8a3e',owner:'Sam',rel:R1});
 a('3.1.1','task','Monitoring requirements',{owner:'Sam',status:'doing',startBy:rd(-7),due:rd(-3),startedOn:rd(-6)});
 a('M5','ms','Monitoring requirements signed off',{owner:'Sam',due:rd(-2),deps:['3.1.1'],target:'Sprint 2'});
 a('3.1.2','task','Pipeline health dashboards',{owner:'Sam',startBy:rd(2),due:rd(20),deps:['M5','X4']});
 a('3.1.3','task','On-call runbook',{owner:'Alex',status:'doing',startBy:rd(-1),due:rd(36),startedOn:rd(-1),deps:[['3.1.2','FF']],notes:'Drafting now; cannot close until the dashboards are done.'});
 a('3.2','feat','Accreditation package',{color:'#495057',owner:'Alex',rel:R2});
 a('3.2.1','task','Security scan and remediation',{owner:'Lee',startBy:rd(61),due:rd(68),deps:['M4']});
 a('3.2.2','task','Submit package',{owner:'Alex',startBy:rd(69),due:rd(74),deps:['3.2.1','3.1.3']});
 a('M6','ms','Accreditation package submitted',{owner:'Alex',due:rd(78),deps:['3.2.2'],target:'End of PI'});
 return {title:'PI dependency map',sample:true,msCollapsed:false,extCollapsed:false,cal:{asof:''},tl:{open:false,zoom:'weeks',only:true},
  releases:[{id:R0,name:'R0 Foundations',target:'Sprint 1',status:'released',notes:'Shipped.',due:rd(-8)},{id:R1,name:'R1 Ingest MVP',target:'End of sprint 3',status:'active',notes:'',due:rd(30)},{id:R2,name:'R2 Query API',target:'End of PI',status:'planned',notes:'',due:rd(76)}],items};
}
function blank(){const o=nid(),f=nid(),t=nid();return {title:'Untitled plan',msCollapsed:false,cal:defCal(),tl:{open:false,zoom:'weeks',only:true},releases:[],items:[mk(o,'obj',null,'Objective 1'),mk(f,'feat',o,'Feature 1'),mk(t,'task',f,'First task')]}}
function normLinks(ds){const seen=new Set();return (Array.isArray(ds)?ds:[]).map(l=>typeof l==='string'?{id:l}:l).filter(l=>l&&l.id&&!seen.has(String(l.id))&&seen.add(String(l.id))).map(l=>link(String(l.id),TYPES[l.type]?l.type:'FS',clampLag(l.lag||0),l.st==='blocked'?'blocked':'auto',String(l.note??'')))}
function norm(s){
 if(!s||!Array.isArray(s.items))return null;
 const items=s.items.filter(i=>i&&i.id&&['obj','feat','task','ms','ext'].includes(i.type)).map(i=>({id:String(i.id),type:i.type,parent:i.parent&&i.type!=='ms'&&i.type!=='ext'?String(i.parent):null,name:String(i.name??''),owner:String(i.owner??''),status:(i.type==='ext'?XSV:['todo','doing','done','blocked']).includes(i.status)?i.status:i.type==='ext'?'pending':'todo',deps:normLinks(i.deps),blocker:String(i.blocker??''),earliest:+i.earliest>0?Math.floor(+i.earliest):null,gate:(i.type==='ms'||i.type==='ext')&&+i.gate>0?Math.floor(+i.gate):null,collapsed:!!i.collapsed,notes:String(i.notes??''),rel:String(i.rel??''),target:String(i.target??''),due:okd(i.due),startBy:okd(i.startBy),startedOn:okd(i.startedOn),doneOn:okd(i.doneOn),team:String(i.team??''),ref:String(i.ref??''),color:/^#[0-9a-fA-F]{6}$/.test(String(i.color??''))?String(i.color):'',key:String(i.key??'')}));
 const releases=Array.isArray(s.releases)?s.releases.filter(r=>r&&r.id).map(r=>({id:String(r.id),name:String(r.name??''),target:String(r.target??''),status:RST[r.status]?r.status:'planned',notes:String(r.notes??''),due:okd(r.due)})):[];
 const cal={asof:okd((s.cal||{}).asof)},t=s.tl||{},tl={open:!!t.open,zoom:ZO[t.zoom]?t.zoom:'weeks',only:t.only!==false};
 return {title:String(s.title||'Untitled plan'),view:['map','grid','gantt','rel'].includes(s.view)?s.view:'map',relOpen:s.relOpen!==false,sample:!!s.sample,msCollapsed:!!s.msCollapsed,extCollapsed:!!s.extCollapsed,itemIds:s.itemIds==='key'?'key':'outline',cal,tl,releases,items};
}

let S=blank();
let td=null,tlGeo=null,tlReset=true,geo={},drag=null,noClick=false,toastT=0,map={},kids={},C=null,sel=null,selRel=null,calOpen=false,calStep=null,focus=null,critOn=false,tagsOn=true,q='',hist=[],pend=null,tm=0,lastW=0;
const board=$('#board'),grid=$('#grid'),dr=$('#dr'),ttl=$('#ttl');
const views=$('#views');

function mut(fn){hist.push(JSON.stringify(S));if(hist.length>80)hist.shift();fn();S.sample=false;render()}
function undo(){if(!hist.length)return;S=JSON.parse(hist.pop());render()}

function compute(){
 map={};kids={};
 for(const it of S.items){map[it.id]=it;(kids[it.parent||'root']??=[]).push(it)}
 const root=kids.root||[],code={},order=[],feats=[],mss=root.filter(m=>m.type==='ms'),exts=root.filter(x=>x.type==='ext');
 mss.forEach((m,i)=>code[m.id]='M'+(i+1));exts.forEach((x,i)=>code[x.id]='X'+(i+1));
 root.filter(o=>o.type==='obj').forEach((o,i)=>{code[o.id]=''+(i+1);(kids[o.id]||[]).filter(f=>f.type==='feat').forEach((f,j)=>{code[f.id]=code[o.id]+'.'+(j+1);feats.push(f);(kids[f.id]||[]).filter(t=>t.type==='task').forEach((t,k)=>{code[t.id]=code[f.id]+'.'+(k+1);order.push(t)})})});
 // Display IDs: C.code stays the outline number; C.lbl is what the page shows. With the plan's
 // "Item IDs" set to ticket keys, a feature or task with a key shows the key instead.
 const lbl={...code};if(S.itemIds==='key')for(const n of [...feats,...order]){const k=String(n.key??'').trim();if(k)lbl[n.id]=k}
 const tset=new Set(order.map(t=>t.id)),mset=new Set(mss.map(m=>m.id)),xset=new Set(exts.map(x=>x.id));
 const isT=d=>tset.has(d),isM=d=>mset.has(d),isX=d=>xset.has(d),isP=d=>mset.has(d)||xset.has(d),isN=d=>tset.has(d)||isP(d);
 const own=n=>n.deps.filter(l=>isN(l.id)&&l.id!==n.id&&!(n.type==='feat'&&map[l.id].parent===n.id));
 const links=n=>{const o=own(n);if(n.type!=='task')return o;const f=map[n.parent];if(!f||!f.deps.length)return o;const have=new Set(o.map(l=>l.id));return o.concat(own(f).filter(l=>!have.has(l.id)&&l.id!==n.id))};
 const rids=new Set(S.releases.map(r=>r.id)),relOf={};
 order.forEach(t=>{const r=t.rel==='-'?'':(t.rel||map[t.parent]?.rel||'');relOf[t.id]=rids.has(r)?r:''});
 const pos={},vis=new Set();
 const at=(id,side)=>{const p=fin(id);return map[id].type==='task'&&side==='S'?p-1:p};
 const bound=(n,l)=>{const pa=at(l.id,l.type[0])+l.lag;return n.type==='task'&&l.type[1]==='S'?pa+1:pa};
 const fin=id=>{if(id in pos)return pos[id];if(vis.has(id))return 0;vis.add(id);const n=map[id];let m=n.type==='task'?Math.max(1,n.earliest||1):n.gate||0;for(const l of links(n))m=Math.max(m,bound(n,l));vis.delete(id);return pos[id]=m};
 const nodes=[...mss,...exts,...order];nodes.forEach(n=>fin(n.id));
 const dm={};
 const started=id=>map[id].type==='task'?['doing','done'].includes(map[id].status):done(id);
 const sat=l=>l.type[0]==='S'?started(l.id):done(l.id);
 const done=id=>{if(id in dm)return dm[id];dm[id]=false;const n=map[id],ls=links(n);return dm[id]=n.type==='task'?n.status==='done':n.type==='ext'?n.status==='delivered':(n.status==='done'||(ls.length>0&&ls.every(sat)))};
 const succ={},succL={};
 nodes.forEach(n=>links(n).forEach(l=>(succ[l.id]??=[]).push(n.id)));
 [...mss,...exts,...order,...feats].forEach(n=>own(n).forEach(l=>(succL[l.id]??=[]).push({n,l})));
 const eff={},warn={};
 order.forEach(t=>{const ls=links(t);eff[t.id]=t.status==='done'?'done':(t.status==='blocked'||t.blocker.trim()||ls.some(l=>l.st==='blocked'))?'blocked':t.status==='doing'?'doing':ls.some(l=>l.type[1]==='S'&&!sat(l))?'waiting':'ready';
  const w=ls.filter(l=>!sat(l)&&((l.type[1]==='S'&&started(t.id))||(l.type[1]==='F'&&t.status==='done')));if(w.length)warn[t.id]=w});
 mss.forEach(m=>eff[m.id]=done(m.id)?'reached':'open');
 exts.forEach(x=>eff[x.id]=x.status);
 const chain={};
 const ch=(id,seen)=>{if(id in chain)return chain[id];if(seen.has(id))return false;seen.add(id);let r=false;for(const l of links(map[id])){if(l.st==='blocked'&&!done(id)){r=true;break}if(sat(l))continue;if(eff[l.id]==='blocked'||ch(l.id,seen)){r=true;break}}return chain[id]=r};
 nodes.forEach(n=>ch(n.id,new Set()));
 const N=Math.max(1,...nodes.map(n=>pos[n.id]));
 const crit=new Set(),critE=new Set();
 let cur=order.find(t=>pos[t.id]===N&&t.status!=='done')||order.find(t=>pos[t.id]===N)||[...mss,...exts].find(m=>pos[m.id]===N);
 while(cur&&!crit.has(cur.id)){crit.add(cur.id);const c=cur,l=links(c).find(l=>bound(c,l)===pos[c.id]),nx=l&&map[l.id];if(nx)critE.add(nx.id+'>'+c.id);cur=nx}
 const minOf=id=>{const n=map[id];let m=n.type==='task'?1:0;for(const l of links(n))m=Math.max(m,bound(n,l));return m};
 const whyMin=id=>{const n=map[id];let best=null,bv=n.type==='task'?1:0;for(const l of links(n)){const b=bound(n,l);if(b>bv){bv=b;best=l}}return best?`it waits on ${lbl[best.id]} (${best.type}${best.lag?(best.lag>0?'+':'−')+Math.abs(best.lag):''})`:''};
 return {code,lbl,order,feats,mss,exts,step:pos,succ,succL,eff,warn,chain,N,crit,critE,isT,isM,isX,isP,isN,done,started,sat,links,own,relOf,minOf,whyMin};
}
const ids=n=>C.links(n).map(l=>l.id);
const upOf=start=>{const s=new Set(),stk=[...start];while(stk.length){const id=stk.pop();if(!map[id])continue;for(const d of ids(map[id]))if(!s.has(d)){s.add(d);stk.push(d)}}return s};
const downOf=start=>{const s=new Set(),stk=[...start];while(stk.length){const id=stk.pop();for(const d of C.succ[id]||[])if(!s.has(d)){s.add(d);stk.push(d)}}return s};
const tasksUnder=it=>it.type==='task'?[it]:it.type==='ms'||it.type==='ext'?[]:(kids[it.id]||[]).flatMap(tasksUnder);
// ' idk' when an item shows its ticket key in place of its outline number, so long keys can be truncated.
const idk=id=>C.lbl[id]!==C.code[id]?' idk':'';
const held=id=>C.chain[id]&&!C.done(id);
const lateHeld=id=>!C.done(id)&&(C.lateUp?.[id]||[]).length>0;
const lateTxt=id=>lateHeld(id)?`<br><span class="ltc">Held up by overdue:</span> ${C.lateUp[id].map(d=>`<button class="lnk" style="display:inline;padding:0;color:var(--late);font-weight:700" data-go="${d}">${esc(C.lbl[d])} ${esc(map[d].name)}</button>`).join(', ')}`:'';
const linkState=l=>l.st==='blocked'?'Blocked':C.sat(l)?'Satisfied':'Open';
function relStats(){return S.releases.map(r=>{
 const ts=C.order.filter(t=>C.relOf[t.id]===r.id),set=new Set(ts.map(t=>t.id));
 const up=[...upOf([...set])].filter(d=>C.isT(d)&&!set.has(d)&&!C.done(d));
 return {r,ts,ids:set,up,xt:[...upOf([...set])].filter(d=>C.isX(d)&&!C.done(d)),done:ts.filter(t=>t.status==='done').length,blk:ts.filter(t=>C.eff[t.id]==='blocked'||held(t.id)).length,land:ts.length?Math.max(...ts.map(t=>C.step[t.id])):0,feats:[...new Set(ts.map(t=>t.parent))]};
})}
const rkTxt=f=>(f.rkBy||[]).map(o=>`${esc(C.lbl[o.id])} is ${C.isX(o.id)?'expected':'due'} ${fd(o.pd)}, ${days(o.d)} after this ${o.kind==='start'?'should start':'is due'}`).join('; ');
function calc(){
 const T=dn(S.cal.asof)??dn(todayIso()),F={};
 const endOf=id=>{const n=map[id];if(!n||n.type==='feat'||n.type==='obj')return null;if(n.type==='task')return n.status==='done'?dn(n.doneOn):dn(n.due);if(n.type==='ext')return n.status==='delivered'?dn(n.doneOn):dn(n.due);return dn(n.due)};
 const risk=(n,sb,due)=>{const out=[];for(const l of C.links(n)){if(C.sat(l))continue;const pd=endOf(l.id);if(pd===null)continue;const start=l.type[1]==='S'&&sb!==null,lim=start?sb:due;if(lim!==null&&pd>lim)out.push({id:l.id,pd,d:pd-lim,kind:start?'start':'due'})}return out};
 for(const t of C.order){
  const due=dn(t.due),sb=dn(t.startBy),f={due,sb};
  if(t.status!=='done'){const started=t.status==='doing'||dn(t.startedOn)!==null;
   if(sb!==null&&!started&&T>sb)f.ls=T-sb;
   if(due!==null&&T>due)f.od=T-due;
   const rb=risk(t,started?null:sb,due);if(rb.length){f.rkBy=rb;f.rk=Math.max(...rb.map(o=>o.d))}}
  else{const d=dn(t.doneOn);if(d!==null&&due!==null&&d>due)f.fl=d-due}
  const sd=dn(t.startedOn);if(sd!==null&&sb!==null&&sd>sb)f.sl=sd-sb;
  F[t.id]=f;
 }
 for(const m of [...C.mss,...C.exts]){const due=dn(m.due),f={due};
  if(!C.done(m.id)){if(due!==null&&T>due)f.od=T-due;const rb=due===null?[]:risk(m,null,due);if(rb.length){f.rkBy=rb;f.rk=Math.max(...rb.map(o=>o.d))}else if(m.type==='ext'&&m.status==='atrisk'){f.rk=1;f.their=true}}
  F[m.id]=f}
 C.rel.forEach(x=>{x.due=dn(x.r.due);x.after=[];x.xlate=[];if(x.r.status!=='released'&&x.due!==null){if(T>x.due)x.od=T-x.due;x.after=x.ts.filter(t=>t.status!=='done'&&dn(t.due)!==null&&dn(t.due)>x.due);x.xlate=x.xt.filter(d=>dn(map[d].due)!==null&&dn(map[d].due)>x.due);x.rk=x.after.length+x.xlate.length}});
 const lu={},up=(id,seen)=>{if(lu[id])return lu[id];if(seen.has(id))return [];seen.add(id);const out=new Set();for(const l of C.links(map[id])){if(C.sat(l))continue;if(F[l.id]?.od)out.add(l.id);for(const x of up(l.id,seen))out.add(x)}return lu[id]=[...out]};
 [...C.mss,...C.exts,...C.order].forEach(n=>{if(!C.done(n.id))up(n.id,new Set())});
 Object.assign(C,{T,df:F,endOf,lateUp:lu});
}
function recalc(){C=compute();C.rel=relStats();calc();if(sel&&!map[sel])sel=null;if(selRel&&!S.releases.some(r=>r.id===selRel))selRel=null;if(relPage&&!S.releases.some(r=>r.id===relPage))relPage=null;C.fs=fltSet()}
const FST=[['ready','Ready to start'],['doing','In progress'],['waiting','Waiting on links'],['blocked','Blocked'],['done','Done']];
let flt={hide:[],compact:true};
const fltOn=()=>flt.hide.length>0;
function fltSet(){
 if(!fltOn())return null;
 const s=new Set(),h=new Set(flt.hide),hd=h.has('done');
 for(const t of C.order)if(!h.has(C.eff[t.id])||t.id===sel)s.add(t.id);
 for(const n of [...C.mss,...C.exts])if(!(hd&&C.done(n.id))||n.id===sel)s.add(n.id);
 for(const f of S.items)if(f.type==='feat'){const ts=tasksUnder(f);if(!ts.length||f.id===sel||ts.some(t=>s.has(t.id)))s.add(f.id)}
 for(const o of S.items)if(o.type==='obj'){const fs=(kids[o.id]||[]).filter(f=>f.type==='feat');if(!fs.length||o.id===sel||fs.some(f=>s.has(f.id)))s.add(o.id)}
 return s;
}
function stepsShown(){
 const all=Array.from({length:C.N},(_,i)=>i+1);
 if(!C.fs||!flt.compact)return all;
 const s=new Set();C.order.forEach(t=>{if(C.fs.has(t.id))s.add(C.step[t.id])});
 return s.size?[...s].sort((a,b)=>a-b):all;
}
function rowsVisible(){
 const r=[],F=C.fs,ok=n=>!F||F.has(n.id),ms=C.mss.filter(ok),xs=C.exts.filter(ok);
 if(ms.length){r.push({id:'__ms',type:'msh'});if(!S.msCollapsed)r.push(...ms)}
 if(xs.length){r.push({id:'__ext',type:'exth'});if(!S.extCollapsed)r.push(...xs)}
 for(const o of kids.root||[]){if(o.type!=='obj'||!ok(o))continue;r.push(o);if(o.collapsed)continue;for(const f of kids[o.id]||[]){if(f.type!=='feat'||!ok(f))continue;r.push(f);if(f.collapsed)continue;for(const t of kids[f.id]||[])if(t.type==='task'&&ok(t))r.push(t)}}
 return r;
}
function focusSet(){
 if(selRel){const x=C.rel.find(x=>x.r.id===selRel);if(x&&x.ids.size)return new Set([...x.ids,...upOf([...x.ids])])}
 if(sel&&map[sel]){const it=map[sel],base=it.type==='ms'||it.type==='ext'?[it.id]:tasksUnder(it).map(t=>t.id);if(!base.length)return null;return new Set([...base,...upOf(base),...downOf(base)])}
 if(focus==='warn')return new Set(Object.keys(C.warn).flatMap(id=>[id,...C.warn[id].map(l=>l.id)]));
 if(focus==='bklink')return new Set(C.order.filter(t=>C.links(t).some(l=>l.st==='blocked')).flatMap(t=>[t.id,...C.links(t).filter(l=>l.st==='blocked').map(l=>l.id)]));
 if(focus==='ext'){const xs=C.exts.filter(x=>!C.done(x.id)).map(x=>x.id);return new Set([...xs,...downOf(xs)])}
 if(focus==='late')return new Set([...C.mss,...C.exts,...C.order].filter(n=>C.df[n.id]?.ls||C.df[n.id]?.od||lateHeld(n.id)).map(n=>n.id));
 if(focus==='risk')return new Set([...C.mss,...C.exts,...C.order].filter(n=>C.df[n.id]?.rk).map(n=>n.id));
 if(focus)return new Set(C.order.filter(t=>focus==='blocked'?C.eff[t.id]==='blocked'||held(t.id):C.eff[t.id]===focus).map(t=>t.id));
 return null;
}
