// entities.js — Tanks, bullets, mines, power-ups and rockets: everything that lives on the board.
// Loaded as a classic script; top-level let/const are shared with the other files.

// ───────────────────────── combat ─────────────────────────
function bulletCfg(t){
  return {
    bounce: t.buffs.ricochet ? 9 : BBOUNCE,
    life:   t.buffs.ricochet ? 15 : BLIFE,
    gap:    t.buffs.rapid ? .28 : .72,
    max:    t.buffs.rapid ? 6 : 4,
  };
}
function fire(t){
  if(!t||!t.alive||phase!=='play'||tSpawn>0||t.frozen>0||t.cool>0) return;
  const cfg=bulletCfg(t);
  const useLaser = t.laser>0;
  if(!useLaser && bullets.filter(b=>b.owner===t.team&&!b.laser&&!b.pellet).length>=cfg.max) return;
  t.cool = (useLaser ? .55 : cfg.gap) * (t.buffs.jam ? 3 : 1);
  t.recoil=1;
  matchStats[t.team].shots++;
  if(t.buffs.shotgun && !useLaser){          // קנה קצר, פיזור רחב, טווח קטן
    t.cool = .95 * (t.buffs.jam?3:1);
    for(let i=0;i<8;i++){
      const a=t.turret+(Math.random()-.5)*0.66, sp=225+Math.random()*70;
      let mx=t.x+Math.cos(a)*(TANK_R+5), my=t.y+Math.sin(a)*(TANK_R+5);
      if(hitsWall(mx,my,BR)){ mx=t.x; my=t.y; }
      bullets.push({x:mx,y:my,stuck:0,vx:Math.cos(a)*sp,vy:Math.sin(a)*sp,owner:t.team,
        life:.8,maxLife:.8,bounces:0,max:1,age:0,laser:false,pellet:true,
        breaks:0,split:false,cancel:!!t.buffs.parry,trail:[]});
    }
    for(let i=0;i<12;i++) puff(t.x+Math.cos(t.turret)*14,t.y+Math.sin(t.turret)*14,'#ffd166',t.turret,150);
    shake=Math.min(9,shake+4);
    beep(160,.18,'sawtooth',.07,-90);
    return;
  }
  if(useLaser){ t.laser--; updateHud(); }
  const angs = (t.buffs.triple && !useLaser) ? [-0.16,0,0.16] : [0];
  for(const off of angs){
    const a=t.turret+off;
    let mx=t.x+Math.cos(a)*(TANK_R+5), my=t.y+Math.sin(a)*(TANK_R+5);
    if(hitsWall(mx,my,BR)){ mx=t.x; my=t.y; }
    const sp = useLaser ? LASER_SPEED : BSPEED;
    bullets.push({x:mx,y:my,stuck:0,vx:Math.cos(a)*sp,vy:Math.sin(a)*sp,owner:t.team,
      life: useLaser?LASER_LIFE:cfg.life, maxLife: useLaser?LASER_LIFE:cfg.life,
      bounces:0, max: useLaser?LASER_BOUNCE:cfg.bounce, age:0,
      laser:useLaser, breaks: t.buffs.breaker?2:0, split: !!t.buffs.split && !useLaser,
      cancel: !!t.buffs.parry, trail:[]});
  }
  for(let i=0;i<6;i++) puff(t.x+Math.cos(t.turret)*15,t.y+Math.sin(t.turret)*15,
      useLaser?'#ff7d95':(t.team?'#ffb08a':'#9fe6ff'),t.turret,useLaser?110:60);
  if(useLaser) beep(1150,.22,'sawtooth',.06,-900);
  else beep(t.buffs.rapid?520:330,.09,'square',.05,-160);
}
function dropMine(t){
  if(!t||!t.alive||t.mines<=0||phase!=='play'||t.frozen>0) return;
  t.mines--; updateHud();
  mines.push({x:t.x,y:t.y,owner:t.team,arm:1.0,fuse:6,r:44});
  beep(180,.12,'sine',.05);
}
function puff(x,y,col,ang,spd){
  const a=(ang??Math.random()*7)+(Math.random()-.5)*.9;
  const s=spd*(.3+Math.random());
  parts.push({x,y,vx:Math.cos(a)*s,vy:Math.sin(a)*s,life:.35+Math.random()*.4,max:.75,col,r:1+Math.random()*2.2});
}
function boom(x,y,col){
  for(let i=0;i<34;i++){
    const a=Math.random()*7, s=40+Math.random()*180;
    parts.push({x,y,vx:Math.cos(a)*s,vy:Math.sin(a)*s,life:.4+Math.random()*.7,max:1.1,
      col:Math.random()<.4?'#ffd88a':col,r:1.4+Math.random()*3});
  }
  shake=Math.min(14,shake+11);
  beep(90,.4,'sawtooth',.09,-60);
  explode(true);
}
function confetti(){
  const cols=['#3ec6f0','#f2704f','#7ee787','#ffd166','#d2a8ff','#ff8fb1'];
  for(let i=0;i<70;i++){
    parts.push({x:Math.random()*W,y:-6-Math.random()*40,
      vx:(Math.random()-.5)*70,vy:40+Math.random()*60,
      life:1.6+Math.random()*.9,max:2.4,col:cols[(Math.random()*cols.length)|0],
      r:2+Math.random()*2.4,grav:130});
  }
}
function clearGhostTouch(){
  sticks.move=null; sticks.aim=null;
  padFire[0]=padFire[1]=false;
}
function killTank(t){
  if(!t.alive) return;
  if(t.shield){ t.shield=false; boom(t.x,t.y,'#79c0ff'); updateHud(); return; }
  t.alive=false;
  boom(t.x,t.y,t.team?'#f2704f':'#3ec6f0');
  const winner=t.team?0:1;
  score[winner]++; updateHud();
  msg = (mode==='duo'||mode==='online') ? 'הסיבוב ל'+(winner?'כתום':'כחול')
                     : (winner===0?'הסיבוב שלך':'הבוט לקח את הסיבוב');
  phase='roundEnd'; phaseT=2.0;
  clearGhostTouch();
  if(score[0]>=WIN||score[1]>=WIN){ phase='matchEnd'; phaseT=1.3; confetti(); }
}

// ───────────────────────── movement & control ─────────────────────────
function moveTank(t,dx,dy,dt){
  const len=Math.hypot(dx,dy);
  if(len<.01) return;
  dx/=len; dy/=len;
  if(t.buffs.reverse){ dx=-dx; dy=-dy; }
  const base=t.human?92:DIFF[diff].speed;
  const sp=base*(t.buffs.speed?1.55:1)*(t.buffs.sludge?.45:1);
  const want=Math.atan2(dy,dx);
  const d=((want-t.ang+Math.PI*3)%(Math.PI*2))-Math.PI;
  t.ang+=d*Math.min(1,dt*11);
  const nx=t.x+dx*sp*dt, ny=t.y+dy*sp*dt;
  if(!hitsWall(nx,t.y,TANK_R)) t.x=nx;
  if(!hitsWall(t.x,ny,TANK_R)) t.y=ny;
  t.tread+=sp*dt;
}
function updateHuman(t,idx,dt){
  if(t.frozen>0){ t.frozen-=dt; return; }
  const km=KEYMAP[idx];
  let dx=0,dy=0;
  if(keys[km.up]) dy--;
  if(keys[km.down]) dy++;
  if(keys[km.left]) dx--;
  if(keys[km.right]) dx++;
  if(mode==='duo'){
    const v=padVec[idx];
    if(Math.hypot(v.x,v.y)>6){ dx+=v.x; dy+=v.y; }
  } else {
    if(sticks.move){
      const vx=sticks.move.x-sticks.move.ox, vy=sticks.move.y-sticks.move.oy;
      if(Math.hypot(vx,vy)>7){dx+=vx;dy+=vy;}
    }
    const mv=padVec[1];                      // left side pad = driving
    if(Math.hypot(mv.x,mv.y)>6){ dx+=mv.x; dy+=mv.y; }
  }
  let shooting = keys[km.fire] || (km.fire2 && keys[km.fire2]);
  if(mode==='duo'){ if(padFire[idx]) shooting=true; }
  else if(padFire[0]) shooting=true;
  if(t.rc && !t.rc.dead){           // steering the drone instead of the tank
    t.rc.ix=dx; t.rc.iy=dy;
    if(shooting && t.rc.arm<=0) detonate(t.rc);
    return;
  }
  moveTank(t,dx,dy,dt);
  if(mode==='duo'){
    t.turret=t.ang;
    if(padFire[idx]) shooting=true;
  } else {
    const am=padVec[0];                      // right side pad = aiming
    if(Math.hypot(am.x,am.y)>10){ t.turret=Math.atan2(am.y,am.x); shooting=true; }
    if(padFire[0]) shooting=true;
    if(sticks.aim){
      const vx=sticks.aim.x-sticks.aim.ox, vy=sticks.aim.y-sticks.aim.oy;
      if(Math.hypot(vx,vy)>10){ t.turret=Math.atan2(vy,vx); shooting=true; }
    } else if(mouse.has && Math.hypot(am.x,am.y)<=10){
      t.turret=Math.atan2(mouse.y-t.y,mouse.x-t.x);
      if(mouse.down) shooting=true;
    }
  }
  if(shooting) fire(t);
}
function updateBot(b,dt){
  if(b.frozen>0){ b.frozen-=dt; return; }
  if(b.rc && !b.rc.dead) return;
  const p=tanks[0], D=DIFF[diff], ai=b.ai;
  ai.think-=dt; ai.repath-=dt; ai.hold-=dt;
  if(ai.think<=0){ ai.think=D.react; ai.aim=solveAim(b,p.x,p.y,b.buffs.ricochet?4:D.bounce); }
  if(ai.aim){
    const want=ai.aim.a+ai.aim.jit;
    const d=((want-b.turret+Math.PI*3)%(Math.PI*2))-Math.PI;
    b.turret+=d*Math.min(1,dt*(3.5+diff*1.6));
    if(Math.abs(d)<.10 && ai.hold<=0 && tSpawn<=0){
      if(!hitsWall(b.x+Math.cos(b.turret)*(TANK_R+5),b.y+Math.sin(b.turret)*(TANK_R+5),BR)){
        fire(b); ai.hold=D.fireGap*(.7+Math.random()*.6); ai.aim=null;
      }
    }
  } else b.turret+=dt*1.2;

  const esc=threatDir(b);
  if(esc!==null && Math.random()<D.dodge+.2){
    let dx=Math.cos(esc)*ai.strafe, dy=Math.sin(esc)*ai.strafe;
    if(hitsWall(b.x+dx*16,b.y+dy*16,TANK_R)){ ai.strafe*=-1; dx=-dx; dy=-dy; }
    moveTank(b,dx,dy,dt);
    return;
  }
  if(ai.repath<=0 || !ai.target){
    ai.repath=.7;
    const db=bfs(...tileOf(b.x,b.y)), dp=bfs(...tileOf(p.x,p.y));
    let goal=null,bestScore=-1e9;
    for(const [c,r] of freeTiles()){
      const distB=db[r][c], distP=dp[r][c];
      if(distB<0||distP<0) continue;
      let s=-distB*1.1-Math.abs(distP-6)*2.2;
      if(distP<3) s-=25;
      for(const pu of pups){
        const [pc,pr]=tileOf(pu.x,pu.y);
        if(pc===c&&pr===r) s+=40-distB*1.4;
      }
      s+=Math.random()*4;
      if(s>bestScore){bestScore=s;goal=[c,r];}
    }
    ai.target=goal; ai.field=goal?bfs(goal[0],goal[1]):null;
  }
  if(ai.field){
    const [c,r]=tileOf(b.x,b.y);
    const here=ai.field[r]?.[c] ?? -1;
    let best=null,bv=here;
    for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]){
      const nc=c+dx,nr=r+dy;
      if(solidAt(nc,nr)) continue;
      const v=ai.field[nr][nc];
      if(v>=0&&(bv<0||v<bv)){bv=v;best=[nc,nr];}
    }
    if(best) moveTank(b,cxOf(best[0])-b.x,cyOf(best[1])-b.y,dt);
    else if(here===0) ai.repath=Math.min(ai.repath,.15);
  }
  if(b.mines>0 && Math.random()<dt*0.35) dropMine(b);
}

// ───────────────────────── rockets: הטיל העוקב והרחפן ─────────────────────────
function los(x1,y1,x2,y2){
  const d=Math.hypot(x2-x1,y2-y1), n=Math.ceil(d/4);
  for(let i=1;i<n;i++){
    const t=i/n;
    if(hitsWall(x1+(x2-x1)*t, y1+(y2-y1)*t, 2)) return false;
  }
  return true;
}
function moveRocket(o,ang,speed,dt){
  const nx=o.x+Math.cos(ang)*speed*dt, ny=o.y+Math.sin(ang)*speed*dt;
  let moved=false;
  if(!hitsWall(nx,o.y,5)){ o.x=nx; moved=true; }
  if(!hitsWall(o.x,ny,5)){ o.y=ny; moved=true; }
  return moved;
}
function steerRocket(o,tx,ty,dt,turn){
  o.repath-=dt;
  const [tc,tr]=tileOf(tx,ty);
  if(o.repath<=0 || !o.field || o.ftile[0]!==tc || o.ftile[1]!==tr){
    o.field=bfs(tc,tr); o.ftile=[tc,tr]; o.repath=.4;
  }
  let want;
  if(los(o.x,o.y,tx,ty)) want=Math.atan2(ty-o.y,tx-o.x);
  else{
    const [c,r]=tileOf(o.x,o.y);
    let best=null, bv=o.field[r]?.[c] ?? -1;
    for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]){
      const nc=c+dx, nr=r+dy;
      if(solidAt(nc,nr)) continue;
      const v=o.field[nr][nc];
      if(v>=0 && (bv<0||v<bv)){ bv=v; best=[nc,nr]; }
    }
    want = best ? Math.atan2(cyOf(best[1])-o.y, cxOf(best[0])-o.x)
                : Math.atan2(ty-o.y,tx-o.x);
  }
  const d=((want-o.ang+Math.PI*3)%(Math.PI*2))-Math.PI;
  o.ang += Math.max(-turn*dt, Math.min(turn*dt, d));
}
function launchRocket(t,kind){
  const o={kind,owner:t.team,x:t.x+Math.cos(t.turret)*13,y:t.y+Math.sin(t.turret)*13,
    ang:t.turret,life:kind==='homing'?Infinity:8.5,arm:kind==='drone'?.8:.4,
    field:null,ftile:[-1,-1],repath:0,ix:0,iy:0,stuckT:0,t:0};
  if(hitsWall(o.x,o.y,5)){ o.x=t.x; o.y=t.y; }
  rockets.push(o);
  if(kind==='drone') t.rc=o;
  beep(kind==='homing'?200:520,.35,'sawtooth',.06,kind==='homing'?260:-120);
}
function detonate(o,silent){
  if(o.dead) return;
  o.dead=true;
  const me=tanks.find(t=>t.team===o.owner);
  if(me && me.rc===o) me.rc=null;
  if(!silent){
    boom(o.x,o.y,o.kind==='drone'?'#a78bfa':'#ff9f43');
    for(const t of tanks) if(t.alive && Math.hypot(t.x-o.x,t.y-o.y)<42) killTank(t);
  }
}
function updateRockets(dt){
  for(const o of rockets){
    o.life-=dt; o.arm-=dt; o.t+=dt;
    const me=tanks.find(t=>t.team===o.owner);
    const enemy=tanks.find(t=>t.team!==o.owner && t.alive);
    if(!me||!me.alive){ detonate(o,true); continue; }
    let moved;
    if(o.kind==='homing'){
      if(enemy) steerRocket(o,enemy.x,enemy.y,dt,3.6);
      moved=moveRocket(o,o.ang,88,dt);
    }else{
      if(me.human && me.frozen<=0){
        if(Math.hypot(o.ix,o.iy)>.05){
          const want=Math.atan2(o.iy,o.ix);
          const d=((want-o.ang+Math.PI*3)%(Math.PI*2))-Math.PI;
          o.ang+=d*Math.min(1,dt*12);
        }
      } else if(enemy) steerRocket(o,enemy.x,enemy.y,dt,7);
      moved=moveRocket(o,o.ang,122,dt);
    }
    o.stuckT = moved ? 0 : o.stuckT+dt;
    if(o.stuckT>0.25){ o.ang += (Math.random()<.5?1:-1)*0.9; o.stuckT=0; }
    if(Math.random()<dt*30)
      puff(o.x-Math.cos(o.ang)*7,o.y-Math.sin(o.ang)*7,
        o.kind==='drone'?'#a78bfa':'#ffb768',o.ang+Math.PI,40);
    if(enemy && Math.hypot(enemy.x-o.x,enemy.y-o.y)<TANK_R+5){
      o.dead=true;
      const me2=tanks.find(t=>t.team===o.owner); if(me2&&me2.rc===o) me2.rc=null;
      boom(o.x,o.y,o.kind==='drone'?'#a78bfa':'#ff9f43');
      killTank(enemy);
      continue;
    }
    if(o.kind!=='homing' && o.life<=0) detonate(o);
  }
  rockets=rockets.filter(o=>!o.dead);
}
function drawRockets(){
  for(const o of rockets){
    if(o.kind==='drone'){
      const me=tanks.find(t=>t.team===o.owner);
      if(me&&me.alive){
        ctx.save(); ctx.setLineDash([3,5]); ctx.lineDashOffset=-time*24;
        ctx.strokeStyle='rgba(167,139,250,.35)'; ctx.lineWidth=1;
        ctx.beginPath(); ctx.moveTo(me.x,me.y); ctx.lineTo(o.x,o.y); ctx.stroke(); ctx.restore();
      }
      ctx.save(); ctx.translate(o.x,o.y);
      ctx.fillStyle='rgba(167,139,250,.18)'; ctx.beginPath(); ctx.arc(0,0,11,0,7); ctx.fill();
      ctx.fillStyle='#a78bfa'; ctx.beginPath(); ctx.arc(0,0,5,0,7); ctx.fill();
      ctx.strokeStyle='rgba(220,205,255,.9)'; ctx.lineWidth=1.4;
      for(let i=0;i<4;i++){
        const a=time*14+i*Math.PI/2;
        ctx.beginPath(); ctx.arc(Math.cos(a)*7,Math.sin(a)*7,2.4,0,7); ctx.stroke();
      }
      ctx.restore();
    }else{
      ctx.save(); ctx.translate(o.x,o.y); ctx.rotate(o.ang);
      ctx.fillStyle='rgba(255,159,67,.2)'; ctx.beginPath(); ctx.arc(-6,0,5+Math.random()*2,0,7); ctx.fill();
      ctx.fillStyle='#ff9f43';
      ctx.beginPath(); ctx.moveTo(9,0); ctx.lineTo(-5,4); ctx.lineTo(-5,-4); ctx.closePath(); ctx.fill();
      ctx.fillStyle='#ffe0b8'; ctx.fillRect(-2,-1.2,5,2.4);
      ctx.restore();
      const enemy=tanks.find(t=>t.team!==o.owner&&t.alive);
      if(enemy && Math.hypot(enemy.x-o.x,enemy.y-o.y)<70){
        ctx.strokeStyle='rgba(255,159,67,'+(.35+.35*Math.sin(time*11))+')';
        ctx.lineWidth=1.6; ctx.beginPath(); ctx.arc(enemy.x,enemy.y,TANK_R+7,0,7); ctx.stroke();
      }
    }
  }
}

// ───────────────────────── world updates ─────────────────────────
function tryBreak(b,px,py){
  if(b.breaks<=0) return false;
  const c=Math.floor(px/TILE), r=Math.floor(py/TILE);
  if(c<1||r<1||c>=COLS-1||r>=ROWS-1||!grid[r][c]) return false;
  grid[r][c]=0; b.breaks--;
  for(let i=0;i<16;i++) puff(cxOf(c),cyOf(r),Math.random()<.5?'#7d97ad':'#c9a227',null,110);
  shake=Math.min(11,shake+5);
  beep(150,.2,'sawtooth',.06,-60);
  noiseBurst(.22,.1,500);
  return true;
}
let spawnQueue=[];
function onBounce(b){
  for(let i=0;i<4;i++) puff(b.x,b.y,b.laser?'#ffd0d8':'#ffe6a8',null,55);
  beep(b.laser?980:760+Math.random()*220,.05,'triangle',.03,-260);
  if(b.split && b.bounces>=2){
    b.split=false;
    const a0=Math.atan2(b.vy,b.vx), sp=Math.hypot(b.vx,b.vy);
    for(const off of [-0.55,0.55]){
      const a=a0+off;
      spawnQueue.push({x:b.x,y:b.y,stuck:0,vx:Math.cos(a)*sp,vy:Math.sin(a)*sp,owner:b.owner,
        life:Math.max(2.5,b.life*.7),maxLife:b.maxLife,bounces:b.bounces,max:b.max,age:b.age,
        laser:false,breaks:0,split:false,trail:[]});
    }
    beep(620,.1,'square',.04,180);
  }
}
function updateBullets(dt){
  for(const b of bullets){
    b.age+=dt; b.life-=dt;
    const steps=b.laser?4:2, sdt=dt/steps;
    for(let s=0;s<steps;s++){
      const nx=b.x+b.vx*sdt;
      if(hitsWall(nx,b.y,BR)){
        if(tryBreak(b,nx+Math.sign(b.vx)*BR,b.y)) b.x=nx;
        else { b.vx=-b.vx; b.bounces++; onBounce(b); }
      } else b.x=nx;
      const ny=b.y+b.vy*sdt;
      if(hitsWall(b.x,ny,BR)){
        if(tryBreak(b,b.x,ny+Math.sign(b.vy)*BR)) b.y=ny;
        else { b.vy=-b.vy; b.bounces++; onBounce(b); }
      } else b.y=ny;
    }
    b.stuck = hitsWall(b.x,b.y,1) ? b.stuck+dt : 0;
    if(b.stuck>0.25) b.dead=true;
    b.trail.push(b.x,b.y);
    const tmax=b.laser?46:18;
    while(b.trail.length>tmax) b.trail.splice(0,2);
    if(b.bounces>b.max||b.life<=0){
      b.dead=true;
      for(let i=0;i<6;i++) puff(b.x,b.y,'#93a7b8',null,40);
    }
    for(const t of tanks){
      if(!t.alive) continue;
      if(t.team===b.owner && b.age<0.28) continue;
      if(Math.hypot(t.x-b.x,t.y-b.y)<TANK_R+BR){
        b.dead=true;
        matchStats[b.owner].hits++;
        killTank(t);
      }
    }
    for(const m of mines) if(Math.hypot(m.x-b.x,m.y-b.y)<8){ b.dead=true; m.fuse=0; }
    for(const o of rockets){
      if(o.owner===b.owner || o.dead) continue;
      if(Math.hypot(o.x-b.x,o.y-b.y)<8){ b.dead=true; detonate(o,true); boom(o.x,o.y,'#ffd08a'); }
    }
  }
  for(let i=0;i<bullets.length;i++)for(let j=i+1;j<bullets.length;j++){
    const a=bullets[i], b=bullets[j];
    if(a.dead||b.dead||a.owner===b.owner) continue;
    if(!a.cancel&&!b.cancel) continue;
    if(Math.hypot(a.x-b.x,a.y-b.y) > BR*2+3) continue;
    if(a.cancel&&!b.cancel) b.dead=true;
    else if(b.cancel&&!a.cancel) a.dead=true;
    else { a.dead=true; b.dead=true; }
    for(let k=0;k<10;k++) puff((a.x+b.x)/2,(a.y+b.y)/2,'#67e8f9',null,90);
    beep(1300,.08,'triangle',.05,-700);
  }
  bullets=bullets.filter(b=>!b.dead);
  if(spawnQueue.length){ bullets=bullets.concat(spawnQueue); spawnQueue=[]; }
}
function updatePups(dt){
  if(phase!=='play') return;
  pupT-=dt;
  if(pupT<=0 && pups.length<3){
    pupT=5.5+Math.random()*4;
    const ft=freeTiles().filter(([c,r])=>{
      const x=cxOf(c),y=cyOf(r);
      return tanks.every(t=>Math.hypot(t.x-x,t.y-y)>60) && pups.every(p=>Math.hypot(p.x-x,p.y-y)>50);
    });
    if(ft.length){
      const [c,r]=ft[(Math.random()*ft.length)|0];
      pups.push({x:cxOf(c),y:cyOf(r),type:PBAG[(Math.random()*PBAG.length)|0],t:0,life:17});
      beep(880,.08,'sine',.035,300);
    }
  }
  for(const p of pups){
    p.t+=dt; p.life-=dt;
    if(p.life<=0) p.dead=true;
    for(const t of tanks)
      if(t.alive && Math.hypot(t.x-p.x,t.y-p.y)<TANK_R+9){ p.dead=true; grant(t,p.type); }
  }
  pups=pups.filter(p=>!p.dead);
}
function grant(t,type){
  const P=POWERS[type];
  if(type==='shield') t.shield=true;
  else if(type==='mine') t.mines=Math.min(3,t.mines+2);
  else if(type==='laser') t.laser=Math.min(4,t.laser+2);
  else if(type==='booby'){
    mines.push({x:t.x,y:t.y,owner:t.team,arm:.9,fuse:1.8,r:44});
  }
  else if(type==='doom'){
    t.doom=10; t.tick=1; t.shield=true;
    t.buffs.speed=10; t.buffs.rapid=10; t.buffs.triple=10; t.buffs.ricochet=10;
    marks.push({x:t.x,y:t.y,t:0,col:'#ff2e63'});
    beep(70,.9,'sawtooth',.09,90);
  }
  else if(type==='homing') launchRocket(t,'homing');
  else if(type==='drone'){ if(!t.rc) launchRocket(t,'drone'); }
  else if(type==='freeze'){
    const o=tanks.find(x=>x!==t);
    if(o&&o.alive){ o.frozen=1.7; marks.push({x:o.x,y:o.y,t:0,col:'#8fe9ff'}); beep(300,.5,'sine',.05,-180); }
  }
  else t.buffs[type]=P.dur;
  for(let i=0;i<18;i++) puff(t.x,t.y,P.col,null,95);
  if(isTrap(type)){
    marks.push({x:t.x,y:t.y,t:0,col:'#ff5a5a'});
    beep(340,.5,'square',.06,-230);
    shake=Math.min(9,shake+4);
  } else if(type!=='freeze') beep(t.team?300:660,.16,'sine',.05,260);
  updateHud();
}
function updateMines(dt){
  for(const m of mines){
    m.arm-=dt; m.fuse-=dt;
    if(m.arm<=0) for(const t of tanks)
      if(t.alive && Math.hypot(t.x-m.x,t.y-m.y)<26) m.fuse=Math.min(m.fuse,.35);
    if(m.fuse<=0){
      m.dead=true; boom(m.x,m.y,'#ff9f6b');
      for(const t of tanks) if(t.alive && Math.hypot(t.x-m.x,t.y-m.y)<m.r) killTank(t);
    }
  }
  mines=mines.filter(m=>!m.dead);
}
function updateParts(dt){
  for(const p of parts){
    p.life-=dt; p.x+=p.vx*dt; p.y+=p.vy*dt;
    if(p.grav){ p.vy+=p.grav*dt; p.vx*=.99; }
    else { p.vx*=.94; p.vy*=.94; }
  }
  parts=parts.filter(p=>p.life>0);
  for(const m of marks) m.t+=dt;
  marks=marks.filter(m=>m.t<.6);
}
