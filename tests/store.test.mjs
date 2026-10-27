import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createDefaultState, normalizeState, cleanupSpins, ensureToday, removeChild, removeCustomTask, parseBackup, exportBackup, spinKey, pickNewest } from '../js/store.js';
import { localDate, daysBetween } from '../js/util.js';
import { toggleTask, toggleAll, autoRoutine, currentRoutine, nextRoutine, isNight, validateTimes, autoGoal, goalOf, timeInfo } from '../js/routine.js';
import {
  levelInfo, levelTitle, awardRoutine, addFigure, applyUpgrade, trackSpin, upgradeGuaranteed, hasStep, journeyOpen,
  toggleTeam, makeLeader, setFocus, focusOf, pickFocus, addStar, starsOf, perksOf, STAR_MAX, STAR_PERKS, equipAccessory, accessoryOf,
  XP_PER_TASK, XP_ROUTINE_BONUS, BLITZ_XP, MAX_LEVEL, ACCESSORY_IDS, TEAM_MAX, EVO_PATHS, UPGRADE_PITY,
} from '../js/data/progression.js';
import { figureById } from '../js/data/figures.js';

const child = (id, extra = {}) => ({
  id, name: 'Kind 1', theme: 'pixel', avatar: '⛏️',
  tasks: { morning: ['umziehen', 'zaehne'], evening: ['zaehne'] }, figures: {}, ...extra,
});

test('Defaults sind gültig und Onboarding ist offen', () => {
  const s = createDefaultState();
  assert.equal(s.schemaVersion, 3);
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

test('XP gibt es nur beim ersten Abschluss der Routine (Farm-Schutz)', () => {
  const s = normalizeState({ setupDone: true, children: [child('c_a')] });
  const today = s.progress.date;
  toggleTask(s, 'morning', 'c_a', 'umziehen', today);
  const r1 = toggleTask(s, 'morning', 'c_a', 'zaehne', today);
  assert.deepEqual(r1.reward, { xp: 2 * XP_PER_TASK + XP_ROUTINE_BONUS, blitz: 0, boostXp: 0, levelBefore: 1, levelAfter: 1, gift: null });
  toggleTask(s, 'morning', 'c_a', 'zaehne', today);
  const r2 = toggleTask(s, 'morning', 'c_a', 'zaehne', today);
  assert.equal(r2.reward, null);
  assert.equal(s.children[0].xp, 40);
});

test('Eltern-Boost: +20 % XP, nur solange er läuft; abgelaufene Boosts fallen beim Laden weg', () => {
  const s = normalizeState({ setupDone: true, children: [child('c_a')], boost: { pct: 20, until: Date.now() + 60_000 } });
  assert.equal(s.boost.pct, 20);
  const today = s.progress.date;
  toggleTask(s, 'morning', 'c_a', 'umziehen', today);
  const r = toggleTask(s, 'morning', 'c_a', 'zaehne', today);
  assert.equal(r.reward.xp, 48);
  assert.equal(r.reward.boostXp, 8);
  assert.equal(normalizeState({ setupDone: true, children: [child('c_a')], boost: { pct: 20, until: Date.now() - 1 } }).boost, null);
  assert.equal(normalizeState({ setupDone: true, children: [child('c_a')], boost: { pct: 33, until: Date.now() + 60_000 } }).boost, null);
});

test('Level-Kurve, Level-Aufstieg schenkt ein Accessoire', () => {
  assert.deepEqual(levelInfo(0), { level: 1, into: 0, need: 100 });
  assert.deepEqual(levelInfo(99), { level: 1, into: 99, need: 100 });
  assert.deepEqual(levelInfo(100), { level: 2, into: 0, need: 150 });
  assert.equal(levelInfo(250).level, 3);
  assert.equal(levelInfo(1e9).level, MAX_LEVEL);
  const c = { xp: 90, wardrobe: [] };
  const r = awardRoutine(c, 5, () => 0); // +70 XP → 160 → Level 2
  assert.equal(r.levelAfter, 2);
  assert.equal(r.gift, ACCESSORY_IDS[0]);
  assert.deepEqual(c.wardrobe, [ACCESSORY_IDS[0]]);
  c.wardrobe = [...ACCESSORY_IDS];
  assert.equal(awardRoutine(c, 50).gift, null); // alle schon da
  assert.equal(levelTitle(['A', 'B', 'C'], 1), 'A');
  assert.equal(levelTitle(['A', 'B', 'C'], 5), 'B');
  assert.equal(levelTitle(['A', 'B', 'C'], 99), 'C');
});

const kid = () => ({ figures: {}, wardrobe: [], evo: {}, acc: {}, team: [], focus: null, sinceUpgrade: 0 });

test('Neue Figur: kommt ins Team (max. 3), seltenste offene Reise wird verfolgt', () => {
  const c = kid();
  assert.deepEqual(addFigure(c, figureById('pixel_01')), { isNew: true, upgrade: null, star: null, gift: null });
  assert.equal(c.focus, 'pixel_01');
  addFigure(c, figureById('pixel_10')); // legendär → wird verfolgt
  assert.equal(c.focus, 'pixel_10');
  addFigure(c, figureById('pixel_02')); // standard → Fokus bleibt
  assert.equal(c.focus, 'pixel_10');
  addFigure(c, figureById('pixel_03'));
  assert.deepEqual(c.team, ['pixel_01', 'pixel_10', 'pixel_02']);
  assert.equal(TEAM_MAX, 3);
});

test('Reise: Figuren im Team gehen vor, eine seltene Figur im Album löst sie nicht ab', () => {
  const c = kid();
  for (const id of ['pixel_01', 'pixel_02', 'pixel_03']) addFigure(c, figureById(id));
  addFigure(c, figureById('pixel_10')); // legendär, aber das Team ist voll
  assert.deepEqual(c.team, ['pixel_01', 'pixel_02', 'pixel_03']);
  assert.ok(c.team.includes(c.focus));
  assert.ok(c.team.includes(pickFocus(c)));
  c.team = ['pixel_10'];
  assert.equal(pickFocus(c), 'pixel_10');
});

test('Upgrade-Reise: Länge je Rarität, Reihenfolge, danach nächste Reise', () => {
  assert.deepEqual(EVO_PATHS.standard, ['farbe', 'tempo']);
  assert.equal(EVO_PATHS.legendaer.at(-1), 'verwandlung');
  assert.equal(EVO_PATHS.geheim.length, 5);
  const c = kid();
  const leg = figureById('neon_10'), std = figureById('neon_01');
  addFigure(c, std); addFigure(c, leg);
  assert.equal(c.focus, 'neon_10');
  const got = [];
  for (let i = 0; i < 4; i++) got.push(applyUpgrade(c, leg));
  assert.deepEqual(got, ['farbe', 'tempo', 'groesse', 'verwandlung']);
  assert.ok(hasStep(c, leg, 'verwandlung'));
  assert.equal(journeyOpen(c, leg), false);
  assert.equal(applyUpgrade(c, leg), null);
  assert.equal(c.focus, 'neon_01'); // nächste offene Reise
});

test('Doppelte Figur: Upgrade für sie, nach fertiger Reise Sterne, danach Accessoires', () => {
  const c = kid();
  const fig = figureById('zauber_01');
  addFigure(c, fig);
  assert.deepEqual(addFigure(c, fig), { isNew: false, upgrade: 'farbe', star: null, gift: null });
  assert.deepEqual(addFigure(c, fig), { isNew: false, upgrade: 'tempo', star: null, gift: null });
  for (let n = 1; n <= STAR_MAX; n++) assert.deepEqual(addFigure(c, fig), { isNew: false, upgrade: null, star: n, gift: null });
  assert.deepEqual(perksOf(c, fig.id), STAR_PERKS.map(p => p.id));
  const r = addFigure(c, fig, () => 0);
  assert.equal(r.star, null);
  assert.equal(r.gift, ACCESSORY_IDS[0]);
  assert.equal(c.figures.zauber_01, 4 + STAR_MAX);
  assert.equal(starsOf(c, fig.id), STAR_MAX);
  assert.equal(STAR_MAX, 5);
});

test('Sterne: nur nach fertiger Reise, Normalisierung repariert sie', () => {
  const c = kid();
  const fig = figureById('neon_10');
  addFigure(c, fig);
  assert.equal(addStar(c, fig), null); // Reise noch offen
  const s = normalizeState({ schemaVersion: 3, setupDone: true, children: [child('c_a', {
    figures: { pixel_01: 3, pixel_02: 1, pixel_10: 1 },
    evo: { pixel_01: 2, pixel_10: 1 },
    stars: { pixel_01: 9, pixel_02: 2, pixel_10: 1, pixel_05: 3 },
  })] });
  assert.deepEqual(s.children[0].stars, { pixel_01: 5 });
});

test('Garantie: nach zwei Drehs ohne Upgrade kommt es sicher', () => {
  const c = kid();
  trackSpin(c, false, false);
  assert.equal(c.sinceUpgrade, 0); // ohne Upgrade-Feld zählt nichts
  trackSpin(c, false, true);
  assert.equal(upgradeGuaranteed(c), false);
  trackSpin(c, false, true);
  assert.equal(upgradeGuaranteed(c), true);
  trackSpin(c, true, true);
  assert.equal(c.sinceUpgrade, 0);
  assert.equal(UPGRADE_PITY, 2);
});

test('Team, Anführer, Reise wählen und Accessoires nur für eigene Figuren', () => {
  const c = kid();
  for (const id of ['dino_01', 'dino_02', 'dino_03', 'dino_04']) addFigure(c, figureById(id));
  assert.equal(toggleTeam(c, 'dino_04'), false); // voll
  assert.equal(toggleTeam(c, 'dino_02'), true);
  assert.deepEqual(c.team, ['dino_01', 'dino_03']);
  makeLeader(c, 'dino_04');
  assert.deepEqual(c.team, ['dino_04', 'dino_01', 'dino_03']);
  assert.equal(setFocus(c, 'dino_09'), false); // nicht gewonnen
  assert.equal(setFocus(c, 'dino_03'), true);
  assert.equal(focusOf(c).id, 'dino_03');
  assert.equal(equipAccessory(c, 'dino_01', 'krone'), false); // noch nicht im Schrank
  c.wardrobe.push('krone');
  assert.equal(equipAccessory(c, 'dino_01', 'krone'), true);
  assert.equal(accessoryOf(c, 'dino_01'), 'krone');
  assert.equal(equipAccessory(c, 'dino_01', null), true);
  assert.equal(accessoryOf(c, 'dino_01'), null);
});

test('Migration v2 → v3: Stufen werden Upgrades, Buddy wird Anführer, Sternenstaub entfällt', () => {
  const s = normalizeState({ schemaVersion: 2, setupDone: true, children: [child('c_a', {
    figures: { pixel_01: 3, pixel_07: 1, pixel_10: 1, pixel_12: 1, pixel_02: 1 }, xp: 1234, stardust: 500,
    wardrobe: ['krone', 'krone', 'gibtsnicht'],
    upgrades: { pixel_01: { tier: 3, acc: 'krone' }, pixel_10: { tier: 1, acc: 'zylinder' }, pixel_05: { tier: 2 } },
    buddy: 'pixel_07',
  })] });
  const c = s.children[0];
  assert.equal(c.xp, 1234);
  assert.ok(!('stardust' in c) && !('upgrades' in c) && !('buddy' in c));
  assert.deepEqual(c.wardrobe, ['krone']);
  assert.deepEqual(c.evo, { pixel_01: 2, pixel_10: 1 }); // Standard hat nur 2 Stufen; pixel_05 nicht gewonnen
  assert.deepEqual(c.acc, { pixel_01: 'krone' });        // Zylinder nicht im Schrank
  assert.deepEqual(c.team, ['pixel_07', 'pixel_12', 'pixel_10']); // Buddy vorne, dann die seltensten
  assert.equal(c.focus, 'pixel_12');                     // geheim, Reise offen
});

test('Normalisierung v3: ungültiges Team, Upgrades und Fokus werden repariert', () => {
  const s = normalizeState({ schemaVersion: 3, setupDone: true, children: [child('c_a', {
    figures: { pixel_01: 1, pixel_02: 1 },
    evo: { pixel_01: 99, pixel_09: 2, pixel_02: -1 },
    team: ['pixel_01', 'pixel_01', 'pixel_09', 'pixel_02', 'x'],
    focus: 'pixel_01', sinceUpgrade: 1,
  })] });
  const c = s.children[0];
  assert.deepEqual(c.evo, { pixel_01: 2 });
  assert.deepEqual(c.team, ['pixel_01', 'pixel_02']);
  assert.equal(c.focus, 'pixel_02'); // Reise von pixel_01 ist schon fertig
  assert.equal(c.sinceUpgrade, 1);
});

test('Laden: neuerer, brauchbarer Stand aus localStorage oder IndexedDB gewinnt', () => {
  const full = (savedAt) => ({ setupDone: true, children: [child('c_a')], savedAt });
  const a = full(100), b = full(200);
  assert.equal(pickNewest(a, b), b);
  assert.equal(pickNewest(b, a), b);
  assert.equal(pickNewest(null, a), a);           // localStorage leer → Kopie
  assert.equal(pickNewest({ setupDone: false, children: [] }, a), a); // leerer Stand verliert immer
  assert.equal(pickNewest(a, null), a);
  assert.equal(pickNewest(null, null), null);
});

test('Blitz-Zeit: automatisch nach drei Vierteln, eigene nur innerhalb des Zeitfensters', () => {
  assert.equal(autoGoal({ start: '06:00', end: '10:00' }), '09:00');
  assert.equal(autoGoal({ start: '06:30', end: '07:40' }), '07:25');
  assert.equal(goalOf({ start: '06:00', end: '10:00', goal: '07:30' }), '07:30');
  assert.equal(goalOf({ start: '06:00', end: '10:00', goal: '05:30' }), '09:00');
  assert.equal(goalOf({ start: '06:00', end: '10:00', goal: '' }), '09:00');
  const s = normalizeState({ settings: { routines: { morning: { start: '06:00', end: '10:00', goal: '7:30' } }, timer: false } });
  assert.equal(s.settings.routines.morning.goal, '07:30');
  assert.equal(s.settings.routines.evening.goal, '');
  assert.equal(s.settings.timer, false);
  assert.equal(createDefaultState().settings.timer, true);
});

test('Zeitleiste: Anteil, Restzeit, Blitz und knappe Zeit; aus bei manuellem Start', () => {
  const st = createDefaultState().settings;
  st.routines.morning.goal = '07:00';
  const cur = { routine: 'morning', manual: false };
  const a = timeInfo(st, cur, new Date(2026, 9, 14, 6, 30));
  assert.equal(a.p, 0.125);
  assert.equal(a.left, 210);
  assert.equal(a.goalP, 0.25);
  assert.equal(a.blitz, true);
  assert.equal(a.low, false);
  const b = timeInfo(st, cur, new Date(2026, 9, 14, 9, 30));
  assert.equal(b.blitz, false);
  assert.equal(b.low, true);
  assert.equal(timeInfo(st, { routine: 'morning', manual: true }, new Date(2026, 9, 14, 6, 30)), null);
  assert.equal(timeInfo({ ...st, timer: false }, cur, new Date(2026, 9, 14, 6, 30)), null);
});

test('Blitz-Bonus gibt Extra-XP beim ersten Abschluss', () => {
  const s = normalizeState({ setupDone: true, children: [child('c_a')] });
  const today = s.progress.date;
  toggleTask(s, 'morning', 'c_a', 'umziehen', today, { blitz: true });
  const r = toggleTask(s, 'morning', 'c_a', 'zaehne', today, { blitz: true });
  assert.equal(r.reward.blitz, BLITZ_XP);
  assert.equal(r.reward.xp, 2 * XP_PER_TASK + XP_ROUTINE_BONUS + BLITZ_XP);
  assert.equal(s.children[0].xp, r.reward.xp);
});
