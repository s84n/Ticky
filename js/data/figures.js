// Die Figuren (12 pro Style) + Raritäts-Konfiguration für das Glücksrad.

/** Gesamtchance pro Rarität in Prozent. Wird gleichmäßig auf die Figuren der Rarität verteilt. */
export const RARITIES = {
  standard:  { label: 'Standard', reveal: 'Gefunden!', chance: 68, short: '68 %' },
  magisch:   { label: 'Magisch ✨', reveal: 'Magisch!', chance: 25, short: '25 %' },
  legendaer: { label: 'Legendär 🌟', reveal: 'LEGENDÄR!', chance: 5, short: '5 %' },
  mythisch:  { label: 'Mythisch 🔥', reveal: 'MYTHISCH!', chance: 1.5, short: '1,5 %' },
  geheim:    { label: 'Geheim ❓', reveal: 'GEHEIM!!', chance: 0.5, short: '0,5 %' },
};

/** Von häufig nach selten. */
export const RARITY_ORDER = ['standard', 'magisch', 'legendaer', 'mythisch', 'geheim'];

/** Mindestens legendär (setzt den Glücksbonus zurück, große Feier). */
export const isEpic = rarity => RARITY_ORDER.indexOf(rarity) >= 2;

/** Glücksbonus: nach so vielen Spins ohne Legendär (oder seltener) wird die Legendär-Chance mit LUCK_FACTOR multipliziert. */
export const LUCK_THRESHOLD = 15;
export const LUCK_FACTOR = 2;

/** head: Position für Accessoires in % (x, y) der Figurenfläche. */
const f = (theme, n, name, rarity, motion, head = [50, 10]) => ({
  id: `${theme}_${String(n).padStart(2, '0')}`,
  theme, name, rarity, motion, head,
  svg: `assets/figures/${theme}/${theme}_${String(n).padStart(2, '0')}.svg`,
});

export const FIGURES = [
  f('pixel', 1, 'Block-Schweinchen', 'standard', 'walk', [80, 26]),
  f('pixel', 2, 'Pixel-Huhn', 'standard', 'hop', [70, 12]),
  f('pixel', 3, 'Wollschaf', 'standard', 'walk', [84, 28]),
  f('pixel', 4, 'Kistenkobold', 'standard', 'hop', [50, 12]),
  f('pixel', 5, 'Pilz-Männchen', 'standard', 'hop', [50, 6]),
  f('pixel', 6, 'Kleiner Golem', 'standard', 'walk', [50, 8]),
  f('pixel', 7, 'Kristall-Fuchs', 'magisch', 'walk', [80, 10]),
  f('pixel', 8, 'Feuer-Fledermaus', 'magisch', 'fly', [50, 14]),
  f('pixel', 9, 'Smaragd-Schildkröte', 'magisch', 'walk', [91, 44]),
  f('pixel', 10, 'Diamant-Drache', 'legendaer', 'fly', [82, 8]),
  f('pixel', 11, 'Obsidian-Phönix', 'mythisch', 'fly', [50, 14]),
  f('pixel', 12, 'Sternen-Axolotl', 'geheim', 'walk', [72, 30]),

  f('neon', 1, 'Würfel-Robo', 'standard', 'walk', [50, 12]),
  f('neon', 2, 'Speed-Sneaker-Bot', 'standard', 'walk', [56, 22]),
  f('neon', 3, 'Hüpf-Slime', 'standard', 'hop', [50, 22]),
  f('neon', 4, 'Pixel-Hund', 'standard', 'walk', [80, 20]),
  f('neon', 5, 'Arcade-Geist', 'standard', 'fly', [50, 12]),
  f('neon', 6, 'Skate-Pinguin', 'standard', 'walk', [55, 10]),
  f('neon', 7, 'Neon-Jet', 'magisch', 'fly', [60, 30]),
  f('neon', 8, 'Laser-Katze', 'magisch', 'hop', [76, 14]),
  f('neon', 9, 'Hologramm-Hai', 'magisch', 'fly', [50, 20]),
  f('neon', 10, 'Goldener Mega-Mech', 'legendaer', 'walk', [50, 6]),
  f('neon', 11, 'Quanten-Drache', 'mythisch', 'fly', [84, 26]),
  f('neon', 12, 'Der Glitch', 'geheim', 'hop', [50, 22]),

  f('zauber', 1, 'Zauber-Häschen', 'standard', 'hop', [52, 30]),
  f('zauber', 2, 'Blütenfee', 'standard', 'fly', [55, 12]),
  f('zauber', 3, 'Glitzer-Marienkäfer', 'standard', 'fly', [50, 22]),
  f('zauber', 4, 'Wolken-Schäfchen', 'standard', 'fly', [82, 40]),
  f('zauber', 5, 'Pilz-Kobold', 'standard', 'hop', [50, 10]),
  f('zauber', 6, 'Mini-Pony', 'standard', 'walk', [84, 22]),
  f('zauber', 7, 'Silberschwan', 'magisch', 'fly', [78, 22]),
  f('zauber', 8, 'Regenbogen-Delfin', 'magisch', 'hop', [70, 30]),
  f('zauber', 9, 'Mondfee', 'magisch', 'fly', [55, 14]),
  f('zauber', 10, 'Sternen-Pegasus', 'legendaer', 'fly', [83, 22]),
  f('zauber', 11, 'Mond-Drache', 'mythisch', 'fly', [82, 30]),
  f('zauber', 12, 'Polarlicht-Einhorn', 'geheim', 'walk', [84, 24]),

  f('dino', 1, 'Baby-Triceratops', 'standard', 'walk', [80, 34]),
  f('dino', 2, 'Mini-Stegosaurus', 'standard', 'walk', [86, 48]),
  f('dino', 3, 'Schlüpfling', 'standard', 'hop', [50, 16]),
  f('dino', 4, 'Flugsaurier', 'standard', 'fly', [76, 32]),
  f('dino', 5, 'Tröten-Saurier', 'standard', 'walk', [76, 26]),
  f('dino', 6, 'Panzer-Saurier', 'standard', 'walk', [90, 56]),
  f('dino', 7, 'Langhals-Brachio', 'magisch', 'walk', [82, 6]),
  f('dino', 8, 'Blitz-Raptor', 'magisch', 'hop', [84, 22]),
  f('dino', 9, 'Bernstein-Libelle', 'magisch', 'fly', [70, 40]),
  f('dino', 10, 'Feuer-T-Rex', 'legendaer', 'walk', [76, 14]),
  f('dino', 11, 'Vulkan-Spinosaurus', 'mythisch', 'walk', [90, 36]),
  f('dino', 12, 'Knochen-Rex', 'geheim', 'walk', [80, 12]),

  f('weltraum', 1, 'Mini-Alien', 'standard', 'hop', [56, 26]),
  f('weltraum', 2, 'Mondhase', 'standard', 'hop', [64, 30]),
  f('weltraum', 3, 'Satellit', 'standard', 'fly', [64, 30]),
  f('weltraum', 4, 'Raketen-Pinguin', 'standard', 'fly', [70, 22]),
  f('weltraum', 5, 'Sternschnuppe', 'standard', 'fly', [61, 18]),
  f('weltraum', 6, 'Planeten-Schnecke', 'standard', 'walk', [89, 40]),
  f('weltraum', 7, 'Astro-Hund', 'magisch', 'walk', [70, 16]),
  f('weltraum', 8, 'Saturn-Qualle', 'magisch', 'fly', [50, 16]),
  f('weltraum', 9, 'Nebel-Fuchs', 'magisch', 'walk', [82, 22]),
  f('weltraum', 10, 'Kometen-Wal', 'legendaer', 'fly', [76, 26]),
  f('weltraum', 11, 'Supernova-Phönix', 'mythisch', 'fly', [50, 18]),
  f('weltraum', 12, 'Schwarzloch-Kätzchen', 'geheim', 'hop', [50, 22]),

  f('schatz', 1, 'Papagei', 'standard', 'fly', [66, 16]),
  f('schatz', 2, 'Krabbe', 'standard', 'walk', [50, 42]),
  f('schatz', 3, 'Kokos-Äffchen', 'standard', 'hop', [50, 18]),
  f('schatz', 4, 'Seestern', 'standard', 'hop', [50, 14]),
  f('schatz', 5, 'Piraten-Schildkröte', 'standard', 'walk', [80, 50]),
  f('schatz', 6, 'Möwe', 'standard', 'fly', [70, 36]),
  f('schatz', 7, 'Kraken-Baby', 'magisch', 'hop', [50, 18]),
  f('schatz', 8, 'Gold-Hai', 'magisch', 'fly', [64, 34]),
  f('schatz', 9, 'Kompass-Eule', 'magisch', 'fly', [50, 22]),
  f('schatz', 10, 'Geister-Schiff', 'legendaer', 'fly', [52, 8]),
  f('schatz', 11, 'Seeschlangen-König', 'mythisch', 'fly', [78, 12]),
  f('schatz', 12, 'Schatzkisten-Mimic', 'geheim', 'hop', [50, 10]),
];

export function figuresOf(theme) {
  return FIGURES.filter(fig => fig.theme === theme);
}

export function figureById(id) {
  return FIGURES.find(fig => fig.id === id) ?? null;
}
