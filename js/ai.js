// ai.js — The bot: ricochet shot solving, dodging and navigation.
// Loaded as a classic script; top-level let/const are shared with the other files.

// ───────────────────────── bot brain ─────────────────────────
function simShot(x,y,a,maxB,tx,ty,maxT){
  let vx=Math.cos(a)*BSPEED, vy=Math.sin(a)*BSPEED, b=0, t=0;
  const dt=1/50;
  for(let s=0;s<Math.ceil(maxT/dt);s++){
    let nx=x+vx*dt; if(hitsWall(nx,y,BR)){vx=-vx;b++;} else x=nx;
    let ny=y+vy*dt; if(hitsWall(x,ny,BR)){vy=-vy;b++;} else y=ny;
    if(b>maxB) return null;
    t+=dt;
    const dx=x-tx, dy=y-ty;
    if(t>0.10 && dx*dx+dy*dy < 169) return {t,bounces:b};
  }
  return null;
}
function solveAim(from,tx,ty,maxB){
  const N=72; let best=null;
  for(let i=0;i<N;i++){
    const a=(i/N)*Math.PI*2;
    const r=simShot(from.x,from.y,a,maxB,tx,ty,1.9);
    if(r && (!best || r.bounces<best.bounces || (r.bounces===best.bounces && r.t<best.t)))
      best={a,t:r.t,bounces:r.bounces,jit:(Math.random()-.5)*DIFF[diff].jitter};
  }
  return best;
}
function threatDir(t){
  let worst=null;
  for(const b of bullets){
    let x=b.x,y=b.y,vx=b.vx,vy=b.vy,bo=b.bounces;
    const dt=1/30;
    for(let s=0;s<26;s++){
      let nx=x+vx*dt; if(hitsWall(nx,y,BR)){vx=-vx;bo++;} else x=nx;
      let ny=y+vy*dt; if(hitsWall(x,ny,BR)){vy=-vy;bo++;} else y=ny;
      if(bo>b.max) break;
      const dx=x-t.x,dy=y-t.y;
      if(dx*dx+dy*dy<289){ const tt=s*dt; if(!worst||tt<worst.t) worst={t:tt,vx:b.vx,vy:b.vy}; break; }
    }
  }
  return worst ? Math.atan2(worst.vy,worst.vx)+Math.PI/2 : null;
}
