/* Wolkenritt-Engine (PixiJS 8)
   Pseudo-3D-Flug aus Reiter-Sicht: Fluchtpunkt am Horizont, alles kommt auf dich zu.
   Die Lernlogik bleibt in index.html; hier lebt nur das Spielgefühl. */
(function(){
'use strict';
const P = window.PIXI;
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const lerp=(a,b,t)=>a+(b-a)*t;
const easeOut=t=>1-Math.pow(1-t,3);
const easeIn=t=>t*t*t;
const easeInOut=t=>t<.5?2*t*t:1-Math.pow(-2*t+2,2)/2;
const hex=s=>parseInt(s.replace('#',''),16);
function lerpColor(a,b,t){
  const ar=(a>>16)&255, ag=(a>>8)&255, ab=a&255, br=(b>>16)&255, bg=(b>>8)&255, bb=b&255;
  return (Math.round(lerp(ar,br,t))<<16)|(Math.round(lerp(ag,bg,t))<<8)|Math.round(lerp(ab,bb,t));
}
const DEPTH=6;            // (alt) Perspektivstärke, jetzt Kurve in proj()
const LANE_X=[-0.30,0,0.30];
const LANE_SPREAD=1.1;    // Anteil der Bildbreite bei t=1

const G={
  ready:false, app:null, host:null, W:0, H:0, vp:{x:0,y:0},
  layers:{}, tex:{},
  speed:0, targetSpeed:0.0, combo:0,
  clouds:[], sparks:[], portals:[], parts:[], amb:[],
  palette:null, paletteFrom:null, paletteT:1,
  lumi:null, lumiState:'ride', lumiT:0, phase:0, stateT:0, lane:1, laneX:0,
  gatesActive:false, gateDeadline:null, held:false,
  onPick:null, onArrive:null,
  shakeT:0, flashA:0, tweens:[], reduce:false, lastAmb:0, speedLines:[]
};
window.Wolkenritt=G;

/* ---------- Setup ---------- */
G.init=async function(host){
  if(G.ready) return;
  G.host=host;
  G.reduce=matchMedia('(prefers-reduced-motion: reduce)').matches;
  const app=new P.Application();
  await app.init({width:Math.max(2,host.clientWidth), height:Math.max(2,host.clientHeight), backgroundAlpha:0, antialias:true, resolution:Math.min(2,devicePixelRatio||1), autoDensity:true});
  host.appendChild(app.canvas);
  app.canvas.style.position='absolute'; app.canvas.style.inset='0'; app.canvas.style.touchAction='none';
  G.app=app;
  const names=['head','ear','horn','mane1','mane2','mane3','hand','cloud','star','spark','puff','ring','ringfill','sign'];
  await P.Assets.load(names.map(n=>({alias:n, src:'assets/'+n+'.png'})));
  names.forEach(n=>G.tex[n]=P.Assets.get(n));
  // Ebenen von hinten nach vorn
  for(const n of ['sky','deco','far','mid','portals','near','lumi','fx','flash']){ const c=new P.Container(); G.layers[n]=c; app.stage.addChild(c); }
  G.layers.flash.addChild(G.flashRect=new P.Graphics());
  buildLumi();
  app.stage.eventMode='static';
  app.stage.on('pointertap',onTap);
  app.ticker.add(tick);
  // Fläche kann sich ohne Fenster-Resize ändern (Panel, Drehen, Tastatur): Host beobachten
  const fit=()=>{ const w=host.clientWidth, h=host.clientHeight; if(w>2&&h>2&&(w!==G.W||h!==G.H)){ app.renderer.resize(w,h); layout(); } };
  try{ new ResizeObserver(fit).observe(host); }catch(e){ addEventListener('resize',fit); }
  G.fit=fit;
  layout();
  G.ready=true;
};
function layout(){
  G.W=G.app.renderer.width/G.app.renderer.resolution; G.H=G.app.renderer.height/G.app.renderer.resolution;
  G.vp.x=G.W/2; G.vp.y=G.H*0.36;
  G.app.stage.hitArea=new P.Rectangle(0,0,G.W,G.H);
  drawSky(); placeLumi();
  G.flashRect.clear().rect(0,0,G.W,G.H).fill(0xffffff);
}
/* Projektion: t 0 = Horizont, 1 = bei dir, >1 = an dir vorbei */
function proj(lx,ly,t){
  // weiche Tiefenkurve: früh sichtbar, am Ende explosiv groß
  const p = t<=1 ? 0.1+0.9*Math.pow(Math.max(0,t),1.6) : 1+(t-1)*8;
  const spread = LANE_SPREAD*p + 0.22*(1-Math.min(p,1));   // in der Ferne etwas auseinanderziehen, damit die Schilder lesbar bleiben
  return {x:G.vp.x+lx*G.W*spread, y:G.vp.y+(G.H*0.62-G.vp.y)*p+ly*G.H*0.5*p, s:p};
}

/* ---------- Himmel und Welt ---------- */
const WORLDS={
  wolken:{top:'#BBDDF8',mid:'#E9E2FA',bot:'#FBEFF7',ring:'#C9B6EE',sun:1},
  meer:{top:'#F6A86E',mid:'#F78BA4',bot:'#8FBEEA',ring:'#F2B83C',sun:1,sea:1},
  nacht:{top:'#2E3060',mid:'#4B3E86',bot:'#8468B6',ring:'#B089F2',night:1,glow:1},
  zucker:{top:'#FBD3E8',mid:'#F6C1DC',bot:'#EFD9FA',ring:'#F96D9B',sun:1,hills:1}
};
G.WORLDS=WORLDS;
let skyG=null, sunS=null, moonG=null, starsC=null, seaC=null, hillsG=null, horizonG=null;
function drawSky(){
  const L=G.layers.sky;
  if(!skyG){ skyG=new P.Graphics(); L.addChild(skyG);
    horizonG=new P.Graphics(); L.addChild(horizonG);
    hillsG=new P.Graphics(); L.addChild(hillsG);
    seaC=new P.Container(); L.addChild(seaC);
    sunS=new P.Sprite(G.tex.spark); sunS.anchor.set(0.5); sunS.tint=0xFFE9A8; L.addChild(sunS);
    moonG=new P.Graphics(); L.addChild(moonG);
    starsC=new P.Container(); L.addChild(starsC);
    for(let i=0;i<26;i++){ const s=new P.Sprite(G.tex.star); s.anchor.set(0.5); s.scale.set(0.18+Math.random()*0.22); s.tint=0xFFF3C9; s.ph=Math.random()*6; s.rx=Math.random(); s.ry=Math.random()*0.5; starsC.addChild(s); }
    for(let i=0;i<30;i++){ const s=new P.Sprite(G.tex.spark); s.anchor.set(0.5); s.scale.set(0.15+Math.random()*0.2); s.alpha=0.7; s.rx=Math.random(); s.ry=Math.random(); s.ph=Math.random()*6; seaC.addChild(s); }
  }
  repaintSky();
}
function curPalette(){
  const a=G.paletteFrom||G.palette, b=G.palette, t=G.paletteT;
  if(!a||!b) return null;
  return {top:lerpColor(hex(a.top),hex(b.top),t), mid:lerpColor(hex(a.mid),hex(b.mid),t), bot:lerpColor(hex(a.bot),hex(b.bot),t),
    ring:lerpColor(hex(a.ring),hex(b.ring),t), sun:lerp(a.sun||0,b.sun||0,t), night:lerp(a.night||0,b.night||0,t),
    sea:lerp(a.sea||0,b.sea||0,t), hills:lerp(a.hills||0,b.hills||0,t), glow:lerp(a.glow||0,b.glow||0,t)};
}
function repaintSky(){
  const c=curPalette(); if(!c) return;
  const W=G.W,H=G.H, n=28; skyG.clear();
  for(let i=0;i<n;i++){
    const t=i/(n-1), col=t<0.55? lerpColor(c.top,c.mid,t/0.55) : lerpColor(c.mid,c.bot,(t-0.55)/0.45);
    skyG.rect(0,Math.floor(H*t)-1,W,Math.ceil(H/(n-1))+2).fill(col);
  }
  horizonG.clear().ellipse(W/2,G.vp.y+4,W*0.7,18).fill({color:0xffffff,alpha:0.45});
  hillsG.clear(); if(c.hills>0.01){ hillsG.ellipse(W*0.3,G.vp.y+26,W*0.5,52).fill({color:0xF6B9D9,alpha:c.hills}); hillsG.ellipse(W*0.78,G.vp.y+30,W*0.45,46).fill({color:0xF3A8D0,alpha:c.hills}); }
  sunS.position.set(W*0.12,H*0.07); sunS.scale.set(W/300); sunS.alpha=c.sun*0.8;
  moonG.clear(); if(c.night>0.01){ moonG.circle(W*0.84,H*0.09,W*0.045).fill({color:0xFFF3C9,alpha:c.night}); moonG.circle(W*0.84-W*0.02,H*0.09-W*0.012,W*0.04).fill({color:c.top,alpha:c.night}); }
  starsC.alpha=c.night; starsC.children.forEach(s=>{ s.position.set(s.rx*W, s.ry*G.vp.y*1.5); });
  seaC.alpha=c.sea; seaC.children.forEach(s=>{ s.position.set(s.rx*W, G.vp.y+14+s.ry*H*0.12); });
}
G.setWorld=function(name,instant){
  const w=WORLDS[name]||WORLDS.wolken;
  G.paletteFrom=instant||!G.palette? w : (curPaletteAsWorld()||G.palette);
  G.palette=w; G.paletteT=instant?1:0;
  repaintSky();
};
function curPaletteAsWorld(){
  const c=curPalette(); if(!c) return null;
  const h=v=>'#'+v.toString(16).padStart(6,'0');
  return {top:h(c.top),mid:h(c.mid),bot:h(c.bot),ring:h(c.ring),sun:c.sun,night:c.night,sea:c.sea,hills:c.hills,glow:c.glow};
}

/* ---------- Lumi-Rig ---------- */
function buildLumi(){
  const T=G.tex, L=new P.Container(); G.lumi=L; G.layers.lumi.addChild(L);
  const inner=new P.Container(); inner.scale.set(0.5); L.addChild(inner); L.inner=inner;
  const mk=(t,x,y,ax,ay)=>{ const s=new P.Sprite(t); s.anchor.set(ax,ay); s.position.set(x,y); return s; };
  // Reihenfolge: Mähne hinten, Kopf, Ohren, Horn, Hände vorn. Koordinaten relativ zur Kopfmitte unten.
  L.maneL=[mk(T.mane1,-74,0,1,1), mk(T.mane2,-58,0,1,1), mk(T.mane3,-42,0,1,1)];
  L.maneR=[mk(T.mane1,74,0,0,1), mk(T.mane2,58,0,0,1), mk(T.mane3,42,0,0,1)];
  L.maneR.forEach(s=>{ s.scale.x=-1; s.anchor.set(1,1); });
  L.maneL.concat(L.maneR).forEach(s=>inner.addChild(s));
  L.head=mk(T.head,0,0,0.5,1); inner.addChild(L.head);
  L.earL=mk(T.ear,-40,-98,0.5,0.92); L.earL.rotation=-0.25; inner.addChild(L.earL);
  L.earR=mk(T.ear,40,-98,0.5,0.92); L.earR.rotation=0.25; L.earR.scale.x=-1; inner.addChild(L.earR);
  L.horn=mk(T.horn,0,-104,0.5,1); inner.addChild(L.horn);
  L.handL=mk(T.hand,-86,-36,0.3,1); inner.addChild(L.handL);
  L.handR=mk(T.hand,86,-36,0.3,1); L.handR.scale.x=-1; inner.addChild(L.handR);
  L.funkel=mk(T.spark,-70,-120,0.5,0.5); L.funkel.tint=0xFFE066; L.funkel.scale.set(0.9); inner.addChild(L.funkel);
  L.body=L;
}
function placeLumi(){
  const L=G.lumi; if(!L) return;
  L.baseScale=clamp(Math.min(300,G.W*0.58)/168,0.6,1.8);
  L.scale.set(L.baseScale);
  L.position.set(G.W/2+G.laneX, G.H+26*L.baseScale);
}
G.setLane=function(lane){ G.lane=lane; };
G.setLumiState=function(s){ if(G.lumiState===s) return; G.lumiState=s; G.stateT=0; };
function animLumi(dt){
  const L=G.lumi, st=G.lumiState; G.stateT+=dt;
  const target=LANE_X[G.lane]*G.W*0.1;
  G.laneX=lerp(G.laneX,target,1-Math.pow(0.001,dt));
  const sp=clamp(G.speed/0.12,0,2.2);
  let y=0, rot=0, sc=1, earK=0, maneK=0;
  if(st==='ride'){
    G.phase+= dt*(5.5+sp*3.2);
    const ph=G.phase;
    y = -Math.max(0,Math.sin(ph))*14*(0.6+sp*0.3) + Math.sin(ph*2)*2;
    rot = Math.sin(ph+0.6)*0.035;
    sc = 1+Math.sin(ph)*0.012;
    earK = Math.sin(ph*0.5)*0.12; maneK=Math.sin(ph-0.8)*0.09;
  }else if(st==='brake'){
    const t=clamp(G.stateT/0.6,0,1), e=easeOut(t);
    y = lerp(-6, 14, e) - Math.sin(t*Math.PI)*6; rot = lerp(0,0.05,e); sc=lerp(1,0.97,e);
    earK=-0.2*e; maneK=0.18*(1-t);
  }else if(st==='stand'){
    y = 6+Math.sin(G.stateT*1.8)*2.5; rot=0.01;
    earK = Math.sin(G.stateT*2.4)*0.22; maneK=Math.sin(G.stateT*1.2)*0.03;
  }else if(st==='launch'){
    const t=clamp(G.stateT/0.8,0,1);
    y = t<0.35? lerp(6,18,t/0.35) : lerp(18,-18,easeOut((t-0.35)/0.65)) ; rot=t<0.35?0.05:-0.04; sc=t<0.35?0.96:1.04;
    maneK=-0.2*(1-t);
    if(t>=1){ G.setLumiState('ride'); }
  }else if(st==='cheer'){
    const t=clamp(G.stateT/0.6,0,1);
    y = -Math.sin(t*Math.PI)*34; sc=1+Math.sin(t*Math.PI)*0.07; rot=-Math.sin(t*Math.PI)*0.06;
    earK=Math.sin(t*Math.PI)*0.3;
    if(t>=1){ G.setLumiState('ride'); }
  }
  // Lean in die Spur
  rot += (G.laneX/(G.W*0.1||1))*0.06;
  L.position.set(G.W/2+G.laneX, G.H+26*L.baseScale+y*L.baseScale);
  L.rotation=rot; L.scale.set(L.baseScale*sc);
  L.earL.rotation=-0.25-earK; L.earR.rotation=0.25+earK;
  L.maneL.forEach((s,i)=>{ s.skew.x= Math.sin(G.phase-0.5*i)*0.07+maneK*0.6; });
  L.maneR.forEach((s,i)=>{ s.skew.x=-(Math.sin(G.phase-0.5*i)*0.07+maneK*0.6); });
  L.funkel.position.set(-70+Math.sin(G.stateT*2.1)*16, -120+Math.cos(G.stateT*1.7)*14);
  L.funkel.alpha=0.8+Math.sin(G.stateT*9)*0.2;
}

/* ---------- Wolken, Funken, Tempo ---------- */
function spawnCloud(t0){
  const s=new P.Sprite(G.tex.cloud); s.anchor.set(0.5);
  s.lx=(Math.random()<0.5?-1:1)*(0.5+Math.random()*1.9); s.ly=-0.55+Math.random()*1.5; s.t=t0||0;
  s.size=0.6+Math.random()*1.2; s.alpha=0; s.tint=0xffffff;
  G.layers[s.ly<0.3?'far':'near'].addChild(s); G.clouds.push(s);
}
function spawnSpark(){
  const s=new P.Sprite(G.tex.star); s.anchor.set(0.5);
  s.lx=(Math.random()*2-1)*1.6; s.ly=-0.4+Math.random()*1.4; s.t=0; s.size=0.3+Math.random()*0.3; s.tint=0xFFD98A; s.alpha=0; s.rot=Math.random()*6;
  G.layers.mid.addChild(s); G.sparks.push(s);
}
function moveField(dt){
  const sp=G.speed;
  const upd=(arr,isStar)=>{
    for(let i=arr.length-1;i>=0;i--){
      const s=arr[i]; s.t+=sp*dt*(isStar?1.15:1);
      const q=proj(s.lx,s.ly,s.t);
      s.position.set(q.x,q.y); s.scale.set(q.s*s.size*(isStar?1:1.4));
      if(isStar) s.rotation=s.rot+s.t*3;
      s.alpha=clamp(s.t*6,0,1)*clamp((1.1-s.t)*8,0,1)*(isStar?0.95:0.85);
      if(s.t>1.12){ s.destroy(); arr.splice(i,1); }
    }
  };
  upd(G.clouds,false); upd(G.sparks,true);
  const want = G.held? 0 : 7+Math.min(6,G.combo);
  while(G.clouds.length<want) spawnCloud(Math.random()*0.9);
  if(!G.held && sp>0.02 && Math.random()<dt*(1.2+sp*8)) spawnSpark();
}

/* ---------- Portale ---------- */
function makePortal(value,lane,worldgate){
  const T=G.tex, c=new P.Container(); c.lx=LANE_X[lane]; c.ly=0; c.t=0; c.lane=lane; c.value=value;
  const inner=new P.Container(); inner.scale.set(0.5); c.addChild(inner);
  const pal=curPalette();
  const outer=new P.Sprite(T.ring); outer.anchor.set(0.5); outer.scale.set(1.09); outer.tint=worldgate?0xF2CE4B:(pal?pal.ring:0xC9B6EE); inner.addChild(outer); c.outer=outer;
  const fill=new P.Sprite(T.ringfill); fill.anchor.set(0.5); fill.scale.set(0.9); fill.alpha=0.35; fill.tint=0xDDEBFA; inner.addChild(fill); c.fill=fill;
  const ring=new P.Sprite(T.ring); ring.anchor.set(0.5); inner.addChild(ring); c.ring=ring;
  if(worldgate){ ring.tint=0xffffff; const rb=new P.Graphics(); const cols=[0xF96D6D,0xF2CE4B,0x4FC47F,0x58A6F0,0xC77DF0]; for(let i=0;i<5;i++){ rb.ellipse(0,0,176+i*8,226+i*8).stroke({width:8,color:cols[i],alpha:0.9}); } inner.addChild(rb); c.rb=rb; }
  const puffs=[[-70,-100,0.9],[66,-80,0.7],[-80,70,0.75]].map(([x,y,s])=>{ const p=new P.Sprite(T.puff); p.anchor.set(0.5); p.position.set(x*2,y*2); p.scale.set(s); inner.addChild(p); return p; });
  c.puffs=puffs;
  const star=new P.Sprite(T.star); star.anchor.set(0.5); star.scale.set(0.6); inner.addChild(star); c.star=star; c.orb=Math.random()*6;
  const sign=new P.Container(); const sb=new P.Sprite(T.sign); sb.anchor.set(0.5); sign.addChild(sb);
  const txt=new P.Text({text:String(value), style:{fontFamily:'"Baloo 2", Nunito, sans-serif', fontSize:84, fontWeight:'700', fill:0x3B2A52}}); txt.anchor.set(0.5); txt.position.set(0,-4); sign.addChild(txt);
  sign.position.set(0,262); inner.addChild(sign); c.sign=sign; c.txt=txt; c.sb=sb;
  c.worldgate=!!worldgate; c.base=Math.min(G.W*0.34,170)/208*(worldgate?1.18:1);
  c.eventMode='static'; c.cursor='pointer';
  c.on('pointertap',(e)=>{ e.stopPropagation(); pick(lane); });
  G.layers.portals.addChild(c);
  return c;
}
G.spawnGates=function(values,opts){
  clearPortals();
  G.gateMode=opts||{};
  G.gatesActive=true; G.held=false; G.resolved=false;
  G.gateDur=(opts.approachMs||9000)/1000;
  G.holdAt=opts.hold? 0.9 : null;
  values.forEach((v,i)=>{ const p=makePortal(v,i,!!opts.worldgate); if(opts.hold){ p.t=G.holdAt; p.ly=0.16; } G.portals.push(p); });
  if(opts.hold){ G.held=true; G.targetSpeed=0; }
  else G.targetSpeed = 1/G.gateDur;
};
function clearPortals(){ G.portals.forEach(p=>p.destroy({children:true})); G.portals=[]; }
function pick(lane){ if(!G.gatesActive||G.resolved) return; G.onPick&&G.onPick(lane); }
function onTap(e){
  if(!G.gatesActive||G.resolved||!G.portals.length) return;
  const x=e.global.x, y=e.global.y;
  if(y<G.vp.y-20) return;
  let best=null,bd=1e9; G.portals.forEach(p=>{ const d=Math.abs(p.x-x); if(d<bd){bd=d;best=p;} });
  if(best) pick(best.lane);
}
G.resumeGates=function(ms){ G.hideGroups(); G.held=false; G.holdAt=null; const rest=1-(G.portals[0]?G.portals[0].t:0); G.gateDur=(ms||1200)/1000; G.targetSpeed=rest/G.gateDur; };
function updPortals(dt){
  const pal=curPalette();
  for(const p of G.portals){
    if(!G.resolved){
      const boost = p.t<0.45 ? (G.boost||1) : 1;
      p.t+=G.speed*dt*boost;
      if(G.held && G.holdAt!==null) p.t=G.holdAt;
      if(p.t>=1 && G.gatesActive && !G.resolved){ G.resolved=true; G.gatesActive=false; G.onArrive&&G.onArrive(); }
    }else if(p.fly){
      p.flyT+=dt;
      const k=clamp(p.flyT/p.flyDur,0,1);
      p.t = p.good ? lerp(p.t0,1.3,easeInOut(k)) : lerp(p.t0,1.04,k);
      p.alpha = p.good ? (k<0.85?1:1-(k-0.85)/0.15) : 1-k;
      if(p.good){ p.lx=lerp(p.lx0, LANE_X[p.lane]*0.25, k); p.ly=lerp(p.ly0||0,0.35,k); }
    }
    const q=proj(p.lx,p.ly,p.t);
    const sway= G.held? Math.sin(G.time*3+p.lane)*0.03 : Math.sin(G.time*1.4+p.lane*2)*0.02;
    p.position.set(q.x, q.y - (G.held?Math.sin(G.time*2.2+p.lane)*8:0));
    p.scale.set(q.s*p.base*(G.held?1+Math.sin(G.time*3+p.lane)*0.03:1)); p.rotation=sway;
    if(p.outer && !p.worldgate && !p.marked) p.outer.tint=pal?pal.ring:0xC9B6EE;
    p.orb+=dt*2.2; p.star.position.set(Math.cos(p.orb)*184, Math.sin(p.orb)*232); p.star.rotation=p.orb;
    p.fill.alpha=0.3+Math.sin(G.time*2.5+p.lane)*0.1+(pal?pal.glow*0.25:0);
    // Schild lesbar halten: in der Ferne größer relativ zum Ring
    const ss=clamp(0.5/Math.max(q.s*p.base,0.2),1,3.2); p.sign.scale.set(ss);
    p.puffs.forEach((pf,i)=>{ pf.scale.set((0.7+i*0.1)+Math.sin(G.time*1.5+i)*0.05); });
  }
}
/* Auflösen: Lumi fliegt immer durchs richtige Tor */
G.resolve=function(o){
  // o: {goodLane, pickedLane|null, good, worldgate}
  G.resolved=true; G.gatesActive=false;
  G.setLane(o.goodLane);
  G.portals.forEach(p=>{
    p.marked=true;
    if(p.lane===o.goodLane){ p.good=true; p.ring.tint=0xF2B83C; p.outer.tint=0xFFE6A8; p.fill.tint=0xFFF4D6; p.fill.alpha=0.8; p.txt.style.fill=0x9C6A00; p.sb.tint=0xFFF4D6; }
    else if(p.lane===o.pickedLane){ p.ring.tint=0xF3B6BA; }
    else { p.alphaDim=true; }
  });
  const delay=o.good?0.2:0.8;
  return new Promise(res=>{
    G.after(delay,()=>{
      G.portals.forEach(p=>{ p.fly=true; p.flyT=0; p.flyDur=o.good?0.95:0.8; p.t0=p.t; p.lx0=p.lx; p.ly0=p.ly; });
      G.targetSpeed=1/Math.max(4,G.gateDur*0.8);
      G.after(0.66,()=>{
        const q=proj(LANE_X[o.goodLane]*0.25,0.2,1.05);
        if(o.good){
          G.flash(o.worldgate?0.95:0.7); G.shake(o.worldgate?1.4:0.8);
          G.burst(q.x,q.y,o.worldgate?60:34, o.worldgate);
          G.setLumiState('cheer');
        }else{
          G.fog(); G.shake(0.4);
        }
      });
      G.after(1.0,()=>{ clearPortals(); res(); });
    });
  });
};

/* ---------- Effekte ---------- */
G.after=function(sec,fn){ G.tweens.push({t:sec,fn}); };
G.flash=function(a){ G.flashA=Math.max(G.flashA,a); };
G.shake=function(k){ G.shakeT=0.35; G.shakeK=k||1; };
G.burst=function(x,y,n,big){
  const cols=[0xF96D6D,0xF8A34D,0xF2CE4B,0x4FC47F,0x58A6F0,0x9A6AE8,0xE06FB4];
  const cnt=G.reduce?Math.min(n,10):n;
  for(let i=0;i<cnt;i++){
    const s=new P.Sprite(Math.random()<0.3?G.tex.star:G.tex.spark); s.anchor.set(0.5);
    s.tint=cols[i%cols.length]; s.position.set(x,y);
    const a=Math.random()*Math.PI*2, v=(120+Math.random()*260)*(big?1.3:1);
    s.vx=Math.cos(a)*v; s.vy=Math.sin(a)*v-160; s.life=0.9+Math.random()*0.5; s.age=0; s.scale.set(0.25+Math.random()*0.35); s.rs=(Math.random()-0.5)*8;
    G.layers.fx.addChild(s); G.parts.push(s);
  }
};
G.fog=function(){
  for(let i=0;i<9;i++){ const s=new P.Sprite(G.tex.puff); s.anchor.set(0.5); s.tint=0xB9B3C7; s.position.set(G.W*(0.2+Math.random()*0.6), G.H*(0.5+Math.random()*0.35)); s.vx=(Math.random()-0.5)*60; s.vy=-30-Math.random()*30; s.life=1.1; s.age=0; s.scale.set(0.8+Math.random()*0.8); s.grow=1; s.alpha=0.5; G.layers.fx.addChild(s); G.parts.push(s); }
};
G.hideGroups=function(){};
G.brakePuffs=function(){
  for(let i=0;i<5;i++){ const s=new P.Sprite(G.tex.puff); s.anchor.set(0.5); s.position.set(G.W/2+(i-2)*G.W*0.11, G.H*0.8); s.vx=(i-2)*50; s.vy=-50-Math.random()*40; s.life=0.7; s.age=0; s.scale.set(0.15); s.grow=1; s.alpha=0.6; G.layers.fx.addChild(s); G.parts.push(s); }
};
G.collectStar=function(){
  const s=new P.Sprite(G.tex.star); s.anchor.set(0.5); s.position.set(G.W*(0.3+Math.random()*0.4), G.H*0.1);
  s.vx=(Math.random()-0.5)*80; s.vy=260; s.life=0.9; s.age=0; s.scale.set(0.9); s.rs=4; s.trail=true; G.layers.fx.addChild(s); G.parts.push(s);
};
function updParts(dt){
  for(let i=G.parts.length-1;i>=0;i--){
    const s=G.parts[i]; s.age+=dt;
    s.x+=s.vx*dt; s.y+=s.vy*dt; s.vy+= (s.grow?-20:420)*dt; if(s.rs) s.rotation+=s.rs*dt;
    if(s.grow) s.scale.set(s.scale.x+dt*0.35);
    s.alpha=(1-s.age/s.life)*(s.grow?0.7:1);
    if(s.age>=s.life){ s.destroy(); G.parts.splice(i,1); }
  }
}
function updSpeedLines(dt){
  const want = G.speed>0.17 && !G.reduce ? 8 : 0;
  while(G.speedLines.length<want){ const g=new P.Graphics(); g.lx=(Math.random()<0.5?-1:1)*(1.3+Math.random()*1.2); g.ly=-0.3+Math.random()*1.2; g.t=Math.random(); G.layers.near.addChild(g); G.speedLines.push(g); }
  for(let i=G.speedLines.length-1;i>=0;i--){
    const g=G.speedLines[i]; g.t+=G.speed*dt*1.6; if(g.t>1.1||want===0){ g.destroy(); G.speedLines.splice(i,1); continue; }
    const a=proj(g.lx,g.ly,g.t), b=proj(g.lx,g.ly,g.t+0.08);
    g.clear().moveTo(a.x,a.y).lineTo(b.x,b.y).stroke({width:2,color:0xffffff,alpha:0.5*clamp(g.t*3,0,1)});
  }
}

/* ---------- Welt-Bewohner ---------- */
const AMB={wolken:['🎈','🕊️'], meer:['🐬','🕊️'], nacht:['☄️','🦉'], zucker:['🍭','🍬']};
G.worldName='wolken';
function spawnAmb(){
  const list=AMB[G.worldName]||AMB.wolken; const em=list[Math.floor(Math.random()*list.length)];
  const t=new P.Text({text:em, style:{fontSize:34}}); t.anchor.set(0.5);
  const fromLeft=Math.random()<0.5; t.x=fromLeft?-40:G.W+40; t.y=G.H*(0.12+Math.random()*0.35); t.dir=fromLeft?1:-1;
  t.arc=em==='🐬'; if(t.arc){ t.y=G.vp.y+30; } t.age=0; t.dur=t.arc?3.6:9+Math.random()*4; t.y0=t.y;
  G.layers.deco.addChild(t); G.amb.push(t);
}
function updAmb(dt){
  if(G.held) return;
  G.lastAmb+=dt; if(G.lastAmb>6.5){ G.lastAmb=0; spawnAmb(); }
  for(let i=G.amb.length-1;i>=0;i--){
    const a=G.amb[i]; a.age+=dt; const k=a.age/a.dur;
    a.x = (a.dir>0? -40:G.W+40) + a.dir*(G.W+80)*k;
    if(a.arc){ a.y=a.y0-Math.sin(k*Math.PI)*110; a.rotation=a.dir*(k-0.5)*1.2; }
    else a.y=a.y0+Math.sin(a.age*1.3)*8;
    if(k>=1){ a.destroy(); G.amb.splice(i,1); }
  }
}

/* ---------- Hauptschleife ---------- */
G.time=0;
function tick(tk){
  const dt=Math.min(0.1,tk.deltaMS/1000); G.time+=dt;
  // Tempo weich
  G.speed=lerp(G.speed,G.targetSpeed,1-Math.pow(0.02,dt));
  if(G.paletteT<1){ G.paletteT=Math.min(1,G.paletteT+dt/1.6); repaintSky(); }
  // Sterne funkeln, Meer glitzert
  if(starsC&&starsC.alpha>0.01) starsC.children.forEach(s=>{ s.alpha=0.55+Math.sin(G.time*2+s.ph)*0.45; });
  if(seaC&&seaC.alpha>0.01) seaC.children.forEach(s=>{ s.alpha=0.3+Math.sin(G.time*3+s.ph)*0.3; s.x=(s.rx*G.W+Math.sin(G.time+s.ph)*6); });
  moveField(dt); updPortals(dt); updParts(dt); updSpeedLines(dt); updAmb(dt); animLumi(dt);
  // Timer-Callbacks
  for(let i=G.tweens.length-1;i>=0;i--){ const w=G.tweens[i]; w.t-=dt; if(w.t<=0){ G.tweens.splice(i,1); w.fn(); } }
  // Blitz und Wackeln
  G.flashRect.alpha=G.flashA; if(G.flashA>0) G.flashA=Math.max(0,G.flashA-dt*2.2);
  if(G.shakeT>0){ G.shakeT-=dt; const k=G.shakeT/0.35*G.shakeK; G.app.stage.position.set((Math.random()-0.5)*14*k,(Math.random()-0.5)*10*k); } else G.app.stage.position.set(0,0);
}

/* ---------- Lebenszyklus ---------- */
G.start=function(opts){
  // opts: {world, items}
  if(G.fit) G.fit();
  G.worldName=opts.world||'wolken'; G.setWorld(G.worldName,true);
  G.combo=0; G.speed=0; G.targetSpeed=0.1; G.held=false; G.gatesActive=false; G.resolved=false; G.lane=1; G.laneX=0;
  clearPortals(); G.clouds.forEach(c=>c.destroy()); G.clouds=[]; G.sparks.forEach(c=>c.destroy()); G.sparks=[]; G.amb.forEach(c=>c.destroy()); G.amb=[];
  G.setLumiState('ride'); G.tweens=[]; G.lastAmb=4;
  for(let i=0;i<8;i++) spawnCloud(Math.random());
  G.app.ticker.start();
};
G.changeWorld=function(name){ G.worldName=name; G.setWorld(name,false); };
G.setCombo=function(n){ G.combo=n; G.boost=Math.min(1.9, 1+n*0.15); };
G.setSpeedFactor=function(f){ G.targetSpeed = f; };
G.stop=function(){ clearPortals(); G.hideGroups(); G.tweens=[]; G.app.ticker.stop(); };
G.brake=function(){ G.setLumiState('brake'); G.brakePuffs(); G.targetSpeed=0; G.after(0.65,()=>{ if(G.lumiState==='brake') G.setLumiState('stand'); }); };
G.launch=function(){ G.setLumiState('launch'); G.held=false; };
})();
