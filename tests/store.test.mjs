import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createDefaultState, normalizeState, cleanupSpins, ensureToday, removeChild, removeCustomTask, parseBackup, exportBackup, spinKey } from '../js/store.js';
import { localDate, daysBetween } from '../js/util.js';
import { toggleTask, toggleAll, autoRoutine, currentRoutine, nextRoutine, isNight, validateTimes } from '../js/routine.js';
import {
  levelInfo, levelTitle, awardRoutine, addFigure, upgradeTier, buyAccessory, equipAccessory, tierOf, nextTierCost,
  XP_PER_TASK, XP_ROUTINE_BONUS, MAX_LEVEL, DUST_PER_LEVEL, DUST_PER_DUPLICATE, TIERS, MAX_TIER,
} from '../js/data/progression.js';
import { figureById } from '../js/data/figures.js';

const child = (id, extra = {}) => ({
  id, name: 'Kind 1', theme: 'pixel', avatar: '⛏️',
  tasks: { morning: ['umziehen', 'zaehne'], evening: ['zaehne'] }, figures: {}, ...extra,
});

test('Defaults sind gültig und Onboarding ist offen', () => {
  const s = createDefaultState();
  assert.equal(s.schemaVersion, 2);
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

test('Altes Schema (v1) bekommt Level, Sternenstaub und Buddy-Defaults', () => {
  const s = normalizeState({ schemaVersion: 1, setupDone: true, children: [child('c_a', { figures: { pixel_03: 2 } })] });
  const c = s.children[0];
  assert.equal(c.xp, 0);
  assert.equal(c.stardust, 0);
  assert.deepEqual(c.wardrobe, []);
  assert.deepEqual(c.upgrades, {});
  assert.equal(c.buddy, null);
});

test('Normalisierung: ungültige Aufwertungen, Accessoires und Buddys werden verworfen', () => {
  const s = normalizeState({ setupDone: true, children: [child('c_a', {
    figures: { pixel_03: 2, pixel_10: 1 }, xp: 1234, stardust: -5,
    wardrobe: ['krone', 'krone', 'gibtsnicht'],
    upgrades: { pixel_03: { tier: 9, acc: 'krone' }, pixel_10: { tier: 1, acc: 'zylinder' }, pixel_05: { tier: 2 } },
    buddy: 'pixel_07',
  })] });
  const c = s.children[0];
  assert.equal(c.xp, 1234);
  assert.equal(c.stardust, 0);
  assert.deepEqual(c.wardrobe, ['krone']);
  assert.deepEqual(c.upgrades, { pixel_03: { tier: 3, acc: 'krone' }, pixel_10: { tier: 1, acc: null } });
  assert.equal(c.buddy, null); // pixel_07 nicht gewonnen
});

test('XP gibt es nur beim ersten Abschluss der Routine (Farm-Schutz)', () => {
  const s = normalizeState({ setupDone: true, children: [child('c_a')] });
  const today = s.progress.date;
  toggleTask(s, 'morning', 'c_a', 'umziehen', today);
  const r1 = toggleTask(s, 'morning', 'c_a', 'zaehne', today);
  assert.deepEqual(r1.reward, { xp: 2 * XP_PER_TASK + XP_ROUTINE_BONUS, levelBefore: 1, levelAfter: 1, dust: 0 });
  toggleTask(s, 'morning', 'c_a', 'zaehne', today);
  const r2 = toggleTask(s, 'morning', 'c_a', 'zaehne', today);
  assert.equal(r2.reward, null);
  assert.equal(s.children[0].xp, 40);
});

test('Level-Kurve, Level-Aufstieg schenkt Sternenstaub', () => {
  assert.deepEqual(levelInfo(0), { level: 1, into: 0, need: 100 });
  assert.deepEqual(levelInfo(99), { level: 1, into: 99, need: 100 });
  assert.deepEqual(levelInfo(100), { level: 2, into: 0, need: 150 });
  assert.equal(levelInfo(250).level, 3);
  assert.equal(levelInfo(1e9).level, MAX_LEVEL);
  const c = { xp: 90, stardust: 0 };
  const r = awardRoutine(c, 5); // +70 XP → 160 → Level 2
  assert.equal(r.levelAfter, 2);
  assert.equal(c.stardust, DUST_PER_LEVEL);
  assert.equal(levelTitle(['A', 'B', 'C'], 1), 'A');
  assert.equal(levelTitle(['A', 'B', 'C'], 5), 'B');
  assert.equal(levelTitle(['A', 'B', 'C'], 99), 'C');
});

test('Duplikate werden zu Sternenstaub, erste Figur wird Buddy', () => {
  const c = { figures: {}, stardust: 0, buddy: null };
  const fig = figureById('neon_10');
  assert.deepEqual(addFigure(c, fig), { duplicate: false, dust: 0 });
  assert.equal(c.buddy, 'neon_10');
  assert.deepEqual(addFigure(c, fig), { duplicate: true, dust: DUST_PER_DUPLICATE.legendaer });
  addFigure(c, figureById('neon_01'));
  assert.equal(c.buddy, 'neon_10');
  assert.equal(c.figures.neon_10, 2);
});

test('Aufwerten und Accessoires kosten Sternenstaub, nur für eigene Figuren', () => {
  const c = { figures: { zauber_01: 1 }, stardust: 30, wardrobe: [], upgrades: {} };
  assert.equal(upgradeTier(c, 'zauber_02'), null); // nicht gewonnen
  assert.equal(upgradeTier(c, 'zauber_01'), 1);
  assert.equal(c.stardust, 30 - TIERS[1].cost);
  assert.equal(upgradeTier(c, 'zauber_01'), null); // zu wenig Staub
  c.stardust = 1000;
  upgradeTier(c, 'zauber_01'); upgradeTier(c, 'zauber_01');
  assert.equal(tierOf(c, 'zauber_01'), MAX_TIER);
  assert.equal(nextTierCost(c, 'zauber_01'), null);
  assert.equal(upgradeTier(c, 'zauber_01'), null);
  assert.equal(equipAccessory(c, 'zauber_01', 'krone'), false); // noch nicht freigeschaltet
  assert.equal(buyAccessory(c, 'krone'), true);
  assert.equal(buyAccessory(c, 'krone'), false); // schon vorhanden
  assert.equal(equipAccessory(c, 'zauber_01', 'krone'), true);
  assert.deepEqual(c.upgrades.zauber_01, { tier: 3, acc: 'krone' });
  assert.equal(equipAccessory(c, 'zauber_01', null), true);
  assert.equal(c.upgrades.zauber_01.acc, null);
});
