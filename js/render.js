// render.js — Everything that draws to the canvas, including the laser sight preview.
// Loaded as a classic script; top-level let/const are shared with the other files.

// ───────────────────────── laser sight ─────────────────────────
function laserPath(t){
  let x=t.x+Math.cos(t.turret)*(TANK_R+5), y=t.y+Math.sin(t.turret)*(TANK_R+5);
  if(hitsWall(x,y,BR)){ x=t.x; y=t.y; }
  let dx=Math.cos(t.turret), dy=Math.sin(t.turret), b=0;
  const pts=[x,y], step=2.6;
  const enemy=tanks.find(o=>o!==t&&o.alive);
  let hit=null;
  for(let s=0;s<620;s++){
    const nx=x+dx*step;
    if(hitsWall(nx,y,BR)){ dx=-dx; b++; pts.push(x,y); } else x=nx;
    const ny=y+dy*step;
    if(hitsWall(x,ny,BR)){ dy=-dy; b++; pts.push(x,y); } else y=ny;
    if(b>LASER_BOUNCE) break;
    if(enemy && s>4 && Math.hypot(enemy.x-x,enemy.y-y)<TANK_R+2){ hit=enemy; break; }
  }
  pts.push(x,y);
  return {pts,hit,end:[x,y]};
}
function drawLaserSight(t){
  const {pts,hit,end}=laserPath(t);
  ctx.save();
  ctx.setLineDash([7,6]); ctx.lineDashOffset=-time*40;
  ctx.strokeStyle=hit?'rgba(255,77,109,.85)':'rgba(255,77,109,.42)';
  ctx.lineWidth=hit?2:1.4;
  ctx.beginPath();
  for(let i=0;i<pts.length;i+=2) i?ctx.lineTo(pts[i],pts[i+1]):ctx.moveTo(pts[i],pts[i+1]);
  ctx.stroke();
  ctx.setLineDash([]);
  // bounce dots
  ctx.fillStyle='rgba(255,140,160,.5)';
  for(let i=2;i<pts.length-2;i+=2){ ctx.beginPath(); ctx.arc(pts[i],pts[i+1],2,0,7); ctx.fill(); }
  // impact marker
  const [ex,ey]=end, pulse=1+Math.sin(time*9)*.14;
  ctx.translate(ex,ey); ctx.scale(pulse,pulse);
  ctx.strokeStyle=hit?'#ff4d6d':'rgba(255,77,109,.75)'; ctx.lineWidth=2;
  ctx.beginPath(); ctx.arc(0,0,hit?11:7,0,7); ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(-5,-5);ctx.lineTo(5,5);ctx.moveTo(5,-5);ctx.lineTo(-5,5);
  ctx.stroke();
  ctx.restore();
}

// ───────────────────────── draw ─────────────────────────
function drawMaze(){
  ctx.fillStyle='#16232f'; ctx.fillRect(0,0,W,H);
  ctx.strokeStyle='rgba(255,255,255,.028)'; ctx.lineWidth=1;
  for(let c=0;c<=COLS;c++){ctx.beginPath();ctx.moveTo(c*TILE,0);ctx.lineTo(c*TILE,H);ctx.stroke();}
  for(let r=0;r<=ROWS;r++){ctx.beginPath();ctx.moveTo(0,r*TILE);ctx.lineTo(W,r*TILE);ctx.stroke();}
  for(let r=0;r<ROWS;r++)for(let c=0;c<COLS;c++){
    if(!grid[r][c]) continue;
    const x=c*TILE,y=r*TILE;
    ctx.fillStyle='#0b131c'; ctx.fillRect(x+1,y+3,TILE-2,TILE-2);
    ctx.fillStyle='#2d4459'; ctx.fillRect(x,y,TILE,TILE-2);
    ctx.fillStyle='#3f5e78'; ctx.fillRect(x,y,TILE,3);
    ctx.fillStyle='rgba(0,0,0,.18)'; ctx.fillRect(x,y+TILE-5,TILE,3);
  }
}
function roundRect(x,y,w,h,r){
  ctx.beginPath();
  ctx.moveTo(x+r,y); ctx.arcTo(x+w,y,x+w,y+h,r); ctx.arcTo(x+w,y+h,x,y+h,r);
  ctx.arcTo(x,y+h,x,y,r); ctx.arcTo(x,y,x+w,y,r); ctx.closePath();
}
function drawTank(t){
  if(!t.alive) return;
  const pc=colorOf(playerColor);
  const col=t.team?'#f2704f':pc.col, dark=t.team?'#a33e28':pc.dark;
  ctx.save(); ctx.translate(t.x,t.y);
  ctx.fillStyle='rgba(0,0,0,.35)'; ctx.beginPath(); ctx.ellipse(1,3,TANK_R+1,TANK_R-1,0,0,7); ctx.fill();
  ctx.rotate(t.ang);
  ctx.fillStyle=dark; ctx.fillRect(-9,-10,18,4); ctx.fillRect(-9,6,18,4);
  ctx.fillStyle='rgba(0,0,0,.4)';
  for(let i=-2;i<=2;i++){
    const o=((t.tread/6)%1)*4;
    ctx.fillRect(-8+i*4+o,-10,1.6,4); ctx.fillRect(-8+i*4+o,6,1.6,4);
  }
  ctx.fillStyle=col; roundRect(-8,-7,16,14,3); ctx.fill();
  ctx.fillStyle='rgba(255,255,255,.16)'; roundRect(-8,-7,16,5,3); ctx.fill();
  ctx.restore();
  ctx.save(); ctx.translate(t.x,t.y); ctx.rotate(t.turret);
  const rec=t.recoil*3;
  ctx.fillStyle=t.laser>0?'#ff4d6d':dark; ctx.fillRect(2-rec,-2,t.laser>0?15:13,4);
  ctx.fillStyle=col; ctx.beginPath(); ctx.arc(0,0,6,0,7); ctx.fill();
  ctx.fillStyle='rgba(255,255,255,.25)'; ctx.beginPath(); ctx.arc(-1.5,-1.5,2.4,0,7); ctx.fill();
  ctx.restore();
  if(t.shield){
    ctx.strokeStyle='rgba(121,192,255,'+(.55+.3*Math.sin(time*8))+')';
    ctx.lineWidth=2; ctx.beginPath(); ctx.arc(t.x,t.y,TANK_R+5,0,7); ctx.stroke();
  }
  if(t.frozen>0){
    ctx.fillStyle='rgba(143,233,255,.28)';
    ctx.beginPath(); ctx.arc(t.x,t.y,TANK_R+4,0,7); ctx.fill();
    ctx.strokeStyle='rgba(200,245,255,.8)'; ctx.lineWidth=1.4;
    for(let i=0;i<3;i++){
      const a=time*2+i*2.1, rr=TANK_R+5;
      ctx.beginPath();
      ctx.moveTo(t.x+Math.cos(a)*rr,t.y+Math.sin(a)*rr);
      ctx.lineTo(t.x+Math.cos(a+.4)*rr,t.y+Math.sin(a+.4)*rr);
      ctx.stroke();
    }
  }
  if(t.doom>0){
    const p=.5+.5*Math.sin(time*10);
    ctx.strokeStyle='rgba(255,46,99,'+(.45+.45*p)+')'; ctx.lineWidth=2.4;
    ctx.beginPath(); ctx.arc(t.x,t.y,TANK_R+7+p*3,0,7); ctx.stroke();
    ctx.fillStyle='#ff2e63'; ctx.font='800 13px system-ui'; ctx.textAlign='center';
    ctx.fillText(Math.ceil(t.doom),t.x,t.y-16);
  }
  if(t.buffs.reverse||t.buffs.sludge||t.buffs.jam){
    ctx.strokeStyle='rgba(255,90,90,'+(.3+.25*Math.sin(time*6))+')';
    ctx.lineWidth=1.4; ctx.setLineDash([3,4]);
    ctx.beginPath(); ctx.arc(t.x,t.y,TANK_R+7,0,7); ctx.stroke();
    ctx.setLineDash([]);
  }
  if(t.buffs.speed){
    ctx.fillStyle='rgba(126,231,135,.5)';
    ctx.beginPath();ctx.arc(t.x-Math.cos(t.ang)*11,t.y-Math.sin(t.ang)*11,2.5+Math.random(),0,7);ctx.fill();
  }
}
function drawBullets(){
  for(const b of bullets){
    const fade=Math.min(1,b.life/2.2);
    const col=b.laser?'#ff5c7a':(b.owner?'#ffb08a':'#9fe6ff');
    ctx.globalAlpha=.35+.65*fade;
    ctx.lineWidth=b.laser?2.6:2;
    ctx.strokeStyle=b.laser?'rgba(255,92,122,.45)'
      :(b.owner?'rgba(255,176,138,.3)':'rgba(159,230,255,.3)');
    ctx.beginPath();
    for(let i=0;i<b.trail.length;i+=2) i?ctx.lineTo(b.trail[i],b.trail[i+1]):ctx.moveTo(b.trail[i],b.trail[i+1]);
    ctx.stroke();
    const rad=(b.laser?BR+.8:BR)*(.6+.4*fade);
    if(b.laser){
      ctx.fillStyle='rgba(255,92,122,.25)';
      ctx.beginPath(); ctx.arc(b.x,b.y,rad+5,0,7); ctx.fill();
    }
    ctx.fillStyle=col; ctx.beginPath(); ctx.arc(b.x,b.y,rad,0,7); ctx.fill();
    ctx.fillStyle='rgba(255,255,255,.9)'; ctx.beginPath(); ctx.arc(b.x,b.y,1.3,0,7); ctx.fill();
    if(b.cancel){
      ctx.strokeStyle='rgba(103,232,249,.75)'; ctx.lineWidth=1.3;
      ctx.beginPath(); ctx.arc(b.x,b.y,rad+3.5,0,7); ctx.stroke();
    }
    if(b.breaks>0){
      ctx.strokeStyle='rgba(201,162,39,.8)'; ctx.lineWidth=1.2;
      ctx.beginPath(); ctx.arc(b.x,b.y,rad+3,0,7); ctx.stroke();
    } else if(b.bounces>0){
      ctx.strokeStyle=b.owner?'rgba(255,140,90,.5)':'rgba(120,220,255,.5)';
      ctx.lineWidth=1; ctx.beginPath(); ctx.arc(b.x,b.y,rad+2.5,0,7); ctx.stroke();
    }
    ctx.globalAlpha=1;
  }
}
function drawPups(){
  for(const p of pups){
    if(p.life<3 && Math.floor(p.life*8)%2===0) continue;
    const P=lookOf(p.type), y=p.y+Math.sin(p.t*3)*2;
    ctx.save(); ctx.translate(p.x,y); ctx.rotate(Math.sin(p.t*1.6)*.15);
    ctx.fillStyle='rgba(0,0,0,.35)'; roundRect(-9,-5,18,18,5); ctx.fill();
    ctx.fillStyle='#14212d'; ctx.strokeStyle=P.col; ctx.lineWidth=1.6;
    roundRect(-9,-9,18,18,5); ctx.fill(); ctx.stroke();
    ctx.fillStyle=P.col; ctx.font='11px system-ui'; ctx.textAlign='center'; ctx.textBaseline='middle';
    ctx.fillText(P.icon,0,1);
    ctx.restore();
  }
}
function drawMines(){
  for(const m of mines){
    const blink=m.fuse<1.4?(Math.floor(m.fuse*10)%2===0):(Math.floor(m.fuse*3)%2===0);
    ctx.fillStyle='#2a1a16'; ctx.beginPath(); ctx.arc(m.x,m.y,6,0,7); ctx.fill();
    ctx.fillStyle=blink?'#ff7b72':'#61352f'; ctx.beginPath(); ctx.arc(m.x,m.y,3,0,7); ctx.fill();
  }
}
function drawParts(){
  for(const p of parts){
    ctx.globalAlpha=Math.max(0,p.life/p.max);
    ctx.fillStyle=p.col; ctx.beginPath(); ctx.arc(p.x,p.y,p.r,0,7); ctx.fill();
  }
  for(const m of marks){
    ctx.globalAlpha=Math.max(0,1-m.t/.6);
    ctx.strokeStyle=m.col; ctx.lineWidth=2;
    ctx.beginPath(); ctx.arc(m.x,m.y,10+m.t*40,0,7); ctx.stroke();
  }
  ctx.globalAlpha=1;
}
function drawSticks(){
  if(mode==='duo') return;
  for(const k of ['move','aim']){
    const s=sticks[k]; if(!s) continue;
    const col=k==='move'?'rgba(190,215,235,':'rgba(62,198,240,';
    ctx.strokeStyle=col+'.30)'; ctx.lineWidth=2;
    ctx.beginPath(); ctx.arc(s.ox,s.oy,26,0,7); ctx.stroke();
    const dx=s.x-s.ox, dy=s.y-s.oy, d=Math.min(26,Math.hypot(dx,dy)), a=Math.atan2(dy,dx);
    ctx.fillStyle=col+'.5)';
    ctx.beginPath(); ctx.arc(s.ox+Math.cos(a)*d,s.oy+Math.sin(a)*d,11,0,7); ctx.fill();
  }
}
function drawCenter(big,small){
  ctx.textAlign='center'; ctx.textBaseline='middle';
  ctx.fillStyle='rgba(9,15,22,.55)'; ctx.fillRect(0,H/2-46,W,92);
  ctx.fillStyle='#eaf3fa'; ctx.font='800 34px system-ui'; ctx.fillText(big,W/2,H/2-8);
  if(small){ ctx.fillStyle='#8fa6b8'; ctx.font='600 15px system-ui'; ctx.fillText(small,W/2,H/2+24); }
}
