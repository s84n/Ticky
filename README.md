# Ticky ✅

Ticky ist eine installierbare Web-App (PWA), mit der Kinder ihre Morgen- und Abendroutine abhaken. Jede erledigte Aufgabe gibt Effekte und Sounds. Wer fertig ist, dreht am **Glücksrad**, gewinnt Figuren oder Upgrades und schaut bei der **Siegesparade** zu. Das eigene Figuren-Team läuft danach auf dem Aufgaben-Bildschirm mit.

- 1–5 Kinder, jedes mit eigenem Style: **Pixel-Abenteuer**, **Neon-Arcade**, **Einhorn-Zauber**, **Dino-Expedition**, **Sternenreise** oder **Schatzinsel**
- Aufgaben aus einem Katalog wählen, eigene Aufgaben anlegen, Reihenfolge festlegen
- Morgen- und Abendroutine starten automatisch nach Uhrzeit. Außerhalb der Zeiten erscheint ein Ruhe-Bildschirm mit Countdown
- 72 eigene Figuren in fünf Raritäten (Standard 68 %, Magisch 25 %, Legendär 5 %, Mythisch 1,5 %, Geheim 0,5 %)
- **Team:** Bis zu 3 Figuren laufen unten auf der Karte des Kindes herum, flitzen zur abgehakten Aufgabe und feiern, wenn alles fertig ist. Nachts schlafen sie auf dem Ruhe-Bildschirm
- **Upgrade-Reise:** Jede neue Figur bringt eine Reise mit (Standard 2, Magisch 3, Legendär 4, Mythisch/Geheim 5 Stufen): 🎨 neue Farbe → ⚡ Turbo → 📏 Wachstum → 💃 Trick → 🌟 Verwandlung. Solange eine Reise läuft, hat das Rad ein goldenes Upgrade-Feld (35 %), spätestens beim 3. Dreh kommt das Upgrade sicher. Doppelte Figuren geben ein Upgrade für sich selbst
- **Album:** Alle Figuren, Team zusammenstellen, Anführer und verfolgte Reise wählen, Accessoires anziehen
- **Spieler-Level:** Jede fertige Routine bringt XP. Das Level bleibt dauerhaft, mit Titeln je Style und einem Accessoire (Krone, Zylinder …) als Geschenk beim Aufstieg
- Eltern-Bereich mit Rechen-Sperre, Backup-Export und -Import
- Funktioniert vollständig offline

## Datenschutz

**Alle Daten bleiben auf dem Gerät** (im `localStorage` des Browsers, zusätzlich als Kopie in IndexedDB). Ticky fragt bei jedem Start nach dauerhaftem Speicher, damit Android die Daten nicht im Sparmodus oder bei Speichermangel löscht. Es gibt keinen Server, kein Tracking, keine Cookies und keine Anfragen an fremde Domains, auch die Schriften sind selbst gehostet. Das Repository enthält keinerlei persönliche Daten.

Wenn du die Browser- bzw. App-Daten löschst, ist alles weg. Ein Backup kannst du im Eltern-Bereich exportieren und bei der Ersteinrichtung wiederherstellen. Unter iOS kann Safari Daten nicht installierter Websites nach 7 Tagen ohne Nutzung löschen, deshalb solltest du Ticky dort zum Home-Bildschirm hinzufügen.

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
