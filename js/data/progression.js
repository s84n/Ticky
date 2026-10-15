// Langzeit-Fortschritt: Spieler-Level, Sternenstaub, Aufwertungen (Bronze/Silber/Gold) und Accessoires.
// DOM-frei, damit tests/ die Regeln direkt prüfen können.

/** XP pro erledigter Aufgabe und Bonus für die komplette Routine. */
export const XP_PER_TASK = 10;
export const XP_ROUTINE_BONUS = 20;
export const MAX_LEVEL = 99;

/** Sternenstaub für eine doppelte Figur, je nach Rarität. */
export const DUST_PER_DUPLICATE = { standard: 5, magisch: 15, legendaer: 40, mythisch: 80, geheim: 150 };
/** Sternenstaub als Geschenk bei jedem Level-Aufstieg. */
export const DUST_PER_LEVEL = 25;

/** Aufwertungsstufen. cost = Preis, um diese Stufe zu erreichen. */
export const TIERS = [
  null,
  { id: 'bronze', label: 'Bronze', medal: '🥉', cost: 20 },
  { id: 'silber', label: 'Silber', medal: '🥈', cost: 50 },
  { id: 'gold', label: 'Gold', medal: '🥇', cost: 120 },
];
export const MAX_TIER = TIERS.length - 1;

/** Accessoires: einmal freigeschaltet, für alle Figuren des Kindes nutzbar. */
export const ACCESSORIES = [
  { id: 'krone', icon: '👑', label: 'Krone', cost: 40 },
  { id: 'zylinder', icon: '🎩', label: 'Zylinder', cost: 40 },
  { id: 'schleife', icon: '🎀', label: 'Schleife', cost: 40 },
  { id: 'kappe', icon: '🧢', label: 'Kappe', cost: 40 },
  { id: 'bluete', icon: '🌸', label: 'Blüte', cost: 40 },
  { id: 'doktorhut', icon: '🎓', label: 'Doktorhut', cost: 40 },
];
export const ACCESSORY_IDS = ACCESSORIES.map(a => a.id);
export const accessoryById = id => ACCESSORIES.find(a => a.id === id) ?? null;

/** XP, die man von Level n auf n+1 braucht. */
export function xpToNext(level) {
  return 100 + 50 * (level - 1);
}

/** Level-Infos zu einer XP-Summe: { level, into (XP im aktuellen Level), need (XP bis zum nächsten) }. */
export function levelInfo(xp) {
  let level = 1;
  let rest = Math.max(0, Math.floor(xp || 0));
  while (level < MAX_LEVEL && rest >= xpToNext(level)) {
    rest -= xpToNext(level);
    level++;
  }
  return { level, into: rest, need: level >= MAX_LEVEL ? 0 : xpToNext(level) };
}

/** Titel zum Level aus der Titelliste des Styles (alle 4 Level ein neuer). */
export function levelTitle(titles, level) {
  return titles[Math.min(titles.length - 1, Math.floor((level - 1) / 4))];
}

/**
 * Vergibt XP für eine fertige Routine (nur einmal pro Routine und Tag aufrufen).
 * Gibt { xp, levelBefore, levelAfter, dust } zurück.
 */
export function awardRoutine(child, taskCount) {
  const before = levelInfo(child.xp).level;
  const xp = taskCount * XP_PER_TASK + XP_ROUTINE_BONUS;
  child.xp = (child.xp ?? 0) + xp;
  const after = levelInfo(child.xp).level;
  const dust = (after - before) * DUST_PER_LEVEL;
  child.stardust = (child.stardust ?? 0) + dust;
  return { xp, levelBefore: before, levelAfter: after, dust };
}

/**
 * Bucht eine gewonnene Figur ein. Duplikate werden zu Sternenstaub.
 * Gibt { duplicate, dust } zurück.
 */
export function addFigure(child, fig) {
  const had = child.figures[fig.id] ?? 0;
  child.figures[fig.id] = had + 1;
  const dust = had > 0 ? DUST_PER_DUPLICATE[fig.rarity] ?? 0 : 0;
  child.stardust = (child.stardust ?? 0) + dust;
  if (!child.buddy) child.buddy = fig.id; // erste Figur wird automatisch zum Buddy
  return { duplicate: had > 0, dust };
}

export function tierOf(child, figId) {
  return child.upgrades?.[figId]?.tier ?? 0;
}

export function accessoryOf(child, figId) {
  return child.upgrades?.[figId]?.acc ?? null;
}

/** Kosten der nächsten Stufe oder null, wenn schon Gold. */
export function nextTierCost(child, figId) {
  const t = tierOf(child, figId);
  return t >= MAX_TIER ? null : TIERS[t + 1].cost;
}

/** Wertet eine Figur um eine Stufe auf. Gibt die neue Stufe zurück oder null (nicht möglich). */
export function upgradeTier(child, figId) {
  if (!child.figures[figId]) return null;
  const cost = nextTierCost(child, figId);
  if (cost === null || (child.stardust ?? 0) < cost) return null;
  child.stardust -= cost;
  child.upgrades ??= {};
  const cur = child.upgrades[figId] ?? { tier: 0, acc: null };
  child.upgrades[figId] = { ...cur, tier: cur.tier + 1 };
  return cur.tier + 1;
}

/** Schaltet ein Accessoire frei. true bei Erfolg. */
export function buyAccessory(child, accId) {
  const acc = accessoryById(accId);
  child.wardrobe ??= [];
  if (!acc || child.wardrobe.includes(accId) || (child.stardust ?? 0) < acc.cost) return false;
  child.stardust -= acc.cost;
  child.wardrobe.push(accId);
  return true;
}

/** Setzt (oder entfernt mit null) das Accessoire einer Figur. */
export function equipAccessory(child, figId, accId) {
  if (!child.figures[figId]) return false;
  if (accId !== null && !child.wardrobe?.includes(accId)) return false;
  child.upgrades ??= {};
  const cur = child.upgrades[figId] ?? { tier: 0, acc: null };
  child.upgrades[figId] = { ...cur, acc: accId };
  return true;
}
