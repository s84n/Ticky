// localStorage-Zugriff, Schema, Validierung/Migration, Export/Import.
// Alle Nutzerdaten bleiben ausschließlich auf diesem Gerät (R-2).
import { localDate, daysBetween, parseTime } from './util.js';
import { THEME_IDS, THEMES } from './data/themes.js';
import { TASK_CATALOG, ROUTINES } from './data/task-catalog.js';
import { ACCESSORY_IDS, TEAM_MAX, pathOf, pickFocus, focusOf } from './data/progression.js';
import { RARITY_ORDER, figureById } from './data/figures.js';

export const STORAGE_KEY = 'ticky_v1';
export const SCHEMA_VERSION = 3;
export const MAX_CHILDREN = 5;
export const NAME_MAX = 20;
export const TASK_LABEL_MAX = 30;

export function createDefaultState() {
  return {
    schemaVersion: SCHEMA_VERSION,
    setupDone: false,
    settings: {
      routines: {
        morning: { start: '06:00', end: '10:00', goal: '' },
        evening: { start: '18:00', end: '22:00', goal: '' },
      },
      sound: true,
      speech: true,
      vibration: true,
      timer: true,
      reducedMotion: 'auto',
    },
    children: [],
    customTasks: {},
    progress: { date: localDate(), morning: {}, evening: {} },
    spins: {},
    ui: { activeChildId: null, manualRoutine: null, pwaDismissed: false },
  };
}

const isObj = v => v !== null && typeof v === 'object' && !Array.isArray(v);
const str = (v, max) => (typeof v === 'string' ? v.trim().slice(0, max) : '');

export function sanitizeName(name) {
  return str(name, NAME_MAX).replace(/\s+/g, ' ');
}

/** Normalisiert beliebige (evtl. kaputte/alte) Daten zu einem gültigen Zustand. Wirft nie. */
export function normalizeState(raw, today = localDate()) {
  const def = createDefaultState();
  if (!isObj(raw)) return def;
  const s = migrate(raw);

  const out = def;
  out.setupDone = s.setupDone === true;

  // Einstellungen
  const st = isObj(s.settings) ? s.settings : {};
  for (const r of ROUTINES) {
    const src = isObj(st.routines) && isObj(st.routines[r]) ? st.routines[r] : {};
    if (parseTime(src.start) !== null) out.settings.routines[r].start = normTime(src.start);
    if (parseTime(src.end) !== null) out.settings.routines[r].end = normTime(src.end);
    if (parseTime(src.goal) !== null) out.settings.routines[r].goal = normTime(src.goal);
  }
  for (const k of ['sound', 'speech', 'vibration', 'timer']) if (typeof st[k] === 'boolean') out.settings[k] = st[k];
  if (['auto', 'on', 'off'].includes(st.reducedMotion)) out.settings.reducedMotion = st.reducedMotion;

  // Eigene Aufgaben
  if (isObj(s.customTasks)) {
    for (const [id, t] of Object.entries(s.customTasks)) {
      if (!/^custom_[a-z0-9]{1,16}$/.test(id) || !isObj(t)) continue;
      const label = str(t.label, TASK_LABEL_MAX);
      if (!label || !ROUTINES.includes(t.routine)) continue;
      out.customTasks[id] = { icon: str(t.icon, 16) || '⭐', label, routine: t.routine };
    }
  }

  // Kinder
  const seen = new Set();
  if (Array.isArray(s.children)) {
    for (const c of s.children) {
      if (out.children.length >= MAX_CHILDREN) break;
      if (!isObj(c) || typeof c.id !== 'string' || !/^c_[a-z0-9]{1,16}$/.test(c.id) || seen.has(c.id)) continue;
      const name = sanitizeName(c.name);
      if (!name) continue;
      seen.add(c.id);
      const theme = THEME_IDS.includes(c.theme) ? c.theme : 'pixel';
      const avatar = str(c.avatar, 16) || THEMES[theme].avatars[0];
      const tasks = {};
      for (const r of ROUTINES) {
        const list = isObj(c.tasks) && Array.isArray(c.tasks[r]) ? c.tasks[r] : [];
        tasks[r] = [...new Set(list.filter(id => taskExists(id, r, out.customTasks)))];
      }
      const figures = {};
      if (isObj(c.figures)) {
        for (const [fid, n] of Object.entries(c.figures)) {
          if (/^[a-z]+_\d{2}$/.test(fid) && Number.isInteger(n) && n > 0) figures[fid] = Math.min(n, 9999);
        }
      }
      const sinceLegendary = Number.isInteger(c.sinceLegendary) && c.sinceLegendary >= 0 ? c.sinceLegendary : 0;
      const sinceUpgrade = nonNegInt(c.sinceUpgrade, 99);
      const xp = nonNegInt(c.xp, 99_999_999);
      const wardrobe = Array.isArray(c.wardrobe) ? [...new Set(c.wardrobe.filter(a => ACCESSORY_IDS.includes(a)))] : [];
      const evo = {};
      const acc = {};
      for (const fid of Object.keys(figures)) {
        const fig = figureById(fid);
        const stage = isObj(c.evo) ? c.evo[fid] : undefined;
        if (fig && Number.isInteger(stage) && stage > 0) evo[fid] = Math.min(stage, pathOf(fig).length);
        const a = isObj(c.acc) ? c.acc[fid] : undefined;
        if (wardrobe.includes(a)) acc[fid] = a;
      }
      const team = Array.isArray(c.team) ? [...new Set(c.team.filter(id => typeof id === 'string' && figures[id]))].slice(0, TEAM_MAX) : [];
      const kid = { id: c.id, name, theme, avatar, tasks, figures, sinceLegendary, sinceUpgrade, xp, wardrobe, evo, acc, team, focus: null };
      kid.focus = typeof c.focus === 'string' && figures[c.focus] ? c.focus : null;
      if (!focusOf(kid)) kid.focus = pickFocus(kid);
      out.children.push(kid);
    }
  }

  // Fortschritt
  const p = isObj(s.progress) ? s.progress : {};
  if (typeof p.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(p.date)) {
    out.progress.date = p.date;
    for (const r of ROUTINES) {
      if (!isObj(p[r])) continue;
      for (const [cid, list] of Object.entries(p[r])) {
        const child = out.children.find(c => c.id === cid);
        if (!child || !Array.isArray(list)) continue;
        out.progress[r][cid] = [...new Set(list.filter(id => child.tasks[r].includes(id)))];
      }
    }
  }

  // Spins
  if (isObj(s.spins)) {
    for (const [key, val] of Object.entries(s.spins)) {
      if (val !== 'pending' && val !== 'done') continue;
      const [date, routine, cid] = key.split('|');
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date ?? '') || !ROUTINES.includes(routine) || !seen.has(cid)) continue;
      out.spins[key] = val;
    }
  }
  cleanupSpins(out, today);

  // UI
  const ui = isObj(s.ui) ? s.ui : {};
  out.ui.activeChildId = seen.has(ui.activeChildId) ? ui.activeChildId : (out.children[0]?.id ?? null);
  out.ui.manualRoutine = isObj(ui.manualRoutine) && ROUTINES.includes(ui.manualRoutine.routine) && typeof ui.manualRoutine.date === 'string'
    ? { routine: ui.manualRoutine.routine, date: ui.manualRoutine.date }
    : null;
  out.ui.pwaDismissed = ui.pwaDismissed === true;

  if (out.children.length === 0) out.setupDone = false;
  return out;
}

function nonNegInt(v, max) {
  return Number.isInteger(v) && v > 0 ? Math.min(v, max) : 0;
}

function normTime(t) {
  const m = parseTime(t);
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
}

/**
 * Schema-Migrationen.
 * v1 → v2: Level, Sternenstaub, Aufwertungen und Buddy kamen dazu (Defaults aus normalizeState).
 * v2 → v3: Sternenstaub entfällt. Bronze/Silber/Gold werden zu freigeschalteten Upgrade-Stufen,
 *          Accessoires wandern nach `acc`, der Buddy wird Anführer des Teams (aufgefüllt mit den seltensten Figuren).
 */
function migrate(raw) {
  const v = Number(raw.schemaVersion) || 1;
  if (v >= 3 || !Array.isArray(raw.children)) return raw;
  return {
    ...raw,
    children: raw.children.map(c => {
      if (!isObj(c)) return c;
      const figures = isObj(c.figures) ? c.figures : {};
      const evo = {}, acc = {};
      if (isObj(c.upgrades)) {
        for (const [fid, u] of Object.entries(c.upgrades)) {
          if (!isObj(u)) continue;
          if (Number.isInteger(u.tier) && u.tier > 0) evo[fid] = u.tier;
          if (typeof u.acc === 'string') acc[fid] = u.acc;
        }
      }
      const byRarity = Object.keys(figures)
        .filter(id => figureById(id))
        .sort((a, b) => RARITY_ORDER.indexOf(figureById(b).rarity) - RARITY_ORDER.indexOf(figureById(a).rarity));
      const team = [...new Set([c.buddy, ...byRarity].filter(id => typeof id === 'string' && figures[id]))].slice(0, TEAM_MAX);
      return { ...c, evo, acc, team };
    }),
  };
}

export function taskExists(id, routine, customTasks) {
  if (typeof id !== 'string') return false;
  if (id.startsWith('custom_')) return customTasks[id]?.routine === routine;
  const t = TASK_CATALOG.find(x => x.id === id);
  return !!t && t[routine] !== undefined;
}

/** Entfernt Spin-Einträge, die älter als 2 Tage sind. */
export function cleanupSpins(state, today = localDate()) {
  for (const key of Object.keys(state.spins)) {
    const date = key.split('|')[0];
    if (daysBetween(date, today) > 2) delete state.spins[key];
  }
}

/** Setzt den Fortschritt zurück, wenn ein neuer Tag begonnen hat. Gibt true zurück, wenn zurückgesetzt wurde. */
export function ensureToday(state, today = localDate()) {
  if (state.progress.date === today) return false;
  state.progress = { date: today, morning: {}, evening: {} };
  return true;
}

export function spinKey(date, routine, childId) {
  return `${date}|${routine}|${childId}`;
}

/** Entfernt ein Kind samt aller zugehörigen Einträge. */
export function removeChild(state, childId) {
  state.children = state.children.filter(c => c.id !== childId);
  for (const r of ROUTINES) delete state.progress[r][childId];
  for (const key of Object.keys(state.spins)) if (key.endsWith(`|${childId}`)) delete state.spins[key];
  if (state.ui.activeChildId === childId) state.ui.activeChildId = state.children[0]?.id ?? null;
}

/** Löscht eine eigene Aufgabe überall. */
export function removeCustomTask(state, taskId) {
  delete state.customTasks[taskId];
  for (const c of state.children) for (const r of ROUTINES) c.tasks[r] = c.tasks[r].filter(id => id !== taskId);
  for (const r of ROUTINES) for (const cid of Object.keys(state.progress[r])) {
    state.progress[r][cid] = state.progress[r][cid].filter(id => id !== taskId);
  }
}

// ---------- Laufzeit: Laden / Speichern ----------

// Doppelt gespeichert: localStorage (synchron, sofort) und eine Kopie in IndexedDB (eigener Speicher,
// überlebt z. B., wenn localStorage geleert wurde oder nicht lesbar ist). Beim Start gewinnt der neuere Stand.

export let state = createDefaultState();
const listeners = new Set();
let mirrorTimer = null;
let dirty = false; // nur speichern, wenn sich etwas geändert hat (sonst überschreibt z. B. pagehide frischere Daten)

const IDB_NAME = 'ticky';
const IDB_STORE = 'kv';

function idbOpen() {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') { reject(new Error('kein IndexedDB')); return; }
    const req = indexedDB.open(IDB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(IDB_STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
    req.onblocked = () => reject(new Error('IndexedDB blockiert'));
  });
}

let dbPromise = null;
const db = () => (dbPromise ??= idbOpen().catch(e => { dbPromise = null; throw e; }));

async function idb(mode, fn) {
  const d = await db();
  return new Promise((resolve, reject) => {
    const tx = d.transaction(IDB_STORE, mode);
    const req = fn(tx.objectStore(IDB_STORE));
    tx.oncomplete = () => resolve(req?.result);
    tx.onerror = tx.onabort = () => reject(tx.error);
  });
}

const withTimeout = (p, ms) => Promise.race([p, new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), ms))]);

function readLocal() {
  try {
    const txt = localStorage.getItem(STORAGE_KEY);
    return txt ? JSON.parse(txt) : null;
  } catch (e) {
    console.warn('Ticky: gespeicherte Daten konnten nicht gelesen werden', e);
    return null;
  }
}

async function readMirror() {
  try {
    const txt = await withTimeout(idb('readonly', s => s.get(STORAGE_KEY)), 2000);
    return typeof txt === 'string' ? JSON.parse(txt) : null;
  } catch (e) {
    console.warn('Ticky: Kopie in IndexedDB nicht lesbar', e);
    return null;
  }
}

const usable = raw => isObj(raw) && raw.setupDone === true && Array.isArray(raw.children) && raw.children.length > 0;
const stamp = raw => (Number.isFinite(raw?.savedAt) ? raw.savedAt : 0);

/** Wählt aus beiden Speichern den brauchbaren, neueren Stand. */
export function pickNewest(a, b) {
  if (!usable(a)) return usable(b) ? b : a ?? b;
  if (!usable(b)) return a;
  return stamp(b) > stamp(a) ? b : a;
}

/** Lädt den Zustand. Fällt auf die IndexedDB-Kopie zurück, falls localStorage leer oder älter ist. */
export async function load() {
  const local = readLocal();
  const mirror = await readMirror();
  const raw = pickNewest(local, mirror);
  state = normalizeState(raw);
  if (raw && raw !== local && state.setupDone) {
    console.info('Ticky: Stand aus der IndexedDB-Kopie wiederhergestellt');
    dirty = true;
    saveNow();
  }
  return state;
}

export function save() {
  dirty = true;
  saveNow(); // sofort: Android kann die App im Hintergrund jederzeit beenden
  for (const fn of listeners) fn(state);
}

export function saveNow() {
  if (!dirty) return;
  // Ein leerer Zustand (Onboarding noch nicht fertig) überschreibt nie gespeicherte Daten. Löschen nur über resetAll().
  if (!state.setupDone) return;
  dirty = false;
  const txt = JSON.stringify({ ...state, savedAt: Date.now() });
  try {
    localStorage.setItem(STORAGE_KEY, txt);
  } catch (e) {
    console.warn('Ticky: Speichern fehlgeschlagen', e);
  }
  clearTimeout(mirrorTimer);
  mirrorTimer = setTimeout(() => writeMirror(txt), 150);
}

/** Schreibt die Kopie sofort (z. B. wenn die App in den Hintergrund geht). */
export function flush() {
  saveNow();
  if (mirrorTimer === null) return;
  clearTimeout(mirrorTimer);
  writeMirror(readLocalText());
}

function readLocalText() {
  try { return localStorage.getItem(STORAGE_KEY); } catch { return null; }
}

function writeMirror(txt) {
  mirrorTimer = null;
  if (!txt) return;
  idb('readwrite', s => s.put(txt, STORAGE_KEY)).catch(e => console.warn('Ticky: Kopie in IndexedDB fehlgeschlagen', e));
}

export function onChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function replaceState(next) {
  state = next;
  dirty = true;
  saveNow();
  for (const fn of listeners) fn(state);
}

export function resetAll() {
  try { localStorage.removeItem(STORAGE_KEY); } catch { /* egal */ }
  clearTimeout(mirrorTimer);
  mirrorTimer = null;
  idb('readwrite', s => s.delete(STORAGE_KEY)).catch(() => {});
  dirty = false;
  state = createDefaultState();
  for (const fn of listeners) fn(state);
}

// ---------- Backup ----------

export function exportBackup() {
  return JSON.stringify({ app: 'ticky', exportedAt: new Date().toISOString(), data: state }, null, 2);
}

/** Prüft eine Backup-Datei. Gibt den normalisierten Zustand zurück oder wirft einen Fehler mit deutscher Meldung. */
export function parseBackup(text) {
  let obj;
  try {
    obj = JSON.parse(text);
  } catch {
    throw new Error('Die Datei ist kein gültiges Backup (kein JSON).');
  }
  const data = isObj(obj) && obj.app === 'ticky' && isObj(obj.data) ? obj.data : null;
  if (!data || typeof data.schemaVersion !== 'number' || !Array.isArray(data.children)) {
    throw new Error('Die Datei ist kein Ticky-Backup.');
  }
  const next = normalizeState(data);
  if (next.children.length === 0) throw new Error('Im Backup sind keine Kinder enthalten.');
  return next;
}

/**
 * Fordert dauerhaften Speicher an. Ohne diese Freigabe darf der Browser (v. a. Android bei wenig Speicher
 * oder im Energiesparmodus) die Daten löschen. Chrome entscheidet selbst und sagt oft erst Ja, wenn die App
 * installiert ist – deshalb bei jedem Start erneut fragen. Gibt true zurück, wenn der Speicher geschützt ist.
 */
export async function requestPersistence() {
  try {
    if (!navigator.storage?.persist) return null;
    if (await navigator.storage.persisted()) return true;
    return await navigator.storage.persist();
  } catch {
    return null; // nicht unterstützt
  }
}

/** true = geschützt, false = Browser darf löschen, null = unbekannt. */
export async function persistenceStatus() {
  try {
    return navigator.storage?.persisted ? await navigator.storage.persisted() : null;
  } catch {
    return null;
  }
}
