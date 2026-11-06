/* =====================================================================
   Liese: Pläne und Inselgeschichten (seit v72, Entscheidung Simon)
   Warum: Romy hing an der 8er-Insel fest, keine neuen Inseln, zu viel Druck. Sie liest gern Kawumms Briefe.
   Darum öffnet jetzt auch Lesen Inseln: Liese (Kawumms schlaue Freundin) hat einen Trick gegen den Wolkenwächter gefunden
   und schreibt für jede Insel einen Plan. Romy liest ihn und beantwortet eine Frage dazu. Richtig: Die Insel ist dauerhaft offen.
   Falsch zählt nichts: Die Stelle im Text leuchtet gelb, Romy liest nach und tippt nochmal. Kein Verlieren, kein Zeitdruck.
   Dazu Inselgeschichten aus Lieses Notizbuch: je Insel mehrere, mit einer Frage, für 3 Sterne.
   Lila Sterne öffnen weiter auch Inseln (Kette in unlockedRows), aber nur noch als Bonus.
   Logik oben zwischen LZ-LOGIC-START/END, in Node testbar (require('./liese.js')). Texte: Lesestufe Anfang 2. Klasse,
   aber länger als Kawumms Briefe (Romy kann mehr). Keine Gedankenstriche. Texte werden nie vorgelesen, nur die Rückmeldung.
   ===================================================================== */

/* ================= LZ-LOGIC-START ================= */
const LZ_STORY_STARS = 3;          // Sterne für eine gelöste Inselgeschichte (Bonus, Sterne kaufen Ausbauten und Geschenke)
/* Höchstens ein neuer Plan pro Tag. Der Begrüßungsbrief zählt nicht, der erste Plan darf am selben Tag kommen. */
function lzDefault(){ return {hello:false, helloSeen:false, plans:{}, lastPlanDay:'', stories:{}}; }
function lzEnsure(state){
  if(!state.lz || typeof state.lz!=='object') state.lz=lzDefault();
  const z=state.lz, d=lzDefault();
  for(const k in d) if(z[k]===undefined) z[k]=d[k];
  if(!z.plans || typeof z.plans!=='object') z.plans={};
  if(!z.stories || typeof z.stories!=='object') z.stories={};
  return z;
}
/* Darf heute ein Plan gelesen werden? (lockedLeft: es gibt noch geschlossene Inseln) */
function lzPlanReady(z, today, lockedLeft){ return !!z.hello && z.lastPlanDay!==today && !!lockedLeft; }
/* Insel per Plan öffnen: dauerhaft merken (state.unlocked, wie "Inseln gehen nie wieder zu") und gleich dort spielen. */
function lzOpenByPlan(state, r, today){
  const z=lzEnsure(state);
  if(!Array.isArray(state.unlocked)) state.unlocked=[];
  if(!state.unlocked.includes(r)) state.unlocked.push(r);
  z.plans[r]=today; z.lastPlanDay=today;
  state.focus=r;
}
/* Nächste neue Geschichte einer Insel (Index) oder -1. Die erste ist sofort da, jede weitere ab dem nächsten Tag. */
function lzStoryNext(z, r, today){
  const list=LZ_STORIES[r]; if(!list) return -1;
  const read=(z.stories&&z.stories[r])||[], n=read.length;
  if(n>=list.length) return -1;
  if(n>0 && read[n-1].d===today) return -1;
  return n;
}
function lzStoryDone(state, r, n, today){
  const z=lzEnsure(state), read=z.stories[r]||(z.stories[r]=[]);
  if(read.some(x=>x.n===n)) return false;
  read.push({n, d:today});
  state.stars=(state.stars||0)+LZ_STORY_STARS;
  return true;
}
function lzStoriesRead(z){ let n=0; for(const r in z.stories) n+=(z.stories[r]||[]).length; return n; }
function lzStoriesTotal(){ let n=0; for(const r in LZ_STORIES) n+=LZ_STORIES[r].length; return n; }

/* Wegweiser auf der Startseite, wenn ein Plan wartet (index.html, maybeGuideSay) */
const LZ_GUIDE_LINES=['Post von Liese! Sie hat einen neuen Plan geschrieben. Schau in der Inselwelt nach ihrem Fernrohr!','Liese hat einen Geheimweg gefunden! Komm, wir schauen in der Inselwelt nach.'];

/* ---------- Texte ----------
   lines = Absätze. q = Frage: ask, a (Antworten, a[ok] ist richtig, Reihenfolge wird gemischt), hint = Absatz mit der Antwort.
   {name}, {cur}, {curFriend}, {r}, {title}, {friend} werden ersetzt. */
const LZ_HELLO={
  head:'Hallo {name}!',
  lines:[
    'Hier schreibt Liese. Ja, genau, die mit der Brille und dem Fernrohr.',
    'Ich war auf einem Ausflug. Ganz allein! Ich hatte ein bisschen Angst. Aber nur ein kleines bisschen.',
    'Ich bin bis ganz nach oben auf den Wolkenberg geklettert. Von dort sieht man alle Inseln. Auch die hinter den Wolken.',
    'Und rate mal, was ich gesehen habe. Vor den Wolken sitzt ein Wächter. Ein Wolkenwächter! Er lässt nur Kinder durch, die genug lila Sterne haben.',
    'Ich finde, das ist eine doofe Regel. Inseln sind zum Entdecken da!',
    'Darum habe ich den Wächter beobachtet. Drei Tage lang. Und ich habe seinen Trick gefunden. Nach dem Mittagessen schläft er ein. Dann schnarcht er wie ein Traktor.',
    'Wer dann einen Geheimweg kennt, kommt an ihm vorbei. Für jede Insel gibt es einen anderen Weg. Ich schreibe dir für jede Insel einen Plan. Lies ihn gut, denn im Plan steht, wie es geht.',
    '{curLine}',
    'Kawumm sagt, Pläne sind was für Angsthasen. Aber dann hat sie meinen Plan doch gelesen. Zweimal!'
  ],
  ps:'Meinen ersten Plan findest du in der Inselwelt. Such mein Fernrohr!',
  q:{ask:'Wann schläft der Wolkenwächter?', a:['Nach dem Mittagessen','Am frühen Morgen','Er schläft nie'], ok:0, hint:5}
};
/* Satz über die schwere Insel im Begrüßungsbrief (nur, wenn die aktuelle Insel noch nicht sitzt) */
function lzCurLine(cur, friend){
  if(cur==null) return '';
  return 'Und noch was. Die '+cur+'er-Insel ist echt schwer. Die darf auch mal warten. '+friend+' hat Zeit.'+(cur===8?' Schildkröten haben sowieso immer Zeit.':'');
}
const LZ_PLANS={
  3:{lines:[
      'Hier ist mein Plan für die 3er-Insel. Das ist die Blüten-Insel. Dort wohnt Falter Flora.',
      'Der Geheimweg geht durch eine rosa Wolke. Sie riecht nach Erdbeeren. Ihr findet sie hinter dem großen Regenbogen.',
      'Achtung! In der Wolke wohnen Kitzel-Käfer. Wenn sie euch kitzeln, dürft ihr nicht laut lachen. Sonst wacht der Wächter auf.',
      'Am besten haltet ihr die Luft an und denkt an etwas Langweiliges. Zum Beispiel an Socken.',
      'Auf der anderen Seite der Wolke wartet Flora. Ihre Flügel leuchten in allen Farben. Sie freut sich schon sehr auf Besuch.',
      'Ich komme diesmal nicht mit. Ich bin nämlich sehr kitzelig.'],
     ps:'Lumi ist auch kitzelig. Am Bauch.',
     q:{ask:'Was dürft ihr in der rosa Wolke nicht tun?', a:['Laut lachen','Leise flüstern','Die Augen aufmachen'], ok:0, hint:2}},
  6:{lines:[
      'Hier ist mein Plan für die 6er-Insel. Das ist die Riff-Insel. Dort wohnt Delfin Dido.',
      'Die Riff-Insel liegt mitten im Meer. Der Wolkenwächter schaut immer nur nach oben in den Himmel. Nach unten ins Wasser schaut er nie!',
      'Darum nehmt ihr den Weg unter Wasser. Lumi bekommt eine Taucherbrille. Die habe ich selbst gebastelt. Aus zwei Marmeladengläsern.',
      'Dido holt euch am Ufer ab. Haltet euch gut an ihrer Flosse fest. Sie schwimmt sehr schnell.',
      'Unterwegs kommt ihr an einem Kraken vorbei. Er sieht gefährlich aus. Ist er aber nicht. Er will nur winken. Mit acht Armen gleichzeitig.',
      'Wenn ihr Muscheln hört, die leise singen, seid ihr gleich da.'],
     ps:'Bring mir bitte eine singende Muschel mit. Eine kleine reicht.',
     q:{ask:'Warum nehmt ihr den Weg unter Wasser?', a:['Der Wächter schaut nie nach unten','Lumi kann nicht mehr fliegen','Oben regnet es'], ok:0, hint:1}},
  9:{lines:[
      'Hier ist mein Plan für die 9er-Insel. Das ist die Bambus-Insel. Dort wohnt Panda Pom.',
      'Vor der Bambus-Insel steht ein Wolkentor. Der Wächter dort schläft nie, nicht mal nach dem Mittagessen. Er hat nämlich immer Hunger.',
      'Aber ich weiß, was er am liebsten isst: Pfannkuchen mit Apfelmus! Bambus mag er gar nicht. Davon muss er niesen.',
      'Der Plan geht so: Ich backe einen Turm aus Pfannkuchen. Zwanzig Stück! Den stellt ihr auf die Wolke neben dem Tor.',
      'Während der Wächter futtert, schleicht ihr ganz leise durch das Tor. Er merkt nichts. Er hat ja Apfelmus auf der Brille.',
      'Pom wartet im Bambuswald. Er ist sehr verschmust. Er will bestimmt mit dir kuscheln.'],
     ps:'Wenn Pfannkuchen übrig bleiben, will ich einen.',
     q:{ask:'Was isst der Wächter am liebsten?', a:['Pfannkuchen mit Apfelmus','Bambus','Kekse mit Salz'], ok:0, hint:2}},
  7:{lines:[
      'Hier ist mein Plan für die 7er-Insel. Das ist die Drachen-Insel. Dort wohnt Drache Dax.',
      'Dax ist mein Brieffreund. Er schreibt mir jede Woche. Seine Briefe sind immer ein bisschen angekokelt.',
      'Vor der Drachen-Insel passt der Wächter besonders gut auf. Aber er hat eine Schwäche. Er liebt Regenbogen. Wenn er einen sieht, muss er alle Farben zählen.',
      'Rot, Orange, Gelb, Grün, Hellblau, Dunkelblau und Lila. Das sind 7 Farben. Und weil er sich immer verzählt, fängt er wieder von vorne an.',
      'Jetzt kommt das Pupstierchen ins Spiel. Es pupst einen Regenbogen. Einen riesigen!',
      'Während der Wächter zählt und zählt, fliegt ihr einfach vorbei.',
      'Sag Dax schöne Grüße von mir. Und sag ihm, er soll beim Niesen die Nase zur Seite drehen.'],
     ps:'Das ist meine Lieblingsinsel. Sag es nicht den anderen.',
     q:{ask:'Wie viele Farben zählt der Wächter?', a:['7 Farben','3 Farben','10 Farben'], ok:0, hint:3}}
};
/* Für jede andere geschlossene Insel (kommt bei Romy nicht vor, nur bei einem neuen Lernstand) */
const LZ_PLAN_ANY={lines:[
    'Hier ist mein Plan für die {r}er-Insel. Das ist die {title}. Dort wohnt {friend}.',
    'Heute hat der Wolkenwächter Geburtstag. Er feiert mit Torte und Luftballons. Er ist so beschäftigt, dass er gar nicht aufpasst.',
    'Ihr müsst nur ganz leise sein. Und ihr dürft nicht von der Torte naschen. Auch wenn sie nach Schokolade riecht.',
    '{friend} wartet schon auf euch. Viel Spaß!'],
  ps:'Ich habe dem Wächter eine Karte geschrieben. Mit Glitzer.',
  q:{ask:'Warum passt der Wächter heute nicht auf?', a:['Er feiert Geburtstag','Er ist krank','Er ist im Urlaub'], ok:0, hint:1}};

/* Inselgeschichten aus Lieses Notizbuch. Je Insel in fester Reihenfolge. Neue Geschichten: einfach anhängen. */
const LZ_STORIES={
  2:[{title:'Piep will fliegen', lines:[
      'Küken Piep wohnt auf der Wiesen-Insel. Piep ist klein und gelb und sehr neugierig.',
      'Eines Tages sieht Piep Lumi am Himmel. Lumi fliegt hoch über die Wolken. Piep staunt. „Das will ich auch!“, ruft Piep.',
      'Also klettert Piep auf die größte Sonnenblume. Ganz nach oben. Dann breitet Piep die kleinen Flügel aus und springt.',
      'Flatter, flatter, plumps! Piep landet mitten in einem Haufen Gänseblümchen. Weich, aber nicht sehr hoch.',
      'Lumi landet neben Piep und lacht. „Komm, steig auf!“ Piep klettert auf Lumis Rücken. Und dann fliegen sie zusammen über die ganze Insel.',
      'Am Abend sagt Piep: „Fliegen ist toll. Aber Landen auf Gänseblümchen ist auch nicht schlecht.“'],
     q:{ask:'Wo ist Piep hinaufgeklettert?', a:['Auf eine Sonnenblume','Auf einen Baum','Auf das Dach'], ok:0, hint:2}},
    {title:'Das Ei im Gras', lines:[
      'Auf der Wiesen-Insel ist große Aufregung. Mama Huhn hat ein Ei verloren! Eben lag es noch im Hühnerhaus. Jetzt ist es weg.',
      'Piep sucht hinter dem Zaun. Nichts. Lumi sucht unter der Sonnenblume. Auch nichts.',
      'Dann kommt Liese mit ihrem Fernrohr. Sie schaut ganz genau über die Wiese. „Da hinten!“, ruft sie. „Da bewegt sich etwas Buntes!“',
      'Alle rennen hin. Und was sehen sie? Das Pupstierchen sitzt im Gras. Es sitzt auf dem Ei und hält es schön warm.',
      'Das Pupstierchen schaut ganz stolz. Dann pupst es einen kleinen Regenbogen. Vor Freude.',
      'Mama Huhn sagt: „Danke fürs Aufpassen!“ Und Piep sagt: „Das ist das bunteste Ei der Welt.“'],
     q:{ask:'Wer hat auf dem Ei gesessen?', a:['Das Pupstierchen','Kawumm','Mama Huhn'], ok:0, hint:3}}],
  5:[{title:'Der große Sprung', lines:[
      'Frosch Hüpf wohnt auf der Teich-Insel. Er sagt, er ist der beste Springer der Welt.',
      'Kawumm lacht. „Ha! Dann spring doch über den ganzen Teich!“ Hüpf überlegt. Der Teich ist ziemlich groß.',
      'Hüpf nimmt Anlauf. Er läuft über den Steg, schneller und schneller. Und dann: HOPP!',
      'Er fliegt durch die Luft. 5 Meter. 10 Meter. 15 Meter! Alle schauen nach oben.',
      'Aber über den ganzen Teich reicht es nicht. Hüpf landet mitten auf einem Seerosenblatt. Platsch! Das Blatt wackelt, aber Hüpf bleibt oben.',
      'Kawumm klatscht. „Fast über den ganzen Teich! Respekt, Hüpf!“ Hüpf grinst bis über beide Ohren. Na ja, Frösche haben keine Ohren. Aber du weißt, was ich meine.'],
     q:{ask:'Wo ist Hüpf gelandet?', a:['Auf einem Seerosenblatt','Am anderen Ufer','Im Schilf'], ok:0, hint:4}},
    {title:'Das Teich-Konzert', lines:[
      'Jeden Abend gibt Hüpf ein Konzert. Er sitzt auf dem Steg und singt: Quaaak! Quaaak!',
      'Das Problem: Hüpf singt sehr laut. Und sehr schief. Die Fische halten sich die Flossen vor die Ohren. Lumi auch, mit den Hufen.',
      'Keiner will es Hüpf sagen. Er ist ja so stolz.',
      'Da hat Liese eine Idee. „Wir singen alle zusammen!“, sagt sie. „Dann klingt es wie ein Chor.“',
      'Also singen alle mit. Die Fische blubbern, die Enten schnattern, Lumi wiehert und das Pupstierchen pupst im Takt.',
      'Es ist das lauteste Konzert, das die Teich-Insel je gehört hat. Aber auch das schönste.'],
     q:{ask:'Was hat Liese vorgeschlagen?', a:['Alle singen zusammen','Hüpf hört auf zu singen','Alle gehen schlafen'], ok:0, hint:3}}],
  4:[{title:'Flux und der Blätterberg', lines:[
      'Im Herbstwald wohnt Fuchs Flux. Er hat einen roten Pelz und einen buschigen Schwanz.',
      'Flux liebt Ordnung. Er sammelt die bunten Blätter und macht vier Haufen. Einen roten, einen gelben, einen orangen und einen braunen.',
      'Das dauert den ganzen Vormittag. Flux ist sehr zufrieden.',
      'Doch dann kommt der Wind. Er pustet einmal kräftig. WUSCH! Alle Blätter wirbeln durcheinander.',
      'Flux schaut auf den bunten Blätterberg. Er wird ein bisschen traurig. Aber Lumi ruft: „Weißt du, was man mit so einem Berg macht?“',
      'Und dann springen sie hinein. Wieder und wieder. Es raschelt und knistert. Flux lacht so sehr, dass er Schluckauf bekommt.'],
     q:{ask:'Was hat die Blätterhaufen durcheinandergebracht?', a:['Der Wind','Kawumm','Der Regen'], ok:0, hint:3}},
    {title:'Der Pilz-Hut', lines:[
      'Flux findet im Wald einen riesigen Pilz. Er ist rot mit weißen Punkten. „Der sieht aus wie ein Hut“, sagt Flux.',
      'Kawumm hört das. „Ein Hut? Für mich?“ Sie nimmt ihren Piratenhut ab und probiert den Pilz auf. Er rutscht ihr bis über die Nase.',
      'Liese schüttelt den Kopf. „Den darf man nicht essen. Und als Hut ist er auch komisch.“',
      'Da hat Flux eine bessere Idee. Er stellt den Pilz neben seine Höhle. Jetzt ist er ein Regenschirm für Mäuse.',
      'Gleich am nächsten Tag regnet es. Und unter dem Pilz sitzen drei kleine Mäuse. Ganz trocken. Sie winken.'],
     q:{ask:'Was ist der Pilz am Ende?', a:['Ein Regenschirm für Mäuse','Ein Hut für Kawumm','Ein Mittagessen'], ok:0, hint:3}}],
  8:[{title:'Panzi hat Zeit', lines:[
      'Schildi Panzi wohnt auf der Strand-Insel. Panzi ist eine Schildkröte. Und Panzi ist langsam. Sehr langsam.',
      'Kawumm ist schnell. Sehr schnell. „Wetten, ich bin zuerst an der Sandburg?“, ruft sie. „Na gut“, sagt Panzi. Und los geht es.',
      'Kawumm rennt los. Sie ist schon fast da. Doch dann sieht sie eine Hängematte zwischen zwei Palmen. „Kurz ausruhen“, denkt sie. Und schwupp, schläft sie ein.',
      'Panzi geht langsam weiter. Schritt für Schritt. Panzi hält nicht an. Panzi hat ja Zeit.',
      'Als Kawumm aufwacht, sitzt Panzi schon oben auf der Sandburg. Und winkt.',
      'Kawumm staunt. Panzi sagt: „Langsam ist auch ein Weg. Man muss nur dranbleiben.“'],
     q:{ask:'Warum hat Kawumm verloren?', a:['Sie ist eingeschlafen','Sie ist hingefallen','Sie hat sich verlaufen'], ok:0, hint:2}},
    {title:'Die Flaschenpost', lines:[
      'Am Strand liegt eine Flasche. Darin steckt ein Zettel. Panzi schiebt die Flasche mit der Nase zu Lumi.',
      'Lumi zieht den Zettel heraus. Darauf steht: Geh von der Palme 8 Schritte zum Meer. Dann grab!',
      'Panzi geht zur Palme. Dann macht Panzi 8 Schritte zum Meer. Das dauert ein bisschen. Dann gräbt Panzi mit den Vorderbeinen im Sand.',
      'Und da ist etwas! Eine kleine Kiste. Darin liegen Muscheln, ein Glitzerstein und ein Brief.',
      'Im Brief steht: Für alle, die langsam und genau sind. Viele Grüße, Liese.',
      'Panzi freut sich. Und Lumi sagt: „Liese ist echt die Checkerin.“'],
     q:{ask:'Wie viele Schritte muss man von der Palme gehen?', a:['8 Schritte','3 Schritte','100 Schritte'], ok:0, hint:1}}],
  3:[{title:'Flora sucht ihre Farben', lines:[
      'Auf der Blüten-Insel wohnt Falter Flora. Ihre Flügel sind sonst bunt wie ein Regenbogen.',
      'Aber heute hat es geregnet. Ganz doll. Und jetzt sind Floras Flügel grau. Der Regen hat die Farben weggewaschen.',
      'Flora ist traurig. Sie setzt sich auf eine rote Blume und weint ein bisschen.',
      'Da sagt die rote Blume: „Nimm dir etwas von meiner Farbe.“ Die gelbe Blume sagt das auch. Und die blaue. Und die rosa.',
      'Flora fliegt von Blume zu Blume. Bei jeder Blume bekommt sie eine Farbe zurück. Am Ende sind ihre Flügel bunter als vorher.',
      'Nur ein Fleck ist noch grau. Da pupst das Pupstierchen einen kleinen Regenbogen. Genau auf den Fleck. Fertig!'],
     q:{ask:'Woher bekommt Flora ihre Farben zurück?', a:['Von den Blumen','Vom Regen','Aus einem Malkasten'], ok:0, hint:3}},
    {title:'Die verirrten Bienen', lines:[
      'Auf der Blüten-Insel steht ein Bienenhaus. Darin wohnen viele Bienen. Sie sammeln jeden Tag Blütenstaub.',
      'Aber heute ist Nebel. Dicker, weißer Nebel. Die Bienen finden den Weg nach Hause nicht. Sie summen ganz aufgeregt durcheinander.',
      'Flora hat eine Idee. Ihre Flügel leuchten im Nebel wie kleine Laternen. „Fliegt mir nach!“, ruft sie.',
      'Flora fliegt langsam vorne. Alle Bienen fliegen hinterher. Eine lange, summende Reihe.',
      'Und dann sind sie da. Alle Bienen sind wieder im Bienenhaus. Zum Dank bekommt Flora ein Glas Honig.',
      'Den Honig teilt sie mit Lumi. Lumi hat danach ganz klebrige Hufe.'],
     q:{ask:'Warum finden die Bienen den Weg nicht?', a:['Es ist Nebel','Es ist Nacht','Das Bienenhaus ist weg'], ok:0, hint:1}}],
  6:[{title:'Dido und das Licht', lines:[
      'Auf der Riff-Insel steht ein Leuchtturm. Er leuchtet jede Nacht, damit die Schiffe nicht gegen die Felsen fahren.',
      'Aber heute Nacht ist das Licht aus! Die Lampe ist kaputt. Und draußen auf dem Meer kommt ein Schiff. Es ist Kawumms Schiff!',
      'Delfin Dido hat keine Angst. Dido schwimmt ganz schnell zum Schiff. Dann springt Dido aus dem Wasser und pfeift. Einmal, zweimal, dreimal.',
      'Kawumm versteht sofort. „Achtung, Felsen! Wir folgen dem Delfin!“',
      'Dido schwimmt vorne. Das Schiff fährt hinterher. Um alle Felsen herum. Sicher bis in den Hafen.',
      'Am nächsten Tag repariert Liese die Lampe. Und Kawumm schenkt Dido einen ganzen Eimer Fische.'],
     q:{ask:'Wie kommt Kawumms Schiff sicher in den Hafen?', a:['Es fährt hinter Dido her','Der Leuchtturm leuchtet','Kawumm macht die Augen zu'], ok:0, hint:4}},
    {title:'Wer hat die Muschel?', lines:[
      'Dido hat eine Lieblingsmuschel. Sie ist rosa und glänzt. Wenn man sie ans Ohr hält, hört man das Meer.',
      'Heute ist die Muschel weg. Dido sucht im Riff. Zwischen den Korallen. Unter dem Boot. Nichts.',
      'Dann sieht Dido einen Krebs. Er hat ein neues Haus auf dem Rücken. Ein rosa Haus. Es glänzt.',
      'Der Krebs schaut Dido an. „Mein altes Haus ist zu klein geworden“, sagt er leise. „Darf ich deine Muschel behalten?“',
      'Dido überlegt. Dann nickt Dido. „Du brauchst sie mehr als ich.“',
      'Der Krebs freut sich so sehr, dass er einen kleinen Tanz macht. Seitwärts, natürlich.'],
     q:{ask:'Wer hat die Muschel?', a:['Ein Krebs','Kawumm','Ein Fisch'], ok:0, hint:2}}],
  9:[{title:'Pom kann nicht schlafen', lines:[
      'Panda Pom wohnt auf der Bambus-Insel. Pom schläft gern. Eigentlich schläft Pom fast den ganzen Tag.',
      'Aber heute Nacht klappt es nicht. Pom liegt wach. Pom dreht sich nach links. Dann nach rechts. Dann wieder nach links.',
      'Pom zählt Schafe. 1, 2, 3. Dann zählt Pom Bambusstangen. 9, 18, 27. Hilft alles nichts.',
      'Da kommt Liese vorbei. Sie hat ein Buch dabei. „Soll ich dir eine Geschichte vorlesen?“',
      'Pom nickt. Liese liest von einem kleinen Panda, der zum Mond fliegt. Pom hört zu. Die Augen werden schwer. Und noch bevor die Geschichte zu Ende ist, schnarcht Pom leise.',
      'Liese deckt Pom zu. Dann flüstert sie: „Das Ende erzähle ich dir morgen.“'],
     q:{ask:'Was hat Pom beim Einschlafen geholfen?', a:['Eine Geschichte','Schafe zählen','Ein Glas Milch'], ok:0, hint:4}},
    {title:'Das Lampion-Fest', lines:[
      'Heute ist Lampion-Fest auf der Bambus-Insel. Überall hängen bunte Lampions. Rote, gelbe und grüne.',
      'Pom hat einen ganz besonderen Lampion gebastelt. Er sieht aus wie ein Mond.',
      'Als es dunkel wird, gehen alle los. Ein langer Zug durch den Bambuswald. Kawumm singt ein Piratenlied. Leider viel zu laut.',
      'Plötzlich ruft Pom: „Oh nein, mein Lampion ist aus!“ Das Licht ist ausgegangen.',
      'Da kommen die Glühwürmchen. Ganz viele. Sie fliegen in Poms Lampion hinein. Und schon leuchtet er wieder. Heller als alle anderen.',
      'Pom sagt: „Das ist der schönste Lampion der Welt.“ Die Glühwürmchen blinken. Das heißt bei Glühwürmchen: Gern geschehen.'],
     q:{ask:'Wer bringt den Lampion wieder zum Leuchten?', a:['Die Glühwürmchen','Kawumm','Der Mond'], ok:0, hint:4}}],
  7:[{title:'Dax hat Schnupfen', lines:[
      'Auf der Drachen-Insel wohnt Drache Dax. Dax ist groß und lila und sehr lieb.',
      'Aber heute hat Dax Schnupfen. Und wenn ein Drache niest, kommt eine kleine Flamme heraus. HATSCHI! Puff!',
      'Kawumm steht gerade vor Dax. HATSCHI! Die kleine Flamme pufft genau auf ihren Hut. Jetzt hat der Hut ein Loch. Ein kleines.',
      'Kawumm ist sauer. „Mein Hut!“ Dax schämt sich. Er wird ganz rot. Na ja, lila-rot.',
      'Dann hat Liese eine Idee. Sie wickelt Teig um lange Stöcke. „Dax, jetzt darfst du niesen!“ HATSCHI! Und schon ist das Stockbrot goldbraun und lecker.',
      'Am Ende sitzen alle zusammen und essen. Und Kawumm sagt: „Das Loch im Hut lasse ich drin. Das sieht gefährlich aus.“'],
     q:{ask:'Was essen am Ende alle zusammen?', a:['Stockbrot','Pizza','Eis'], ok:0, hint:4}},
    {title:'Der Drachenschatz', lines:[
      'Jeder Drache hat einen Schatz. Das weiß doch jeder. Kawumm will den Schatz von Dax unbedingt sehen.',
      'Dax führt sie in seine Burg. Ganz nach oben, in den höchsten Turm. Dort steht eine große, alte Kiste.',
      'Kawumm reibt sich die Hände. „Gold! Bestimmt ist da Gold drin!“',
      'Dax öffnet die Kiste. Und darin liegen: Briefe. Ganz viele Briefe. Manche sind ein bisschen angekokelt.',
      '„Das sind die Briefe von meinen Freunden“, sagt Dax. „Die meisten sind von Liese.“',
      'Kawumm ist erst still. Dann sagt sie: „Na gut. Das ist auch ein Schatz. Ein richtig guter sogar.“ Und am nächsten Tag schreibt Kawumm Dax ihren ersten Brief.'],
     q:{ask:'Was ist in der Kiste von Dax?', a:['Briefe','Gold','Kekse'], ok:0, hint:3}}]
};
function lzFill(s, v){ return String(s).replace(/\{(\w+)\}/g,(m,k)=>v[k]!==undefined?v[k]:m); }
/* Plan-Text für Insel r: {head, lines, ps, q} */
function lzPlanText(r, v){
  const P=LZ_PLANS[r]||LZ_PLAN_ANY;
  return {head:lzFill('Hallo {name}!',v), lines:P.lines.map(l=>lzFill(l,v)), ps:lzFill(P.ps,v), q:P.q};
}
function lzHelloText(v){
  const lines=LZ_HELLO.lines.map(l=>l==='{curLine}'?v.curLine:lzFill(l,v));
  const q=Object.assign({},LZ_HELLO.q);
  // Ohne Satz über die schwere Insel rutscht der Hinweis-Absatz nicht (er steht davor)
  return {head:lzFill(LZ_HELLO.head,v), lines:lines.filter(l=>l!==''), ps:LZ_HELLO.ps, q};
}
/* ================= LZ-LOGIC-END ================= */

if(typeof module!=='undefined' && module.exports){
  module.exports={LZ_STORY_STARS,lzDefault,lzEnsure,lzPlanReady,lzOpenByPlan,lzStoryNext,lzStoryDone,lzStoriesRead,lzStoriesTotal,
    LZ_HELLO,LZ_PLANS,LZ_PLAN_ANY,LZ_STORIES,LZ_GUIDE_LINES,lzCurLine,lzPlanText,lzHelloText,lzFill};
}

/* ===================== Oberfläche ===================== */
if(typeof document!=='undefined'){

const LZ_IMG='assets/liese.png?v=1';
const LZ_INK='#3B2A52';
const LZ_READ_Q_MS=2500;     // nach dem Einblenden des Textes: dann kommt die Frage
const lzCSS=document.createElement('style');
lzCSS.textContent=`
#overlay .box.lzbox{background:#F4FAEF;}
.lzpaper p.lzl{margin:0 0 8px; border-radius:6px; transition:background .6s, box-shadow .6s;}
.lzpaper p.lzl.mark{background:#FFE58A; box-shadow:0 0 0 4px #FFE58A;}
.lzpaper .lztitle{display:block; font-size:23px; text-align:center; margin:2px 0 8px;}
.lzpaper .lzimg{display:block; width:150px; margin:0 auto 4px;}
.lzpaper .lzimg svg{width:100%; height:auto; display:block; border-radius:14px;}
.lzpaper .lzhead{display:block; margin-bottom:6px;}
.lzpaper .lzface{float:right; height:96px; margin:0 0 4px 8px;}
.lzpaper .sig{display:flex; align-items:center; justify-content:flex-end; gap:8px; margin-top:4px; font-weight:700;}
.lzpaper .sig img{height:56px;}
.lzpaper .ps{font-size:15px; color:var(--muted); margin-top:2px;}
.lzenv .seal{fill:#5BAE4A;}
.lzq{width:100%; background:#fff; border:2px solid #B9DDA0; border-radius:16px; padding:10px 12px 12px; text-align:left; opacity:0; transform:translateY(12px); transition:opacity .7s, transform .7s; flex-shrink:0;}
.lzq.in{opacity:1; transform:none;}
.lzq .ask{display:flex; align-items:center; gap:8px; font-family:var(--font-disp); font-weight:700; font-size:19px; line-height:1.25; color:${LZ_INK}; margin-bottom:10px;}
.lzq .ask img{height:46px; flex:0 0 auto;}
.lzopts{display:flex; flex-direction:column; gap:8px;}
.lzopt{font-family:var(--font-disp); font-weight:700; font-size:18px; line-height:1.2; background:#F4FAEF; border:2px solid #B9DDA0; border-radius:14px; padding:11px 12px; text-align:left; color:${LZ_INK}; transition:opacity .4s, background .4s, border-color .4s;}
.lzopt:active{transform:translateY(1px);}
.lzopt.no{opacity:.3;}
.lzopt.ok{background:#DDF2CF; border-color:#5BAE4A; animation:pop .5s ease;}
.lzopt[disabled]{cursor:default;}
.lzgo{background:#5BAE4A; box-shadow:0 4px 0 #3E8A32;}
.lzgo:active{box-shadow:0 2px 0 #3E8A32;}
.lzlater{flex-shrink:0;}
.lzbadge{display:inline-flex; align-items:center; gap:4px; align-self:flex-start; background:#5BAE4A; color:#fff; font-size:11px; font-weight:800; border-radius:999px; padding:1px 8px; margin-top:2px;}
.lzbadge{position:relative;}
.lzbadge img{height:24px; margin:-7px 0 -5px -4px;}
.lzbadge.plan{padding-left:4px;}
.lzbadge.here{background:#9A6AE8;}
.lzbadge.story{background:#F2B83C; color:${LZ_INK};}
.islcard.lzplan{opacity:1; border-color:#5BAE4A; box-shadow:0 3px 0 #9FCB7A;}
.islcard.lzplan > svg.isl{filter:saturate(.8);}
.islcard.lzfocus{border-color:#9A6AE8;}
.islcard.lzhi{animation:lzhi 1.1s ease-in-out 6;}
@keyframes lzhi{50%{box-shadow:0 0 0 6px rgba(91,174,74,.35), 0 3px 0 #9FCB7A; transform:scale(1.02)}}
.lzisl{display:flex; flex-direction:column; gap:10px; align-items:center; width:100%;}
.lzisl:empty{display:none;}
.lzisl .cta.on{opacity:.75;}
.lzstory.new{background:#F2B83C; color:${LZ_INK}; box-shadow:0 4px 0 #C98F1A; animation:lzpulse 2s ease-in-out infinite;}
@keyframes lzpulse{50%{transform:scale(1.04)}}
.lzlist{display:flex; flex-direction:column; gap:8px; width:100%;}
.lzall{text-align:left; width:100%;}
.lzall h3{font-family:var(--font-disp); margin:14px 0 4px; font-size:20px;}
.lzall .kwpaper{font-size:16px;}
.lzall .ans{font-size:14px; margin:4px 0 0; color:${LZ_INK};}
.lzall .ans b{color:#3E8A32;}
.lzarrive svg{width:220px; height:auto; display:block; margin:0 auto; border-radius:18px;}
`;
document.head.appendChild(lzCSS);

const LZ_ENV=`<div class="kwenv lzenv" id="kwEnv"><svg viewBox="0 0 220 150" aria-hidden="true">
      <rect x="6" y="10" width="208" height="134" rx="12" fill="#E9F3DE" stroke="${LZ_INK}" stroke-width="4"/>
      <path d="M6 140 L90 76 M214 140 L130 76" stroke="#B9DDA0" stroke-width="4"/>
      <path class="flap" d="M8 12 L110 92 L212 12 Z" fill="#D6EBC4" stroke="${LZ_INK}" stroke-width="4" stroke-linejoin="round"/>
      <circle class="seal" cx="110" cy="88" r="16" stroke="${LZ_INK}" stroke-width="3"/>
      <path d="M110 77 l3.2 6.6 7.2 .8 -5.4 4.9 1.6 7.1 -6.6 -3.8 -6.6 3.8 1.6 -7.1 -5.4 -4.9 7.2 -.8z" fill="#fff"/>
    </svg></div>`;

function lz(){ return lzEnsure(S); }
function lzToday(){ return todayStr(Date.now()); }
function lzName(){ return S.name||'Romy'; }
/* Liese gehört zu Kawumms Welt: erst, wenn Kawumm da ist (Einladung angenommen). */
function lzActive(){ return !!(window.KW && KW_LIVE && S.kw && S.kw.joined); }
function lzPlanWaiting(){ return lzActive() && lzPlanReady(lz(), lzToday(), nextLockedRow(S)!==null); }
function lzPick(a){ return a[Math.floor(Math.random()*a.length)]; }
function lzShuffle(a){ const b=a.slice(); for(let i=b.length-1;i>0;i--){ const j=Math.floor(Math.random()*(i+1)); [b[i],b[j]]=[b[j],b[i]]; } return b; }
function lzEsc(s){ return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
function lzVars(r){
  const W=window.Inselwelt, cur=focusRow(S);
  const curOk=cur!=null && rowMastery(S,cur)<ROW_UNLOCK_SHARE;
  return {name:lzName(), r, title:(r&&W&&W.ISLANDS[r])?W.ISLANDS[r].title:'', friend:r?FRIENDS[r][1]:'',
          cur, curFriend:FRIENDS[cur]?FRIENDS[cur][1]:'', curLine: curOk?lzCurLine(cur, FRIENDS[cur][1]):''};
}
/* Sprechen nach einem Tipp: kwHush hat gerade abgebrochen, darum kurz warten (Android verschluckt sonst den Satz) */
function lzSay(t){ setTimeout(()=>speak(t),220); }

/* Blatt: Kopf, Absätze (data-i für die gelbe Stelle), Unterschrift Liese, PS */
function lzPaperHTML(x){
  let h='';
  if(x.img) h+='<div class="lzimg">'+x.img+'</div>';
  if(x.face) h+='<img class="lzface" src="'+LZ_IMG+'" alt="Liese">';
  if(x.title) h+='<b class="lztitle">'+lzEsc(x.title)+'</b>';
  if(x.head) h+='<b class="lzhead">'+lzEsc(x.head)+'</b>';
  h+=x.lines.map((l,i)=>'<p class="lzl" data-i="'+i+'">'+lzEsc(l)+'</p>').join('');
  h+='<div class="sig">'+(x.sigText?lzEsc(x.sigText):'Deine Liese')+(x.face?'':' <img src="'+LZ_IMG+'" alt="">')+'</div>';   // Liese oben im Brief: unten nicht nochmal
  if(x.ps) h+='<div class="ps">PS: '+lzEsc(x.ps)+'</div>';
  return h;
}
const LZ_WRONG=['Hm, nicht ganz. Lies nochmal nach. Ich hab die Stelle gelb gemacht.','Fast! Schau mal, wo es gelb leuchtet.','Nicht ganz. Die Antwort steht im gelben Teil.'];
function lzClose(){ $('overlay').classList.remove('show'); const b=$('overlayBox'); b.classList.remove('kwletterbox','lzbox'); if(window.KW) KW.mailBtn(); }
/* Ein Text mit Frage im Dialog.
   o: {paper, q, envelope, reread, goLabel, praise, onSolved(), onGo(), onClose(solved)}
   Antworten erst nach LZ_READ_Q_MS. Falsch: Knopf blass, Absatz q.hint leuchtet gelb. Richtig: grün, onSolved, dann Weiter-Knopf. */
function lzShowPaper(o){
  const box=$('overlayBox');
  box.classList.add('kwletterbox','lzbox');
  const ask=o.q && !o.reread;
  const opts=ask ? lzShuffle(o.q.a.map((t,i)=>({t,i}))) : [];
  let h='';
  if(o.envelope && !o.reread) h+='<h2>Post von Liese!</h2>'+LZ_ENV;
  h+='<div class="kwpaper lzpaper'+(o.envelope&&!o.reread?'':' show in')+'" id="lzPaper">'+lzPaperHTML(o.paper)+'</div>';
  if(ask) h+='<div class="lzq" id="lzQ" hidden><div class="ask"><img src="'+LZ_IMG+'" alt="">'+lzEsc(o.q.ask)+'</div><div class="lzopts">'
    +opts.map(x=>'<button class="lzopt" data-noarm data-i="'+x.i+'" disabled>'+lzEsc(x.t)+'</button>').join('')+'</div></div>';
  h+='<button class="cta lzgo" id="lzGo" data-noarm hidden>'+lzEsc(o.goLabel||'Weiter')+'</button>';
  h+= ask ? '<button class="ghostbtn lzlater" id="lzLater">Später</button>' : '<button class="cta sec" id="lzClose">Fertig</button>';
  box.innerHTML=h;
  $('overlay').classList.add('show');
  box.scrollTop=0;
  let solved=false;
  const showQ=()=>{ const q=$('lzQ'); if(!q) return; q.hidden=false; void q.offsetWidth; q.classList.add('in'); q.querySelectorAll('.lzopt').forEach(b=>{ if(!b.classList.contains('no')) b.disabled=false; }); };
  if(o.envelope && !o.reread){
    [523,659,523,784].forEach((f,i)=>tone(f,.14,i*0.12,'triangle',.08));
    speak('Post von Liese!');
    setTimeout(()=>{ const e=$('kwEnv'); if(!e) return; e.classList.add('open');
      setTimeout(()=>{ const e2=$('kwEnv'), p=$('lzPaper'); if(!e2||!p) return; e2.classList.add('away'); p.classList.add('show'); void p.offsetWidth; p.classList.add('in'); setTimeout(showQ, LZ_READ_Q_MS); },950);
    },1700);
  } else if(ask) setTimeout(showQ, LZ_READ_Q_MS);
  box.querySelectorAll('.lzopt').forEach(b=>b.addEventListener('click',()=>{
    if(solved || b.disabled) return;
    const i=+b.dataset.i;
    if(i===o.q.ok){
      solved=true;
      b.classList.add('ok');
      box.querySelectorAll('.lzopt').forEach(x=>{ x.disabled=true; });
      box.querySelectorAll('.lzl.mark').forEach(x=>x.classList.remove('mark'));
      sndGood(); smallSparkle();
      if(o.praise) lzSay(o.praise);
      if(o.onSolved) o.onSolved();
      const later=$('lzLater'); if(later) later.hidden=true;
      setTimeout(()=>{ const g=$('lzGo'); if(g){ g.hidden=false; g.scrollIntoView({behavior:'smooth', block:'nearest'}); } },900);
    } else {
      b.classList.add('no'); b.disabled=true;
      const m=box.querySelector('.lzl[data-i="'+o.q.hint+'"]');
      if(m){ m.classList.add('mark'); m.scrollIntoView({behavior:'smooth', block:'center'}); }
      lzSay(lzPick(LZ_WRONG));
    }
  }));
  const go=$('lzGo'); if(go) go.onclick=()=>{ lzClose(); if(o.onGo) o.onGo(); };
  const later=$('lzLater'); if(later) later.onclick=()=>{ lzClose(); if(o.onClose) o.onClose(solved); };
  const close=$('lzClose'); if(close) close.onclick=()=>{ lzClose(); if(o.onClose) o.onClose(true); };
}

/* ---------- Begrüßungsbrief: Liese ist vom Ausflug zurück und kennt den Trick ---------- */
function lzShowHello(o){
  o=o||{};
  const z=lz(), reread=!!o.reread && z.hello;
  z.helloSeen=true; save();
  const x=lzHelloText(lzVars(null));
  lzShowPaper({paper:{head:x.head, lines:x.lines, ps:x.ps, face:true}, q:x.q, envelope:true, reread,
    goLabel:'Zur Inselwelt!',
    praise:'Richtig! Nach dem Mittagessen schläft der Wächter. Du hast super gelesen!',
    onSolved:()=>{ z.hello=true; save(); },
    onGo:()=>{ if(o.onClose) return o.onClose(); lzGoToMap(); },
    onClose:()=>{ if(o.onClose) o.onClose(); }});
}
function lzHelloTry(tries){
  if($('overlay').classList.contains('show') || current!=='home'){ if(tries<6) setTimeout(()=>lzHelloTry(tries+1),1500); return; }
  lzShowHello();
}
/* App-Start: Begrüßungsbrief, solange er nicht gelöst ist. true = Liese ist dran (Kawumm wartet bis zum nächsten Start). */
function lzMaybeHello(){
  if(!lzActive() || lz().hello) return false;
  setTimeout(()=>lzHelloTry(0), 800);
  return true;
}
/* Nach dem Brief: Inselwelt, die Inseln mit Lieses Fernrohr leuchten */
function lzGoToMap(){
  renderPath(); show('path');
  const cards=[...$('pathList').querySelectorAll('.islcard.lzplan')];
  if(cards.length){ cards[0].scrollIntoView({behavior:'smooth', block:'center'}); cards.forEach(c=>c.classList.add('lzhi')); setTimeout(()=>cards.forEach(c=>c.classList.remove('lzhi')),7000); }
  speak(cards.length ? 'Schau mal, da ist Lieses Fernrohr! Tipp auf eine Insel mit Fernrohr. Dann liest du ihren Plan. Du darfst dir aussuchen, welche!' : 'Hier ist die Inselwelt!');
}

/* ---------- Plan für eine geschlossene Insel ---------- */
function lzShowPlan(r, o){
  o=o||{};
  const v=lzVars(r), x=lzPlanText(r, v), reread=!!o.reread;
  lzShowPaper({paper:{head:x.head, lines:x.lines, ps:x.ps, face:true}, q:x.q, envelope:true, reread,
    goLabel:'Los, zur '+r+'er-Insel!',
    praise:lzPick(['Richtig! Jetzt wisst ihr, wie es geht. Auf geht es!','Genau! Mit diesem Plan kommt ihr am Wächter vorbei!']),
    onSolved:()=>{
      lzOpenByPlan(S, r, lzToday()); save();
      partyOpenSync();   // kein falsches Inselfest (maybeRowParty)
    },
    onGo:()=>lzArrive(r),
    onClose:()=>{ if(o.onClose) o.onClose(); }});
}
/* Angekommen: Insel offen, Romy spielt jetzt hier */
function lzArrive(r){
  const W=window.Inselwelt, fr=FRIENDS[r];
  const box=$('overlayBox');
  box.innerHTML='<h2>Geschafft!</h2><div class="lzarrive">'+W.islandSVG(r,{open:true, mastered:false, built:islandBuilt(r), animate:true, size:260})+'</div>'
    +'<div class="pill">'+fr[0]+' '+fr[1]+'</div><button class="cta lzgo" id="lzArriveGo">Hallo, '+lzEsc(fr[1].split(' ').pop())+'!</button>';
  $('overlay').classList.add('show');
  bigKnall(); sndFanfare();
  speak('Geschafft! Ihr seid am Wolkenwächter vorbeigeschlichen. Die '+r+'er-Insel ist offen! '+fr[1]+' freut sich riesig.');
  $('lzArriveGo').onclick=()=>{ lzClose(); openIsland(r, {line:'Hallo! Ich bin '+fr[1]+'. Schön, dass du da bist! Ab jetzt spielen wir hier zusammen. Im Wolkenflug kommen jetzt meine Aufgaben.'}); };
}
/* Tipp auf eine geschlossene Insel. true = Liese hat übernommen. */
function lzLockedTap(r){
  if(!lzActive()) return false;
  const z=lz();
  if(!z.hello){ lzShowHello(); return true; }
  if(lzPlanWaiting()){ lzShowPlan(r); return true; }
  speak(lzPick(['Liese schreibt gerade am nächsten Plan. Morgen ist er fertig!','Lieses nächster Plan kommt morgen. Heute kannst du die anderen Inseln besuchen!']));
  return true;
}

/* ---------- Inselgeschichten ---------- */
function lzShowStory(r, n, o){
  o=o||{};
  const st=LZ_STORIES[r]&&LZ_STORIES[r][n]; if(!st) return;
  const W=window.Inselwelt, fr=FRIENDS[r];
  lzShowPaper({paper:{img:W.islandSVG(r,{open:true, mastered:rowMastery(S,r)>=ROW_UNLOCK_SHARE, built:islandBuilt(r), size:150}), title:st.title, lines:st.lines, sigText:'Aus Lieses Notizbuch'},
    q:st.q, reread:!!o.reread, goLabel:'+ '+LZ_STORY_STARS+' Sterne!',
    praise:lzPick(['Richtig! Du hast super gelesen. Dafür gibt es '+LZ_STORY_STARS+' Sterne!','Genau so war es! '+fr[1]+' freut sich. Hier sind '+LZ_STORY_STARS+' Sterne für dich!']),
    onSolved:()=>{ lzStoryDone(S, r, n, lzToday()); save(); },
    onGo:()=>lzAfterStory(r),
    onClose:()=>{ if(o.onClose) o.onClose(); else lzAfterStory(r); }});
}
function lzAfterStory(r){
  if(current==='island' && ISL===r){ $('islStarCount').textContent=starsAvail(); renderShop(r); lzIslandButtons(r); }
  $('starCount').textContent=S.stars;
  if(typeof pendingRewards==='function' && pendingRewards()>0) setTimeout(showGiftChoice,500);
}
function lzStoryList(r){
  const z=lz(), read=(z.stories[r]||[]).slice().sort((a,b)=>a.n-b.n);
  const box=$('overlayBox'); box.classList.add('kwletterbox','lzbox');
  box.innerHTML='<h2>Geschichten</h2><div class="lzlist">'+read.map(x=>'<button class="kwmailitem" data-n="'+x.n+'"><span class="ic">📖</span><span class="pl">'+lzEsc(LZ_STORIES[r][x.n].title)+'</span></button>').join('')+'</div><button class="cta" id="lzListClose">Fertig</button>';
  $('overlay').classList.add('show');
  box.querySelectorAll('[data-n]').forEach(b=>b.addEventListener('click',()=>lzShowStory(r,+b.dataset.n,{reread:true, onClose:()=>lzStoryList(r)})));
  $('lzListClose').onclick=()=>lzClose();
}

/* ---------- Inselscreen: Hier spielen und Geschichte ---------- */
function lzIslandButtons(r){
  const el=$('islLz'); if(!el) return;
  const here=focusRow(S)===r;
  let h= here ? '<button class="cta sec on" disabled>✓ Hier spielst du</button>' : '<button class="cta sec" id="lzHere">Hier spielen</button>';
  if(lzActive() && lz().hello){
    const z=lz(), nx=lzStoryNext(z, r, lzToday()), read=(z.stories[r]||[]).length;
    if(nx>=0) h+='<button class="cta lzstory new" id="lzStory">📖 Neue Geschichte</button>';
    else if(read) h+='<button class="cta sec lzstory" id="lzStory">📖 Geschichten</button>';
  }
  el.innerHTML=h;
  const hb=$('lzHere');
  if(hb) hb.onclick=()=>{
    S.focus=r; save(); lzIslandButtons(r);
    const an=$('islStage').querySelector('.isl-animal'); if(an){ an.classList.remove('hop'); void an.getBBox(); an.classList.add('hop'); }
    smallSparkle(); sndGood();
    speak(lzPick(['Super! Ab jetzt spielst du auf der '+r+'er-Insel. '+FRIENDS[r][1]+' freut sich!','Juhu! '+FRIENDS[r][1]+' spielt jetzt mit dir. Im Wolkenflug kommen jetzt Aufgaben von der '+r+'er-Insel.']));
  };
  const sb=$('lzStory');
  if(sb) sb.onclick=()=>{ const z=lz(), nx=lzStoryNext(z, r, lzToday()); if(nx>=0) lzShowStory(r,nx); else lzStoryList(r); };
}

/* ---------- Inselwelt: Abzeichen ---------- */
function lzBadges(r, isOpen, away, isFocus){
  if(!lzActive()) return isOpen&&!away&&isFocus ? '<span class="lzbadge here">Hier spielst du</span>' : '';
  if(!isOpen) return lzPlanWaiting() ? '<span class="lzbadge plan"><img src="'+LZ_IMG+'" alt=""> Plan</span>' : '';
  if(away) return '';
  let h='';
  if(isFocus) h+='<span class="lzbadge here">Hier spielst du</span>';
  if(lz().hello && lzStoryNext(lz(), r, lzToday())>=0) h+='<span class="lzbadge story">📖 Neu</span>';
  return h;
}
/* Was das Tier zusätzlich sagt (nextIslandLine) */
function lzAnimalHint(r){
  if(!lzActive() || !lz().hello) return '';
  const out=[];
  if(lzStoryNext(lz(), r, lzToday())>=0) out.push('Und Liese hat eine Geschichte über mich aufgeschrieben. Tipp auf das Buch!');
  else if(lzPlanWaiting()) out.push('Liese hat einen neuen Plan geschrieben! Schau in der Inselwelt nach ihrem Fernrohr.');
  return out.join(' ');
}

/* ---------- Briefkasten (kwShowMailbox): Lieses Briefe zum Nochmal-Lesen ---------- */
function lzMailItems(){
  if(!lzActive()) return [];
  const z=lz(), out=[];
  Object.keys(z.plans).map(Number).sort((a,b)=>String(z.plans[b]).localeCompare(String(z.plans[a])))   // neueste zuerst
    .forEach(r=>out.push({id:'plan:'+r, ic:'🗺', label:'Plan für die '+r+'er-Insel'}));
  if(z.helloSeen) out.push({id:'hello', ic:'🔭', label:'Liese'});
  return out;
}
function lzOpenMail(id, onClose){
  if(id==='hello') return lzShowHello({reread:true, onClose});
  const r=+String(id).split(':')[1]; if(r) lzShowPlan(r, {reread:true, onClose});
}

/* ---------- Elternbereich ---------- */
function lzParentHTML(){
  const z=lz(), today=lzToday(), open=unlockedRows(S), focus=focusRow(S);
  const parked=open.filter(r=>isParked(S,r));
  const plans=Object.keys(z.plans).map(r=>r+'er ('+z.plans[r]+')').join(', ')||'noch keiner';
  const locked=nextLockedRow(S)!==null;
  const nextPlan=!lzActive()?'erst, wenn Kawumm da ist':!z.hello?'nach dem Begrüßungsbrief':!locked?'alle Inseln offen':z.lastPlanDay===today?'morgen':'heute';
  return '<table class="kwtable">'
    +'<tr><th>Lieblingsinsel</th><td>'+focus+'er'+(S.focus==null?' (automatisch, neueste)':' (von Romy gewählt)')+'</td></tr>'
    +'<tr><th>Ruhende Inseln</th><td>'+(parked.length?parked.map(r=>r+'er').join(', ')+' (nur Aufgaben ab Fach 2)':'keine')+'</td></tr>'
    +'<tr><th>Begrüßungsbrief</th><td>'+(z.hello?'gelöst':z.helloSeen?'gelesen, Frage noch offen':'noch nicht gezeigt')+'</td></tr>'
    +'<tr><th>Pläne</th><td>'+plans+'</td></tr>'
    +'<tr><th>Nächster Plan</th><td>'+nextPlan+'</td></tr>'
    +'<tr><th>Geschichten</th><td>'+lzStoriesRead(z)+' von '+lzStoriesTotal()+' gelesen</td></tr>'
    +'</table>'
    +'<p style="margin:6px 0;font-size:13px;color:var(--muted)">Achtung: Knöpfe ändern Romys echten Stand.</p>'
    +'<div class="btnrow" style="justify-content:flex-start">'
    +'<button class="smallbtn" id="lzPHello">Begrüßungsbrief zeigen</button>'
    +'<button class="smallbtn" id="lzPPlan">Heute noch einen Plan erlauben</button>'
    +'<button class="smallbtn" id="lzPFocus">Lieblingsinsel auf automatisch</button>'
    +'<button class="smallbtn" id="lzPAll">Alle Texte ansehen</button>'
    +'</div>';
}
function lzParentWire(){
  const b=id=>$(id);
  if(b('lzPHello')) b('lzPHello').onclick=()=>lzShowHello({reread:false, onClose:()=>{ renderParent(); show('parent'); }});
  if(b('lzPPlan')) b('lzPPlan').onclick=()=>{ lz().lastPlanDay=''; save(); renderParent(); };
  if(b('lzPFocus')) b('lzPFocus').onclick=()=>{ S.focus=null; save(); renderParent(); };
  if(b('lzPAll')) b('lzPAll').onclick=lzShowAll;
}
/* Alle Texte mit Frage und richtiger Antwort, zum Gegenlesen (Simon) */
function lzShowAll(){
  const v=lzVars(null);
  const one=(title,x)=>'<h3>'+lzEsc(title)+'</h3><div class="kwpaper show in">'+lzPaperHTML(x)+'</div>'
    +(x.q?'<p class="ans">Frage: '+lzEsc(x.q.ask)+'<br>Richtig: <b>'+lzEsc(x.q.a[x.q.ok])+'</b>, sonst: '+x.q.a.filter((a,i)=>i!==x.q.ok).map(lzEsc).join(', ')+'. Gelb: Absatz '+(x.q.hint+1)+'</p>':'');
  const hx=lzHelloText(v);
  let h='<h2>Lieses Texte</h2><div class="lzall">'+one('Begrüßungsbrief',{head:hx.head, lines:hx.lines, ps:hx.ps, q:hx.q});
  for(const r of [3,6,9,7]){ const p=lzPlanText(r, lzVars(r)); h+=one('Plan '+r+'er-Insel',{head:p.head, lines:p.lines, ps:p.ps, q:p.q}); }
  const ga=lzPlanText(4, lzVars(4));
  h+=one('Plan für andere Inseln (Beispiel 4er, kommt bei Romy nicht vor)',{head:ga.head, lines:ga.lines, ps:ga.ps, q:ga.q});
  for(const r of ROW_ORDER) (LZ_STORIES[r]||[]).forEach((st,i)=>{ h+=one(r+'er-Insel, Geschichte '+(i+1)+': '+st.title,{title:st.title, lines:st.lines, sigText:'Aus Lieses Notizbuch', q:st.q}); });
  h+='</div><button class="cta" id="lzAllClose">Fertig</button>';
  const box=$('overlayBox'); box.classList.add('kwletterbox','lzbox'); box.innerHTML=h; $('overlay').classList.add('show'); box.scrollTop=0;
  $('lzAllClose').onclick=()=>lzClose();
}

window.LZ={maybeHello:lzMaybeHello, planWaiting:lzPlanWaiting, lockedTap:lzLockedTap, badges:lzBadges, islandButtons:lzIslandButtons,
  animalHint:lzAnimalHint, mailItems:lzMailItems, openMail:lzOpenMail, parentHTML:lzParentHTML, parentWire:lzParentWire,
  hello:lzShowHello, plan:lzShowPlan, story:lzShowStory, all:lzShowAll};   // hello, plan, story, all: auch zum Prüfen
}
