// audio.js — WebAudio sound design: blips, filtered noise bursts, chords and an ambient pad loop.
// Loaded as a classic script; top-level let/const are shared with the other files.

// ───────────────────────── audio ─────────────────────────
let AC=null, muted=false;
function ac(){ AC=AC||new (window.AudioContext||window.webkitAudioContext)(); return AC; }

function beep(f,dur,type='square',vol=.06,slide=0){
  if(muted) return;
  try{
    const c=ac();
    const o=c.createOscillator(), g=c.createGain();
    o.type=type; o.frequency.setValueAtTime(f,c.currentTime);
    if(slide) o.frequency.exponentialRampToValueAtTime(Math.max(40,f+slide),c.currentTime+dur);
    g.gain.setValueAtTime(vol,c.currentTime);
    g.gain.exponentialRampToValueAtTime(.0008,c.currentTime+dur);
    o.connect(g);g.connect(c.destination);o.start();o.stop(c.currentTime+dur);
  }catch(e){}
}

// short filtered burst of noise — used for explosions, impacts, breaking walls
function noiseBurst(dur=.35,vol=.18,freq=900,q=.7){
  if(muted) return;
  try{
    const c=ac();
    const n=Math.max(1,Math.floor(c.sampleRate*dur));
    const buf=c.createBuffer(1,n,c.sampleRate);
    const d=buf.getChannelData(0);
    for(let i=0;i<n;i++) d[i]=(Math.random()*2-1)*(1-i/n);
    const src=c.createBufferSource(); src.buffer=buf;
    const f=c.createBiquadFilter(); f.type='lowpass'; f.frequency.setValueAtTime(freq,c.currentTime);
    f.frequency.exponentialRampToValueAtTime(Math.max(80,freq*.25),c.currentTime+dur);
    f.Q.value=q;
    const g=c.createGain(); g.gain.setValueAtTime(vol,c.currentTime);
    g.gain.exponentialRampToValueAtTime(.0008,c.currentTime+dur);
    src.connect(f);f.connect(g);g.connect(c.destination);src.start();
  }catch(e){}
}

// a short sequence of notes — used for round/match end stingers
function chord(freqs,dur=.5,type='sine',vol=.05,gap=.05){
  if(muted) return;
  try{
    const c=ac();
    freqs.forEach((f,i)=>{
      const t0=c.currentTime+i*gap;
      const o=c.createOscillator(), g=c.createGain();
      o.type=type; o.frequency.setValueAtTime(f,t0);
      g.gain.setValueAtTime(0,t0); g.gain.linearRampToValueAtTime(vol,t0+.02);
      g.gain.exponentialRampToValueAtTime(.0008,t0+dur);
      o.connect(g);g.connect(c.destination);o.start(t0);o.stop(t0+dur+.02);
    });
  }catch(e){}
}
const winJingle  = ()=>chord([440,554,659,880],.55,'triangle',.055,.09);
const loseJingle = ()=>chord([392,349,294,220],.6,'sawtooth',.045,.1);
const explode    = (big)=>{ noiseBurst(big?.55:.32, big?.24:.15, big?600:900); };

// ───────────────────────── ambient music loop ─────────────────────────
let musicNodes=null, musicOn=false;
function startMusic(){
  if(musicOn) return; musicOn=true;
  try{
    const c=ac();
    const master=c.createGain(); master.gain.value=muted?0:.05;
    master.connect(c.destination);
    const filt=c.createBiquadFilter(); filt.type='lowpass'; filt.frequency.value=900;
    filt.connect(master);
    const notes=[110,130.8,146.8,164.8];
    const oscs=notes.map((f,i)=>{
      const o=c.createOscillator(), g=c.createGain();
      o.type='sine'; o.frequency.value=f; o.detune.value=(i-1.5)*4;
      g.gain.value=.22; o.connect(g); g.connect(filt); o.start();
      return o;
    });
    const lfo=c.createOscillator(), lfoGain=c.createGain();
    lfo.frequency.value=.06; lfoGain.gain.value=260;
    lfo.connect(lfoGain); lfoGain.connect(filt.frequency); lfo.start();
    filt.frequency.value=700;
    musicNodes={master,filt,oscs,lfo};
  }catch(e){ musicOn=false; }
}
function stopMusic(){
  if(!musicOn||!musicNodes) return; musicOn=false;
  try{
    const {master,oscs,lfo}=musicNodes;
    oscs.forEach(o=>{ try{o.stop();}catch(e){} });
    try{lfo.stop();}catch(e){}
    master.disconnect();
  }catch(e){}
  musicNodes=null;
}
function setMuted(m){
  muted=m;
  if(musicNodes) musicNodes.master.gain.value=m?0:.05;
}
