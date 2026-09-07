// game.js — Main loop, HUD and menu wiring, and the boot call at the bottom.
// Loaded as a classic script; top-level let/const are shared with the other files.

// ───────────────────────── loop ─────────────────────────
let last=performance.now();
function frame(now){
  const dt=Math.min(.033,(now-last)/1000); last=now; time+=dt;
  if(netRole==='guest'){
    netSendInput(dt);
  } else if(phase!=='menu'){
    if(phase==='countdown'){
      phaseT-=dt; if(phaseT<=0) phase='play';
    } else if(phase==='play'){
      if(tSpawn>0) tSpawn-=dt;
      for(const t of tanks){
        t.cool=Math.max(0,t.cool-dt);
        t.recoil=Math.max(0,t.recoil-dt*5);
        for(const k in t.buffs){ t.buffs[k]-=dt; if(t.buffs[k]<=0){delete t.buffs[k];updateHud();} }
        if(t.doom>0){
          t.doom-=dt; t.tick-=dt;
          if(t.tick<=0){ t.tick=1; beep(t.doom>3?220:330,.09,'square',.05,-60); }
          if(t.doom<=0){ t.doom=0; t.shield=false; boom(t.x,t.y,'#ff2e63'); killTank(t); }
        }
      }
      updateHuman(tanks[0],0,dt);
      if(mode==='duo') updateHuman(tanks[1],1,dt);
      else if(mode==='online') updateNetTank(tanks[1],dt);
      else updateBot(tanks[1],dt);
      updateBullets(dt); updatePups(dt); updateMines(dt); updateRockets(dt);
      hudT-=dt; if(hudT<=0){ hudT=.34; updateHud(); }
    } else if(phase==='roundEnd'){
      updateBullets(dt); updateMines(dt);
      phaseT-=dt; if(phaseT<=0){ roundNo++; newRound(); }
    } else if(phase==='matchEnd'){
      phaseT-=dt; updateBullets(dt);
      if(phaseT<=0) showEnd();
    }
    updateParts(dt);
    if(netRole==='host') netSendState(dt);
  }

  ctx.save();
  if(shake>0){ ctx.translate((Math.random()-.5)*shake,(Math.random()-.5)*shake); shake*=.86; if(shake<.3)shake=0; }
  drawMaze(); drawPups(); drawMines();
  if(phase==='play') for(const t of tanks) if(t.human && t.alive && t.laser>0) drawLaserSight(t);
  for(const t of tanks) drawTank(t);
  drawRockets(); drawBullets(); drawParts(); if(isTouch) drawSticks();

  if(phase==='countdown'){
    const n=Math.ceil(phaseT);
    drawCenter(n>0?String(n):'קדימה!','סיבוב '+(roundNo+1));
  } else if(phase==='play' && tSpawn>0){
    ctx.textAlign='center'; ctx.fillStyle='rgba(180,205,225,.7)'; ctx.font='700 14px system-ui';
    ctx.fillText('אש חופשית בעוד '+tSpawn.toFixed(1),W/2,26);
  } else if(phase==='roundEnd'){
    drawCenter(msg,score[0]+' — '+score[1]);
  }
  ctx.restore();
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

// ───────────────────────── UI ─────────────────────────
const ov=document.getElementById('overlay');
let prevScore=[-1,-1];
function updateHud(){
  const nm=NAME();
  document.getElementById('n1').textContent=nm[0];
  document.getElementById('n2').textContent=nm[1];
  const sp=document.getElementById('sp'), sb=document.getElementById('sb');
  sp.textContent=score[0]; sb.textContent=score[1];
  if(prevScore[0]>=0 && score[0]!==prevScore[0]) bumpEl(sp);
  if(prevScore[1]>=0 && score[1]!==prevScore[1]) bumpEl(sb);
  prevScore=[score[0],score[1]];
  const el=document.getElementById('buffs'); el.innerHTML='';
  for(const i of ((mode==='duo'||mode==='online')?[0,1]:[0])){
    const t=tanks[i]; if(!t) continue;
    const items=[];
    if(t.shield) items.push(['shield','']);
    if(t.mines>0) items.push(['mine','×'+t.mines]);
    if(t.laser>0) items.push(['laser','×'+t.laser]);
    if(t.doom>0) items.push(['doom',Math.ceil(t.doom)+'']);
    for(const o of rockets) if(o.owner===t.team && !o.dead)
      items.push([o.kind, o.kind==='drone' ? Math.ceil(o.life)+'' : '∞']);
    for(const k in t.buffs) items.push([k,Math.ceil(t.buffs[k])+'']);
    for(const [k,v] of items){
      const d=document.createElement('div');
      d.className='buff'+(i?' b2':'');
      d.style.color=POWERS[k].col;
      d.textContent=POWERS[k].icon+' '+POWERS[k].label+(v?' '+v:'');
      el.appendChild(d);
    }
  }
}
function helpText(){
  if(mode==='duo'){
    return isTouch
      ? 'לכל שחקן ג׳ויסטיק וכפתור ירי. הצריח פונה תמיד לכיוון הנסיעה. בטלפון על הצד הלוחיות עוברות לצדדים.'
      : 'כחול: <kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> · ירי <kbd>רווח</kbd> · מוקש <kbd>E</kbd><br>'+
        'כתום: <kbd>↑</kbd><kbd>←</kbd><kbd>↓</kbd><kbd>→</kbd> · ירי <kbd>Enter</kbd> · מוקש <kbd>/</kbd><br>'+
        'הצריח פונה תמיד לכיוון הנסיעה.';
  }
  return isTouch
    ? 'עם הטלפון על הצד: הג׳ויסטיק השמאלי לנהיגה, הימני לכיוון, וכפתורי ירי ומוקש לצידו. במאונך — אצבע בכל חצי של הלוח.'
    : '<kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> תזוזה · עכבר לכיוון · <kbd>לחיצה</kbd> או <kbd>רווח</kbd> ירי · <kbd>E</kbd> מוקש';
}
function refreshMenu(){
  document.getElementById('diffRow').classList.toggle('hide',mode==='duo'||mode==='online');
  document.getElementById('onlinePanel').classList.toggle('hidden',mode!=='online');
  document.getElementById('start').classList.toggle('hide',mode==='online');
  document.getElementById('keys').innerHTML = mode==='online'
    ? (isTouch
        ? 'הצד השמאלי של הלוח מזיז את הטנק, הצד הימני מכוון ויורה.'
        : '<kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> תזוזה · עכבר לכיוון · <kbd>לחיצה</kbd> או <kbd>רווח</kbd> ירי · <kbd>E</kbd> מוקש')
    : helpText();
  document.getElementById('sub').textContent = mode==='duo'
    ? 'שני טנקים, מכשיר אחד. פגיעה אחת מכריעה סיבוב, הראשון ל‑'+WIN+' לוקח את הקרב.'
    : mode==='online'
    ? 'שלחו קישור הזמנה לחבר ושחקו זה נגד זה מכל מקום. פגיעה אחת מכריעה סיבוב, הראשון ל‑'+WIN+' לוקח את הקרב.'
    : 'פגיעה אחת מכריעה סיבוב. הכדורים מנתרים הרבה לפני שהם דועכים — גם שלך. הראשון ל‑'+WIN+' לוקח את הקרב.';
  document.getElementById('foot').textContent='לייזר עם קו מסלול, טיל עוקב, רחפן שאתה מטיס — ולא כל קופסה שנראית טוב באמת טובה.';
}
function showEnd(){
  const won=score[0]>=WIN;
  ov.classList.remove('hidden');
  ov.querySelector('h1').textContent = (mode==='duo'||mode==='online')
    ? (won?'כחול ניצח את הקרב':'כתום ניצח את הקרב')
    : (won?'ניצחת בקרב':'הבוט ניצח');
  document.getElementById('sub').textContent='תוצאה '+score[0]+'–'+score[1]+'. עוד סיבוב?';
  document.getElementById('start').textContent='קרב חדש';
  if(mode==='online') document.getElementById('start').classList.remove('hide');
  if(mode!=='duo'){
    const s=loadStats();
    s.matches++; if(won) s.wins++; else s.losses++;
    s.shots+=matchStats[0].shots; s.hits+=matchStats[0].hits;
    saveStats(s);
  }
  won ? winJingle() : loseJingle();
  phase='menu'; layout();
}
function bumpEl(el){ el.classList.remove('bump'); void el.offsetWidth; el.classList.add('bump'); }

document.getElementById('start').onclick=()=>{ startMatch(); beep(520,.1,'sine',.05,200); startMusic(); };
document.getElementById('restart').onclick=()=>startMatch();
document.getElementById('sound').onclick=e=>{ setMuted(!muted); e.target.textContent=muted?'🔇':'🔊'; };
document.getElementById('full').onclick=()=>{
  try{
    if(!document.fullscreenElement) document.documentElement.requestFullscreen();
    else document.exitFullscreen();
  }catch(e){}
  setTimeout(layout,200);
};

// ───────────────────────── theme ─────────────────────────
const themeBtn=document.getElementById('theme');
function applyTheme(t){
  document.documentElement.setAttribute('data-theme',t);
  themeBtn.textContent = t==='light' ? '☀️' : '🌙';
  try{ localStorage.setItem('tankTheme',t); }catch(e){}
}
applyTheme((()=>{ try{ return localStorage.getItem('tankTheme')||'dark'; }catch(e){ return 'dark'; } })());
themeBtn.onclick=()=>applyTheme(document.documentElement.getAttribute('data-theme')==='light'?'dark':'light');

// ───────────────────────── pause ─────────────────────────
const pauseOv=document.getElementById('pauseOverlay');
let prevPhase=null;
function togglePause(){
  if(phase==='menu' || netRole==='guest') return;
  if(phase==='paused'){
    phase=prevPhase; prevPhase=null; pauseOv.classList.add('hidden');
  }else if(phase!=='matchEnd'){
    prevPhase=phase; phase='paused'; pauseOv.classList.remove('hidden');
    clearGhostTouch();
  }
}
document.getElementById('pause').onclick=togglePause;
document.getElementById('resumeBtn').onclick=togglePause;
document.getElementById('pauseQuit').onclick=()=>{
  if(netRole) netTeardown();
  phase='menu'; prevPhase=null; pauseOv.classList.add('hidden'); layout();
  ov.classList.remove('hidden');
  ov.querySelector('h1').textContent='קרב טנקים במבוך';
  document.getElementById('start').textContent='התחלת קרב';
  mode='bot';
  document.querySelectorAll('#modeRow .opt').forEach(x=>x.classList.toggle('on',x.dataset.m==='bot'));
  refreshMenu();
};

// ───────────────────────── power-up legend ─────────────────────────
const legendModal=document.getElementById('legendModal');
function buildLegend(){
  const grid=document.getElementById('legendGrid'); grid.innerHTML='';
  for(const k of PKEYS){
    const P=POWERS[k];
    if(isTrap(k)) continue;
    const d=document.createElement('div');
    d.className='legendItem';
    d.innerHTML='<span class="ic" style="color:'+P.col+'">'+P.icon+'</span>'+
      '<span><b>'+P.label+'</b><span>'+(P.dur?('משך '+P.dur+' שנ׳'):'שימוש חד-פעמי')+'</span></span>';
    grid.appendChild(d);
  }
}
function openLegend(){ buildLegend(); legendModal.classList.remove('hidden'); }
function closeLegend(){ legendModal.classList.add('hidden'); }
document.getElementById('openLegend').onclick=openLegend;
document.getElementById('legend').onclick=openLegend;
document.getElementById('pauseLegend').onclick=openLegend;
document.getElementById('closeLegend').onclick=closeLegend;
legendModal.addEventListener('click',e=>{ if(e.target===legendModal) closeLegend(); });
// ───────────────────────── win target ─────────────────────────
document.querySelectorAll('#winRow .opt').forEach(b=>b.onclick=()=>{
  document.querySelectorAll('#winRow .opt').forEach(x=>x.classList.remove('on'));
  b.classList.add('on'); WIN=+b.dataset.w; refreshMenu();
});

// ───────────────────────── maze style ─────────────────────────
document.querySelectorAll('#mazeRow .opt').forEach(b=>b.onclick=()=>{
  document.querySelectorAll('#mazeRow .opt').forEach(x=>x.classList.remove('on'));
  b.classList.add('on'); mazeStyle=b.dataset.z;
});

// ───────────────────────── first-time onboarding ─────────────────────────
const introModal=document.getElementById('introModal');
function introText(){
  return isTouch
    ? 'הצד השמאלי של הלוח <b>מזיז</b> את הטנק, הצד הימני <b>מכוון</b> — ואוטומטית גם יורה. '+
      'בטלפון על הצד תקבלו ג׳ויסטיקים וכפתורים אמיתיים.<br><br>'+
      'תפסו <b>פאוור-אפ</b> קופצני שנוחת במבוך — חלקם מתחזים, ומתגלים רק כשלוקחים אותם. פגיעה אחת מכריעה סיבוב.'
    : '<b>WASD</b> נוסע, <b>העכבר</b> מכוון, <b>קליק</b> או <b>רווח</b> יורה, <b>E</b> מניח מוקש.<br><br>'+
      'תפסו <b>פאוור-אפ</b> קופצני שנוחת במבוך — חלקם מתחזים, ומתגלים רק כשלוקחים אותם. פגיעה אחת מכריעה סיבוב — הכדורים מנתרים מהקירות, גם שלכם.';
}
function maybeShowIntro(){
  let seen=false;
  try{ seen=localStorage.getItem('tankIntroSeen')==='1'; }catch(e){}
  if(seen) return;
  document.getElementById('introBody').innerHTML=introText();
  introModal.classList.remove('hidden');
}
function dismissIntro(){
  introModal.classList.add('hidden');
  try{ localStorage.setItem('tankIntroSeen','1'); }catch(e){}
}
document.getElementById('introGotIt').onclick=dismissIntro;
document.getElementById('closeIntro').onclick=dismissIntro;
introModal.addEventListener('click',e=>{ if(e.target===introModal) dismissIntro(); });
maybeShowIntro();

// ───────────────────────── tank color ─────────────────────────
function applyPlayerColor(id){
  playerColor=id;
  const c=colorOf(id);
  document.documentElement.style.setProperty('--p1',c.col);
  document.querySelector('#hud .dot').style.background=c.col;
  document.querySelectorAll('#colorRow .swatch').forEach(s=>s.classList.toggle('on',s.dataset.c===id));
  try{ localStorage.setItem('tankColor',id); }catch(e){}
}
(function buildColorRow(){
  const row=document.getElementById('colorRow');
  for(const c of COLORS){
    const b=document.createElement('button');
    b.className='swatch'; b.type='button'; b.dataset.c=c.id;
    b.style.background=c.col; b.title=c.id;
    b.onclick=()=>applyPlayerColor(c.id);
    row.appendChild(b);
  }
  applyPlayerColor(playerColor);
})();

// ───────────────────────── stats modal ─────────────────────────
const statsModal=document.getElementById('statsModal');
function buildStats(){
  const s=loadStats();
  const acc=s.shots? Math.round(100*s.hits/s.shots) : 0;
  const rows=[
    [s.wins,'ניצחונות'], [s.losses,'הפסדים'], [s.matches,'קרבות'],
    [s.shots,'יריות'], [s.hits,'פגיעות'], [acc+'%','דיוק'],
  ];
  const grid=document.getElementById('statsGrid'); grid.innerHTML='';
  for(const [v,l] of rows){
    const d=document.createElement('div');
    d.className='statBox'; d.innerHTML='<b>'+v+'</b><span>'+l+'</span>';
    grid.appendChild(d);
  }
}
document.getElementById('openStats').onclick=()=>{ buildStats(); statsModal.classList.remove('hidden'); };
document.getElementById('closeStats').onclick=()=>statsModal.classList.add('hidden');
statsModal.addEventListener('click',e=>{ if(e.target===statsModal) statsModal.classList.add('hidden'); });
document.getElementById('resetStats').onclick=()=>{ saveStats({wins:0,losses:0,matches:0,shots:0,hits:0}); buildStats(); };

document.querySelectorAll('#diffRow .opt').forEach(b=>b.onclick=()=>{
  document.querySelectorAll('#diffRow .opt').forEach(x=>x.classList.remove('on'));
  b.classList.add('on'); diff=+b.dataset.d;
});
document.querySelectorAll('#modeRow .opt').forEach(b=>b.onclick=()=>{
  document.querySelectorAll('#modeRow .opt').forEach(x=>x.classList.remove('on'));
  b.classList.add('on'); mode=b.dataset.m;
  if(mode!=='online' && netRole) netTeardown();
  refreshMenu(); updateHud(); layout();
});

// ───────────────────────── online play ─────────────────────────
function netExtractCode(raw){
  raw=(raw||'').trim();
  if(!raw) return '';
  try{
    const u=new URL(raw);
    const r=u.searchParams.get('room');
    if(r) return r.trim();
  }catch(e){}
  return raw;
}
function netShowError(text){
  const el=document.getElementById('onlineError');
  el.textContent=text; el.classList.remove('hidden');
}
function netClearError(){ document.getElementById('onlineError').classList.add('hidden'); }

document.getElementById('createLinkBtn').onclick=()=>{
  netClearError();
  document.getElementById('createLinkBtn').disabled=true;
  netHostCreate(code=>{
    document.getElementById('onlineHostBox').classList.add('hidden');
    document.getElementById('onlineJoinBox').classList.add('hidden');
    document.getElementById('onlineLinkBox').classList.remove('hidden');
    document.getElementById('inviteLink').value=netInviteUrl(code);
  },err=>{
    document.getElementById('createLinkBtn').disabled=false;
    netShowError(err);
  });
};
document.getElementById('copyLinkBtn').onclick=()=>{
  const inp=document.getElementById('inviteLink');
  inp.select(); inp.setSelectionRange(0,99999);
  try{ navigator.clipboard.writeText(inp.value); }catch(e){ document.execCommand('copy'); }
  const btn=document.getElementById('copyLinkBtn');
  const old=btn.textContent; btn.textContent='הועתק! ✓';
  setTimeout(()=>btn.textContent=old,1400);
};
document.getElementById('joinBtn').onclick=()=>{
  const code=netExtractCode(document.getElementById('joinCodeInput').value);
  if(!code){ netShowError('הדביקו קישור הזמנה תקין.'); return; }
  netClearError();
  document.getElementById('joinBtn').disabled=true;
  document.getElementById('onlineHostBox').classList.add('hidden');
  document.getElementById('onlineJoinBox').classList.add('hidden');
  document.getElementById('onlineStatus').textContent='מתחברים…';
  document.getElementById('onlineLinkBox').classList.remove('hidden');
  document.getElementById('inviteLink').closest('.row').classList.add('hidden');
  document.getElementById('copyLinkBtn').closest('.row').classList.add('hidden');
  netGuestJoin(code,
    status=>document.getElementById('onlineStatus').textContent=status,
    err=>{
      document.getElementById('joinBtn').disabled=false;
      document.getElementById('onlineHostBox').classList.remove('hidden');
      document.getElementById('onlineJoinBox').classList.remove('hidden');
      document.getElementById('onlineLinkBox').classList.add('hidden');
      netShowError(err);
    });
};
(function netAutoJoin(){
  const params=new URLSearchParams(location.search);
  const room=params.get('room');
  if(!room) return;
  try{ history.replaceState(null,'',location.pathname); }catch(e){}
  document.querySelectorAll('#modeRow .opt').forEach(x=>x.classList.toggle('on',x.dataset.m==='online'));
  mode='online'; refreshMenu();
  document.getElementById('onlineHostBox').classList.add('hidden');
  document.getElementById('onlineJoinBox').classList.add('hidden');
  document.getElementById('onlineLinkBox').classList.remove('hidden');
  document.getElementById('inviteLink').closest('.row').classList.add('hidden');
  document.getElementById('copyLinkBtn').closest('.row').classList.add('hidden');
  document.getElementById('onlineStatus').textContent='מתחברים…';
  netGuestJoin(room,
    status=>document.getElementById('onlineStatus').textContent=status,
    err=>netShowError(err));
})();

genMaze(); tanks=[]; refreshMenu(); updateHud(); layout();
