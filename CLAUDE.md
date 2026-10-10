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
