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

## Lumis Extras in Stufen (seit v31)
- `ITEMS` in index.html: acht Extras mit je drei Stufen (`names`, `desc`, `crop`). Stand liegt in `S.gear` = {id: stufe}, `S.rewards` zählt eingelöste Geschenke. `S.items` ist nur noch Altlast (Zahl), `gearOf()` übersetzt alles.
- Geschenk-Meilensteine über Gesamtsterne (`rewardsEarned`, `rewardCost`: 20, dann 30, dann 45). Ausgaben für Inseln ändern daran nichts.
- Bei jedem Meilenstein wählt das Kind in `showGiftChoice` zwischen zwei Extras (immer die mit der niedrigsten Stufe). Kein Laden, keine Preise. Nichts daran als Shop umbauen.
- game.js bekommt die Ausrüstung als `gearKey(S.gear)` (JSON-Text), damit der Textur-Cache vergleichen kann.
- Jede Stufe muss in `unicornSVG` (Seite) und `unicornHeadSVG` (Reiter) sichtbar anders sein. Brillen überdecken das Auge nur halbtransparent.

## Inselbild (seit v31)
- `islands.js`: `scene` je Insel steuert ferne Bergkette (`farRange`), Berge und Bäume auf der Insel (`islandHills`, Basis y=116, rechts hinter den Bauplätzen) und die Klippe unter schwebenden Inseln (`islandCliff`). Berge haben keine Bodenlinie (`shape()` strichelt nur die Oberkante).

## Vorlesen (seit v33)
- `speak()` heilt sich selbst: Satz sprechen, auf `onstart` warten. Kein Start nach 1,5 s oder Fehler: abbrechen und nächsten Weg probieren (`lang` = nur de-DE, `voice` = feste Stimme mit `u.lang=voice.lang`, `plain` = Gerätestandard). Der Weg, der klappt, liegt in localStorage `einhorn_speechMode`.
- Android-Chrome: Stimme nie ohne passende Sprache setzen (Android meldet `de_DE`), sonst stumm. Dort kein `pause()`/`resume()`, wirkt wie Abbruch.
- Nie direkt nach `cancel()` sprechen, 150 ms warten.
- `unlockSpeech()` im ersten Fingertipp (für iOS). Nicht entfernen.
- Elternbereich: "Stimme testen" zeigt Stimmen, gesprochen x von y, Weg, Neuversuche, letzten Fehler.

## Nächste Insel (seit v34)
- Tippt man auf der Insel das Tier an, sagt es `nextIslandLine(r)`: wie viele lila Sterne (Box 3+) auf der neuesten offenen Insel noch fehlen (8 von 10 nötig), welche Insel dann kommt und einen Spieltipp.
- Tipp-Regel: viele neue Aufgaben (3+) → Inselritt; mehr wackelnde (Box 0-1) als fast sichere → Zaubertraining; sonst Wolkenflug mit schnellen Antworten (Box 2 → 3 nur bei schneller richtiger Antwort, siehe `applyResult`).
- Unter den Sternen der aktuellen Insel steht "x von 8 für die Ner-Insel". Elemente in `.islwrap` dürfen nicht schrumpfen (`flex-shrink:0`).

## Sicherung (seit v36)
- Einmal am Tag lädt die App beim Tippen auf einen Knopf im Rundenende-Screen `lumi-sicherung-JJJJ-MM-TT.json` in den Download-Ordner (`maybeDailyBackup`, Tag in localStorage `einhorn_lastBackup`). Downloads gehen nur direkt nach einem Fingertipp, darum dort.
- Elternbereich: "Jetzt sichern" und "Sicherungsdatei laden". `navigator.storage.persist()` wird beim Start angefragt.
- Feste Datei (seit v37, nur wenn `showSaveFilePicker` existiert): im Elternbereich einmal wählen, Griff liegt in IndexedDB `lumi-backup`, danach täglich überschreiben (`backupToFixed`). Fehlen Rechte oder die Funktion, gibt es wie bisher die Download-Datei.
- Kein Cloud-Dienst, keine Anmeldung. Bewusste Entscheidung von Simon: simpel.

## Kawumm: Rückwärtsreihen (seit v38, noch nicht live)
- Alles in `kawumm.js` (vor dem Hauptskript geladen). Lernlogik oben zwischen KW-LOGIC-START/END, in Node testbar (`require('./kawumm.js')`). Bild: `assets/kawumm.png` (freigestellte Vorlage von Simon, nicht nachzeichnen). Spiegeln nur per CSS `scaleX(-1)`.
- Live schalten: `KW_LIVE = true` in kawumm.js. Dann kommt beim Öffnen nach dem Intro einmal der Brief ("Post für Romy", Button "Ja, komm vorbei!" erst nach dem Vorlesen, mind. 5 s). Bis dahin sieht Romy nichts.
- Elternbereich, Abschnitt Kawumm: Testmodus (nur bis Neustart), Brief ansehen, Schatzkammer, Stimme, Brief zurücksetzen, Kawumm-Stand löschen, je Reihe Starten und Stufe umschalten.
- Stand liegt getrennt in `S.kw` = {joined, rows:{reihe:{stage:'sea'|'space', clean, runs, finds, steps:{k:{box,...}}}}}. Schritt k = von k·r nach (k-1)·r. Nie mit `S.facts` vermischen.
- Freischaltung: Start immer mit 1er rückwärts. Nächste Karte in `KW_ORDER` (1,2,10,5,4,8,3,6,9,7) nur, wenn die Karte davor im Weltall ist UND die eigene Vorwärtsreihe 5 von 10 lila hat. Ins Weltall: 2 Fahrten am Stück ohne Fehler, alle Antworten unter 4 s.
- Hilfe: Meer anfangs kommende Zahlen schwach sichtbar, nach einer sauberen Fahrt nur noch ?, Weltall nur aktuelle Zahl und Sprung. Störenfriede (Möwe, Alien) verdecken die Leiste: Meer 15 %, Weltall 30 %, nie zweimal hintereinander, nie in der ersten Fahrt. Super-Speed (Weltall, 35 %) startet mitten in der Reihe.
- Falsche Inseln: übersprungen, nur 1 weggenommen, Zehnerübergang vergessen (`kwOptions`).
- Schatzkammer: je Reihe ein verrückter Behälter (`KW_BOX`), jede geschaffte Fahrt bringt einen Schatz, 10 passen hinein. Zugang über Kawumms Schiff oben in der Inselwelt und nach jeder Fahrt.
- Kawumms Stimme: `speak(text, cb, KW_VOICE)` mit tieferer Tonhöhe (0.85, Lumi 1.14) und eigenem Tempo; im Sprechweg `voice` eine zweite deutsche Stimme, falls vorhanden. Nie Stimme ohne passende Sprache setzen (Android).
- Gemeinsam hüpfen: `kwDuoHTML`, Lumi immer ohne Regenbogen (`kwNoRainbow`).
