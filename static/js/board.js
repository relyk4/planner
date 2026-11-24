// Planner: map (renderBoard), link routing, timeline, drawer editor, render()/soft(),
// actions, drag, and the views switch (renderView, renderGantt).
// Classic script, no modules. Top-level names are shared globals across static/js/*.js;
// load order is set in index.html.

function poly(p){
 const pts=p.filter((q,i)=>i===0||Math.abs(q[0]-p[i-1][0])+Math.abs(q[1]-p[i-1][1])>.5);
 let d=`M${pts[0][0]},${pts[0][1]}`;
 for(let i=1;i<pts.length-1;i++){const [x0,y0]=pts[i-1],[x1,y1]=pts[i],[x2,y2]=pts[i+1],l1=Math.hypot(x1-x0,y1-y0),l2=Math.hypot(x2-x1,y2-y1),r=Math.min(5,l1/2,l2/2);
  d+=`L${x1-(x1-x0)/l1*r},${y1-(y1-y0)/l1*r}Q${x1},${y1} ${x1+(x2-x1)/l2*r},${y1+(y2-y1)/l2*r}`}
 const L=pts[pts.length-1];return [d+`L${L[0]},${L[1]}`,pts];
}
function route(a,b,off,RH,D){
 const st=9,dir=b.y>a.y?1:-1;
 if(a.v&&b.v){const sy=a.y+dir*D,ty=b.y-dir*D;if(Math.abs(a.x-b.x)<1)return [[a.x,sy],[b.x,ty]];const yc=b.y-dir*RH/2;return [[a.x,sy],[a.x,yc],[b.x,yc],[b.x,ty]]}
 if(a.v){const sy=a.y+dir*D;if((b.x-a.x)*b.d>=st)return [[a.x,sy],[a.x,b.y],[b.x,b.y]];const yc=b.y-dir*RH/2,bx=b.x-b.d*(st+off);return [[a.x,sy],[a.x,yc],[bx,yc],[bx,b.y],[b.x,b.y]]}
 if(b.v){const ty=b.y-dir*D;if((b.x-a.x)*a.d>=st)return [[a.x,a.y],[b.x,a.y],[b.x,ty]];const ax=a.x+a.d*(st+off),yc=b.y-dir*RH/2;return [[a.x,a.y],[ax,a.y],[ax,yc],[b.x,yc],[b.x,ty]]}
 let lo=-1e9,hi=1e9;
 if(a.d>0)lo=Math.max(lo,a.x+st);else hi=Math.min(hi,a.x-st);
 if(b.d>0)hi=Math.min(hi,b.x-st);else lo=Math.max(lo,b.x+st);
 if(lo<=hi){const x=Math.max(lo,Math.min(hi,b.d>0?hi-off:lo+off));return [[a.x,a.y],[x,a.y],[x,b.y],[b.x,b.y]]}
 const ax=a.x+a.d*st,bx=b.x-b.d*(st+off),yc=b.y-dir*RH/2;
 return [[a.x,a.y],[ax,a.y],[ax,yc],[bx,yc],[bx,b.y],[b.x,b.y]];
}
function tagAt(pts,w,RH,kinds,free){
 let best=pts[0],bs=-1;
 for(let i=0;i<pts.length-1;i++){
  const [x0,y0]=pts[i],[x1,y1]=pts[i+1],h=Math.abs(y1-y0)<.5,len=Math.abs(x1-x0)+Math.abs(y1-y0);
  let s,pt=[(x0+x1)/2,(y0+y1)/2];
  if(h)s=len>=w+18?len+1e4:len*.3;
  else{const lo=Math.min(y0,y1)+11,hi=Math.max(y0,y1)-11,mid=(y0+y1)/2;let c=null;
   let cr=9;for(let r=0;r<kinds.length;r++){const cy=r*RH+RH/2;if(cy<lo||cy>hi)continue;const rk=free(r,x0,w)?0:kinds[r]==='obj'||kinds[r]==='feat'?2:1;if(c===null||rk<cr||(rk===cr&&Math.abs(cy-mid)<Math.abs(c-mid))){c=cy;cr=rk}}
   s=c===null?len*.2:len-cr*20;if(c!==null)pt=[x0,c]}
  if(s>bs){bs=s;best=pt}
 }
 return best;
}

function renderStats(){
 const c={};C.order.forEach(t=>{c[C.eff[t.id]]=(c[C.eff[t.id]]||0)+1});
 const down=C.order.filter(t=>held(t.id)&&C.eff[t.id]!=='blocked').length,mr=C.mss.filter(m=>C.done(m.id)).length;
 const all=[...C.mss,...C.exts,...C.order,...C.feats].flatMap(n=>C.own(n)),bl=all.filter(l=>l.st==='blocked').length,nw=Object.keys(C.warn).length;
 const dfl=[...C.mss,...C.exts,...C.order].map(n=>C.df[n.id]||{}),nl=dfl.filter(f=>f.ls||f.od).length,no=dfl.filter(f=>f.od).length,nr=dfl.filter(f=>f.rk).length;
 const btn=(k,n,l)=>`<button class="t f-${k}" data-focus="${k}" aria-pressed="${focus===k}"><b>${n}</b><span>${l}</span></button>`;
 $('#tal').innerHTML=`<div class="t"><b>${C.order.length}</b><span>Tasks</span></div>`+[['done','Done'],['doing','In progress'],['ready','Ready now'],['waiting','Waiting']].map(([k,l])=>btn(k,c[k]||0,l)).join('')+btn('blocked',c.blocked||0,'Blocked'+(down?`, ${down} held up`:''))+btn('bklink',`${bl}/${all.length}`,'Links blocked')+(nw?btn('warn',nw,'Link conflicts'):'')+btn('late',nl,'Late'+(no?`, ${no} overdue`:'')+((h=>h?`, ${h} held up`:'')([...C.mss,...C.exts,...C.order].filter(n=>lateHeld(n.id)&&!C.df[n.id]?.od&&!C.df[n.id]?.ls).length)))+btn('risk',nr,'At risk')+`${C.exts.length?`<button class="t" data-focus="ext" aria-pressed="${focus==='ext'}"><b>${C.exts.filter(x=>C.done(x.id)).length}/${C.exts.length}</b><span>External delivered</span></button>`:''}<div class="t"><b>${mr}/${C.mss.length}</b><span>Milestones reached</span></div><div class="t"><b>${C.order.length?C.N:0}</b><span>Steps deep</span></div><button class="t" data-cal="0" title="Change the status date"><b>${fd(C.T)}</b><span>${S.cal.asof?'Status date (set)':'Status date'}</span></button>`;
 $('#undo').disabled=!hist.length;
 $('#note').hidden=!S.sample;
 $('#crit').setAttribute('aria-pressed',critOn);$('#tags').setAttribute('aria-pressed',tagsOn);
 if(document.activeElement!==ttl)ttl.value=S.title;
 renderFlt();
}
const PAL=['#2f6fdb','#0c8599','#7048e8','#c2255c','#f59f00','#2b8a3e','#5c940d','#9c36b5','#1098ad','#495057'],okc=v=>/^#[0-9a-fA-F]{6}$/.test(String(v??''))?String(v):'';
const fcol=n=>{const f=n.type==='feat'?n:n.type==='task'?map[n.parent]:null;return f&&okc(f.color)};
const fcs=n=>{const c=fcol(n);return c?`<i class="fcs ${n.type}" style="background:${c}"></i>`:''};
const featsOf=o=>(kids[o.id]||[]).filter(f=>f.type==='feat');
const featDone=f=>{const ts=tasksUnder(f);return ts.length>0&&ts.every(t=>t.status==='done')};
const featLate=f=>tasksUnder(f).some(t=>C.df[t.id]?.od||C.df[t.id]?.ls);
const featRisk=f=>!featLate(f)&&tasksUnder(f).some(t=>C.df[t.id]?.rk);
const objCount=o=>{const fs=featsOf(o);return {n:fs.length,d:fs.filter(featDone).length,fs}};
function tlDates(n){
 if(n.type==='task')return [n.startBy,n.startedOn,n.due,n.doneOn].map(dn).filter(v=>v!==null);
 if(n.type==='ms')return [dn(n.due)].filter(v=>v!==null);
 if(n.type==='ext')return [n.due,n.doneOn].map(dn).filter(v=>v!==null);
 if(n.type==='feat'||n.type==='obj')return tasksUnder(n).flatMap(tlDates);
 return [];
}
function renderTimeline(rows,W,LW,full){
 const tl=S.tl,z=ZO[tl.zoom],T=C.T;
 const list=rows.filter(r=>r.type!=='msh'&&r.type!=='exth'&&(!tl.only||tlDates(r).length));
 const all=[...list.flatMap(tlDates),...S.releases.map(r=>dn(r.due)).filter(v=>v!==null),T];
 const lo0=Math.min(...all),hi0=Math.max(...all);
 const mY=n=>{const d=dObj(n);return MON[d.getUTCMonth()]+' '+d.getUTCFullYear()};
 const rangeTxt=list.length?`${mY(lo0)} to ${mY(hi0)}`:'No dates yet';
 const open=full||tl.open;
 const head=`<div class="tlh">${full?'':`<button class="car" data-tl="toggle" aria-expanded="${tl.open}" aria-label="${tl.open?'Collapse':'Expand'} timeline">${tl.open?'▾':'▸'}</button>`}<b>${full?'Gantt':'Timeline'}</b><span class="none">${rangeTxt}</span>${open?`<span class="tlsp"></span><span class="seg" role="group" aria-label="Timeline scale">${Object.entries(ZO).map(([k,o])=>`<button data-tl="z-${k}" aria-pressed="${tl.zoom===k}">${o.label}</button>`).join('')}</span><button class="tgl" data-tl="only" aria-pressed="${tl.only}">Dated items only</button>`:''}</div>`+(open?`<div class="tlk"><span><i class="ks plan"></i>Plan, start by to due</span><span><i class="ks prog"></i>In progress so far</span><span><i class="ks done"></i>Done</span><span><i class="ks over"></i>Past due</span><span><i class="ks ls"></i>Should have started</span><span><i class="ks sum"></i>Objective or feature, green is share done</span><span><i class="ks today"></i>Today</span><span><i class="ks rel"></i>Release due</span><span class="tlhint">Drag a plan bar to move it, or its ends to resize</span></div>`:'');
 if(!open){tlGeo=null;return {html:`<div class="tl" style="width:${W}px">${head}</div>`,h:50,tx:0}}
 const ppd=z.ppd,lo=uStart(lo0-2,z.bot);let hi=uNext(uStart(hi0+3,z.bot),z.bot);
 while((hi-lo)*ppd<W-LW-6)hi=uNext(hi,z.bot);
 const span=Math.round((hi-lo)*ppd),X=d=>(d-lo)*ppd,RH2=30,H2=Math.max(list.length,1)*RH2;
 let ax='',gl='',bars='',lab='';
 for(const [u,cls] of [[z.top,'up'],[z.bot,'lo']]){for(let n=uStart(lo,u);n<hi;n=uNext(n,u)){const a=Math.max(n,lo),b=Math.min(uNext(n,u),hi),now=cls==='lo'&&T>=n&&T<uNext(n,u);const txt=cls==='up'?(u==='month'?mY(n):uLabel(n,u)):uLabel(n,u);ax+=`<span class="tlu ${cls}${now?' now':''}" style="left:${X(a)}px;width:${(b-a)*ppd}px">${txt}</span>`;if(cls==='lo')gl+=`<i class="tlg" style="left:${X(n)}px"></i>`}}
 if(z.bot==='day')for(let n=lo;n<hi;n++){const w=dObj(n).getUTCDay();if(w===0||w===6)gl+=`<i class="tlw" style="left:${X(n)}px;width:${ppd}px"></i>`}
 S.releases.forEach(r=>{const d=dn(r.due);if(d!==null&&d>=lo&&d<hi)gl+=`<i class="tlr" style="left:${X(d)+ppd/2}px" title="${esc(r.name)} due ${fd(d)}"></i>`});
 const tx=X(T)+ppd/2;gl+=`<i class="tlt" style="left:${tx-1}px" title="Today, ${fd(T)}"></i>`;
 const tipD=(l,v)=>v?`${l} ${fd(dn(v))}`:'';
 list.forEach((n,i)=>{
  const y=i*RH2,lvl=n.type==='obj'||n.type==='ms'||n.type==='ext'?0:n.type==='feat'?1:2,cd=esc(C.lbl[n.id]);
  const ic=n.type==='task'?`<span class="dot ${C.eff[n.id]}" style="margin:0 2px 0 6px;width:9px;height:9px"></span>`:n.type==='ms'?`<span class="dia ${C.eff[n.id]}" style="margin:0 4px 0 8px;width:8px;height:8px"></span>`:n.type==='ext'?`<span class="xq ${C.eff[n.id]}" style="margin:0 4px 0 6px;width:10px;height:10px"></span>`:'';
  lab+=`<div class="tlrow"><div class="tll ${n.type}" data-id="${n.id}" style="width:${LW}px;padding-left:${6+lvl*14}px">${fcs(n)}${ic}<span class="cd${idk(n.id)}">${cd}</span><span class="nm">${esc(n.name)||'Untitled'}</span></div></div>`;
  const f=C.df[n.id]||{};
  if(n.type==='task'){
   const sb=dn(n.startBy),du=dn(n.due),st=dn(n.startedOn),dd=dn(n.doneOn),done=n.status==='done',started=done||n.status==='doing'||st!==null;
   let s0=sb??du,e0=du??sb;if(s0!==null&&s0>e0)[s0,e0]=[e0,s0];
   const a0=st??(done?dd:n.status==='doing'?(s0??T):null),a1=done?(dd??a0):(started?T:null),segs=[];
   if(a0!==null&&a1!==null&&a1>=a0){const c=done?'done':'prog';if(du!==null&&a1>du){if(du>=a0)segs.push([a0,du,c]);segs.push([Math.max(a0,du+1),a1,'over'])}else segs.push([a0,a1,c])}
   if(!started&&s0!==null&&T>s0)segs.push([s0,T,'ls']);
   const what=done?'Done':n.status==='doing'?'In progress':n.status==='blocked'?'Blocked':'Not started';
   const tip=esc(`${C.lbl[n.id]} ${n.name}. ${what}. `+[tipD('Start by',n.startBy),tipD('due',n.due),tipD('started',n.startedOn),tipD('done',n.doneOn)].filter(Boolean).join(', ')+(f.od?`. ${days(f.od)} past due`:'')+(f.ls?`. Should have started ${days(f.ls)} ago`:''));
   const seg=(base)=>segs.map(([a,b,c])=>`<i class="sg ${c}" style="left:${X(a)-base}px;width:${Math.max(4,(b-a+1)*ppd)}px"></i>`).join('');
   if(s0!==null)bars+=`<div class="tk${n.status==='blocked'||C.eff[n.id]==='blocked'?' blk':''}" data-id="${n.id}" data-tdrag="${n.id}" title="${tip}" style="left:${X(s0)}px;width:${Math.max(6,(e0-s0+1)*ppd)}px;top:${y+6}px">${seg(X(s0))}<i class="th l" data-h="s"></i><i class="th r" data-h="e"></i></div>`;
   else if(segs.length)bars+=`<div class="tko" data-id="${n.id}" title="${tip}" style="left:0;top:${y+6}px">${seg(0)}</div>`;
  }else if(n.type==='ms'||n.type==='ext'){
   const d=dn(n.due),dd=n.type==='ext'&&n.status==='delivered'?dn(n.doneOn):null,cls=n.type==='ms'?'dia':'xq';
   const tip=esc(`${C.lbl[n.id]} ${n.name}. ${LBL[C.eff[n.id]]}. ${[tipD(n.type==='ms'?'Due':'Expected',n.due),tipD('delivered',dd!==null?n.doneOn:'')].filter(Boolean).join(', ')}${f.od?`. ${days(f.od)} past due`:''}`);
   if(d!==null&&dd!==null&&d!==dd)bars+=`<i class="tln" style="left:${X(Math.min(d,dd))+ppd/2}px;width:${Math.abs(dd-d)*ppd}px;top:${y+14}px"></i>`;
   if(d!==null)bars+=`<span class="tmk${f.od?' od':''}" data-id="${n.id}" data-tdrag="${n.id}" title="${tip}. Drag to change the date" style="left:${X(d)+ppd/2-8}px;top:${y+7}px"><span class="${cls} ${dd!==null?'':C.eff[n.id]}"></span></span>`;
   if(dd!==null)bars+=`<span class="tmk" data-id="${n.id}" title="${tip}" style="left:${X(dd)+ppd/2-8}px;top:${y+7}px"><span class="${cls} delivered"></span></span>`;
  }else{
   const ds=tlDates(n);if(ds.length){
    const a=Math.min(...ds),b=Math.max(...ds),ob=n.type==='obj',ts=tasksUnder(n),x=X(a),wd=Math.max(6,(b-a+1)*ppd);
    const relPast=f=>{const rr=S.releases.find(r=>r.id===f.rel),rd=rr?dn(rr.due):null,e=Math.max(...tlDates(f),-1e9);return rd!==null&&e>rd?rr:null};
    let nd,tot,late,risk,past,unit;
    if(ob){const fs=featsOf(n).filter(f=>tasksUnder(f).length);unit=fs.length===1?'feature':'features';tot=fs.length;nd=fs.filter(featDone).length;late=fs.filter(featLate).length;risk=fs.filter(featRisk).length;past=fs.filter(relPast).length}
    else{unit=ts.length===1?'task':'tasks';tot=ts.length;nd=ts.filter(t=>t.status==='done').length;late=ts.filter(t=>C.df[t.id]?.od||C.df[t.id]?.ls).length;risk=ts.filter(t=>C.df[t.id]?.rk&&!C.df[t.id]?.od).length;past=relPast(n)}
    const pct=tot?Math.round(nd/tot*100):0;
    const info=`<b>${nd} of ${tot} ${unit} done</b> · ${fr(a,b)}${late?` · <span class="ltc">${late}${ob?(late===1?' feature':' features')+' with late work':' late'}</span>`:''}${risk?` · <span class="ltc">${risk}${ob?(risk===1?' feature':' features'):''} at risk</span>`:''}${past?` · <span class="ltc">${ob?`${past} ${past===1?'feature ends':'features end'} after release due`:`ends after ${esc(past.name)} due ${fd(dn(past.due))}`}</span>`:''}`;
    bars+=`<div class="tsum ${n.type}${late||past?' late':''}" data-id="${n.id}" title="${cd} ${esc(n.name)}: ${nd} of ${tot} ${unit} done (${pct}%), ${fd(a)} to ${fd(b)}" style="left:${x}px;width:${wd}px;top:${y+(ob?8:10)}px"><i style="width:${pct}%"></i>${!ob&&fcol(n)?`<b class="cap" style="background:${fcol(n)}"></b>`:''}</div><span class="tsl" style="left:${x+wd+10}px;top:${y+6}px">${info}</span>`;
   }
  }
 });
 tlGeo={lo,ppd,RH2,ids:list.map(n=>n.id)};
 const bodyH=full?Math.max(320,full):Math.min(42+H2+2,380);
 const body=list.length?`<div class="tlb" style="height:${bodyH}px"><div class="tli" style="width:${LW+span}px"><div class="tla"><div class="tlc" style="width:${LW}px">Calendar</div><div class="tlx" style="width:${span}px">${ax}</div></div>${lab}<div class="tlp" style="left:${LW}px;top:42px;width:${span}px;height:${H2}px">${gl}${bars}</div></div></div>`:`<p class="none" style="padding:12px 14px;margin:0">Add start-by, due, started or done dates to tasks, or due dates to milestones and external items, to see them here.</p>`;
 return {html:`<div class="tl" style="width:${W}px">${head}${body}</div>`,h:86+(list.length?bodyH+1:48),tx:LW+tx};
}
// Width at 100% zoom of the widest ticket key shown on a task bar (0 when none is). renderBoard()
// widens the step columns so a bar fits that key in full, plus its padding, borders and status
// square (68px). Keys past 156px (12em, the row label cap) don't widen columns further.
function keyW(){
 const ks=C.order.filter(t=>C.lbl[t.id]!==C.code[t.id]).map(t=>C.lbl[t.id]);if(!ks.length)return 0;
 const m=document.createElement('span');m.style.cssText='position:absolute;visibility:hidden;font-size:13px;font-weight:800;font-variant-numeric:tabular-nums;white-space:nowrap';
 m.innerHTML=ks.map(k=>`<div>${esc(k)}</div>`).join('');document.body.appendChild(m);const w=m.getBoundingClientRect().width;m.remove();
 return Math.min(156,Math.ceil(w));
}
function renderBoard(){
 const W=board.clientWidth||960,zf=mapZ;lastW=W;
 // Zoom scales the map's geometry here; --z (set on #grid below) scales its text and markers in app.css.
 const N=C.N,X0=18*zf,LW0=W<600?170:W<900?250:330,LW=Math.round(LW0*zf),FV=C.fs,vs=stepsShown(),NC=Math.max(1,vs.length),KW=keyW(),CW=Math.round(Math.max(W<600?126:146,Math.floor((W-LW0-18-28)/NC),KW?KW+68:0)*zf),RH=Math.round(42*zf),P=14*zf,D=10*zf;
 const bc=Array(N+2).fill(0);{const vset=new Set(vs);let k=0;for(let g=0;g<=N+1;g++){if(vset.has(g))k++;bc[g]=k}}
 const bx=g=>bc[Math.max(0,Math.min(N+1,g))]*CW;
 const flags={};C.rel.forEach(x=>{if(x.land)(flags[x.land]??=[]).push(x.r.name||'Release')});
 const HH=Math.round((50+(Object.keys(flags).length?17:0))*zf);
 const rows=rowsVisible(),TL=renderTimeline(rows,W,LW),H=Math.max(rows.length,1)*RH,F=focusSet(),rx=selRel&&C.rel.find(x=>x.r.id===selRel);
 const ri={};rows.forEach((r,i)=>ri[r.id]=i);const kinds=rows.map(r=>r.type),occ=[];
 const free=(r,x,w)=>{const o=occ[r];return !o||x+w/2+3<o[0]||x-w/2-3>o[1]};
 const anc=id=>{if(id in ri)return ri[id];const n=map[id];if(!n)return -1;if(n.type==='ms')return ri.__ms??-1;if(n.type==='ext')return ri.__ext??-1;let p=map[n.parent];while(p&&!(p.id in ri))p=map[p.parent];return p?ri[p.id]:-1};
 const per=Array(N+2).fill(0),lateS=Array(N+2).fill(0);C.order.forEach(t=>{if(FV&&!FV.has(t.id))return;per[C.step[t.id]]++;const f=C.df[t.id];if(f.ls||f.od)lateS[C.step[t.id]]++});
 const grpIn=it=>!F||tasksUnder(it).some(t=>F.has(t.id));
 const cy=i=>i*RH+RH/2;
 let L='',B='',BG='',E='',G='',T='';
 // Edge points per task, milestone and external, for the link handles (lkShow) and drop targets (lkHit).
 const pt={},ptM=(id,i)=>{const x=bx(C.step[id]);pt[id]={l:x-16*zf,r:x+16*zf,y:cy(i),h:20*zf,row:i}};
 const msMark=(m,i)=>{ptM(m.id,i);const g=C.step[m.id],ef=C.eff[m.id],cls=[ef,lateHeld(m.id)?'lchain':'',held(m.id)?'chain':'',C.df[m.id]?.od?'late':C.df[m.id]?.rk?'risk':'',critOn&&C.crit.has(m.id)?'crit':'',sel===m.id?'on':'',F&&!F.has(m.id)?'dim':''].join(' ');return `<div class="mk ${cls}" data-id="${m.id}" title="${esc(C.lbl[m.id])} ${esc(m.name)}: ${LBL[ef]}, gate after step ${g}${m.gate?' (pinned)':''}. Drag to move" style="left:${bx(g)-7.5*zf}px;top:${cy(i)-7.5*zf}px"></div>`};
 const dueTag=(n,i,x)=>{const f=C.df[n.id]||{},dl=n.type==='ext'&&n.status==='delivered'?(n.doneOn?'Delivered '+fd(dn(n.doneOn)):''):n.due?(n.type==='ext'?'Expected ':'Due ')+fd(dn(n.due)):'';return dl?`<span class="xd${f.od?' late':''}" style="left:${x}px;top:${cy(i)-9*zf}px">${dl}</span>`:''};
 const xMark=(x,i,bar)=>{ptM(x.id,i);const g=C.step[x.id],ef=C.eff[x.id],f=C.df[x.id]||{},dm=F&&!F.has(x.id)?' dim':'',cls=[ef,lateHeld(x.id)?'lchain':'',f.od?'late':'',critOn&&C.crit.has(x.id)?'crit':'',sel===x.id?'on':''].join(' ');const tip=`${esc(C.lbl[x.id])} ${esc(x.name)}${x.team?' ('+esc(x.team)+')':''}: ${LBL[ef]}${x.due?', expected '+fd(dn(x.due)):''}`;return (bar&&g>0?`<div class="xb ${ef}${dm}" data-id="${x.id}" title="${tip}" style="left:0;width:${Math.max(0,bx(g)-12*zf)}px;top:${cy(i)-4*zf}px"></div>`:'')+`<div class="xk ${cls}${dm}" data-id="${x.id}" title="${tip}${x.gate?`, pinned to ${gateTxt(g)}`:''}. Drag to move" style="left:${bx(g)-9*zf}px;top:${cy(i)-9*zf}px"></div>`};
 rows.forEach((it,i)=>{
  const y=i*RH;
  if(it.type==='exth'){BG+=`<div class="rbg exth" style="top:${y}px;height:${RH}px"></div>`;const xd=C.exts.filter(x=>C.done(x.id)).length;L+=`<div class="lr exth" data-tog="__ext" role="button" tabindex="0" aria-expanded="${!S.extCollapsed}" style="height:${RH}px;padding-left:4px"><span class="car" aria-hidden="true">${S.extCollapsed?'▸':'▾'}</span><span class="nm">External dependencies</span><span class="ow">${xd} of ${C.exts.length} delivered</span></div>`;if(S.extCollapsed)C.exts.filter(x=>!FV||FV.has(x.id)).forEach(x=>B+=xMark(x,i,false));return}
  BG+=`<div class="rbg ${it.type}" style="top:${y}px;height:${RH}px"></div>`;
  if(it.type==='msh'){
   const mr=C.mss.filter(m=>C.done(m.id)).length;
   L+=`<div class="lr msh" data-tog="__ms" role="button" tabindex="0" aria-expanded="${!S.msCollapsed}" style="height:${RH}px;padding-left:4px"><span class="car" aria-hidden="true">${S.msCollapsed?'▸':'▾'}</span><span class="nm">Milestones</span><span class="ow">${mr} of ${C.mss.length} reached</span></div>`;
   if(S.msCollapsed)C.mss.filter(m=>!FV||FV.has(m.id)).forEach(m=>B+=msMark(m,i));
   return;
  }
  const lvl=it.type==='obj'||it.type==='ms'||it.type==='ext'?0:it.type==='feat'?1:2,cd=esc(C.lbl[it.id]);
  const dim=(it.type==='task'||it.type==='ms'||it.type==='ext'?F&&!F.has(it.id):!grpIn(it))?' dim':'',on=sel===it.id?' on':'';
  const ef=C.eff[it.id],chn=(it.type==='task'||it.type==='ms'||it.type==='ext')&&held(it.id)?' chain':'';
  const relN=it.type==='task'?S.releases.find(r=>r.id===C.relOf[it.id])?.name:it.type==='feat'?S.releases.find(r=>r.id===it.rel)?.name:'';
  const icon=it.type==='task'?`<span class="dot ${ef}${lateHeld(it.id)?' lchain':''}${chn}" title="${LBL[ef]}${lateHeld(it.id)?', held up by overdue work':''}"></span>`:it.type==='ms'?`<span class="dia ${ef}${chn}" title="${LBL[ef]}"></span>`:it.type==='ext'?`<span class="xq ${ef}" title="${LBL[ef]}"></span>`:`<button class="car" data-tog="${it.id}" aria-expanded="${!it.collapsed}" aria-label="${it.collapsed?'Expand':'Collapse'} ${cd}">${it.collapsed?'▸':'▾'}</button>`;
  L+=`<div class="lr ${it.type}${on}${dim}" data-id="${it.id}" role="button" tabindex="0" style="height:${RH}px;padding-left:${(4+lvl*(W<600?10:18))*zf}px">${fcs(it)}${icon}<span class="cd${idk(it.id)}">${cd}</span>${it.key&&!(S.itemIds==='key'&&(it.type==='feat'||it.type==='task'))?`<span class="ky">${esc(it.key)}</span>`:''}<span class="nm">${esc(it.name)||'Untitled'}</span>${relN&&(it.type==='feat'||it.rel)?`<i class="rp" title="Release: ${esc(relN)}">${esc(relN)}</i>`:''}${it.type==='ext'&&!C.df[it.id]?.od&&C.df[it.id]?.their?'':latePill(it.id)}${it.type==='task'&&it.due&&it.status!=='done'&&!latePill(it.id)?`<span class="du" title="Due">${fd(dn(it.due))}</span>`:''}${it.type==='ext'?`${it.team?`<i class="rp" title="External team">${esc(it.team)}</i>`:''}<span class="ow">${LBL[ef]}</span>`:it.type==='ms'?(it.target?`<span class="ow">${esc(it.target)}</span>`:''):it.owner?`<span class="ow">${esc(it.owner)}</span>`:''}</div>`;
  if(it.type==='task'){
   const s=C.step[it.id],h=Math.round(RH-14*zf);occ[i]=[bx(s-1)+P,bx(s)-P];pt[it.id]={l:bx(s-1)+P,r:bx(s)-P,y:cy(i),h,row:i};const ext=rx&&F&&F.has(it.id)&&!rx.ids.has(it.id)?'ext':'';
   const df=C.df[it.id]||{},cls=[ef,lateHeld(it.id)?'lchain':'',chn,C.warn[it.id]?'warn':'',df.ls?'lstart':'',df.od?'over':df.rk?'risk':'',critOn&&C.crit.has(it.id)?'crit':'',ext,on,dim].join(' ');
   B+=`<div class="b ${cls}" data-id="${it.id}" title="${cd} ${esc(it.name)}: ${LBL[ef]}${relN?', '+esc(relN):''}${C.warn[it.id]?'. Status breaks a link':''}${dateTip(it.id)}" style="${fcol(it)?`--fc:inset 0 4px 0 ${fcol(it)};`:''}left:${bx(s-1)+P}px;top:${y+7*zf}px;width:${CW-2*P}px;height:${h}px;line-height:${h-3}px"><span class="cd">${cd}</span>${esc(it.name)}</div>`;
  }else if(it.type==='ext'){
   B+=xMark(it,i,true)+dueTag(it,i,bx(C.step[it.id])+16*zf);occ[i]=[0,bx(C.step[it.id])+150*zf];
  }else if(it.type==='ms'){
   B+=msMark(it,i)+dueTag(it,i,bx(C.step[it.id])+16*zf);
   const g=C.step[it.id];occ[i]=[bx(g)-10*zf,bx(g)+(it.due?110:10)*zf];G+=`<line class="g ${ef}${chn}${dim}" x1="${bx(g)}" y1="${cy(i)+D}" x2="${bx(g)}" y2="${H}"/>`;
  }else{
   const ts=tasksUnder(it);if(!ts.length)return;
   const ss=ts.map(t=>C.step[t.id]),a=Math.min(...ss),z=Math.max(...ss),d=ts.filter(t=>t.status==='done').length,h=Math.round(RH-20*zf);occ[i]=[bx(a-1)+P/2,bx(z)-P/2];
   const oc=it.type==='obj'?objCount(it):null;
   B+=`<div class="sp ${it.type}${on}${dim}" data-id="${it.id}" title="${cd} spans steps ${a} to ${z}" style="${it.type==='feat'&&fcol(it)?`background:color-mix(in srgb,${fcol(it)} 30%,var(--bg));box-shadow:inset 6px 0 0 ${fcol(it)};`:''}left:${bx(a-1)+P/2}px;top:${y+10*zf}px;width:${Math.max(24*zf,bx(z)-bx(a-1)-P)}px;height:${h}px;line-height:${h}px">${oc?`${oc.d} of ${oc.n} ${oc.n===1?'feature':'features'} done`:`${d} of ${ts.length} done`}</div>`;
  }
 });
  const port=(id,side,row,tgt)=>{const n=map[id],y=cy(row);if(n.type==='ms'||n.type==='ext')return {x:bx(C.step[id]),y,v:true};if(n.type==='feat'){const ss=tasksUnder(n).map(t=>C.step[t.id]),a=Math.min(...ss),z=Math.max(...ss);return side==='S'?{x:bx(a-1)+P/2,y,d:tgt?1:-1}:{x:bx(z)-P/2,y,d:tgt?-1:1}}const s=C.step[id];return side==='S'?{x:bx(s-1)+P,y,d:tgt?1:-1}:{x:bx(s)-P,y,d:tgt?-1:1}};
 const seen=new Set(),cnt={};
 const inF=id=>!F||F.has(id)||(map[id]?.type==='feat'&&tasksUnder(map[id]).some(t=>F.has(t.id)));
 for(const n of [...C.mss,...C.exts,...C.order,...C.feats])for(const l of C.own(n)){
  if(n.type==='feat'&&!tasksUnder(n).length)continue;
  if(FV&&(!FV.has(l.id)||!FV.has(n.id)))continue;
  const ra=anc(l.id),rb=anc(n.id);if(ra<0||rb<0||ra===rb)continue;
  const k=ra+'.'+C.step[l.id]+'.'+rb+'.'+C.step[n.id]+'.'+l.type;if(seen.has(k))continue;seen.add(k);
  const a=port(l.id,l.type[0],ra,false),b=port(n.id,l.type[1],rb,true),pk=Math.round(b.x)+':'+(b.d||0),m=cnt[pk]=(cnt[pk]||0)+1;
  const [pa,pts]=poly(route(a,b,((m-1)%5)*2,RH,D));
  const bk=l.st==='blocked'||(!C.sat(l)&&C.eff[l.id]==='blocked'),sat=!bk&&C.sat(l),ov=!bk&&!sat&&!!C.df[l.id]?.od;
  const dim=F&&!(inF(l.id)&&inF(n.id))?' dim':'',cls=`${l.type}${bk?' bk':''}${sat?' sat':''}${ov?' ovd':''}${dim}`;
  const tip=`${C.lbl[l.id]} → ${C.lbl[n.id]}: ${TYPES[l.type]}${l.lag?`, lag ${lagTxt(l)}`:''}, ${linkState(l)}${ov?`, ${C.lbl[l.id]} is overdue`:''}`;
  if(critOn&&(n.type==='feat'?tasksUnder(n).some(t=>C.critE.has(l.id+'>'+t.id)):C.critE.has(l.id+'>'+n.id)))E=`<path class="e u${dim}" d="${pa}"/>`+E;
  E+=`<path class="e ${cls}" d="${pa}" marker-end="url(#m${bk?'bk':sat?'ok':ov?'ovd':l.type})"><title>${esc(tip)}</title></path>`;
  if(tagsOn){const tx=l.st==='blocked'?tag(l):l.type+lagTxt(l),w=(tx.length*8+10)*zf,[x0,y]=tagAt(pts,w,RH,kinds,free),x=Math.max(w/2+3-X0,x0);T+=`<span class="tp lk ${cls}" data-lk="${n.id}" data-from="${l.id}" title="${esc(tip)}" style="left:${x}px;top:${y}px">${esc(tx)}</span>`}
 }
 const cols=vs.map((k,ci)=>{const gp=ci>0&&vs[ci-1]!==k-1;if(gp)BG+=`<div class="gapl" style="left:${ci*CW-1}px;height:${H}px"></div>`;return `<div class="ch${gp?' gap':''}" style="width:${CW}px"${gp?` title="${k-vs[ci-1]-1===1?'Step '+(k-1)+' is':'Steps '+(vs[ci-1]+1)+' to '+(k-1)+' are'} hidden by the filter"`:''}><b>Step ${k}</b><span>${per[k]} ${per[k]===1?'task':'tasks'}${lateS[k]?` · <span class="ltc">${lateS[k]} late</span>`:''}</span>${flags[k]?`<em title="Last task of ${esc(flags[k].join(', '))} lands here">${esc(flags[k].join(', '))}</em>`:''}</div>`}).join('');
 geo={LW,X0,CW,H,N,HH,vs,RH,pt};
 grid.style.width=LW+X0+NC*CW+([...C.mss,...C.exts].some(n=>C.step[n.id]>=vs[vs.length-1])?120:28)*zf+'px';grid.style.setProperty('--z',zf);
 const otl=grid.querySelector('.tlb'),tsl=otl?otl.scrollLeft:null,tst=otl?otl.scrollTop:null;
 grid.innerHTML=`<div class="hdr" style="height:${HH}px"><div class="corner" style="width:${LW}px">Work breakdown</div><div style="flex:none;width:${X0}px"></div>${cols}</div>${TL.html}<div class="labels" style="width:${LW}px;min-height:${H}px">${L||(FV?'<p class="none" style="padding:10px 12px">Nothing matches the filter. <button class="lnk2" data-fp="all">Show all</button></p>':'<p class="none" style="padding:10px 12px">Add an objective to start.</p>')}</div><div class="chart" style="left:${LW+X0}px;top:${HH+TL.h}px;width:${NC*CW+1}px;height:${H}px;background-size:${CW}px 100%">${BG}<svg class="edges" width="${NC*CW}" height="${H}" aria-hidden="true">${DEFS}${G}${E}</svg>${B}${T}</div>`;
 {const te=grid.querySelector('.tl'),ch=grid.querySelector('.chart');if(te&&ch&&te.offsetHeight)ch.style.top=(HH+te.offsetHeight)+'px'}
 const ntl=grid.querySelector('.tlb');if(ntl){if(tsl!==null&&!tlReset){ntl.scrollLeft=tsl;ntl.scrollTop=tst}else ntl.scrollLeft=Math.max(0,TL.tx-LW-(W-LW)/2);tlReset=false}
}

const latePill=id=>{const f=C.df[id];if(!f)return '';return f.od?`<i class="lt" title="Overdue by ${days(f.od)}">Overdue ${f.od}d</i>`:f.ls?`<i class="lt" title="Its step started ${days(f.ls)} ago and it has not">Late start ${f.ls}d</i>`:f.rk?`<i class="lt rk" title="${f.their?'The external team says this is at risk':esc(rkTxt(f).replace(/<[^>]+>/g,''))}">At risk</i>`:''};
const dateTip=id=>{const f=C.df[id]||{};return (f.od?`. Overdue ${days(f.od)}`:'')+(f.ls?`. Late start ${days(f.ls)}`:'')+(f.rk&&!f.their?`. At risk: ${rkTxt(f)}`:'')};
function taskDates(it){
 const f=C.df[it.id]||{},l=[];
 if(f.od)l.push(`<b class="ltc">Overdue by ${days(f.od)}</b>: due ${fd(f.due)}.`);
 if(f.ls)l.push(`<b class="ltc">Late start:</b> should have started by ${fd(f.sb)}, ${days(f.ls)} ago.`);
 if(f.rk)l.push(`<b class="ltc">At risk:</b> ${rkTxt(f)}.`);
 if(f.sl)l.push(`Started ${days(f.sl)} after its start-by date.`);
 if(f.fl)l.push(`Finished ${days(f.fl)} after its due date.`);
 return `<h3>Dates</h3>${l.length?`<p class="dsay" style="margin:0 0 4px">${l.join('<br>')}</p>`:''}
 <div class="two"><label class="f">Start by<input id="f-startBy" data-f="startBy" type="date" value="${esc(it.startBy)}"></label><label class="f">Due<input id="f-due" data-f="due" type="date" value="${esc(it.due)}"></label></div>
 <div class="two"><label class="f">Started<input id="f-startedOn" data-f="startedOn" type="date" value="${esc(it.startedOn)}"></label><label class="f">Done<input id="f-doneOn" data-f="doneOn" type="date" value="${esc(it.doneOn)}"></label></div><p class="none" style="margin-top:4px">Started and done fill in when you change the status.</p>`;
}
function msDates(it){
 const f=C.df[it.id]||{},l=[];
 if(f.od)l.push(`<b class="ltc">Overdue by ${days(f.od)}</b>.`);
 if(f.rk)l.push(`<b class="ltc">At risk:</b> ${rkTxt(f)}.`);
 return `<label class="f">Due date<input id="f-due" data-f="due" type="date" value="${esc(it.due)}"></label>${l.length?`<p class="dsay">${l.join('<br>')}</p>`:''}`;
}
function calForm(){
 const k=S.itemIds==='key';
 return `<div class="dh"><span>Plan settings</span><button class="x" data-act="close" aria-label="Close editor">×</button></div>
 <p class="dsay" style="margin-top:0">Late starts, overdue work and risks are worked out as of the status date.</p>
 <label class="f">Status date<input id="c-asof" data-cf="asof" type="date" value="${esc(S.cal.asof)}"></label><p class="none" style="margin-top:4px">Leave it blank to use today, ${fd(dn(todayIso()))}.</p>
 <label class="f">Item IDs<select id="c-ids" data-pf="itemIds"><option value="outline"${k?'':' selected'}>Outline numbers (1.2.3)</option><option value="key"${k?' selected':''}>Ticket keys (UDM-123)</option></select></label><p class="none" style="margin-top:4px">With ticket keys, features and tasks show their ticket key in place of the outline number. Ones without a key keep their number. Objectives, milestones and external items always keep theirs.</p>`;
}
function openCal(k){sel=null;selRel=null;calOpen=true;calStep=k||null;render();if(k){const el=document.getElementById('srow-'+k);if(el)el.scrollIntoView({block:'nearest'})}}
const icon=d=>map[d].type==='feat'||map[d].type==='obj'?'':map[d].type==='ext'?`<span class="xq ${C.eff[d]}"></span>`:map[d].type==='ms'?`<span class="dia ${C.eff[d]}"></span>`:`<span class="dot ${C.eff[d]}"></span>`;
const nameOf=d=>`${esc(C.lbl[d])} ${esc(map[d].name)}`;
const fchip=f=>`<span class="chip">${map[f].type==='ms'||map[f].type==='ext'?icon(f):''}<button class="lnk" data-go="${f}">${nameOf(f)}</button></span>`;
const relOpts=(cur,first)=>first+S.releases.map(r=>`<option value="${r.id}"${cur===r.id?' selected':''}>${esc(r.name)||'Untitled release'}</option>`).join('');
function sayLink(n,l){
 const me=esc(C.lbl[n.id]),it=esc(C.lbl[l.id]),lg=l.lag?`, ${l.lag>0?'plus':'minus'} ${Math.abs(l.lag)} ${Math.abs(l.lag)===1?'step':'steps'}`:'',pv=C.isX(l.id)?'is delivered':l.type[0]==='S'?'has started':'finishes';
 if(n.type==='ms')return `${me} is reached only after ${it} ${pv}${lg}.`;
 if(n.type==='ext')return `${me} can be delivered only after ${it} ${pv}${lg}.`;
 const v=l.type[1]==='S'?'starts'+(l.type[0]==='S'&&!C.isX(l.id)?' once':' after'):'can finish only '+(l.type[0]==='S'&&!C.isX(l.id)?'once':'after');
 return `${n.type==='feat'?'Every task in '+me:me} ${v} ${it} ${pv}${lg}.`;
}
function depCard(n,l){
 const s=linkState(l),bk=l.st==='blocked';
 return `<div class="dep ${l.type}${bk?' bk':''}" id="dep-${l.id}"><div class="dtop">${icon(l.id)}<button class="lnk" data-go="${l.id}">${nameOf(l.id)}</button><i class="tp ${l.type}${bk?' bk':''}">${esc(l.type+lagTxt(l))}</i><span class="dst ${s.toLowerCase()}">${s}</span><button class="rm" data-rmdep="${l.id}" aria-label="Remove link to ${esc(C.lbl[l.id])}">×</button></div>
 <div class="drow"><label>Type<select id="lt-${l.id}" data-lk="${l.id}" data-lf="type">${Object.entries(TYPES).map(([k,v])=>`<option value="${k}"${l.type===k?' selected':''}>${k}: ${v}</option>`).join('')}</select></label><label>Lag<input id="lg-${l.id}" data-lk="${l.id}" data-lf="lag" type="number" min="-9" max="9" step="1" inputmode="numeric" value="${l.lag}"></label><label>Link status<select id="ls-${l.id}" data-lk="${l.id}" data-lf="st"><option value="auto"${bk?'':' selected'}>Automatic</option><option value="blocked"${bk?' selected':''}>Blocked</option></select></label></div>
 <p class="dsay">${sayLink(n,l)}</p>
 <label class="dnote" style="display:block;font-size:13px;font-weight:600">Note<input id="ln-${l.id}" data-lk="${l.id}" data-lf="note" value="${esc(l.note)}" placeholder="${bk?'What is blocking this handoff?':'Handoff details, ticket link'}"></label></div>`;
}
function pickList(it){
 const base=it.type==='feat'?tasksUnder(it).map(t=>t.id):[it.id],bs=new Set(base),down=downOf(base),ql=q.trim().toLowerCase();
 const list=[...C.mss,...C.exts,...C.order].filter(t=>t.id!==it.id&&!bs.has(t.id)&&(!ql||(C.lbl[t.id]+' '+C.code[t.id]+' '+t.name).toLowerCase().includes(ql)));
 if(!list.length)return '<p class="none" style="padding:8px 10px">Nothing matches.</p>';
 return list.map(t=>{const loop=down.has(t.id);return `<label class="pk${loop?' off':''}"><input type="checkbox" data-dep="${t.id}"${it.deps.some(l=>l.id===t.id)?' checked':''}${loop?' disabled':''}><span class="cd">${esc(C.lbl[t.id])}</span><span class="nm">${esc(t.name)}</span>${loop?'<em>would loop</em>':''}</label>`}).join('');
}
function depBlock(it,title){
 const ls=C.own(it),inh=it.type==='task'?C.links(it).filter(l=>!it.deps.includes(l)):[],out=C.succL[it.id]||[];
 return `<h3>${title} <span>${ls.length}</span></h3><div class="chips">${ls.map(l=>depCard(it,l)).join('')||(inh.length?'':'<p class="none">No dependencies.</p>')}</div>${inh.length?`<p class="none" style="margin-top:8px">From feature ${esc(C.lbl[it.parent])} (edit there):</p><div class="chips">${inh.map(l=>`<span class="chip">${icon(l.id)}<button class="lnk" data-go="${l.id}">${nameOf(l.id)}</button><i class="tp ${l.type}${l.st==='blocked'?' bk':''}">${esc(tag(l))}</i></span>`).join('')}</div>`:''}
 <label class="f">Add or remove links<input id="f-q" type="search" placeholder="Search tasks, milestones, external" value="${esc(q)}" autocomplete="off"></label><div id="pick" class="pick">${pickList(it)}</div><p class="none" style="margin-top:4px">New links start as FS. Change the type above.</p>
 ${it.type==='feat'?'':`<h3>Unlocks <span>${out.length}</span></h3>`}<div class="chips">${it.type==='feat'?'':out.map(({n,l})=>`<span class="chip">${icon(n.id)}<button class="lnk" data-go="${n.id}">${nameOf(n.id)}</button><i class="tp ${l.type}${l.st==='blocked'?' bk':''}" title="${TYPES[l.type]}">${esc(tag(l))}</i></span>`).join('')||(it.type==='feat'?'':'<p class="none">Nothing waits on this yet.</p>')}</div>`;
}
const heldBy=id=>[...upOf([id])].filter(d=>C.eff[d]==='blocked');
const heldTxt=list=>list.length?`<br>Held up by: ${list.map(d=>`<button class="lnk" style="display:inline;padding:0;color:var(--red)" data-go="${d}">${nameOf(d)}</button>`).join(', ')}`:'';
function renderDrawer(){
 const it=sel&&map[sel],rx=selRel&&C.rel.find(x=>x.r.id===selRel);
 if(!it&&!rx&&!calOpen){dr.classList.remove('open');dr.innerHTML='';return}
 const sc=dr.scrollTop,act=document.activeElement?.id;
 let h='';
 if(calOpen)h=calForm();
 else if(rx){
  const r=rx.r,pct=rx.ts.length?Math.round(rx.done/rx.ts.length*100):0;
  h=`<div class="dh"><span>Release</span><button class="x" data-act="close" aria-label="Close editor">×</button></div>
  <label class="f">Name<input id="f-name" data-rf="name" value="${esc(r.name)}"></label>
  <div class="two"><label class="f">Target<input id="f-target" data-rf="target" value="${esc(r.target)}" placeholder="e.g. end of PI or a date"></label><label class="f">Status<select id="f-rstatus" data-rf="status">${Object.entries(RST).map(([v,l])=>`<option value="${v}"${r.status===v?' selected':''}>${l}</option>`).join('')}</select></label></div>
  <label class="f">Due date<input id="f-rdue" data-rf="due" type="date" value="${esc(r.due)}"></label>${relSay(rx)}
  <div class="info${rx.blk?' blocked':''}"><b>${rx.done} of ${rx.ts.length} tasks done (${pct}%)</b>${rx.land?`. Last task lands after step ${rx.land}.`:''}${rx.blk?`<br>${rx.blk} blocked or held up by a blocker.`:''}${rx.up.length?`<br>${rx.up.length} unfinished ${rx.up.length===1?'task':'tasks'} outside this release must finish first. They are outlined on the board.`:''}</div>
  <h3>Features <span>${rx.feats.length}</span></h3><div class="chips">${rx.feats.map(fchip).join('')||'<p class="none">Assign a feature from its editor.</p>'}</div>
  <h3>Tasks <span>${rx.ts.length}</span></h3><div class="chips">${rx.ts.map(t=>fchip(t.id).replace('<span class="chip">',`<span class="chip">${icon(t.id)}`)).join('')||'<p class="none">No tasks yet.</p>'}</div>
  <h3>Needed from outside <span>${rx.up.length}</span></h3><div class="chips">${rx.up.map(d=>fchip(d).replace('<span class="chip">',`<span class="chip">${icon(d)}`)).join('')||'<p class="none">This release depends only on its own work.</p>'}</div>${rx.xt.length?`<h3>Waiting on external teams <span>${rx.xt.length}</span></h3><div class="chips">${rx.xt.map(fchip).join('')}</div>`:''}
  <label class="f">Notes<textarea id="f-notes" data-rf="notes" placeholder="Scope, release criteria, links">${esc(r.notes)}</textarea></label>
  <div class="acts"><button class="btn" data-act="del-rel">Delete release</button></div>`;
 }else{
  const kind=KIND[it.type];
  h=`<div class="dh"><span>${kind} ${esc(C.lbl[it.id]||'')}</span><button class="x" data-act="close" aria-label="Close editor">×</button></div>
  <label class="f">Name<input id="f-name" data-f="name" value="${esc(it.name)}"></label>
  ${['task','feat','obj'].includes(it.type)?`<label class="f">Ticket key<input id="f-key" data-f="key" value="${esc(it.key||'')}" placeholder="e.g. UDM-1031"></label>`:''}
  <label class="f">${it.type==='ext'?'Contact':'Owner'}<input id="f-owner" data-f="owner" value="${esc(it.owner)}" placeholder="${it.type==='ext'?'Who to ask on their side':'Unassigned'}"></label>`;
  if(it.type==='task'){
   const s=C.step[it.id],ef=C.eff[it.id],ls=C.links(it);
   const sw=ls.filter(l=>l.type[1]==='S'&&!C.sat(l)),fw=ls.filter(l=>l.type[1]==='F'&&!C.sat(l)),bl=ls.filter(l=>l.st==='blocked');
   const feats=S.items.filter(f=>f.type==='feat'&&C.lbl[f.id]).map(f=>`<option value="${f.id}"${f.id===it.parent?' selected':''}>${esc(C.lbl[f.id])} ${esc(f.name)}</option>`).join('');
   const frn=S.releases.find(r=>r.id===map[it.parent]?.rel)?.name;
   const w=C.warn[it.id]||[];
   h+=`<div class="info ${ef}"><b>Step ${s} of ${C.N}</b>. ${LBL[ef]}${ef==='blocked'&&it.blocker.trim()?`: ${esc(it.blocker)}`:''}${bl.length?`<br>Blocked link${bl.length>1?'s':''}: ${bl.map(l=>`${esc(C.lbl[l.id])}${l.note?` (${esc(l.note)})`:''}`).join(', ')}`:''}${sw.length&&it.status!=='done'?`<br>Can't start until: ${sw.map(l=>esc(C.lbl[l.id])+' '+(C.isX(l.id)?'is delivered':l.type[0]==='S'?'starts':'finishes')).join(', ')}`:''}${fw.length&&it.status!=='done'?`<br>Can't finish until: ${fw.map(l=>esc(C.lbl[l.id])+' '+(C.isX(l.id)?'is delivered':l.type[0]==='S'?'starts':'finishes')).join(', ')}`:''}${ef==='done'?'':heldTxt(heldBy(it.id))+lateTxt(it.id)}${C.crit.has(it.id)?'<br>On the critical path.':''}</div>
   ${moveRow(it)}
   ${w.length?`<div class="warnbox">Status breaks ${w.length===1?'a link':w.length+' links'}: ${w.map(l=>`this is ${l.type[1]==='S'?'started':'done'} but ${esc(C.lbl[l.id])} has not ${l.type[0]==='S'?'started':'finished'} (${l.type})`).join('; ')}.</div>`:''}
   <label class="f">Status<select id="f-status" data-f="status">${[['todo','Not started'],['doing','In progress'],['done','Done'],['blocked','Blocked']].map(([v,l])=>`<option value="${v}"${it.status===v?' selected':''}>${l}</option>`).join('')}</select></label>
   <label class="f">External blocker<input id="f-blocker" data-f="blocker" value="${esc(it.blocker)}" placeholder="Something outside this plan"></label>
   <label class="f">Feature<select id="f-parent" data-f="parent">${feats}</select></label>
   <div class="two"><label class="f">Release<select id="f-rel" data-f="rel">${relOpts(it.rel,`<option value="">Same as feature (${frn?esc(frn):'none'})</option><option value="-"${it.rel==='-'?' selected':''}>No release</option>`)}</select></label><label class="f">Pinned to step<input id="f-earliest" data-f="earliest" type="number" min="1" inputmode="numeric" value="${it.earliest||''}" placeholder="Auto"></label></div>${taskDates(it)}`+depBlock(it,'Depends on');
  }else if(it.type==='ms'){
   const ls=C.links(it),dd=ls.filter(C.sat).length,ef=C.eff[it.id];
   h+=`<div class="info${held(it.id)?' blocked':''}"><b>Gate after step ${C.step[it.id]}</b>. ${ef==='reached'?(it.status==='done'?'Marked as reached':'Reached: every link is satisfied'):ls.length?`Open: ${dd} of ${ls.length} links satisfied`:'Open: add what it requires, or mark it reached'}.${ef==='reached'?'':heldTxt(heldBy(it.id))+lateTxt(it.id)}${C.crit.has(it.id)?'<br>On the critical path.':''}</div>
   ${gateRow(it)}
   <div class="two"><label class="f">Target<input id="f-target" data-f="target" value="${esc(it.target)}" placeholder="e.g. sprint 3 or a date"></label><label class="f">Reached<select id="f-status" data-f="status"><option value="todo"${it.status!=='done'?' selected':''}>When links are met</option><option value="done"${it.status==='done'?' selected':''}>Mark as reached</option></select></label></div>${msDates(it)}`+depBlock(it,'Requires');
  }else if(it.type==='ext'){
   const ef=C.eff[it.id],f=C.df[it.id]||{},g=C.step[it.id],out=C.succ[it.id]||[];
   h+=`<div class="info${ef==='blocked'?' blocked':''}"><b>${LBL[ef]}</b>${it.due?`. Expected ${fd(dn(it.due))}`:''}.${ef!=='delivered'?`<br>${out.length} ${out.length===1?'item waits':'items wait'} on this until it is delivered.`:''}${f.od?`<br><b class="ltc">Overdue by ${days(f.od)}</b>.`:''}${f.rk&&!f.their?`<br><b class="ltc">At risk:</b> ${rkTxt(f)}.`:''}${ef==='delivered'?'':heldTxt(heldBy(it.id))+lateTxt(it.id)}${C.crit.has(it.id)?'<br>On the critical path.':''}</div>
   ${gateRow(it)}
   <label class="f">Team<input id="f-team" data-f="team" value="${esc(it.team)}" placeholder="e.g. Platform team"></label>
   <div class="two"><label class="f">Status<select id="f-status" data-f="status">${XS.map(([v,l])=>`<option value="${v}"${it.status===v?' selected':''}>${l}</option>`).join('')}</select></label><label class="f">Expected date<input id="f-due" data-f="due" type="date" value="${esc(it.due)}"></label></div>
   <div class="two"><label class="f">Their ticket or link<input id="f-ref" data-f="ref" value="${esc(it.ref)}" placeholder="e.g. PLAT-412"></label><label class="f">Delivered on<input id="f-doneOn" data-f="doneOn" type="date" value="${esc(it.doneOn)}"></label></div>`+depBlock(it,'Needs from us first');
  }else if(it.type==='feat'){
   const ts=tasksUnder(it),ss=ts.map(t=>C.step[t.id]),own=new Set(ts.map(t=>t.id));
   const waits=[...new Set(ts.flatMap(t=>ids(t)).filter(d=>!own.has(d)).map(d=>C.isP(d)?d:map[d].parent))];
   const feeds=[...new Set(ts.flatMap(t=>C.succ[t.id]||[]).filter(d=>!own.has(d)).map(d=>C.isP(d)?d:map[d].parent))];
   const over=ts.filter(t=>t.rel).length;
   h+=`<label class="f">Release<select id="f-rel" data-f="rel">${relOpts(it.rel,'<option value="">No release</option>')}</select></label><div class="f">Color<div class="sws" role="group" aria-label="Feature color">${PAL.map(c=>`<button class="sw2${it.color===c?' on':''}" data-col="${c}" style="background:${c}" aria-label="Color ${c}" aria-pressed="${it.color===c}"></button>`).join('')}<label class="sw2 cust${it.color&&!PAL.includes(it.color)?' on':''}" title="Pick any color"><input type="color" id="f-color" data-f="color" value="${okc(it.color)||'#2f6fdb'}" aria-label="Custom color"></label><button class="sw2${it.color?'':' on'}" data-col="" aria-label="No color" aria-pressed="${!it.color}">×</button></div></div>${over?`<p class="none" style="margin-top:6px">${over} ${over===1?'task sets':'tasks set'} its own release.</p>`:''}
   <div class="info"><b>${ts.length} ${ts.length===1?'task':'tasks'}</b>${ts.length?`, steps ${Math.min(...ss)} to ${Math.max(...ss)}, ${ts.filter(t=>t.status==='done').length} done`:''}</div>
   ${depBlock(it,'Feature depends on')}<p class="none" style="margin-top:4px">Every task in this feature waits on these links.</p>
   <h3>Waits on, all tasks <span>${waits.length}</span></h3><div class="chips">${waits.map(fchip).join('')||'<p class="none">No outside dependencies.</p>'}</div>
   <h3>Feeds <span>${feeds.length}</span></h3><div class="chips">${feeds.map(fchip).join('')||'<p class="none">Nothing outside this feature waits on it.</p>'}</div>
   <div class="acts" style="border:0;margin-top:14px;padding:0"><button class="btn pri" data-act="add-task">Add task</button></div>`;
  }else{
   const fs=(kids[it.id]||[]).filter(f=>f.type==='feat'),ts=tasksUnder(it);
   const fdn=fs.filter(featDone).length,fl=fs.filter(featLate).length,frk=fs.filter(featRisk).length;
   h+=`<div class="info"><b>${fdn} of ${fs.length} ${fs.length===1?'feature':'features'} done</b>${fl?`<br><span class="ltc">${fl} ${fl===1?'feature has':'features have'} late work</span>`:''}${frk?`<br><span class="ltc">${frk} ${frk===1?'feature is':'features are'} at risk</span>`:''}</div>
   <h3>Features <span>${fs.length}</span></h3><div class="chips">${fs.map(f=>`<span class="chip"><span class="dot ${featDone(f)?'done':featLate(f)?'blocked':tasksUnder(f).some(t=>t.status==='doing'||t.status==='done')?'doing':''}" style="margin:0 4px 0 10px"></span><button class="lnk" data-go="${f.id}">${nameOf(f.id)}</button><span class="none" style="white-space:nowrap">${tasksUnder(f).filter(t=>t.status==='done').length}/${tasksUnder(f).length} tasks</span></span>`).join('')||'<p class="none">No features yet.</p>'}</div>
   <div class="acts" style="border:0;margin-top:14px;padding:0"><button class="btn pri" data-act="add-feat">Add feature</button></div>`;
  }
  h+=`<label class="f">Notes<textarea id="f-notes" data-f="notes" placeholder="Acceptance criteria, links, ticket numbers">${esc(it.notes)}</textarea></label>
  <details class="ih" data-ih="${it.id}"><summary>Change history</summary><div class="ihl"><p class="none">Loading…</p></div></details>
  <div class="acts"><button class="btn" data-act="up">Move up</button><button class="btn" data-act="down">Move down</button><button class="btn" data-act="del">Delete ${kind.toLowerCase()}</button></div>`;
 }
 dr.innerHTML=h;dr.classList.add('open');dr.scrollTop=sc;
 if(act){const el=document.getElementById(act);if(el&&dr.contains(el))el.focus()}
}
function render(){if(sel||selRel)calOpen=false;if((sel||selRel||calOpen)&&histOpen){histOpen=false;renderHist()}S.view=view;recalc();renderStats();renderRailRels();renderView();renderDrawer();save()}
function soft(){clearTimeout(tm);tm=setTimeout(()=>{recalc();renderStats();renderRailRels();renderView();save()},180)}

function moveRow(it){const s=C.step[it.id],mn=C.minOf(it.id),pin=it.earliest&&it.earliest>mn;
 return `<div class="acts" style="border:0;margin-top:8px;padding:0;align-items:center"><button class="btn" data-act="mvl"${s<=mn?' disabled':''}>Earlier step</button><button class="btn" data-act="mvr">Later step</button>${pin?'<button class="btn" data-act="unpin">Unpin</button>':''}<span class="none">${pin?`Pinned. Its links allow step ${mn}.`:s<=mn&&mn>1?`Earliest its links allow: step ${mn}.`:'Or drag its bar on the board.'}</span></div>`}
const gateTxt=g=>g>0?'the gate after step '+g:'the gate before step 1',allowTxt=mn=>mn>0?'Its links allow '+gateTxt(mn):'Without the pin it would sit at the start';
function gateRow(it){const g=C.step[it.id],mn=C.minOf(it.id),p=it.gate;
 return `<div class="acts" style="border:0;margin-top:8px;padding:0;align-items:center"><button class="btn" data-act="mvl"${g<=mn?' disabled':''}>Earlier gate</button><button class="btn" data-act="mvr">Later gate</button>${p?'<button class="btn" data-act="unpin">Reset to auto</button>':''}<span class="none">${p?(p>=mn?`Pinned to ${gateTxt(p)}. ${allowTxt(mn)}.`:`Pinned to ${gateTxt(p)}, but its links push it to ${gateTxt(mn)}.`):`At ${gateTxt(g)}, the earliest its links allow. Drag its marker on the map to pin it.`}</span></div>`}
function toast(m){const t=$('#toast');t.textContent=m;t.hidden=false;clearTimeout(toastT);toastT=setTimeout(()=>{t.hidden=true},4200)}
function moveTo(id,tgt){
 const t=map[id];if(!t||t.type!=='task')return;const mn=C.minOf(id);
 if(tgt<mn){toast(`${C.lbl[id]} can't move before step ${mn}: ${C.whyMin(id)}.`);render();return}
 if(tgt===C.step[id]&&(t.earliest||0)===(tgt>mn?tgt:0)){render();return}
 mut(()=>{t.earliest=tgt>mn?tgt:null});
 toast(tgt>mn?`${C.lbl[id]} pinned to step ${tgt}. Its links allow step ${mn}.`:`${C.lbl[id]} moved to step ${tgt}, the earliest its links allow.`);
}
function moveGate(id,tgt){
 const n=map[id];if(!n||!C.isP(id))return;const mn=C.minOf(id),g=Math.max(tgt,mn),pin=g>mn?g:null;
 if(tgt===C.step[id]&&(n.gate||null)===pin){render();return}
 if((n.gate||null)!==pin)mut(()=>{n.gate=pin});else render();
 toast(tgt<mn?`${C.lbl[id]} snapped to ${gateTxt(mn)}, the earliest its links allow: ${C.whyMin(id)}.`:pin?`${C.lbl[id]} pinned to ${gateTxt(g)}. ${allowTxt(mn)}.`:`${C.lbl[id]} moved to ${gateTxt(g)}, the earliest its links allow.`);
}
function addItem(type,parent){
 const it=mk(nid(),type,parent||null,{obj:'New objective',feat:'New feature',task:'New task',ms:'New milestone',ext:'New external dependency'}[type]);
 if(type==='ext')it.status='pending';
 if(view==='rel')view='map';
 mut(()=>{S.items.push(it);if(parent)map[parent].collapsed=false;if(type==='ms')S.msCollapsed=false;if(type==='ext')S.extCollapsed=false;sel=it.id;selRel=null;q=''});
 const n=$('#f-name');if(n){n.focus();n.select()}
 reveal(it.id);
}
function addRel(){const r={id:nid(),name:'R'+(S.releases.length+1),target:'',status:'planned',notes:''};view='rel';relPage=r.id;mut(()=>{S.releases.push(r);selRel=r.id;sel=null});const n=$('#f-name');if(n){n.focus();n.select()}}
function del(id){
 const gone=new Set([id]);let ch=true;
 while(ch){ch=false;for(const i of S.items)if(i.parent&&gone.has(i.parent)&&!gone.has(i.id)){gone.add(i.id);ch=true}}
 mut(()=>{S.items=S.items.filter(i=>!gone.has(i.id));S.items.forEach(i=>i.deps=i.deps.filter(l=>!gone.has(l.id)));sel=null});
}
function move(id,dir){
 const it=map[id],sib=S.items.filter(i=>i.parent===it.parent&&i.type===it.type),o=sib[sib.indexOf(it)+dir];if(!o)return;
 mut(()=>{const a=S.items.indexOf(it),b=S.items.indexOf(o);S.items[a]=o;S.items[b]=it});
}
function go(id,from){
 const n=map[id];if(!n)return;if(n.type==='ms')S.msCollapsed=false;if(n.type==='ext')S.extCollapsed=false;let p=n;while(p&&(p=map[p.parent]))p.collapsed=false;
 sel=id;selRel=null;q='';render();reveal(id);
 if(from){const el=document.getElementById('dep-'+from);if(el){el.scrollIntoView({block:'center'});el.classList.add('flash')}}
}
function reveal(id){const el=grid.querySelector(`.b[data-id="${id}"],.mk[data-id="${id}"],.xk[data-id="${id}"]`)||grid.querySelector(`.lr[data-id="${id}"]`);if(el)el.scrollIntoView({block:'nearest',inline:'nearest'})}
function arm(b,label,fn){
 if(b.dataset.armed){delete b.dataset.armed;b.textContent=b.dataset.l;fn();return}
 b.dataset.l=b.textContent;b.dataset.armed='1';b.textContent=label;
 setTimeout(()=>{if(b.isConnected&&b.dataset.armed){delete b.dataset.armed;b.textContent=b.dataset.l}},3500);
}
function csv(){
 const qv=v=>{v=String(v??'');return /[",\n]/.test(v)?'"'+v.replace(/"/g,'""')+'"':v};
 const rn=id=>S.releases.find(r=>r.id===id)?.name||'';
 const dl=n=>C.links(n).map(l=>`${C.lbl[l.id]} ${tag(l)}${l.note?` (${l.note})`:''}`).join('; ');
 const ul=n=>(C.succL[n.id]||[]).map(({n:s,l})=>`${C.lbl[s.id]} ${tag(l)}`).join('; ');
 const flagT=f=>f.od?`Overdue ${days(f.od)}`:f.ls?`Late start ${days(f.ls)}`:f.their?'At risk (their call)':f.rk?`At risk: ${rkTxt(f)}`:'';
 const dcols=n=>{const f=C.df[n.id]||{};return [n.startBy||'',n.due,n.startedOn||'',n.doneOn||'',flagT(f)]};
 const out=[[S.itemIds==='key'?'ID':'WBS','Level','Name','Owner','Release','Target','Status','State','Step','Depends on (type, lag, status)','Unlocks','External blocker','Notes','Start by','Due','Started','Done','Date flag']];
 for(const m of C.mss)out.push([C.lbl[m.id],'Milestone',m.name,m.owner,'',m.target,m.status==='done'?'Marked reached':'Automatic',LBL[C.eff[m.id]],'after '+C.step[m.id],dl(m),ul(m),'',m.notes,...dcols(m)]);
 for(const x of C.exts)out.push([C.lbl[x.id],'External',x.name,x.owner,'',x.team,XSL[x.status],LBL[C.eff[x.id]],'after '+C.step[x.id],dl(x),ul(x),x.ref,x.notes,...dcols(x)]);
 for(const o of (kids.root||[]).filter(x=>x.type==='obj'))for(const it of [o,...(kids[o.id]||[]).filter(f=>f.type==='feat').flatMap(f=>[f,...(kids[f.id]||[]).filter(t=>t.type==='task')])]){
  const ts=tasksUnder(it),ss=ts.map(t=>C.step[t.id]),isT=it.type==='task';
  out.push([C.lbl[it.id],KIND[it.type],it.name,it.owner,isT?rn(C.relOf[it.id]):it.type==='feat'?rn(it.rel):'','',isT?{todo:'Not started',doing:'In progress',done:'Done',blocked:'Blocked'}[it.status]:'',isT?LBL[C.eff[it.id]]:'',isT?C.step[it.id]:ss.length?Math.min(...ss)+'-'+Math.max(...ss):'',isT||it.type==='feat'?dl(it):'',isT?ul(it):'',it.blocker,it.notes,...(isT?dcols(it):['','','','',''])]);
 }
 for(const x of C.rel)out.push(['','Release',x.r.name,'',x.r.name,x.r.target,RST[x.r.status],`${x.done} of ${x.ts.length} done`,x.land||'',x.up.map(d=>C.lbl[d]).join('; '),'','',x.r.notes,'',x.r.due,'','',x.od?`Overdue ${days(x.od)}`:x.rk?`At risk: ${x.rk} due after release`:'']);
 return out.map(r=>r.map(qv).join(',')).join('\n');
}
function ov(title,blurb,text,mode){
 $('#ovt').textContent=title;$('#ovp').textContent=blurb;const x=$('#ovx');x.value=text;x.readOnly=mode!=='imp';
 $('#ovgo').hidden=mode!=='imp';$('#ovcopy').hidden=mode==='imp';$('#ovmsg').textContent='';$('#ov').hidden=false;x.focus();if(mode!=='imp')x.select();
}

views.addEventListener('pointerdown',e=>{
 const b=e.target.closest('.b,.mk,.xk');if(!b||e.button!==0)return;const t=map[b.dataset.id];if(!t)return;
 drag={id:t.id,el:b,gt:t.type!=='task',l0:parseFloat(b.style.left)||0,x0:e.clientX,sx:board.scrollLeft,on:false,from:C.step[t.id],min:C.minOf(t.id),pid:e.pointerId,tgt:C.step[t.id]};
});
function dragMove(e){
 if(!drag)return;
 if(!drag.on){if(Math.abs(e.clientX-drag.x0)<6)return;drag.on=true;try{drag.el.setPointerCapture(drag.pid)}catch(_){}
  drag.el.classList.add('drag');grid.classList.add('dragging');grid.style.width=(parseFloat(grid.style.width)+geo.CW)+'px';
  drag.gh=document.createElement('div');drag.gh.className='ghost';drag.gh.innerHTML='<span></span>';grid.querySelector('.chart').appendChild(drag.gh)}
 e.preventDefault();
 const r=board.getBoundingClientRect();if(e.clientX>r.right-48)board.scrollLeft+=16;else if(e.clientX<r.left+geo.LW+48)board.scrollLeft-=16;
 const dx=e.clientX-drag.x0+(board.scrollLeft-drag.sx),vs=geo.vs,last=vs[vs.length-1]||0,CW=geo.CW;let c,tgt;
 if(drag.gt){const k0=vs.filter(s=>s<=drag.from).length;c=Math.max(0,Math.min(vs.length+1,k0+Math.round(dx/CW)));tgt=c===k0?drag.from:c===0?(vs[0]||1)-1:c<=vs.length?vs[c-1]:last+1}
 else{const fc=Math.max(0,vs.indexOf(drag.from));c=Math.max(0,Math.min(vs.length,fc+Math.round(dx/CW)));tgt=c<vs.length?vs[c]:Math.min(geo.N+1,last+1)}
 if(drag.gt)drag.el.style.left=(drag.l0+dx)+'px';else drag.el.style.transform=`translateX(${dx}px)`;drag.tgt=tgt;
 const bad=tgt<drag.min;drag.gh.className='ghost'+(drag.gt?' gl':'')+(bad?' bad':'');drag.gh.style.cssText=drag.gt?`left:${c*CW-1}px;height:${geo.H}px`:`left:${c*CW+3}px;width:${CW-6}px;height:${geo.H}px`;
 drag.gh.firstChild.textContent=drag.gt?(bad?`Too early. Snaps to ${gateTxt(drag.min)}`:tgt===drag.from?'No change':`Move to ${gateTxt(tgt)}`):bad?`Too early. Step ${drag.min} at the soonest`:tgt===drag.from?`Step ${tgt} (no change)`:`Move to step ${tgt}`;
}
function dragEnd(cancel){
 if(!drag)return;const d=drag;drag=null;if(!d.on)return;
 noClick=true;setTimeout(()=>{noClick=false},0);grid.classList.remove('dragging');
 if(cancel){render();return}
 (d.gt?moveGate:moveTo)(d.id,d.tgt);
}
// Drawing links. Hovering a task bar, milestone or external shows a handle on its start (left) and
// end (right) edge. Dragging a handle onto another item adds a link to the item it is dropped on:
// the dragged edge is the predecessor's, the drop edge the successor's (end → start = FS, and so on).
let ld=null,lkHov=null;
function lkShow(id){
 const p=geo.pt&&geo.pt[id],ch=grid.querySelector('.chart');if(!p||!ch){lkHide();return}
 if(lkHov&&lkHov.id===id&&lkHov.els[0].isConnected)return;
 lkHide();
 lkHov={id,els:['S','F'].map(s=>{const h=document.createElement('i');h.className='lkh';h.dataset.side=s;h.title=`Drag from the ${s==='S'?'start':'end'} of ${C.lbl[id]} onto another item to link them`;h.style.left=(s==='S'?p.l:p.r)+'px';h.style.top=p.y+'px';ch.appendChild(h);return h})};
}
function lkHide(){if(lkHov){lkHov.els.forEach(h=>h.remove());lkHov=null}}
const lkWhy=(a,b)=>map[b].deps.some(l=>l.id===a)?{tag:'Already linked',msg:`${C.lbl[b]} already depends on ${C.lbl[a]}. Change that link in ${C.lbl[b]}'s editor`}:downOf([b]).has(a)?{tag:'Would make a loop',msg:`${C.lbl[a]} already waits on ${C.lbl[b]}, so the link would make a loop`}:null;
function lkHit(x,y){
 const row=Math.floor(y/geo.RH);let id=null,bd=1e9;
 for(const k in geo.pt){const p=geo.pt[k];if(p.row!==row||k===ld.id||x<p.l-8||x>p.r+8)continue;const d=Math.abs(x-(p.l+p.r)/2);if(d<bd){bd=d;id=k}}
 if(!id)return null;const p=geo.pt[id],side=x<(p.l+p.r)/2?'S':'F';
 return {id,side,type:ld.side+side,x:side==='S'?p.l:p.r,y:p.y,h:p.h,why:lkWhy(ld.id,id)};
}
views.addEventListener('pointerdown',e=>{
 const h=e.target.closest('.lkh');if(!h||e.button!==0||!lkHov)return;const p=geo.pt[lkHov.id],s=h.dataset.side;if(!p)return;
 e.preventDefault();lkHov.els.forEach(x=>{if(x!==h)x.remove()});
 ld={id:lkHov.id,side:s,el:h,x0:e.clientX,y0:e.clientY,sx:s==='S'?p.l:p.r,sy:p.y,on:false,hit:null};lkHov=null;
 try{h.setPointerCapture(e.pointerId)}catch(_){}
});
function lkMove(e){
 if(!ld)return;
 const ch=grid.querySelector('.chart');if(!ch||!ld.el.isConnected){lkEnd(true);return}
 if(!ld.on){if(Math.abs(e.clientX-ld.x0)+Math.abs(e.clientY-ld.y0)<5)return;ld.on=true;
  grid.classList.add('linking');ld.el.classList.add('on');
  ch.insertAdjacentHTML('beforeend','<svg class="lkd idle" aria-hidden="true"><defs><marker id="mlkd" viewBox="0 0 8 8" refX="8" refY="4" markerWidth="9" markerHeight="9" markerUnits="userSpaceOnUse" orient="auto"><path class="ah" d="M0,0L8,4L0,8z"/></marker></defs><path class="e" marker-end="url(#mlkd)"/></svg><i class="lke" hidden></i><span class="lkt" hidden></span>');
  ld.svg=ch.querySelector('.lkd');ld.edge=ch.querySelector('.lke');ld.lab=ch.querySelector('.lkt')}
 e.preventDefault();
 const b=board.getBoundingClientRect();
 if(e.clientX>b.right-48)board.scrollLeft+=16;else if(e.clientX<b.left+geo.LW+48)board.scrollLeft-=16;
 if(e.clientY>b.bottom-40)board.scrollTop+=16;else if(e.clientY<b.top+geo.HH+40)board.scrollTop-=16;
 const r=ch.getBoundingClientRect(),x=e.clientX-r.left,y=e.clientY-r.top,hit=lkHit(x,y);ld.hit=hit;
 const ex=hit?hit.x:x,ey=hit?hit.y:y,ds=ld.side==='S'?-1:1,de=hit?(hit.side==='S'?-1:1):0,k=Math.max(28*mapZ,Math.abs(ex-ld.sx)/3),cls=hit?(hit.why?'bad':hit.type):'idle';
 ld.svg.setAttribute('class','lkd '+cls);
 ld.svg.lastChild.setAttribute('d',`M${ld.sx},${ld.sy}C${ld.sx+ds*k},${ld.sy} ${ex+de*k},${ey} ${ex},${ey}`);
 ld.edge.hidden=ld.lab.hidden=!hit;
 if(hit){ld.edge.className='lke '+cls;ld.edge.style.cssText=`left:${hit.x}px;top:${hit.y}px;height:${hit.h+8*mapZ}px`;
  ld.lab.className='lkt '+cls;ld.lab.style.cssText=`left:${hit.x}px;top:${hit.y-hit.h/2-6*mapZ}px`;
  ld.lab.textContent=hit.why?hit.why.tag:`${hit.type} · ${TYPES[hit.type]}`}
}
function lkEnd(cancel){
 if(!ld)return;const l=ld;ld=null;grid.classList.remove('linking');
 for(const el of [l.el,l.svg,l.edge,l.lab])if(el)el.remove();
 if(!l.on)return;
 noClick=true;setTimeout(()=>{noClick=false},0);
 if(cancel||!map[l.id])return;
 const h=l.hit,a=C.lbl[l.id];
 if(!h||!map[h.id]){toast(`To link ${a}, drop the arrow on a task, milestone or external item.`);return}
 const b=C.lbl[h.id];
 if(h.why){toast(`Can't link ${a} to ${b}: ${h.why.msg}.`);return}
 mut(()=>{map[h.id].deps.push(link(l.id,h.type));sel=h.id;selRel=null;q=''});
 const c=document.getElementById('dep-'+l.id);if(c){c.scrollIntoView({block:'center'});c.classList.add('flash');document.getElementById('lt-'+l.id)?.focus({preventScroll:true})}
 toast(`${b} now depends on ${a}: ${h.type}, ${TYPES[h.type].toLowerCase()}. Change the type or lag in the editor.`);
}
window.addEventListener('pointermove',lkMove,{passive:false});
window.addEventListener('pointerup',()=>lkEnd(false));
window.addEventListener('pointercancel',()=>lkEnd(true));
grid.addEventListener('pointerover',e=>{
 if(ld||drag||td||e.target.closest('.lkh'))return;
 const it=e.target.closest('.chart .b,.chart .mk,.chart .xk');if(it)lkShow(it.dataset.id);else lkHide();
});
grid.addEventListener('pointerleave',()=>{if(!ld)lkHide()});
views.addEventListener('pointerdown',e=>{
 if(e.button!==0||!tlGeo)return;
 const h=e.target.closest('[data-tdrag]');
 if(h){const n=map[h.dataset.tdrag];if(!n)return;
  if(n.type==='task'){let s0=dn(n.startBy)??dn(n.startedOn)??dn(n.due),e0=dn(n.due)??dn(n.startBy)??dn(n.doneOn);if(s0===null||e0===null)return;if(s0>e0)[s0,e0]=[e0,s0];td={id:n.id,mode:e.target.closest('[data-h]')?.dataset.h||'m',el:h,x0:e.clientX,s0,e0,dx:0,on:false,pid:e.pointerId}}
  else{const d0=dn(n.due);if(d0===null)return;td={id:n.id,mode:'d',el:h,x0:e.clientX,s0:d0,e0:d0,dx:0,on:false,pid:e.pointerId}}
  return}
 const p=e.target.closest('.tlp');if(!p||e.target.closest('.sg,.tsum,.tln,.tko'))return;
 const r=p.getBoundingClientRect(),i=Math.floor((e.clientY-r.top)/tlGeo.RH2),n=map[tlGeo.ids[i]];
 if(!n||n.type!=='task'||n.startBy||n.due)return;
 const d0=tlGeo.lo+Math.floor((e.clientX-r.left)/tlGeo.ppd),g=document.createElement('div');
 g.className='tk draw';g.style.cssText=`left:${(d0-tlGeo.lo)*tlGeo.ppd}px;width:${Math.max(6,tlGeo.ppd)}px;top:${i*tlGeo.RH2+3}px`;p.appendChild(g);
 td={id:n.id,mode:'n',el:g,x0:e.clientX,s0:d0,e0:d0,dx:0,on:false,pid:e.pointerId};
});
function tdRange(t){const D=Math.round(t.dx/tlGeo.ppd);let s=t.s0,en=t.e0;
 if(t.mode==='m'){s+=D;en+=D}else if(t.mode==='s')s=Math.min(t.s0+D,t.e0);else if(t.mode==='e')en=Math.max(t.e0+D,t.s0);else if(t.mode==='n'){const x=t.s0+D;s=Math.min(t.s0,x);en=Math.max(t.s0,x)}else{s=en=t.s0+D}
 return [s,en,D]}
function tip(m){const t=$('#toast');t.textContent=m;t.hidden=false;clearTimeout(toastT)}
function tdMove(e){
 if(!td)return;td.dx=e.clientX-td.x0;
 if(!td.on){if(Math.abs(td.dx)<4)return;td.on=true;try{td.el.setPointerCapture(td.pid)}catch(_){}td.el.classList.add('tdrag')}
 e.preventDefault();
 const [s,en]=tdRange(td),X=d=>(d-tlGeo.lo)*tlGeo.ppd,n=map[td.id],c=C.lbl[n.id];
 if(td.mode==='d')td.el.style.left=(X(s)+tlGeo.ppd/2-7)+'px';else{td.el.style.left=X(s)+'px';td.el.style.width=Math.max(6,(en-s+1)*tlGeo.ppd)+'px'}
 tip(td.mode==='d'?`${c} ${n.type==='ext'?'expected':'due'} ${fd(s)}`:td.mode==='s'?`${c} start by ${fd(s)} (due ${fd(en)})`:td.mode==='e'?`${c} due ${fd(en)} (start by ${fd(s)})`:`${c} start by ${fd(s)}, due ${fd(en)}`);
}
function tdEnd(cancel){
 if(!td)return;const t=td;td=null;
 if(!t.on){if(t.mode==='n')t.el.remove();return}
 noClick=true;setTimeout(()=>{noClick=false},0);
 if(cancel){$('#toast').hidden=true;render();return}
 const [s,en,D]=tdRange(t),n=map[t.id],c=C.lbl[n.id];
 if(D===0&&t.mode!=='n'){$('#toast').hidden=true;render();return}
 mut(()=>{if(t.mode==='d')n.due=iso(s);else if(t.mode==='s')n.startBy=iso(s);else if(t.mode==='e')n.due=iso(en);else{n.startBy=iso(s);n.due=iso(en)}});
 toast(t.mode==='d'?`${c} ${n.type==='ext'?'expected':'due'} ${fd(s)}.`:t.mode==='s'?`${c} start by ${fd(s)}.`:t.mode==='e'?`${c} due ${fd(en)}.`:`${c} start by ${fd(s)}, due ${fd(en)}.`);
}
window.addEventListener('pointermove',tdMove,{passive:false});
window.addEventListener('pointerup',()=>tdEnd(false));
window.addEventListener('pointercancel',()=>tdEnd(true));
window.addEventListener('pointermove',dragMove,{passive:false});
window.addEventListener('pointerup',()=>dragEnd(false));
window.addEventListener('pointercancel',()=>dragEnd(true));
views.addEventListener('click',e=>{
 if(!e.target.isConnected||e.target.closest('#gridv,#relv'))return;
 if(noClick){noClick=false;return}
 const tb=e.target.closest('[data-tl]');if(tb){const a=tb.dataset.tl;if(a==='toggle'){S.tl.open=!S.tl.open;tlReset=true}else if(a==='only')S.tl.only=!S.tl.only;else{S.tl.zoom=a.slice(2);tlReset=true}render();return}
 const cb=e.target.closest('[data-cal]');if(cb){openCal(null);return}
 const lk=e.target.closest('.lk');if(lk){go(lk.dataset.lk,lk.dataset.from);return}
 const tg=e.target.closest('[data-tog]');
 if(tg){const id=tg.dataset.tog;if(id==='__ms')S.msCollapsed=!S.msCollapsed;else if(id==='__ext')S.extCollapsed=!S.extCollapsed;else map[id].collapsed=!map[id].collapsed;render();return}
 const el=e.target.closest('[data-id]');
 if(el){sel=sel===el.dataset.id&&dr.classList.contains('open')?null:el.dataset.id;selRel=null;q='';render();return}
 if(sel||selRel||calOpen){sel=null;selRel=null;calOpen=false;render()}
});
views.addEventListener('keydown',e=>{
 if(e.target.closest('#gridv'))return;
 if(!(e.key==='Enter'||e.key===' '))return;const el=e.target.closest('.lr');if(!el||e.target!==el)return;e.preventDefault();
 if(el.dataset.tog){const k=el.dataset.tog==='__ext'?'extCollapsed':'msCollapsed';S[k]=!S[k];render();return}
 sel=el.dataset.id;selRel=null;q='';render();const n=$('#f-name');if(n)n.focus();
});
$('#relv').addEventListener('click',e=>{
 if(!e.target.isConnected)return;
 const b=e.target.closest('button'),a=b&&b.dataset.act;
 if(b&&b.dataset.go){go(b.dataset.go);return}
 if(b&&b.dataset.rel){openRel(b.dataset.rel);return}
 if(a==='add-rel'){addRel();return}
 if(a==='rel-back'){openRel(null);return}
 if(a==='rel-edit'){selRel=relPage;sel=null;render();const n=$('#f-name');if(n)n.focus();return}
 if(a==='rel-map'){view='map';selRel=relPage;sel=null;tlReset=true;render();return}
 if(sel||selRel||calOpen){sel=null;selRel=null;calOpen=false;render()}
});
$('#tal').addEventListener('click',e=>{if(e.target.closest('[data-cal]')){openCal(null);return}const b=e.target.closest('[data-focus]');if(!b)return;focus=focus===b.dataset.focus?null:b.dataset.focus;sel=null;selRel=null;render()});
dr.addEventListener('focusin',e=>{const d=e.target.dataset;if(d.f||d.rf||d.lk)pend=JSON.stringify(S)});
dr.addEventListener('input',e=>{
 const t=e.target;if(t.tagName==='SELECT')return;
 if(t.id==='f-q'){const it=map[sel];if(it){q=t.value;$('#pick').innerHTML=pickList(it)}return}
 if(t.dataset.cf)return;
 const f=t.dataset.f,rf=t.dataset.rf,lk=t.dataset.lk;
 if(lk&&t.dataset.lf!=='note')return;
 if(!f&&!rf&&!lk)return;
 if(pend){hist.push(pend);pend=null}
 if(rf){const r=S.releases.find(r=>r.id===selRel);if(r)r[rf]=t.value}
 else if(lk){const l=map[sel]?.deps.find(x=>x.id===lk);if(l)l.note=t.value}
 else{const it=map[sel];if(!it)return;if(f==='earliest')it.earliest=+t.value>0?Math.floor(+t.value):null;else it[f]=t.value}
 S.sample=false;soft();
});
dr.addEventListener('change',e=>{
 const t=e.target,f=t.dataset.f;
 if(t.dataset.rf==='status'){const r=S.releases.find(r=>r.id===selRel);if(r)mut(()=>{r.status=t.value});return}
 if(t.dataset.cf){const f=t.dataset.cf;mut(()=>{S.cal[f]=f==='len'?Math.max(1,Math.min(120,Math.round(+t.value)||14)):okd(t.value)});return}
 if(t.dataset.pf==='itemIds'){mut(()=>{S.itemIds=t.value==='key'?'key':'outline'});return}
 if(t.dataset.rf==='due'){render();return}
 const it=map[sel];if(!it)return;
 if(t.dataset.lk){const lf=t.dataset.lf,l=it.deps.find(x=>x.id===t.dataset.lk);if(!l)return;if(lf==='note'){render();return}pend=null;mut(()=>{l[lf]=lf==='lag'?clampLag(t.value):t.value});return}
 if(t.dataset.dep){const d=t.dataset.dep;mut(()=>{it.deps=t.checked?[...it.deps,link(d)]:it.deps.filter(x=>x.id!==d)});return}
 if(f==='status')mut(()=>{const v=t.value,td=todayIso();it.status=v;if(v==='done')it.blocker='';
  if(it.type==='ext'){if(v==='delivered'){if(!it.doneOn)it.doneOn=td}else it.doneOn=''}
  if(it.type==='task'){if(v==='doing'){if(!it.startedOn)it.startedOn=td;it.doneOn=''}else if(v==='done'){if(!it.startedOn)it.startedOn=td;if(!it.doneOn)it.doneOn=td}else if(v==='todo'){it.startedOn='';it.doneOn=''}else it.doneOn=''}});
 else if(f==='rel')mut(()=>{it.rel=t.value});
 else if(f==='parent')mut(()=>{it.parent=t.value;S.items.splice(S.items.indexOf(it),1);S.items.push(it);map[t.value].collapsed=false});
 else if(['earliest','blocker','due','startBy','startedOn','doneOn','color'].includes(f))render();
});
dr.addEventListener('click',e=>{
 const b=e.target.closest('button');if(!b)return;
 if(b.dataset.cal){openCal(+b.dataset.cal||null);return}
 if(b.dataset.col!==undefined&&map[sel]){const c=b.dataset.col;mut(()=>{map[sel].color=c});return}
 if(b.dataset.go){go(b.dataset.go);return}
 if(b.dataset.rmdep){const d=b.dataset.rmdep;mut(()=>{map[sel].deps=map[sel].deps.filter(x=>x.id!==d)});return}
 const a=b.dataset.act;
 if(a==='close'){sel=null;selRel=null;calOpen=false;render()}
 else if(a==='mvl'||a==='mvr'||a==='unpin')(C.isP(sel)?moveGate:moveTo)(sel,a==='unpin'?C.minOf(sel):C.step[sel]+(a==='mvl'?-1:1));
 else if(a==='add-task')addItem('task',sel);
 else if(a==='add-feat')addItem('feat',sel);
 else if(a==='up'||a==='down')move(sel,a==='up'?-1:1);
 else if(a==='del'){const it=map[sel],n=tasksUnder(it).length;arm(b,it.type==='task'||it.type==='ms'||it.type==='ext'?'Click again to delete':`Delete with ${n} ${n===1?'task':'tasks'}?`,()=>del(sel))}
 else if(a==='del-rel'){const id=selRel;arm(b,'Click again: tasks keep their place',()=>mut(()=>{S.releases=S.releases.filter(r=>r.id!==id);S.items.forEach(i=>{if(i.rel===id)i.rel=''});selRel=null}))}
});
ttl.addEventListener('input',()=>{S.title=ttl.value;save()});
ttl.addEventListener('change',()=>{if(!ttl.value.trim()){S.title='Untitled plan';ttl.value=S.title;save()}});
$('#undo').onclick=undo;
$('#exp').onclick=()=>{S.items.forEach(i=>i.collapsed=false);S.msCollapsed=false;S.extCollapsed=false;render()};
$('#col').onclick=()=>{S.items.forEach(i=>{if(i.type==='feat')i.collapsed=true;if(i.type==='obj')i.collapsed=false});render()};
$('#crit').onclick=()=>{critOn=!critOn;render()};
$('#tags').onclick=()=>{tagsOn=!tagsOn;render()};

// Map zoom and full screen are view-only, so they skip mut(). The zoom level is a per-viewer
// preference (localStorage 'planner.mapzoom', loaded in wiring.js). renderBoard() redraws the
// map at mapZ, so it stays sharp and drag hit areas match what's drawn.
const ZMIN=.5,ZMAX=2,ZSTEPS=[.5,.67,.75,.8,.9,1,1.1,1.25,1.5,1.75,2];
let mapZ=1,zPend=null,zRaf=0,gz=null,fsOn=false;
const zClamp=v=>Number.isFinite(v)?Math.min(ZMAX,Math.max(ZMIN,v)):1;
// Zoom to z keeping the map point under (cx,cy) where it is; default is the middle of the map.
// Requests are batched to one redraw per frame.
function zoomTo(z,cx,cy){
 if(view!=='map'||drag||td||ld)return;
 const r=board.getBoundingClientRect();
 zPend={z:zClamp(z),cx:cx??r.left+r.width/2,cy:cy??r.top+r.height/2};
 if(!zRaf)zRaf=requestAnimationFrame(zoomApply);
}
function zoomApply(){
 zRaf=0;const p=zPend;zPend=null;
 if(!p||view!=='map'||!C||Math.abs(p.z-mapZ)<1e-4)return;
 // The labels column and the step header are sticky, so a point under them anchors at the chart's visible edge.
 const r=board.getBoundingClientRect(),ax=p.cx-r.left-board.clientLeft,ay=p.cy-r.top-board.clientTop,k=p.z/mapZ,c0=grid.querySelector('.chart');
 const x=board.scrollLeft+Math.max(ax,geo.LW)-(c0?c0.offsetLeft:0),y=board.scrollTop+Math.max(ay,geo.HH)-(c0?c0.offsetTop:0);
 mapZ=p.z;LS.set('planner.mapzoom',String(mapZ));renderBoard();zoomUi();
 const c1=grid.querySelector('.chart');
 board.scrollLeft=(c1?c1.offsetLeft:0)+x*k-Math.max(ax,geo.LW);board.scrollTop=(c1?c1.offsetTop:0)+y*k-Math.max(ay,geo.HH);
}
function zoomUi(){const off=view!=='map',b=$('#zm-0');$('#zm-out').disabled=off||mapZ<=ZMIN+1e-3;$('#zm-in').disabled=off||mapZ>=ZMAX-1e-3;b.disabled=off;b.textContent=Math.round(mapZ*100)+'%'}
$('#zm-in').onclick=()=>zoomTo(ZSTEPS.find(s=>s>mapZ+.005)??ZMAX);
$('#zm-out').onclick=()=>zoomTo([...ZSTEPS].reverse().find(s=>s<mapZ-.005)??ZMIN);
$('#zm-0').onclick=()=>zoomTo(1);
// Ctrl/Cmd + wheel, and trackpad pinch (Chrome, Edge and Firefox send it as Ctrl + wheel; Safari as gesture events).
board.addEventListener('wheel',e=>{
 if(!e.ctrlKey&&!e.metaKey)return;e.preventDefault();
 const dy=e.deltaY*(e.deltaMode===1?16:e.deltaMode===2?400:1);
 zoomTo((zPend?zPend.z:mapZ)*2**(-Math.max(-25,Math.min(25,dy))/100),e.clientX,e.clientY);
},{passive:false});
board.addEventListener('gesturestart',e=>{e.preventDefault();gz=mapZ});
board.addEventListener('gesturechange',e=>{e.preventDefault();if(gz!==null)zoomTo(gz*e.scale,e.clientX,e.clientY)});
board.addEventListener('gestureend',e=>{e.preventDefault();gz=null});
// Full screen hides the sidebar, header, tallies and legend, and asks the browser for real full screen
// when it can. Without the Fullscreen API (or if the browser refuses) the page still fills the window.
function fullScreen(on){
 fsOn=on;$('#app').classList.toggle('fullmap',on);
 const b=$('#fs-btn');b.setAttribute('aria-pressed',String(on));b.textContent=on?'Exit full screen':'Full screen';
 const de=document.documentElement;
 try{if(on&&!document.fullscreenElement&&de.requestFullscreen)Promise.resolve(de.requestFullscreen()).catch(()=>{});
  else if(!on&&document.fullscreenElement)Promise.resolve(document.exitFullscreen()).catch(()=>{})}catch(_){}
 if(C)renderView();
}
$('#fs-btn').onclick=()=>fullScreen(!fsOn);
document.addEventListener('fullscreenchange',()=>{if(!document.fullscreenElement&&fsOn)fullScreen(false)});
const exportText=()=>JSON.stringify({title:S.title,tl:S.tl,msCollapsed:S.msCollapsed,extCollapsed:S.extCollapsed,itemIds:S.itemIds,cal:S.cal,releases:S.releases,items:S.items},null,1);
const _unused_json=()=>ov('Export plan','Copy this and keep it somewhere safe. Paste it into Import to restore the plan or hand it to someone else.',JSON.stringify({title:S.title,tl:S.tl,msCollapsed:S.msCollapsed,extCollapsed:S.extCollapsed,cal:S.cal,releases:S.releases,items:S.items},null,1),'json');
const _unused_csv=()=>ov('Export CSV','One row per milestone, objective, feature, task and release. Links read like "1.2.2 FS", "1.1.3 SS+1" or "1.2.2 FS blocked". Paste into Excel, or save as .csv for a Jira import.',csv(),'csv');

$('#ovclose').onclick=()=>{$('#ov').hidden=true};
$('#ov').addEventListener('click',e=>{if(e.target.id==='ov')$('#ov').hidden=true});
$('#ovcopy').onclick=async()=>{try{await navigator.clipboard.writeText($('#ovx').value);$('#ovmsg').textContent='Copied.'}catch(err){$('#ovx').select();$('#ovmsg').textContent='Copy was blocked here. The text is selected: press Ctrl+C or Cmd+C.'}};
$('#ovgo').onclick=async()=>{let s=null;try{s=norm(JSON.parse($('#ovx').value))}catch(err){}if(!s){$('#ovmsg').textContent='That does not look like a plan file from this planner.';return}$('#ov').hidden=true;delete s.sample;await newPlan(s,s.title)};
document.addEventListener('keydown',e=>{
 if(e.key==='Escape'&&ld){lkEnd(true);return}
 if(e.key==='Escape'&&drag){dragEnd(true);return}
 if(e.key==='Escape'&&td){tdEnd(true);return}
 if(e.key==='Escape'){for(const d of ['#impd','#vdl'])if(!$(d).hidden){$(d).hidden=true;return}if(!$('#more').hidden){closeMenu();return}if(!$('#add').hidden){addMenu(false);$('#add-btn').focus();return}if(!$('#flt').hidden){fltMenu(false);$('#flt-btn').focus();return}if(histOpen&&!sel&&!selRel&&!calOpen){histOpen=false;renderHist();return}if(!$('#ov').hidden)$('#ov').hidden=true;else if(sel||selRel||calOpen){sel=null;selRel=null;calOpen=false;render()}else if(fsOn)fullScreen(false)}
 if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='z'&&!e.shiftKey&&!/INPUT|TEXTAREA|SELECT/.test(document.activeElement?.tagName||'')){e.preventDefault();undo()}
});

// ======================================================================= views
function renderView(){
 board.hidden=view!=='map';$('#gridv').hidden=view!=='grid';$('#ganttv').hidden=view!=='gantt';$('#relv').hidden=view!=='rel';
 document.querySelectorAll('.tabs [data-view]').forEach(b=>b.setAttribute('aria-selected',b.dataset.view===view));
 const rv=view==='rel';for(const s of ['#flt-btn','#exp','#col','#crit','#tags'])$(s).disabled=rv;if(rv)fltMenu(false);$('#fltsum').hidden=rv||!fltOn();zoomUi();
 lastVW=views.clientWidth;
 if(view==='map')renderBoard();else if(view==='grid')renderGrid();else if(view==='gantt')renderGantt();else renderRelv();
}
function renderGantt(){
 const el=$('#ganttv'),W=el.clientWidth||1000,LW=W<700?190:320;
 const hgt=Math.max(320,innerHeight-el.getBoundingClientRect().top-110);
 const o=el.querySelector('.tlb'),sl=o?o.scrollLeft:null,st=o?o.scrollTop:null;
 const TL=renderTimeline(rowsVisible(),W,LW,hgt);el.innerHTML=TL.html;
 const n=el.querySelector('.tlb');if(n){if(sl!==null&&!tlReset){n.scrollLeft=sl;n.scrollTop=st}else n.scrollLeft=Math.max(0,TL.tx-LW-(W-LW)/2);tlReset=false}
}

// ----------------------------------------------------------------------- releases
function openRel(id){view='rel';relPage=id||null;sel=null;selRel=null;calOpen=false;gsel=null;$('#app').classList.remove('railopen');render()}
function relSay(x){
 const why=[x.after.length?`${x.after.map(t=>esc(C.lbl[t.id])).join(', ')} ${x.after.length===1?'is':'are'} due after the release date`:'',x.xlate.length?`it waits on ${x.xlate.map(d=>esc(C.lbl[d])).join(', ')}, expected after the release date`:''].filter(Boolean).join('; ');
 return (x.od?`<p class="dsay"><b class="ltc">Overdue by ${days(x.od)}</b>.</p>`:'')+(x.rk?`<p class="dsay"><b class="ltc">At risk:</b> ${why}.</p>`:'');
}
function relFlag(x){return x.od?`<i class="lt">Overdue ${x.od}d</i>`:x.rk?'<i class="lt rk" title="Work due after the release date">At risk</i>':''}
function relListHtml(){
 const un=C.order.filter(t=>!C.relOf[t.id]).length;
 return `<div class="rh"><h2>Releases <span class="none">${C.rel.length}</span></h2><button class="btn" data-act="add-rel">Add release</button></div>`+(C.rel.length?`<div class="rl">${C.rel.map(x=>{const pct=x.ts.length?Math.round(x.done/x.ts.length*100):0;return `<button class="rr" data-rel="${esc(x.r.id)}"><span class="rn"><b>${esc(x.r.name)||'Untitled release'}</b><span>${esc(x.r.target)||'No target set'}${x.due!==null?` · due ${fd(x.due)}`:''}</span>${relFlag(x)}</span><span class="pg" title="${pct}% of tasks done"><i style="width:${pct}%"></i></span><span class="rf"><b>${x.done}</b> of ${x.ts.length} done</span><span class="rf">${x.land?`Lands after step <b>${x.land}</b>`:'No tasks yet'}</span><span class="rf${x.blk?' red':''}"><b>${x.blk}</b> blocked</span><span class="rf"><b>${x.up.length}</b> needed from outside${x.xt.length?`, <b>${x.xt.length}</b> external`:''}</span><span class="st ${x.r.status}">${RST[x.r.status]}</span></button>`}).join('')}</div><p class="none">${un} ${un===1?'task is':'tasks are'} not in any release. Click a release to open its page.</p>`:'<p class="none">No releases yet. Add one, then assign features or tasks to it from their editor.</p>');
}
function relPageHtml(x){
 const r=x.r,pct=x.ts.length?Math.round(x.done/x.ts.length*100):0,k=(v,l,c)=>`<div class="t${c?' '+c:''}"><b>${v}</b><span>${l}</span></div>`;
 const chips=(ids,none)=>`<div class="chips">${ids.map(d=>fchip(d).replace('<span class="chip">',`<span class="chip">${map[d].type==='ms'||map[d].type==='ext'?'':icon(d)}`)).join('')||`<p class="none">${none}</p>`}</div>`;
 const rows=x.ts.map(t=>`<tr><td class="gcd">${esc(C.lbl[t.id])}</td><td><button class="lnk" data-go="${esc(t.id)}" title="${esc(t.name)}">${esc(t.name)}</button></td><td>${esc(t.owner)}</td><td>${cellHtml(t,'status')}</td><td>${C.step[t.id]}</td><td>${t.due?fd(dn(t.due)):''}</td><td>${flagsHtml(t)}</td></tr>`).join('');
 return `<div class="relp"><button class="tbtn" data-act="rel-back">← All releases</button>
 <div class="relp-h"><h2>${esc(r.name)||'Untitled release'}</h2><span class="st ${r.status}">${RST[r.status]}</span>${relFlag(x)}<span class="grow"></span><button class="btn" data-act="rel-map"${x.ts.length?'':' disabled'}>Show on map</button><button class="btn pri" data-act="rel-edit">Edit release</button></div>
 <p class="none">${esc(r.target)||'No target set'}${x.due!==null?` · due ${fd(x.due)}`:''}</p>
 <div class="tal relp-k">${k(`${x.done}/${x.ts.length}`,'tasks done')}${k(pct+'%','complete')}${x.land?k('Step '+x.land,'last task lands'):''}${k(x.blk,'blocked or held up',x.blk?'f-blocked':'')}${k(x.up.length,'needed from outside')}${x.xt.length?k(x.xt.length,'external, not delivered'):''}</div>
 <div class="pg" title="${pct}% of tasks done"><i style="width:${pct}%"></i></div>${relSay(x)}
 <h3>Tasks <span>${x.ts.length}</span></h3>${rows?`<div class="relp-tw"><table class="relp-t"><thead><tr><th>Code</th><th>Task</th><th>Owner</th><th>Status</th><th>Step</th><th>Due</th><th>Flags</th></tr></thead><tbody>${rows}</tbody></table></div>`:'<p class="none">No tasks yet. Assign a feature or task to this release from its editor.</p>'}
 <div class="relp-g"><section><h3>Features <span>${x.feats.length}</span></h3>${chips(x.feats,'Assign a feature from its editor.')}</section>
 <section><h3>Needed from outside <span>${x.up.length}</span></h3>${chips(x.up,'This release depends only on its own work.')}${x.xt.length?`<h3>Waiting on external teams <span>${x.xt.length}</span></h3>${chips(x.xt,'')}`:''}</section>
 <section><h3>Notes</h3>${r.notes.trim()?`<p class="relp-nt">${esc(r.notes)}</p>`:'<p class="none">No notes. Add scope or release criteria with Edit release.</p>'}</section></div></div>`;
}
function renderRelv(){const x=relPage&&C.rel.find(x=>x.r.id===relPage);$('#relv').innerHTML=x?relPageHtml(x):relListHtml()}
function renderRailRels(){
 const on=id=>view==='rel'&&relPage===id?' on" aria-current="page':'';
 $('#rail-rel-n').textContent=C.rel.length;
 $('#rail-rel-l').innerHTML=`<button class="rail-rel-i${on(null)}" data-rp=""><span></span><span class="rail-rel-t">All releases</span><span></span></button>`+C.rel.map(x=>`<button class="rail-rel-i${on(x.r.id)}" data-rp="${esc(x.r.id)}" title="${esc(x.r.name)}${x.od?', overdue':x.rk?', at risk':''}"><span class="rail-rel-d ${x.r.status}${x.od||x.rk?' bad':''}"></span><span class="rail-rel-t">${esc(x.r.name)||'Untitled release'}</span><span class="rail-rel-c">${x.done}/${x.ts.length}</span></button>`).join('');
}
