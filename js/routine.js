// Routine-Erkennung, Tagesreset, Abhaken, Fortschritt. DOM-frei (testbar).
import { parseTime, minutesOfDay, localDate } from './util.js';
import { ROUTINES } from './data/task-catalog.js';
import { ensureToday, spinKey } from './store.js';

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
 * { checked, remaining, completedNow, newSpin }
 */
export function toggleTask(state, routine, childId, taskId, today = localDate()) {
  ensureToday(state, today);
  const child = state.children.find(c => c.id === childId);
  if (!child || !child.tasks[routine].includes(taskId)) return null;
  const before = childStats(state, routine, child).complete;
  const list = new Set(doneOf(state, routine, childId));
  const checked = !list.has(taskId);
  if (checked) list.add(taskId); else list.delete(taskId);
  state.progress[routine][childId] = [...list];
  return { checked, ...afterChange(state, routine, child, before, today) };
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

function afterChange(state, routine, child, before, today) {
  const stats = childStats(state, routine, child);
  const completedNow = !before && stats.complete;
  let newSpin = false;
  if (completedNow) {
    const key = spinKey(today, routine, child.id);
    if (!(key in state.spins)) { state.spins[key] = 'pending'; newSpin = true; }
  }
  return { remaining: stats.total - stats.done, completedNow, newSpin };
}

export function spinStatus(state, routine, childId, today = localDate()) {
  return state.spins[spinKey(today, routine, childId)] ?? null;
}
