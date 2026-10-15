# Ticky ✅

Ticky ist eine installierbare Web-App (PWA), mit der Kinder ihre Morgen- und Abendroutine abhaken. Jede erledigte Aufgabe gibt Effekte und Sounds. Wer fertig ist, dreht am **Glücksrad**, gewinnt eine von 12 Figuren und schaut ihr bei der **Siegesparade** zu.

- 1–5 Kinder, jedes mit eigenem Style: **Pixel-Abenteuer**, **Neon-Arcade**, **Einhorn-Zauber**, **Dino-Expedition**, **Sternenreise** oder **Schatzinsel**
- Aufgaben aus einem Katalog wählen, eigene Aufgaben anlegen, Reihenfolge festlegen
- Morgen- und Abendroutine starten automatisch nach Uhrzeit. Außerhalb der Zeiten erscheint ein Ruhe-Bildschirm mit Countdown
- 72 eigene Figuren in fünf Raritäten (Standard 68 %, Magisch 25 %, Legendär 5 %, Mythisch 1,5 %, Geheim 0,5 %)
- **Figurenwelt:** Alle gewonnenen Figuren laufen in einer Landschaft passend zum Style herum und reagieren beim Antippen
- **Sternenstaub:** Doppelte Figuren werden zu Sternenstaub. Damit lassen sich Figuren auf Bronze, Silber und Gold aufwerten und Accessoires (Krone, Zylinder …) freischalten
- **Spieler-Level:** Jede fertige Routine bringt XP. Das Level bleibt dauerhaft, mit Titeln je Style und Sternenstaub als Geschenk beim Aufstieg
- **Buddy:** Eine Lieblingsfigur begleitet die Routine, jubelt beim Abhaken, gähnt abends und schläft nachts auf dem Ruhe-Bildschirm
- Eltern-Bereich mit Rechen-Sperre, Backup-Export und -Import
- Funktioniert vollständig offline

## Datenschutz

**Alle Daten bleiben auf dem Gerät** (im `localStorage` des Browsers). Es gibt keinen Server, kein Tracking, keine Cookies und keine Anfragen an fremde Domains, auch die Schriften sind selbst gehostet. Das Repository enthält keinerlei persönliche Daten.

Wenn du die Browserdaten löschst, ist alles weg. Ein Backup kannst du im Eltern-Bereich exportieren. Unter iOS kann Safari Daten nicht installierter Websites nach 7 Tagen ohne Nutzung löschen, deshalb solltest du Ticky dort zum Home-Bildschirm hinzufügen.

## Installation auf dem Gerät

- **Android/Chrome:** Seite öffnen → Banner „Als App speichern“ oder Menü ⋮ → „App installieren“
- **iPhone/iPad (Safari):** Teilen ⬆️ → „Zum Home-Bildschirm“

## Entwicklung

Es gibt keinen Build-Schritt: Vanilla HTML, CSS und JavaScript mit ES-Modulen. Starte einen beliebigen statischen Server im Projektordner:

```sh
python3 -m http.server 8000
# → http://localhost:8000
```

Logik-Tests (Node ≥ 20):

```sh
node --test tests/*.test.mjs
```

Hilfsskripte (nur für die Entwicklung):

- `node tools/update-sw-assets.mjs` aktualisiert die Offline-Dateiliste in `sw.js`
- `node tools/gen-pixel-figures.mjs` erzeugt die Pixel-Figuren aus ASCII-Rastern (die übrigen Figuren sind handgezeichnete SVGs)

## Deployment auf GitHub Pages

1. Inhalt in ein öffentliches Repo pushen (Branch `main`).
2. Settings → Pages → „Deploy from a branch“ → `main` / `(root)`.
3. Bei jedem Release `CACHE_VERSION` in `sw.js` und `VERSION` in `js/config.js` erhöhen, damit der Update-Hinweis erscheint.

## Lizenz

Code: MIT. Schriften (Nunito, Pixelify Sans, Baloo 2, Fredoka): SIL Open Font License 1.1.
