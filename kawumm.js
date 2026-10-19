/* =====================================================================
   Kawumm: Rückwärtsreihen als Schatzsuche (seit v38)
   - Lernlogik oben (DOM-frei, in Node testbar), Oberfläche unten.
   - Nutzt zur Laufzeit die Helfer aus index.html (S, save, speak, show, $ ...).
     Diese Datei wird vor dem Hauptskript geladen und ruft beim Laden nichts davon auf.
   ===================================================================== */
'use strict';

/* Für Romy sichtbar erst, wenn KW_LIVE = true. Bis dahin nur über den Elternbereich (Testmodus). */
const KW_LIVE = true;
/* Reihenfolge der Schatzkarten: Kawumm startet mit der Einserreihe, dann die Inselreihenfolge */
const KW_ORDER = [1,2,10,5,4,8,3,6,9,7];
const KW_FWD_SHARE = 0.5;     // eigene Vorwärtsreihe halbwegs: 5 von 10 Aufgaben lila (Box 3+)
const KW_FAST = 4000;         // schnelle Antwort wie vorwärts
const KW_FAST_TYPE = 7000;    // beim Selbst-Eintippen gilt bis 7 s als schnell
const KW_SAFE_BOX = 3;
const KW_CAP = 10;            // Schätze pro Sammelbehälter
const KW_LEVELS = 3;          // Stufen je Behälter: normal, Glitzer, Diamant (wie Lumis Extras)
const KW_READ_MS = 3000;      // ab Öffnen des Briefs: spätestens dann ist "Ja, komm vorbei!" da (Entscheidung Simon)

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
function kwAvailable(kw, fwdShare, away){
  // Reihen im Urlaub (1er und 10er, sobald sie sitzen) fallen aus der Kette heraus
  const order=KW_ORDER.filter(r=>!(away&&away(r)));
  if(!order.length) return [];
  const out=[order[0]];
  for(let i=1;i<order.length;i++){
    const prev=kw.rows[order[i-1]], r=order[i];
    if(prev && prev.stage==='space' && fwdShare(r)>=KW_FWD_SHARE) out.push(r); else break;
  }
  return out;
}
/* Wie viel Hilfe die Karte zeigt:
   sea1 = Meer, Anfang: kommende Zahlen schwach sichtbar
   sea2 = Meer ohne Hilfe (nach einer Fahrt mit höchstens 1 Fehler): kommende Zahlen als ?, gefahrene Spur bleibt sichtbar
   space = Weltall: nur die aktuelle Zahl und der Sprung */
function kwHelpOff(rs){ if(rs.helpOff===undefined) rs.helpOff = rs.clean>=1 || rs.stage==='space'; return rs.helpOff; }
function kwHelpMode(rs){ return rs.stage==='space' ? 'space' : (kwHelpOff(rs) ? 'sea2' : 'sea1'); }
/* Wohin sich ein Störenfried setzen darf. Eintippen ist die schwerste Übung und gehört dorthin, wo es fast sitzt.
   Wackelige Schritte (Fach 0 und 1) behalten immer ihre Inseln als Stütze. Am liebsten Fach 2 und 3: richtig, aber noch nicht blitzschnell. */
function kwCoverWeight(st){ if(!st || st.seen===0 || st.box<2) return 0; return st.box<=3 ? 3 : st.box===4 ? 1.5 : 1; }
/* Plan einer Fahrt: Start (Super-Speed / Rückenwind starten mitten in der Reihe) und wo Störenfriede kommen.
   Meer: nur ohne Hilfe (sea2), höchstens einmal pro Fahrt, gezielt auf einen fast sicheren Schritt.
   Weltall: öfter, nur fast sichere Schritte, nie zweimal hintereinander. Nie im ersten Schritt, nie in der allerersten Fahrt. */
function kwPlanRun(rs, rng){
  rng=rng||Math.random;
  let startK=10, superSpeed=false;
  if(rs.stage==='space' && rs.runs>0 && rng()<0.35){ startK=5+Math.floor(rng()*4); superSpeed=true; }
  else if(rs.stage==='sea' && kwHelpOff(rs) && rs.runs>0 && rng()<0.2){ startK=6+Math.floor(rng()*4); superSpeed=true; }
  const covers=[];
  if(rs.runs>0){
    if(rs.stage==='space'){
      let last=false;
      for(let k=startK;k>=1;k--){
        const w=k===startK?0:kwCoverWeight(rs.steps[k]);
        const c = w>0 && !last && rng() < (w>=3?0.45:0.25);
        if(c) covers.push(k); last=c;
      }
    } else if(kwHelpOff(rs) && rng()<0.7){
      const cand=[]; for(let k=startK-1;k>=1;k--){ const w=kwCoverWeight(rs.steps[k]); if(w>0) cand.push([k,w]); }
      let sum=cand.reduce((a,c)=>a+c[1],0), t=rng()*sum;
      for(const [k,w] of cand){ t-=w; if(t<=0){ covers.push(k); break; } }
    }
  }
  return {startK, superSpeed, covers};
}
/* Wiederholung: Karten im Weltall kommen nach einer Pause wieder dran, die Pause wird jedes Mal länger.
   Klappt die Wiederholung nicht (mehr als 1 Fehler), geht es wieder mit kurzer Pause los. */
const KW_REVIEW_DAYS=[2,4,8,16,30];
function kwIsDue(rs, now){ return !!(rs && rs.stage==='space' && rs.last && now-rs.last >= KW_REVIEW_DAYS[Math.min(rs.reviews||0, KW_REVIEW_DAYS.length-1)]*86400000); }
function kwDueIn(rs, now){ if(!rs||rs.stage!=='space'||!rs.last) return null; return Math.max(0, Math.ceil((rs.last + KW_REVIEW_DAYS[Math.min(rs.reviews||0, KW_REVIEW_DAYS.length-1)]*86400000 - now)/86400000)); }
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
/* Fahrt beendet. st = {clean, errors, mode}. clean = alles richtig und schnell.
   Meer mit Hilfe (sea1): höchstens 1 Fehler, dann ist die Hilfe weg. Zählt nie fürs Weltall.
   Meer ohne Hilfe (sea2): zwei saubere Fahrten am Stück, dann ab ins Weltall. 4 Fehler oder mehr: die Hilfe kommt zurück. */
function kwFinishRun(rs, st, now){
  if(typeof st==='boolean') st={clean:st, errors:st?0:1, mode:kwHelpMode(rs)};   // alter Aufruf
  now=now||Date.now();
  const res={toSpace:false, find:false, full:false, levelUp:false, helpOff:false, helpBack:false, review:false, reviewOk:false};
  const wasDue=kwIsDue(rs, now);
  rs.runs++;
  if(rs.stage==='sea'){
    if(st.mode==='sea1'){
      rs.clean=0;
      if(st.errors<=1){ rs.helpOff=true; res.helpOff=true; }
    } else {
      rs.clean = st.clean ? rs.clean+1 : 0;
      if(rs.clean>=2){ rs.stage='space'; rs.reviews=0; res.toSpace=true; }
      else if(st.errors>=4){ rs.helpOff=false; res.helpBack=true; }
    }
  } else if(wasDue){
    res.review=true; res.reviewOk = st.errors<=1;
    rs.reviews = res.reviewOk ? (rs.reviews||0)+1 : 0;
  }
  rs.last=now;
  rs.level=rs.level||0;
  if(rs.finds<KW_CAP){ rs.finds++; res.find=true; res.full = rs.finds===KW_CAP; }
  else if(rs.level<KW_LEVELS-1){ rs.level++; rs.finds=1; res.find=true; res.levelUp=true; }   // voll: verwandelt sich und füllt sich neu
  return res;
}
/* ---------- Kawumm auf Reisen (seit v64) ----------
   Abflug: nach 6 bis 8 Fahrten seit Start bzw. letzter Rückkehr, nur am Ende einer Fahrt, nur wenn es bei Lumi vorwärts etwas zu tun gibt.
   Rückkehr: nach 2 bis 3 Spieltagen (Tage nach dem Abflug mit mindestens einer Lumi-Aufgabe in state.days). Kalendertage zählen nicht.
   Briefe: Abschied, 1 bis 2 Reisebriefe (mal beim App-Start, mal am Rundenende nach 3 bis 6 Lumi-Runden), Rückkehrbrief.
   Höchstens ein Brief pro Tag (lastLetterDay). Fällige Wiederholungen pausieren: rs.last rückt um die Reisezeit nach hinten. */
const KW_TRIP_N=9;                 // so viele Reisen sind vorgeschrieben (KW_TRIPS)
const KW_LEAVE_MIN=6, KW_LEAVE_MAX=8, KW_DAYS_MIN=2, KW_DAYS_MAX=3, KW_ROUNDS_MIN=3, KW_ROUNDS_MAX=6;
function kwRandInt(rng,a,b){ return a+Math.floor(rng()*(b-a+1)); }
function kwTripDefault(rng){
  rng=rng||Math.random;
  return {state:'home', idx:null, count:0, order:Array.from({length:KW_TRIP_N},(_,i)=>i), pos:0,
    runsSince:0, nextAfter:kwRandInt(rng,KW_LEAVE_MIN,KW_LEAVE_MAX), leftDay:null, leftAt:null, needDays:0,
    plan:0, sent:0, next:null, roundsSince:0, lastLetterDay:null};
}
/* Alte Stände und Sicherungsdateien: Reise, Briefe und Andenken mit Standardwerten nachrüsten */
function kwTripEnsure(kw, rng){
  if(!kw.trip || typeof kw.trip!=='object') kw.trip=kwTripDefault(rng);
  const d=kwTripDefault(rng); for(const k in d) if(kw.trip[k]===undefined) kw.trip[k]=d[k];
  if(!Array.isArray(kw.mail)) kw.mail=[];
  if(!Array.isArray(kw.souvenirs)) kw.souvenirs=[];
  return kw.trip;
}
function kwAway(kw){ return !!(kw && kw.trip && kw.trip.state==='away'); }
/* Spieltage seit dem Abflug: nur Tage NACH dem Abflugtag, an denen Lumi-Aufgaben gelöst wurden (Kawumm zählt dort nicht mit) */
function kwPlayDays(days, leftDay){
  if(!days||!leftDay) return 0;
  return Object.keys(days).filter(d=>d>leftDay && days[d] && days[d].tasks>0).length;
}
/* Nächster Reisebrief: beim App-Start oder am Rundenende nach 3 bis 6 Lumi-Runden */
function kwPlanLetter(rng){ return rng()<0.5 ? {when:'start'} : {when:'round', rounds:kwRandInt(rng,KW_ROUNDS_MIN,KW_ROUNDS_MAX)}; }
/* Feste Reihenfolge 1 bis 9, danach neu gemischt (nie dieselbe Reise zweimal hintereinander) */
function kwNextTripIdx(t, rng){
  if(t.pos>=t.order.length){
    const last=t.order[t.order.length-1], o=Array.from({length:KW_TRIP_N},(_,i)=>i);
    do{ o.sort(()=>rng()-0.5); } while(KW_TRIP_N>1 && o[0]===last);
    t.order=o; t.pos=0;
  }
  return t.order[t.pos++];
}
/* Abflug wirklich ausführen. tip = Lumi-Tipp im Abschiedsbrief (aus guideMode). Gibt den Brief zurück. */
function kwTripDepart(kw, today, now, rng, tip){
  rng=rng||Math.random; const t=kwTripEnsure(kw, rng);
  t.idx=kwNextTripIdx(t, rng); t.state='away'; t.leftDay=today; t.leftAt=now;
  t.needDays=kwRandInt(rng,KW_DAYS_MIN,KW_DAYS_MAX); t.plan=kwRandInt(rng,1,2); t.sent=0;
  t.next=kwPlanLetter(rng); t.roundsSince=0; t.lastLetterDay=today; t.runsSince=0;
  const m={t:t.idx, k:'bye', d:today, read:false}; if(tip) m.tip=tip;
  kw.mail.push(m); return m;
}
/* Am Ende jeder Fahrt aufrufen. true = Kawumm fliegt jetzt los (Abschiedsbrief steht dann in kw.mail).
   fwdWork: bei Lumi gibt es vorwärts etwas zu tun (lumiWorkLeft in index.html). */
function kwTripRunEnd(kw, o, rng){
  rng=rng||Math.random; const t=kwTripEnsure(kw, rng);
  if(t.state!=='home') return false;
  t.runsSince++;
  if(t.runsSince<t.nextAfter || !o.fwdWork || t.lastLetterDay===o.today) return false;
  kwTripDepart(kw, o.today, o.now, rng, o.tip);
  return true;
}
/* Was beim App-Start (nach dem Intro) dran ist, ohne etwas zu ändern: 'back', 'travel' oder null */
function kwTripStartDue(kw, days, today){
  const t=kw.trip; if(!t||t.state!=='away'||t.lastLetterDay===today) return null;
  const pd=kwPlayDays(days, t.leftDay);
  if(pd>=t.needDays && t.sent>=1) return 'back';
  if(t.sent<t.plan && t.next && (t.next.when==='start' || pd>=t.needDays)) return 'travel';
  return null;
}
/* Am Ende einer Lumi-Runde: Runde zählen (nur unterwegs). Kein Brief, nur Zähler. */
function kwTripRound(kw){ const t=kw.trip; if(t&&t.state==='away') t.roundsSince++; }
/* Darf jetzt am Rundenende ein Reisebrief kommen? (ohne etwas zu ändern) */
function kwTripRoundDue(kw, today){
  const t=kw.trip; if(!t||t.state!=='away'||t.lastLetterDay===today) return false;
  return t.sent<t.plan && !!t.next && t.next.when==='round' && t.roundsSince>=t.next.rounds;
}
/* Reisebrief verschicken (Nummer 0 oder 1 der Reise) */
function kwTripSendTravel(kw, today, rng){
  rng=rng||Math.random; const t=kw.trip;
  const m={t:t.idx, k:'travel', n:t.sent, d:today, read:false};
  t.sent++; t.lastLetterDay=today; t.roundsSince=0; t.next = t.sent<t.plan ? kwPlanLetter(rng) : null;
  kw.mail.push(m); return m;
}
/* Fällige Wiederholungen pausieren: jede Karte rückt um die Reisezeit nach hinten */
function kwShiftDue(kw, ms){
  if(!(ms>0)) return;
  for(const r in kw.rows){ const rs=kw.rows[r]; if(rs && rs.last) rs.last+=ms; }
}
/* Rückkehr: Andenken in die Schatzkammer, Fälligkeit verschieben, Rückkehrbrief */
function kwTripReturn(kw, today, now, rng){
  rng=rng||Math.random; const t=kw.trip, idx=t.idx;
  kwShiftDue(kw, now-(t.leftAt||now));
  if(!kw.souvenirs.includes(idx)) kw.souvenirs.push(idx);
  const m={t:idx, k:'back', d:today, read:false}; kw.mail.push(m);
  t.state='home'; t.count++; t.lastLetterDay=today; t.runsSince=0; t.nextAfter=kwRandInt(rng,KW_LEAVE_MIN,KW_LEAVE_MAX);
  t.next=null; t.roundsSince=0; t.leftAt=null;
  return m;
}
/* ================= KW-LOGIC-END ================= */

/* ---------- Reisebriefe (Texte, Romy liest selbst, nichts davon wird vorgelesen) ----------
   Je Reise: Ort, Andenken, Abschied (bye), 1 bis 2 Reisebriefe (travel[0] kommt immer, travel[1] nur manchmal), Rückkehr (back).
   {name} wird ersetzt. Im Abschied steht außerdem der Lumi-Tipp (kwTipLine) und immer: Ich melde mich. Und ich komme wieder!
   Rätsel nur im PS des Abschieds (Reise 3, 6, 9), die Lösung steht im ersten Reisebrief (der kommt immer). */
const KW_COMEBACK='Ich melde mich. Und ich komme wieder!';
const KW_TRIPS=[
  {place:'Glibber-Berg', from:'vom Glibber-Berg', souv:'jelly', souvName:'Wackelpudding-Glas',
   bye:{l:['Ich muss los. Sofort!','Liese hat eine Karte gefunden. Da ist ein Berg drauf. Aus Wackelpudding!','Ein Berg zum Essen? Da MUSS ich hin.'], ps:'Pass gut auf Lumi auf. Sonst futtert sie meine Kekse.'},
   travel:[{l:['Wir sind am Glibber-Berg. Er wackelt die ganze Zeit!','Berta ist hingefallen. Platsch! Mitten in den roten Teil.','Dann hat das Pupstierchen gepupst. Jetzt ist der Berg bunt wie ein Regenbogen.','Liese sagt: Nicht alles aufessen, sonst ist der Berg weg.','Ich hab trotzdem genascht. Nur ein bisschen. Ein großes bisschen.'], ps:'Wackelpudding mit Himbeere schmeckt am besten.'},
           {l:['Oben auf dem Glibber-Berg wohnt ein Glibber-Wurm. Ganz grün und ganz lieb.','Er hat gesagt: Wer mich kitzelt, darf rutschen.','Also hab ich gekitzelt. Er hat so gelacht, dass der ganze Berg gewackelt hat.','Und dann sind wir alle runtergerutscht. Bis ganz unten!'], ps:'Rutschen auf Wackelpudding ist kalt am Po.'}],
   back:{l:['Ich bin wieder da! Kawumm!','Ich hab dir ein Stück vom Glibber-Berg mitgebracht. Im Glas, damit es nicht wegwackelt.','Es steht in der Schatzkammer. Nicht aufessen!','Ich hab dich vermisst. Ein bisschen. Na gut, sehr.']}},
  {place:'Planet Kitzel', from:'vom Planeten Kitzel', souv:'feather', souvName:'Kitzel-Feder',
   bye:{l:['Gerade kam ein Ufo vorbei. Es hat gehupt. Dreimal!','Liese sagt, das heißt: Hilfe, wir brauchen Piraten!','Also fliege ich ins Weltall. Zum Planeten Kitzel.'], ps:'Siehst du heute Nacht einen Stern, der hupt? Das bin ich.'},
   travel:[{l:['Auf dem Planeten Kitzel wohnen grüne Aliens. Sie haben zehn Arme.','Aber sie haben ihr Lachen verloren. Keiner weiß, wo.','Liese hatte einen Plan: Das Pupstierchen pupst einen Regenbogen.','Da hat das Lachen gekichert. Es saß unter einem Stein! Jetzt lachen alle wieder.'], ps:'Aliens riechen nach Pfefferminz. Echt wahr.'},
           {l:['Heute war Kitzel-Fest. Alle Aliens kitzeln alle!','Ich hab so gelacht, dass mir der Hut runtergefallen ist.','Ein Alien hat ihn aufgesetzt. Er war viel zu groß. Man hat nur noch Arme gesehen.'], ps:'Rosi hat ein Alien gekitzelt. Es ist fast geplatzt vor Lachen.'}],
   back:{l:['Ich bin wieder da! Mit Super-Speed nach Hause!','Die Aliens haben mir eine Kitzel-Feder geschenkt. Als Dankeschön fürs Lachen-Finden.','Sie liegt in der Schatzkammer. Fass sie lieber nicht an. Oder doch. Hihi!','Hast du mich vermisst? Ich dich schon.']}},
  {place:'Schnecken-Rennen', from:'vom Schnecken-Rennen', souv:'snail', souvName:'Glitzer-Schneckenhaus',
   bye:{l:['Heute ist das große Schnecken-Rennen auf der Insel Kriechzu.','Liese hat uns angemeldet. Unsere Schnecke heißt Blitz. Sie ist sehr langsam.','Das wird ein Abenteuer! Ich muss sofort los.'], ps:'Ein Rätsel für dich: Was hat viele Zähne, kann aber nicht beißen? Die Lösung steht im nächsten Brief.'},
   travel:[{l:['Das Rennen läuft. Seit drei Tagen! Die Schnecken sind erst bei der Hälfte.','Blitz hat geschlafen. Mitten auf der Strecke.','Liese hatte einen Plan: Wir legen Salat hinter die Ziellinie.','Jetzt kriecht Blitz los. Ganz schnell. Für eine Schnecke.'], ps:'Die Lösung vom Rätsel: ein Kamm! Hast du es gewusst?'},
           {l:['Pause beim Rennen! Alle Schnecken machen Picknick. Mit Salat, klar.','Berta wollte auf einer Schnecke reiten. Hat nicht geklappt.','Das Pupstierchen hat einen Regenbogen gepupst. Jetzt haben alle Schnecken bunte Häuser.'], ps:'Schnecken können nicht klatschen. Sie winken mit den Fühlern.'}],
   back:{l:['Ich bin wieder da! Und Blitz hat gewonnen! Ganz knapp. Mit Salat geht alles.','Ich hab einen Pokal dabei. Er ist so groß wie ein Schneckenhaus. Weil er ein Schneckenhaus ist. Mit Glitzer!','Er steht in der Schatzkammer. Ganz oben.','Blitz lässt dich grüßen. Langsam.']}},
  {place:'Keks-Mond', from:'vom Keks-Mond', souv:'cookie', souvName:'Sternkeks',
   bye:{l:['Weißt du, was ich gehört hab? Der Mond ist ein Keks! Ein riesiger!','Liese sagt, das stimmt nicht. Aber sie packt trotzdem Milch ein.','Wir fliegen hin und probieren. Nur ein Bissen. Versprochen.'], ps:'Sieht der Mond heute angeknabbert aus? Dann war ich das.'},
   travel:[{l:['Wir sind auf dem Mond gelandet. Er ist kein Keks. Er ist ein Käse! Und er riecht nach Socken.','Berta hält sich die Nase zu. Rosi auch.','Liese hatte einen Plan: Wir schauen hinter den Mond.','Da wohnt ein Mondbäcker! Er backt Sternkekse. In echt!'], ps:'Im Weltall hört man keinen Pups. Aber den Regenbogen sieht man!'},
           {l:['Heute durften wir beim Mondbäcker helfen.','Ich hab den Teig geknetet. Mit den Füßen. Ups.','Liese hat schnell neuen Teig gemacht. Sie ist eben die Checkerin.','Das Pupstierchen findet den Käse-Mond toll. Klar.'], ps:'Sternkekse leuchten im Bauch. Ich bin jetzt eine Nachtlampe.'}],
   back:{l:['Ich bin wieder da! Kawumm!','Ich hab dir einen Sternkeks mitgebracht. Er leuchtet!','Er liegt in der Schatzkammer. Ich hab nur ein ganz kleines Stück abgebissen.','Na gut, zwei Stück.']}},
  {place:'Fisch-Disco', from:'von der Fisch-Disco', souv:'shell', souvName:'Disco-Muschel',
   bye:{l:['Unten im Meer ist heute Disco! Die Fische haben mich eingeladen.','Ich kann tauchen. Ein bisschen. Liese hat Taucherbrillen für alle.','Ich bin gleich weg. Platsch!'], ps:'Kannst du unter Wasser tanzen? Ich übe noch.'},
   travel:[{l:['Die Fisch-Disco ist der Knaller! Ein Krake macht die Musik. Mit acht Armen!','Eine Qualle leuchtet bunt. Das ist das Disco-Licht.','Berta tanzt mit einem Seepferdchen. Rosi mit einem Hummer.','Ich tanze mit allen. Kawumm!'], ps:'Der Brief ist ein bisschen nass. Entschuldigung!'},
           {l:['Plötzlich war die Musik aus! Die Muscheln hatten den Mund zu.','Liese hatte einen Plan: Wir kitzeln die Muscheln. Dann lachen sie und machen auf.','Hat geklappt! Und das Pupstierchen hat Regenbogen-Blasen gepupst.','Die schönste Disco der Welt!'], ps:'Fische können nicht klatschen. Sie blubbern.'}],
   back:{l:['Ich bin wieder da! Und ganz trocken. Fast.','Ich hab dir eine Disco-Muschel mitgebracht. Sie glitzert in allen Farben.','Sie liegt in der Schatzkammer.','Mir ist noch ganz schwindelig vom Tanzen.']}},
  {place:'Wolkenschloss', from:'vom Wolkenschloss', souv:'button', souvName:'Riesen-Knopf',
   bye:{l:['Ganz oben in den Wolken steht ein Schloss. Da wohnt ein Riese.','Er schnarcht so laut, dass die Wolken wackeln. Keiner kann schlafen!','Liese hat ein bisschen Angst. Aber sie hat auch einen Plan. Wir fliegen hin!'], ps:'Ein Rätsel für dich: Der Riese zählt beim Verstecken rückwärts. 30, 27, 24. Welche Zahl kommt dann? Die Lösung steht im nächsten Brief.'},
   travel:[{l:['Der Riese heißt Knut. Er ist ganz lieb. Nur sehr laut.','Er schnarcht, weil eine Feder in seiner Nase steckt.','Liese hatte einen Plan: Das Pupstierchen pupst einen Regenbogen. Direkt unter Knuts Nase.','HATSCHI! Die Feder ist rausgeflogen. Jetzt schläft Knut ganz leise.'], ps:'Die Lösung vom Rätsel: 21! Danach kommen 18, 15, 12. Hast du es gewusst?'},
           {l:['Knut hat uns sein Schloss gezeigt. Die Tür ist so groß wie zehn Schiffe.','Sein Bett ist eine Wolke. Wir durften drauf hüpfen!','Rosi ist so hoch gehüpft, dass sie auf einer anderen Wolke gelandet ist.'], ps:'Rosi findet es da oben gemütlich. Sie winkt uns zu.'}],
   back:{l:['Ich bin wieder da! Kawumm!','Knut hat mir einen Knopf von seiner Jacke geschenkt. Er ist so groß wie ein Teller.','Er liegt in der Schatzkammer. Man kann damit auch Frisbee spielen.','Ich hab dich vermisst!']}},
  {place:'Dino-Insel', from:'von der Dino-Insel', souv:'egg', souvName:'Schoko-Dino-Ei',
   bye:{l:['Bei mir ist eine Flaschenpost gelandet. Von der Dino-Insel!','Da steht nur: HICKS. HICKS. HILFE.','Ein Dino hat Schluckauf! Seit einer Woche! Da muss Käpt\'n Kawumm ran.'], ps:'Weißt du, was gegen Schluckauf hilft? Ich nicht. Noch nicht.'},
   travel:[{l:['Der Dino heißt Rumsi. Er ist so groß wie ein Haus. Und so lieb wie ein Kätzchen.','Bei jedem HICKS wackelt die ganze Insel.','Liese hatte einen Plan: Wir überraschen Rumsi.','Das Pupstierchen hat einen RIESEN Regenbogen gepupst. Rumsi hat so gestaunt, dass der Schluckauf weg war!'], ps:'Berta hatte auch Schluckauf. Vom Zugucken.'},
           {l:['Rumsi zeigt uns jetzt die Dino-Insel. Ich sitze auf seinem Kopf.','Von da oben sieht man bis zum Meer!','Die Dino-Babys spielen Fangen mit uns. Sie sind sehr schnell.','Berta wurde dreimal gefangen.'], ps:'Jetzt will Rumsi jeden Tag einen Regenbogen. Das Pupstierchen braucht Urlaub.'}],
   back:{l:['Ich bin wieder da! Ohne Schluckauf!','Rumsi hat mir ein Dino-Ei geschenkt. Keine Sorge, da ist kein Dino drin. Es ist aus Schokolade!','Es liegt in der Schatzkammer. Ich nasche nicht. Fast nicht.']}},
  {place:'Planet Kuddelmuddel', from:'vom Planeten Kuddelmuddel', souv:'sock', souvName:'Glitzer-Socke',
   bye:{l:['Weißt du, wo verlorene Socken hingehen? Ich weiß es jetzt!','Auf den Planeten Kuddelmuddel. Liese hat es im Fernrohr gesehen.','Da will ich meine Lieblingssocke zurückholen. Die mit den Ankern.'], ps:'Schau mal in deinen Schrank. Fehlt da auch eine Socke?'},
   travel:[{l:['Der Planet Kuddelmuddel ist ganz aus Socken! Berge aus Socken. Bäume aus Socken.','Ich suche meine Socke mit den Ankern. Hier liegen Millionen!','Liese hatte einen Plan: Das Pupstierchen schnüffelt. Es hat die beste Nase.','Und da lag sie! Ein Socken-Alien hat darin geschlafen. Ich hab sie ihm geschenkt.'], ps:'Rosi hat eine rosa Socke gefunden. Ist das vielleicht deine?'},
           {l:['Die Socken-Aliens tragen Socken als Mütze. Das sieht so lustig aus!','Heute haben sie mir auch eine Socken-Mütze gemacht. Sie ist mir über die Augen gerutscht.','Dann bin ich gegen einen Socken-Berg gelaufen. Ganz weich!'], ps:'Das Pupstierchen hat eine Mini-Socke bekommen. Als Schal.'}],
   back:{l:['Ich bin wieder da! Kawumm!','Die Socken-Aliens haben mir eine Glitzer-Socke geschenkt. Sie passt auf keinen Fuß.','Darum liegt sie jetzt in der Schatzkammer. Sie riecht nach Weltall.','Ich hab dich vermisst!']}},
  {place:'Bonbon-Vulkan', from:'vom Bonbon-Vulkan', souv:'candy', souvName:'Riesen-Bonbon',
   bye:{l:['Auf der Insel Zuckerbums steht ein Vulkan. Er spuckt Bonbons!','Aber nur einmal im Jahr. Und das ist morgen!','Liese hat Taschen genäht. Große! Wir fahren sofort los.'], ps:'Ein Rätsel für dich: Liese hat 3 Taschen. In jede passen 5 Bonbons. Wie viele Bonbons sind das zusammen? Die Lösung steht im nächsten Brief.'},
   travel:[{l:['Der Vulkan hat gerumpelt. Dann: BUMM! Bonbons überall! Rote, gelbe, grüne!','Wir sind rumgerannt und haben gesammelt.','Berta hat ein Bonbon auf den Kopf gekriegt. Es war ganz weich. Alles gut.','Das Pupstierchen hat so viele Bonbons gegessen. Jetzt pupst es nach Erdbeere.'], ps:'Die Lösung vom Rätsel: 15 Bonbons! 3 mal 5 ist 15. Hast du es gewusst?'},
           {l:['Ein paar Bonbons sind ins Meer gefallen. Jetzt ist das Meer süß!','Die Fische finden das super. Sie haben ganz bunte Zungen.','Liese hat einen Plan: Wir bringen allen Bonbons mit. Dir auch!'], ps:'Ich hab ein bisschen Bauchweh. Zu viele Bonbons.'}],
   back:{l:['Ich bin wieder da! Mit vollen Taschen!','Ich hab dir das größte Bonbon mitgebracht. Es ist so groß wie mein Kopf.','Es liegt in der Schatzkammer. Lutschen dauert bestimmt ein Jahr.','Ich hab dich vermisst!']}}
];
/* Lumi-Tipp im Abschiedsbrief: dieselbe Regel wie der Wegweiser (guideMode), keine Bedingung für die Rückkehr */
function kwTipLine(gm){
  if(!gm) return '';
  if(gm.mode==='island') return 'Mein Tipp: Reite mit Lumi den Inselritt auf der '+gm.row+'er-Insel!';
  if(gm.mode==='practice') return gm.why==='speed' ? 'Mein Tipp: Tipp im Zaubertraining ganz schnell ein. Dann werden die Sterne lila!' : 'Mein Tipp: Üb mit Lumi im Zaubertraining. Ganz in Ruhe!';
  return 'Mein Tipp: Flieg mit Lumi im Wolkenflug!';
}
/* Brieftext als Zeilen: {head, lines, ps}. m = Eintrag aus kw.mail */
function kwMailText(m, name){
  const T=KW_TRIPS[m.t]; if(!T) return null;
  const part = m.k==='bye' ? T.bye : m.k==='back' ? T.back : T.travel[Math.min(m.n||0, T.travel.length-1)];
  const lines=part.l.slice();
  if(m.k==='bye'){ lines.push(KW_COMEBACK); if(m.tip) lines.push(m.tip); }
  if(m.k==='back') lines.push('Komm zum Schiff!');
  const sub=s=>s.replace(/\{name\}/g, name||'Romy');
  const out={head:'AHOI '+(name||'Romy')+'!', lines:lines.map(sub), ps:part.ps?sub(part.ps):''};
  out.liese=/Liese/.test(out.lines.join(' ')+' '+out.ps);   // Liese kommt vor: kleines Bild im Brief
  return out;
}

if(typeof module!=='undefined' && module.exports){
  module.exports={KW_ORDER,KW_CAP,KW_LEVELS,kwDefault,kwRowState,kwRowSafe,kwAvailable,kwHelpMode,kwHelpOff,kwPlanRun,kwOptions,kwApplyStep,kwFinishRun,kwIsDue,kwDueIn,kwCoverWeight,
    KW_TRIP_N,KW_TRIPS,KW_COMEBACK,kwTripDefault,kwTripEnsure,kwAway,kwPlayDays,kwPlanLetter,kwNextTripIdx,kwTripDepart,kwTripRunEnd,kwTripStartDue,kwTripRound,kwTripRoundDue,kwTripSendTravel,kwShiftDue,kwTripReturn,kwTipLine,kwMailText};
}

/* ===================== Oberfläche ===================== */
if(typeof document!=='undefined'){

const KW_INK='#3B2A52';
const KW_IMG='assets/kawumm.png?v=1';
const KW_LIESE='assets/liese.png?v=1';                // Liese (Vorlage von Simon, freigestellt), nur in Briefen, in denen sie vorkommt
const KW_VOICE={rate:1.12, pitch:1.0, alt:true};    // natürliche Tonhöhe, etwas schneller und frecher als Lumi (Lumi: Tonhöhe 1.14, Tempo 1.04)
let kwTest=false;                                    // Testmodus aus dem Elternbereich, gilt bis zum Neustart
let KR=null;                                         // laufende Schatzsuche
let kwVaultRet='path';
let kwDueSaid=false;

function kws(){ if(!S.kw) S.kw=kwDefault(); if(!S.kw.trip||!S.kw.mail||!S.kw.souvenirs) kwTripEnsure(S.kw); return S.kw; }
function kwIsAway(){ return kwAway(kws()); }
function kwActive(){ return kwTest || (KW_LIVE && kws().joined); }
function kwFwd(r){ return rowMastery(S,r); }
function kwAvail(){ return kwAvailable(kws(), kwFwd, r=>typeof onVacation==='function'&&onVacation(S,r)); }
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
  wind:['Rückenwind! Wir rauschen ein Stück weiter!','Huch, eine Windböe! Schon sind wir bei der {n}!','Segel voll Wind! Weiter geht es bei der {n}!'],
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
const KW_LV_NAME=['','Glitzer-','Diamant-'];
function kwBoxName(r, lv){ return (KW_LV_NAME[lv||0]||'')+KW_BOX[r].name; }
function kwBoxSVG(r, n, size, locked, lv){
  lv=locked?0:(lv||0);
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
  // Glitzer: goldener Schein und Funkeln. Diamant: bunter Schein und ein Diamant obendrauf.
  const halo = lv===1 ? '<circle cx="50" cy="60" r="44" fill="#FFE27A" opacity=".35"/>'+kwStar(10,48,4,'#FFF3B0')+kwStar(90,58,4,'#FFF3B0')
            : lv===2 ? '<circle cx="50" cy="60" r="46" fill="#B9E8F7" opacity=".45"/><circle cx="50" cy="60" r="38" fill="#F8C7DF" opacity=".35"/>'+kwStar(10,48,4,'#E3F3FC')+kwStar(90,58,4,'#E3F3FC') : '';
  const badge = lv===2 ? `<path d="M50 2 L58 10 L50 22 L42 10 Z" fill="#9ED3EA" stroke="${KW_INK}" stroke-width="2" stroke-linejoin="round"/><path d="M42 10 H58 M50 2 V22" stroke="#fff" stroke-width="1"/>` : lv===1 ? kwStar(50,10,8,'#FFE27A') : '';
  const q=L?`<text x="50" y="76" text-anchor="middle" font-family="Baloo 2, sans-serif" font-weight="700" font-size="30" fill="#B8A9D6">?</text>`:'';
  return `<svg viewBox="0 0 100 100" width="${w}" height="${w}" class="kwbox" aria-hidden="true">${halo}${back}${r!==8?items:''}${front}${r===8?items:''}${q}${full}${badge}</svg>`;
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
function kwFxPick(){
  if(Math.random()<0.35) return null;
  const pool=KR.space?KW_SPACE_FX:KW_SEA_FX;
  return {x:Math.random()<0.5?8:92, y:44+Math.random()*6, svg:pool[Math.floor(Math.random()*pool.length)]};
}
function kwFxHTML(fx, dy){ return fx ? '<div class="kwfx" style="left:'+fx.x+'%;top:'+(fx.y+(dy||0))+'%">'+fx.svg+'</div>' : ''; }
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
.kwlayer{position:absolute; inset:0; transition:transform 1.2s ease-in-out;}
.kwopt.kwnext{opacity:0; pointer-events:none; transition:opacity 1s ease .2s;}
.kwopt.kwnext.show{opacity:1;}
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
.kwship{position:absolute; width:26%; max-width:130px; aspect-ratio:120/100; transform:translate(-50%,-92%); pointer-events:none; z-index:3; transition:left 1.2s ease-in-out, top 1.2s ease-in-out;}
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
.kwbadge.due{background:#F2B83C; color:${KW_INK}; animation:kwduepulse 1.6s ease-in-out infinite;}
@keyframes kwduepulse{50%{transform:scale(1.08)}}
.kwbadge{display:inline-block; align-self:flex-start; background:#E04A40; color:#fff; font-size:11px; font-weight:800; border-radius:999px; padding:1px 8px; margin-top:2px;}
/* Schatzkammer */
.kwvault{flex:1; overflow-y:auto; display:flex; flex-direction:column; gap:12px; padding-block:6px 30px; align-items:center;}
.kwvault > *{flex-shrink:0;}
.kwhead{display:flex; align-items:center; gap:10px; width:100%; max-width:460px;}
.kwhead img{height:90px; width:auto;}
.kwhead .bub{display:none; flex:1; background:#fff; border:2px solid var(--line); border-radius:18px; padding:8px 12px; font-weight:700; font-size:15px;}
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
.kwpaper .kwliese{float:right; height:92px; margin:0 0 4px 8px; shape-outside:margin-box;}
.kwpaper .ps{font-size:15px; color:var(--muted); margin-top:2px;}
.kwpaper .ps{font-size:15px; color:var(--muted); margin-top:2px;}
.kwyes{opacity:0; transform:scale(.6); transition:opacity .4s, transform .4s cubic-bezier(.3,1.4,.5,1); pointer-events:none; background:#E04A40; box-shadow:0 4px 0 #A8322B;}
.kwyes.show{opacity:1; transform:scale(1); pointer-events:auto;}
.kwduo{display:flex; align-items:flex-end; justify-content:center; gap:6px; height:170px; margin-top:6px;}
.kwduo-lumi{animation:kwhop .9s ease-in-out infinite;}
.kwduo-kaw{height:150px; width:auto; transform:scaleX(-1); animation:kwhopm .9s ease-in-out .45s infinite;}
@keyframes kwhop{0%,100%{transform:translateY(0)}40%{transform:translateY(-28px)}60%{transform:translateY(-28px)}80%{transform:translateY(0) scaleY(.94)}}
@keyframes kwhopm{0%,100%{transform:scaleX(-1) translateY(0)}40%{transform:scaleX(-1) translateY(-34px) rotate(6deg)}60%{transform:scaleX(-1) translateY(-34px)}80%{transform:scaleX(-1) translateY(0) scaleY(.94)}}
/* Kawumm auf Reisen: Briefkasten, Anleger, Andenken */
#btnMail{position:relative;}
#btnMail .kwmailbadge{position:absolute; top:-6px; right:-6px; min-width:22px; height:22px; border-radius:999px; background:#E04A40; color:#fff; font-family:var(--font-disp); font-size:14px; line-height:22px; padding:0 5px; box-shadow:0 0 0 2px #fff; animation:kwduepulse 1.6s ease-in-out infinite;}
.kwmails{display:flex; flex-direction:column; gap:8px; width:100%; max-height:52vh; overflow-y:auto; padding:2px;}
.kwmailitem{position:relative; display:flex; align-items:center; gap:10px; width:100%; background:#fff; border:2px solid #E2C795; border-radius:16px; padding:8px 12px; text-align:left; font-family:var(--font-disp); font-weight:700; font-size:18px; color:${KW_INK}; flex-shrink:0;}
.kwmailitem .ic{font-size:22px;}
.kwmailitem.new{border-color:#E04A40;}
.kwmailitem .dot{position:absolute; right:12px; top:50%; width:12px; height:12px; margin-top:-6px; border-radius:50%; background:#E04A40;}
.kwawaycard .kwdock{width:96px; flex:0 0 auto;}
.kwawaycard .kwdock svg{width:100%; height:auto; display:block;}
.kwbottle{animation:kwbottle 2.4s ease-in-out infinite;}
@keyframes kwbottle{50%{transform:translateY(-3px) rotate(4deg)}}
.kwmailmini{font-size:22px; padding:6px 12px;}
.kwsouvshelf{width:100%; max-width:460px; background:#DCEAF5; border:3px solid #9ED3EA; border-radius:24px; padding:10px 12px 12px;}
.kwsouvtitle{font-family:var(--font-disp); font-weight:700; font-size:18px; text-align:center; margin-bottom:6px; color:${KW_INK};}
.kwsouvgrid{display:grid; grid-template-columns:repeat(3,1fr); gap:8px;}
.kwsouv{background:#fff; border:2px solid #BFE0F2; border-radius:16px; padding:6px 4px; display:flex; flex-direction:column; align-items:center; gap:2px; min-height:96px; justify-content:center;}
.kwsouv svg{width:72%; max-width:80px; height:auto;}
.kwsouv .nm{font-family:var(--font-disp); font-weight:700; font-size:12px; line-height:1.1; text-align:center;}
.kwsouv.locked{background:#F2F7FB; border-style:dashed;}
.kwsouv .q{font-family:var(--font-disp); font-weight:700; font-size:30px; color:#B8C8D8;}
.kwsouv.pop{animation:pop .6s ease 2;}
#overlay .box.kwletterbox{max-height:calc(100vh - 40px); overflow-y:auto;}
.kwallmail{text-align:left; width:100%;}
.kwallmail h3{font-family:var(--font-disp); margin:14px 0 4px; font-size:20px;}
.kwallmail .lbl{margin:8px 0 4px; font-size:12px; font-weight:800; color:var(--muted);}
.kwallmail .kwpaper{font-size:16px;}
.kwsouvrow{display:flex; align-items:center; gap:8px; font-size:13px; font-weight:700;}
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
  $('kwEnd').hidden=true;
  KR.seed=Math.floor(Math.random()*1e6)+1; KR.sx=KW_ST.x;
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
    kwSayLine(kwNoStarsLine()+open);
    setTimeout(()=>{ if(!KR||KR.id!==my) return; kwSuperSpeed(); }, 2000);
  } else {
    kwRenderStrip();
    const how = 'Wir starten bei '+(10*r)+'. Immer '+kwNum(r)+' zurück. Wohin segeln wir?';
    kwSay(kwNoStarsLine()+open+' '+how);
    setTimeout(()=>{ if(!KR||KR.id!==my) return; kwStep(); }, 1000);
  }
}
/* Kawumm sammelt keine Sterne mehr, nur Schätze (Entscheidung Simon, Paket B). Wer früher Kawumm-Sterne gesehen hat,
   hört das genau einmal in der Geschichte (Flag kw.noStarsSaid). Das alte Feld kw.stars bleibt liegen. */
function kwNoStarsLine(){
  const kw=kws(); if(kw.noStarsSaid || !(kw.stars>0)) return '';
  kw.noStarsSaid=true; save();
  return 'Übrigens: Echte Piraten sammeln keine Sterne. Wir sammeln nur Schätze! ';
}
/* Super-Speed: Kawumm überfliegt die ersten Stationen, die Zahlen leuchten dabei kurz auf */
function kwSuperSpeed(){
  const my=KR.id, r=KR.r, target=KR.plan.startK;
  kwBanner(KR.space?'Super-Speed!':'Rückenwind!',1500); sndWhoosh();
  const s=kwShip(); s.classList.remove('sway'); void s.offsetWidth; s.classList.add('zoom');
  let j=10;
  const tick=()=>{
    if(!KR||KR.id!==my) return;
    j--; KR.k=j; kwRenderStrip(true); pling();
    $('kwMap').style.backgroundPosition='0 '+((10-j)*-60)+'px';
    if(j>target) setTimeout(tick,340);
    else {
      kwRenderLayer();
      kwSayLine(kwPick(KR.space?KW_LINES.speed:KW_LINES.wind).replace('{n}',target*r));
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
/* Ruhige Fahrt (Entscheidung Simon): Das Schiff bleibt auf der Seite der gewählten Insel (KR.sx).
   Die Karte rollt nur senkrecht. Die nächste Inselreihe liegt schon darunter und taucht beim Fahren auf. */
const KW_DY=(KW_OPT_Y-KW_ST.y)*100;   // Abstand zweier Reihen in Prozent der Kartenhöhe
function kwRowHTML(opts, fx, dy, pending){
  return opts.map((v,i)=>'<button class="kwopt'+(pending?' kwnext':'')+'" data-i="'+i+'" style="left:'+(KW_OPT_X[i]*100)+'%;top:'+(KW_OPT_Y*100+dy)+'%" aria-label="'+v+'">'+kwStationHTML(v,false)+'</button>').join('')+kwFxHTML(fx, dy);
}
function kwRenderLayerAt(k, noOpts, pre){
  const L=$('kwLayer'), IN=$('kwLayerIn'); if(!L||!IN||!KR) return;
  L.style.transition='none'; L.style.transform='none';
  const r=KR.r, cur=k*r, sx=KR.sx==null?KW_ST.x:KR.sx;
  let h='<div class="kwst" style="left:'+(sx*100)+'%;top:'+(KW_ST.y*100)+'%">'+kwStationHTML(cur,false)+'</div>';
  KR.opts=[];
  if(!noOpts && k>=1){
    KR.opts = pre ? pre.opts : kwOptions(r,k);
    KR.fx = pre ? pre.fx : kwFxPick();
    h+=kwRowHTML(KR.opts, KR.fx, 0, false);
  }
  IN.innerHTML=h;
  kwPlaceShip(sx, KW_ST.y, false);       // im selben Bild wie das Zurücksetzen der Karte: kein Sprung
  IN.querySelectorAll('.kwopt').forEach(b=>b.addEventListener('click',()=>kwChoose(+b.dataset.i)));
  void L.offsetWidth; L.style.transition='';
}
function kwRenderLayer(pre){ kwRenderLayerAt(KR.k,false,pre); }
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
  if(correct){ sndGood(); kwSayLine(kwPick(['Kawumm! Aus dem Kopf gewusst!','Ha! Da staunt '+B.c.name+'!','Richtig! Und tschüss, '+B.c.name+'!'])); }
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
  if(correct){ KR.ok++; } else KR.clean=false;   // keine Kawumm-Sterne mehr, der Schatz ist die Belohnung (Entscheidung Simon)
  if(rt>KW_FAST) KR.clean=false;
  save();   // nicht in die Mal-Statistik (Aufgaben und Trefferquote) zählen; die Spielzeit läuft über trackScreen weiter
  return correct;
}
function kwChoose(i){
  if(!KR||KR.busy||KR.block) return;
  KR.busy=true;
  const rt=performance.now()-KR.t, ans=(KR.k-1)*KR.r, val=KR.opts[i];
  const correct=kwRecord(val, rt);
  const ai=KR.opts.indexOf(ans), btns=$('kwLayerIn').querySelectorAll('.kwopt');
  if(correct){
    sndGood();
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
    const IN=$('kwLayerIn'), btns=IN.querySelectorAll('.kwopt');
    btns.forEach((b,j)=>{ if(j!==ai) b.classList.add('gone'); });
    const last = KR.k-1===0, tx=KW_OPT_X[ai];
    let pre=null;
    if(!last){
      // nächste Reihe schon unten anlegen, sie taucht beim Fahren auf
      pre={opts:kwOptions(KR.r, KR.k-1), fx:kwFxPick()};
      IN.insertAdjacentHTML('beforeend', kwRowHTML(pre.opts, pre.fx, KW_DY, true));
      void IN.offsetWidth;
      IN.querySelectorAll('.kwnext').forEach(b=>b.classList.add('show'));
      // Karte rollt nur nach oben, gleichzeitig fährt das Schiff zur Insel
      const {h}=kwMapSize(), L=$('kwLayer');
      L.style.transform='translateY('+(-KW_DY/100*h)+'px)';
      const m=$('kwMap'), bp=(parseFloat((m.style.backgroundPosition||'0 0').split(' ')[1])||0)-(KW_DY/100*h);
      m.style.backgroundPosition='0 '+bp+'px';
    }
    kwPlaceShip(tx, KW_OPT_Y, true);
    setTimeout(()=>{
      if(!KR||KR.id!==my) return;
      KR.k--; KR.visited.push(KR.k); KR.sx=tx;
      kwRenderStrip();
      if(KR.k===0){ kwTreasure(ai); return; }
      kwRenderLayer(pre); kwStep();
    },1200);
  }, delay);
}
function kwTreasure(ai){
  const r=KR.r, rs=KR.rs, before=kwAvail();
  // die letzte Insel bekommt die Schatzkiste
  const btns=$('kwLayerIn').querySelectorAll('.kwopt'); if(btns[ai]) btns[ai].innerHTML=kwStationHTML(0,true);
  const wasDue=kwIsDue(rs, Date.now());
  const res=kwFinishRun(rs, {clean:KR.clean, errors:KR.steps-KR.ok, mode:KR.mode}, Date.now());
  bumpStreak(S,Date.now());
  // Kawumm auf Reisen: nur am Ende einer Fahrt entscheiden (nie mittendrin). Fahrten aus dem Elternbereich zählen nicht.
  const leaving = KW_LIVE && kws().joined && KR.ret!=='parent' && kwTripRunEnd(kws(), {fwdWork:lumiWorkLeft(S,Date.now()), today:todayStr(Date.now()), now:Date.now(), tip:kwTipLine(guideMode(S,false))});
  save();
  const after=kwAvail(), newRow=after.find(x=>!before.includes(x));
  const box=KW_BOX[r];
  bigKnall(); sndFanfare();
  let lines=[kwPick(KW_LINES.treasure)];
  const bn=kwBoxName(r, rs.level), last=(rs.level||0)>=KW_LEVELS-1;
  if(res.levelUp) lines.push('Kawumm! '+cap(artDet(r))+' '+kwBoxName(r,rs.level-1)+' war ganz voll und hat sich verwandelt! Daraus wurde '+(KW_GENUS[r]==='f'?'eine':'ein')+' '+bn+'! '+({m:'Den',f:'Die',n:'Das'}[KW_GENUS[r]])+' füllen wir auch noch!');
  else if(res.find) lines.push(res.full ? (cap(box.a)+'! Jetzt ist '+artDet(r)+' '+bn+' ganz voll. '+(last?'Mehr geht nicht! Du bist die Schatzkönigin!':'Pass auf, beim nächsten Schatz passiert etwas!')) : (cap(box.a)+' für '+artAcc(r)+' '+bn+'!'));
  else lines.push(cap(artNom(r))+' '+bn+' ist schon ganz voll. Du bist eine echte Schatzjägerin!');
  if(res.toSpace) lines.push('Du bist so gut! Bei der '+r+'er-Karte fliegen wir ab jetzt ins Weltall!');
  else if(res.review) lines.push(res.reviewOk ? 'Super! Du hast die '+r+'er-Karte nicht vergessen!' : 'Gut, dass wir nochmal gefahren sind! Bald fahren wir sie wieder.');
  else if(res.helpOff) lines.push('Ab jetzt zeigt die Karte die Zahlen nicht mehr vor. Du schaffst das auch so!');
  else if(res.helpBack) lines.push('Die Karte hilft dir wieder ein bisschen. Das ist ganz normal.');
  else if(rs.stage==='sea' && KR.mode==='sea1') lines.push('Schaffst du die Fahrt mit höchstens einem Fehler? Dann geht es ohne Hilfe weiter!');
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
      <div style="display:flex;align-items:center;gap:8px">${kwBoxSVG(r, rs.finds, 96, false, rs.level)}<b>${Math.min(rs.finds,KW_CAP)} / ${KW_CAP}</b></div>
      `+(leaving?'':`<div class="btnrow"><button class="kwbtn" id="kwEndVault">Schatzkammer</button><button class="kwbtn sec" id="kwEndAgain">Nochmal</button><button class="kwbtn sec" id="kwEndBack">Fertig</button></div>`);
    end.hidden=false;
    if(leaving){
      // Abschied: Kawumm wittert ein Abenteuer. Der Brief kommt, wenn sie fertig gesprochen hat. Kein Nochmal.
      const t0=Date.now();   // auch ohne Ton erst den Schatz zeigen, dann den Brief
      kwSay(lines.join(' ')+' Und jetzt hör mal! Ich hab dir einen Brief geschrieben.', ()=>setTimeout(()=>kwShowBye(), Math.max(800, 4500-(Date.now()-t0))));
      return;
    }
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
function kwOpenVault(ret, popRow, o){
  o=o||{};
  kwVaultRet=ret||'path';
  const kw=kws(), av=kwAvail();
  const total=KW_ORDER.reduce((s,r)=>s+(kw.rows[r]?(kw.rows[r].level||0)*KW_CAP+kw.rows[r].finds:0),0);
  const w=$('kwVault');
  let h='<div class="kwhead"><img src="'+KW_IMG+'" alt="Kawumm"><div class="bub" id="kwVaultBub"></div></div><div class="kwshelf">';
  for(const r of KW_ORDER){
    const rs=kw.rows[r], open=av.includes(r)||!!(rs&&rs.finds), n=rs?rs.finds:0, lv=rs?(rs.level||0):0;
    h+='<button class="kwslot'+(open?'':' locked')+(popRow===r?' pop':'')+'" data-r="'+r+'">'+kwBoxSVG(r,n,120,!open,lv)
      +'<span class="ct">'+(open?Math.min(n,KW_CAP)+' / '+KW_CAP:'')+'</span></button>';
  }
  h+='</div>';
  // Andenken von Kawumms Reisen: eigenes Regal (seit v64)
  h+='<div class="kwsouvshelf"><div class="kwsouvtitle">Andenken</div><div class="kwsouvgrid">';
  for(let i=0;i<KW_TRIP_N;i++){
    const have=kw.souvenirs.includes(i), T=KW_TRIPS[i];
    h+='<button class="kwsouv'+(have?'':' locked')+(o.popSouv===i?' pop':'')+'" data-souv="'+i+'">'+(have?kwSouvSVG(T.souv):'<span class="q">?</span>')+(have?'<span class="nm">'+T.souvName+'</span>':'')+'</button>';
  }
  h+='</div></div>';
  w.innerHTML=h;
  w.querySelectorAll('.kwsouv').forEach(b=>b.addEventListener('click',()=>{
    const i=+b.dataset.souv, T=KW_TRIPS[i], have=!b.classList.contains('locked');
    kwSay(have ? 'Das ist mein Andenken '+T.from+'! '+T.souvName+'.' : 'Hier kommt ein Andenken von meiner nächsten Reise hin!');
    b.classList.remove('pop'); void b.offsetWidth; b.classList.add('pop');
  }));
  if(o.popSouv!=null){ const el=w.querySelector('[data-souv="'+o.popSouv+'"]'); if(el) setTimeout(()=>el.scrollIntoView({block:'center',behavior:'smooth'}),400); }
  const hello = o.say ? o.say : total===0 ? 'Willkommen in meiner Schatzkammer! Noch ist alles leer. Finden wir Schätze?' : total>=KW_CAP*10 ? 'Alle Behälter sind voll! Du bist die beste Schatzjägerin der Welt!' : kwPick(['Meine Schatzkammer! Schon '+total+' Schätze. Tipp einen Behälter an!','Kawumm, so viele Schätze! Tipp einen an, dann erzähle ich dir was.']);
  $('kwVaultBub').textContent=hello;
  w.querySelectorAll('.kwslot').forEach(b=>b.addEventListener('click',()=>{
    const r=+b.dataset.r, rs=kw.rows[r], open=!b.classList.contains('locked');
    const lvx=rs?(rs.level||0):0, full=rs&&rs.finds>=KW_CAP;
    const t= open ? KW_BOX[r].line+' '+(full ? (lvx<KW_LEVELS-1?'Ganz voll! Beim nächsten Schatz verwandelt es sich!':'Ganz voll und ganz besonders!') : 'Noch '+(KW_CAP-((rs&&rs.finds)||0))+' Schätze passen hinein.') : 'Das ist noch geheim. Erst brauchen wir die '+r+'er-Schatzkarte!';
    $('kwVaultBub').textContent=t; kwSay(t); b.classList.remove('pop'); void b.offsetWidth; b.classList.add('pop');
  }));
  show('vault');
  kwSay(hello);
}

/* ---------- Einhänger für Insel und Karte ---------- */
function kwIslandCard(r){
  const el=$('islKw'); if(!el) return;
  if(!kwActive()||kwIsAway()){ el.innerHTML=''; el.hidden=true; return; }   // unterwegs: keine Schatzkarte auf der Insel
  el.hidden=false;
  const kw=kws(), av=kwAvail(), rs=kw.rows[r];
  if(av.includes(r)){
    const space=rs&&rs.stage==='space', due=kwIsDue(rs,Date.now());
    el.innerHTML='<div class="kwcard"><img src="'+KW_IMG+'" alt=""><div class="tx"><b>'+(due?'Schatz wartet!':'Schatzkarte')+'</b>'+(space?'🚀':'⛵')+' '+r+' · '+(r*10)+' … 0</div><button class="kwbtn" id="kwIslGo">Los!</button></div>';
    $('kwIslGo').onclick=()=>kwStart(r,'island');
    kwArm(el);
  } else {
    const i=KW_ORDER.indexOf(r), prev=KW_ORDER[i-1], ps=kw.rows[prev];
    const prevOk=!!(ps&&ps.stage==='space'), have=Math.round(kwFwd(r)*10);
    const need=[]; if(!prevOk) need.push('die '+prev+'er-Schatzkarte im Meer schaffen'); if(have<5) need.push('hier '+(5-have)+' lila '+(5-have===1?'Stern':'Sterne')+' mehr sammeln');
    el.innerHTML='<div class="kwcard wait"><img src="'+KW_IMG+'" alt=""><div class="tx"><b>Schatzkarte 🔒</b></div></div>';
    el.querySelector('.kwcard').onclick=()=>kwSay('Hier liegt auch ein Schatz! Erst '+need.join(' und ')+'.');
  }
}
function kwMapCard(list){
  if(!kwActive()) return;
  if(kwIsAway()){ kwAwayCard(list); return; }
  const av=kwAvail(), open=unlockedRows(S);
  const loose=av.filter(r=>!open.includes(r));     // Karte ohne offene Insel (z. B. die Einser zu Beginn)
  const d=document.createElement('div'); d.className='kwcard kwmapcard';
  const due=kwDueRows();
  const dueIsl=due.filter(r=>open.includes(r)), dueShip=due.filter(r=>!open.includes(r));
  const dueLine = dueIsl.length ? 'Auf der '+dueIsl.map(r=>r+'er').join(' und der ')+'-Insel wartet noch ein Schatz!' : dueShip.length ? 'Hier am Schiff wartet noch ein Schatz! Die '+dueShip[0]+'er-Karte.' : '';
  const dueTxt = dueLine ? ' '+dueLine : '';
  d.innerHTML='<img src="'+KW_IMG+'" alt=""><div class="tx"><b>Kawumms Schiff</b></div><div class="btns">'
    +loose.map(r=>'<button class="kwbtn" data-kwr="'+r+'">⛵ '+r+' · '+(r*10)+' … 0'+(due.includes(r)?' ★':'')+'</button>').join('')
    +'<button class="kwbtn sec" id="kwMapVault">Schatzkammer</button></div>';
  list.appendChild(d);
  kwArm(d);
  // einmal pro App-Start erinnern, wenn ein alter Schatz wartet
  if(due.length && !kwDueSaid){ kwDueSaid=true; setTimeout(()=>{ if(current==='path') kwSay('Ahoi! '+dueLine+' Weißt du die Karte noch?'); },1200); }
  d.querySelectorAll('[data-kwr]').forEach(b=>b.addEventListener('click',()=>kwStart(+b.dataset.kwr,'path')));
  d.querySelector('#kwMapVault').addEventListener('click',()=>kwOpenVault('path'));
}
function kwDueRows(){ const kw=kws(), now=Date.now(); if(kwAway(kw)) return []; return kwAvail().filter(r=>kwIsDue(kw.rows[r],now)); }   // unterwegs pausiert die Wiederholung
function kwMapBadge(r){ if(!kwActive()||kwIsAway()||!kwAvail().includes(r)) return ''; return kwDueRows().includes(r) ? '<span class="kwbadge due">Schatz wartet!</span>' : '<span class="kwbadge">Schatzkarte</span>'; }

/* ---------- Brief: Kawumm fragt, ob sie kommen darf ---------- */
/* Briefumschlag (Brief-Optik für alle Briefe) */
const KW_ENV=`<div class="kwenv" id="kwEnv"><svg viewBox="0 0 220 150" aria-hidden="true">
      <rect x="6" y="10" width="208" height="134" rx="12" fill="#F6E7C1" stroke="${KW_INK}" stroke-width="4"/>
      <path d="M6 140 L90 76 M214 140 L130 76" stroke="#D9B77A" stroke-width="4"/>
      <path class="flap" d="M8 12 L110 92 L212 12 Z" fill="#EBD3A0" stroke="${KW_INK}" stroke-width="4" stroke-linejoin="round"/>
      <circle cx="110" cy="88" r="16" fill="#E04A40" stroke="${KW_INK}" stroke-width="3"/>
      <circle cx="110" cy="85" r="6" fill="#fff"/><path d="M103 94 l14 -6 M103 88 l14 6" stroke="#fff" stroke-width="2.4" stroke-linecap="round"/>
    </svg></div>`;
/* Der allererste Brief (Einladung). Liegt auch im Briefkasten. */
function kwInviteText(name){
  return {head:'AHOI '+name+'!', lines:['Rate mal, wer schreibt. Genau. ICH!','Du rettest mit Lumi die Inseln? Ohne mich?! Frechheit!','Ich hab Schatzkarten. Total verrückte. Die liest man rückwärts. Wie ein Krebs!','Lumi zählt immer nur vorwärts. Gähn!','Ich wette, du kannst rückwärts. Darf ich kommen? Ich bring Kekse mit. Vielleicht.'], ps:'Sagst du Nein, schick ich dir eine Möwe.'};
}
function kwPaperHTML(x){
  return (x.liese?'<img class="kwliese" src="'+KW_LIESE+'" alt="Liese">':'')+'<b>'+x.head+'</b><br>'+x.lines.join('<br>')+'<div class="sig"><b>KAWUMM!</b> <img src="'+KW_IMG+'" alt=""></div>'+(x.ps?'<div class="ps">PS: '+x.ps+'</div>':'');
}
function kwShowLetter(fromParent){
  const name=S.name||'Romy';
  const box=$('overlayBox');
  box.classList.add('kwletterbox');
  box.innerHTML=`<h2>Post für ${name}!</h2>
    ${KW_ENV}
    <div class="kwpaper" id="kwPaper">${kwPaperHTML(kwInviteText(name))}</div>
    <button class="cta kwyes" id="kwYes" data-noarm>Ja, komm vorbei!</button>`;
  $('overlay').classList.add('show');
  [523,659,523,784].forEach((f,i)=>tone(f,.14,i*0.12,'triangle',.08));
  speak('Post für '+name+'!');
  let shown=false;
  setTimeout(()=>showYes(), KW_READ_MS);
  const showYes=()=>{ if(shown) return; shown=true; $('kwYes').classList.add('show'); };
  setTimeout(()=>{
    $('kwEnv').classList.add('open');
    setTimeout(()=>{ $('kwEnv').classList.add('away'); const p=$('kwPaper'); p.classList.add('show'); void p.offsetWidth; p.classList.add('in');
      // Den Brief liest Romy selbst. Nichts vorlesen, der Knopf kommt nach Lesezeit.
    },950);
  },1700);
  $('kwYes').onclick=()=>{ kws().joined=true; save(); kwWelcome(fromParent); };
}
function kwWelcome(fromParent){
  const box=$('overlayBox'), name=S.name||'Romy';
  box.innerHTML='<h2>Kawumm ist da!</h2>'+kwDuoHTML(150)
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
  kwSay(t);
  setTimeout(()=>{ card.classList.remove('hi'); },9000);
}
function kwMaybeLetter(){
  if(!KW_LIVE) return;
  if(!kws().joined){ setTimeout(()=>kwShowLetter(false), 800); return; }
  setTimeout(()=>kwStartMail(0), 800);       // Kawumm auf Reisen: Reisebrief oder Rückkehr beim App-Start
}

/* =====================================================================
   Kawumm auf Reisen (seit v64). Logik oben im KW-LOGIC-Block (kwTrip...), Texte in KW_TRIPS.
   Briefe werden nie vorgelesen (Romy liest selbst). Höchstens ein Brief pro Tag, nie mitten im Spiel.
   ===================================================================== */
const KW_GAME_SCREENS=['practice','run','ride','blitz','kw'];
function kwOverlayBusy(){ return $('overlay').classList.contains('show'); }
function kwToday(){ return todayStr(Date.now()); }
/* Ein Brief aus kw.mail (oder 'invite') im Briefumschlag. o.reread: aus dem Briefkasten (ohne Umschlag), o.quiet: nichts sagen */
function kwShowMail(m, o){
  o=o||{};
  const name=S.name||'Romy', x = m==='invite' ? kwInviteText(name) : kwMailText(m,name);
  if(!x) return;
  if(m!=='invite' && !m.read){ m.read=true; save(); }
  const box=$('overlayBox');
  box.classList.add('kwletterbox');
  const label = o.btn || (o.reread ? 'Fertig' : m.k==='bye' ? 'Tschüss, Kawumm!' : m.k==='back' ? 'Hallo, Kawumm!' : 'Danke, Kawumm!');
  box.innerHTML=(o.reread ? '' : '<h2>Post für '+name+'!</h2>'+KW_ENV)
    +'<div class="kwpaper'+(o.reread?' show in':'')+'" id="kwPaper">'+kwPaperHTML(x)+'</div>'
    +'<button class="cta kwyes" id="kwMailOk" data-noarm>'+label+'</button>';
  $('overlay').classList.add('show');
  let shown=false; const showBtn=()=>{ if(shown) return; shown=true; const b=$('kwMailOk'); if(b) b.classList.add('show'); };
  if(o.reread){ setTimeout(showBtn, 1500); }
  else {
    [523,659,523,784].forEach((f,i)=>tone(f,.14,i*0.12,'triangle',.08));
    if(!o.quiet) speak('Post für '+name+'!');
    setTimeout(showBtn, KW_READ_MS);
    setTimeout(()=>{ const e=$('kwEnv'); if(!e) return; e.classList.add('open');
      setTimeout(()=>{ const e2=$('kwEnv'), p=$('kwPaper'); if(!e2||!p) return; e2.classList.add('away'); p.classList.add('show'); void p.offsetWidth; p.classList.add('in'); },950);
    },1700);
  }
  $('kwMailOk').onclick=()=>{
    $('overlay').classList.remove('show'); box.classList.remove('kwletterbox');
    kwMailBtn();
    if(o.onClose) o.onClose();
  };
}
/* Abschied am Ende einer Fahrt: Brief, danach zurück zur Startseite (dort zeigt der Wegweiser, was bei Lumi hilft) */
function kwShowBye(o){
  o=o||{};
  const kw=kws(), m=[...kw.mail].reverse().find(x=>x.k==='bye'); if(!m) return;
  if(kwOverlayBusy()) return;                                  // Brief liegt dann ungelesen im Briefkasten
  if(!o.parent && KW_GAME_SCREENS.includes(current) && current!=='kw') return;
  kwShowMail(m, {quiet:true, onClose:()=>{
    if(o.parent){ renderParent(); show('parent'); return; }
    kwStop(); show('home');
    setTimeout(()=>kwSay('Tschüss! Bis bald! Kawumm!'), 600);
  }});
}
/* App-Start nach dem Intro: Rückkehr oder Reisebrief */
function kwStartMail(tries){
  const kw=kws(), due=kwTripStartDue(kw, S.days, kwToday());
  if(!due) return;
  if(kwOverlayBusy() || current!=='home'){ if(tries<6) setTimeout(()=>kwStartMail(tries+1),1500); return; }
  if(due==='back') kwComeBack();
  else { const m=kwTripSendTravel(kw, kwToday()); save(); kwShowMail(m); }
}
/* Rundenende bei Lumi (show('end')): Runde zählen, nach 3 bis 6 Runden kann ein Reisebrief kommen */
function kwRoundEnd(){
  if(!KW_LIVE || !kws().joined || !kwIsAway()) return;
  kwTripRound(kws()); save();
  kwRoundTry(0);
}
function kwRoundTry(tries){
  setTimeout(()=>{
    if(current!=='end') return;                                  // weitergespielt: Brief wartet auf das nächste Rundenende
    const kw=kws(); if(!kwTripRoundDue(kw, kwToday())) return;
    if(kwOverlayBusy()){ if(tries<8) kwRoundTry(tries+1); return; }   // erst Geschenk oder Inselfest zu Ende
    const m=kwTripSendTravel(kw, kwToday()); save(); kwShowMail(m);
  }, tries?1200:3500);
}
/* Rückkehr: Brief, dann spricht Kawumm und zeigt ihr Andenken in der Schatzkammer */
function kwComeBack(o){
  o=o||{};
  const kw=kws(), m=kwTripReturn(kw, kwToday(), Date.now()); save();
  const T=KW_TRIPS[m.t], name=S.name||'Romy';
  kwShowMail(m, {onClose:()=>{
    bigKnall(); sndFanfare();
    kwOpenVault(o.parent?'parent':'path', null, {popSouv:m.t, say:'Kawumm! Da bin ich wieder, '+name+'! Schau mal, mein Andenken '+T.from+': '+T.souvName+'! Es steht jetzt in der Schatzkammer.'});
  }});
}
/* Inselwelt, während Kawumm unterwegs ist: leerer Anleger mit Flaschenpost, nur der Briefkasten */
let kwAwaySaid=false;
function kwAwayCard(list){
  const d=document.createElement('div'); d.className='kwcard kwmapcard kwawaycard';
  d.innerHTML='<div class="kwdock">'+KW_DOCK_SVG+'</div><div class="tx"><b>Kawumms Anleger</b></div><div class="btns"><button class="kwbtn sec kwmailmini" id="kwMapMail" aria-label="Briefkasten">📬</button></div>';
  list.appendChild(d);
  d.querySelector('#kwMapMail').addEventListener('click',e=>{ e.stopPropagation(); kwShowMailbox(); });
  const line='Kawumm ist auf Reisen. Sie schreibt dir Briefe. Und sie kommt wieder!';
  d.addEventListener('click',()=>speak(line));
  if(!kwAwaySaid){ kwAwaySaid=true; setTimeout(()=>{ if(current==='path' && !kwOverlayBusy()) speak(line); },1200); }
}
/* Briefkasten auf der Startseite: alle Briefe zum Nochmal-Lesen, ungelesene mit Abzeichen */
function kwMailBtn(){
  const b=$('btnMail'); if(!b) return;
  const on=kwActive() && kws().joined;
  b.hidden=!on; if(!on) return;
  const n=kws().mail.filter(m=>!m.read).length, badge=b.querySelector('.kwmailbadge');
  if(badge){ badge.textContent=n; badge.hidden=!n; }
}
const KW_MAIL_ICON={bye:'👋', travel:'✉️', back:'🎁'};
function kwShowMailbox(o){
  o=o||{};
  const kw=kws(), box=$('overlayBox');
  box.classList.add('kwletterbox');
  const items=kw.mail.map((m,i)=>({m,i})).reverse();
  let h='<h2>Briefkasten</h2><div class="kwmails">';
  for(const {m,i} of items){
    const T=KW_TRIPS[m.t]; if(!T) continue;
    h+='<button class="kwmailitem'+(m.read?'':' new')+'" data-mi="'+i+'"><span class="ic">'+KW_MAIL_ICON[m.k]+'</span><span class="pl">'+T.place+'</span>'+(m.read?'':'<i class="dot"></i>')+'</button>';
  }
  if(kw.joined) h+='<button class="kwmailitem" data-mi="invite"><span class="ic">⭐</span><span class="pl">Kawumm</span></button>';
  h+='</div><button class="cta" id="kwMailClose">Fertig</button>';
  box.innerHTML=h;
  $('overlay').classList.add('show');
  box.querySelectorAll('[data-mi]').forEach(b=>b.addEventListener('click',()=>{
    const v=b.dataset.mi, m = v==='invite' ? 'invite' : kw.mail[+v];
    kwShowMail(m, {reread:true, onClose:()=>kwShowMailbox(o)});
  }));
  $('kwMailClose').onclick=()=>{ $('overlay').classList.remove('show'); box.classList.remove('kwletterbox'); kwMailBtn(); if(o.onClose) o.onClose(); };
}
/* ---------- Andenken (100x100, Stil wie die Behälter) ---------- */
function kwStarD(x,y,r,ri){ let d=''; for(let i=0;i<10;i++){ const rr=i%2?r*(ri||0.5):r, a=i*Math.PI/5-Math.PI/2; d+=(i?'L':'M')+(x+Math.cos(a)*rr).toFixed(1)+' '+(y+Math.sin(a)*rr).toFixed(1); } return d+'Z'; }
const KW_SOUV={
  jelly:()=>`<rect x="24" y="20" width="52" height="12" rx="4" fill="#E04A40" stroke="${KW_INK}" stroke-width="3"/>
    <path d="M31 70 Q40 64 50 70 Q60 76 69 70 V84 Q69 89 64 89 H36 Q31 89 31 84 Z" fill="#F96D6D"/>
    <path d="M31 56 Q40 50 50 56 Q60 62 69 56 V70 Q60 76 50 70 Q40 64 31 70 Z" fill="#F2B83C"/>
    <path d="M31 44 Q40 38 50 44 Q60 50 69 44 V56 Q60 62 50 56 Q40 50 31 56 Z" fill="#8EDB6E"/>
    <path d="M28 32 H72 V84 Q72 92 64 92 H36 Q28 92 28 84 Z" fill="#E8F4FD" fill-opacity=".35" stroke="${KW_INK}" stroke-width="3"/>
    <path d="M35 40 V82" stroke="#fff" stroke-width="3" opacity=".7" stroke-linecap="round"/>
    <path d="M78 52 q5 4 0 8 M84 48 q5 6 0 12" stroke="${KW_INK}" stroke-width="2" fill="none" stroke-linecap="round"/>`,
  feather:()=>`<path d="M30 86 Q34 50 70 14 Q82 30 66 52 Q56 70 30 86 Z" fill="#F8A8D0" stroke="${KW_INK}" stroke-width="3" stroke-linejoin="round"/>
    <path d="M30 86 Q46 56 68 20" stroke="${KW_INK}" stroke-width="2" fill="none"/>
    <path d="M44 66 l-6 -7 M50 56 l-6 -8 M56 46 l-4 -8 M48 70 l9 -2 M54 60 l9 -3 M60 50 l8 -4" stroke="#E58AB8" stroke-width="2.2" stroke-linecap="round"/>
    <path d="M30 86 L22 95" stroke="${KW_INK}" stroke-width="3" stroke-linecap="round"/>
    <path d="M76 62 q4 3 0 6 M82 55 q5 4 0 8" stroke="${KW_INK}" stroke-width="2" fill="none" stroke-linecap="round"/>`,
  snail:()=>`<circle cx="50" cy="56" r="32" fill="#F6D98B" stroke="${KW_INK}" stroke-width="3"/>
    <path d="M50 56 q8 -2 8 -10 q0 -12 -14 -12 q-18 0 -18 18 q0 22 24 22 q26 0 28 -26" fill="none" stroke="#C98A4E" stroke-width="4" stroke-linecap="round"/>
    ${kwStar(20,24,7,'#FFE27A')}${kwStar(82,22,6,'#FFE27A')}${kwStar(86,84,5,'#FFE27A')}<circle cx="34" cy="80" r="2.4" fill="#fff"/><circle cx="64" cy="34" r="2" fill="#fff"/>`,
  cookie:()=>`<circle cx="50" cy="52" r="42" fill="#FFF3B0" opacity=".6"/>
    <path d="${kwStarD(50,54,40,0.5)}" fill="#E9B96E" stroke="${KW_INK}" stroke-width="3" stroke-linejoin="round"/>
    <circle cx="50" cy="16" r="7" fill="#FFF8EC"/>
    <g fill="#F96D9B"><circle cx="44" cy="50" r="2.6"/><circle cx="58" cy="60" r="2.6"/></g><g fill="#58A6F0"><circle cx="54" cy="44" r="2.6"/><circle cx="40" cy="64" r="2.6"/></g><g fill="#8EDB6E"><circle cx="62" cy="50" r="2.4"/><circle cx="50" cy="68" r="2.4"/></g>`,
  shell:()=>`<path d="M50 90 L14 44 Q20 18 50 14 Q80 18 86 44 Z" fill="#F8C7DF" stroke="${KW_INK}" stroke-width="3" stroke-linejoin="round"/>
    <path d="M22 38 Q50 20 78 38" stroke="#F96D6D" stroke-width="4" fill="none"/><path d="M28 50 Q50 34 72 50" stroke="#F2B83C" stroke-width="4" fill="none"/><path d="M34 62 Q50 50 66 62" stroke="#8EDB6E" stroke-width="4" fill="none"/><path d="M40 73 Q50 66 60 73" stroke="#58A6F0" stroke-width="4" fill="none"/>
    <path d="M50 90 L30 22 M50 90 L50 14 M50 90 L70 22" stroke="${KW_INK}" stroke-width="1.6" opacity=".45"/>
    <rect x="40" y="84" width="20" height="9" rx="3" fill="#F8C7DF" stroke="${KW_INK}" stroke-width="3"/>${kwStar(86,16,6,'#FFE27A')}${kwStar(14,20,5,'#FFE27A')}`,
  button:()=>`<circle cx="50" cy="52" r="38" fill="#58A6F0" stroke="${KW_INK}" stroke-width="3"/><circle cx="50" cy="52" r="28" fill="none" stroke="#3E86D0" stroke-width="3"/>
    <path d="M42 44 L58 60 M58 44 L42 60" stroke="#fff" stroke-width="3" stroke-linecap="round"/>
    <g fill="#2A2150"><circle cx="42" cy="44" r="5"/><circle cx="58" cy="44" r="5"/><circle cx="42" cy="60" r="5"/><circle cx="58" cy="60" r="5"/></g>
    <path d="M24 38 Q30 24 44 20" stroke="#fff" stroke-width="3" fill="none" opacity=".7" stroke-linecap="round"/>`,
  egg:()=>`<path d="M50 12 Q78 14 80 58 Q80 90 50 90 Q20 90 20 58 Q22 14 50 12 Z" fill="#8A5530" stroke="${KW_INK}" stroke-width="3"/>
    <path d="M21 56 l8 -6 8 6 8 -6 8 6 8 -6 8 6 8 -6 6 4" stroke="#F2B83C" stroke-width="4" fill="none" stroke-linejoin="round"/>
    <g><circle cx="38" cy="32" r="4" fill="#F96D9B"/><circle cx="60" cy="28" r="3.5" fill="#8EDB6E"/><circle cx="50" cy="40" r="3" fill="#58A6F0"/><circle cx="36" cy="72" r="4" fill="#8EDB6E"/><circle cx="62" cy="74" r="4" fill="#F96D9B"/><circle cx="50" cy="80" r="3" fill="#FFE27A"/></g>
    <path d="M32 24 Q38 16 46 15" stroke="#C98A4E" stroke-width="3" fill="none" stroke-linecap="round"/>`,
  sock:()=>`<path d="M38 14 H64 V56 Q64 62 70 66 L82 74 Q90 80 84 88 Q78 94 68 88 L40 72 Q34 68 36 60 Z" fill="#B493F0" stroke="${KW_INK}" stroke-width="3" stroke-linejoin="round"/>
    <path d="M37 28 H64 M37 40 H64 M37 52 H64" stroke="#FFE27A" stroke-width="5"/>
    <rect x="34" y="8" width="34" height="11" rx="4" fill="#fff" stroke="${KW_INK}" stroke-width="3"/>
    <path d="M70 78 Q76 84 82 82" stroke="#fff" stroke-width="3" fill="none" opacity=".6" stroke-linecap="round"/>${kwStar(20,30,6,'#FFE27A')}${kwStar(84,40,5,'#FFE27A')}${kwStar(18,74,4,'#FFE27A')}`,
  candy:()=>`<path d="M28 50 L8 36 L12 50 L8 64 Z M72 50 L92 36 L88 50 L92 64 Z" fill="#F96D9B" stroke="${KW_INK}" stroke-width="3" stroke-linejoin="round"/>
    <circle cx="50" cy="50" r="26" fill="#F96D9B" stroke="${KW_INK}" stroke-width="3"/>
    <path d="M34 50 a16 16 0 0 1 32 0 a12 12 0 0 1 -24 0 a8 8 0 0 1 16 0" stroke="#fff" stroke-width="4" fill="none" stroke-linecap="round"/>`
};
function kwSouvSVG(key, size){ return '<svg viewBox="0 0 100 100" width="'+(size||80)+'" height="'+(size||80)+'" class="kwsouvsvg" aria-hidden="true">'+(KW_SOUV[key]?KW_SOUV[key]():'')+'</svg>'; }
const KW_DOCK_SVG=`<svg viewBox="0 0 120 80" aria-hidden="true">
  <rect x="0" y="48" width="120" height="32" rx="12" fill="#9ED3EA"/>
  <path d="M6 62 q8 -5 16 0 t16 0 M58 72 q8 -5 16 0 t16 0" stroke="#fff" stroke-width="2.4" fill="none" stroke-linecap="round" opacity=".8"/>
  <path d="M18 44 V66 M42 44 V66 M66 44 V66" stroke="#8A5530" stroke-width="5" stroke-linecap="round"/>
  <rect x="8" y="36" width="68" height="9" rx="2" fill="#C98A4E" stroke="${KW_INK}" stroke-width="2.4"/>
  <path d="M28 36 V45 M48 36 V45" stroke="#A06A36" stroke-width="1.6"/>
  <rect x="70" y="22" width="9" height="22" rx="2" fill="#A0663A" stroke="${KW_INK}" stroke-width="2.4"/>
  <path d="M75 30 q12 6 16 24" stroke="#EBCB94" stroke-width="2.4" fill="none" stroke-linecap="round"/>
  <g class="kwbottle"><g transform="translate(96 56) rotate(-18)"><rect x="-8" y="-5" width="18" height="11" rx="5" fill="#BFE7F7" stroke="${KW_INK}" stroke-width="2"/><rect x="9" y="-2.5" width="6" height="6" rx="1" fill="#BFE7F7" stroke="${KW_INK}" stroke-width="2"/><rect x="14" y="-2.5" width="3.5" height="6" rx="1" fill="#A0663A"/><rect x="-4" y="-2" width="10" height="5" rx="1" fill="#FFF8EC" stroke="#E2C795" stroke-width="1"/></g></g>
</svg>`;
/* ---------- Elternbereich: Reisen ---------- */
function kwTripParentHTML(){
  const kw=kws(), t=kw.trip;
  let st;
  if(t.state==='away'){
    const T=KW_TRIPS[t.idx], pd=kwPlayDays(S.days, t.leftDay);
    const nx = !t.next ? 'keiner mehr geplant' : t.next.when==='start' ? 'beim App-Start' : 'am Rundenende nach '+t.next.rounds+' Lumi-Runden (bisher '+t.roundsSince+')';
    st='<b>Unterwegs:</b> '+T.place+' (Reise '+(t.idx+1)+' von '+KW_TRIP_N+', abgeflogen '+t.leftDay+'). Spieltage seit Abflug: <b>'+pd+' von '+t.needDays+'</b>'+(pd>=t.needDays?' (Rückkehr beim nächsten App-Start, sobald ein Reisebrief da war)':' (noch '+(t.needDays-pd)+')')+'. Reisebriefe: '+t.sent+' von '+t.plan+'. Nächster Brief: '+nx+'. Letzter Brief: '+(t.lastLetterDay||'nie')+'. Fällige Schatzkarten pausieren.';
  } else {
    st='<b>Zuhause.</b> Fahrten seit Rückkehr bzw. Start: <b>'+t.runsSince+'</b>, Abflug frühestens nach '+t.nextAfter+' Fahrten und nur, wenn es bei Lumi vorwärts etwas zu tun gibt (gerade: '+(lumiWorkLeft(S,Date.now())?'ja':'nein')+'). Reisen bisher: '+t.count+'.';
  }
  return '<h3 style="margin:10px 0 2px;font-size:16px">Kawumm auf Reisen</h3><p style="margin:2px 0;font-size:13px">'+st+'</p>'
    +'<div class="btnrow" style="justify-content:flex-start"><button class="smallbtn" id="kwTripGo">Reise jetzt starten</button><button class="smallbtn" id="kwTripMail">Nächsten Brief jetzt</button><button class="smallbtn" id="kwTripBack">Zurückkommen lassen</button><button class="smallbtn" id="kwTripAll">Alle Reisebriefe ansehen</button><button class="smallbtn" id="kwTripBox">Briefkasten</button></div>';
}
function kwTripParentWire(){
  const kw=kws(), msg=t=>{ const e=$('kwMsg'); if(e) e.textContent=t; }, back=()=>{ renderParent(); show('parent'); };
  $('kwTripGo').onclick=()=>{
    if(!kw.joined){ msg('Erst muss der Brief angenommen sein.'); return; }
    if(kwAway(kw)){ msg('Kawumm ist schon unterwegs.'); return; }
    kwTripDepart(kw, kwToday(), Date.now(), Math.random, kwTipLine(guideMode(S,false))); save();
    kwShowBye({parent:true});
  };
  $('kwTripMail').onclick=()=>{
    if(!kwAway(kw)){ msg('Kawumm ist zuhause. Erst eine Reise starten.'); return; }
    if(kw.trip.sent<kw.trip.plan){ const m=kwTripSendTravel(kw, kwToday()); save(); kwShowMail(m,{onClose:back}); }
    else kwComeBack({parent:true});
  };
  $('kwTripBack').onclick=()=>{ if(!kwAway(kw)){ msg('Kawumm ist schon zuhause.'); return; } kwComeBack({parent:true}); };
  $('kwTripBox').onclick=()=>kwShowMailbox();
  $('kwTripAll').onclick=()=>{
    const name=S.name||'Romy', tip=kwTipLine(guideMode(S,false)), box=$('overlayBox');
    let h='<h2>Alle Reisebriefe</h2><div class="kwallmail">';
    KW_TRIPS.forEach((T,i)=>{
      h+='<h3>Reise '+(i+1)+': '+T.place+'</h3><div class="kwsouvrow">'+kwSouvSVG(T.souv,56)+'<span>Andenken: '+T.souvName+'</span></div>';
      [{t:i,k:'bye',tip},{t:i,k:'travel',n:0},{t:i,k:'travel',n:1},{t:i,k:'back'}].forEach((m,j)=>{
        h+='<p class="lbl">'+['Abschied (Tipp je nach Lernstand)','Reisebrief 1 (kommt immer)','Reisebrief 2 (nur manchmal)','Rückkehr'][j]+'</p><div class="kwpaper show in">'+kwPaperHTML(kwMailText(m,name))+'</div>';
      });
    });
    h+='</div><button class="cta" id="kwAllClose">Fertig</button>';
    box.classList.add('kwletterbox'); box.innerHTML=h; $('overlay').classList.add('show');
    $('kwAllClose').onclick=()=>{ $('overlay').classList.remove('show'); box.classList.remove('kwletterbox'); };
  };
}

/* ---------- Elternbereich: testen, bevor es live ist ---------- */
function kwParentHTML(){
  const kw=kws(), av=kwAvail();
  let rows='';
  for(const r of KW_ORDER){
    const rs=kw.rows[r], a=av.includes(r);
    const dueIn=kwDueIn(rs,Date.now()), stg=a?(rs&&rs.stage==='space'?'Weltall'+(kwAway(kw)?' · pausiert (Reise)':dueIn===0?' · fällig':dueIn!==null?' · in '+dueIn+' T':''):(rs&&kwHelpOff(rs)?'Meer ohne Hilfe':'Meer')):'zu';
    rows+='<tr><td>'+r+'er</td><td>'+stg+'</td><td>'+(rs?kwRowSafe(rs)+' / 10':'–')+'</td><td>'+(rs?rs.finds+((rs.level||0)?' (Stufe '+((rs.level||0)+1)+')':''):0)+'</td><td>'+(rs?rs.runs:0)+'</td><td>'+(a?'<button class="smallbtn" data-kwgo="'+r+'">Starten</button> <button class="smallbtn" data-kwst="'+r+'">'+(rs&&rs.stage==='space'?'→ Meer':'→ Weltall')+'</button>'+(rs&&rs.stage==='space'?' <button class="smallbtn" data-kwdue="'+r+'">fällig machen</button>':''):'')+'</td></tr>';
  }
  return '<p style="margin:2px 0;font-size:13px;color:var(--muted)">'+(KW_LIVE?'Live: Romy sieht Kawumm, sobald der Brief angenommen ist.':'Noch nicht live: Romy sieht davon nichts. Testmodus gilt nur bis zum Neustart der App.')+' Brief angenommen: <b>'+(kw.joined?'ja':'nein')+'</b>.</p>'
    +'<div class="setrow"><label>Testmodus (Kawumm auf Inseln und Karte zeigen)</label><button class="toggle'+(kwTest?' on':'')+'" id="kwTestTgl" role="switch" aria-checked="'+kwTest+'" aria-label="Testmodus"><i></i></button></div>'
    +'<div class="btnrow" style="justify-content:flex-start"><button class="smallbtn" id="kwLetterBtn">Brief ansehen</button><button class="smallbtn" id="kwVaultBtn">Schatzkammer öffnen</button><button class="smallbtn" id="kwVoiceBtn">Kawumms Stimme</button><button class="smallbtn" id="kwLetterReset">Brief zurücksetzen</button><button class="smallbtn danger" id="kwReset">Kawumm-Stand löschen</button></div>'
    +'<table class="kwtable"><tr><th>Reihe</th><th>Stufe</th><th>sicher</th><th>Schätze</th><th>Fahrten</th><th></th></tr>'+rows+'</table>'
    +'<p style="margin:4px 0;font-size:12px;color:var(--muted)">Meer mit Hilfe: Fahrt mit höchstens 1 Fehler, dann ohne Hilfe. Ins Weltall: 2 Fahrten am Stück ohne Hilfe, ohne Fehler, alle Antworten unter 4 s. Neue Karte kommt, wenn die Karte davor im Weltall ist und die eigene Vorwärtsreihe 5 von 10 lila Sterne hat. Weltall-Karten kommen zur Wiederholung nach 2, 4, 8, 16, 30 Tagen.</p>'
    +kwTripParentHTML()
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
  document.querySelectorAll('[data-kwdue]').forEach(x=>x.onclick=()=>{ const rs=kw.rows[+x.dataset.kwdue]; rs.last=Date.now()-31*86400000; save(); renderParent(); });
  kwTripParentWire();
  document.querySelectorAll('[data-kwst]').forEach(b=>b.onclick=()=>{ const rs=kwRowState(kw,+b.dataset.kwst); rs.stage=rs.stage==='space'?'sea':'space'; rs.clean=0; rs.helpOff=rs.stage==='space'; rs.last=Date.now(); rs.reviews=0; save(); renderParent(); });
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

window.KW={setup:kwSetup, islandCard:kwIslandCard, mapCard:kwMapCard, badge:kwMapBadge, maybeLetter:kwMaybeLetter, parentHTML:kwParentHTML, parentWire:kwParentWire, stop:kwStop, active:kwActive,
  dueRows:kwDueRows, voice:KW_VOICE, img:KW_IMG, say:kwSay,   // dueRows: Wegweiser; voice/img/say: Blockade im Wolkenflug
  away:kwIsAway, mailBtn:kwMailBtn, mailbox:kwShowMailbox, roundEnd:kwRoundEnd,   // Kawumm auf Reisen (seit v64)
  run:()=>KR};   // laufende Schatzsuche (nur zum Prüfen)
}
