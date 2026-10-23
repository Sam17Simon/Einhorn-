# Projektnotiz Einhorn-Einmaleins

## Worum es geht
Es gibt genau ein Produkt: die PWA aus diesem Repo (Sam17Simon/Einhorn-), ausgeliefert über GitHub Pages und auf dem Handy als App installiert.

- Alle Änderungen passieren hier im Repo, nirgendwo sonst.
- Keine Claude-Artefakte, keine Kopien, keine Testseiten außerhalb des Repos. Die frühere Artefakt-Kopie wurde am 2026-10-10 gelöscht.
- Ein Update ist erst fertig, wenn es committet, gepusht und mit `release.py` hochgezählt ist. Sonst sieht die installierte App es nicht.

## Ablauf bei jeder Änderung
1. Im Handyformat lokal testen (`python3 -m http.server`, Viewport ca. 412 x 860, Touch an). Tore immer mit echten Taps prüfen, auch das Weltentor.
2. `python3 release.py` ausführen (zählt Cache-Version in sw.js, index.html und game.js hoch).
3. Committen und auf `main` pushen.

## Aufbau
- `index.html`: Lernlogik, Menü, Trainingsmodi, Elternbereich und die Einhorn-Zeichnungen als SVG (`unicornSVG` Seitenansicht, `unicornHeadSVG` Reiter-Sicht).
- `game.js`: Wolkenritt und Einflug-Intro auf PixiJS. Lumi wird aus den SVG-Funktionen in index.html gerastert, als ein Stück. Keine Einzelteile mehr.
- `assets/`: nur noch Effekt-Grafiken (Wolken, Sterne, Tore, Schilder).

## Regeln, die aus Fehlern entstanden sind
- Lumi ist immer ein zusammenhängendes Bild. Nie wieder aus PNG-Teilen zusammensetzen, bewegt wird nur das Ganze.
- Startseite, Intro und Wolkenritt zeigen dieselbe Lumi.
- Tor-Taps werden in `onTap` (game.js) über die Position ausgewertet. Pixi trifft die Tor-Objekte selbst nicht zuverlässig.
- Am Weltentor kommt nur eine Malaufgabe, kein Reihen-Sprung und kein Rätsel.
- Rätselstopps im Wolkenflug zeigen keine Bilder zum Abzählen (`showFriend(..., null)`). Romy hat dort gezählt statt gerechnet. Das Punktefeld im Zaubertraining bleibt, es kommt nur nach einem Fehler mit der Lösung (seit v66 in Fünfergruppen mit Rechenweg, siehe Rechenwege nach Fehlern).
- Eintippen ohne Ratelücke (seit v62): Sind so viele Ziffern getippt, wie die Lösung hat, wird nach 180 ms immer gewertet, richtig oder falsch (`handleKey` für Zaubertraining und Sternschnuppe, `rideKey` im Inselritt, wie `kwType`). ✓ nur für kürzere Eingaben. Während der 180 ms sperrt `pending` weitere Tasten.
- Inseln gehen nie wieder zu (seit v62): `S.unlocked` merkt sich jede je offene Reihe, `rememberUnlocks` läuft in jedem `save()`. `unlockedRows(state)` = gemerkte Reihen plus Kette über 80 %. Alte Stände ohne `unlocked` bekommen den heutigen Stand (`upgradeState`, gilt auch für Sicherungsdateien). Urlaub (`onVacation`) hängt weiter an der aktuellen Beherrschung.
- Reihen-Sprünge (`seqQuestion`) sind Weiterzählen, keine Malaufgabe: kein `applyResult`/`applyTimeout`, kein `logDay`. Sterne und Combo bleiben.
- Inselritt bucht ehrlich (`applyRide`): Nur beim ersten Versuch Richtiges zählt (leichte Übung, Box höchstens bis 2), jede Aufgabe mit falscher Eingabe wird als Fehler gebucht (`RD.misses`, zurück in Box 1). `logDay` mit echten Zahlen. Falsch Gesprochenes im Ritt wird weiter ignoriert (Spracherkennung zu unsicher).

## Tempo im Wolkenritt (seit v29)
- Das Tempo richtet sich nach dem einzelnen Fakt (`factStage` und `gatePlan` in index.html): neu = Tore fliegen 14 s an und bleiben dann stehen, bis getippt wird. Geübt = 9 bis 14 s je nach gemessener Antwortzeit, dann 6 s Kriechen. Sicher = 5,5 bis 9 s, dann 2,5 s Kriechen.
- Combo beschleunigt nur sichere Fakten.
- Nicht rechtzeitig getippt zählt als Zögern (`applyTimeout`): eine Box runter, nicht zurück auf Box 1.
- Icons (`icon-*.png`, `apple-touch-icon.png`) werden aus `unicornSVG` gerendert. Ändert sich Lumi, Icons neu erzeugen und `?v=` am Intro-Bild hochzählen.

## Inselwelt (seit v30)
- `islands.js`: zehn Inseln (`ISLANDS`, Schlüssel = Reihe), zehn Tiere (`ANIMALS`), 30 Ausbauten (`BUILDS`), Zeichenfunktion `islandSVG(row, {open, mastered, built, animate, size})`. Gleicher Stil wie Lumi.
- Menü: "Inselwelt" ersetzt "Meine Inseln" und "Reihen-Ritt". Der Ritt heißt Inselritt und startet nur noch vom Inselscreen.
- Tier schläft (zzz), bis die Reihe zu 80 % sicher ist, dann ist es wach und hüpft beim Antippen.
- Sterne: `S.stars` bleibt die Gesamtsumme (Lumis Extras hängen daran). `S.spent` zählt Ausgaben, verfügbar ist `starsAvail()`. Ausbauten kosten 8, 15, 25 Sterne je Insel und liegen in `S.islands[reihe]`.
- Neue Ausbauten: in `BUILDS` zeichnen (80x80, Boden y=76) und in `ISLANDS[reihe].builds` eintragen. Es gibt genau drei Bauplätze je Insel.

## Wenig Text (seit v59, Entscheidung Simon)
- Was vorgelesen wird, steht nicht zusätzlich da. Sichtbar bleiben Namen, Zahlen, Sterne, Knöpfe. Keine Untertitel im Menü, keine Statuszeilen unter Inseln, keine Sprechblase auf dem Inselscreen (`#islBubble` hidden), keine Absätze im Kawumm-Ende, in der Begrüßung und in der Schatzkammer. Ausnahme: Kawumms Brief (Romy soll lesen).
- Neue Hinweise immer als Sprache, nicht als Text.

## Urlaub für leichte Reihen (seit v57)
- 1er und 10er (`VACATION_ROWS`) sind gesperrt, sobald sie sitzen (`onVacation`: Tier wach, 80 %). Inselkarte blass, ohne Tier, mit großem Schild "Im Urlaub", keine Interaktion (Karte ist ein div). Ansage `vacationLine` nur ein einziges Mal (`S.vacSaid`), mehrere neue in einem Satz. `openIsland` lässt nicht hinein. Kawumm überspringt diese Reihen in der Kette (`kwAvailable(kw, fwd, away)`), ihre Schatzkarte verschwindet. Entscheidung Simon.
- Niveau zieht an (`pickTask`): Sitzt die 1er, fliegt alles mit 1 raus (1er-Reihe und jedes "mal 1", `isRetired`). Reihen mit wachem Tier `DONE_ROW_W` 0.8, neueste Insel `NEW_ROW_W` 1.4, Gold-Fakten Gewicht 0.35 (seit v62: ganz neue Insel und fällige alte Reihen ergibt etwa 17 bis 19 % alte Aufgaben, vorher 12 bis 13 %). Wiederholung läuft weiter über `isDue`. Reihen-Sprung lässt 10er im Urlaub aus.

## Lumis Extras in Stufen (seit v31)
- `ITEMS` in index.html: acht Extras mit je drei Stufen (`names`, `desc`, `crop`). Stand liegt in `S.gear` = {id: stufe}, `S.rewards` zählt eingelöste Geschenke. `S.items` ist nur noch Altlast (Zahl), `gearOf()` übersetzt alles.
- Geschenk-Meilensteine über Gesamtsterne (`rewardsEarned`, `rewardCost`: 20, dann 30, dann 45). Ausgaben für Inseln ändern daran nichts.
- Bei jedem Meilenstein wählt das Kind in `showGiftChoice` zwischen zwei Extras (immer die mit der niedrigsten Stufe). Kein Laden, keine Preise. Nichts daran als Shop umbauen.
- game.js bekommt die Ausrüstung als `gearKey(S.gear)` (JSON-Text), damit der Textur-Cache vergleichen kann.
- Jede Stufe muss in `unicornSVG` (Seite) und `unicornHeadSVG` (Reiter) sichtbar anders sein. Brillen überdecken das Auge nur halbtransparent.

## Inselbild (seit v31)
- `islands.js`: `scene` je Insel steuert ferne Bergkette (`farRange`), Berge und Bäume auf der Insel (`islandHills`, Basis y=116, rechts hinter den Bauplätzen) und die Klippe unter schwebenden Inseln (`islandCliff`). Berge haben keine Bodenlinie (`shape()` strichelt nur die Oberkante).

## Vorlesen (seit v33)
- Zahlen mit -er werden als Wort gesprochen (seit v70, Entscheidung Simon, gilt überall): `sayEr` in `makeUtt` macht aus 4er-Insel Vierer-Insel, 10er Zehner. Sichtbar bleibt die Ziffer. Texte also ruhig weiter mit `r+'er-Insel'` bauen.
- `speak()` heilt sich selbst: Satz sprechen, auf `onstart` warten. Kein Start nach 1,5 s oder Fehler: abbrechen und nächsten Weg probieren (`lang` = nur de-DE, `voice` = feste Stimme mit `u.lang=voice.lang`, `plain` = Gerätestandard). Der Weg, der klappt, liegt in localStorage `einhorn_speechMode`.
- Android-Chrome: Stimme nie ohne passende Sprache setzen (Android meldet `de_DE`), sonst stumm. Dort kein `pause()`/`resume()`, wirkt wie Abbruch.
- Nie direkt nach `cancel()` sprechen, 150 ms warten.
- `unlockSpeech()` im ersten Fingertipp (für iOS). Nicht entfernen.
- Intro: Der Tipp zum Überspringen darf nicht ins Menü durchrutschen. `#intro` bleibt beim Ausblenden tippbar, danach schluckt `tapGuard(1400)` alle Klicks, aber nur wenn im Intro getippt wurde (`introTouched`). Läuft das Intro durch, ist das Menü sofort tippbar.
- Elternbereich: "Stimme testen" zeigt Stimmen, gesprochen x von y, Weg, Neuversuche, letzten Fehler.

## Nächste Insel (seit v34)
- Tippt man auf der Insel das Tier an, sagt es `nextIslandLine(r)`: wie viele lila Sterne (Box 3+) auf der neuesten offenen Insel noch fehlen (8 von 10 nötig), welche Insel dann kommt und einen Spieltipp.
- Tipp-Regel: kommt aus `guideMode` (siehe Wegweiser, seit v63), dieselbe Regel wie auf der Startseite. Box 2 → 3 nur bei schneller, selbst eingetippter Antwort (siehe Lila nur nach Eintippen).
- Unter den Sternen der aktuellen Insel steht "x von 8 für die Ner-Insel". Elemente in `.islwrap` dürfen nicht schrumpfen (`flex-shrink:0`).

## Sicherung (seit v36)
- Einmal am Tag lädt die App beim Tippen auf einen Knopf im Rundenende-Screen `lumi-sicherung-JJJJ-MM-TT.json` in den Download-Ordner (`maybeDailyBackup`, Tag in localStorage `einhorn_lastBackup`). Downloads gehen nur direkt nach einem Fingertipp, darum dort.
- Elternbereich: "Jetzt sichern" und "Sicherungsdatei laden". `navigator.storage.persist()` wird beim Start angefragt.
- Feste Datei (seit v37, nur wenn `showSaveFilePicker` existiert): im Elternbereich einmal wählen, Griff liegt in IndexedDB `lumi-backup`, danach täglich überschreiben (`backupToFixed`). Fehlen Rechte oder die Funktion, gibt es wie bisher die Download-Datei.
- Kein Cloud-Dienst, keine Anmeldung. Bewusste Entscheidung von Simon: simpel.

## Ruhe in der ganzen App (seit v49)
- Dialoge (`#overlay`) blenden langsam ein, das Rundenende auch. Knöpfe in Dialogen, am Rundenende und auf dem Inselscreen sind erst nach 1,5 s klickbar (`armCTAs`, blass mit `.ctawait`). Ein MutationObserver sperrt bei jedem neuen Dialog-Inhalt. Antwort-Knöpfe (Zahlenfeld, Tore, Inseln der Schatzsuche) nie sperren, sonst stimmen die Antwortzeiten nicht. Knöpfe, die selbst später einblenden, bekommen `data-noarm`.

## Kawumm: Rückwärtsreihen (seit v38, live seit v56 am 2026-10-17)
- Alles in `kawumm.js` (vor dem Hauptskript geladen). Lernlogik oben zwischen KW-LOGIC-START/END, in Node testbar (`require('./kawumm.js')`). Bild: `assets/kawumm.png` (freigestellte Vorlage von Simon, nicht nachzeichnen). Spiegeln nur per CSS `scaleX(-1)`.
- Keine Kawumm-Sterne mehr (seit v63, Entscheidung Simon): der Schatz ist die Belohnung. Kein Sternchip, keine Sterne am Ende. `S.kw.stars` bleibt als Altlast liegen, wird nicht mehr hochgezählt. Wer früher welche hatte, hört beim nächsten Start einmal `kwNoStarsLine` (Flag `S.kw.noStarsSaid`). Kawumm-Antworten zählen nicht in `S.days` tasks/ok (Mal-Statistik), nur die Spielzeit.
- Live: `KW_LIVE = true` in kawumm.js (zurück auf false blendet alles wieder aus). Dann kommt beim Öffnen nach dem Intro einmal der Brief ("Post für Romy", Brief wird nicht vorgelesen, Romy liest selbst. Button "Ja, komm vorbei!" spätestens 3 s nach Öffnen (`KW_READ_MS`), hat `data-noarm`, damit `armCTAs` ihn nicht vorher blass sichtbar macht). Bis dahin sieht Romy nichts.
- Elternbereich, Abschnitt Kawumm: Testmodus (nur bis Neustart), Brief ansehen, Schatzkammer, Stimme, Brief zurücksetzen, Kawumm-Stand löschen, je Reihe Starten und Stufe umschalten.
- Stand liegt getrennt in `S.kw` = {joined, rows:{reihe:{stage:'sea'|'space', clean, runs, finds, steps:{k:{box,...}}}}}. Schritt k = von k·r nach (k-1)·r. Nie mit `S.facts` vermischen.
- Freischaltung: Start immer mit 1er rückwärts. Nächste Karte in `KW_ORDER` (1,2,10,5,4,8,3,6,9,7) nur, wenn die Karte davor im Weltall ist UND die eigene Vorwärtsreihe 5 von 10 lila hat.
- Fortschritt im Meer (`kwFinishRun(rs, {clean, errors, mode}, now)`): Mit Hilfe (sea1) reicht eine Fahrt mit höchstens 1 Fehler, dann ist die Hilfe weg (`helpOff`). Fahrten mit Hilfe zählen nie fürs Weltall. Ohne Hilfe (sea2): 2 saubere Fahrten am Stück (kein Fehler, alles unter 4 s), dann Weltall. 4 Fehler oder mehr ohne Hilfe: Hilfe kommt zurück.
- Wiederholung: Weltall-Karten werden nach 2, 4, 8, 16, 30 Tagen fällig (`KW_REVIEW_DAYS`, `rs.last`, `rs.reviews`). Klappt sie (höchstens 1 Fehler), wird die Pause länger, sonst wieder 2 Tage. Fällige Karten: gelbes Abzeichen "Schatz wartet!", Hinweis am Schiff, Kawumm sagt es einmal pro App-Start. Elternbereich: "fällig machen" zum Testen.
- Hilfe: Meer anfangs kommende Zahlen schwach sichtbar, nach einer sauberen Fahrt nur noch ?, Weltall nur aktuelle Zahl und Sprung. 
- Störenfriede legen sich auf die drei Inseln, dann tippt Romy die Zahl selbst ein (`kwBlock`, eigenes Zahlenfeld, prüft sofort bei genug Ziffern). Eintippen bis 7 s zählt als schnell (`KW_FAST_TYPE`). Nur auf fast sichere Schritte (`kwCoverWeight`: Fach 2 und 3 am liebsten, Fach 0 und 1 nie, die brauchen die Inseln als Stütze). Entscheidung Simon. Meer: nur ohne Hilfe, höchstens einmal pro Fahrt (70 %). Weltall: je passender Schritt 45 % (Fach 2-3) bzw. 25 %, nie zweimal hintereinander. Nie im ersten Schritt, nie in der ersten Fahrt.
- Start mitten in der Reihe: Weltall 35 % (Super-Speed, Start 5 bis 8), Meer ohne Hilfe 20 % (Rückenwind, Start 6 bis 9).
- `KW_CRIT`: 10 Meerestiere, 8 Weltall-Figuren, je mit Trick (`act`: lie, sink, grab, gulp, beam) und Sätzen. Nie zweimal dieselbe Figur hintereinander. 6 % Lumi als Witz (ohne Regenbogen). Neue Figuren: Zeichnung 220x100, quer über alle drei Inseln.
- Welten: `KW_SEAS` (Meer, Cola-, Sauer-, Schoko-, Glitzer-Meer) und `KW_SKIES` (Weltall, Bonbon-Galaxie, Glibber-Nebel). Die ersten zwei Fahrten einer Reihe immer normal, danach gemischt.
- Klassennamen mit `kw` beginnen lassen. `.sky` ist schon vom Wolkenflug belegt.
- Falsche Inseln: übersprungen, nur 1 weggenommen, Zehnerübergang vergessen (`kwOptions`).
- Schatzkammer: je Reihe ein verrückter Behälter (`KW_BOX`), jede geschaffte Fahrt bringt einen Schatz, 10 passen hinein. Zugang über Kawumms Schiff oben in der Inselwelt und nach jeder Fahrt.
- Voller Behälter verwandelt sich beim nächsten Schatz (`rs.level`, `KW_LEVELS` = 3): normal, Glitzer-, Diamant- (`kwBoxName`). Dann füllt er sich neu. Pro Reihe also 30 Schätze. Glitzer: goldener Schein und Stern, Diamant: bunter Schein und Diamant. Entscheidung Simon (wie Lumis Extras in Stufen).
- Das Schiff steckt in `#kwLayer` und fährt mit der Karte mit. Nie getrennt animieren. Ruhige Fahrt (Entscheidung Simon, v55): Das Schiff bleibt auf der Seite der gewählten Insel (`KR.sx`), kein seitliches Zurückrücken in die Mitte. Beim Fahren rollt die Karte nur senkrecht nach oben, die nächste Inselreihe liegt schon darunter (`kwRowHTML` mit `KW_DY`, Klasse `kwnext`) und blendet ein. Danach wird im selben Bild ohne Sprung neu gezeichnet (`kwRenderLayer(pre)`).
- Abwechslung: Inseln (4 Formen, 4 Farben, 9 Deko-Teile) und Planeten (Farbe, Muster, Ringe, Mond) werden je Zahl aus `KR.seed` gewürfelt: gleiche Zahl sieht innerhalb einer Fahrt gleich aus, jede Fahrt neu. Dazu Kleinigkeiten am Kartenrand (`kwFxHTML`).
- Kawumms Stimme: `speak(text, cb, KW_VOICE)` mit natürlicher Tonhöhe 1.0 und Tempo 1.12 (Lumi 1.14 und 1.04). Verstellte Tonhöhe klingt blechern, darum nicht weiter verbiegen. Eine zweite Gerätestimme gibt es auf Romys Handy nicht; im Sprechweg `voice` eine zweite deutsche Stimme, falls vorhanden. Nie Stimme ohne passende Sprache setzen (Android).
- Gemeinsam hüpfen: `kwDuoHTML`, Lumi immer ohne Regenbogen (`kwNoRainbow`). Danach erzählt Kawumm, was sie macht und kann, und `kwGoToShip` führt in die Inselwelt: Schiff-Karte leuchtet, Kawumm zeigt darauf (ist die Einser-Insel offen, leuchtet die mit).
- Ruhe: alle Übergänge bewusst langsam (Segeln 1,1 s, Karte rückt 1 s). Knöpfe (CTAs) erst nach 1,5 bis 2 s klickbar (`kwArm`). Nicht wieder schneller machen.
- Weltall-Start (`kwLaunch`): Wenn eine Karte das Meer schafft, segelt das Schiff in die Mitte, Countdown 3, 2, 1, Sternenhimmel blendet über, Schiff hebt ab, dann erst der Schatz-Bildschirm.
- In der Schatzsuche keine Textblase unten, nur Sprache. Jeder Tipp auf einen Knopf bricht den laufenden Satz ab (`kwHush`, danach 150 ms bis zum nächsten Satz).
- Gesprochene Texte: keine Laute ohne Vokal und keine gedehnten Buchstaben (Mmmh, Pssst, Juhuuu, Uiii). Die Sprachausgabe buchstabiert die. Stattdessen Lecker, Hör mal, Juhu, Ui.
- Brieftext: frech und kurz, für Romy selbst lesbar. Nicht wieder brav machen.

## Lila nur nach Eintippen (seit v63)
- Lila (Fach 3+) heißt "kann es selbst abrufen". `applyResult(state,key,correct,rt,now,how)`: `how='typed'` (Zahlenfeld) oder `'choice'` (Tor, Auswahl, Gesprochenes; ohne `how` gilt `'choice'`).
- Eingetippt richtig: `f.typed++`, bis `TYPE_FAST_MS` (6 s seit v71, Entscheidung Simon: Tippen ist nicht der Engpass; bis v69 5 s, v70 kurz 7 s) ein Fach rauf (auch 2 → 3), langsamer: unten +1, ab Fach 2 halten. Eingetippt falsch: zurück in Fach 1.
- Auswahl richtig: höchstens bis Fach 2 (`CHOICE_MAX_BOX`), lila Fakten bleiben (nie herabstufen fürs Nie-Getippt-Haben). Auswahl falsch: höchstens ein Fach runter (4 → 3, Fach 1 bleibt 1). Timeout weiter `applyTimeout` (eine Box runter).
- Getippt buchen: Zaubertraining und Sternschnuppe (`submit(val,'typed')` aus `handleKey`), Blockade im Wolkenflug. Mikro im Zaubertraining: `submit(val,'spoken')` = Auswahl. Inselritt bleibt `applyRide` (höchstens Fach 2, kein `typed`, Fehler als `'typed'` zurück in Fach 1).
- `typed` liegt in jedem Fakt, `defaultState` setzt 0, `upgradeState` rüstet alte Stände und Sicherungsdateien mit 0 nach. Elternbereich zeigt "schon selbst eingetippt".

## Blockade im Wolkenflug (seit v63)
- Ab und zu legt sich eine Figur über die Tore, die Tore stehen (`spawnGates(...,{hold:true})`, kein Ablaufen, kein Timeout), ihre Zahlen sind weg (`eng.setBlocked(true)`, sonst liest Romy ab), Zahlenfeld `#blockPad` kommt von unten, Romy tippt (`blockKey`, wie `handleKey`: volle Ziffernzahl → nach 180 ms werten, ✓ für kürzere). Antwort läuft über `chooseGate(val,null,'typed')`.
- Ziel (`pickBlockTarget`, `blockWeight`): jede Aufgabe in Fach 2 (Gewicht 3, auch wenn schon einmal zu langsam getippt, seit v69; vorher fiel sie für immer raus und war im Wolkenflug nie mehr lila zu kriegen), lila nie getippt nur noch Gewicht 0.5. Neueste Insel mal 3 (`BLOCK_NEWEST_W`). Nie Fach 0-1, nie ausgemustert. `BLOCK_MAX` 3 pro Ritt, je passendes Tor `BLOCK_P` 0.45, aber mit Abstand: mindestens `BLOCK_GAP` 2 normale Tore dazwischen, nie direkt nach dem Weltentor. Nie am Weltentor, nie bei Reihen-Sprüngen, nie bei einer Wiederholung nach Fehler, nie am ersten Tor, nie im allerersten Ritt.
- Antwortzeit der Blockade (seit v69): Die Uhr startet neu, wenn die Figur fertig gesprochen hat und noch nichts getippt ist. Vorher lief sie während des Satzes (4 bis 5 s) und kaum etwas wurde rechtzeitig lila.
- Neuer lila Stern in der Blockade (seit v69): Die Figur sagt es ruhig (`fig.lila`, "ein lila Stern für die 4er-Insel"), Zahl wird lila, kleiner Ton, es geht erst nach dem Satz weiter (höchstens 9 s).
- Tor-Taps gesperrt doppelt: `G.blocked` in `onTap`/`pick` (game.js) und `RN.block` in `onPick`/`onArrive`. Antwortzeit `RN.t0` erst, wenn das Zahlenfeld ganz drin ist (`RN.block.ready`). Zahlenfeld hat `data-noarm`, nie sperren.
- Figur (`blockFigure`): Kawumm (`KW.img`, Stimme `KW.voice`, mit Schranke), wenn `KW.active()` und nicht auf Reisen (`KW.away()`); sonst Alien Plopp (`ALIEN_SVG`, 220x112, grün, drei Augen). Pupstierchen ist für später reserviert. Ein gesprochener Satz, kein Text.
- Zum Ausprobieren: Elternbereich unter Kawumm "Blockade erzwingen" oder `forceBlock(n)` im Fenster (gilt für den nächsten Ritt).

## Ruhe im Wolkenflug (seit v69, Entscheidung Simon)
- Zu hektisch. Rätsel-Freunde sind aus (`RUN_RIDDLES = false`, Code bleibt). Reihen-Sprünge nur noch 10 % (`RUN_SEQ_P`, vorher ca. 23 %). Blockaden mit Abstand (`BLOCK_GAP`).

## Lila Sterne am Rundenende (seit v69)
- `lilaStart()` beim Start von Wolkenflug, Zaubertraining, Sternschnuppe, `lilaEnd()` am Ende: zeigt in `#endLila` je Insel die neuen lila Sterne mit Aufgabe, Lumi hängt einen Satz an ("Und du hast 2 lila Sterne für die 4er-Insel gesammelt! Jetzt hast du 6 von 8."). Zählung nur, wenn in der Runde keine Insel aufging (dann feiert `maybeRowParty`). Logik `lilaSnap`, `lilaGain` im LOGIC-Block. Inselritt macht nie lila, dort ausgeblendet.

## Ausgemusterte zählen als lila (seit v69)
- `rowMastery`: Ist die 1er im Urlaub, zählt "mal 1" jeder Reihe als lila (kommt nie mehr dran). Vorher brauchte z. B. die 4er-Insel 8 von nur 9 möglichen Aufgaben. Auch die Sterne auf Insel und Inselscreen zeigen sie lila. `rowSure` = reine Zählung (für die 1er selbst, keine Rekursion über `onVacation`).

## Wegweiser auf der Startseite (seit v63)
- `guideMode(state, kwDue)` im LOGIC-Block, gezählt auf der neuesten offenen Insel: 3+ neue → `island` (Inselwelt); mehr wackelnd (Fach 0-1) als Fach 2 → `practice`; 2+ Fach-2 nie getippt → `run` (Blockaden); fällige Kawumm-Karte → `ship` (Inselwelt, nie während Kawumms Reise); Fach 2 schon getippt, aber zu langsam → `practice`; sonst `run`.
- Der passende Knopf bekommt `.guide` (ruhiges Pulsieren, kein Gradient). Lumi sagt höchstens einmal pro App-Start einen Satz (`maybeGuideSay`, `GUIDE_LINES`), nur auf der Startseite, nicht über Kawumms Brief, wartet bis Lumis Begrüßung fertig ist.
- `nextIslandLine` nimmt dieselbe Regel (`guideMode(S,false)`), keine eigene Logik mehr.

## Kawumm auf Reisen (seit v64)
- Logik im KW-LOGIC-Block (Node: `require('./kawumm.js')`), Zustand in `S.kw.trip` (`state` 'home'|'away', `idx`, `order`/`pos`, `runsSince`, `nextAfter`, `leftDay`, `leftAt`, `needDays`, `plan`, `sent`, `next`, `roundsSince`, `lastLetterDay`, `count`), Briefe in `S.kw.mail` ({t, k:'bye'|'travel'|'back', n, d, read, tip}), Andenken in `S.kw.souvenirs` (Reise-Nummern). `kwTripEnsure` rüstet nach (in `kws()` und in `upgradeState`, also auch Sicherungsdateien).
- Abflug (`kwTripRunEnd`, nur in `kwTreasure`, also nur am Ende einer Fahrt): nach `nextAfter` = 6 bis 8 Fahrten seit Start bzw. Rückkehr, nur wenn `lumiWorkLeft(S)` (index.html, LOGIC: neueste Insel unter 8/10 lila oder Lumi-Wiederholung fällig), nie am Tag eines anderen Briefs. Fahrten aus dem Elternbereich zählen nicht. Abschied: Schatz-Bildschirm ohne Knöpfe, Kawumm sagt "Ich hab dir einen Brief geschrieben", dann `kwShowBye`, danach Startseite. Nie "zu viel gespielt", Kawumm wittert ein Abenteuer.
- Rückkehr nach Spieltagen (`kwPlayDays`: Tage nach `leftDay` mit `S.days[d].tasks>0`, Kawumm zählt dort nicht), `needDays` 2 oder 3 je Reise. Kalendertage und lila Sterne zählen nicht. Nur beim App-Start (`kwStartMail`), erst wenn mindestens ein Reisebrief da war.
- Briefe: Abschied, 1 bis 2 Reisebriefe (`plan`), Rückkehr. Reisebrief beim App-Start (`next.when='start'`) oder am Rundenende nach 3 bis 6 Lumi-Runden (`'round'`, `kwRoundEnd` hängt an `show('end')`, Brief nach 3,5 s, nur wenn der Rundenende-Screen noch offen und kein Dialog da ist). Höchstens ein Brief pro Tag (`lastLetterDay`, gilt auch für Abflug und Rückkehr). `kwTripStartDue`/`kwTripRoundDue` prüfen, `kwTripSendTravel`/`kwTripReturn` buchen.
- Texte: `KW_TRIPS` (9 Reisen, feste Reihenfolge, danach gemischt, `kwNextTripIdx`), `kwMailText`. Abschied immer mit `KW_COMEBACK` ("Ich melde mich. Und ich komme wieder!") und Lumi-Tipp `kwTipLine(guideMode(S,false))`, gespeichert im Brief. Abschied + Reisebrief 1 + Rückkehr ergeben allein eine abgeschlossene Geschichte (Problem und Lösung); Reisebrief 2 ist nur Bonus-Episode für die Mitte, nichts Nötiges darin (Entscheidung Simon). Rätsel im PS des Abschieds von Reise 3, 6, 9, Lösung im ersten Reisebrief (der kommt immer). Lesestufe Anfang 2. Klasse, kurz, frech, keine Gedankenstriche. Neue Reisen: Eintrag in `KW_TRIPS`, `KW_TRIP_N` hochzählen, Andenken in `KW_SOUV` zeichnen (100x100).
- Liese als Bild (seit v67): `assets/liese.png` (Vorlage von Simon, freigestellt, nicht nachzeichnen, `KW_LIESE`). `kwMailText` setzt `liese`, wenn sie im Brief vorkommt, dann steht sie klein oben rechts im Brief (`.kwliese`). Bei der Rückkehr (`kwComeBack`) steht Liese auf dem Andenken-Regal (`.kwsouvliese`, `kwOpenVault(..., {liese})`), wenn sie in einem Brief dieser Reise vorkam, Kawumm sagt "Und Liese ist auch mitgekommen!". Nicht oben in den Kopf, die Schatzkammer scrollt zum Andenken. Darf auch sonst eingesetzt werden, wo Liese auftritt.
- Briefoptik wie die Einladung (`KW_ENV`, `kwPaperHTML`, `kwShowMail`): nicht vorlesen, nur "Post für Romy!", Knopf nach `KW_READ_MS` mit `data-noarm`.
- Briefkasten: `#btnMail` auf der Startseite (sichtbar, sobald der Brief angenommen ist), rotes Abzeichen = ungelesene Briefe (`kwMailBtn`), Liste mit Ort und Symbol (`kwShowMailbox`), Einladung liegt mit drin.
- Unterwegs (`kwAway`/`KW.away()`): keine Schatzkarten (Inselkarte versteckt, `kwMapBadge` leer), Inselwelt zeigt `kwAwayCard` (leerer Anleger mit Flaschenpost, nur Briefkasten-Knopf, Lumi sagt einmal, dass Kawumm auf Reisen ist), `kwDueRows` liefert [] (Wegweiser zeigt nie aufs Schiff), Blockade im Wolkenflug macht Plopp. Fälligkeit pausiert: bei Rückkehr rückt jedes `rs.last` um die Reisezeit (`kwShiftDue`).
- Rückkehr (`kwComeBack`): Rückkehrbrief, dann Schatzkammer mit eigenem Regal "Andenken" (`kwsouvshelf`, 9 Plätze, leere mit ?), Kawumm sagt es mit `KW_VOICE`.
- Elternbereich, Abschnitt Kawumm: Reisestand (wo, Spieltage x von y, Briefe, nächster Brief), "Reise jetzt starten", "Nächsten Brief jetzt" (ohne Tagesgrenze, danach Rückkehr), "Zurückkommen lassen", "Alle Reisebriefe ansehen", "Briefkasten".

## Rechenwege nach Fehlern (seit v66)
- `rechenweg(state, task)` im LOGIC-Block (Node-testbar) liefert nach einer falschen Antwort einen kurzen Weg über einen Fakt, den Romy schon kann: `{op, sure, base, say, short, show, dots}`. Reihenfolge: Tauschaufgabe lila (`swap`) > Regel mal 1/2/10 (`rule1`, `rule2`, `rule10`) > Kernaufgabe 5er/10er (5n+n, 5n−n, 10n−n, Hälfte von 10n) > Verdoppeln > Nachbaraufgabe (n±1), jeweils nur mit lila Bezugsfakt (`mulSure`, beide Richtungen). Sonst Fallback ohne "kennst du": Kernaufgabe, sonst 2er-Nachbar, bei 7 `split` (5n+2n), bei 8 verdoppeln. Innerhalb einer Stufe Plus vor Verdoppeln vor Minus vor Halbieren.
- Geteilt: `divBridge` über die Mal-Aufgabe ("7 mal wie viel ist 42? 7 mal 6 ist 42.").
- Zaubertraining: Lösung + `say` gesprochen, die nächste Aufgabe kommt erst nach dem Satz (mindestens 3,4 s, sonst würde `nextTask` ihn abschneiden). Sichtbar nur `show` (Zahlen, z. B. "5·7 = 35, +7 = 42") unter dem Punktefeld.
- Punktefeld (`renderDots(el, rows, cols, caption, rw.dots)`): Fünfergruppen (Lücke nach 5 Reihen und 5 Spalten), Kernaufgabe lila (`--accent`), Rest gold (`.rest`), Weggenommenes nur als goldener Ring (`.ghost`, z. B. 10·6 − 6).
- Wolkenflug: nur gesprochen, ein Satz (`short`) hinter "x mal y ist z.". Nicht beim Vorbeireiten (Timeout), nicht am Weltentor, nicht bei Reihen-Sprüngen. Rätsel: nur gesprochen, kein Bild. Blockade: erst der Satz der Figur, dann Lumis `short` (`blockReact(good,t,rw)`, nur wenn inzwischen nichts anderes gesprochen wurde, `speakSeq`). Spieltempo unverändert.
- Sternschnuppe: Rechenweg nur als Zahlen (`.fbway`), nicht gesprochen, weil dort das Mikro mithört und gesprochene Zahlen als Antwort zählen würden.

## Tauschaufgaben (seit v66)
- 7x4 und 4x7 bleiben getrennte Lernstände (Schlüssel Reihe x Zahl, `factKey`), nichts zusammenlegen.
- `seedSwaps(state)` (läuft in `rememberUnlocks`, also bei jedem `save()`): Für jede neu offene Insel genau einmal (`S.swapDone`) starten die Fakten, deren Tauschaufgabe lila ist (`swapKnown`), in Fach 1, bei schon selbst getippter Tauschaufgabe in Fach 2. Nie lila. Markiert mit `f.swap=1`, `seen` bleibt 0. Alter Stand ohne `swapDone`: alle offenen Inseln gelten als erledigt (`upgradeState`).
- Ansage nur gesprochen: `S.swapNews` [{row,n}], `swapNewsLine(row,true)` hängt sich an die Insel-Feier (`maybeRowParty`) oder, falls die ausblieb, ans erste Öffnen der Insel (`openIsland`). Danach verbraucht.
- Tausch-Start ist nicht "neu": `guideMode` zählt neu = `seen 0 und Fach 0`, `factStage` gibt Fach 2 schon `uebt`, Sterne zeigen ihn als angefangen. `blockWeight` nimmt Fach 2 aus Tausch als Blockade-Ziel.

## Geteilt (seit v66)
- Vorher wurde Geteilt (35 % der lila Fakten in Zaubertraining und Sternschnuppe) auf den Mal-Fakt gebucht. Das ist raus. Jetzt eigener Lernstand `S.divs` = {"42:7": {box, seen, ok, no, last, rt, typed}}, angelegt beim ersten Buchen (`factOf(state,key,true)`, `isDivKey`). Gleiche Fächer und Regeln wie Mal (`applyResult`, `applyTimeout`). `rowMastery`, `unlockedRows`, `guideMode`, `masteredCount` sehen nur `S.facts`: Geteilt zählt nie für Inseln.
- Kandidaten (`divCands`): beide Geteilt-Aufgaben zu jedem lila Mal-Fakt einer offenen Reihe, ohne 1, wenn die 1er im Urlaub ist (`isRetired`). `pickTask(...,{div:true})` nimmt mit `DIV_SHARE` 0.12 eine Geteilt-Aufgabe (`pickDiv`), wenn mindestens `DIV_MIN` 3 Kandidaten da sind. Ohne `opts.div` nie Geteilt.
- Nur in Zaubertraining, Sternschnuppe (dort auch ohne Fach 2) und an normalen Wolkenflug-Toren (`makeDivOptions`: Nachbarn des Ergebnisses). Nie am Weltentor, nie als Blockade, nie im Inselritt, nie bei Kawumm. Rätsel-Teilaufgaben (`friendRiddle`) buchen weiter auf den Mal-Fakt.
- Anzeige "42 : 7", Sprache "42 geteilt durch 7". Elternbereich: Schalter "Geteilt-Aufgaben" (`S.divOn`, Standard an) und "Geteilt sicher x / y" (`divStats`).

