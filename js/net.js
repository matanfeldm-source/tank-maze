// net.js — Peer-to-peer online play over WebRTC (via PeerJS), invite links, host/guest sync.
// Loaded as a classic script; top-level let/const are shared with the other files.
// Model: the host runs the real simulation (like duo mode) and streams state to the guest;
// the guest sends back its input and just renders whatever the host tells it to.

const NET_PREFIX='tankduel-';
let netRole=null;              // null | 'host' | 'guest'
let netPeer=null, netConn=null;
let remoteInput={dx:0,dy:0,aim:null,fire:false};
let netSendAcc=0, netInputAcc=0;
let netPrevPhase=null;

function netRoomCode(){ return Math.random().toString(36).slice(2,8); }
function netInviteUrl(code){
  return location.origin+location.pathname+'?room='+code;
}

// ───────────────────────── host ─────────────────────────
function netHostCreate(onReady,onError){
  if(typeof Peer==='undefined'){ onError('שירות הרשת לא נטען. בדקו חיבור לאינטרנט ונסו שוב.'); return; }
  const code=netRoomCode();
  netRole='host';
  netPeer=new Peer(NET_PREFIX+code);
  netPeer.on('open',()=>onReady(code));
  netPeer.on('error',e=>onError(netErrText(e)));
  netPeer.on('connection',c=>{
    if(netConn){ c.close(); return; }        // only one guest at a time
    netConn=c;
    netConn.on('data',netHandleHostData);
    netConn.on('open',netOnGuestConnected);
    netConn.on('close',netOnPeerGone);
  });
}
function netOnGuestConnected(){
  document.getElementById('onlineStatus').textContent='היריב התחבר! מתחילים…';
  mode='online';
  document.getElementById('overlay').classList.add('hidden');
  document.getElementById('onlinePanel').classList.add('hidden');
  startMatch();
}
function netHandleHostData(msg){
  if(!msg) return;
  if(msg.t==='input'){ remoteInput.dx=msg.dx; remoteInput.dy=msg.dy; remoteInput.aim=msg.aim; remoteInput.fire=msg.fire; }
  else if(msg.t==='mine'){ if(tanks[1]) dropMine(tanks[1]); }
}
function netSendState(dt){
  netSendAcc+=dt;
  if(netSendAcc<1/30 || !netConn || !netConn.open) return;
  netSendAcc=0;
  netConn.send({
    t:'state', phase, phaseT, msg, tSpawn, roundNo, score, mode,
    grid: grid.map(row=>row.join('')).join(''),
    tanks: tanks.map(tk=>({
      team:tk.team, x:+tk.x.toFixed(1), y:+tk.y.toFixed(1),
      ang:+tk.ang.toFixed(3), turret:+tk.turret.toFixed(3),
      alive:tk.alive, frozen:tk.frozen, shield:tk.shield, doom:tk.doom,
      mines:tk.mines, laser:tk.laser, buffs:tk.buffs, recoil:tk.recoil, tread:tk.tread,
    })),
    bullets: bullets.map(b=>({x:+b.x.toFixed(1),y:+b.y.toFixed(1),owner:b.owner,laser:b.laser,
      bounces:b.bounces,cancel:b.cancel,breaks:b.breaks,life:b.life,trail:b.trail})),
    pups: pups.map(p=>({x:p.x,y:p.y,type:p.type,t:p.t,life:p.life})),
    mines: mines.map(m=>({x:m.x,y:m.y,owner:m.owner,fuse:m.fuse})),
    rockets: rockets.map(o=>({kind:o.kind,owner:o.owner,x:o.x,y:o.y,ang:o.ang,life:o.life})),
  });
}
function updateNetTank(t,dt){
  if(t.frozen>0){ t.frozen-=dt; return; }
  if(t.rc && !t.rc.dead){
    t.rc.ix=remoteInput.dx; t.rc.iy=remoteInput.dy;
    if(remoteInput.fire && t.rc.arm<=0) detonate(t.rc);
    return;
  }
  moveTank(t,remoteInput.dx,remoteInput.dy,dt);
  t.turret = remoteInput.aim!=null ? remoteInput.aim : t.ang;
  if(remoteInput.fire) fire(t);
}

// ───────────────────────── guest ─────────────────────────
function netGuestJoin(code,onStatus,onError){
  if(typeof Peer==='undefined'){ onError('שירות הרשת לא נטען. בדקו חיבור לאינטרנט ונסו שוב.'); return; }
  netRole='guest'; mode='online';
  netPeer=new Peer();
  netPeer.on('open',()=>{
    netConn=netPeer.connect(NET_PREFIX+code,{reliable:true});
    netConn.on('open',()=>onStatus('מחוברים! ממתינים להתחלה…'));
    netConn.on('data',netHandleGuestData);
    netConn.on('close',netOnPeerGone);
  });
  netPeer.on('error',e=>onError(netErrText(e)));
}
function netHandleGuestData(m){
  if(!m || m.t!=='state') return;
  const rows=[]; const flat=m.grid;
  for(let r=0;r<ROWS;r++){ const row=[]; for(let c=0;c<COLS;c++) row.push(+flat[r*COLS+c]); rows.push(row); }
  grid=rows;
  phase=m.phase; phaseT=m.phaseT; msg=m.msg; tSpawn=m.tSpawn; roundNo=m.roundNo; score=m.score; mode=m.mode;
  tanks=m.tanks.map(tk=>({...tk,human:false,cool:0,ai:{},rc:null}));
  bullets=m.bullets.map(b=>({...b}));
  pups=m.pups.map(p=>({...p}));
  mines=m.mines.map(mn=>({...mn}));
  rockets=m.rockets.map(o=>({...o}));
  if(netPrevPhase && netPrevPhase!=='menu' && phase==='menu') netGuestShowResult();
  else if(phase!=='menu') document.getElementById('overlay').classList.add('hidden');
  netPrevPhase=phase;
  updateHud();
}
function netGuestShowResult(){
  const ov=document.getElementById('overlay');
  ov.classList.remove('hidden');
  document.getElementById('onlinePanel').classList.add('hidden');
  ov.querySelector('h1').textContent = score[0]>=WIN ? 'כחול ניצח את הקרב' : 'כתום ניצח את הקרב';
  document.getElementById('sub').textContent='תוצאה '+score[0]+'–'+score[1]+'. ממתינים שהמארח יתחיל קרב חדש…';
  document.getElementById('start').classList.add('hide');
}
function netGuestGatherInput(){
  let dx=0,dy=0;
  const km=KEYMAP[0];
  if(keys[km.up]) dy--;
  if(keys[km.down]) dy++;
  if(keys[km.left]) dx--;
  if(keys[km.right]) dx++;
  if(sticks.move){
    const vx=sticks.move.x-sticks.move.ox, vy=sticks.move.y-sticks.move.oy;
    if(Math.hypot(vx,vy)>7){dx+=vx;dy+=vy;}
  }
  const mv=padVec[1];
  if(Math.hypot(mv.x,mv.y)>6){ dx+=mv.x; dy+=mv.y; }

  let aim=null, shooting = keys[km.fire] || (km.fire2 && keys[km.fire2]);
  if(padFire[0]) shooting=true;
  const am=padVec[0];
  if(Math.hypot(am.x,am.y)>10){ aim=Math.atan2(am.y,am.x); shooting=true; }
  if(sticks.aim){
    const vx=sticks.aim.x-sticks.aim.ox, vy=sticks.aim.y-sticks.aim.oy;
    if(Math.hypot(vx,vy)>10){ aim=Math.atan2(vy,vx); shooting=true; }
  } else if(mouse.has && Math.hypot(am.x,am.y)<=10 && tanks[1]){
    aim=Math.atan2(mouse.y-tanks[1].y, mouse.x-tanks[1].x);
    if(mouse.down) shooting=true;
  }
  return {dx,dy,aim,fire:shooting};
}
function netSendInput(dt){
  netInputAcc+=dt;
  if(netInputAcc<1/30 || !netConn || !netConn.open) return;
  netInputAcc=0;
  const inp=netGuestGatherInput();
  netConn.send({t:'input',dx:inp.dx,dy:inp.dy,aim:inp.aim,fire:inp.fire});
}
function netSendMine(){ if(netConn && netConn.open) netConn.send({t:'mine'}); }

// ───────────────────────── shared teardown / errors ─────────────────────────
function netErrText(e){
  const type=e&&e.type;
  if(type==='peer-unavailable') return 'לא נמצא יריב עם הקישור הזה. ודאו שהמארח עדיין פתוח וניסו שוב.';
  if(type==='unavailable-id') return 'קישור ההזמנה הזה כבר תפוס, נסו ליצור קישור חדש.';
  return 'שגיאת רשת. בדקו את החיבור לאינטרנט ונסו שוב.';
}
function netOnPeerGone(){
  const wasHost=netRole==='host';
  const ov=document.getElementById('overlay');
  ov.classList.remove('hidden');
  ov.querySelector('h1').textContent='החיבור התנתק';
  document.getElementById('sub').textContent = wasHost ? 'היריב התנתק מהמשחק. אפשר ליצור קישור חדש.' : 'החיבור למארח אבד. אפשר לנסות שוב.';
  phase='menu';
  netTeardown();
}
function netTeardown(){
  try{ if(netConn) netConn.close(); }catch(e){}
  try{ if(netPeer) netPeer.destroy(); }catch(e){}
  netConn=null; netPeer=null; netRole=null; netPrevPhase=null;
  remoteInput={dx:0,dy:0,aim:null,fire:false};
  document.getElementById('createLinkBtn').disabled=false;
  document.getElementById('joinBtn').disabled=false;
  document.getElementById('onlineHostBox').classList.remove('hidden');
  document.getElementById('onlineJoinBox').classList.remove('hidden');
  document.getElementById('onlineLinkBox').classList.add('hidden');
  document.getElementById('inviteLink').closest('.row').classList.remove('hidden');
  document.getElementById('copyLinkBtn').closest('.row').classList.remove('hidden');
  document.getElementById('joinCodeInput').value='';
  document.getElementById('onlineError').classList.add('hidden');
  if(typeof refreshMenu==='function') refreshMenu();
}
addEventListener('beforeunload',()=>{ try{ if(netPeer) netPeer.destroy(); }catch(e){} });
