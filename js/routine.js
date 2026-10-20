// Routine-Erkennung, Tagesreset, Abhaken, Fortschritt. DOM-frei (testbar).
import { parseTime, minutesOfDay, localDate, formatTime } from './util.js';
import { ROUTINES } from './data/task-catalog.js';
import { ensureToday, spinKey } from './store.js';
import { awardRoutine, BLITZ_XP } from './data/progression.js';

function inWindow(min, start, end) {
  return start <= end ? min >= start && min < end : min >= start || min < end;
}

/** Laut Zeitplan aktive Routine oder null. */
export function autoRoutine(settings, now = new Date()) {
  const min = minutesOfDay(now);
  for (const r of ROUTINES) {
    const { start, end } = settings.routines[r];
    if (inWindow(min, parseTime(start), parseTime(end))) return r;
  }
  return null;
}

/** Aktive Routine inkl. manuellem Start. Räumt einen abgelaufenen manuellen Start auf. */
export function currentRoutine(state, now = new Date()) {
  const auto = autoRoutine(state.settings, now);
  const manual = state.ui.manualRoutine;
  if (manual) {
    // Manueller Start gilt, bis eine echte Routinezeit beginnt oder der Tag wechselt.
    const expired = manual.date !== localDate(now) || auto !== null;
    if (expired) state.ui.manualRoutine = null;
    else return { routine: manual.routine, manual: true };
  }
  return auto ? { routine: auto, manual: false } : null;
}

/** Nächste planmäßige Routine und Minuten bis dahin. */
export function nextRoutine(settings, now = new Date()) {
  const min = minutesOfDay(now);
  let best = null;
  for (const r of ROUTINES) {
    const start = parseTime(settings.routines[r].start);
    let diff = start - min;
    if (diff <= 0) diff += 24 * 60;
    if (!best || diff < best.inMinutes) best = { routine: r, inMinutes: diff };
  }
  return best;
}

/** Nacht = zwischen Abendende und Morgenstart. */
export function isNight(settings, now = new Date()) {
  const min = minutesOfDay(now);
  const eveEnd = parseTime(settings.routines.evening.end);
  const mornStart = parseTime(settings.routines.morning.start);
  return inWindow(min, eveEnd, mornStart);
}

/** Validiert Routinezeiten. Gibt eine Liste deutscher Fehlermeldungen zurück (leer = ok). */
export function validateTimes(routines) {
  const errors = [];
  const ranges = {};
  for (const r of ROUTINES) {
    const s = parseTime(routines[r]?.start);
    const e = parseTime(routines[r]?.end);
    const label = r === 'morning' ? 'Morgenroutine' : 'Abendroutine';
    if (s === null || e === null) { errors.push(`${label}: Bitte gültige Zeiten eingeben.`); continue; }
    if (e <= s) { errors.push(`${label}: Das Ende muss nach dem Start liegen.`); continue; }
    ranges[r] = [s, e];
  }
  if (ranges.morning && ranges.evening) {
    const [a1, a2] = ranges.morning;
    const [b1, b2] = ranges.evening;
    if (a1 < b2 && b1 < a2) errors.push('Morgen- und Abendroutine dürfen sich nicht überschneiden.');
  }
  return errors;
}

// ---------- Zeitleiste & Blitz-Bonus ----------

/** Ab diesem Rest-Anteil der Routine wird die Zeit knapp (Leiste wird orange, das Team müde). */
export const LOW_TIME = 0.2;

/** Automatische Blitz-Zeit: nach drei Vierteln des Zeitfensters, auf 5 Minuten gerundet. */
export function autoGoal(range) {
  const s = parseTime(range.start), e = parseTime(range.end);
  if (s === null || e === null || e <= s) return null;
  return formatTime(s + Math.round(((e - s) * 0.75) / 5) * 5);
}

/** Eingestellte Blitz-Zeit, falls sie im Zeitfenster liegt, sonst die automatische. */
export function goalOf(range) {
  const s = parseTime(range.start), e = parseTime(range.end), g = parseTime(range.goal);
  return g !== null && g > s && g <= e ? formatTime(g) : autoGoal(range);
}

/**
 * Zeitstand einer planmäßigen Routine: { p (verstrichen 0–1), left (Minuten), goalP, blitz, low }.
 * null, wenn die Zeitleiste aus ist oder die Routine von Hand gestartet wurde (dann gibt es kein Ende).
 */
export function timeInfo(settings, cur, now = new Date()) {
  if (!cur || cur.manual || settings.timer === false) return null;
  const range = settings.routines[cur.routine];
  const s = parseTime(range.start), e = parseTime(range.end);
  if (s === null || e === null || e <= s) return null;
  const min = minutesOfDay(now) + now.getSeconds() / 60;
  const p = Math.min(1, Math.max(0, (min - s) / (e - s)));
  const g = parseTime(goalOf(range));
  return { p, left: Math.max(0, Math.ceil(e - min)), goalP: (g - s) / (e - s), blitz: min < g, low: 1 - p <= LOW_TIME };
}

// ---------- Fortschritt ----------

export function tasksOf(child, routine) {
  return child.tasks[routine] ?? [];
}

export function doneOf(state, routine, childId) {
  return state.progress[routine][childId] ?? [];
}

export function childStats(state, routine, child) {
  const total = tasksOf(child, routine).length;
  const done = doneOf(state, routine, child.id).filter(id => child.tasks[routine].includes(id)).length;
  return { total, done, complete: total > 0 && done >= total };
}

export function overallStats(state, routine) {
  let total = 0, done = 0, completeChildren = 0;
  for (const c of state.children) {
    const s = childStats(state, routine, c);
    total += s.total; done += s.done;
    if (s.complete) completeChildren++;
  }
  return { total, done, allComplete: state.children.length > 0 && completeChildren === state.children.length };
}

/**
 * Schaltet eine Aufgabe um. Gibt zurück, was passiert ist:
 * { checked, remaining, completedNow, newSpin, reward }
 * reward ({ xp, blitz, levelBefore, levelAfter, gift }) gibt es nur beim ersten Abschluss der Routine am Tag.
 * blitz: Wer selbst vor der Blitz-Zeit fertig wird, bekommt BLITZ_XP extra.
 */
export function toggleTask(state, routine, childId, taskId, today = localDate(), { blitz = false } = {}) {
  ensureToday(state, today);
  const child = state.children.find(c => c.id === childId);
  if (!child || !child.tasks[routine].includes(taskId)) return null;
  const before = childStats(state, routine, child).complete;
  const list = new Set(doneOf(state, routine, childId));
  const checked = !list.has(taskId);
  if (checked) list.add(taskId); else list.delete(taskId);
  state.progress[routine][childId] = [...list];
  return { checked, ...afterChange(state, routine, child, before, today, blitz) };
}

/** Hakt alle Aufgaben eines Kindes ab (bzw. löst alle, wenn schon alle erledigt sind). */
export function toggleAll(state, routine, childId, today = localDate()) {
  ensureToday(state, today);
  const child = state.children.find(c => c.id === childId);
  if (!child) return null;
  const before = childStats(state, routine, child).complete;
  const checked = !before;
  state.progress[routine][childId] = checked ? [...child.tasks[routine]] : [];
  return { checked, ...afterChange(state, routine, child, before, today) };
}

function afterChange(state, routine, child, before, today, blitz = false) {
  const stats = childStats(state, routine, child);
  const completedNow = !before && stats.complete;
  let newSpin = false;
  let reward = null;
  if (completedNow) {
    const key = spinKey(today, routine, child.id);
    if (!(key in state.spins)) {
      state.spins[key] = 'pending';
      newSpin = true;
      reward = awardRoutine(child, stats.total, Math.random, blitz ? BLITZ_XP : 0); // Farm-Schutz: nur zusammen mit dem neuen Rad
    }
  }
  return { remaining: stats.total - stats.done, completedNow, newSpin, reward };
}

export function spinStatus(state, routine, childId, today = localDate()) {
  return state.spins[spinKey(today, routine, childId)] ?? null;
}
