// maze.js — Maze generation, wall collision and grid pathfinding helpers.
// Loaded as a classic script; top-level let/const are shared with the other files.

// ───────────────────────── maze ─────────────────────────
let grid=[];
const solidAt=(c,r)=> c<0||r<0||c>=COLS||r>=ROWS ? true : grid[r][c]===1;

function genMaze(){
  grid=Array.from({length:ROWS},()=>Array(COLS).fill(1));
  const cw=(COLS-1)>>1, ch=(ROWS-1)>>1;
  const seen=Array.from({length:ch},()=>Array(cw).fill(false));
  const stack=[[Math.floor(Math.random()*cw),Math.floor(Math.random()*ch)]];
  seen[stack[0][1]][stack[0][0]]=true;
  grid[stack[0][1]*2+1][stack[0][0]*2+1]=0;
  while(stack.length){
    const [x,y]=stack[stack.length-1];
    const nb=[[1,0],[-1,0],[0,1],[0,-1]].map(([dx,dy])=>[x+dx,y+dy])
      .filter(([a,b])=>a>=0&&b>=0&&a<cw&&b<ch&&!seen[b][a]);
    if(!nb.length){stack.pop();continue;}
    const [nx,ny]=nb[(Math.random()*nb.length)|0];
    seen[ny][nx]=true;
    grid[ny*2+1][nx*2+1]=0;
    grid[y*2+1+(ny-y)][x*2+1+(nx-x)]=0;
    stack.push([nx,ny]);
  }
  const style=MAZE_STYLES[mazeStyle]||MAZE_STYLES.maze;
  for(let r=1;r<ROWS-1;r++)for(let c=1;c<COLS-1;c++)
    if(grid[r][c]===1 && Math.random()<style.density) grid[r][c]=0;
  for(let k=0;k<style.pockets;k++){
    const ps=style.pocketSize;
    const c=2+((Math.random()*(COLS-ps-3))|0), r=2+((Math.random()*(ROWS-ps-3))|0);
    for(let y=r;y<r+ps;y++)for(let x=c;x<c+ps;x++) if(x>0&&y>0&&x<COLS-1&&y<ROWS-1) grid[y][x]=0;
  }
  for(let r=1;r<ROWS-1;r++)for(let c=1;c<COLS-1;c++){
    if(grid[r][c]===1){
      const n=(grid[r-1][c]?1:0)+(grid[r+1][c]?1:0)+(grid[r][c-1]?1:0)+(grid[r][c+1]?1:0);
      if(n===0 && Math.random()<.5) grid[r][c]=0;
    }
  }
  const seen2=Array.from({length:ROWS},()=>Array(COLS).fill(false));
  let big=[];
  for(let r=1;r<ROWS-1;r++)for(let c=1;c<COLS-1;c++){
    if(grid[r][c]||seen2[r][c]) continue;
    const q=[[c,r]]; seen2[r][c]=true;
    for(let i=0;i<q.length;i++){
      const [x,y]=q[i];
      for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]){
        const nx=x+dx, ny=y+dy;
        if(nx<0||ny<0||nx>=COLS||ny>=ROWS||grid[ny][nx]||seen2[ny][nx]) continue;
        seen2[ny][nx]=true; q.push([nx,ny]);
      }
    }
    if(q.length>big.length) big=q;
  }
  const keep=new Set(big.map(([x,y])=>y*COLS+x));
  for(let r=0;r<ROWS;r++)for(let c=0;c<COLS;c++)
    if(!grid[r][c] && !keep.has(r*COLS+c)) grid[r][c]=1;
}

function hitsWall(x,y,r){
  const c0=Math.floor((x-r)/TILE), c1=Math.floor((x+r)/TILE);
  const r0=Math.floor((y-r)/TILE), r1=Math.floor((y+r)/TILE);
  for(let rr=r0;rr<=r1;rr++)for(let cc=c0;cc<=c1;cc++){
    if(!solidAt(cc,rr)) continue;
    const px=Math.max(cc*TILE,Math.min(x,cc*TILE+TILE));
    const py=Math.max(rr*TILE,Math.min(y,rr*TILE+TILE));
    const dx=x-px, dy=y-py;
    if(dx*dx+dy*dy < r*r) return true;
  }
  return false;
}
const tileOf=(x,y)=>[Math.floor(x/TILE),Math.floor(y/TILE)];
const cxOf=c=>c*TILE+TILE/2, cyOf=r=>r*TILE+TILE/2;

function bfs(sc,sr){
  const d=Array.from({length:ROWS},()=>Array(COLS).fill(-1));
  if(solidAt(sc,sr)) return d;
  d[sr][sc]=0; const q=[[sc,sr]];
  for(let i=0;i<q.length;i++){
    const [c,r]=q[i];
    for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]){
      const nc=c+dx, nr=r+dy;
      if(solidAt(nc,nr)||d[nr][nc]!==-1) continue;
      d[nr][nc]=d[r][c]+1; q.push([nc,nr]);
    }
  }
  return d;
}
function freeTiles(){
  const a=[];
  for(let r=1;r<ROWS-1;r++)for(let c=1;c<COLS-1;c++) if(!grid[r][c]) a.push([c,r]);
  return a;
}
