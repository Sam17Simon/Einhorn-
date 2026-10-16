/* =====================================================================
   Kawumm: Rückwärtsreihen als Schatzsuche (seit v38)
   - Lernlogik oben (DOM-frei, in Node testbar), Oberfläche unten.
   - Nutzt zur Laufzeit die Helfer aus index.html (S, save, speak, show, $ ...).
     Diese Datei wird vor dem Hauptskript geladen und ruft beim Laden nichts davon auf.
   ===================================================================== */
'use strict';

/* Für Romy sichtbar erst, wenn KW_LIVE = true. Bis dahin nur über den Elternbereich (Testmodus). */
const KW_LIVE = false;
/* Reihenfolge der Schatzkarten: Kawumm startet mit der Einserreihe, dann die Inselreihenfolge */
const KW_ORDER = [1,2,10,5,4,8,3,6,9,7];
const KW_FWD_SHARE = 0.5;     // eigene Vorwärtsreihe halbwegs: 5 von 10 Aufgaben lila (Box 3+)
const KW_FAST = 4000;         // schnelle Antwort wie vorwärts
const KW_SAFE_BOX = 3;
const KW_CAP = 10;            // Schätze pro Sammelbehälter

/* ================= KW-LOGIC-START ================= */
function kwDefault(){ return {joined:false, rows:{}}; }
/* Zustand einer Rückwärtsreihe. steps[k] = Schritt von k·r nach (k-1)·r */
function kwRowState(kw, r){
  if(!kw.rows[r]){
    const steps={}; for(let k=1;k<=10;k++) steps[k]={box:0, seen:0, ok:0, no:0, rt:[]};
    kw.rows[r]={stage:'sea', clean:0, runs:0, finds:0, steps};
  }
  return kw.rows[r];
}
function kwRowSafe(rs){ return rs ? Object.values(rs.steps).filter(s=>s.box>=KW_SAFE_BOX).length : 0; }
/* Offene Schatzkarten. Eine neue kommt nur, wenn BEIDES stimmt:
   die Karte davor ist im Meer geschafft (Stufe Weltall erreicht) UND die eigene Vorwärtsreihe sitzt halbwegs. */
function kwAvailable(kw, fwdShare){
  const out=[KW_ORDER[0]];
  for(let i=1;i<KW_ORDER.length;i++){
    const prev=kw.rows[KW_ORDER[i-1]], r=KW_ORDER[i];
    if(prev && prev.stage==='space' && fwdShare(r)>=KW_FWD_SHARE) out.push(r); else break;
  }
  return out;
}
/* Wie viel Hilfe die Karte zeigt:
   sea1 = Meer, Anfang: kommende Zahlen schwach sichtbar
   sea2 = Meer nach einer fehlerfreien Fahrt: kommende Zahlen als ?, gefahrene Spur bleibt sichtbar
   space = Weltall: nur die aktuelle Zahl und der Sprung */
function kwHelpMode(rs){ return rs.stage==='space' ? 'space' : (rs.clean>=1 ? 'sea2' : 'sea1'); }
/* Plan einer Fahrt: Start (Super-Speed im Weltall startet mitten in der Reihe) und wo Störenfriede sitzen.
   Störenfriede: im Meer selten, im Weltall öfter, nie zweimal hintereinander, nie im ersten Schritt, nie in der allerersten Fahrt. */
function kwPlanRun(rs, rng){
  rng=rng||Math.random;
  let startK=10, superSpeed=false;
  if(rs.stage==='space' && rs.runs>0 && rng()<0.35){ startK=5+Math.floor(rng()*4); superSpeed=true; }
  const p = rs.stage==='space' ? 0.3 : 0.15;
  const covers=[]; let last=false;
  for(let k=startK;k>=1;k--){
    const c = rs.runs>0 && k!==startK && !last && rng()<p;
    if(c) covers.push(k); last=c;
  }
  return {startK, superSpeed, covers};
}
/* Drei Inseln zur Wahl: richtige Zahl plus typische Rückwärts-Fehler.
   Zahl übersprungen (zwei Sprünge), nur 1 weggenommen, Zehnerübergang vergessen (32-4 -> 38). */
function kwOptions(r, k, rng){
  rng=rng||Math.random;
  const cur=k*r, ans=(k-1)*r;
  const ok=n=>Number.isInteger(n) && n>=0 && n<=100 && n!==ans && n!==cur;
  const typical=[ans-r, cur-1];
  if(r>1 && Math.floor(cur/10)!==Math.floor(ans/10)) typical.push(ans+10);
  const rest=[ans+1, ans-1, ans+2, ans-2, ans-10];
  const opts=[ans], seen=new Set([ans]);
  const add=n=>{ if(opts.length<3 && ok(n) && !seen.has(n)){ seen.add(n); opts.push(n); } };
  typical.slice().sort(()=>rng()-0.5).forEach(add);
  rest.forEach(add);
  for(let b=3; opts.length<3 && b<60; b++){ add(ans+b); add(ans-b); }
  return opts.sort(()=>rng()-0.5);
}
/* Ein Schritt geht in die Lernkartei wie vorwärts: schnell richtig = Fach hoch, langsam richtig = unten hoch, oben halten, falsch = Fach 1 */
function kwApplyStep(s, correct, rt){
  s.seen++; s.rt.push(Math.min(rt,20000)); if(s.rt.length>5) s.rt.shift();
  if(correct){ s.ok++; if(rt<=KW_FAST) s.box=Math.min(5,s.box+1); else if(s.box<2) s.box++; }
  else { s.no++; s.box=Math.max(0, Math.min(s.box,1)); }
}
/* Fahrt beendet. clean = alles richtig und schnell. Zwei saubere Fahrten am Stück im Meer: ab ins Weltall. */
function kwFinishRun(rs, clean){
  const res={toSpace:false, find:false, full:false};
  rs.runs++;
  if(rs.stage==='sea'){
    rs.clean = clean ? rs.clean+1 : 0;
    if(rs.clean>=2){ rs.stage='space'; res.toSpace=true; }
  }
  if(rs.finds<KW_CAP){ rs.finds++; res.find=true; res.full = rs.finds===KW_CAP; }
  return res;
}
/* ================= KW-LOGIC-END ================= */

if(typeof module!=='undefined' && module.exports){
  module.exports={KW_ORDER,KW_CAP,kwDefault,kwRowState,kwRowSafe,kwAvailable,kwHelpMode,kwPlanRun,kwOptions,kwApplyStep,kwFinishRun};
}

/* ===================== Oberfläche ===================== */
if(typeof document!=='undefined'){

const KW_INK='#3B2A52';
const KW_IMG='assets/kawumm.png?v=1';
const KW_VOICE={rate:1.08, pitch:0.85, alt:true};   // Kawumm klingt tiefer als Lumi (Lumi: 1.14)
let kwTest=false;                                    // Testmodus aus dem Elternbereich, gilt bis zum Neustart
let KR=null;                                         // laufende Schatzsuche
let kwVaultRet='path';

function kws(){ if(!S.kw) S.kw=kwDefault(); return S.kw; }
function kwActive(){ return kwTest || (KW_LIVE && kws().joined); }
function kwFwd(r){ return rowMastery(S,r); }
function kwAvail(){ return kwAvailable(kws(), kwFwd); }
function kwSay(t,cb){ speak(t,cb,KW_VOICE); }
function kwPick(a){ return a[Math.floor(Math.random()*a.length)]; }
function kwNum(n){ return n===1?'eins':String(n); }
function kwNoRainbow(g){ const c=Object.assign({}, gearOf(g)); delete c.rainbow; return c; }

/* ---------- Was Kawumm sagt: frech, mutig, selbstbewusst, manchmal ein bisschen ängstlich ---------- */
const KW_LINES={
  startSea:['Ahoi! Leinen los! Wir segeln rückwärts bis zum Schatz.','Kawumm! Die Karte zeigt nach unten. Wir zählen rückwärts!','Ich hab keine Angst vor Kraken. Na gut, ein ganz kleines bisschen. Los geht es!','Käpt\'n {name} und Käpt\'n Kawumm. Das wird ein Abenteuer!'],
  startSpace:['Raketen an! Ab ins Weltall!','Festhalten! Im Weltall wohnen freche Aliens.','Huiii, so hoch! Mir wird ein bisschen mulmig. Aber wir schaffen das!'],
  ok:['Kawumm! Richtig!','Volltreffer, Käpt\'n!','Hab ich doch gewusst!','Ha! Zu leicht für uns!','Weiter so!','Genau da lang!','Sauber gesegelt!'],
  wrong:['Huch, das war nur Nebel! Es geht zur {n}.','Uiii, fast! Die richtige Insel ist die {n}.','Ups! Das passiert sogar mir. Wir segeln zur {n}.','Hoppla! Kein Problem, Piraten probieren weiter. Es ist die {n}.'],
  wrongSpace:['Huch, das war nur ein Sternennebel! Es geht zur {n}.','Ups, falscher Planet! Wir fliegen zur {n}.'],
  gull:['He, Möwe! Runter von meiner Karte!','Oh nein, die Möwe sitzt auf der Karte! Egal, wir wissen das auch so.'],
  alien:['Ein Alien sitzt auf meiner Karte! Hihi, das kitzelt.','Huch, ein Alien! Keine Angst, das will nur spielen.','He, Alien, das ist meine Karte! Na gut, wir rechnen im Kopf.'],
  speed:['Super-Speed! Festhalten!','Kawumm-Turbo! Wir springen ein Stück weiter!','Wuuusch! Mit Super-Speed sind wir schon bei der {n}!'],
  treasure:['Schatz gefunden! Kawumm!','Da ist die Schatzkiste! Ich wusste es!','Juhuuu! Wir sind reich!']
};

/* ---------- Sammelbehälter: einer pro Insel, zehn Schätze passen hinein ---------- */
const KW_SLOTS=[[36,80],[50,81],[64,80],[43,71],[57,71],[36,62],[50,62],[64,62],[43,53],[57,53]];
function kwStar(x,y,r,f){ let d=''; for(let i=0;i<10;i++){ const rr=i%2?r*0.45:r, a=i*Math.PI/5-Math.PI/2; d+=(i?'L':'M')+(x+Math.cos(a)*rr).toFixed(1)+' '+(y+Math.sin(a)*rr).toFixed(1); } return '<path d="'+d+'Z" fill="'+f+'" stroke="#D99A1E" stroke-width="1"/>'; }
const KW_ITEM={
  carrot:(x,y)=>`<g><path d="M${x-5} ${y-6} L${x+5} ${y-6} L${x} ${y+9} Z" fill="#F28C2E" stroke="${KW_INK}" stroke-width="1.6" stroke-linejoin="round"/><path d="M${x-2} ${y-6} q-3 -6 -1 -8 M${x+2} ${y-6} q3 -6 1 -8 M${x} ${y-6} v-8" stroke="#4FA84F" stroke-width="2.2" stroke-linecap="round" fill="none"/><path d="M${x-2} ${y-1} h3 M${x-1} ${y+3} h2" stroke="#D26A12" stroke-width="1"/></g>`,
  nugget:(x,y)=>`<g><path d="M${x-7} ${y+3} Q${x-8} ${y-4} ${x-2} ${y-6} Q${x+6} ${y-7} ${x+7} ${y} Q${x+7} ${y+6} ${x} ${y+6} Q${x-6} ${y+7} ${x-7} ${y+3} Z" fill="#F7C948" stroke="#C48A12" stroke-width="1.6"/><path d="M${x-3} ${y-3} q2 -1 4 0" stroke="#FFF6C8" stroke-width="1.6" fill="none" stroke-linecap="round"/></g>`,
  star:(x,y)=>`<g><circle cx="${x}" cy="${y}" r="8" fill="#FFF3B0" opacity=".35"/>${kwStar(x,y,6.5,'#FFE27A')}</g>`,
  bubble:(x,y)=>`<g><circle cx="${x}" cy="${y}" r="6.5" fill="#E6F6FF" fill-opacity=".55" stroke="#8CC6F4" stroke-width="1.6"/><path d="M${x-3} ${y-2} q1 -3 4 -3" stroke="#fff" stroke-width="1.6" fill="none" stroke-linecap="round"/></g>`,
  alien:(x,y)=>`<g><path d="M${x} ${y-7} v-4" stroke="${KW_INK}" stroke-width="1.4"/><circle cx="${x}" cy="${y-12}" r="1.8" fill="#F96D9B"/><circle cx="${x}" cy="${y}" r="7" fill="#8EDB6E" stroke="${KW_INK}" stroke-width="1.6"/><circle cx="${x}" cy="${y-1}" r="3" fill="#fff"/><circle cx="${x+.6}" cy="${y-.6}" r="1.5" fill="${KW_INK}"/><path d="M${x-3} ${y+3.5} q3 2 6 0" stroke="${KW_INK}" stroke-width="1.2" fill="none" stroke-linecap="round"/></g>`,
  pearl:(x,y)=>`<g><circle cx="${x}" cy="${y}" r="5.5" fill="#FFF4F7" stroke="#D9B8C8" stroke-width="1.4"/><circle cx="${x-2}" cy="${y-2}" r="1.8" fill="#fff"/></g>`,
  marble:(x,y,i)=>{ const c=['#F96D6D','#58A6F0','#4FC47F','#F2B83C','#B493F0'][i%5]; return `<g><circle cx="${x}" cy="${y}" r="6" fill="${c}" stroke="${KW_INK}" stroke-width="1.4"/><path d="M${x-4} ${y+1} q4 -6 8 -1" stroke="#fff" stroke-width="1.5" fill="none" opacity=".8"/></g>`; },
  planet:(x,y,i)=>{ const c=['#F28C2E','#58A6F0','#B493F0','#4FC47F','#F96D9B'][i%5]; return `<g><circle cx="${x}" cy="${y}" r="5.5" fill="${c}" stroke="${KW_INK}" stroke-width="1.4"/><ellipse cx="${x}" cy="${y}" rx="9" ry="2.6" fill="none" stroke="#FFE27A" stroke-width="1.6" transform="rotate(-18 ${x} ${y})"/></g>`; },
  candy:(x,y,i)=>{ const c=['#F96D9B','#58A6F0','#F2B83C','#4FC47F'][i%4]; return `<g><path d="M${x-5} ${y} l-5 -4 v8 Z M${x+5} ${y} l5 -4 v8 Z" fill="${c}" stroke="${KW_INK}" stroke-width="1.2" stroke-linejoin="round"/><circle cx="${x}" cy="${y}" r="5" fill="${c}" stroke="${KW_INK}" stroke-width="1.4"/><path d="M${x-2} ${y-2} l4 4" stroke="#fff" stroke-width="1.4"/></g>`; },
  crystal:(x,y)=>`<g><circle cx="${x}" cy="${y}" r="8" fill="#FFB36B" opacity=".3"/><path d="M${x} ${y-8} L${x+5} ${y-1} L${x} ${y+7} L${x-5} ${y-1} Z" fill="#F96D6D" stroke="#B83A33" stroke-width="1.4" stroke-linejoin="round"/><path d="M${x} ${y-8} L${x} ${y+7} M${x-5} ${y-1} L${x+5} ${y-1}" stroke="#FFC9A8" stroke-width="1"/></g>`
};
const KW_BOX={
  1:{name:'Kichermöhren-Korb', a:'eine Kichermöhre', item:'carrot', lift:-28, line:'Die Möhren kichern, wenn man sie kitzelt. Hihi!'},
  2:{name:'Goldkiste', a:'einen Goldklumpen', item:'nugget', lift:-26, line:'Meine Goldkiste! Je voller, desto besser.'},
  10:{name:'Sternenglas', a:'einen Sternschnuppen-Stern', item:'star', lift:0, line:'Im Sternenglas leuchten echte Sternschnuppen. Auch nachts!'},
  5:{name:'Zauberblasen-Flasche', a:'eine Zauberblase', item:'bubble', lift:-2, line:'Pssst. Wenn man eine Zauberblase anpustet, singt sie.'},
  4:{name:'Kuschel-Ufo', a:'ein Mini-Alien', item:'alien', lift:-6, line:'Im Kuschel-Ufo wohnen meine Mini-Aliens. Sie winken dir!'},
  8:{name:'Perlenmuschel', a:'eine Meeresperle', item:'pearl', lift:2, line:'Die Perlenmuschel hab ich ganz tief unten gefunden. Ich war sehr mutig!'},
  3:{name:'Murmelglas', a:'eine Kullermurmel', item:'marble', lift:0, line:'Kullermurmeln rollen immer bergauf. Echt wahr!'},
  6:{name:'Planetennetz', a:'einen Mini-Planeten', item:'planet', lift:-4, line:'Mini-Planeten fängt man mit einem Netz. Ganz vorsichtig.'},
  9:{name:'Glitzerbonbon-Dose', a:'ein Glitzerbonbon', item:'candy', lift:-22, line:'Glitzerbonbons schmecken nach Regenwolke. Lecker!'},
  7:{name:'Vulkantopf', a:'einen Feuerkristall', item:'crystal', lift:-24, line:'Die Feuerkristalle sind warm wie eine Wärmflasche.'}
};
function kwItems(r,n){ const b=KW_BOX[r]; let h=''; for(let i=0;i<Math.min(n,KW_CAP);i++){ const [x,y]=KW_SLOTS[i]; h+=KW_ITEM[b.item](x,y+b.lift,i); } return h; }
function kwBoxSVG(r, n, size, locked){
  const I=KW_INK, w=size||100, items=locked?'':kwItems(r,n);
  const L=locked, F=(c)=>L?'#E7DDF5':c, S2=L?'#CFC2E6':I;
  let back='', front='';
  switch(r){
    case 1: front=`<path d="M22 54 Q50 46 78 54" fill="none" stroke="${S2}" stroke-width="3"/><path d="M18 56 L82 56 L74 90 L26 90 Z" fill="${F('#C98A4E')}" stroke="${S2}" stroke-width="3" stroke-linejoin="round"/><path d="M22 66 H78 M24 76 H76 M38 56 L36 90 M50 56 V90 M62 56 L64 90" stroke="${L?'#DCD0EE':'#A06A36'}" stroke-width="2"/><path d="M26 56 Q50 10 74 56" fill="none" stroke="${F('#A06A36')}" stroke-width="4"/>`; break;
    case 2: back=`<path d="M20 52 L24 30 Q50 22 76 30 L80 52 Z" fill="${F('#A0663A')}" stroke="${S2}" stroke-width="3" stroke-linejoin="round"/>`;
      front=`<rect x="18" y="56" width="64" height="34" rx="5" fill="${F('#B9773F')}" stroke="${S2}" stroke-width="3"/><path d="M18 66 H82" stroke="${F('#F2B83C')}" stroke-width="5"/><rect x="45" y="62" width="10" height="12" rx="2" fill="${F('#F2B83C')}" stroke="${S2}" stroke-width="2"/>`; break;
    case 10: back=`<rect x="24" y="36" width="52" height="56" rx="14" fill="${L?'#EFE8F9':'#3C3A78'}"/>`;
      front=`<rect x="24" y="36" width="52" height="56" rx="14" fill="none" stroke="${S2}" stroke-width="3"/><rect x="30" y="26" width="40" height="11" rx="4" fill="${F('#F2B83C')}" stroke="${S2}" stroke-width="3"/><path d="M31 46 Q29 64 31 82" stroke="#fff" stroke-width="3" fill="none" opacity=".55" stroke-linecap="round"/>`; break;
    case 5: back=`<circle cx="50" cy="68" r="26" fill="${L?'#EFE8F9':'#E8F4FD'}" opacity=".9"/>`;
      front=`<path d="M42 20 H58 V44 Q76 50 76 68 A26 26 0 1 1 24 68 Q24 50 42 44 Z" fill="none" stroke="${S2}" stroke-width="3" stroke-linejoin="round"/><rect x="40" y="12" width="20" height="10" rx="3" fill="${F('#C98A4E')}" stroke="${S2}" stroke-width="2.5"/><path d="M32 60 Q30 72 36 82" stroke="#fff" stroke-width="3" fill="none" opacity=".7" stroke-linecap="round"/>`; break;
    case 4: back=`<path d="M22 76 A28 30 0 0 1 78 76 Z" fill="${L?'#EFE8F9':'#E3F3FC'}"/>`;
      front=`<path d="M22 76 A28 30 0 0 1 78 76" fill="none" stroke="${S2}" stroke-width="3"/><ellipse cx="50" cy="80" rx="42" ry="11" fill="${F('#B493F0')}" stroke="${S2}" stroke-width="3"/>${L?'':'<circle cx="24" cy="81" r="3" fill="#FFE27A"/><circle cx="40" cy="85" r="3" fill="#F96D9B"/><circle cx="60" cy="85" r="3" fill="#8EDB6E"/><circle cx="76" cy="81" r="3" fill="#FFE27A"/>'}<path d="M32 58 Q36 50 44 48" stroke="#fff" stroke-width="3" fill="none" opacity=".8" stroke-linecap="round"/>`; break;
    case 8: back=`<path d="M16 66 Q22 28 50 26 Q78 28 84 66 Z" fill="${F('#F8C7DF')}" stroke="${S2}" stroke-width="3" stroke-linejoin="round"/><path d="M50 30 V64 M34 34 L42 64 M66 34 L58 64" stroke="${L?'#DCD0EE':'#E99FC4'}" stroke-width="2"/>`;
      front=`<path d="M14 70 Q50 64 86 70 Q80 92 50 92 Q20 92 14 70 Z" fill="${F('#F8C7DF')}" stroke="${S2}" stroke-width="3" stroke-linejoin="round"/><path d="M30 74 Q32 84 38 89 M50 72 V91 M70 74 Q68 84 62 89" stroke="${L?'#DCD0EE':'#E99FC4'}" stroke-width="2" fill="none"/>`; break;
    case 3: back=`<path d="M30 30 H70 Q86 44 84 66 Q82 92 50 92 Q18 92 16 66 Q14 44 30 30 Z" fill="${L?'#EFE8F9':'#F2FAFF'}"/>`;
      front=`<path d="M30 30 H70 Q86 44 84 66 Q82 92 50 92 Q18 92 16 66 Q14 44 30 30 Z" fill="none" stroke="${S2}" stroke-width="3" stroke-linejoin="round"/><path d="M28 26 H72" stroke="${S2}" stroke-width="4" stroke-linecap="round"/><path d="M24 52 Q20 66 26 80" stroke="#fff" stroke-width="3" fill="none" opacity=".8" stroke-linecap="round"/>`; break;
    case 6: back=`<path d="M22 46 Q50 38 78 46 Q84 90 50 92 Q16 90 22 46 Z" fill="${L?'#EFE8F9':'#E9E2FA'}" opacity=".7"/>`;
      front=`<path d="M22 46 Q50 38 78 46 Q84 90 50 92 Q16 90 22 46 Z" fill="none" stroke="${S2}" stroke-width="3"/><path d="M24 60 Q50 54 80 60 M22 74 Q50 68 80 74 M34 44 Q30 70 36 90 M50 42 V92 M66 44 Q70 70 64 90" stroke="${L?'#DCD0EE':'#8E7FA8'}" stroke-width="1.6" fill="none"/><path d="M78 46 L94 14" stroke="${F('#C98A4E')}" stroke-width="5" stroke-linecap="round"/><path d="M22 46 Q50 38 78 46" fill="none" stroke="${F('#F2B83C')}" stroke-width="4"/>`; break;
    case 9: back=`<ellipse cx="72" cy="40" rx="20" ry="7" fill="${F('#58A6F0')}" stroke="${S2}" stroke-width="3" transform="rotate(30 72 40)"/>`;
      front=`<path d="M18 60 V84 Q18 92 50 92 Q82 92 82 84 V60" fill="${F('#7BB8F2')}" stroke="${S2}" stroke-width="3"/><ellipse cx="50" cy="60" rx="32" ry="8" fill="none" stroke="${S2}" stroke-width="3"/><path d="M18 74 Q50 82 82 74" stroke="${F('#F2B83C')}" stroke-width="4" fill="none"/>`; break;
    case 7: back='';
      front=`<path d="M18 60 Q50 54 82 60 Q86 92 50 92 Q14 92 18 60 Z" fill="${F('#5A4A6E')}" stroke="${S2}" stroke-width="3"/><ellipse cx="50" cy="60" rx="34" ry="7" fill="none" stroke="${S2}" stroke-width="4"/><path d="M28 90 l-4 6 M72 90 l4 6" stroke="${S2}" stroke-width="4" stroke-linecap="round"/><path d="M30 70 Q28 78 32 84" stroke="#8E7FA8" stroke-width="3" fill="none" stroke-linecap="round"/>`; break;
  }
  const full=!L && n>=KW_CAP ? kwStar(16,22,7,'#FFE27A')+kwStar(86,30,6,'#FFE27A')+kwStar(84,86,5,'#FFE27A') : '';
  const q=L?`<text x="50" y="76" text-anchor="middle" font-family="Baloo 2, sans-serif" font-weight="700" font-size="30" fill="#B8A9D6">?</text>`:'';
  return `<svg viewBox="0 0 100 100" width="${w}" height="${w}" class="kwbox" aria-hidden="true">${back}${r!==8?items:''}${front}${r===8?items:''}${q}${full}</svg>`;
}

/* ---------- Grafiken der Schatzkarte ---------- */
function kwIslandSVG(n, treasure){
  return `<svg viewBox="0 0 100 70" class="kwisl" aria-hidden="true">
    <ellipse cx="50" cy="52" rx="48" ry="14" fill="#BFE7F7" opacity=".75"/>
    <path d="M6 48 Q12 26 50 24 Q88 26 94 48 Q80 60 50 60 Q20 60 6 48 Z" fill="#F6D98B" stroke="${KW_INK}" stroke-width="3" stroke-linejoin="round"/>
    <path d="M18 40 Q30 30 50 30 Q70 30 82 40 Q66 46 50 46 Q34 46 18 40 Z" fill="#8FD39A"/>
    <path d="M80 34 Q82 18 84 10" stroke="#A06A36" stroke-width="3" fill="none" stroke-linecap="round"/>
    <path d="M84 10 q-10 -2 -14 4 M84 10 q10 -3 13 3 M84 10 q-4 -8 -11 -8 M84 10 q4 -8 10 -7" stroke="#4FA84F" stroke-width="3.2" fill="none" stroke-linecap="round"/>
    ${treasure?`<g transform="translate(36 22)"><rect x="0" y="8" width="28" height="16" rx="3" fill="#B9773F" stroke="${KW_INK}" stroke-width="2.4"/><path d="M0 8 Q14 -2 28 8 Z" fill="#A0663A" stroke="${KW_INK}" stroke-width="2.4"/><rect x="11" y="10" width="6" height="7" rx="1.5" fill="#F2B83C"/></g>`:''}
    <text x="50" y="${treasure?57:50}" text-anchor="middle" class="kwnum">${n}</text>
  </svg>`;
}
const KW_PLANET=['#F28C2E','#58A6F0','#B493F0','#4FC47F','#F96D9B','#F2B83C'];
function kwPlanetSVG(n, treasure){
  const c=KW_PLANET[n%KW_PLANET.length];
  return `<svg viewBox="0 0 100 70" class="kwisl" aria-hidden="true">
    <ellipse cx="50" cy="38" rx="44" ry="10" fill="none" stroke="#FFE27A" stroke-width="4" transform="rotate(-10 50 38)" opacity=".9"/>
    <circle cx="50" cy="36" r="26" fill="${c}" stroke="${KW_INK}" stroke-width="3"/>
    <circle cx="40" cy="26" r="5" fill="#fff" opacity=".35"/><circle cx="62" cy="46" r="3.5" fill="${KW_INK}" opacity=".15"/>
    <path d="M8 40 Q50 52 92 36" fill="none" stroke="#FFE27A" stroke-width="4" opacity=".9"/>
    ${treasure?`<g transform="translate(36 2)"><rect x="0" y="8" width="28" height="16" rx="3" fill="#B9773F" stroke="${KW_INK}" stroke-width="2.4"/><path d="M0 8 Q14 -2 28 8 Z" fill="#A0663A" stroke="${KW_INK}" stroke-width="2.4"/><rect x="11" y="10" width="6" height="7" rx="1.5" fill="#F2B83C"/></g>`:''}
    <text x="50" y="${treasure?60:46}" text-anchor="middle" class="kwnum">${n}</text>
  </svg>`;
}
function kwShipHTML(space){
  return `<div class="kwship${space?' fly':''}">
    <svg viewBox="0 0 120 100" class="kwsail" aria-hidden="true"><path d="M60 6 V70" stroke="#7A4E2A" stroke-width="4"/><path d="M62 10 Q96 26 92 58 L62 58 Z" fill="#FFF8EC" stroke="${KW_INK}" stroke-width="3" stroke-linejoin="round"/><circle cx="76" cy="34" r="6" fill="#E04A40"/><path d="M60 6 l14 4 -14 4 Z" fill="#E04A40"/></svg>
    <img src="${KW_IMG}" alt="Kawumm" class="kwpirate">
    <svg viewBox="0 0 120 100" class="kwhull" aria-hidden="true">
      ${space?`<g class="kwflame"><path d="M40 84 Q44 100 48 84 Z" fill="#F2B83C"/><path d="M72 84 Q76 100 80 84 Z" fill="#F2B83C"/><path d="M42 84 Q44 94 46 84 Z" fill="#F96D6D"/><path d="M74 84 Q76 94 78 84 Z" fill="#F96D6D"/></g>`:''}
      <path d="M8 62 H112 Q104 86 84 88 H36 Q16 86 8 62 Z" fill="#B9773F" stroke="${KW_INK}" stroke-width="3" stroke-linejoin="round"/>
      <path d="M14 70 H106" stroke="#8A5530" stroke-width="3"/><circle cx="34" cy="77" r="3.5" fill="#F2B83C"/><circle cx="60" cy="78" r="3.5" fill="#F2B83C"/><circle cx="86" cy="77" r="3.5" fill="#F2B83C"/>
    </svg>
  </div>`;
}
const KW_GULL=`<svg viewBox="0 0 120 70" aria-hidden="true"><ellipse cx="60" cy="44" rx="30" ry="18" fill="#fff" stroke="${KW_INK}" stroke-width="3"/><path d="M34 40 Q14 22 4 30 Q22 34 36 50 Z" fill="#E7EDF5" stroke="${KW_INK}" stroke-width="3" stroke-linejoin="round"/><circle cx="82" cy="30" r="13" fill="#fff" stroke="${KW_INK}" stroke-width="3"/><circle cx="86" cy="27" r="2.6" fill="${KW_INK}"/><path d="M94 32 l14 3 -14 4 Z" fill="#F2B83C" stroke="${KW_INK}" stroke-width="2" stroke-linejoin="round"/><path d="M52 62 v6 M66 62 v6" stroke="#F2B83C" stroke-width="3" stroke-linecap="round"/></svg>`;
const KW_ALIEN=`<svg viewBox="0 0 120 80" aria-hidden="true"><path d="M48 18 L40 4 M72 18 L80 4" stroke="${KW_INK}" stroke-width="3" stroke-linecap="round"/><circle cx="40" cy="4" r="4" fill="#F96D9B"/><circle cx="80" cy="4" r="4" fill="#F96D9B"/><ellipse cx="60" cy="44" rx="32" ry="28" fill="#8EDB6E" stroke="${KW_INK}" stroke-width="3"/><circle cx="46" cy="38" r="7" fill="#fff" stroke="${KW_INK}" stroke-width="2"/><circle cx="60" cy="32" r="8" fill="#fff" stroke="${KW_INK}" stroke-width="2"/><circle cx="74" cy="38" r="7" fill="#fff" stroke="${KW_INK}" stroke-width="2"/><circle cx="47" cy="39" r="3" fill="${KW_INK}"/><circle cx="61" cy="33" r="3.4" fill="${KW_INK}"/><circle cx="75" cy="39" r="3" fill="${KW_INK}"/><path d="M48 54 Q60 64 72 54" stroke="${KW_INK}" stroke-width="3" fill="#F96D9B" stroke-linejoin="round"/><path d="M28 50 q-10 4 -12 12 M92 50 q10 4 12 12" stroke="${KW_INK}" stroke-width="3" fill="none" stroke-linecap="round"/></svg>`;
function kwDuoHTML(size){
  return `<div class="kwduo"><div class="kwduo-lumi">${unicornSVG(kwNoRainbow(S.gear), size||150)}</div><img class="kwduo-kaw" src="${KW_IMG}" alt="Kawumm"></div>`;
}

/* ---------- Stil (nur für Kawumm) ---------- */
const kwCSS=document.createElement('style');
kwCSS.textContent=`
.kwmap{position:relative; flex:1; min-height:0; overflow:hidden; border-radius:28px; border:2px solid #9ED3EA; background-color:#7CC6E8;
  background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='90'%3E%3Cpath d='M10 30 q10 -8 20 0 t20 0 M70 70 q10 -8 20 0 t20 0' fill='none' stroke='%23ffffff' stroke-opacity='.45' stroke-width='3' stroke-linecap='round'/%3E%3C/svg%3E");
  background-size:120px 90px; transition:background-position .6s ease;}
.kwmap.space{border-color:#4B3F86; background-color:#2A2150;
  background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='140' height='120'%3E%3Cg fill='%23ffffff'%3E%3Ccircle cx='14' cy='20' r='1.6'/%3E%3Ccircle cx='70' cy='8' r='1.1'/%3E%3Ccircle cx='110' cy='40' r='1.8'/%3E%3Ccircle cx='40' cy='70' r='1.2'/%3E%3Ccircle cx='96' cy='96' r='1.4'/%3E%3Ccircle cx='20' cy='108' r='1'/%3E%3C/g%3E%3Cpath d='M58 52 l2 5 5 2 -5 2 -2 5 -2 -5 -5 -2 5 -2 Z' fill='%23FFE27A' opacity='.8'/%3E%3C/svg%3E");}
.kwlayer{position:absolute; inset:0; transition:transform .6s ease;}
.kwlayer svg.kwpath{position:absolute; inset:0; width:100%; height:100%; pointer-events:none;}
.kwst,.kwopt{position:absolute; width:30%; max-width:150px; transform:translate(-50%,-50%); transition:opacity .4s, transform .3s;}
.kwopt{background:none; padding:0; border:0;}
.kwopt:active{transform:translate(-50%,-50%) scale(.94);}
.kwisl{width:100%; height:auto; display:block; overflow:visible;}
.kwnum{font-family:var(--font-disp); font-weight:700; font-size:24px; fill:${KW_INK}; paint-order:stroke; stroke:#fff; stroke-width:5px; stroke-linejoin:round;}
.kwopt.fog{animation:kwfog .9s ease forwards;}
@keyframes kwfog{0%{transform:translate(-50%,-50%)}20%{transform:translate(-56%,-50%)}40%{transform:translate(-44%,-50%)}60%{transform:translate(-53%,-50%)}100%{transform:translate(-50%,-50%); opacity:.25; filter:blur(3px) grayscale(1)}}
.kwopt.glow .kwisl{filter:drop-shadow(0 0 10px #FFE27A) drop-shadow(0 0 4px #FFE27A);}
.kwopt.gone{opacity:0;}
.kwship{position:absolute; width:26%; max-width:130px; aspect-ratio:120/100; transform:translate(-50%,-92%); pointer-events:none; z-index:3; transition:left .7s ease-in-out, top .7s ease-in-out;}
.kwship svg{position:absolute; inset:0; width:100%; height:100%; overflow:visible;}
.kwship .kwpirate{position:absolute; left:20%; bottom:22%; height:74%; width:auto;}
.kwship.sway{animation:kwsway 2.4s ease-in-out infinite;}
@keyframes kwsway{50%{transform:translate(-50%,-96%) rotate(-3deg)}}
.kwship.zoom{animation:kwzoom 1.1s ease;}
@keyframes kwzoom{0%{transform:translate(-50%,-92%)}30%{transform:translate(-50%,-140%) scale(1.25) rotate(-8deg)}100%{transform:translate(-50%,-92%)}}
.kwflame{animation:kwflame .25s ease-in-out infinite alternate; transform-origin:60px 84px;}
@keyframes kwflame{to{transform:scaleY(1.35)}}
.kwstrip{position:relative; display:flex; gap:4px; align-items:center; justify-content:center; background:#F6E7C1; border:2px solid #D9B77A; border-radius:16px; padding:6px 8px; margin:4px 0 8px; flex-wrap:nowrap; overflow:hidden;}
.kwstrip .jump{flex:0 0 auto; font-family:var(--font-disp); font-weight:700; font-size:15px; color:#fff; background:#E04A40; border-radius:10px; padding:1px 7px; margin-right:2px;}
.kwstrip b{flex:1 1 0; min-width:0; max-width:36px; text-align:center; font-family:var(--font-disp); font-weight:700; font-size:14px; line-height:24px; border-radius:8px; color:#7A5A2E; font-variant-numeric:tabular-nums;}
.kwstrip b.done{background:#F2B83C; color:#fff;}
.kwstrip b.now{background:#fff; color:#E04A40; box-shadow:0 0 0 2px #E04A40;}
.kwstrip b.faint{opacity:.38;}
.kwstrip b.zip{animation:kwzip .5s ease;}
@keyframes kwzip{0%{transform:scale(1.6); background:#FFE27A}100%{transform:scale(1)}}
.kwstrip.covered b,.kwstrip.covered .jump{filter:blur(4px); opacity:.5;}
.kwcover{position:absolute; left:50%; top:50%; width:110px; transform:translate(-50%,-50%); animation:kwcoverin .5s cubic-bezier(.3,1.4,.5,1), kwbob 1.6s ease-in-out .5s infinite; pointer-events:none;}
.kwcover svg{width:100%; height:auto; display:block;}
@keyframes kwcoverin{from{transform:translate(-50%,-160%) scale(.4)}}
@keyframes kwbob{50%{transform:translate(-50%,-62%)}}
.kwcover.bye{animation:kwbye .6s ease forwards;}
@keyframes kwbye{to{transform:translate(160%,-140%) rotate(20deg); opacity:0}}
.kwsay{position:absolute; left:10px; right:10px; bottom:10px; z-index:4; background:rgba(255,255,255,.95); border-radius:16px; padding:6px 12px; font-weight:700; font-size:15px; text-align:center; color:${KW_INK}; min-height:1.6em; pointer-events:none;}
.kwbanner{position:absolute; top:34%; left:50%; transform:translate(-50%,-50%) scale(0); z-index:5; background:#E04A40; color:#fff; font-family:var(--font-disp); font-weight:700; font-size:28px; padding:6px 22px; border-radius:999px; white-space:nowrap; transition:transform .35s cubic-bezier(.3,1.4,.5,1); pointer-events:none;}
.kwbanner.show{transform:translate(-50%,-50%) scale(1);}
.kwend{position:absolute; inset:0; z-index:6; background:rgba(251,247,254,.96); display:flex; flex-direction:column; align-items:center; justify-content:center; gap:10px; padding:16px; text-align:center; overflow-y:auto;}
.kwend h2{font-family:var(--font-disp); font-size:30px; margin:0;}
.kwend p{margin:0; font-weight:700; color:var(--muted); max-width:360px;}
.kwend .kwchest{width:150px; height:auto;}
.kwend .kwchest{overflow:visible;}
.kwend .kwchest .lid{transform-box:view-box; transform-origin:20px 46px; animation:kwlid .7s ease .3s forwards;}
@keyframes kwlid{to{transform:rotate(-70deg)}}
.kwend .kwfind{animation:kwfindpop .7s cubic-bezier(.3,1.4,.5,1) .8s both;}
@keyframes kwfindpop{from{transform:translateY(40px) scale(.2); opacity:0}}
.kwend .kwmini{width:96px;}
/* Inseln und Karte */
.kwcard{display:flex; align-items:center; gap:12px; width:100%; max-width:420px; background:#FFF6E6; border:2px solid #EBCB94; border-radius:20px; padding:8px 12px; text-align:left; box-shadow:0 3px 0 #EBCB94;}
.kwcard img{height:66px; width:auto; flex:0 0 auto;}
.kwcard .tx{flex:1; min-width:0; font-weight:700; font-size:14px; line-height:1.35;}
.kwcard .tx b{display:block; font-family:var(--font-disp); font-size:19px;}
.kwcard .tx small{display:block; color:var(--muted); font-weight:700; font-size:12px;}
.kwcard.wait{opacity:.85; box-shadow:none;}
.kwbtn{background:#E04A40; color:#fff; font-family:var(--font-disp); font-weight:700; font-size:18px; border-radius:16px; padding:10px 14px; box-shadow:0 4px 0 #A8322B; flex:0 0 auto;}
.kwbtn:active{transform:translateY(2px); box-shadow:0 2px 0 #A8322B;}
.kwbtn.sec{background:#fff; color:#E04A40; border:2px solid #EBCB94; box-shadow:0 4px 0 #EBCB94;}
.kwmapcard{grid-column:1/-1; flex-wrap:wrap; max-width:none;}
.kwmapcard .btns{display:flex; gap:8px; flex-wrap:wrap;}
.kwbadge{display:inline-block; align-self:flex-start; background:#E04A40; color:#fff; font-size:11px; font-weight:800; border-radius:999px; padding:1px 8px; margin-top:2px;}
/* Schatzkammer */
.kwvault{flex:1; overflow-y:auto; display:flex; flex-direction:column; gap:12px; padding-block:6px 30px; align-items:center;}
.kwvault > *{flex-shrink:0;}
.kwhead{display:flex; align-items:center; gap:10px; width:100%; max-width:460px;}
.kwhead img{height:90px; width:auto;}
.kwhead .bub{flex:1; background:#fff; border:2px solid var(--line); border-radius:18px; padding:8px 12px; font-weight:700; font-size:15px;}
.kwshelf{display:grid; grid-template-columns:repeat(2,1fr); gap:12px; width:100%; max-width:460px; background:#EAD7B4; border:3px solid #C9A26B; border-radius:24px; padding:12px;}
.kwslot{background:#FFF8EC; border:2px solid #E2C795; border-radius:18px; padding:6px 6px 8px; display:flex; flex-direction:column; align-items:center; gap:2px; text-align:center;}
.kwslot svg{width:100%; max-width:120px; height:auto;}
.kwslot .nm{font-family:var(--font-disp); font-weight:700; font-size:15px; line-height:1.15;}
.kwslot .ct{font-size:12px; color:var(--muted); font-weight:700;}
.kwslot.locked .nm{color:var(--muted);}
.kwslot.pop{animation:pop .5s ease;}
/* Brief und Begrüßung */
#overlay .box.kwletterbox{background:#FFF8EC; max-width:440px;}
.kwenv{position:relative; width:220px; height:150px; margin:6px auto 0; transition:transform .5s, opacity .5s;}
.kwenv svg{width:100%; height:100%; overflow:visible;}
.kwenv .flap{transform-origin:110px 10px; transition:transform .6s ease;}
.kwenv.open .flap{transform:scaleY(-1);}
.kwenv.away{transform:translateY(40px) scale(.6); opacity:0; height:0; margin:0;}
.kwpaper{background:#fff; border:2px solid #E2C795; border-radius:14px; padding:14px 16px; text-align:left; font-family:var(--font-disp); font-size:18px; line-height:1.4; color:${KW_INK}; transform:translateY(30px); opacity:0; transition:transform .6s ease, opacity .6s; display:none;}
.kwpaper.show{display:block;}
.kwpaper.in{transform:none; opacity:1;}
.kwpaper .sig{display:flex; align-items:center; justify-content:flex-end; gap:8px; margin-top:6px;}
.kwpaper .sig img{height:54px;}
.kwyes{opacity:0; transform:scale(.6); transition:opacity .4s, transform .4s cubic-bezier(.3,1.4,.5,1); pointer-events:none; background:#E04A40; box-shadow:0 4px 0 #A8322B;}
.kwyes.show{opacity:1; transform:scale(1); pointer-events:auto;}
.kwduo{display:flex; align-items:flex-end; justify-content:center; gap:6px; height:170px; margin-top:6px;}
.kwduo-lumi{animation:kwhop .9s ease-in-out infinite;}
.kwduo-kaw{height:150px; width:auto; transform:scaleX(-1); animation:kwhopm .9s ease-in-out .45s infinite;}
@keyframes kwhop{0%,100%{transform:translateY(0)}40%{transform:translateY(-28px)}60%{transform:translateY(-28px)}80%{transform:translateY(0) scaleY(.94)}}
@keyframes kwhopm{0%,100%{transform:scaleX(-1) translateY(0)}40%{transform:scaleX(-1) translateY(-34px) rotate(6deg)}60%{transform:scaleX(-1) translateY(-34px)}80%{transform:scaleX(-1) translateY(0) scaleY(.94)}}
/* Elternbereich */
.kwtable{width:100%; border-collapse:collapse; font-size:13px; max-width:520px;}
.kwtable th,.kwtable td{text-align:left; padding:4px 6px; border-bottom:1px solid var(--line);}
.kwtable th{color:var(--muted); font-size:12px;}
`;
document.head.appendChild(kwCSS);

/* ---------- Schatzsuche ---------- */
const KW_ST={x:0.5, y:0.22}, KW_OPT_Y=0.68, KW_OPT_X=[0.2,0.5,0.8];
function kwMapSize(){ const m=$('kwMap'); return {w:m.clientWidth, h:m.clientHeight}; }
function kwShip(){ return $('kwMap').querySelector('.kwship'); }
function kwPlaceShip(xr, yr, animate){
  const s=kwShip(); if(!s) return;
  if(!animate){ s.style.transition='none'; }
  const {w,h}=kwMapSize(), islH=Math.min(w*0.3,150)*0.7;
  s.style.left=(xr*w)+'px'; s.style.top=(yr*h - islH*0.18)+'px';
  if(!animate){ void s.offsetWidth; s.style.transition=''; }
}
function kwSayLine(t){ const el=$('kwSay'); if(el) el.textContent=t; kwSay(t); }
function kwBanner(t,ms){ const b=$('kwBanner'); b.textContent=t; b.classList.add('show'); setTimeout(()=>b.classList.remove('show'), ms||1400); }

function kwStart(r, ret){
  const kw=kws(), rs=kwRowState(kw,r), plan=kwPlanRun(rs);
  const space=rs.stage==='space';
  KR={r, rs, k:plan.startK, plan, clean:true, ret:ret||'path', busy:true, mode:kwHelpMode(rs), visited:[plan.startK], skipped:[], ok:0, steps:0, space, id:Math.random()};
  if(plan.superSpeed) for(let j=10;j>plan.startK;j--) KR.skipped.push(j);
  const map=$('kwMap');
  map.className='kwmap'+(space?' space':'');
  map.style.backgroundPosition='0 0';
  $('kwTitle').textContent=(space?'Weltall':'Meer')+' · '+r+'er rückwärts';
  $('kwStars').textContent=S.stars;
  $('kwEnd').hidden=true;
  map.querySelectorAll('.kwship').forEach(e=>e.remove());
  map.insertAdjacentHTML('beforeend', kwShipHTML(space));
  show('kw');
  kwRenderLayer();
  kwPlaceShip(KW_ST.x, KW_ST.y, false);
  kwShip().classList.add('sway');
  const my=KR.id;
  const name=S.name||'Romy';
  const open = kwPick(space?KW_LINES.startSpace:KW_LINES.startSea).replace('{name}',name);
  if(plan.superSpeed){
    KR.k=10; kwRenderStrip(); kwRenderLayerAt(10, true);
    kwSayLine(open);
    setTimeout(()=>{ if(!KR||KR.id!==my) return; kwSuperSpeed(); }, 1600);
  } else {
    kwRenderStrip();
    const how = 'Wir starten bei '+(10*r)+'. Immer '+kwNum(r)+' zurück. Wohin segeln wir?';
    $('kwSay').textContent=open;
    kwSay(open+' '+how);
    setTimeout(()=>{ if(!KR||KR.id!==my) return; kwStep(); }, 600);
  }
}
/* Super-Speed: Kawumm überfliegt die ersten Stationen, die Zahlen leuchten dabei kurz auf */
function kwSuperSpeed(){
  const my=KR.id, r=KR.r, target=KR.plan.startK;
  kwBanner('Super-Speed!',1500); sndWhoosh();
  const s=kwShip(); s.classList.remove('sway'); void s.offsetWidth; s.classList.add('zoom');
  let j=10;
  const tick=()=>{
    if(!KR||KR.id!==my) return;
    j--; KR.k=j; kwRenderStrip(true); pling();
    $('kwMap').style.backgroundPosition='0 '+((10-j)*-60)+'px';
    if(j>target) setTimeout(tick,260);
    else {
      kwRenderLayer();
      kwSayLine(kwPick(KW_LINES.speed).replace('{n}',target*r));
      setTimeout(()=>{ if(!KR||KR.id!==my) return; s.classList.remove('zoom'); s.classList.add('sway'); kwStep(); },900);
    }
  };
  setTimeout(tick,300);
}
function kwRenderStrip(zip){
  const el=$('kwStrip'); if(!el||!KR) return;
  const r=KR.r, mode=KR.mode;
  let h='<span class="jump">−'+r+'</span>';
  for(let j=10;j>=0;j--){
    const v=j*r;
    if(j===KR.k) h+='<b class="now">'+v+'</b>';
    else if(j>KR.k){
      const sk=KR.skipped.includes(j);
      if(mode==='space') h+='<b class="done">·</b>';
      else h+='<b class="done'+(zip&&sk&&j===KR.k+1?' zip':'')+'">'+v+'</b>';
    }
    else h+= mode==='sea1' ? '<b class="faint">'+v+'</b>' : '<b>?</b>';
  }
  const cov=el.querySelector('.kwcover');
  el.innerHTML=h;
  if(cov) el.appendChild(cov);
}
function kwStationHTML(n, treasure){ return KR.space ? kwPlanetSVG(n,treasure) : kwIslandSVG(n,treasure); }
function kwRenderLayerAt(k, noOpts){
  const L=$('kwLayer'); if(!L||!KR) return;
  L.style.transition='none'; L.style.transform='none';
  const r=KR.r, cur=k*r;
  let h='<svg class="kwpath" viewBox="0 0 100 100" preserveAspectRatio="none">';
  if(!noOpts && k>=1) KW_OPT_X.forEach(x=>{ h+='<path d="M50 '+(KW_ST.y*100+6)+' Q'+((50+x*100)/2)+' '+((KW_ST.y+KW_OPT_Y)*50)+' '+(x*100)+' '+(KW_OPT_Y*100-8)+'" fill="none" stroke="'+(KR.space?'#FFE27A':'#fff')+'" stroke-width="3" stroke-dasharray="2 9" stroke-linecap="round" vector-effect="non-scaling-stroke" opacity=".9"/>'; });
  h+='</svg>';
  h+='<div class="kwst" style="left:'+(KW_ST.x*100)+'%;top:'+(KW_ST.y*100)+'%">'+kwStationHTML(cur,false)+'</div>';
  KR.opts=[];
  if(!noOpts && k>=1){
    KR.opts=kwOptions(r,k);
    KR.opts.forEach((v,i)=>{ h+='<button class="kwopt" data-i="'+i+'" style="left:'+(KW_OPT_X[i]*100)+'%;top:'+(KW_OPT_Y*100)+'%" aria-label="'+v+'">'+kwStationHTML(v,false)+'</button>'; });
  }
  L.innerHTML=h;
  L.querySelectorAll('.kwopt').forEach(b=>b.addEventListener('click',()=>kwChoose(+b.dataset.i)));
  void L.offsetWidth; L.style.transition='';
}
function kwRenderLayer(){ kwRenderLayerAt(KR.k,false); }
function kwStep(){
  if(!KR) return;
  const r=KR.r, cur=KR.k*r, el=$('kwStrip');
  // Störenfried auf der Karte?
  const old=el.querySelector('.kwcover');
  if(old){ old.classList.add('bye'); setTimeout(()=>old.remove(),600); el.classList.remove('covered'); }
  if(KR.plan.covers.includes(KR.k)){
    const c=document.createElement('div'); c.className='kwcover'; c.innerHTML=KR.space?KW_ALIEN:KW_GULL;
    setTimeout(()=>{ if(!KR) return; el.appendChild(c); el.classList.add('covered'); kwSayLine(kwPick(KR.space?KW_LINES.alien:KW_LINES.gull)); tone(KR.space?880:660,.12,0,'square',.05); tone(KR.space?990:520,.12,.12,'square',.05); }, old?650:50);
  } else if(KR.steps>0){
    // kurz die Zahl sagen, damit der Weg hörbar bleibt
    $('kwSay').textContent=cur+'. Und weiter?';
    if(KR.steps<3) kwSay(cur+'. Und weiter?'); else kwSay(String(cur));
  }
  KR.busy=false; KR.t=performance.now();
}
function kwChoose(i){
  if(!KR||KR.busy) return;
  KR.busy=true;
  const rt=performance.now()-KR.t, r=KR.r, k=KR.k, val=KR.opts[i], ans=(k-1)*r, correct=val===ans;
  kwApplyStep(KR.rs.steps[k], correct, rt);
  KR.steps++;
  if(correct){ KR.ok++; S.stars++; } else KR.clean=false;
  if(rt>KW_FAST) KR.clean=false;
  logDay(S,Date.now(),0,1,correct?1:0); save();
  const ai=KR.opts.indexOf(ans), btns=$('kwLayer').querySelectorAll('.kwopt');
  if(correct){
    sndGood(); $('kwStars').textContent=S.stars;
    const b=btns[ai].getBoundingClientRect(); burst(18,(b.left+b.width/2)/innerWidth,(b.top+b.height/2)/innerHeight,6);
    if(Math.random()<0.4) kwSayLine(kwPick(KW_LINES.ok)); else $('kwSay').textContent=kwPick(KW_LINES.ok);
    kwSail(ai,0);
  } else {
    sndAgain();
    btns[i].classList.add('fog'); btns[ai].classList.add('glow');
    kwSayLine(kwPick(KR.space?KW_LINES.wrongSpace:KW_LINES.wrong).replace('{n}',ans));
    kwSail(ai,1600);
  }
}
function kwSail(ai, delay){
  const my=KR.id;
  setTimeout(()=>{
    if(!KR||KR.id!==my) return;
    const btns=$('kwLayer').querySelectorAll('.kwopt');
    btns.forEach((b,j)=>{ if(j!==ai) b.classList.add('gone'); });
    kwPlaceShip(KW_OPT_X[ai], KW_OPT_Y, true);
    setTimeout(()=>{
      if(!KR||KR.id!==my) return;
      KR.k--; KR.visited.push(KR.k);
      if(KR.k===0){ kwRenderStrip(); kwTreasure(ai); return; }
      // Karte rückt nach: gewählte Insel wird die neue Station oben
      const {w,h}=kwMapSize(), L=$('kwLayer');
      L.style.transform='translate('+((KW_ST.x-KW_OPT_X[ai])*w)+'px,'+((KW_ST.y-KW_OPT_Y)*h)+'px)';
      const m=$('kwMap'), bp=(parseFloat((m.style.backgroundPosition||'0 0').split(' ')[1])||0)-((KW_OPT_Y-KW_ST.y)*h);
      m.style.backgroundPosition='0 '+bp+'px';
      kwPlaceShip(KW_ST.x, KW_ST.y, true);
      kwRenderStrip();
      setTimeout(()=>{ if(!KR||KR.id!==my) return; kwRenderLayer(); kwStep(); },650);
    },750);
  }, delay);
}
function kwTreasure(ai){
  const r=KR.r, rs=KR.rs, before=kwAvail();
  // die letzte Insel bekommt die Schatzkiste
  const btns=$('kwLayer').querySelectorAll('.kwopt'); if(btns[ai]) btns[ai].innerHTML=kwStationHTML(0,true);
  const cov=$('kwStrip').querySelector('.kwcover'); if(cov){ cov.classList.add('bye'); setTimeout(()=>cov.remove(),600); } $('kwStrip').classList.remove('covered');
  const res=kwFinishRun(rs, KR.clean);
  bumpStreak(S,Date.now()); save();
  const after=kwAvail(), newRow=after.find(x=>!before.includes(x));
  const box=KW_BOX[r];
  bigKnall(); sndFanfare();
  let lines=[kwPick(KW_LINES.treasure)];
  if(res.find) lines.push(res.full ? (cap(box.a)+'! Jetzt ist '+artDet(r)+' '+box.name+' ganz voll. Kawumm, ist das schön!') : (cap(box.a)+' für '+artAcc(r)+' '+box.name+'!'));
  else lines.push(cap(artNom(r))+' '+box.name+' ist schon ganz voll. Du bist eine echte Schatzjägerin!');
  if(res.toSpace) lines.push('Du bist so gut! Bei der '+r+'er-Karte fliegen wir ab jetzt ins Weltall!');
  else if(rs.stage==='sea') lines.push(rs.clean>=1 ? 'Noch eine Fahrt ohne Fehler und ganz schnell, dann geht es ins Weltall!' : 'Schaffst du zwei Fahrten ohne Fehler und ganz schnell? Dann fliegen wir ins Weltall!');
  if(newRow) lines.push('Und weißt du was? Es gibt eine neue Schatzkarte: die '+newRow+'er-Reihe rückwärts! Ich warte auf der '+newRow+'er-Insel.');
  const my=KR.id;
  setTimeout(()=>{
    if(!KR||KR.id!==my) return;
    const end=$('kwEnd');
    end.innerHTML=`<svg viewBox="0 0 100 80" class="kwchest" aria-hidden="true">
        <rect x="20" y="44" width="60" height="32" rx="5" fill="#B9773F" stroke="${KW_INK}" stroke-width="3"/>
        <path d="M20 54 H80" stroke="#F2B83C" stroke-width="5"/>
        <g class="lid"><path d="M20 46 Q50 26 80 46 Z" fill="#A0663A" stroke="${KW_INK}" stroke-width="3" stroke-linejoin="round"/></g>
        <rect x="45" y="50" width="10" height="12" rx="2" fill="#F2B83C" stroke="${KW_INK}" stroke-width="2"/>
        <g transform="translate(50 18)"><g class="kwfind"><circle cx="0" cy="0" r="17" fill="#FFF3B0" opacity=".7"/><g transform="scale(1.7)">${KW_ITEM[box.item](0,0,1)}</g></g></g>
      </svg>
      <h2>Schatz gefunden!</h2>
      <p>${lines.slice(1).join(' ')}</p>
      <div style="display:flex;align-items:center;gap:8px">${kwBoxSVG(r, rs.finds, 96, false)}<b>${Math.min(rs.finds,KW_CAP)} von ${KW_CAP}</b></div>
      <div class="pill">${KR.ok} von ${KR.steps} richtig · ${KR.ok} Sterne</div>
      <div class="btnrow"><button class="kwbtn" id="kwEndVault">Zur Schatzkammer</button><button class="kwbtn sec" id="kwEndAgain">Nochmal</button><button class="kwbtn sec" id="kwEndBack">Fertig</button></div>`;
    end.hidden=false;
    kwSay(lines.join(' '));
    const ret=KR.ret;
    $('kwEndVault').onclick=()=>{ kwStop(); kwOpenVault(ret==='parent'?'parent':'path', r); };
    $('kwEndAgain').onclick=()=>{ kwStart(r, ret); };
    $('kwEndBack').onclick=()=>{ kwLeave(); };
  },1200);
}
function cap(s){ return s.charAt(0).toUpperCase()+s.slice(1); }
const KW_GENUS={1:'m',2:'f',10:'n',5:'f',4:'n',8:'f',3:'n',6:'n',9:'f',7:'m'};
function artNom(r){ return {m:'der',f:'die',n:'das'}[KW_GENUS[r]]; }
function artDet(r){ return 'dein'+{m:'',f:'e',n:''}[KW_GENUS[r]]; }
function artAcc(r){ return {m:'deinen',f:'deine',n:'dein'}[KW_GENUS[r]]; }
function kwStop(){ KR=null; }
function kwLeave(){
  const ret=KR?KR.ret:'path'; const r=KR?KR.r:null; kwStop();
  if(ret==='island' && typeof openIsland==='function' && r && unlockedRows(S).includes(r)) openIsland(r);
  else if(ret==='parent'){ renderParent(); show('parent'); }
  else if(ret==='vault') kwOpenVault('path');
  else { renderPath(); show('path'); }
}

/* ---------- Schatzkammer ---------- */
function kwOpenVault(ret, popRow){
  kwVaultRet=ret||'path';
  const kw=kws(), av=kwAvail();
  const total=KW_ORDER.reduce((s,r)=>s+((kw.rows[r]&&kw.rows[r].finds)||0),0);
  const w=$('kwVault');
  let h='<div class="kwhead"><img src="'+KW_IMG+'" alt="Kawumm"><div class="bub" id="kwVaultBub"></div></div><div class="kwshelf">';
  for(const r of KW_ORDER){
    const rs=kw.rows[r], open=av.includes(r)||!!(rs&&rs.finds), n=rs?rs.finds:0;
    h+='<button class="kwslot'+(open?'':' locked')+(popRow===r?' pop':'')+'" data-r="'+r+'">'+kwBoxSVG(r,n,120,!open)
      +'<span class="nm">'+(open?KW_BOX[r].name:'Noch geheim')+'</span><span class="ct">'+(open?Math.min(n,KW_CAP)+' von '+KW_CAP+' · '+r+'er-Karte':'Kommt mit der '+r+'er-Karte')+'</span></button>';
  }
  h+='</div>';
  w.innerHTML=h;
  const hello = total===0 ? 'Willkommen in meiner Schatzkammer! Noch ist alles leer. Finden wir Schätze?' : total>=KW_CAP*10 ? 'Alle Behälter sind voll! Du bist die beste Schatzjägerin der Welt!' : kwPick(['Meine Schatzkammer! Schon '+total+' Schätze. Tipp einen Behälter an!','Kawumm, so viele Schätze! Tipp einen an, dann erzähle ich dir was.']);
  $('kwVaultBub').textContent=hello;
  w.querySelectorAll('.kwslot').forEach(b=>b.addEventListener('click',()=>{
    const r=+b.dataset.r, rs=kw.rows[r], open=!b.classList.contains('locked');
    const t= open ? KW_BOX[r].line+' '+(rs&&rs.finds>=KW_CAP?'Ganz voll!':'Noch '+(KW_CAP-((rs&&rs.finds)||0))+' Schätze passen hinein.') : 'Das ist noch geheim. Erst brauchen wir die '+r+'er-Schatzkarte!';
    $('kwVaultBub').textContent=t; kwSay(t); b.classList.remove('pop'); void b.offsetWidth; b.classList.add('pop');
  }));
  show('vault');
  kwSay(hello);
}

/* ---------- Einhänger für Insel und Karte ---------- */
function kwIslandCard(r){
  const el=$('islKw'); if(!el) return;
  if(!kwActive()){ el.innerHTML=''; el.hidden=true; return; }
  el.hidden=false;
  const kw=kws(), av=kwAvail(), rs=kw.rows[r];
  if(av.includes(r)){
    const space=rs&&rs.stage==='space';
    el.innerHTML='<div class="kwcard"><img src="'+KW_IMG+'" alt=""><div class="tx"><b>Schatzsuche mit Kawumm</b>Die '+r+'er-Reihe rückwärts. '+(space?'Ab ins Weltall!':'Im Meer.')+'<small>'+((rs&&rs.finds)||0)+' von '+KW_CAP+' Schätzen für '+artAcc(r)+' '+KW_BOX[r].name+'</small></div><button class="kwbtn" id="kwIslGo">Los!</button></div>';
    $('kwIslGo').onclick=()=>kwStart(r,'island');
  } else {
    const i=KW_ORDER.indexOf(r), prev=KW_ORDER[i-1], ps=kw.rows[prev];
    const prevOk=!!(ps&&ps.stage==='space'), have=Math.round(kwFwd(r)*10);
    const need=[]; if(!prevOk) need.push('die '+prev+'er-Schatzkarte im Meer schaffen'); if(have<5) need.push('hier '+(5-have)+' lila '+(5-have===1?'Stern':'Sterne')+' mehr sammeln');
    el.innerHTML='<div class="kwcard wait"><img src="'+KW_IMG+'" alt=""><div class="tx"><b>Kawumms Schatzkarte</b>Hier liegt auch ein Schatz! Erst '+need.join(' und ')+'.</div></div>';
  }
}
function kwMapCard(list){
  if(!kwActive()) return;
  const av=kwAvail(), open=unlockedRows(S);
  const loose=av.filter(r=>!open.includes(r));     // Karte ohne offene Insel (z. B. die Einser zu Beginn)
  const d=document.createElement('div'); d.className='kwcard kwmapcard';
  d.innerHTML='<img src="'+KW_IMG+'" alt=""><div class="tx"><b>Kawumms Schiff</b>Hier liegt die Schatzkammer.'+(loose.length?' Und eine Schatzkarte, die direkt am Schiff startet!':'')+'</div><div class="btns">'
    +loose.map(r=>'<button class="kwbtn" data-kwr="'+r+'">'+r+'er rückwärts</button>').join('')
    +'<button class="kwbtn sec" id="kwMapVault">Schatzkammer</button></div>';
  list.appendChild(d);
  d.querySelectorAll('[data-kwr]').forEach(b=>b.addEventListener('click',()=>kwStart(+b.dataset.kwr,'path')));
  d.querySelector('#kwMapVault').addEventListener('click',()=>kwOpenVault('path'));
}
function kwMapBadge(r){ return kwActive() && kwAvail().includes(r) ? '<span class="kwbadge">Schatzkarte</span>' : ''; }

/* ---------- Brief: Kawumm fragt, ob sie kommen darf ---------- */
function kwShowLetter(fromParent){
  const name=S.name||'Romy';
  const box=$('overlayBox');
  box.classList.add('kwletterbox');
  box.innerHTML=`<h2>Post für ${name}!</h2>
    <div class="kwenv" id="kwEnv"><svg viewBox="0 0 220 150" aria-hidden="true">
      <rect x="6" y="10" width="208" height="134" rx="12" fill="#F6E7C1" stroke="${KW_INK}" stroke-width="4"/>
      <path d="M6 140 L90 76 M214 140 L130 76" stroke="#D9B77A" stroke-width="4"/>
      <path class="flap" d="M8 12 L110 92 L212 12 Z" fill="#EBD3A0" stroke="${KW_INK}" stroke-width="4" stroke-linejoin="round"/>
      <circle cx="110" cy="88" r="16" fill="#E04A40" stroke="${KW_INK}" stroke-width="3"/>
      <circle cx="110" cy="85" r="6" fill="#fff"/><path d="M103 94 l14 -6 M103 88 l14 6" stroke="#fff" stroke-width="2.4" stroke-linecap="round"/>
    </svg></div>
    <div class="kwpaper" id="kwPaper">Ahoi ${name}!<br>Hier ist Kawumm, die Piratin. Ich habe gehört, dass du mit Lumi die Inseln rettest. Wie mutig!<br>Ich habe Schatzkarten. Aber meine Karten sind verrückt: Man muss sie rückwärts lesen. Darf ich zu dir kommen und mitmachen?
      <div class="sig">Deine Kawumm <img src="${KW_IMG}" alt=""></div></div>
    <button class="cta kwyes" id="kwYes">Ja, komm vorbei!</button>`;
  $('overlay').classList.add('show');
  [523,659,523,784].forEach((f,i)=>tone(f,.14,i*0.12,'triangle',.08));
  speak('Post für '+name+'!');
  let shown=false, opened=Date.now();
  const showYes=()=>{ if(shown) return; shown=true; $('kwYes').classList.add('show'); };
  setTimeout(()=>{
    $('kwEnv').classList.add('open');
    setTimeout(()=>{ $('kwEnv').classList.add('away'); const p=$('kwPaper'); p.classList.add('show'); void p.offsetWidth; p.classList.add('in');
      kwSay('Ahoi '+name+'! Hier ist Kawumm, die Piratin. Ich habe gehört, dass du mit Lumi die Inseln rettest. Wie mutig! Ich habe Schatzkarten. Aber meine Karten sind verrückt: Man muss sie rückwärts lesen. Darf ich zu dir kommen und mitmachen?',
        ()=>setTimeout(showYes, Math.max(0, 5000-(Date.now()-opened))));
      setTimeout(showYes, 16000);
    },650);
  },1300);
  $('kwYes').onclick=()=>{ kws().joined=true; save(); kwWelcome(fromParent); };
}
function kwWelcome(fromParent){
  const box=$('overlayBox'), name=S.name||'Romy';
  box.innerHTML='<h2>Kawumm ist da!</h2>'+kwDuoHTML(150)
    +'<p style="margin:0;font-weight:700">Kawumm und Lumi sind jetzt Freundinnen. Die erste Schatzkarte: die Einserreihe rückwärts, von 10 bis 0. Kawumms Schiff liegt in der Inselwelt.</p>'
    +'<button class="cta" id="kwWelcomeGo" style="background:#E04A40;box-shadow:0 4px 0 #A8322B">Los geht\'s!</button>';
  bigKnall(); sndFanfare();
  kwSay('Kawumm! Hallo '+name+', hallo Lumi! Ich bin da! Unsere erste Schatzkarte ist die Einserreihe rückwärts. Von zehn bis null. Mein Schiff wartet in der Inselwelt. Komm schnell!');
  $('kwWelcomeGo').onclick=()=>{ $('overlay').classList.remove('show'); box.classList.remove('kwletterbox');
    if(fromParent){ renderParent(); } else if(kwActive()){ renderPath(); show('path'); } };
}
function kwMaybeLetter(){
  if(!KW_LIVE || kws().joined) return;
  setTimeout(()=>kwShowLetter(false), 800);
}

/* ---------- Elternbereich: testen, bevor es live ist ---------- */
function kwParentHTML(){
  const kw=kws(), av=kwAvail();
  let rows='';
  for(const r of KW_ORDER){
    const rs=kw.rows[r], a=av.includes(r);
    rows+='<tr><td>'+r+'er</td><td>'+(a?(rs&&rs.stage==='space'?'Weltall':'Meer'):'zu')+'</td><td>'+(rs?kwRowSafe(rs)+' / 10':'–')+'</td><td>'+(rs?rs.finds:0)+'</td><td>'+(rs?rs.runs:0)+'</td><td>'+(a?'<button class="smallbtn" data-kwgo="'+r+'">Starten</button> <button class="smallbtn" data-kwst="'+r+'">'+(rs&&rs.stage==='space'?'→ Meer':'→ Weltall')+'</button>':'')+'</td></tr>';
  }
  return '<p style="margin:2px 0;font-size:13px;color:var(--muted)">'+(KW_LIVE?'Live: Romy sieht Kawumm, sobald der Brief angenommen ist.':'Noch nicht live: Romy sieht davon nichts. Testmodus gilt nur bis zum Neustart der App.')+' Brief angenommen: <b>'+(kw.joined?'ja':'nein')+'</b>.</p>'
    +'<div class="setrow"><label>Testmodus (Kawumm auf Inseln und Karte zeigen)</label><button class="toggle'+(kwTest?' on':'')+'" id="kwTestTgl" role="switch" aria-checked="'+kwTest+'" aria-label="Testmodus"><i></i></button></div>'
    +'<div class="btnrow" style="justify-content:flex-start"><button class="smallbtn" id="kwLetterBtn">Brief ansehen</button><button class="smallbtn" id="kwVaultBtn">Schatzkammer öffnen</button><button class="smallbtn" id="kwVoiceBtn">Kawumms Stimme</button><button class="smallbtn" id="kwLetterReset">Brief zurücksetzen</button><button class="smallbtn danger" id="kwReset">Kawumm-Stand löschen</button></div>'
    +'<table class="kwtable"><tr><th>Reihe</th><th>Stufe</th><th>sicher</th><th>Schätze</th><th>Fahrten</th><th></th></tr>'+rows+'</table>'
    +'<p style="margin:4px 0;font-size:12px;color:var(--muted)">Neue Karte kommt, wenn die Karte davor im Meer geschafft ist (2 Fahrten am Stück ohne Fehler, alle Antworten unter 4 s) und die eigene Vorwärtsreihe 5 von 10 lila Sterne hat.</p>'
    +'<div id="kwMsg" style="font-size:13px;color:var(--muted);font-weight:700;"></div>';
}
function kwParentWire(){
  const kw=kws();
  $('kwTestTgl').onclick=()=>{ kwTest=!kwTest; renderParent(); };
  $('kwLetterBtn').onclick=()=>kwShowLetter(true);
  $('kwVaultBtn').onclick=()=>kwOpenVault('parent');
  $('kwVoiceBtn').onclick=()=>{ unlockSpeech(); kwSay('Ahoi! Ich bin Kawumm. Klinge ich anders als Lumi?'); };
  $('kwLetterReset').onclick=()=>{ kw.joined=false; save(); renderParent(); $('kwMsg').textContent='Brief zurückgesetzt. Er kommt wieder, sobald Kawumm live ist.'; };
  let armed=false;
  $('kwReset').onclick=()=>{ if(!armed){ armed=true; $('kwReset').textContent='Wirklich? Nochmal tippen'; setTimeout(()=>{ armed=false; const b=$('kwReset'); if(b) b.textContent='Kawumm-Stand löschen'; },4000); return; }
    S.kw=kwDefault(); save(); renderParent(); };
  document.querySelectorAll('[data-kwgo]').forEach(b=>b.onclick=()=>kwStart(+b.dataset.kwgo,'parent'));
  document.querySelectorAll('[data-kwst]').forEach(b=>b.onclick=()=>{ const rs=kwRowState(kw,+b.dataset.kwst); rs.stage=rs.stage==='space'?'sea':'space'; rs.clean=0; save(); renderParent(); });
}

/* ---------- Start ---------- */
function kwSetup(){
  $('kwBack').addEventListener('click',()=>kwLeave());
  $('kwVaultBack').addEventListener('click',()=>{ if(kwVaultRet==='parent'){ renderParent(); show('parent'); } else { renderPath(); show('path'); } });
}

window.KW={setup:kwSetup, islandCard:kwIslandCard, mapCard:kwMapCard, badge:kwMapBadge, maybeLetter:kwMaybeLetter, parentHTML:kwParentHTML, parentWire:kwParentWire, stop:kwStop, active:kwActive};
}
