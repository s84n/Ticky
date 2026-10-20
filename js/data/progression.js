// Langzeit-Fortschritt: Spieler-Level, Upgrade-Reisen der Figuren, Team (3 Figuren auf dem Aufgaben-Bildschirm)
// und Accessoires. DOM-frei, damit tests/ die Regeln direkt prüfen können.
import { RARITY_ORDER, figureById } from './figures.js';

/** XP pro erledigter Aufgabe und Bonus für die komplette Routine. */
export const XP_PER_TASK = 10;
export const XP_ROUTINE_BONUS = 20;
/** Extra-XP, wenn ein Kind vor der Blitz-Zeit fertig ist. */
export const BLITZ_XP = 15;
export const MAX_LEVEL = 99;

/** So viele Figuren laufen auf dem Aufgaben-Bildschirm mit. */
export const TEAM_MAX = 3;

/** Anteil des goldenen Upgrade-Felds am Rad, solange eine Reise offen ist. */
export const UPGRADE_CHANCE = 0.35;
/** Nach so vielen Drehs ohne Upgrade kommt das nächste sicher. */
export const UPGRADE_PITY = 2;

/** Die Upgrade-Stufen. Jede Figur durchläuft einen Teil davon, immer in dieser Reihenfolge. */
export const EVO_STEPS = {
  farbe: { icon: '🎨', label: 'Neue Farbe', reveal: 'bekommt eine neue Farbe!' },
  tempo: { icon: '⚡', label: 'Turbo', reveal: 'wird superschnell!' },
  groesse: { icon: '📏', label: 'Wachstum', reveal: 'ist gewachsen!' },
  trick: { icon: '💃', label: 'Trick', reveal: 'hat einen Trick gelernt!' },
  verwandlung: { icon: '🌟', label: 'Verwandlung', reveal: 'hat sich verwandelt!' },
};

/** Je seltener die Figur, desto länger die Reise. */
export const EVO_PATHS = {
  standard: ['farbe', 'tempo'],
  magisch: ['farbe', 'tempo', 'groesse'],
  legendaer: ['farbe', 'tempo', 'groesse', 'verwandlung'],
  mythisch: ['farbe', 'tempo', 'groesse', 'trick', 'verwandlung'],
  geheim: ['farbe', 'tempo', 'groesse', 'trick', 'verwandlung'],
};

/** Accessoires: einmal freigeschaltet, für alle Figuren des Kindes nutzbar. */
export const ACCESSORIES = [
  { id: 'krone', icon: '👑', label: 'Krone' },
  { id: 'zylinder', icon: '🎩', label: 'Zylinder' },
  { id: 'schleife', icon: '🎀', label: 'Schleife' },
  { id: 'kappe', icon: '🧢', label: 'Kappe' },
  { id: 'bluete', icon: '🌸', label: 'Blüte' },
  { id: 'doktorhut', icon: '🎓', label: 'Doktorhut' },
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

/** Schaltet ein zufälliges, noch fehlendes Accessoire frei. Gibt die id zurück oder null (alle schon da). */
function giftAccessory(child, rnd) {
  child.wardrobe ??= [];
  const missing = ACCESSORY_IDS.filter(id => !child.wardrobe.includes(id));
  if (!missing.length) return null;
  const id = missing[Math.floor(rnd() * missing.length)];
  child.wardrobe.push(id);
  return id;
}

/**
 * Vergibt XP für eine fertige Routine (nur einmal pro Routine und Tag aufrufen).
 * Beim Level-Aufstieg gibt es ein Accessoire als Geschenk. Gibt { xp, levelBefore, levelAfter, gift } zurück.
 */
export function awardRoutine(child, taskCount, rnd = Math.random, blitz = 0) {
  const before = levelInfo(child.xp).level;
  const xp = taskCount * XP_PER_TASK + XP_ROUTINE_BONUS + blitz;
  child.xp = (child.xp ?? 0) + xp;
  const after = levelInfo(child.xp).level;
  const gift = after > before ? giftAccessory(child, rnd) : null;
  return { xp, blitz, levelBefore: before, levelAfter: after, gift };
}

// ---------- Upgrade-Reisen ----------

export const pathOf = fig => EVO_PATHS[fig.rarity] ?? EVO_PATHS.standard;
export const stageOf = (child, figId) => child.evo?.[figId] ?? 0;

/** Bereits freigeschaltete Upgrades einer Figur (Liste von Step-ids). */
export function stepsOf(child, fig) {
  return child ? pathOf(fig).slice(0, stageOf(child, fig.id)) : [];
}

export const hasStep = (child, fig, step) => stepsOf(child, fig).includes(step);
export const journeyOpen = (child, fig) => !!child.figures[fig.id] && stageOf(child, fig.id) < pathOf(fig).length;
export const nextStep = (child, fig) => pathOf(fig)[stageOf(child, fig.id)] ?? null;

/** Figur, deren Reise gerade verfolgt wird (oder null). */
export function focusOf(child) {
  const fig = child.focus ? figureById(child.focus) : null;
  return fig && journeyOpen(child, fig) ? fig : null;
}

/** Wählt die nächste offene Reise: die seltenste Figur zuerst. */
export function pickFocus(child) {
  let best = null;
  for (const id of Object.keys(child.figures)) {
    const fig = figureById(id);
    if (!fig || !journeyOpen(child, fig)) continue;
    if (!best || RARITY_ORDER.indexOf(fig.rarity) > RARITY_ORDER.indexOf(best.rarity)) best = fig;
  }
  return best?.id ?? null;
}

/** Schaltet das nächste Upgrade einer Figur frei. Gibt die Step-id zurück oder null (Reise schon fertig). */
export function applyUpgrade(child, fig) {
  if (!journeyOpen(child, fig)) return null;
  const step = nextStep(child, fig);
  child.evo ??= {};
  child.evo[fig.id] = stageOf(child, fig.id) + 1;
  if (child.focus === fig.id && !journeyOpen(child, fig)) child.focus = pickFocus(child);
  return step;
}

/** Erzwingt die Garantie (nach UPGRADE_PITY Drehs ohne Upgrade)? */
export const upgradeGuaranteed = child => (child.sinceUpgrade ?? 0) >= UPGRADE_PITY;

/**
 * Bucht eine gewonnene Figur ein.
 * Neu: kommt ins Team (falls Platz) und ihre Reise wird verfolgt, wenn sie seltener ist als die aktuelle.
 * Doppelt: gibt ein Upgrade für genau diese Figur; ist ihre Reise fertig, ein neues Accessoire.
 * Gibt { isNew, upgrade, gift } zurück.
 */
export function addFigure(child, fig, rnd = Math.random) {
  const had = child.figures[fig.id] ?? 0;
  child.figures[fig.id] = had + 1;
  child.team ??= [];
  if (!had) {
    if (child.team.length < TEAM_MAX) child.team.push(fig.id);
    const cur = focusOf(child);
    if (journeyOpen(child, fig) && (!cur || RARITY_ORDER.indexOf(fig.rarity) >= RARITY_ORDER.indexOf(cur.rarity))) child.focus = fig.id;
    return { isNew: true, upgrade: null, gift: null };
  }
  const upgrade = applyUpgrade(child, fig);
  return { isNew: false, upgrade, gift: upgrade ? null : giftAccessory(child, rnd) };
}

/** Zählt einen Dreh für die Garantie mit. hadTarget: Gab es beim Dreh ein Upgrade-Feld? */
export function trackSpin(child, gotUpgrade, hadTarget) {
  if (gotUpgrade) child.sinceUpgrade = 0;
  else if (hadTarget) child.sinceUpgrade = (child.sinceUpgrade ?? 0) + 1;
}

// ---------- Team, Reise wählen, Accessoires ----------

export const leaderOf = child => child.team?.[0] ?? null;

/** Nimmt eine Figur ins Team auf oder heraus. Gibt false zurück, wenn das Team voll ist. */
export function toggleTeam(child, figId) {
  if (!child.figures[figId]) return false;
  child.team ??= [];
  if (child.team.includes(figId)) { child.team = child.team.filter(id => id !== figId); return true; }
  if (child.team.length >= TEAM_MAX) return false;
  child.team.push(figId);
  return true;
}

/** Macht eine Figur zum Anführer (erster Platz im Team, ggf. ersetzt sie den letzten Platz). */
export function makeLeader(child, figId) {
  if (!child.figures[figId]) return false;
  const rest = (child.team ?? []).filter(id => id !== figId);
  child.team = [figId, ...rest].slice(0, TEAM_MAX);
  return true;
}

export function setFocus(child, figId) {
  const fig = figureById(figId);
  if (!fig || !journeyOpen(child, fig)) return false;
  child.focus = figId;
  return true;
}

export function accessoryOf(child, figId) {
  return child.acc?.[figId] ?? null;
}

/** Setzt (oder entfernt mit null) das Accessoire einer Figur. */
export function equipAccessory(child, figId, accId) {
  if (!child.figures[figId]) return false;
  if (accId !== null && !child.wardrobe?.includes(accId)) return false;
  child.acc ??= {};
  if (accId === null) delete child.acc[figId];
  else child.acc[figId] = accId;
  return true;
}
