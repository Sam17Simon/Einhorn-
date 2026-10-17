/* Wolkenritt-Engine (PixiJS 8)
   Pseudo-3D-Flug aus Reiter-Sicht: Fluchtpunkt am Horizont, alles kommt auf dich zu.
   Die Lernlogik bleibt in index.html; hier lebt nur das Spielgefühl. */
(function(){
'use strict';
const P = window.PIXI;
const VERSION='56';   // wird vom Release-Skript hochgezählt (Cache-Buster)
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
  const names=['cloud','star','spark','puff','ring','ringfill','sign','glint'];
  await P.Assets.load(names.map(n=>({alias:n, src:'assets/'+n+'.png?v='+VERSION})));
  names.forEach(n=>G.tex[n]=P.Assets.get(n));
  // Ebenen von hinten nach vorn
  G.cam=new P.Container(); app.stage.addChild(G.cam);
  for(const n of ['sky','deco','far','mid','portals','near','fx']){ const c=new P.Container(); G.layers[n]=c; G.cam.addChild(c); }
  for(const n of ['lumi','flash']){ const c=new P.Container(); G.layers[n]=c; app.stage.addChild(c); }
  G.layers.flash.addChild(G.flashRect=new P.Graphics());
  await buildLumi();
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
  G.W=G.app.screen.width; G.H=G.app.screen.height;   // CSS-Pixel, unabhängig von der Pixeldichte
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
  const ground = G.W>G.H ? 0.52 : 0.58;   // Querformat: Tore etwas höher, damit Lumi nichts verdeckt
  return {x:G.vp.x+lx*G.W*spread, y:G.vp.y+(G.H*ground-G.vp.y)*p+ly*G.H*0.5*p, s:p};
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

/* ---------- Lumi-Rig (Reiter-Sicht v2: Hals, Mähnenkamm, Hinterkopf, Ohren, Horn) ---------- */
/* Lumi aus einem Stück: die Reiter-Sicht wird aus dem SVG in index.html (unicornHeadSVG) gerastert.
   Keine Einzelteile mehr, bewegt wird nur das Ganze. */
const POV={vb:[-30,-10,420,490], ax:180, ay:300, unit:360, k:2};   // SVG-Einheiten, Ankerpunkt = Bildmitte unten
function svgToTexture(svg, vb, k){
  const w=Math.round(vb[2]*k), h=Math.round(vb[3]*k);
  svg=svg.replace(/<svg[^>]*>/, '<svg xmlns="http://www.w3.org/2000/svg" viewBox="'+vb.join(' ')+'" width="'+w+'" height="'+h+'">');
  return new Promise((res,rej)=>{
    const img=new Image(); img.decoding='async';
    img.onload=()=>{ try{ const cv=document.createElement('canvas'); cv.width=w; cv.height=h; cv.getContext('2d').drawImage(img,0,0,w,h); res(P.Texture.from(cv)); }catch(e){ rej(e); } };
    img.onerror=rej;
    img.src='data:image/svg+xml;charset=utf-8,'+encodeURIComponent(svg);
  });
}
async function lumiTexture(items){
  if(typeof window.unicornHeadSVG!=='function') return null;
  return svgToTexture(window.unicornHeadSVG(items||0,'100%'), POV.vb, POV.k);
}
async function buildLumi(){
  const L=new P.Container(); G.lumi=L; G.layers.lumi.addChild(L);
  const body=new P.Sprite(P.Texture.EMPTY); body.anchor.set((POV.ax-POV.vb[0])/POV.vb[2], (POV.ay-POV.vb[1])/POV.vb[3]); body.scale.set(1/POV.k);
  L.addChild(body); L.body=body; L.inner=L;
  L.funkel=new P.Sprite(G.tex.spark); L.funkel.anchor.set(0.5); L.funkel.tint=0xFFE066; L.funkel.scale.set(0.55); L.addChild(L.funkel);
  L.glints=[]; L.glintT=0;
  await G.setLumiItems(G.items||0);
}
G.setLumiItems=async function(items){
  G.items=items||0;
  if(!G.lumi || G.lumi.itemsKey===G.items) return;
  try{ const tx=await lumiTexture(G.items); if(tx){ const old=G.lumi.body.texture; G.lumi.body.texture=tx; G.lumi.itemsKey=G.items; if(old&&old!==P.Texture.EMPTY) old.destroy(true); } }catch(e){}
};
function placeLumi(){
  const L=G.lumi; if(!L) return;
  // Breite wie in der Reiter-Sicht: fast volle Breite, im Querformat durch die Höhe begrenzt (Kopf bis knapp über die Mitte)
  L.baseScale=Math.min(G.W*0.94, 380, G.H*0.5*POV.unit/296)/POV.unit;
  L.scale.set(L.baseScale);
  L.position.set(G.W/2+G.laneX, G.H+16);
}
G.setLane=function(lane){ G.lane=lane; };
G.setLumiState=function(s){ if(G.lumiState===s) return; G.lumiState=s; G.stateT=0; };
function animLumi(dt){
  const L=G.lumi, st=G.lumiState; G.stateT+=dt;
  const target=LANE_X[G.lane]*G.W*0.1;
  G.laneX=lerp(G.laneX,target,1-Math.pow(0.001,dt));
  const sp=clamp(G.speed/0.12,0,2.2);
  let y=0, rot=0, sc=1, earK=0, maneK=0, headNod=0;
  if(st==='ride'){
    G.phase+= dt*(5.5+sp*3.2);
    const ph=G.phase;
    y = -Math.max(0,Math.sin(ph))*12*(0.6+sp*0.3) + Math.sin(ph*2)*2;
    rot = Math.sin(ph+0.6)*0.02;
    sc = 1+Math.sin(ph)*0.008;
    earK = Math.sin(ph*0.5)*0.12; maneK=Math.sin(ph-0.8)*0.5; headNod=Math.sin(ph+0.3)*6;
  }else if(st==='brake'){
    const t=clamp(G.stateT/0.6,0,1), e=easeOut(t);
    y = lerp(-6, 12, e) - Math.sin(t*Math.PI)*6; rot = lerp(0,0.03,e); sc=lerp(1,0.98,e);
    earK=-0.2*e; maneK=0.9*(1-t); headNod=18*e;
  }else if(st==='stand'){
    y = 6+Math.sin(G.stateT*1.8)*2.5; rot=0.01;
    earK = Math.sin(G.stateT*2.4)*0.22; maneK=Math.sin(G.stateT*1.2)*0.15; headNod=4+Math.sin(G.stateT*1.5)*3;
  }else if(st==='launch'){
    const t=clamp(G.stateT/0.8,0,1);
    y = t<0.35? lerp(6,16,t/0.35) : lerp(16,-16,easeOut((t-0.35)/0.65)); rot=t<0.35?0.03:-0.02; sc=t<0.35?0.97:1.03;
    maneK=-1.2*(1-t); headNod=t<0.35?10:-8;
    if(t>=1){ G.setLumiState('ride'); }
  }else if(st==='cheer'){
    const t=clamp(G.stateT/0.6,0,1);
    y = -Math.sin(t*Math.PI)*30; sc=1+Math.sin(t*Math.PI)*0.05; rot=-Math.sin(t*Math.PI)*0.04;
    earK=Math.sin(t*Math.PI)*0.3; headNod=-Math.sin(t*Math.PI)*16;
    if(t>=1){ G.setLumiState('ride'); }
  }
  const lean=(G.laneX/(G.W*0.1||1));
  rot += lean*0.05;
  L.position.set(G.W/2+G.laneX, G.H+16+y*L.baseScale*0.75);
  L.rotation=rot; L.scale.set(L.baseScale*sc);
  L.funkel.position.set(-80+Math.sin(G.stateT*2.1)*10, -250+Math.cos(G.stateT*1.7)*9);
  L.funkel.alpha=0.8+Math.sin(G.stateT*9)*0.2;
  // Kamera: wippt gegen den Galopp, legt sich in die Kurve
  if(G.cam){
    G.cam.pivot.set(G.W/2,G.H/2); G.cam.position.set(G.W/2, G.H/2 - y*0.35);
    G.cam.rotation = lerp(G.cam.rotation, -lean*0.035, 1-Math.pow(0.01,dt));
  }
  // Glitzer: Funkelsterne auf Mähne und Horn
  L.glintT+=dt;
  if(L.glintT>0.09 && !G.reduce){ L.glintT=0;
    const g=new P.Sprite(G.tex.glint); g.anchor.set(0.5);
    const onHorn=Math.random()<0.3;
    g.position.set(onHorn? (Math.random()-0.5)*14 : -6+Math.random()*60, onHorn? -180-Math.random()*80 : -170+Math.random()*170);
    g.scale.set(0); g.age=0; g.life=0.5+Math.random()*0.4; g.rot=(Math.random()-0.5)*4; g.big=0.25+Math.random()*0.3;
    g.tint=[0xFFFFFF,0xFFF3C9,0xFFE9F5,0xE9F5FF][Math.floor(Math.random()*4)];
    L.inner.addChild(g); L.glints.push(g);
  }
  for(let i=L.glints.length-1;i>=0;i--){ const g=L.glints[i]; g.age+=dt; const k=g.age/g.life; g.scale.set(Math.sin(Math.min(1,k)*Math.PI)*g.big); g.rotation+=g.rot*dt; g.alpha=0.95; if(k>=1){ g.destroy(); L.glints.splice(i,1); } }
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
  sign.position.set(0,-286); inner.addChild(sign); c.sign=sign; c.txt=txt; c.sb=sb;
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
  // Zeitplan: ab crawlAt kriechen die Tore (Rest-Strecke dauert crawlMs), bei stopAt bleiben sie stehen und warten
  G.plan={crawlAt:opts.crawlAt!=null?opts.crawlAt:1, crawlMs:opts.crawlMs||0, stopAt:opts.stopAt!=null?opts.stopAt:null, boost:opts.boost!==false};
  G.planPhase='approach'; G.waitT=0;
  values.forEach((v,i)=>{ const p=makePortal(v,i,!!opts.worldgate); if(opts.hold){ p.t=G.holdAt; p.ly=0.16; } G.portals.push(p); });
  if(opts.hold){ G.held=true; G.targetSpeed=0; }
  else G.targetSpeed = 1/G.gateDur;
  G.onWaitLong=opts.onWaitLong||null;
};
function clearPortals(){ G.portals.forEach(p=>p.destroy({children:true})); G.portals=[]; }
function pick(lane){ if(!G.gatesActive||G.resolved) return; if(window.sndClick) window.sndClick('gate'); G.onPick&&G.onPick(lane); }
/* Tap-Auswertung über die Position. Pixi trifft die Tor-Objekte selbst nicht zuverlässig,
   darum entscheidet hier immer der Abstand zum Tor bzw. zum Schild am Weltentor. */
function onTap(e){
  if(!G.gatesActive||G.resolved) return;
  const x=e.global.x, y=e.global.y;
  if(G.gate && G.gate.signs){
    let best=-1,bd=1e9;
    G.gate.signs.forEach((sg,i)=>{ const g=sg.getGlobalPosition(); const d=Math.hypot(g.x-x,g.y-y); if(d<bd){bd=d;best=i;} });
    if(best>=0 && bd<Math.max(90,G.W*0.28)) pick(best);
    return;
  }
  if(!G.portals.length) return;
  if(y<G.vp.y-60) return;
  let best=null,bd=1e9; G.portals.forEach(p=>{ const d=Math.abs(p.x-x); if(d<bd){bd=d;best=p;} });
  if(best) pick(best.lane);
}
G.resumeGates=function(ms){ G.hideGroups(); G.held=false; G.holdAt=null; const rest=1-(G.portals[0]?G.portals[0].t:0); G.gateDur=(ms||1200)/1000; G.targetSpeed=rest/G.gateDur; };
function updPortals(dt){
  const pal=curPalette();
  for(const p of G.portals){
    if(!G.resolved){
      const plan=G.plan||{crawlAt:1,crawlMs:0,stopAt:null,boost:true};
      const boost = (plan.boost && p.t<0.45) ? (G.boost||1) : 1;
      let sp=G.speed*boost;
      if(plan.stopAt!==null && p.t>=plan.stopAt){
        // stehen bleiben und warten: Welt kriecht, Lumi trabt, nichts läuft ab
        sp=0; if(G.planPhase!=='wait'){ G.planPhase='wait'; G.targetSpeed=0.012; }
        G.waitT+=dt/G.portals.length;
      }else if(p.t>plan.crawlAt && plan.crawlMs>0){
        const crawl=(1-plan.crawlAt)/(plan.crawlMs/1000);
        if(G.planPhase==='approach'){ G.planPhase='crawl'; G.targetSpeed=Math.max(0.02,crawl); }
        sp=Math.min(sp,crawl);
      }
      p.t+=sp*dt;
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
      G.portals.forEach(p=>{ p.fly=true; p.flyT=0; p.flyDur=o.good?0.95:0.8; p.t0=p.t; p.lx0=p.lx; p.ly0=p.ly; p.sign.visible=false; });
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


/* ---------- Weltentor: echtes Tor mit Flügeltüren, dahinter die nächste Welt ---------- */
G.worldGate=function(values, nextWorld){
  clearPortals(); G.clearGate();
  const w=WORLDS[nextWorld]||WORLDS.wolken;
  const c=new P.Container(); G.gate=c; G.layers.portals.addChild(c);
  c.t=0.86; c.lx=0; c.ly=0.02; c.base=Math.min(G.W*0.92, G.H*0.62)/320;
  const inner=new P.Container(); c.addChild(inner); c.inner=inner;
  // Blick durch die Türöffnung: Himmel der nächsten Welt (nur sichtbar, wenn die Türen aufgehen)
  const view=new P.Container(); inner.addChild(view);
  const vg=new P.Graphics(); const top=hex(w.top), mid=hex(w.mid), bot=hex(w.bot);
  for(let i=0;i<16;i++){ const q=i/15; const col=q<0.55?lerpColor(top,mid,q/0.55):lerpColor(mid,bot,(q-0.55)/0.45); vg.rect(-110,-180+q*240,220,16).fill(col); }
  vg.ellipse(0,-40,150,8).fill({color:0xffffff,alpha:0.5});
  if(w.sun){ vg.circle(-60,-130,18).fill({color:0xFFE9A8}); }
  if(w.night){ vg.circle(60,-135,14).fill({color:0xFFF3C9}); for(let i=0;i<14;i++){ vg.star(-100+Math.random()*200,-170+Math.random()*120,5,3+Math.random()*3,1.3).fill({color:0xFFF3C9,alpha:0.9}); } }
  if(w.sea){ vg.rect(-110,-30,220,40).fill({color:0x4A90C4,alpha:0.45}); for(let i=0;i<8;i++) vg.circle(-100+Math.random()*200,-25+Math.random()*30,2).fill({color:0xffffff,alpha:0.8}); }
  if(w.hills){ vg.ellipse(-40,-20,110,36).fill({color:0xF6B9D9}); vg.ellipse(70,-10,100,34).fill({color:0xF3A8D0}); }
  for(let i=0;i<3;i++){ const cl=new P.Sprite(G.tex.cloud); cl.anchor.set(0.5); cl.scale.set(0.25+i*0.08); cl.position.set(-80+i*80,-70+i*25); cl.alpha=0.9; view.addChild(cl); }
  view.addChildAt(vg,0);
  const mask=new P.Graphics().rect(-110,-180,220,240).fill(0xffffff); inner.addChild(mask); view.mask=mask;
  // Tor: Pfeiler, Bogen, Flügeltüren
  const stone=0xF6F0FA, trim=0xC9B6EE, gold=0xF2B83C, ink=0x3B2A52;
  const frame=new P.Graphics();
  frame.roundRect(-165,-220,55,290,14).fill(stone).stroke({width:6,color:ink});
  frame.roundRect(110,-220,55,290,14).fill(stone).stroke({width:6,color:ink});
  frame.ellipse(0,-200,165,70).fill(stone).stroke({width:6,color:ink});
  frame.rect(-170,-200,340,40).fill(stone);
  frame.ellipse(0,-200,110,42).fill({color:0xE9E0F6}).stroke({width:5,color:ink});
  frame.rect(-110,-200,220,30).fill(0xE9E0F6);
  frame.star(0,-205,5,22,10).fill(gold).stroke({width:3,color:0xD99A1E});
  [[-137,-150],[-137,-60],[-137,30],[137,-150],[137,-60],[137,30]].forEach(([x,y])=>frame.circle(x,y,8).fill(trim));
  // Türen: zwei Flügel, Drehpunkt an der Außenkante
  const mkDoor=(side)=>{ const d=new P.Container(); d.position.set(side*110,0); const g=new P.Graphics();
    g.roundRect(side<0?0:-110,-180,110,240,10).fill(0xEDE4F8).stroke({width:6,color:ink});
    g.star(side*-55,-80,5,26,12).fill(gold).stroke({width:3,color:0xD99A1E});
    g.circle(side*-18,-50,6).fill(ink);
    d.addChild(g); d.side=side; inner.addChild(d); return d; };
  c.doorL=mkDoor(-1); c.doorR=mkDoor(1);
  inner.addChild(frame);
  // Drei Antwort-Schilder: linker Pfeiler, Schlussstein, rechter Pfeiler
  c.signs=[[-137,-100],[0,-262],[137,-100]].map(([x,y],lane)=>{
    const sg=new P.Container(); sg.position.set(x,y);
    const sb=new P.Sprite(G.tex.sign); sb.anchor.set(0.5); sb.scale.set(0.62); sg.addChild(sb);
    const tx=new P.Text({text:String(values[lane]), style:{fontFamily:'"Baloo 2", Nunito, sans-serif', fontSize:42, fontWeight:'700', fill:ink}}); tx.anchor.set(0.5); tx.position.set(0,-2); sg.addChild(tx);
    sg.eventMode='static'; sg.cursor='pointer'; sg.on('pointertap',e=>{ e.stopPropagation(); pick(lane); });
    sg.sb=sb; sg.tx=tx; inner.addChild(sg); return sg; });
  c.open=0; c.held=true;
  G.held=true; G.targetSpeed=0; G.gatesActive=true; G.resolved=false;
  updGate();
};
function updGate(dt){
  const c=G.gate; if(!c) return;
  const q=proj(c.lx,c.ly,c.t);
  c.position.set(q.x,q.y); c.scale.set(q.s*c.base);
  // Türen schwingen nach hinten auf (Perspektive: schmaler und dunkler)
  const k=easeInOut(clamp(c.open,0,1));
  c.doorL.scale.x=lerp(1,0.12,k); c.doorR.scale.x=lerp(1,0.12,k);
  c.doorL.tint=c.doorR.tint=lerpColor(0xffffff,0xB7A8CF,k);
  if(c.shake>0){ c.shake-=dt||0.016; c.rotation=Math.sin(c.shake*60)*0.02; } else c.rotation=0;
  if(c.signs) c.signs.forEach(sg=>{ sg.scale.set(1+Math.sin(G.time*3+sg.x)*0.03); });
}
G.clearGate=function(){ if(G.gate){ G.gate.destroy({children:true}); G.gate=null; } };
/* Tor-Auflösung: richtig -> Türen auf, Anritt, Durchritt; falsch -> Rütteln, Lösung zeigen, dann trotzdem auf */
G.resolveWorldGate=function(o){
  const c=G.gate; if(!c) return Promise.resolve();
  G.resolved=true; G.gatesActive=false;
  c.signs.forEach((sg,i)=>{ if(i===o.goodLane){ sg.sb.tint=0xFFF4D6; sg.tx.style.fill=0x9C6A00; } else if(i===o.pickedLane){ sg.sb.tint=0xF3B6BA; } else sg.alpha=0.3; });
  return new Promise(res=>{
    const wait=o.good?0.2:1.2;
    if(!o.good){ c.shake=0.5; }
    G.after(wait,()=>{
      // Türen öffnen
      const t0=G.time; const openDur=0.9;
      const tick=()=>{ if(!G.gate) return; const k=(G.time-t0)/openDur; c.open=k; if(k<1) G.after(0.016,tick); };
      tick();
      if(o.onOpen) G.after(0.5,o.onOpen);
      G.after(openDur+0.3,()=>{
        G.held=false; G.setLumiState('launch');
        const t1=G.time, dur=1.3, from=c.t;
        const ride=()=>{ if(!G.gate) return; const k=clamp((G.time-t1)/dur,0,1); c.t=lerp(from,1.36,easeIn(k)); c.ly=lerp(0.02,0.3,k); c.signs.forEach(sg=>sg.visible=k<0.3); if(k<1) G.after(0.016,ride); };
        ride();
        G.targetSpeed=0.12;
        G.after(dur*0.82,()=>{ G.flash(0.95); G.shake(1.4); const q=proj(0,0.2,1.05); G.burst(q.x,q.y,70,true); G.setLumiState('cheer'); });
        G.after(dur+0.15,()=>{ G.clearGate(); res(); });
      });
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
  if(G.planPhase==='wait' && G.waitT>15 && G.onWaitLong){ const f=G.onWaitLong; G.onWaitLong=null; f(); }
  moveField(dt); updPortals(dt); updGate(dt); updParts(dt); updSpeedLines(dt); updAmb(dt); animLumi(dt);
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
  if(opts.items!==undefined) G.setLumiItems(opts.items);
  G.combo=0; G.speed=0; G.targetSpeed=0.1; G.held=false; G.gatesActive=false; G.resolved=false; G.lane=1; G.laneX=0;
  clearPortals(); G.clearGate(); G.clouds.forEach(c=>c.destroy()); G.clouds=[]; G.sparks.forEach(c=>c.destroy()); G.sparks=[]; G.amb.forEach(c=>c.destroy()); G.amb=[];
  G.setLumiState('ride'); G.tweens=[]; G.lastAmb=4;
  for(let i=0;i<8;i++) spawnCloud(Math.random());
  G.app.ticker.start();
};
G.changeWorld=function(name){ G.worldName=name; G.setWorld(name,false); };
G.setCombo=function(n){ G.combo=n; G.boost=Math.min(1.9, 1+n*0.15); };
G.setSpeedFactor=function(f){ G.targetSpeed = f; };
G.stop=function(){ clearPortals(); G.clearGate(); G.hideGroups(); G.tweens=[]; G.app.ticker.stop(); };
G.brake=function(){ G.setLumiState('brake'); G.brakePuffs(); G.targetSpeed=0; G.after(0.65,()=>{ if(G.lumiState==='brake') G.setLumiState('stand'); }); };
G.launch=function(){ G.setLumiState('launch'); G.held=false; };

/* ===================== Intro: Lumi fliegt heran, Looping, Landung ===================== */
G.playIntro=async function(host, opts){
  opts=opts||{};
  if(matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const app=new P.Application();
  await app.init({width:Math.max(2,host.clientWidth), height:Math.max(2,host.clientHeight), backgroundAlpha:0, antialias:true, resolution:Math.min(2,devicePixelRatio||1), autoDensity:true});
  host.appendChild(app.canvas); app.canvas.style.position='absolute'; app.canvas.style.inset='0';
  const names=['cloud','star','spark','glint'];
  await P.Assets.load(names.map(n=>({alias:n, src:'assets/'+n+'.png?v='+VERSION})));
  const T=n=>P.Assets.get(n);
  const W=app.screen.width, H=app.screen.height;
  const stage=app.stage;
  // Himmel
  const sky=new P.Graphics(); const n=24;
  for(let i=0;i<n;i++){ const t=i/(n-1); const col=t<0.55?lerpColor(0xBBDDF8,0xE9E2FA,t/0.55):lerpColor(0xE9E2FA,0xFBEFF7,(t-0.55)/0.45); sky.rect(0,Math.floor(H*t)-1,W,Math.ceil(H/(n-1))+2).fill(col); }
  stage.addChild(sky);
  const sun=new P.Sprite(T('spark')); sun.anchor.set(0.5); sun.tint=0xFFE9A8; sun.scale.set(W/260); sun.alpha=0.85; sun.position.set(W*0.15,H*0.12); stage.addChild(sun);
  // Wolken, die seitlich vorbeiziehen (Parallax)
  const clouds=[]; for(let i=0;i<10;i++){ const c=new P.Sprite(T('cloud')); c.anchor.set(0.5); c.z=0.3+Math.random()*0.7; c.position.set(Math.random()*W, H*(0.1+Math.random()*0.8)); c.scale.set(0.25+c.z*0.6); c.alpha=0.5+c.z*0.4; stage.addChild(c); clouds.push(c); }
  // Regenbogen-Spur (wird beim Looping gezeichnet)
  const trail=new P.Graphics(); stage.addChild(trail);
  const fx=new P.Container(); stage.addChild(fx);
  // Lumi aus einem Stück: dieselbe Seitenansicht wie auf der Startseite (unicornSVG in index.html), 2x gerastert
  const SIDE={vb:[-12,-12,224,184], ax:100, ay:95, k:2};
  const L=new P.Container(); const inner=new P.Container(); inner.scale.set(1/SIDE.k); L.addChild(inner);
  const bodyS=new P.Sprite(P.Texture.EMPTY); bodyS.anchor.set((SIDE.ax-SIDE.vb[0])/SIDE.vb[2], (SIDE.ay-SIDE.vb[1])/SIDE.vb[3]); inner.addChild(bodyS);
  try{ if(typeof window.unicornSVG==='function') bodyS.texture=await svgToTexture(window.unicornSVG(opts.items||0,200), SIDE.vb, SIDE.k); }catch(e){}
  stage.addChild(L);
  // Ziel: dort, wo auf der Startseite das Einhorn sitzt
  const tgt=opts.target||{x:W/2,y:H*0.3,w:200};
  const endScale=tgt.w/200;
  let t=0, done=false, skipped=false;
  const sparks=[];
  const spawnSpark=(x,y)=>{ const s=new P.Sprite(Math.random()<0.4?T('star'):T('glint')); s.anchor.set(0.5); s.position.set(x,y); s.tint=[0xFFD98A,0xF8A0C8,0xB493F0,0x8FD6B0,0xFFFFFF][Math.floor(Math.random()*5)]; s.vx=(Math.random()-0.5)*60; s.vy=(Math.random()-0.5)*60+30; s.age=0; s.life=0.6+Math.random()*0.5; s.scale.set(0.3+Math.random()*0.4); fx.addChild(s); sparks.push(s); };
  const resolveP=new Promise(res=>{ G._introDone=res; });
  const finish=()=>{ if(done) return; done=true; app.ticker.stop(); try{ app.destroy(true,{children:true}); }catch(e){} G._introDone(); };
  host.addEventListener('pointerdown',()=>{ skipped=true; finish(); },{once:true});
  const total=5.2;
  // Glitzer-Schichten: funkelnde Sterne im Himmel, Glitzer auf Lumi, dichter Funkenschweif
  const twinkles=[]; for(let i=0;i<70;i++){ const st=new P.Sprite(T('glint')); st.anchor.set(0.5); st.position.set(Math.random()*W, Math.random()*H); st.ph=Math.random()*6; st.sp=1.5+Math.random()*2.5; st.sz=0.15+Math.random()*0.35; st.tint=[0xFFFFFF,0xFFF3C9,0xFFE9F5][i%3]; stage.addChildAt(st,2); twinkles.push(st); }
  const bodyGlints=[]; let bgT=0;
  G._introApp=app;
  app.ticker.add(tk=>{
    const dt=Math.min(0.1,tk.deltaMS/1000); t+=dt; G._introT=t;
    let x,y,sc,rot=0,face=1,gallop=true,vy=0;
    if(t<1.9){
      // 1) Lumi kommt aus der Ferne direkt auf dich zu, leichtes Schlängeln, wird groß
      const k=easeInOut(t/1.9);
      x=W*0.5+Math.sin(t*3.2)*W*0.08*(1-k*0.5); y=lerp(H*0.30,H*0.52,k); sc=lerp(0.06,endScale*1.25,k*k);
      vy=Math.cos(t*3.2)*0.2; face=1;
    }else if(t<3.4){
      // 2) Drehung mit Tiefe: flache Ellipse, hinten klein und nach links schauend, vorne groß und nach rechts
      const k=(t-1.9)/1.5; const a=Math.PI*0.5+k*Math.PI*2;
      const rx=W*0.30, ry=H*0.07, cx=W*0.5, cy=H*0.46;
      const depth=(Math.sin(a)+1)/2;
      x=cx+Math.cos(a)*rx; y=cy+Math.sin(a)*ry-(1-depth)*H*0.02; sc=endScale*lerp(0.55,1.25,depth);
      face = -Math.sin(a)>=0 ? 1 : -1;
      vy=Math.cos(a)*0.35;
      if(k>0.03){ const cols=[0xF96D6D,0xF2CE4B,0x4FC47F,0x58A6F0,0x9A6AE8]; for(let i=0;i<5;i++){ trail.circle(x-face*sc*70, y+sc*(i*7-14), 3.5*lerp(0.6,1.2,depth)).fill({color:cols[i],alpha:0.85}); } }
    }else if(t<4.4){
      // 3) Gleitflug zur Landung
      const k=easeInOut((t-3.4)/1.0); x=lerp(W*0.5,tgt.x,k); y=lerp(H*0.53,tgt.y,k)-Math.sin(k*Math.PI)*H*0.07; sc=lerp(endScale*1.25,endScale,k); vy=-Math.cos(k*Math.PI)*0.5; gallop=k<0.8; face=1;
    }else{ x=tgt.x; y=tgt.y+Math.sin((t-4.4)*3)*3; sc=endScale; gallop=false; face=1; }
    rot=-vy*0.25*face;
    L.position.set(x,y); L.scale.set(sc*face, sc); L.rotation=rot;
    const ph=t*9;
    // ganzer Körper wippt im Galopp, keine Einzelteile
    inner.y = gallop? -Math.abs(Math.sin(ph))*10 : 0; inner.rotation = gallop? Math.sin(ph)*0.04 : 0;
    if(t>4.4 && !L.landed){ L.landed=true; for(let i=0;i<90;i++) spawnSpark(x+(Math.random()-0.5)*tgt.w*1.6, y+(Math.random()-0.5)*tgt.w); if(opts.onLand) opts.onLand(); }
    if(t<4.4){ const n=Math.min(6,Math.floor(dt*120)+1); for(let i=0;i<n;i++) spawnSpark(x-face*sc*(60+Math.random()*60), y+sc*(Math.random()*60-10)); }
    bgT+=dt; if(bgT>0.05){ bgT=0; const g=new P.Sprite(T('glint')); g.anchor.set(0.5); g.position.set((Math.random()*2-1)*150,(Math.random()*2-1)*120); g.scale.set(0); g.age=0; g.life=0.45; g.big=0.8+Math.random()*0.9; g.tint=[0xFFFFFF,0xFFF3C9,0xFFE9F5][Math.floor(Math.random()*3)]; inner.addChild(g); bodyGlints.push(g); }
    for(let i=bodyGlints.length-1;i>=0;i--){ const g=bodyGlints[i]; g.age+=dt; const k=g.age/g.life; g.scale.set(Math.sin(Math.min(1,k)*Math.PI)*g.big); g.rotation+=dt*4; if(k>=1){ g.destroy(); bodyGlints.splice(i,1); } }
    twinkles.forEach(st=>{ st.alpha=0.35+Math.sin(t*st.sp+st.ph)*0.35; st.scale.set(st.sz*(0.8+Math.sin(t*st.sp*1.3+st.ph)*0.3)); st.rotation+=dt*0.5; });
    for(let i=sparks.length-1;i>=0;i--){ const s=sparks[i]; s.age+=dt; s.x+=s.vx*dt; s.y+=s.vy*dt; s.rotation+=dt*3; s.alpha=1-s.age/s.life; if(s.age>=s.life){ s.destroy(); sparks.splice(i,1); } }
    clouds.forEach(c=>{ c.x-= (t<4.4? 60:10)*c.z*dt; if(c.x<-120) c.x=W+120; });
    trail.alpha=Math.max(0, 1-Math.max(0,t-3.4)/1.2);
    if(t>=total) finish();
  });
  return resolveP;
};
})();
