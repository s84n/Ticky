// Reine Logik für das Glücksrad (ohne DOM) – Ziehung, Segmente, Zielwinkel. Wird von tests/ direkt genutzt.
import { RARITIES, RARITY_ORDER, LUCK_THRESHOLD, LUCK_FACTOR, figuresOf } from '../data/figures.js';

/** Rad-Reihenfolge: Raritäten verteilt, damit die seltenen Felder nicht nebeneinander liegen. */
const ORDER = ['standard', 'magisch', 'standard', 'legendaer', 'standard', 'magisch', 'standard', 'mythisch', 'standard', 'magisch', 'standard', 'geheim'];

/** Ordnet die 12 Figuren eines Styles in Rad-Reihenfolge an. */
export function wheelOrder(theme) {
  const pools = Object.fromEntries(RARITY_ORDER.map(r => [r, []]));
  for (const fig of figuresOf(theme)) pools[fig.rarity].push(fig);
  const out = [];
  for (const r of ORDER) if (pools[r].length) out.push(pools[r].shift());
  // Falls die Konfiguration abweicht: Reste anhängen
  for (const r of Object.keys(pools)) out.push(...pools[r]);
  return out;
}

/**
 * Wahrscheinlichkeiten (Summe 1) je Figur in Rad-Reihenfolge.
 * boost (Eltern-Boost, z. B. 1.2): alle Raritäten außer Standard werden um diesen Faktor wahrscheinlicher.
 */
export function figureWeights(figures, { luckBonus = false, boost = 1 } = {}) {
  const count = {};
  for (const fig of figures) count[fig.rarity] = (count[fig.rarity] ?? 0) + 1;
  const chance = {};
  for (const r of Object.keys(count)) chance[r] = RARITIES[r].chance;
  if (luckBonus && chance.legendaer) {
    const boosted = Math.min(100, chance.legendaer * LUCK_FACTOR);
    const rest = 100 - chance.legendaer;
    const scale = (100 - boosted) / rest;
    for (const r of Object.keys(chance)) chance[r] = r === 'legendaer' ? boosted : chance[r] * scale;
  }
  if (boost > 1 && chance.standard) {
    let rare = 0;
    for (const r of Object.keys(chance)) if (r !== 'standard') rare += (chance[r] *= boost);
    chance.standard = Math.max(5, 100 - rare);
  }
  const total = Object.values(chance).reduce((a, b) => a + b, 0);
  return figures.map(fig => chance[fig.rarity] / count[fig.rarity] / total);
}

/**
 * Teilt die Upgrade-Chance auf 2–4 unterschiedlich große Felder auf (z. B. 35 % → 15 + 12 + 8 %).
 * Die Gesamtchance bleibt gleich, das Rad wird aber spannender. Ohne offene Reise (chance 0): keine Felder.
 */
export function splitUpgrade(chance, rnd) {
  if (!chance) return [];
  const parts = Array.from({ length: 2 + Math.floor(rnd() * 3) }, () => 1 + rnd());
  const sum = parts.reduce((a, b) => a + b, 0);
  return parts.map(p => (p / sum) * chance);
}

/**
 * Rad-Felder: die Figuren in Rad-Reihenfolge, dazwischen gleichmäßig verteilt die Upgrade-Felder (nie nebeneinander).
 * Die Figuren teilen sich den Rest im alten Verhältnis.
 * Gibt [{ kind: 'figure', fig, i, weight } | { kind: 'upgrade', weight }] zurück (i = Index in figures).
 */
export function wheelSlots(figures, weights, pieces, rnd) {
  const scale = 1 - pieces.reduce((a, b) => a + b, 0);
  const slots = figures.map((fig, i) => ({ kind: 'figure', fig, i, weight: weights[i] * scale }));
  if (!pieces.length) return slots;
  const step = figures.length / pieces.length;
  const shift = rnd() * step;
  // Von hinten einfügen, damit die vorderen Positionen stimmen
  for (let j = pieces.length - 1; j >= 0; j--) slots.splice(Math.floor(shift + j * step), 0, { kind: 'upgrade', weight: pieces[j] });
  return slots;
}

export function hasLuckBonus(sinceLegendary) {
  return (sinceLegendary ?? 0) >= LUCK_THRESHOLD;
}

/** Gewichtete Ziehung. rnd liefert [0,1). Gibt den Index zurück. */
export function drawIndex(weights, rnd) {
  const r = rnd();
  let acc = 0;
  for (let i = 0; i < weights.length; i++) {
    acc += weights[i];
    if (r < acc) return i;
  }
  return weights.length - 1;
}

/** Segmente in Grad (im Uhrzeigersinn ab 12 Uhr). Die Optik nutzt immer die Basis-Wahrscheinlichkeiten. */
export function segments(weights) {
  const out = [];
  let a = 0;
  for (const w of weights) {
    const span = w * 360;
    out.push({ start: a, end: a + span });
    a += span;
  }
  out[out.length - 1].end = 360;
  return out;
}

/**
 * Zielrotation (Grad, im Uhrzeigersinn) für das Rad, damit der Zeiger oben im Segment `seg` stehen bleibt.
 * current: aktuelle Rotation; turns: volle Umdrehungen (5–7); posInSeg: 0..1 relative Position im Segment.
 */
export function targetRotation(current, seg, turns, posInSeg) {
  const p = 0.15 + 0.7 * posInSeg; // nie ganz am Rand und nicht exakt mittig erzwungen
  const theta = seg.start + (seg.end - seg.start) * p;
  const want = ((360 - theta) % 360 + 360) % 360;
  const cur = ((current % 360) + 360) % 360;
  let delta = want - cur;
  if (delta < 0) delta += 360;
  return current + turns * 360 + delta;
}

/** Welcher Segment-Index liegt bei der gegebenen Rotation unter dem Zeiger? */
export function segmentAt(rotation, segs) {
  const theta = ((360 - (rotation % 360)) % 360 + 360) % 360;
  for (let i = 0; i < segs.length; i++) if (theta >= segs[i].start && theta < segs[i].end) return i;
  return segs.length - 1;
}
