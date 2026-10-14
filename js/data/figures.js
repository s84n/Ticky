// Die 30 Figuren (10 pro Style) + Raritäts-Konfiguration für das Glücksrad.

/** Gesamtchance pro Rarität in Prozent. Wird gleichmäßig auf die Figuren der Rarität verteilt. */
export const RARITIES = {
  standard:  { label: 'Standard', reveal: 'Gefunden!', chance: 70 },
  magisch:   { label: 'Magisch ✨', reveal: 'Magisch!', chance: 25 },
  legendaer: { label: 'Legendär 🌟', reveal: 'LEGENDÄR!', chance: 5 },
};

/** Glücksbonus: nach so vielen Spins ohne Legendär wird die Legendär-Chance mit LUCK_FACTOR multipliziert. */
export const LUCK_THRESHOLD = 15;
export const LUCK_FACTOR = 2;

const f = (theme, n, name, rarity, motion) => ({
  id: `${theme}_${String(n).padStart(2, '0')}`,
  theme, name, rarity, motion,
  svg: `assets/figures/${theme}/${theme}_${String(n).padStart(2, '0')}.svg`,
});

export const FIGURES = [
  f('pixel', 1, 'Block-Schweinchen', 'standard', 'walk'),
  f('pixel', 2, 'Pixel-Huhn', 'standard', 'hop'),
  f('pixel', 3, 'Wollschaf', 'standard', 'walk'),
  f('pixel', 4, 'Kistenkobold', 'standard', 'hop'),
  f('pixel', 5, 'Pilz-Männchen', 'standard', 'hop'),
  f('pixel', 6, 'Kleiner Golem', 'standard', 'walk'),
  f('pixel', 7, 'Kristall-Fuchs', 'magisch', 'walk'),
  f('pixel', 8, 'Feuer-Fledermaus', 'magisch', 'fly'),
  f('pixel', 9, 'Smaragd-Schildkröte', 'magisch', 'walk'),
  f('pixel', 10, 'Diamant-Drache', 'legendaer', 'fly'),

  f('neon', 1, 'Würfel-Robo', 'standard', 'walk'),
  f('neon', 2, 'Speed-Sneaker-Bot', 'standard', 'walk'),
  f('neon', 3, 'Hüpf-Slime', 'standard', 'hop'),
  f('neon', 4, 'Pixel-Hund', 'standard', 'walk'),
  f('neon', 5, 'Arcade-Geist', 'standard', 'fly'),
  f('neon', 6, 'Skate-Pinguin', 'standard', 'walk'),
  f('neon', 7, 'Neon-Jet', 'magisch', 'fly'),
  f('neon', 8, 'Laser-Katze', 'magisch', 'hop'),
  f('neon', 9, 'Hologramm-Hai', 'magisch', 'fly'),
  f('neon', 10, 'Goldener Mega-Mech', 'legendaer', 'walk'),

  f('zauber', 1, 'Zauber-Häschen', 'standard', 'hop'),
  f('zauber', 2, 'Blütenfee', 'standard', 'fly'),
  f('zauber', 3, 'Glitzer-Marienkäfer', 'standard', 'fly'),
  f('zauber', 4, 'Wolken-Schäfchen', 'standard', 'fly'),
  f('zauber', 5, 'Pilz-Kobold', 'standard', 'hop'),
  f('zauber', 6, 'Mini-Pony', 'standard', 'walk'),
  f('zauber', 7, 'Silberschwan', 'magisch', 'fly'),
  f('zauber', 8, 'Regenbogen-Delfin', 'magisch', 'hop'),
  f('zauber', 9, 'Mondfee', 'magisch', 'fly'),
  f('zauber', 10, 'Sternen-Pegasus', 'legendaer', 'fly'),
];

export function figuresOf(theme) {
  return FIGURES.filter(fig => fig.theme === theme);
}

export function figureById(id) {
  return FIGURES.find(fig => fig.id === id) ?? null;
}
