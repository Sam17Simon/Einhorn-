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
const KW_FAST_TYPE = 7000;    // beim Selbst-Eintippen gilt bis 7 s als schnell
const KW_SAFE_BOX = 3;
const KW_CAP = 10;            // Schätze pro Sammelbehälter
const KW_READ_MS = 15000;     // Lesezeit für den Brief, bevor "Ja, komm vorbei!" erscheint

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
/* Plan einer Fahrt: Start (Super-Speed im Weltall startet mitten in der Reihe) und wo Störenfriede kommen.
   Ein Störenfried legt sich auf die drei Inseln (oder taucht sie unter, schnappt sie ...), dann tippt Romy die Zahl selbst ein.
   Meer: erst wenn die Zahlen nicht mehr vorgezeigt werden (nach einer sauberen Fahrt), höchstens einmal pro Fahrt.
   Weltall: öfter, nie zweimal hintereinander. Nie im ersten Schritt, nie in der allerersten Fahrt. */
function kwPlanRun(rs, rng){
  rng=rng||Math.random;
  let startK=10, superSpeed=false;
  if(rs.stage==='space' && rs.runs>0 && rng()<0.35){ startK=5+Math.floor(rng()*4); superSpeed=true; }
  const covers=[];
  if(rs.stage==='space'){
    let last=false;
    for(let k=startK;k>=1;k--){ const c = rs.runs>0 && k!==startK && !last && rng()<0.3; if(c) covers.push(k); last=c; }
  } else if(rs.clean>=1 && rs.runs>0 && rng()<0.7){
    covers.push(1+Math.floor(rng()*(startK-1)));
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
const KW_VOICE={rate:1.12, pitch:1.0, alt:true};    // natürliche Tonhöhe, etwas schneller und frecher als Lumi (Lumi: Tonhöhe 1.14, Tempo 1.04)
let kwTest=false;                                    // Testmodus aus dem Elternbereich, gilt bis zum Neustart
let KR=null;                                         // laufende Schatzsuche
let kwVaultRet='path';

function kws(){ if(!S.kw) S.kw=kwDefault(); return S.kw; }
function kwActive(){ return kwTest || (KW_LIVE && kws().joined); }
function kwFwd(r){ return rowMastery(S,r); }
function kwAvail(){ return kwAvailable(kws(), kwFwd); }
/* Vorlesen. Jeder neue Tipp bricht den laufenden Satz ab (kwHush). Nach einem Abbruch 150 ms warten, sonst verschluckt Chrome den nächsten Satz. */
let kwHushAt=0;
function kwSay(t,cb){ const wait=150-(Date.now()-kwHushAt); if(wait>0) setTimeout(()=>speak(t,cb,KW_VOICE),wait); else speak(t,cb,KW_VOICE); }
function kwHush(){ try{ speakSeq++; speechSynthesis.cancel(); }catch(e){} kwHushAt=Date.now(); }
function kwPick(a){ return a[Math.floor(Math.random()*a.length)]; }
function kwNum(n){ return n===1?'eins':String(n); }
function kwNoRainbow(g){ const c=Object.assign({}, gearOf(g)); delete c.rainbow; return c; }

/* ---------- Was Kawumm sagt: frech, mutig, selbstbewusst, manchmal ein bisschen ängstlich ---------- */
const KW_LINES={
  startSea:['Ahoi! Leinen los! Wir segeln rückwärts bis zum Schatz.','Kawumm! Die Karte zeigt nach unten. Wir zählen rückwärts!','Ich hab keine Angst vor Kraken. Na gut, ein ganz kleines bisschen. Los geht es!','Käpt\'n {name} und Käpt\'n Kawumm. Das wird ein Abenteuer!'],
  startSpace:['Raketen an! Ab ins Weltall!','Festhalten! Im Weltall wohnen freche Aliens.','Hui, so hoch! Mir wird ein bisschen mulmig. Aber wir schaffen das!'],
  ok:['Kawumm! Richtig!','Volltreffer, Käpt\'n!','Hab ich doch gewusst!','Ha! Zu leicht für uns!','Weiter so!','Genau da lang!','Sauber gesegelt!'],
  wrong:['Huch, das war nur Nebel! Es geht zur {n}.','Ui, fast! Die richtige Insel ist die {n}.','Ups! Das passiert sogar mir. Wir segeln zur {n}.','Hoppla! Kein Problem, Piraten probieren weiter. Es ist die {n}.'],
  wrongSpace:['Huch, das war nur ein Sternennebel! Es geht zur {n}.','Ups, falscher Planet! Wir fliegen zur {n}.'],
  speed:['Super-Speed! Festhalten!','Kawumm-Turbo! Wir springen ein Stück weiter!','Wusch! Mit Super-Speed sind wir schon bei der {n}!'],
  treasure:['Schatz gefunden! Kawumm!','Da ist die Schatzkiste! Ich wusste es!','Juhu! Wir sind reich!']
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
  5:{name:'Zauberblasen-Flasche', a:'eine Zauberblase', item:'bubble', lift:-2, line:'Hör mal. Wenn man eine Zauberblase anpustet, singt sie.'},
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

/* ---------- Grafiken der Schatzkarte ----------
   Jede Zahl bekommt ihr eigenes Aussehen. Gleiche Zahl = gleiche Insel innerhalb einer Fahrt
   (wichtig: die gewählte Insel wird oben zur Station), jede neue Fahrt mischt neu. */
function kwRng(seed){ let a=seed>>>0; return ()=>{ a=(a+0x6D2B79F5)>>>0; let t=a; t=Math.imul(t^(t>>>15),t|1); t^=t+Math.imul(t^(t>>>7),t|61); return ((t^(t>>>14))>>>0)/4294967296; }; }
function kwSeed(n){ return n*7919+((KR&&KR.seed)||1); }
const KW_CHEST=(x,y)=>`<g transform="translate(${x} ${y})"><rect x="0" y="8" width="28" height="16" rx="3" fill="#B9773F" stroke="${KW_INK}" stroke-width="2.4"/><path d="M0 8 Q14 -2 28 8 Z" fill="#A0663A" stroke="${KW_INK}" stroke-width="2.4"/><rect x="11" y="10" width="6" height="7" rx="1.5" fill="#F2B83C"/></g>`;
const KW_ISLE_SHAPES=[
  {sand:'M6 48 Q12 26 50 24 Q88 26 94 48 Q80 60 50 60 Q20 60 6 48 Z', grass:'M18 40 Q30 30 50 30 Q70 30 82 40 Q66 46 50 46 Q34 46 18 40 Z', top:30},
  {sand:'M3 50 Q9 34 50 32 Q91 34 97 50 Q82 61 50 61 Q18 61 3 50 Z', grass:'M14 44 Q30 37 50 37 Q70 37 86 44 Q66 49 50 49 Q34 49 14 44 Z', top:37},
  {sand:'M6 50 Q6 30 28 28 Q42 28 50 35 Q58 26 74 26 Q95 29 94 50 Q80 61 50 61 Q20 61 6 50 Z', grass:'M14 42 Q16 32 30 33 Q42 34 46 40 Q36 46 24 46 Q14 46 14 42 Z M54 39 Q60 31 74 31 Q88 33 86 42 Q76 47 64 46 Q54 45 54 39 Z', top:32},
  {sand:'M12 50 Q14 22 50 20 Q86 22 88 50 Q78 61 50 61 Q22 61 12 50 Z', grass:'M22 40 Q26 26 50 26 Q74 26 78 40 Q64 46 50 46 Q36 46 22 40 Z', top:26}
];
const KW_ISLE_COL=[['#F6D98B','#8FD39A'],['#F3C9A0','#A7DB7A'],['#EFE0B4','#7CCBA8'],['#F8D3B0','#B6DD8C']];
const KW_DECO={
  palm:(x,y)=>`<path d="M${x-2} ${y+4} Q${x} ${y-12} ${x+2} ${y-20}" stroke="#A06A36" stroke-width="3" fill="none" stroke-linecap="round"/><path d="M${x+2} ${y-20} q-10 -2 -14 4 M${x+2} ${y-20} q10 -3 13 3 M${x+2} ${y-20} q-4 -8 -11 -8 M${x+2} ${y-20} q4 -8 10 -7" stroke="#4FA84F" stroke-width="3.2" fill="none" stroke-linecap="round"/><circle cx="${x+1}" cy="${y-17}" r="2" fill="#8A5530"/>`,
  rocks:(x,y)=>`<path d="M${x-10} ${y+4} Q${x-10} ${y-6} ${x-3} ${y-7} Q${x+3} ${y-8} ${x+4} ${y+4} Z" fill="#B8B0C8" stroke="${KW_INK}" stroke-width="2.2" stroke-linejoin="round"/><path d="M${x+1} ${y+4} Q${x+2} ${y-3} ${x+7} ${y-3} Q${x+12} ${y-2} ${x+11} ${y+4} Z" fill="#CFC7DC" stroke="${KW_INK}" stroke-width="2.2" stroke-linejoin="round"/>`,
  hut:(x,y)=>`<rect x="${x-7}" y="${y-8}" width="14" height="12" fill="#C98A4E" stroke="${KW_INK}" stroke-width="2.2"/><path d="M${x-10} ${y-7} L${x} ${y-17} L${x+10} ${y-7} Z" fill="#E04A40" stroke="${KW_INK}" stroke-width="2.2" stroke-linejoin="round"/><rect x="${x-2}" y="${y-3}" width="4" height="7" fill="${KW_INK}"/>`,
  tower:(x,y)=>`<path d="M${x-5} ${y+4} L${x-3} ${y-20} L${x+3} ${y-20} L${x+5} ${y+4} Z" fill="#fff" stroke="${KW_INK}" stroke-width="2.2" stroke-linejoin="round"/><path d="M${x-4.4} ${y-4} H${x+4.4} M${x-3.8} ${y-12} H${x+3.8}" stroke="#E04A40" stroke-width="3.4"/><rect x="${x-4}" y="${y-26}" width="8" height="6" rx="1.5" fill="#FFE27A" stroke="${KW_INK}" stroke-width="2"/><path d="M${x-5} ${y-26} L${x} ${y-31} L${x+5} ${y-26} Z" fill="#E04A40" stroke="${KW_INK}" stroke-width="2" stroke-linejoin="round"/>`,
  bush:(x,y)=>`<circle cx="${x-4}" cy="${y-3}" r="6" fill="#5FB866" stroke="${KW_INK}" stroke-width="2"/><circle cx="${x+4}" cy="${y-5}" r="7" fill="#6FC676" stroke="${KW_INK}" stroke-width="2"/><circle cx="${x-4}" cy="${y-5}" r="1.8" fill="#F96D9B"/><circle cx="${x+5}" cy="${y-8}" r="1.8" fill="#FFE27A"/><circle cx="${x+3}" cy="${y-1}" r="1.8" fill="#F96D9B"/>`,
  volcano:(x,y)=>`<path d="M${x-12} ${y+4} L${x-4} ${y-14} L${x+4} ${y-14} L${x+12} ${y+4} Z" fill="#9C7A5E" stroke="${KW_INK}" stroke-width="2.2" stroke-linejoin="round"/><path d="M${x-4} ${y-14} q4 4 8 0" fill="#F28C2E" stroke="${KW_INK}" stroke-width="1.6"/><g class="kwsmoke"><circle cx="${x}" cy="${y-20}" r="3.5" fill="#E7E0EF"/><circle cx="${x+4}" cy="${y-25}" r="4.5" fill="#EFEAF4"/></g>`,
  flag:(x,y)=>`<path d="M${x} ${y+4} V${y-22}" stroke="#7A4E2A" stroke-width="2.4"/><path d="M${x} ${y-22} L${x+14} ${y-18} L${x} ${y-13} Z" fill="${KW_INK}"/><circle cx="${x+5}" cy="${y-18}" r="1.8" fill="#fff"/><path d="M${x-8} ${y+3} l3 -4 3 4 Z" fill="#F96D9B" stroke="${KW_INK}" stroke-width="1.2"/>`,
  twopalm:(x,y)=>KW_DECO.palm(x-5,y)+KW_DECO.palm(x+6,y+1),
  starfish:(x,y)=>`${kwStar(x-4,y-1,5,'#F28C2E')}<path d="M${x+5} ${y+2} q3 -6 6 0 Z" fill="#F8C7DF" stroke="${KW_INK}" stroke-width="1.4"/>`
};
const KW_DECO_KEYS=Object.keys(KW_DECO);
function kwIslandSVG(n, treasure){
  const R=kwRng(kwSeed(n)), sh=KW_ISLE_SHAPES[Math.floor(R()*KW_ISLE_SHAPES.length)], col=KW_ISLE_COL[Math.floor(R()*KW_ISLE_COL.length)];
  const deco=KW_DECO_KEYS[Math.floor(R()*KW_DECO_KEYS.length)], left=R()<0.5, dx=left?20:80;
  const extra=R()<0.35 ? KW_DECO[KW_DECO_KEYS[Math.floor(R()*KW_DECO_KEYS.length)]](left?80:20, sh.top+8) : '';
  return `<svg viewBox="0 0 100 70" class="kwisl" aria-hidden="true">
    <ellipse cx="50" cy="53" rx="49" ry="14" class="kwring" opacity=".75"/>
    <path d="${sh.sand}" fill="${col[0]}" stroke="${KW_INK}" stroke-width="3" stroke-linejoin="round"/>
    <path d="${sh.grass}" fill="${col[1]}"/>
    ${KW_DECO[deco](dx, sh.top+8)}${extra}
    ${treasure?KW_CHEST(36,sh.top-8):''}
    <text x="50" y="${treasure?58:52}" text-anchor="middle" class="kwnum">${n}</text>
  </svg>`;
}
const KW_PLANET=['#F28C2E','#58A6F0','#B493F0','#4FC47F','#F96D9B','#F2B83C','#5FC9C9','#E57A5A'];
function kwPlanetSVG(n, treasure){
  const R=kwRng(kwSeed(n)), c=KW_PLANET[Math.floor(R()*KW_PLANET.length)], pat=Math.floor(R()*4), ring=Math.floor(R()*3), moon=R()<0.4, tilt=Math.round(R()*30-15);
  const dark='rgba(59,42,82,.18)', light='rgba(255,255,255,.35)';
  const pattern=[
    `<path d="M26 30 Q50 22 74 30 M25 42 Q50 50 75 42" stroke="${dark}" stroke-width="6" fill="none" stroke-linecap="round"/>`,
    `<circle cx="40" cy="28" r="5" fill="${dark}"/><circle cx="62" cy="44" r="4" fill="${dark}"/><circle cx="58" cy="24" r="2.6" fill="${dark}"/>`,
    `<circle cx="38" cy="26" r="6" fill="${light}"/><circle cx="64" cy="30" r="3" fill="${light}"/><circle cx="44" cy="48" r="3.5" fill="${light}"/>`,
    `<path d="M30 36 Q40 22 52 30 Q64 38 70 26" stroke="${light}" stroke-width="5" fill="none" stroke-linecap="round"/>`][pat];
  const back = ring===1 ? `<path d="M6 38 Q50 22 94 38" fill="none" stroke="#FFE27A" stroke-width="4" opacity=".9" transform="rotate(${tilt} 50 36)"/>` : ring===2 ? `<path d="M10 38 Q50 26 90 38" fill="none" stroke="#9ED3EA" stroke-width="3" opacity=".9" transform="rotate(${tilt} 50 36)"/><path d="M2 40 Q50 22 98 40" fill="none" stroke="#FFE27A" stroke-width="3" opacity=".8" transform="rotate(${tilt} 50 36)"/>` : '';
  const front = ring===1 ? `<path d="M6 38 Q50 54 94 38" fill="none" stroke="#FFE27A" stroke-width="4" opacity=".95" transform="rotate(${tilt} 50 36)"/>` : ring===2 ? `<path d="M10 38 Q50 50 90 38" fill="none" stroke="#9ED3EA" stroke-width="3" transform="rotate(${tilt} 50 36)"/><path d="M2 40 Q50 58 98 40" fill="none" stroke="#FFE27A" stroke-width="3" transform="rotate(${tilt} 50 36)"/>` : '';
  const mx=R()<0.5?14:86;
  return `<svg viewBox="0 0 100 70" class="kwisl" aria-hidden="true">
    ${back}
    <circle cx="50" cy="36" r="26" fill="${c}" stroke="${KW_INK}" stroke-width="3"/>${pattern}
    ${front}
    ${moon?`<circle cx="${mx}" cy="12" r="6" fill="#EDE7F6" stroke="${KW_INK}" stroke-width="2"/><circle cx="${mx-2}" cy="11" r="1.6" fill="#CFC7DC"/>`:''}
    ${treasure?KW_CHEST(36,2):''}
    <text x="50" y="${treasure?60:46}" text-anchor="middle" class="kwnum">${n}</text>
  </svg>`;
}
/* Kleine Dinge am Rand der Karte, damit nicht jede Station gleich aussieht */
const KW_SEA_FX=[
  `<svg viewBox="0 0 60 40"><path d="M10 30 Q30 4 50 26" fill="none" stroke="#fff" stroke-width="2" stroke-dasharray="2 4" opacity=".7"/><path d="M40 20 q8 -8 14 2 q-6 8 -14 -2 Z" fill="#F28C2E" stroke="${KW_INK}" stroke-width="2"/><path d="M40 20 l-6 -4 v8 Z" fill="#F28C2E" stroke="${KW_INK}" stroke-width="2" stroke-linejoin="round"/><circle cx="50" cy="18" r="1.4" fill="${KW_INK}"/></svg>`,
  `<svg viewBox="0 0 60 40"><path d="M14 30 Q30 14 46 30" fill="#6E8FB8" stroke="${KW_INK}" stroke-width="2.4"/><circle cx="24" cy="25" r="1.8" fill="${KW_INK}"/><path d="M30 14 q-4 -8 -8 -6 M30 14 q4 -8 8 -6 M30 14 v-8" stroke="#E6F6FF" stroke-width="2.4" fill="none" stroke-linecap="round"/></svg>`,
  `<svg viewBox="0 0 60 40"><path d="M20 34 Q16 16 24 10 Q30 18 26 34 Z M32 34 Q30 20 36 14 Q42 22 38 34 Z" fill="#B493F0" stroke="${KW_INK}" stroke-width="2" stroke-linejoin="round"/><circle cx="23" cy="20" r="1.6" fill="#fff"/><circle cx="36" cy="24" r="1.6" fill="#fff"/></svg>`,
  `<svg viewBox="0 0 60 40"><path d="M30 6 V30" stroke="${KW_INK}" stroke-width="2"/><path d="M22 30 Q30 38 38 30 Z" fill="#E04A40" stroke="${KW_INK}" stroke-width="2"/><path d="M24 22 h12 M25 16 h10" stroke="#E04A40" stroke-width="3"/><circle cx="30" cy="6" r="3" fill="#FFE27A" stroke="${KW_INK}" stroke-width="1.4"/></svg>`,
  `<svg viewBox="0 0 60 40"><path d="M14 28 H46 Q42 36 30 36 Q18 36 14 28 Z" fill="#C98A4E" stroke="${KW_INK}" stroke-width="2"/><path d="M30 6 V28 M31 8 L44 24 H31 Z" fill="#fff" stroke="${KW_INK}" stroke-width="2" stroke-linejoin="round"/></svg>`
];
const KW_SPACE_FX=[
  `<svg viewBox="0 0 60 40"><path d="M6 34 L40 12" stroke="#FFE27A" stroke-width="3" stroke-linecap="round" opacity=".5"/><circle cx="44" cy="10" r="6" fill="#FFF3B0" stroke="${KW_INK}" stroke-width="2"/></svg>`,
  `<svg viewBox="0 0 60 40"><ellipse cx="30" cy="24" rx="20" ry="7" fill="#B493F0" stroke="${KW_INK}" stroke-width="2.2"/><path d="M20 22 Q30 6 40 22" fill="#E3F3FC" stroke="${KW_INK}" stroke-width="2.2"/><circle cx="30" cy="16" r="3" fill="#8EDB6E"/><circle cx="22" cy="26" r="1.8" fill="#FFE27A"/><circle cx="38" cy="26" r="1.8" fill="#FFE27A"/></svg>`,
  `<svg viewBox="0 0 60 40"><path d="M30 4 Q40 14 38 30 H22 Q20 14 30 4 Z" fill="#fff" stroke="${KW_INK}" stroke-width="2.2"/><circle cx="30" cy="16" r="3.5" fill="#58A6F0" stroke="${KW_INK}" stroke-width="1.6"/><path d="M22 30 l-6 6 h6 Z M38 30 l6 6 h-6 Z" fill="#E04A40" stroke="${KW_INK}" stroke-width="1.6"/><path d="M26 32 Q30 40 34 32" fill="#F2B83C"/></svg>`,
  `<svg viewBox="0 0 60 40"><circle cx="30" cy="20" r="10" fill="#EDE7F6" stroke="${KW_INK}" stroke-width="2.2"/><circle cx="26" cy="17" r="2.4" fill="#CFC7DC"/><circle cx="34" cy="24" r="1.8" fill="#CFC7DC"/></svg>`,
  `<svg viewBox="0 0 60 40">${'' }<g fill="#FFE27A">${[[14,10,4],[44,8,3],[30,26,5],[50,30,2.5]].map(([x,y,r])=>'<circle cx="'+x+'" cy="'+y+'" r="'+r+'" opacity=".85"/>').join('')}</g></svg>`
];
function kwFxHTML(){
  if(Math.random()<0.35) return '';
  const pool=KR.space?KW_SPACE_FX:KW_SEA_FX, left=Math.random()<0.5;
  return '<div class="kwfx" style="left:'+(left?10:90)+'%;top:'+(44+Math.random()*6)+'%">'+pool[Math.floor(Math.random()*pool.length)]+'</div>';
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

/* ---------- Störenfriede auf den Inseln ----------
   act: lie = legt sich drauf, sink = taucht die Inseln unter, grab = schnappt sie, gulp = schluckt sie, beam = beamt sie weg.
   Danach tippt Romy die Zahl selbst ein. Zeichnungen 220x100, liegen quer über allen drei Inseln. */
const KI=KW_INK;
function kwEye(x,y,r){ return `<circle cx="${x}" cy="${y}" r="${r}" fill="#fff" stroke="${KI}" stroke-width="2"/><circle cx="${x+r*.25}" cy="${y-r*.1}" r="${r*.5}" fill="${KI}"/><circle cx="${x+r*.45}" cy="${y-r*.35}" r="${r*.18}" fill="#fff"/>`; }
const KW_SMILE=(x,y,w)=>`<path d="M${x-w} ${y} Q${x} ${y+w*.9} ${x+w} ${y}" fill="none" stroke="${KI}" stroke-width="2.6" stroke-linecap="round"/>`;
const KW_CRIT={sea:[
  {id:'moewe', name:'Möwe Kreischi', act:'lie', svg:`<path d="M70 58 Q30 30 6 44 Q36 52 62 72 Z M150 58 Q190 30 214 44 Q184 52 158 72 Z" fill="#E7EDF5" stroke="${KI}" stroke-width="3" stroke-linejoin="round"/><ellipse cx="110" cy="64" rx="48" ry="26" fill="#fff" stroke="${KI}" stroke-width="3"/><circle cx="150" cy="44" r="18" fill="#fff" stroke="${KI}" stroke-width="3"/>${kwEye(155,40,5)}<path d="M166 46 l26 4 -26 6 Z" fill="#F2B83C" stroke="${KI}" stroke-width="2.4" stroke-linejoin="round"/>`, say:['Die Möwe Kreischi legt sich auf die Inseln! He, runter da!','Kreischi! Das sind meine Inseln, nicht dein Nest!']},
  {id:'wal', name:'Wal Wumm', act:'lie', svg:`<path d="M30 70 Q8 50 4 40 Q20 46 32 56 Q24 42 28 30 Q36 48 40 64 Z" fill="#6E8FB8" stroke="${KI}" stroke-width="3" stroke-linejoin="round"/><path d="M34 72 Q40 26 116 24 Q196 26 208 62 Q210 86 180 88 H64 Q36 88 34 72 Z" fill="#7FA1CC" stroke="${KI}" stroke-width="3" stroke-linejoin="round"/><path d="M64 80 Q120 92 196 74" fill="none" stroke="#B9CCE6" stroke-width="7" stroke-linecap="round"/>${kwEye(168,52,6)}${KW_SMILE(182,66,10)}<path d="M120 22 q-6 -12 -14 -12 M120 22 q6 -12 14 -12 M120 22 v-16" stroke="#9ED3EA" stroke-width="4" fill="none" stroke-linecap="round"/>`, say:['Der Wal Wumm hat sich auf die Inseln gelegt! Der ist so faul!','Wumm, du dicker Brummer! Geh runter von meinen Inseln!']},
  {id:'walsink', name:'Wal Wumm', act:'sink', svg:`<path d="M110 92 Q100 60 76 44 Q96 46 110 60 Q124 46 144 44 Q120 60 110 92 Z" fill="#7FA1CC" stroke="${KI}" stroke-width="3" stroke-linejoin="round"/><g fill="#E6F6FF" stroke="#9ED3EA" stroke-width="2"><circle cx="60" cy="80" r="6"/><circle cx="160" cy="78" r="7"/><circle cx="44" cy="62" r="4"/><circle cx="178" cy="60" r="4"/><circle cx="84" cy="86" r="3"/></g>`, say:['Platsch! Der Wal hat die Inseln untergetaucht! Weißt du die Zahl trotzdem?','Ui, die Inseln sind weg! Der Wal war das! Sag mir die Zahl!']},
  {id:'krake', name:'Krake Kringel', act:'grab', svg:`<g fill="none" stroke-linecap="round"><path d="M86 60 Q50 70 40 90 M80 52 Q40 44 14 70 M134 60 Q170 70 180 90 M140 52 Q180 44 206 70 M98 66 Q86 84 92 98 M122 66 Q134 84 128 98" stroke="${KI}" stroke-width="15"/><path d="M86 60 Q50 70 40 90 M80 52 Q40 44 14 70 M134 60 Q170 70 180 90 M140 52 Q180 44 206 70 M98 66 Q86 84 92 98 M122 66 Q134 84 128 98" stroke="#B493F0" stroke-width="10"/></g><ellipse cx="110" cy="40" rx="34" ry="32" fill="#B493F0" stroke="${KI}" stroke-width="3"/>${kwEye(98,40,7)}${kwEye(122,40,7)}${KW_SMILE(110,54,8)}<circle cx="96" cy="20" r="4" fill="#D9C6F8"/>`, say:['Der Krake Kringel schnappt sich die Inseln! Gib die sofort zurück!','Huch! Kringel hat die Inseln geklaut! Ich hab ein bisschen Angst vor Kraken. Sag du die Zahl!']},
  {id:'robbe', name:'Robbe Rudi', act:'lie', svg:`<ellipse cx="104" cy="70" rx="84" ry="22" fill="#9AA5B8" stroke="${KI}" stroke-width="3"/><path d="M60 84 Q50 96 36 94 Q46 86 50 78 Z M14 64 Q4 56 6 48 Q16 54 24 64 Z" fill="#8792A6" stroke="${KI}" stroke-width="2.6" stroke-linejoin="round"/><circle cx="184" cy="56" r="22" fill="#9AA5B8" stroke="${KI}" stroke-width="3"/>${kwEye(184,50,5)}<ellipse cx="200" cy="62" rx="6" ry="4" fill="${KI}"/><path d="M196 68 l18 -2 M196 71 l18 3" stroke="${KI}" stroke-width="1.6"/>`, say:['Die Robbe Rudi macht ein Nickerchen auf den Inseln!','Rudi, wach auf! Du liegst auf meiner Schatzkarte!']},
  {id:'kroete', name:'Schildkröte Paula', act:'lie', svg:`<ellipse cx="34" cy="80" rx="14" ry="8" fill="#A7DB7A" stroke="${KI}" stroke-width="2.4"/><ellipse cx="160" cy="84" rx="14" ry="8" fill="#A7DB7A" stroke="${KI}" stroke-width="2.4"/><circle cx="196" cy="60" r="16" fill="#A7DB7A" stroke="${KI}" stroke-width="3"/>${kwEye(200,56,5)}${KW_SMILE(202,66,6)}<path d="M20 74 Q30 24 104 22 Q176 24 186 74 Z" fill="#5FB866" stroke="${KI}" stroke-width="3" stroke-linejoin="round"/><path d="M60 72 L74 40 L104 34 L134 40 L148 72 M74 40 L60 26 M134 40 L148 26 M104 34 V22 M90 72 L104 54 L118 72" fill="none" stroke="#3E8F4B" stroke-width="2.6"/>`, say:['Die Schildkröte Paula sonnt sich auf den Inseln. Ganz langsam!','Paula, beeil dich! Ach nee, Schildkröten beeilen sich nie.']},
  {id:'pelikan', name:'Pelikan Pieps', act:'gulp', svg:`<ellipse cx="78" cy="64" rx="60" ry="26" fill="#fff" stroke="${KI}" stroke-width="3"/><path d="M40 60 Q60 44 96 52" fill="none" stroke="#E7EDF5" stroke-width="10" stroke-linecap="round"/><circle cx="140" cy="40" r="17" fill="#fff" stroke="${KI}" stroke-width="3"/>${kwEye(144,36,5)}<path d="M152 40 L214 50 L152 50 Z" fill="#F2B83C" stroke="${KI}" stroke-width="2.6" stroke-linejoin="round"/><path d="M152 50 Q184 84 210 52" fill="#F7C948" stroke="${KI}" stroke-width="2.6"/>`, say:['Hamm! Der Pelikan Pieps hat die Inseln verschluckt!','Pieps! Spuck die Inseln wieder aus! Bäh!']},
  {id:'krabbe', name:'Krabbe Kneif', act:'grab', svg:`<g stroke="${KI}" stroke-width="3" stroke-linecap="round"><path d="M80 74 l-20 18 M90 78 l-12 18 M140 74 l20 18 M130 78 l12 18"/><path d="M84 54 Q50 40 34 30 M136 54 Q170 40 186 30" fill="none"/></g><path d="M20 20 Q34 6 46 20 Q38 26 34 34 Q24 34 20 20 Z M200 20 Q186 6 174 20 Q182 26 186 34 Q196 34 200 20 Z" fill="#F96D6D" stroke="${KI}" stroke-width="3" stroke-linejoin="round"/><ellipse cx="110" cy="64" rx="44" ry="24" fill="#F96D6D" stroke="${KI}" stroke-width="3"/><path d="M98 42 v-12 M122 42 v-12" stroke="${KI}" stroke-width="3"/>${kwEye(98,28,6)}${kwEye(122,28,6)}${KW_SMILE(110,70,10)}`, say:['Die Krabbe Kneif zwickt die Inseln weg! Aua!','Kneif, lass los! Die Inseln brauchen wir!']},
  {id:'kugel', name:'Kugelfisch Puffi', act:'lie', svg:`<g stroke="${KI}" stroke-width="3" stroke-linecap="round">${Array.from({length:14},(_,i)=>{const a=i/14*Math.PI*2, x1=110+Math.cos(a)*44, y1=52+Math.sin(a)*44, x2=110+Math.cos(a)*54, y2=52+Math.sin(a)*54; return `<path d="M${x1.toFixed(0)} ${y1.toFixed(0)} L${x2.toFixed(0)} ${y2.toFixed(0)}"/>`;}).join('')}</g><circle cx="110" cy="52" r="44" fill="#FFE27A" stroke="${KI}" stroke-width="3"/><path d="M150 50 l22 -12 v28 Z" fill="#F2B83C" stroke="${KI}" stroke-width="2.6" stroke-linejoin="round"/>${kwEye(96,44,9)}${kwEye(122,44,9)}<circle cx="110" cy="70" r="6" fill="#F96D9B" stroke="${KI}" stroke-width="2.4"/>`, say:['Der Kugelfisch Puffi hat sich aufgeblasen! Jetzt sieht man nichts mehr!','Puffi, du bist so rund wie ein Ball! Und du liegst auf meinen Inseln!']},
  {id:'pinguin', name:'Pinguin Flitz', act:'lie', svg:`<ellipse cx="104" cy="66" rx="78" ry="24" fill="#3B3F5A" stroke="${KI}" stroke-width="3"/><ellipse cx="104" cy="72" rx="62" ry="14" fill="#fff"/><path d="M60 54 Q40 40 30 46 Q44 52 52 62 Z" fill="#3B3F5A" stroke="${KI}" stroke-width="2.6" stroke-linejoin="round"/><path d="M26 66 l-16 -6 v14 Z" fill="#F2B83C" stroke="${KI}" stroke-width="2.4" stroke-linejoin="round"/><circle cx="182" cy="58" r="20" fill="#3B3F5A" stroke="${KI}" stroke-width="3"/><ellipse cx="186" cy="62" rx="12" ry="11" fill="#fff"/>${kwEye(186,56,4.5)}<path d="M198 64 l16 2 -16 5 Z" fill="#F2B83C" stroke="${KI}" stroke-width="2.2" stroke-linejoin="round"/>`, say:['Wusch! Der Pinguin Flitz rutscht auf dem Bauch über die Inseln!','Flitz, das ist keine Rutschbahn! Na gut, ein bisschen schon.']},
  {id:'seekuh', name:'Seekuh Mampf', act:'lie', svg:`<path d="M24 66 Q4 54 4 76 Q4 92 26 82 Z" fill="#C9B4C8" stroke="${KI}" stroke-width="3" stroke-linejoin="round"/><ellipse cx="108" cy="66" rx="86" ry="28" fill="#D8C4D6" stroke="${KI}" stroke-width="3"/><path d="M120 88 Q126 98 140 96 Q134 88 134 82 Z" fill="#C9B4C8" stroke="${KI}" stroke-width="2.6" stroke-linejoin="round"/><circle cx="188" cy="60" r="22" fill="#D8C4D6" stroke="${KI}" stroke-width="3"/><ellipse cx="200" cy="70" rx="13" ry="10" fill="#E8D8E6" stroke="${KI}" stroke-width="2.4"/>${kwEye(184,52,5)}<circle cx="198" cy="68" r="1.8" fill="${KI}"/><circle cx="206" cy="68" r="1.8" fill="${KI}"/><path d="M196 82 q8 -8 0 -10" stroke="#4FA84F" stroke-width="3" fill="none"/>`, say:['Die Seekuh Mampf futtert Seegras auf den Inseln. Mampf, mampf!','Mampf, du verfressenes Seekuh-Ding! Rutsch mal!']}
], space:[
  {id:'alien', name:'Alien Blubb', act:'lie', svg:`<path d="M80 30 L66 8 M140 30 L154 8" stroke="${KI}" stroke-width="3" stroke-linecap="round"/><circle cx="66" cy="8" r="5" fill="#F96D9B"/><circle cx="154" cy="8" r="5" fill="#F96D9B"/><ellipse cx="110" cy="62" rx="94" ry="34" fill="#8EDB6E" stroke="${KI}" stroke-width="3"/>${kwEye(84,54,9)}${kwEye(110,46,11)}${kwEye(136,54,9)}<path d="M92 74 Q110 90 128 74" stroke="${KI}" stroke-width="3" fill="#F96D9B" stroke-linejoin="round"/>`, say:['Das Alien Blubb macht es sich auf den Planeten gemütlich! Hihi, das kitzelt.','He, Blubb! Das sind meine Planeten! Keine Angst, das will nur spielen.']},
  {id:'ufo', name:'Ufo-Zip', act:'beam', svg:`<path d="M80 50 L50 100 H170 L140 50 Z" fill="#FFF3B0" opacity=".55"/><ellipse cx="110" cy="44" rx="72" ry="16" fill="#B493F0" stroke="${KI}" stroke-width="3"/><path d="M80 40 Q110 4 140 40" fill="#E3F3FC" stroke="${KI}" stroke-width="3"/><circle cx="110" cy="26" r="8" fill="#8EDB6E" stroke="${KI}" stroke-width="2"/><circle cx="112" cy="24" r="2.6" fill="${KI}"/><g fill="#FFE27A" stroke="${KI}" stroke-width="1.6"><circle cx="60" cy="48" r="4"/><circle cx="90" cy="54" r="4"/><circle cx="130" cy="54" r="4"/><circle cx="160" cy="48" r="4"/></g>`, say:['Zack! Das Ufo beamt die Planeten weg! Bring die wieder!','Hilfe, ein Beam-Strahl! Die Planeten sind weg. Sag du mir die Zahl!']},
  {id:'katze', name:'Weltraumkatze Miez', act:'lie', svg:`<path d="M24 60 Q4 40 14 24" fill="none" stroke="${KI}" stroke-width="9" stroke-linecap="round"/><path d="M24 60 Q4 40 14 24" fill="none" stroke="#F2B83C" stroke-width="5" stroke-linecap="round"/><ellipse cx="96" cy="68" rx="76" ry="24" fill="#F2B83C" stroke="${KI}" stroke-width="3"/><path d="M60 52 v28 M90 48 v36 M120 50 v32" stroke="#D99A1E" stroke-width="5" stroke-linecap="round"/><circle cx="176" cy="52" r="30" fill="#E3F3FC" fill-opacity=".6" stroke="${KI}" stroke-width="3"/><path d="M160 40 l4 -14 10 10 M192 40 l-4 -14 -10 10" fill="#F2B83C" stroke="${KI}" stroke-width="2.4" stroke-linejoin="round"/><circle cx="176" cy="54" r="18" fill="#F2B83C" stroke="${KI}" stroke-width="2.4"/>${kwEye(170,50,4)}${kwEye(184,50,4)}<path d="M174 60 l2 2 2 -2" fill="none" stroke="${KI}" stroke-width="2"/><path d="M160 58 l-14 -2 M160 62 l-14 2 M192 58 l14 -2 M192 62 l14 2" stroke="${KI}" stroke-width="1.4"/>`, say:['Die Weltraumkatze Miez schnurrt auf den Planeten! Miau!','Miez, du Schmusekatze! Du liegst auf meiner Karte!']},
  {id:'robo', name:'Roboter Klonk', act:'lie', svg:`<rect x="20" y="44" width="150" height="46" rx="10" fill="#B8C4D8" stroke="${KI}" stroke-width="3"/><g fill="#F96D6D" stroke="${KI}" stroke-width="1.6"><circle cx="50" cy="66" r="6"/></g><g fill="#FFE27A" stroke="${KI}" stroke-width="1.6"><circle cx="70" cy="66" r="6"/></g><g fill="#8EDB6E" stroke="${KI}" stroke-width="1.6"><circle cx="90" cy="66" r="6"/></g><path d="M110 56 h44 M110 66 h44 M110 76 h44" stroke="#8E9AB0" stroke-width="3"/><rect x="164" y="36" width="50" height="44" rx="8" fill="#CFD8E8" stroke="${KI}" stroke-width="3"/><rect x="172" y="46" width="34" height="14" rx="5" fill="#2A2150"/><circle cx="182" cy="53" r="3.4" fill="#5FC9C9"/><circle cx="196" cy="53" r="3.4" fill="#5FC9C9"/><path d="M178 70 h22" stroke="${KI}" stroke-width="2.6"/><path d="M189 36 v-14" stroke="${KI}" stroke-width="3"/><circle cx="189" cy="18" r="5" fill="#F96D9B" stroke="${KI}" stroke-width="2"/>`, say:['Der Roboter Klonk ist auf den Planeten eingeschlafen. Piep, piep, schnarch!','Klonk, aufwachen! Beep boop! Nix da, der schläft.']},
  {id:'hase', name:'Mondhase Hoppel', act:'lie', svg:`<ellipse cx="100" cy="68" rx="74" ry="24" fill="#fff" stroke="${KI}" stroke-width="3"/><circle cx="26" cy="64" r="10" fill="#fff" stroke="${KI}" stroke-width="2.6"/><path d="M160 46 Q130 18 104 22 Q126 34 150 54 Z M166 44 Q150 10 126 6 Q142 24 158 50 Z" fill="#fff" stroke="${KI}" stroke-width="2.6" stroke-linejoin="round"/><circle cx="176" cy="58" r="22" fill="#fff" stroke="${KI}" stroke-width="3"/>${kwEye(178,54,5)}<circle cx="194" cy="62" r="3" fill="#F96D9B"/><circle cx="176" cy="58" r="30" fill="none" stroke="#9ED3EA" stroke-width="3"/>`, say:['Der Mondhase Hoppel ist auf die Planeten gehüpft! Hoppel, hoppel!','Hoppel, du Mondhase! Hüpf mal woanders hin!']},
  {id:'qualle', name:'Sternenqualle Wabbel', act:'lie', svg:`<g fill="none" stroke="#F8A8D0" stroke-width="5" stroke-linecap="round"><path d="M40 56 q-8 14 0 26 q8 12 0 22 M74 60 q-8 14 0 24 q8 10 0 18 M110 62 q-8 14 0 24 q8 10 0 16 M146 60 q8 14 0 24 q-8 10 0 18 M180 56 q8 14 0 26 q-8 12 0 22"/></g><path d="M22 58 Q30 6 110 6 Q190 6 198 58 Q150 66 110 64 Q70 66 22 58 Z" fill="#F8A8D0" fill-opacity=".85" stroke="${KI}" stroke-width="3" stroke-linejoin="round"/>${kwEye(94,36,7)}${kwEye(126,36,7)}${KW_SMILE(110,48,8)}${kwStar(60,26,5,'#FFE27A')}${kwStar(160,28,4,'#FFE27A')}`, say:['Die Sternenqualle Wabbel wabbelt über die Planeten! Wabbel, wabbel!','Igitt, glibberig! Wabbel, du bist ja ganz durchsichtig. Aber die Zahl sehe ich trotzdem nicht!']},
  {id:'komet', name:'Komet Kometi', act:'lie', svg:`<path d="M140 30 L6 18 L30 44 L4 58 L40 64 L14 88 L140 72 Z" fill="#FFF3B0" stroke="#F2B83C" stroke-width="3" stroke-linejoin="round"/>${kwStar(40,40,6,'#FFE27A')}${kwStar(70,64,5,'#FFE27A')}<circle cx="160" cy="50" r="38" fill="#FFE27A" stroke="${KI}" stroke-width="3"/>${kwEye(148,44,8)}${kwEye(174,44,8)}${KW_SMILE(161,62,12)}`, say:['Der Komet Kometi ist auf den Planeten gelandet! Kawumm, das war knapp!','Kometi, du Raser! Bremsen musst du lernen!']},
  {id:'kuh', name:'Weltraumkuh Muhli', act:'lie', svg:`<ellipse cx="96" cy="68" rx="76" ry="26" fill="#fff" stroke="${KI}" stroke-width="3"/><path d="M50 52 q14 -4 20 8 q-10 12 -22 4 Z M100 70 q16 -6 22 6 q-8 12 -22 6 Z M130 50 q10 -2 14 6 q-6 8 -14 2 Z" fill="${KI}"/><path d="M22 66 q-14 4 -14 16" stroke="${KI}" stroke-width="3" fill="none" stroke-linecap="round"/><circle cx="178" cy="54" r="32" fill="#E3F3FC" fill-opacity=".55" stroke="${KI}" stroke-width="3"/><path d="M164 34 q-8 -6 -6 -14 M192 34 q8 -6 6 -14" stroke="#F2B83C" stroke-width="4" fill="none" stroke-linecap="round"/><circle cx="178" cy="54" r="20" fill="#fff" stroke="${KI}" stroke-width="2.4"/>${kwEye(172,48,4)}${kwEye(186,48,4)}<ellipse cx="179" cy="64" rx="11" ry="7" fill="#F8C7DF" stroke="${KI}" stroke-width="2"/>`, say:['Muh! Die Weltraumkuh Muhli liegt auf den Planeten!','Muhli, du kannst doch nicht im Weltall rumliegen! Na gut, du kannst.']}
]};
function kwLumiJoke(){ return {id:'lumi', name:'Lumi', act:'lie', html:'<div class="kwlumijoke">'+unicornSVG(kwNoRainbow(S.gear),210)+'<span class="zz">z z z</span></div>', say:['Lumi! Du kannst dich doch nicht einfach auf meine Inseln legen! Hihi. Sag du mir die Zahl.','Was? Lumi macht ein Nickerchen auf der Schatzkarte! Typisch Einhorn!']}; }
function kwPickCritter(){
  if(Math.random()<0.06) return kwLumiJoke();
  const pool=KR.space?KW_CRIT.space:KW_CRIT.sea;
  let c; do{ c=pool[Math.floor(Math.random()*pool.length)]; } while(pool.length>1 && c.id===KR.lastCrit);
  KR.lastCrit=c.id; return c;
}
/* ---------- Meere und Himmel: wechseln von Fahrt zu Fahrt (die ersten zwei Fahrten immer normal) ---------- */
const KW_WAVES=(c)=>"url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='90'%3E%3Cpath d='M10 30 q10 -8 20 0 t20 0 M70 70 q10 -8 20 0 t20 0' fill='none' stroke='%23"+c+"' stroke-opacity='.5' stroke-width='3' stroke-linecap='round'/%3E%3C/svg%3E\")";
const KW_BUBBLES=(c)=>"url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='90'%3E%3Cg fill='none' stroke='%23"+c+"' stroke-opacity='.55' stroke-width='2'%3E%3Ccircle cx='20' cy='20' r='5'/%3E%3Ccircle cx='30' cy='34' r='3'/%3E%3Ccircle cx='86' cy='60' r='6'/%3E%3Ccircle cx='100' cy='76' r='3'/%3E%3Ccircle cx='60' cy='12' r='2.5'/%3E%3C/g%3E%3C/svg%3E\")";
const KW_DOTS=(c)=>"url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='140' height='120'%3E%3Cg fill='%23"+c+"'%3E%3Ccircle cx='14' cy='20' r='1.6'/%3E%3Ccircle cx='70' cy='8' r='1.1'/%3E%3Ccircle cx='110' cy='40' r='1.8'/%3E%3Ccircle cx='40' cy='70' r='1.2'/%3E%3Ccircle cx='96' cy='96' r='1.4'/%3E%3Ccircle cx='20' cy='108' r='1'/%3E%3C/g%3E%3Cpath d='M58 52 l2 5 5 2 -5 2 -2 5 -2 -5 -5 -2 5 -2 Z' fill='%23FFE27A' opacity='.8'/%3E%3C/svg%3E\")";
const KW_SEAS=[
  {name:'Meer', bg:'#7CC6E8', bd:'#9ED3EA', ring:'#BFE7F7', img:KW_WAVES('ffffff'), path:'#fff'},
  {name:'Cola-Meer', bg:'#5A3420', bd:'#3E2416', ring:'#8A5A3B', img:KW_BUBBLES('F5E6D3'), path:'#F5E6D3', say:'Igitt, ein Cola-Meer! Das blubbert und kitzelt am Schiff!'},
  {name:'Sauer-Meer', bg:'#9BDB4D', bd:'#79B833', ring:'#C8F08A', img:KW_BUBBLES('ffffff'), path:'#fff', say:'Bäh, ein Sauer-Meer! So sauer wie eine Zitrone! Bloß nicht reinfallen!'},
  {name:'Schoko-Meer', bg:'#A0663A', bd:'#7A4E2A', ring:'#C99A6E', img:KW_WAVES('F3D8B8'), path:'#F3D8B8', say:'Ein Schoko-Meer! Lecker! Nicht naschen, wir sind auf Schatzsuche!'},
  {name:'Glitzer-Meer', bg:'#F4A6CF', bd:'#E58AB8', ring:'#FBD3E8', img:KW_DOTS('ffffff'), path:'#fff', say:'Ooooh, ein Glitzer-Meer! Alles funkelt!'}
];
const KW_SKIES=[
  {name:'Weltall', bg:'#2A2150', bd:'#4B3F86', img:KW_DOTS('ffffff'), path:'#FFE27A'},
  {name:'Bonbon-Galaxie', bg:'#5A1E5E', bd:'#7A3A7E', img:KW_DOTS('F8A8D0'), path:'#F8A8D0', say:'Eine Bonbon-Galaxie! Hier riecht sogar das Weltall nach Erdbeere!'},
  {name:'Glibber-Nebel', bg:'#123C3A', bd:'#22605C', img:KW_DOTS('8EDB6E'), path:'#8EDB6E', say:'Ui, der Glibber-Nebel! Hier wohnen die schleimigsten Aliens!'}
];
function kwPickWorld(rs){
  const list=rs.stage==='space'?KW_SKIES:KW_SEAS;
  if(rs.runs<2 || Math.random()<0.35) return list[0];
  return list[1+Math.floor(Math.random()*(list.length-1))];
}
function kwDuoHTML(size){
  return `<div class="kwduo"><div class="kwduo-lumi">${unicornSVG(kwNoRainbow(S.gear), size||150)}</div><img class="kwduo-kaw" src="${KW_IMG}" alt="Kawumm"></div>`;
}

/* ---------- Stil (nur für Kawumm) ---------- */
const kwCSS=document.createElement('style');
kwCSS.textContent=`
.kwmap{position:relative; flex:1; min-height:0; overflow:hidden; border-radius:28px; border:2px solid #9ED3EA; background-color:#7CC6E8;
  background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='90'%3E%3Cpath d='M10 30 q10 -8 20 0 t20 0 M70 70 q10 -8 20 0 t20 0' fill='none' stroke='%23ffffff' stroke-opacity='.45' stroke-width='3' stroke-linecap='round'/%3E%3C/svg%3E");
  background-size:120px 90px; transition:background-position 1s ease;}
.kwmap.space{border-color:#4B3F86; background-color:#2A2150;
  background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='140' height='120'%3E%3Cg fill='%23ffffff'%3E%3Ccircle cx='14' cy='20' r='1.6'/%3E%3Ccircle cx='70' cy='8' r='1.1'/%3E%3Ccircle cx='110' cy='40' r='1.8'/%3E%3Ccircle cx='40' cy='70' r='1.2'/%3E%3Ccircle cx='96' cy='96' r='1.4'/%3E%3Ccircle cx='20' cy='108' r='1'/%3E%3C/g%3E%3Cpath d='M58 52 l2 5 5 2 -5 2 -2 5 -2 -5 -5 -2 5 -2 Z' fill='%23FFE27A' opacity='.8'/%3E%3C/svg%3E");}
.kwlayer{position:absolute; inset:0; transition:transform 1s ease-in-out;}
.kwlayerin{position:absolute; inset:0;}
.kwfx{position:absolute; width:16%; max-width:70px; transform:translate(-50%,-50%); pointer-events:none; animation:kwbob2 2.6s ease-in-out infinite; opacity:.95;}
.kwfx svg{width:100%; height:auto; display:block;}
@keyframes kwbob2{50%{transform:translate(-50%,-62%)}}
.kwsmoke{animation:kwsmoke 2.4s ease-in-out infinite;}
@keyframes kwsmoke{50%{transform:translateY(-3px); opacity:.6}}
.kwlayer svg.kwpath{position:absolute; inset:0; width:100%; height:100%; pointer-events:none;}
.kwst,.kwopt{position:absolute; width:30%; max-width:150px; transform:translate(-50%,-50%); transition:opacity .7s, transform .4s;}
.kwopt{background:none; padding:0; border:0;}
.kwopt:active{transform:translate(-50%,-50%) scale(.94);}
.kwisl{width:100%; height:auto; display:block; overflow:visible;}
.kwnum{font-family:var(--font-disp); font-weight:700; font-size:24px; fill:${KW_INK}; paint-order:stroke; stroke:#fff; stroke-width:5px; stroke-linejoin:round;}
.kwopt.fog{animation:kwfog 1.2s ease forwards;}
@keyframes kwfog{0%{transform:translate(-50%,-50%)}20%{transform:translate(-56%,-50%)}40%{transform:translate(-44%,-50%)}60%{transform:translate(-53%,-50%)}100%{transform:translate(-50%,-50%); opacity:.25; filter:blur(3px) grayscale(1)}}
.kwopt.glow .kwisl{filter:drop-shadow(0 0 10px #FFE27A) drop-shadow(0 0 4px #FFE27A);}
.kwopt.gone{opacity:0;}
.kwship{position:absolute; width:26%; max-width:130px; aspect-ratio:120/100; transform:translate(-50%,-92%); pointer-events:none; z-index:3; transition:left 1.1s ease-in-out, top 1.1s ease-in-out;}
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
.kwsay{display:none; position:absolute; left:10px; right:10px; bottom:10px; z-index:4; background:rgba(255,255,255,.95); border-radius:16px; padding:6px 12px; font-weight:700; font-size:15px; text-align:center; color:${KW_INK}; min-height:1.6em; pointer-events:none;}
.kwbanner{position:absolute; top:34%; left:50%; transform:translate(-50%,-50%) scale(0); z-index:5; background:#E04A40; color:#fff; font-family:var(--font-disp); font-weight:700; font-size:28px; padding:6px 22px; border-radius:999px; white-space:nowrap; transition:transform .35s cubic-bezier(.3,1.4,.5,1); pointer-events:none;}
.kwbanner.show{transform:translate(-50%,-50%) scale(1);}
.kwend{position:absolute; inset:0; z-index:6; background:rgba(251,247,254,.96); display:flex; flex-direction:column; align-items:center; justify-content:center; gap:10px; padding:16px; text-align:center; overflow-y:auto;}
.kwend h2{font-family:var(--font-disp); font-size:30px; margin:0;}
.kwend p{margin:0; font-weight:700; color:var(--muted); max-width:360px;}
.kwend .kwchest{width:150px; height:auto;}
.kwend .kwchest{overflow:visible;}
.kwend .kwchest .lid{transform-box:view-box; transform-origin:20px 46px; animation:kwlid 1s ease .5s forwards;}
@keyframes kwlid{to{transform:rotate(-70deg)}}
.kwend .kwfind{animation:kwfindpop .9s cubic-bezier(.3,1.4,.5,1) 1.2s both;}
@keyframes kwfindpop{from{transform:translateY(40px) scale(.2); opacity:0}}
.kwend .kwmini{width:96px;}

.kwmap .kwring{fill:var(--kwring,#BFE7F7);}
.kwopt.locked{pointer-events:none;}
.kwblock{position:absolute; left:50%; width:96%; max-width:480px; transform:translate(-50%,-55%); z-index:4; pointer-events:none;}
.kwblock svg{width:100%; height:auto; display:block; overflow:visible;}
.kwblock.act-lie,.kwblock.act-gulp{animation:kwcritin .8s cubic-bezier(.3,1.4,.5,1) both;}
.kwblock.act-lie.insky,.kwblock.act-beam{animation:kwcritsky 1s cubic-bezier(.3,1.2,.5,1) both;}
.kwblock.act-sink{animation:kwcritsink 1s ease both;}
.kwblock.act-grab{animation:kwcritgrab .9s cubic-bezier(.3,1.4,.5,1) both;}
@keyframes kwcritin{from{transform:translate(-50%,10%) scale(.6); opacity:0}}
@keyframes kwcritsky{from{transform:translate(-50%,-260%) scale(.5); opacity:0}}
@keyframes kwcritsink{from{transform:translate(-50%,40%); opacity:0}}
@keyframes kwcritgrab{0%{transform:translate(-50%,40%) scale(.5); opacity:0}70%{transform:translate(-50%,-62%) scale(1.06)}}
.kwblock.bye{animation:kwcritout .9s ease forwards!important;}
.kwblock.act-sink.bye,.kwblock.act-grab.bye{animation:kwcritdown .9s ease forwards!important;}
.kwblock.insky.bye,.kwblock.act-beam.bye{animation:kwcritup .9s ease forwards!important;}
@keyframes kwcritout{to{transform:translate(60%,-90%) rotate(14deg) scale(.6); opacity:0}}
@keyframes kwcritdown{to{transform:translate(-50%,60%) scale(.7); opacity:0}}
@keyframes kwcritup{to{transform:translate(-50%,-300%) scale(.5); opacity:0}}
.kwopt.under-lie{opacity:.0; transition:opacity 0.38s;}
.kwopt.under-sink{transform:translate(-50%,10%) scale(.85)!important; opacity:0; transition:transform 0.75s ease, opacity 0.75s;}
.kwopt.under-grab{transform:translate(-50%,-30%) scale(.4) rotate(18deg)!important; opacity:0; transition:transform 0.68s ease, opacity 0.68s;}
.kwopt.under-gulp{transform:translate(40%,-90%) scale(.2)!important; opacity:0; transition:transform 0.68s ease-in, opacity 0.68s;}
.kwopt.under-beam{transform:translate(-50%,-220%) scale(.5)!important; opacity:0; transition:transform 0.90s ease-in, opacity 0.90s;}
.kwopt.back{animation:kwback .7s cubic-bezier(.3,1.4,.5,1);}
@keyframes kwback{from{transform:translate(-50%,-50%) scale(.3); opacity:0}}
.kwlumijoke{position:relative; transform:rotate(-6deg) scaleX(1.25); transform-origin:50% 60%;}
.kwlumijoke svg{width:100%; height:auto;}
.kwlumijoke .zz{position:absolute; right:6%; top:-4%; font-family:var(--font-disp); font-weight:700; font-size:22px; color:#fff; text-shadow:0 2px 0 rgba(59,42,82,.4); animation:islzzz 2.4s ease-in-out infinite;}
.kwpad{position:absolute; left:8px; right:8px; bottom:8px; z-index:6; background:rgba(255,255,255,.96); border-radius:20px; padding:8px; box-shadow:0 4px 0 rgba(59,42,82,.15); transform:translateY(120%); transition:transform .55s cubic-bezier(.3,1.2,.5,1);}
.kwpad.show{transform:none;}
.kwpadtop{display:flex; align-items:center; justify-content:space-between; gap:10px; padding:0 6px 6px; font-weight:800; font-size:15px; color:${KW_INK};}
.kwpadtop b{min-width:84px; text-align:center; font-family:var(--font-disp); font-size:30px; line-height:1.1; color:#E04A40; border-bottom:4px solid #E04A40; font-variant-numeric:tabular-nums;}
.kwpadtop b.good{color:var(--ok); border-color:var(--ok);}
.kwpadtop b.again{color:var(--warm); border-color:var(--warm);}
.kwkeys{display:grid; grid-template-columns:repeat(6,1fr); gap:6px;}
.kwkeys button{font-family:var(--font-disp); font-weight:700; font-size:24px; min-height:50px; border-radius:14px; background:#FFF8EC; border:2px solid #EBCB94; box-shadow:0 3px 0 #EBCB94; color:${KW_INK};}
.kwkeys button:active{transform:translateY(2px); box-shadow:0 1px 0 #EBCB94;}
.kwkeys .ok{background:#E04A40; color:#fff; border-color:#E04A40; box-shadow:0 3px 0 #A8322B;}
.kwkeys .del{color:var(--muted); font-size:20px;}
.kwnight{position:absolute; inset:0; background-color:#2A2150; background-image:${KW_DOTS('ffffff')}; opacity:0; transition:opacity 3s ease; pointer-events:none;}
.kwnight.on{opacity:1;}
.kwship.liftoff{animation:kwliftoff 3.2s ease-in forwards!important;}
@keyframes kwliftoff{0%{transform:translate(-50%,-92%)}12%{transform:translate(-52%,-92%)}18%{transform:translate(-48%,-92%)}24%{transform:translate(-50%,-96%)}100%{transform:translate(-50%,-420%) scale(.55)}}
.kwcount{position:absolute; left:50%; top:32%; transform:translate(-50%,-50%); z-index:6; font-family:var(--font-disp); font-weight:700; font-size:110px; line-height:1; color:#fff; text-shadow:0 6px 0 rgba(59,42,82,.35); pointer-events:none;}
.kwcount.pop{animation:kwcountpop 1.1s ease forwards;}
@keyframes kwcountpop{0%{transform:translate(-50%,-50%) scale(.3); opacity:0}25%{transform:translate(-50%,-50%) scale(1.15); opacity:1}80%{opacity:1}100%{transform:translate(-50%,-50%) scale(1); opacity:0}}
button.kwwait{opacity:.45; transition:opacity .6s;}
button.kwwait:active{transform:none;}
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
.kwmapcard.hi{animation:kwhi 1.1s ease-in-out 6; border-color:#E04A40;}
.kwmapcard.hi img{animation:kwhopm2 .9s ease-in-out infinite;}
@keyframes kwhi{50%{box-shadow:0 0 0 6px rgba(224,74,64,.35), 0 3px 0 #EBCB94; transform:scale(1.02)}}
@keyframes kwhopm2{40%{transform:translateY(-12px) rotate(-6deg)}}
.kwhint{display:block; margin-top:6px; background:#fff; border:2px solid #E04A40; border-radius:14px; padding:6px 10px; color:${KW_INK}; font-size:14px;}
.islcard.kwhi{border-color:#E04A40; animation:kwhi 1.1s ease-in-out 6;}
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
.kwenv{position:relative; width:220px; height:150px; margin:6px auto 0; transition:transform .8s, opacity .8s;}
.kwenv svg{width:100%; height:100%; overflow:visible;}
.kwenv .flap{transform-origin:110px 10px; transition:transform .9s ease;}
.kwenv.open .flap{transform:scaleY(-1);}
.kwenv.away{transform:translateY(40px) scale(.6); opacity:0; height:0; margin:0;}
.kwpaper{background:#fff; border:2px solid #E2C795; border-radius:14px; padding:14px 16px; text-align:left; font-family:var(--font-disp); font-size:18px; line-height:1.4; color:${KW_INK}; transform:translateY(30px); opacity:0; transition:transform .9s ease, opacity .9s; display:none;}
.kwpaper.show{display:block;}
.kwpaper.in{transform:none; opacity:1;}
.kwpaper .sig{display:flex; align-items:center; justify-content:flex-end; gap:8px; margin-top:6px;}
.kwpaper .sig img{height:54px;}
.kwpaper .ps{font-size:15px; color:var(--muted); margin-top:2px;}
.kwpaper .ps{font-size:15px; color:var(--muted); margin-top:2px;}
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
function kwShip(){ return $('kwLayer').querySelector('.kwship'); }
function kwPlaceShip(xr, yr, animate){
  const s=kwShip(); if(!s) return;
  if(!animate){ s.style.transition='none'; }
  const {w,h}=kwMapSize(), islH=Math.min(w*0.3,150)*0.7;
  s.style.left=(xr*w)+'px'; s.style.top=(yr*h - islH*0.18)+'px';
  if(!animate){ void s.offsetWidth; s.style.transition=''; }
}
function kwSayLine(t){ kwSay(t); }
/* Ruhe: Knöpfe werden erst nach einer Pause klickbar (Entscheidung Simon) */
const KW_CTA_WAIT=1500;
function kwArm(root, ms){
  const bs=(root?root.querySelectorAll('button'):[]);
  bs.forEach(b=>{ b.disabled=true; b.classList.add('kwwait'); });
  setTimeout(()=>bs.forEach(b=>{ b.disabled=false; b.classList.remove('kwwait'); }), ms||KW_CTA_WAIT);
}
function kwBanner(t,ms){ const b=$('kwBanner'); b.textContent=t; b.classList.add('show'); setTimeout(()=>b.classList.remove('show'), ms||1400); }

function kwStart(r, ret){
  const kw=kws(), rs=kwRowState(kw,r), plan=kwPlanRun(rs);
  const space=rs.stage==='space';
  KR={r, rs, k:plan.startK, plan, clean:true, ret:ret||'path', busy:true, mode:kwHelpMode(rs), visited:[plan.startK], skipped:[], ok:0, steps:0, space, id:Math.random()};
  if(plan.superSpeed) for(let j=10;j>plan.startK;j--) KR.skipped.push(j);
  const map=$('kwMap'), world=kwPickWorld(rs); KR.world=world;
  map.className='kwmap'+(space?' space':'');
  map.style.backgroundColor=world.bg; map.style.borderColor=world.bd; map.style.backgroundImage=world.img;
  map.style.setProperty('--kwring', world.ring||'#BFE7F7');
  map.style.backgroundPosition='0 0';
  $('kwTitle').textContent=world.name+' · '+r+'er';
  $('kwStars').textContent=S.stars;
  $('kwEnd').hidden=true;
  KR.seed=Math.floor(Math.random()*1e6)+1;
  { const p=$('kwPad'); if(p) p.remove(); }
  $('kwLayer').innerHTML='<div class="kwlayerin" id="kwLayerIn"></div>'+kwShipHTML(space);
  show('kw');
  kwRenderLayer();
  kwShip().classList.add('sway');
  const my=KR.id;
  const name=S.name||'Romy';
  const open = world.say || kwPick(space?KW_LINES.startSpace:KW_LINES.startSea).replace('{name}',name);
  if(plan.superSpeed){
    KR.k=10; kwRenderStrip(); kwRenderLayerAt(10, true);
    kwSayLine(open);
    setTimeout(()=>{ if(!KR||KR.id!==my) return; kwSuperSpeed(); }, 2000);
  } else {
    kwRenderStrip();
    const how = 'Wir starten bei '+(10*r)+'. Immer '+kwNum(r)+' zurück. Wohin segeln wir?';
    kwSay(open+' '+how);
    setTimeout(()=>{ if(!KR||KR.id!==my) return; kwStep(); }, 1000);
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
    if(j>target) setTimeout(tick,340);
    else {
      kwRenderLayer();
      kwSayLine(kwPick(KW_LINES.speed).replace('{n}',target*r));
      setTimeout(()=>{ if(!KR||KR.id!==my) return; s.classList.remove('zoom'); s.classList.add('sway'); kwStep(); },1300);
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
  el.innerHTML=h;
}
function kwStationHTML(n, treasure){ return KR.space ? kwPlanetSVG(n,treasure) : kwIslandSVG(n,treasure); }
function kwRenderLayerAt(k, noOpts){
  const L=$('kwLayer'), IN=$('kwLayerIn'); if(!L||!IN||!KR) return;
  L.style.transition='none'; L.style.transform='none';
  const r=KR.r, cur=k*r;
  let h='<svg class="kwpath" viewBox="0 0 100 100" preserveAspectRatio="none">';
  // keine Linien zwischen den Inseln (Entscheidung Simon)
  h+='</svg>';
  h+='<div class="kwst" style="left:'+(KW_ST.x*100)+'%;top:'+(KW_ST.y*100)+'%">'+kwStationHTML(cur,false)+'</div>';
  KR.opts=[];
  if(!noOpts && k>=1){
    KR.opts=kwOptions(r,k);
    KR.opts.forEach((v,i)=>{ h+='<button class="kwopt" data-i="'+i+'" style="left:'+(KW_OPT_X[i]*100)+'%;top:'+(KW_OPT_Y*100)+'%" aria-label="'+v+'">'+kwStationHTML(v,false)+'</button>'; });
  }
  if(!noOpts) h+=kwFxHTML();
  IN.innerHTML=h;
  kwPlaceShip(KW_ST.x, KW_ST.y, false);       // im selben Bild wie das Zurücksetzen der Karte: kein Sprung
  IN.querySelectorAll('.kwopt').forEach(b=>b.addEventListener('click',()=>kwChoose(+b.dataset.i)));
  void L.offsetWidth; L.style.transition='';
}
function kwRenderLayer(){ kwRenderLayerAt(KR.k,false); }
function kwStep(){
  if(!KR) return;
  const r=KR.r, cur=KR.k*r;
  if(KR.plan.covers.includes(KR.k)){ kwBlock(); return; }
  if(KR.steps>0){
    // kurz die Zahl sagen, damit der Weg hörbar bleibt
    if(KR.steps<3) kwSay(cur+'. Und weiter?'); else kwSay(String(cur));
  }
  KR.busy=false; KR.t=performance.now();
}
/* Ein Störenfried kommt auf die Inseln. Romy tippt die Zahl selbst ein. */
function kwBlock(){
  const my=KR.id, c=kwPickCritter(), IN=$('kwLayerIn');
  KR.block={c, typed:''};
  const opts=IN.querySelectorAll('.kwopt'); opts.forEach(b=>b.classList.add('locked'));
  const el=document.createElement('div');
  el.className='kwblock act-'+c.act+(KR.space?' insky':'');
  el.style.top=(KW_OPT_Y*100)+'%';
  el.innerHTML=c.html||('<svg viewBox="0 0 220 100" aria-hidden="true">'+c.svg+'</svg>');
  IN.appendChild(el);
  // was mit den Inseln passiert
  setTimeout(()=>{ if(!KR||KR.id!==my) return; opts.forEach(b=>b.classList.add('under-'+c.act)); }, c.act==='lie'?500:700);
  if(c.act==='sink'){ tone(220,.25,0,'sine',.12); tone(160,.3,.15,'sine',.1); }
  else if(c.act==='beam'){ [880,990,1180].forEach((f,i)=>tone(f,.1,i*.08,'square',.04)); }
  else if(c.act==='gulp'){ tone(300,.12,0,'triangle',.1); tone(200,.16,.12,'triangle',.1); }
  else { tone(660,.12,0,'square',.05); tone(520,.12,.12,'square',.05); }
  // Zahlenfeld
  const pad=document.createElement('div'); pad.className='kwpad'; pad.id='kwPad';
  pad.innerHTML='<div class="kwpadtop"><span>'+(KR.k===1?'Und die letzte Zahl?':'Welche Zahl kommt jetzt?')+'</span><b id="kwTyped">?</b></div><div class="kwkeys">'
    +['1','2','3','4','5','⌫','6','7','8','9','0','✓'].map(k=>'<button data-k="'+k+'"'+(k==='✓'?' class="ok"':k==='⌫'?' class="del"':'')+'>'+k+'</button>').join('')+'</div>';
  $('kwMap').appendChild(pad);
  pad.querySelectorAll('button').forEach(b=>b.addEventListener('click',()=>kwType(b.dataset.k)));
  const line=kwPick(c.say);
  setTimeout(()=>{ if(!KR||KR.id!==my) return; pad.classList.add('show'); kwSay(line+' Tipp die Zahl ein!'); KR.busy=false; KR.t=performance.now(); }, 1100);
}
function kwType(k){
  if(!KR||KR.busy||!KR.block) return;
  const B=KR.block, ans=(KR.k-1)*KR.r, el=$('kwTyped');
  if(k==='⌫'){ B.typed=B.typed.slice(0,-1); }
  else if(k==='✓'){ if(B.typed) kwTypedDone(); return; }
  else if(B.typed.length<3){ B.typed+=k; }
  el.textContent=B.typed||'?';
  // genug Ziffern: sofort prüfen, kein OK-Knopf nötig
  if(B.typed.length>=String(ans).length) setTimeout(()=>{ if(KR&&KR.block===B&&!KR.busy) kwTypedDone(); },180);
}
function kwTypedDone(){
  const B=KR.block, val=parseInt(B.typed,10), ans=(KR.k-1)*KR.r, my=KR.id;
  const rt=performance.now()-KR.t, eff=rt*KW_FAST/KW_FAST_TYPE;     // 7 s Eintippen zählt wie 4 s Tippen
  KR.busy=true;
  const correct=kwRecord(val, eff);
  $('kwTyped').textContent=correct?String(val):ans;
  $('kwTyped').classList.add(correct?'good':'again');
  const IN=$('kwLayerIn'), opts=IN.querySelectorAll('.kwopt'), ai=KR.opts.indexOf(ans), blk=IN.querySelector('.kwblock'), pad=$('kwPad');
  if(correct){ sndGood(); $('kwStars').textContent=S.stars; kwSayLine(kwPick(['Kawumm! Aus dem Kopf gewusst!','Ha! Da staunt '+B.c.name+'!','Richtig! Und tschüss, '+B.c.name+'!'])); }
  else { sndAgain(); kwSayLine('Fast! Es ist die '+ans+'. Tschüss, '+B.c.name+'!'); }
  setTimeout(()=>{
    if(!KR||KR.id!==my) return;
    if(pad) pad.classList.remove('show');
    if(blk) blk.classList.add('bye');
    opts.forEach(b=>{ b.className=b.className.replace(/ ?under-\w+/g,''); b.classList.add('back'); });
    if(opts[ai]) opts[ai].classList.add('glow');
    setTimeout(()=>{ if(pad) pad.remove(); if(blk) blk.remove(); },1000);
    KR.block=null;
    kwSail(ai, 1000);
  }, correct?1000:2000);
}
/* Ergebnis eines Schritts eintragen (Tippen auf Insel oder Eintippen) */
function kwRecord(val, rt){
  const r=KR.r, k=KR.k, ans=(k-1)*r, correct=val===ans;
  kwApplyStep(KR.rs.steps[k], correct, rt);
  KR.steps++;
  if(correct){ KR.ok++; S.stars++; } else KR.clean=false;
  if(rt>KW_FAST) KR.clean=false;
  logDay(S,Date.now(),0,1,correct?1:0); save();
  return correct;
}
function kwChoose(i){
  if(!KR||KR.busy||KR.block) return;
  KR.busy=true;
  const rt=performance.now()-KR.t, ans=(KR.k-1)*KR.r, val=KR.opts[i];
  const correct=kwRecord(val, rt);
  const ai=KR.opts.indexOf(ans), btns=$('kwLayerIn').querySelectorAll('.kwopt');
  if(correct){
    sndGood(); $('kwStars').textContent=S.stars;
    const b=btns[ai].getBoundingClientRect(); burst(18,(b.left+b.width/2)/innerWidth,(b.top+b.height/2)/innerHeight,6);
    if(Math.random()<0.4) kwSayLine(kwPick(KW_LINES.ok));
    kwSail(ai,0);
  } else {
    sndAgain();
    btns[i].classList.add('fog'); btns[ai].classList.add('glow');
    kwSayLine(kwPick(KR.space?KW_LINES.wrongSpace:KW_LINES.wrong).replace('{n}',ans));
    kwSail(ai,2200);
  }
}
function kwSail(ai, delay){
  const my=KR.id;
  setTimeout(()=>{
    if(!KR||KR.id!==my) return;
    const btns=$('kwLayerIn').querySelectorAll('.kwopt');
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
      kwRenderStrip();
      setTimeout(()=>{ if(!KR||KR.id!==my) return; kwRenderLayer(); kwStep(); },1050);
    },1150);
  }, delay);
}
function kwTreasure(ai){
  const r=KR.r, rs=KR.rs, before=kwAvail();
  // die letzte Insel bekommt die Schatzkiste
  const btns=$('kwLayerIn').querySelectorAll('.kwopt'); if(btns[ai]) btns[ai].innerHTML=kwStationHTML(0,true);
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
  const showEnd=()=>{
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
    kwArm(end, 2000);
    kwSay(lines.join(' '));
    const ret=KR.ret;
    $('kwEndVault').onclick=()=>{ kwStop(); kwOpenVault(ret==='parent'?'parent':'path', r); };
    $('kwEndAgain').onclick=()=>{ kwStart(r, ret); };
    $('kwEndBack').onclick=()=>{ kwLeave(); };
  };
  setTimeout(()=>{ if(!KR||KR.id!==my) return; if(res.toSpace) kwLaunch(showEnd); else showEnd(); }, 1800);
}
/* Großer Moment: Die Karte ist im Meer geschafft, das Schiff hebt ab ins Weltall */
function kwLaunch(done){
  const my=KR.id, L=$('kwLayer'), IN=$('kwLayerIn'), old=kwShip();
  const alive=()=>KR&&KR.id===my;
  // Sternenhimmel blendet langsam über das Meer
  const night=document.createElement('div'); night.className='kwnight';
  L.insertBefore(night, old);
  // Schiff bekommt Raketenflammen, gleiche Stelle
  const tmp=document.createElement('div'); tmp.innerHTML=kwShipHTML(true); const ship=tmp.firstElementChild;
  ship.style.left=old.style.left; ship.style.top=old.style.top; ship.style.transition='none';
  old.replaceWith(ship);
  // erst in die Mitte segeln, dann Countdown
  requestAnimationFrame(()=>{ ship.style.transition=''; const {w,h}=kwMapSize(); ship.style.left=(w*0.5)+'px'; ship.style.top=(h*0.62)+'px'; });
  IN.style.transition='opacity 1.2s'; IN.style.opacity='0';
  const cnt=document.createElement('div'); cnt.className='kwcount'; $('kwMap').appendChild(cnt);
  kwSay('Weißt du was? Du bist so gut, wir fliegen ins Weltall! Festhalten!');
  const nums=['3','2','1'];
  nums.forEach((n,i)=>setTimeout(()=>{ if(!alive()) return; cnt.textContent=n; cnt.classList.remove('pop'); void cnt.offsetWidth; cnt.classList.add('pop'); tone(440+i*110,.2,0,'triangle',.12); kwSay(['Drei','Zwei','Eins'][i]); }, 3200+i*1200));
  setTimeout(()=>{ if(!alive()) return;
    cnt.textContent=''; ship.classList.add('liftoff'); night.classList.add('on'); sndWhoosh(); burst(60,0.5,0.6,10);
    kwSay('Kawumm! Ab ins Weltall!'); kwBanner('Ab ins Weltall!', 2600);
  }, 3200+3*1200);
  setTimeout(()=>{ if(!alive()) return; cnt.remove(); bigKnall(); sndFanfare(); done(); }, 3200+3*1200+3600);
}
function cap(s){ return s.charAt(0).toUpperCase()+s.slice(1); }
const KW_GENUS={1:'m',2:'f',10:'n',5:'f',4:'n',8:'f',3:'n',6:'n',9:'f',7:'m'};
function artNom(r){ return {m:'der',f:'die',n:'das'}[KW_GENUS[r]]; }
function artDet(r){ return 'dein'+{m:'',f:'e',n:''}[KW_GENUS[r]]; }
function artAcc(r){ return {m:'deinen',f:'deine',n:'dein'}[KW_GENUS[r]]; }
function kwStop(){ KR=null; const p=$('kwPad'); if(p) p.remove(); }
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
    kwArm(el);
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
  kwArm(d);
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
    <div class="kwpaper" id="kwPaper"><b>AHOI ${name}!</b><br>
      Rate mal, wer schreibt. Genau. ICH!<br>
      Du rettest mit Lumi die Inseln? Ohne mich?! Frechheit!<br>
      Ich hab Schatzkarten. Total verrückte. Die liest man rückwärts. Wie ein Krebs!<br>
      Lumi zählt immer nur vorwärts. Gähn!<br>
      Ich wette, du kannst rückwärts. Darf ich kommen? Ich bring Kekse mit. Vielleicht.
      <div class="sig"><b>KAWUMM!</b> <img src="${KW_IMG}" alt=""></div>
      <div class="ps">PS: Sagst du Nein, schick ich dir eine Möwe.</div></div>
    <button class="cta kwyes" id="kwYes">Ja, komm vorbei!</button>`;
  $('overlay').classList.add('show');
  [523,659,523,784].forEach((f,i)=>tone(f,.14,i*0.12,'triangle',.08));
  speak('Post für '+name+'!');
  let shown=false;
  const showYes=()=>{ if(shown) return; shown=true; $('kwYes').classList.add('show'); };
  setTimeout(()=>{
    $('kwEnv').classList.add('open');
    setTimeout(()=>{ $('kwEnv').classList.add('away'); const p=$('kwPaper'); p.classList.add('show'); void p.offsetWidth; p.classList.add('in');
      // Den Brief liest Romy selbst. Nichts vorlesen, der Knopf kommt nach Lesezeit.
      setTimeout(showYes, KW_READ_MS);
    },950);
  },1700);
  $('kwYes').onclick=()=>{ kws().joined=true; save(); kwWelcome(fromParent); };
}
function kwWelcome(fromParent){
  const box=$('overlayBox'), name=S.name||'Romy';
  box.innerHTML='<h2>Kawumm ist da!</h2>'+kwDuoHTML(150)
    +'<p style="margin:0;font-weight:700">Kawumm ist Schatzjägerin. Sie segelt übers Meer und fliegt mit ihrem Schiff bis ins Weltall. Ihr Schiff liegt in der Inselwelt, ganz oben.</p>'
    +'<button class="cta" id="kwWelcomeGo" style="background:#E04A40;box-shadow:0 4px 0 #A8322B">Zum Schiff!</button>';
  bigKnall(); sndFanfare();
  kwArm(box, 2000);
  kwSay('Kawumm! Da bin ich! Hallo '+name+', hallo Lumi! Ich bin Schatzjägerin. Ich segle übers Meer. Und mein Schiff kann fliegen. Bis ins Weltall! Mit Super-Speed! Und ich finde jeden Schatz. Aber nur rückwärts. Das bring ich dir bei. Mein Schiff liegt in der Inselwelt, ganz oben. Komm mit!');
  $('kwWelcomeGo').onclick=()=>{ $('overlay').classList.remove('show'); box.classList.remove('kwletterbox');
    if(fromParent) kwTest=true;                // im Test gleich zeigen, wie es für Romy aussieht
    kwGoToShip(); };
}
/* Nach der Begrüßung: in die Inselwelt, Kawumms Schiff leuchtet und Kawumm zeigt darauf */
function kwGoToShip(){
  if(!kwActive()) return;
  renderPath(); show('path');
  const card=$('pathList').querySelector('.kwmapcard'); if(!card) return;
  card.scrollIntoView({block:'start'}); card.classList.add('hi');
  const open=unlockedRows(S), first=KW_ORDER[0];
  let t='Hier! Das ist mein Schiff! Hier ist auch meine Schatzkammer. ';
  if(open.includes(first)){
    t+='Und unsere erste Schatzkarte liegt auf der '+first+'er-Insel. Schau, da steht Schatzkarte!';
    const isl=$('pathList').querySelector('[data-row="'+first+'"]'); if(isl) isl.classList.add('kwhi');
  } else t+='Die erste Schatzkarte startet direkt hier am Schiff. Tipp auf den roten Knopf!';
  card.querySelector('.tx').insertAdjacentHTML('beforeend','<span class="kwhint">'+t+'</span>');
  kwSay(t);
  setTimeout(()=>{ card.classList.remove('hi'); },9000);
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
document.addEventListener('pointerdown',e=>{
  if(!e.target.closest('button')) return;
  if(current==='kw'||current==='vault'||e.target.closest('.kwletterbox')) kwHush();
},{capture:true, passive:true});
function kwSetup(){
  $('kwBack').addEventListener('click',()=>kwLeave());
  $('kwVaultBack').addEventListener('click',()=>{ if(kwVaultRet==='parent'){ renderParent(); show('parent'); } else { renderPath(); show('path'); } });
}

window.KW={setup:kwSetup, islandCard:kwIslandCard, mapCard:kwMapCard, badge:kwMapBadge, maybeLetter:kwMaybeLetter, parentHTML:kwParentHTML, parentWire:kwParentWire, stop:kwStop, active:kwActive};
}
