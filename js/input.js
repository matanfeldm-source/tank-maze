// input.js — Keyboard, mouse, canvas twin-stick and the on-screen pads, plus the portrait/landscape layout.
// Loaded as a classic script; top-level let/const are shared with the other files.

// ───────────────────────── input ─────────────────────────
const keys={};
const mouse={x:W/2,y:H/2,down:false,has:false};
const KEYMAP=[
  {up:'w',down:'s',left:'a',right:'d',fire:' ',mine:'e'},
  {up:'arrowup',down:'arrowdown',left:'arrowleft',right:'arrowright',fire:'enter',fire2:'0',mine:'/'},
];
addEventListener('keydown',e=>{
  const k=e.key.toLowerCase();
  if(['arrowup','arrowdown','arrowleft','arrowright',' ','enter','/'].includes(k)) e.preventDefault();
  keys[k]=true;
  if(k==='e'){ if(netRole==='guest') netSendMine(); else dropMine(tanks[0]); }
  if((k==='/'||k==='.') && mode==='duo') dropMine(tanks[1]);
  if(k==='escape') togglePause();
});
addEventListener('keyup',e=>keys[e.key.toLowerCase()]=false);

function canvasPos(ev){
  const r=cv.getBoundingClientRect();
  return {x:(ev.clientX-r.left)*(W/r.width), y:(ev.clientY-r.top)*(H/r.height)};
}
cv.addEventListener('mousemove',e=>{const p=canvasPos(e);mouse.x=p.x;mouse.y=p.y;mouse.has=true;});
cv.addEventListener('mousedown',e=>{e.preventDefault();const p=canvasPos(e);mouse.x=p.x;mouse.y=p.y;mouse.has=true;mouse.down=true;});
addEventListener('mouseup',()=>mouse.down=false);

const sticks={move:null,aim:null};
function touchStart(e){
  if(mode==='duo') return;
  for(const t of e.changedTouches){
    const p=canvasPos(t);
    const s={id:t.identifier,ox:p.x,oy:p.y,x:p.x,y:p.y};
    if(p.x<W/2 && !sticks.move) sticks.move=s;
    else if(p.x>=W/2 && !sticks.aim) sticks.aim=s;
  }
  e.preventDefault();
}
function touchMove(e){
  if(mode==='duo') return;
  for(const t of e.changedTouches){
    const p=canvasPos(t);
    for(const k of ['move','aim']) if(sticks[k]&&sticks[k].id===t.identifier){sticks[k].x=p.x;sticks[k].y=p.y;}
  }
  e.preventDefault();
}
function touchEnd(e){
  for(const t of e.changedTouches)
    for(const k of ['move','aim']) if(sticks[k]&&sticks[k].id===t.identifier) sticks[k]=null;
}
cv.addEventListener('touchstart',touchStart,{passive:false});
cv.addEventListener('touchmove',touchMove,{passive:false});
cv.addEventListener('touchend',touchEnd,{passive:false});
cv.addEventListener('touchcancel',touchEnd,{passive:false});
// a finger that was released while the board was busy must not stay drawn
function syncTouches(e){
  const ids=new Set(Array.from(e.touches||[],t=>t.identifier));
  for(const k of ['move','aim']) if(sticks[k] && !ids.has(sticks[k].id)) sticks[k]=null;
}
addEventListener('touchend',syncTouches,{passive:true});
addEventListener('touchcancel',syncTouches,{passive:true});
addEventListener('blur',()=>{
  sticks.move=null; sticks.aim=null;
  for(let i=0;i<2;i++){ padVec[i].x=0; padVec[i].y=0; padFire[i]=false; }
  document.querySelectorAll('.knob').forEach(k=>k.style.transform='translate(0,0)');
});
let lastTap=0;
cv.addEventListener('touchstart',()=>{
  if(mode==='duo') return;
  const n=performance.now();
  if(n-lastTap<280){ if(netRole==='guest') netSendMine(); else dropMine(tanks[0]); }
  lastTap=n;
},{passive:true});

const padVec=[{x:0,y:0},{x:0,y:0}], padFire=[false,false];
function bindPad(el,idx){
  const zone=el.querySelector('.stickzone'), knob=el.querySelector('.knob');
  let id=null, ox=0, oy=0;
  zone.addEventListener('pointerdown',e=>{
    id=e.pointerId; zone.setPointerCapture(id); ox=e.clientX; oy=e.clientY;
    padVec[idx].x=0; padVec[idx].y=0; zone.classList.add('active'); e.preventDefault();
  });
  zone.addEventListener('pointermove',e=>{
    if(e.pointerId!==id) return;
    let dx=e.clientX-ox, dy=e.clientY-oy;
    const d=Math.hypot(dx,dy), max=50;
    if(d>max){dx*=max/d;dy*=max/d;}
    padVec[idx].x=dx; padVec[idx].y=dy;
    knob.style.transform='translate('+dx+'px,'+dy+'px)';
  });
  const end=e=>{
    if(e.pointerId!==id) return;
    id=null; padVec[idx].x=0; padVec[idx].y=0; knob.style.transform='translate(0,0)';
    zone.classList.remove('active');
  };
  zone.addEventListener('pointerup',end);
  zone.addEventListener('pointercancel',end);
  const fb=el.querySelector('.fire');
  fb.addEventListener('pointerdown',e=>{padFire[idx]=true;e.preventDefault();});
  const off=()=>padFire[idx]=false;
  fb.addEventListener('pointerup',off); fb.addEventListener('pointercancel',off); fb.addEventListener('pointerleave',off);
  el.querySelector('.mine').addEventListener('pointerdown',e=>{
    if(netRole==='guest') netSendMine(); else dropMine(tanks[mode==='duo'?idx:0]);
    e.preventDefault();
  });
}
const pad1=document.getElementById('pad1'), pad2=document.getElementById('pad2');
bindPad(pad1,0); bindPad(pad2,1);

// ───────────────────────── layout (portrait / landscape) ─────────────────────────
function layout(){
  const land = window.innerWidth > window.innerHeight;
  const on = isTouch && phase!=='menu' && (mode==='duo' || land);
  document.body.classList.toggle('land',land);
  document.body.classList.toggle('padsOn',on);
  document.body.classList.toggle('solo',mode!=='duo');
  const sideL=document.getElementById('sideL'), sideR=document.getElementById('sideR');
  const stage=document.getElementById('stage');
  if(land){ sideR.appendChild(pad1); sideL.appendChild(pad2); }
  else { const pb=document.getElementById('padsBottom'); pb.appendChild(pad2); pb.appendChild(pad1); }
  if(land){
    const hudH=document.getElementById('hud').offsetHeight||32;
    const sideW = on ? Math.round(Math.min(164,Math.max(102,innerWidth*0.17))) : 0;
    const availH = innerHeight-hudH-14;
    const availW = innerWidth-sideW*2-(on?24:12);
    const w = Math.max(180,Math.min(availW, availH*(W/H)));
    stage.style.width=w+'px'; stage.style.maxWidth='none';
    sideL.style.width=sideR.style.width=sideW+'px';
  }else{
    stage.style.width=''; stage.style.maxWidth='';
    sideL.style.width=sideR.style.width='';
  }
}
addEventListener('resize',layout);
addEventListener('orientationchange',()=>setTimeout(layout,150));
addEventListener('fullscreenchange',()=>setTimeout(layout,150));
