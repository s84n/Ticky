// localStorage-Zugriff, Schema, Validierung/Migration, Export/Import.
// Alle Nutzerdaten bleiben ausschließlich auf diesem Gerät (R-2).
import { localDate, daysBetween, parseTime } from './util.js';
import { THEME_IDS, THEMES } from './data/themes.js';
import { TASK_CATALOG, ROUTINES } from './data/task-catalog.js';

export const STORAGE_KEY = 'ticky_v1';
export const SCHEMA_VERSION = 1;
export const MAX_CHILDREN = 5;
export const NAME_MAX = 20;
export const TASK_LABEL_MAX = 30;

export function createDefaultState() {
  return {
    schemaVersion: SCHEMA_VERSION,
    setupDone: false,
    settings: {
      routines: {
        morning: { start: '06:00', end: '10:00' },
        evening: { start: '18:00', end: '22:00' },
      },
      sound: true,
      speech: true,
      vibration: true,
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
  }
  for (const k of ['sound', 'speech', 'vibration']) if (typeof st[k] === 'boolean') out.settings[k] = st[k];
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
      out.children.push({ id: c.id, name, theme, avatar, tasks, figures, sinceLegendary });
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

function normTime(t) {
  const m = parseTime(t);
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
}

/** Schema-Migrationen. Aktuell nur Version 1. */
function migrate(raw) {
  const v = Number(raw.schemaVersion) || 1;
  if (v > SCHEMA_VERSION) return raw; // Neuere Version: so gut wie möglich lesen
  return raw;
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

export let state = createDefaultState();
const listeners = new Set();
let saveTimer = null;
let dirty = false; // nur speichern, wenn sich etwas geändert hat (sonst überschreibt z. B. pagehide frischere Daten)

export function load() {
  let raw = null;
  try {
    const txt = localStorage.getItem(STORAGE_KEY);
    if (txt) raw = JSON.parse(txt);
  } catch (e) {
    console.warn('Ticky: gespeicherte Daten konnten nicht gelesen werden', e);
  }
  state = normalizeState(raw);
  return state;
}

export function save() {
  dirty = true;
  clearTimeout(saveTimer);
  saveTimer = setTimeout(saveNow, 200);
  for (const fn of listeners) fn(state);
}

export function saveNow() {
  clearTimeout(saveTimer);
  if (!dirty) return;
  dirty = false;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (e) {
    console.warn('Ticky: Speichern fehlgeschlagen', e);
  }
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
  clearTimeout(saveTimer);
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

/** Fordert dauerhaften Speicher an (schützt v. a. unter iOS vor automatischem Löschen). */
export async function requestPersistence() {
  try {
    if (navigator.storage?.persist && !(await navigator.storage.persisted())) await navigator.storage.persist();
  } catch { /* nicht unterstützt */ }
}
