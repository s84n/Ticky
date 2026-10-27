# Ticky ✅

Ticky ist eine installierbare Web-App (PWA), mit der Kinder ihre Morgen- und Abendroutine abhaken. Jede erledigte Aufgabe gibt Effekte und Sounds. Wer fertig ist, dreht am **Glücksrad**, gewinnt Figuren oder Upgrades und schaut bei der **Siegesparade** zu. Das eigene Figuren-Team läuft danach auf dem Aufgaben-Bildschirm mit.

- 1–5 Kinder, jedes mit eigenem Style: **Pixel-Abenteuer**, **Neon-Arcade**, **Einhorn-Zauber**, **Dino-Expedition**, **Sternenreise** oder **Schatzinsel**
- Aufgaben aus einem Katalog wählen, eigene Aufgaben anlegen, Reihenfolge festlegen
- Morgen- und Abendroutine starten automatisch nach Uhrzeit. Außerhalb der Zeiten erscheint ein Ruhe-Bildschirm mit Countdown
- 72 eigene Figuren in fünf Raritäten (Standard 68 %, Magisch 25 %, Legendär 5 %, Mythisch 1,5 %, Geheim 0,5 %)
- **Team:** Bis zu 3 Figuren laufen unten auf der Karte des Kindes herum, flitzen zur abgehakten Aufgabe und feiern, wenn alles fertig ist. Nachts schlafen sie auf dem Ruhe-Bildschirm
- **Upgrade-Reise:** Jede neue Figur bringt eine Reise mit (Standard 2, Magisch 3, Legendär 4, Mythisch/Geheim 5 Stufen): 🎨 neue Farbe → ⚡ Turbo → 📏 Wachstum → 💃 Trick → 🌟 Verwandlung. Solange eine Reise läuft, hat das Rad goldene Upgrade-Felder (zusammen 35 %, bei jedem Dreh anders auf 2–4 Felder verteilt), spätestens beim 3. Dreh kommt das Upgrade sicher. Doppelte Figuren geben ein Upgrade für sich selbst. Figuren im Team bekommen ihre Reise bevorzugt, damit man die Upgrades bei den Aufgaben auch sieht
- **Sterne:** Ist die Reise geschafft, bringt jedes weitere Duplikat einen Stern (bis 5), jeder mit eigenem Effekt: ✨ Glitzer und Glitzerspur → 🖼️ Goldrahmen im Album → 💫 Goldschimmer → 🌠 Sternbegleiter → 🌈 Regenbogen. Danach gibt es Accessoires
- **Album:** Alle Figuren, Team zusammenstellen, Anführer und verfolgte Reise wählen, Accessoires anziehen
- **Spieler-Level:** Jede fertige Routine bringt XP. Das Level bleibt dauerhaft, mit Titeln je Style und einem Accessoire (Krone, Zylinder …) als Geschenk beim Aufstieg
- **Alle fertig:** Wenn alle Kinder fertig sind, feiern ihre Teams gemeinsam auf dem ganzen Bildschirm. Gewinn-, Level-up- und Feier-Anzeigen gehen nach ein paar Sekunden von selbst zu
- **Zufallsrad:** Im Eltern-Bereich lost ein Rad mit den Namen der Kinder aus, wer zuerst dran ist – auf Wunsch auch die ganze Reihenfolge
- **Eltern-Boost:** Für besonders gute Tage: +10/20/50 % auf XP und auf die Chancen für seltene Figuren und Upgrades, für 15, 30 oder 60 Minuten. Solange er läuft, zeigt der Kopf eine 🚀-Anzeige
- Eltern-Bereich mit Erwachsenen-Quiz als Sperre (2 Fragen aus einem Katalog von 60, nach Fehlversuchen kurze Wartezeit), Lautstärke-Regler, Sparmodus für schwächere Tablets, Backup-Export und -Import
- **Demo-Modus:** Glücksrad (auch mit festem Ergebnis), Level-up und Feiern ausprobieren, ohne dass sich Level, Figuren oder Fortschritt ändern. Beim Beenden ist alles wie vorher
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

Code: MIT. Schrift Inter (sowie die derzeit nicht geladenen Nunito, Pixelify Sans, Baloo 2, Fredoka): SIL Open Font License 1.1.
