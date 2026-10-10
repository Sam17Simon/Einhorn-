# Einhorn-Einmaleins

Lern-App für das kleine Einmaleins und die Zahlenreihen 1 bis 10. Gebaut für ein siebenjähriges Kind, läuft als installierbare Web-App (PWA) auf iPad und Android.

## Modi
- **Wolkenflug**: Spiel aus Reiter-Sicht auf Lumi. 12 Tore durch drei Welten, Weltentore, Rätsel-Stopps mit Tierfreunden.
- **Zaubertraining**: 10 Aufgaben, Spracheingabe oder Zahlenfeld, Punktefeld nach Fehlern.
- **Reihen-Ritt**: eine Reihe laut aufsagen oder tippen, auf Zeit.
- **Sternschnuppe**: 60-Sekunden-Runde.
- **Meine Inseln**: Fortschritt pro Reihe, befreite Tierfreunde.
- **Elternbereich**: Lern-Backlog (10×10), Übungszeit, Trefferquote, Antwortzeiten, Sicherung.

## Lernlogik
Leitner-System pro Fakt (Box 0 bis 5), gewichtete Auswahl mit Wiederholung nach 1, 2, 4, 8 Tagen. Reihen in didaktischer Reihenfolge 2, 10, 5, 1, 4, 8, 3, 6, 9, 7. Neue Reihe öffnet bei 80 Prozent sicheren Fakten. Lernstand liegt lokal im Gerät (localStorage).

## Installieren
- **iPad**: Seite in Safari öffnen, Teilen, "Zum Home-Bildschirm".
- **Android**: Seite in Chrome öffnen, Menü, "App installieren".

## Entwicklung
`index.html` enthält Lernlogik, Menü, Trainingsmodi und Elternbereich. `game.js` ist die Wolkenritt-Szene auf PixiJS (`vendor/pixi.min.js`). Lumi kommt als ein Stück aus den SVG-Funktionen in `index.html`, in `assets/` liegen nur Effekt-Grafiken. Nach Änderungen in `sw.js` die Cache-Version hochzählen, sonst sehen installierte Geräte das Update erst verzögert.
