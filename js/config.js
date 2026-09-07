// config.js — Constants, difficulty table, the power-up catalogue and the shared game state.
// Loaded as a classic script; top-level let/const are shared with the other files.

// ───────────────────────── setup ─────────────────────────
const TILE=26, COLS=23, ROWS=17;
const W=COLS*TILE, H=ROWS*TILE;
const cv=document.getElementById('cv'), ctx=cv.getContext('2d');
const DPR=Math.min(window.devicePixelRatio||1,2.5);
cv.width=W*DPR; cv.height=H*DPR; cv.style.aspectRatio=W+'/'+H;
ctx.scale(DPR,DPR);

const TANK_R=9, BR=3.2, BSPEED=205;
const BLIFE=9, BBOUNCE=4;              // כדור רגיל: מנתר הרבה, אבל לא לנצח
const LASER_SPEED=430, LASER_BOUNCE=10, LASER_LIFE=5;
let WIN=5;
const isTouch = window.matchMedia('(pointer:coarse)').matches || 'ontouchstart' in window;

// ───────────────────────── tank colors ─────────────────────────
const COLORS=[
  {id:'blue',   col:'#3ec6f0', dark:'#1c7ea3'},
  {id:'green',  col:'#7ee787', dark:'#2f8a3a'},
  {id:'purple', col:'#d2a8ff', dark:'#7a4fb0'},
  {id:'yellow', col:'#ffd166', dark:'#b3873a'},
  {id:'pink',   col:'#ff8fb1', dark:'#b34e6c'},
  {id:'white',  col:'#e9f1f8', dark:'#8fa2b3'},
];
let playerColor=(()=>{ try{ return localStorage.getItem('tankColor')||'blue'; }catch(e){ return 'blue'; } })();
const colorOf=id=>COLORS.find(c=>c.id===id)||COLORS[0];

// ───────────────────────── lifetime stats ─────────────────────────
function loadStats(){
  try{ return JSON.parse(localStorage.getItem('tankStats'))||{wins:0,losses:0,matches:0,shots:0,hits:0}; }
  catch(e){ return {wins:0,losses:0,matches:0,shots:0,hits:0}; }
}
function saveStats(s){ try{ localStorage.setItem('tankStats',JSON.stringify(s)); }catch(e){} }

const DIFF=[
  {name:'מתאמן', react:.75, jitter:.22, speed:66, bounce:1, dodge:.45, fireGap:1.25},
  {name:'לוחם',  react:.42, jitter:.11, speed:76, bounce:2, dodge:.75, fireGap:.85},
  {name:'אלוף',  react:.22, jitter:.045,speed:86, bounce:3, dodge:1.0, fireGap:.6},
];
let diff=1, mode='bot';

// ───────────────────────── maze styles ─────────────────────────
const MAZE_STYLES={
  maze: {name:'מבוך',   density:.30, pockets:2, pocketSize:3},
  open: {name:'זירה פתוחה', density:.52, pockets:3, pocketSize:4},
  tight:{name:'מסדרונות', density:.12, pockets:1, pocketSize:2},
};
let mazeStyle='maze';

// ───────────────────────── power-ups ─────────────────────────
const POWERS={
  speed:   {icon:'⚡', label:'טורבו',      col:'#7ee787', dur:9,  w:10},
  rapid:   {icon:'🔥', label:'אש מהירה',  col:'#ffa657', dur:9,  w:10},
  shield:  {icon:'🛡', label:'מגן',       col:'#79c0ff', dur:0,  w:9},
  triple:  {icon:'⋔', label:'ירי משולש', col:'#d2a8ff', dur:9,  w:8},
  ricochet:{icon:'◆', label:'ריקושט+',   col:'#f5b544', dur:12, w:8},
  mine:    {icon:'🧨', label:'מוקשים',    col:'#ff7b72', dur:0,  w:8},
  laser:   {icon:'⌁', label:'לייזר מסלול',col:'#ff4d6d', dur:0, w:7},
  freeze:  {icon:'❄', label:'הקפאה',     col:'#8fe9ff', dur:0,  w:6},
  breaker: {icon:'🧱', label:'פורץ קירות',col:'#c9a227', dur:11, w:7},
  split:   {icon:'✳', label:'התפצלות',   col:'#a5f3c7', dur:11, w:7},
  homing:  {icon:'🚀', label:'טיל עוקב',   col:'#ff9f43', dur:0,  w:6},
  drone:   {icon:'🛸', label:'רחפן שלט',   col:'#a78bfa', dur:0,  w:6},
  shotgun: {icon:'🔫', label:'שוטגן',       col:'#ffd166', dur:9,  w:7},
  parry:   {icon:'⚔', label:'מנטרל יריות', col:'#67e8f9', dur:11, w:6},
  doom:    {icon:'☠', label:'עסקת דם',     col:'#ff2e63', dur:0,  w:3},
  // מלכודות: נראות בשטח כמו פאוור-אפ טוב, מתגלות רק באיסוף
  sludge:  {icon:'🥴', label:'בוץ',         col:'#a8845c', dur:8, w:2, fake:'speed'},
  reverse: {icon:'🔄', label:'הגה הפוך',   col:'#d68be0', dur:8, w:2, fake:'shield'},
  jam:     {icon:'🔧', label:'תותח תקוע',  col:'#9aa7b3', dur:8, w:2, fake:'rapid'},
  booby:   {icon:'💣', label:'מלכודת',     col:'#ff5a5a', dur:0, w:2, fake:'mine'},
};
const isTrap=k=>!!POWERS[k].fake;
const lookOf=k=>POWERS[POWERS[k].fake||k];
const PKEYS=Object.keys(POWERS);
const PBAG=PKEYS.flatMap(k=>Array(POWERS[k].w).fill(k));

// ───────────────────────── state ─────────────────────────
let tanks=[], bullets=[], pups=[], mines=[], parts=[], marks=[], rockets=[];
let score=[0,0], phase='menu', phaseT=0, shake=0, tSpawn=0, roundNo=0, msg='';
let time=0, pupT=5, hudT=0;

const NAME=()=> (mode==='duo'||mode==='online') ? ['כחול','כתום'] : ['אתה','הבוט'];

function makeTank(team,x,y,human){
  return {team,human,x,y,ang:0,turret:0,alive:true,frozen:0,
    cool:0,buffs:{},mines:0,laser:0,shield:false,recoil:0,tread:0,rc:null,doom:0,tick:0,
    ai:{think:0,aim:null,target:null,field:null,hold:0,strafe:1,repath:0}};
}
let matchStats=[{shots:0,hits:0},{shots:0,hits:0}];

function newRound(){
  genMaze();
  bullets=[];pups=[];mines=[];parts=[];marks=[];rockets=[];pupT=4;
  const ft=freeTiles();
  const a=ft[(Math.random()*ft.length)|0];
  let b=null,best=-1;
  const d=bfs(a[0],a[1]);
  for(const [c,r] of ft) if(d[r][c]>best){best=d[r][c];b=[c,r];}
  if(best<8) return newRound();
  tanks=[makeTank(0,cxOf(a[0]),cyOf(a[1]),true),
         makeTank(1,cxOf(b[0]),cyOf(b[1]),mode==='duo')];
  const face=Math.atan2(tanks[1].y-tanks[0].y,tanks[1].x-tanks[0].x);
  tanks[0].ang=tanks[0].turret=face;
  tanks[1].ang=tanks[1].turret=face+Math.PI;
  tSpawn=0.9; phase='countdown'; phaseT=1.9;
  clearGhostTouch();
  updateHud();
}
function startMatch(){
  score=[0,0]; roundNo=0; matchStats=[{shots:0,hits:0},{shots:0,hits:0}];
  newRound(); layout();
  document.getElementById('overlay').classList.add('hidden');
}
