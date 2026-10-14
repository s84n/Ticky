import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createDefaultState, normalizeState, cleanupSpins, ensureToday, removeChild, removeCustomTask, parseBackup, exportBackup, spinKey } from '../js/store.js';
import { localDate, daysBetween } from '../js/util.js';
import { toggleTask, toggleAll, autoRoutine, currentRoutine, nextRoutine, isNight, validateTimes } from '../js/routine.js';

const child = (id, extra = {}) => ({
  id, name: 'Kind 1', theme: 'pixel', avatar: '⛏️',
  tasks: { morning: ['umziehen', 'zaehne'], evening: ['zaehne'] }, figures: {}, ...extra,
});

test('Defaults sind gültig und Onboarding ist offen', () => {
  const s = createDefaultState();
  assert.equal(s.schemaVersion, 1);
  assert.equal(s.setupDone, false);
  assert.deepEqual(s.children, []);
});

test('kaputte Daten führen nicht zum Absturz', () => {
  for (const raw of [null, 42, 'x', [], { children: 'nope' }, { settings: { routines: 5 } }, { children: [{ id: '<script>' }] }]) {
    const s = normalizeState(raw);
    assert.equal(s.setupDone, false);
    assert.equal(s.children.length, 0);
  }
});

test('Normalisierung: Name getrimmt/gekürzt, ungültige Aufgaben/Themes entfernt, max. 5 Kinder', () => {
  const raw = {
    schemaVersion: 1, setupDone: true,
    children: [
      child('c_a', { name: '   Ein sehr sehr langer Name der Länger ist  ', theme: 'gibtsnicht', tasks: { morning: ['umziehen', 'trinken', 'xyz', 'umziehen'], evening: [] } }),
      child('c_b'), child('c_c'), child('c_d'), child('c_e'), child('c_f'),
    ],
  };
  const s = normalizeState(raw);
  assert.equal(s.children.length, 5);
  assert.equal(s.children[0].name.length, 20);
  assert.equal(s.children[0].theme, 'pixel');
  assert.deepEqual(s.children[0].tasks.morning, ['umziehen']); // trinken gibt es morgens nicht
  assert.equal(s.setupDone, true);
});

test('lokales Datum statt UTC (0–2 Uhr korrekt)', () => {
  const d = new Date(2026, 9, 15, 0, 30); // 15.10.2026, 00:30 lokal
  assert.equal(localDate(d), '2026-10-15');
  assert.equal(daysBetween('2026-10-12', '2026-10-15'), 3);
  assert.equal(daysBetween('2026-03-28', '2026-03-30'), 2); // Zeitumstellung
});

test('alte Spins (> 2 Tage) werden aufgeräumt', () => {
  const s = normalizeState({ setupDone: true, children: [child('c_a')], spins: {
    '2026-10-10|morning|c_a': 'done', '2026-10-12|morning|c_a': 'pending', '2026-10-14|evening|c_a': 'pending', '2026-10-14|evening|c_zz': 'pending',
  } }, '2026-10-14');
  assert.deepEqual(Object.keys(s.spins).sort(), ['2026-10-12|morning|c_a', '2026-10-14|evening|c_a']);
  s.spins['2026-10-11|morning|c_a'] = 'done';
  cleanupSpins(s, '2026-10-14');
  assert.ok(!('2026-10-11|morning|c_a' in s.spins));
});

test('Tagesreset setzt Fortschritt zurück', () => {
  const s = normalizeState({ setupDone: true, children: [child('c_a')], progress: { date: '2026-10-13', morning: { c_a: ['umziehen'] }, evening: {} } });
  assert.deepEqual(s.progress.morning.c_a, ['umziehen']);
  assert.equal(ensureToday(s, '2026-10-14'), true);
  assert.deepEqual(s.progress.morning, {});
  assert.equal(ensureToday(s, '2026-10-14'), false);
});

test('Farm-Schutz: Ab- und Wieder-Anhaken ergibt kein zweites Rad', () => {
  const s = normalizeState({ setupDone: true, children: [child('c_a')] });
  const today = s.progress.date;
  toggleTask(s, 'morning', 'c_a', 'umziehen', today);
  const r1 = toggleTask(s, 'morning', 'c_a', 'zaehne', today);
  assert.equal(r1.completedNow, true);
  assert.equal(r1.newSpin, true);
  assert.equal(s.spins[spinKey(today, 'morning', 'c_a')], 'pending');
  const r2 = toggleTask(s, 'morning', 'c_a', 'zaehne', today);
  assert.equal(r2.checked, false);
  assert.equal(r2.remaining, 1);
  const r3 = toggleTask(s, 'morning', 'c_a', 'zaehne', today);
  assert.equal(r3.completedNow, true);
  assert.equal(r3.newSpin, false);
  const r4 = toggleAll(s, 'morning', 'c_a', today);
  assert.equal(r4.checked, false);
});

test('Kind löschen entfernt alle Einträge; eigene Aufgabe löschen entfernt sie überall', () => {
  const s = normalizeState({
    setupDone: true,
    customTasks: { custom_ab12: { icon: '🐶', label: 'Hund füttern', routine: 'morning' } },
    children: [child('c_a', { tasks: { morning: ['custom_ab12', 'zaehne'], evening: ['zaehne'] } }), child('c_b', { tasks: { morning: ['custom_ab12'], evening: ['zaehne'] } })],
    progress: { date: localDate(), morning: { c_a: ['custom_ab12'], c_b: ['custom_ab12'] }, evening: {} },
    spins: { [`${localDate()}|morning|c_b`]: 'pending' },
  });
  assert.deepEqual(s.children[0].tasks.morning, ['custom_ab12', 'zaehne']);
  removeCustomTask(s, 'custom_ab12');
  assert.deepEqual(s.children[0].tasks.morning, ['zaehne']);
  assert.deepEqual(s.progress.morning.c_a, []);
  removeChild(s, 'c_b');
  assert.equal(s.children.length, 1);
  assert.ok(!('c_b' in s.progress.morning));
  assert.equal(Object.keys(s.spins).length, 0);
});

test('Backup: Export → Import ergibt identischen Zustand', () => {
  const s = normalizeState({ setupDone: true, children: [child('c_a', { figures: { pixel_03: 2 } })] });
  const text = JSON.stringify({ app: 'ticky', data: s });
  assert.deepEqual(parseBackup(text), s);
  assert.throws(() => parseBackup('{kaputt'), /kein gültiges Backup/);
  assert.throws(() => parseBackup('{"app":"andere"}'), /kein Ticky-Backup/);
  assert.equal(typeof exportBackup(), 'string');
});

test('Routine-Erkennung, nächste Routine, Nacht, Validierung', () => {
  const settings = createDefaultState().settings;
  const at = (h, m) => new Date(2026, 9, 14, h, m);
  assert.equal(autoRoutine(settings, at(6, 0)), 'morning');
  assert.equal(autoRoutine(settings, at(9, 59)), 'morning');
  assert.equal(autoRoutine(settings, at(10, 0)), null);
  assert.equal(autoRoutine(settings, at(19, 0)), 'evening');
  assert.deepEqual(nextRoutine(settings, at(15, 45)), { routine: 'evening', inMinutes: 135 });
  assert.deepEqual(nextRoutine(settings, at(23, 0)), { routine: 'morning', inMinutes: 420 });
  assert.equal(isNight(settings, at(23, 0)), true);
  assert.equal(isNight(settings, at(1, 0)), true);
  assert.equal(isNight(settings, at(12, 0)), false);
  assert.deepEqual(validateTimes(settings.routines), []);
  assert.equal(validateTimes({ morning: { start: '06:00', end: '19:00' }, evening: { start: '18:00', end: '22:00' } }).length, 1);
  assert.equal(validateTimes({ morning: { start: '10:00', end: '09:00' }, evening: { start: '18:00', end: '22:00' } }).length, 1);
});

test('Manueller Start endet bei echter Routinezeit oder neuem Tag', () => {
  const s = createDefaultState();
  s.ui.manualRoutine = { routine: 'evening', date: '2026-10-14' };
  assert.deepEqual(currentRoutine(s, new Date(2026, 9, 14, 12, 0)), { routine: 'evening', manual: true });
  assert.deepEqual(currentRoutine(s, new Date(2026, 9, 14, 18, 0)), { routine: 'evening', manual: false });
  assert.equal(s.ui.manualRoutine, null);
  s.ui.manualRoutine = { routine: 'morning', date: '2026-10-14' };
  assert.equal(currentRoutine(s, new Date(2026, 9, 15, 12, 0)), null);
});
