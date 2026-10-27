import { test } from 'node:test';
import assert from 'node:assert/strict';
import { wheelOrder, figureWeights, drawIndex, segments, targetRotation, segmentAt, hasLuckBonus } from '../js/rewards/draw.js';
import { LUCK_THRESHOLD, RARITIES, RARITY_ORDER, FIGURES } from '../js/data/figures.js';
import { THEME_IDS } from '../js/data/themes.js';
import { existsSync } from 'node:fs';

// Reproduzierbarer Zufall (mulberry32)
function seeded(seed) {
  return () => {
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

for (const theme of THEME_IDS) {
  test(`${theme}: 200.000 Ziehungen ≈ 68/25/5/1,5/0,5 % und jede Figur wird erreicht`, () => {
    const figs = wheelOrder(theme);
    assert.equal(figs.length, 12);
    assert.deepEqual(RARITY_ORDER.map(r => figs.filter(f => f.rarity === r).length), [6, 3, 1, 1, 1]);
    const w = figureWeights(figs);
    assert.ok(Math.abs(w.reduce((a, b) => a + b, 0) - 1) < 1e-9);
    const rnd = seeded(42);
    const N = 200000;
    const byRarity = Object.fromEntries(RARITY_ORDER.map(r => [r, 0]));
    const hits = new Array(figs.length).fill(0);
    for (let i = 0; i < N; i++) {
      const idx = drawIndex(w, rnd);
      hits[idx]++;
      byRarity[figs[idx].rarity]++;
    }
    for (const r of RARITY_ORDER) {
      const want = RARITIES[r].chance / 100;
      assert.ok(Math.abs(byRarity[r] / N - want) < Math.max(0.0015, want * 0.04), `${r} ${byRarity[r] / N}`);
    }
    assert.ok(hits.every(h => h > 0));
  });
}

test('Jede Figur hat eine SVG-Datei, eindeutige ID und eine Hut-Position', () => {
  const ids = new Set();
  for (const f of FIGURES) {
    assert.ok(!ids.has(f.id), f.id);
    ids.add(f.id);
    assert.ok(existsSync(new URL(`../${f.svg}`, import.meta.url)), f.svg);
    assert.ok(['walk', 'hop', 'fly'].includes(f.motion));
    assert.ok(f.head.every(v => v >= 0 && v <= 100));
  }
  assert.equal(FIGURES.length, THEME_IDS.length * 12);
});

test('Glücksbonus verdoppelt Legendär-Chance nach 15 Fehlversuchen', () => {
  assert.equal(hasLuckBonus(LUCK_THRESHOLD - 1), false);
  assert.equal(hasLuckBonus(LUCK_THRESHOLD), true);
  const figs = wheelOrder('pixel');
  const w = figureWeights(figs, { luckBonus: true });
  const legend = figs.reduce((a, f, i) => a + (f.rarity === 'legendaer' ? w[i] : 0), 0);
  assert.ok(Math.abs(legend - 0.10) < 1e-9);
  assert.ok(Math.abs(w.reduce((a, b) => a + b, 0) - 1) < 1e-9);
  const rnd = seeded(7);
  let n = 0;
  for (let i = 0; i < 100000; i++) if (figs[drawIndex(w, rnd)].rarity === 'legendaer') n++;
  assert.ok(Math.abs(n / 100000 - 0.10) < 0.01);
});

test('Segmente sind proportional zur Wahrscheinlichkeit und decken 360° ab', () => {
  const figs = wheelOrder('neon');
  const segs = segments(figureWeights(figs));
  assert.equal(segs[0].start, 0);
  assert.equal(segs.at(-1).end, 360);
  const li = figs.findIndex(f => f.rarity === 'legendaer');
  assert.ok(Math.abs(segs[li].end - segs[li].start - 18) < 1e-9); // 5 % von 360°
  const gi = figs.findIndex(f => f.rarity === 'geheim');
  assert.ok(Math.abs(segs[gi].end - segs[gi].start - 1.8) < 1e-9); // 0,5 % von 360°
});

test('Zielwinkel landet immer im gezogenen Segment', () => {
  const figs = wheelOrder('zauber');
  const segs = segments(figureWeights(figs));
  const rnd = seeded(99);
  let current = 0;
  for (let i = 0; i < 20000; i++) {
    const idx = Math.floor(rnd() * segs.length);
    const turns = 5 + Math.floor(rnd() * 3);
    const next = targetRotation(current, segs[idx], turns, rnd());
    assert.ok(next - current >= turns * 360 && next - current < (turns + 1) * 360);
    assert.equal(segmentAt(next, segs), idx);
    current = next;
  }
});

test('Upgrade-Felder: 35 % auf 2–4 Felder verteilt, nie nebeneinander, Figuren behalten ihr Verhältnis', async () => {
  const { splitUpgrade, wheelSlots } = await import('../js/rewards/draw.js');
  const figs = wheelOrder('pixel');
  const w = figureWeights(figs);
  assert.deepEqual(splitUpgrade(0, Math.random), []);
  assert.equal(wheelSlots(figs, w, [], Math.random).length, figs.length);
  const rnd = seeded(3);
  for (let n = 0; n < 2000; n++) {
    const pieces = splitUpgrade(0.35, rnd);
    assert.ok(pieces.length >= 2 && pieces.length <= 4);
    assert.ok(Math.abs(pieces.reduce((a, b) => a + b, 0) - 0.35) < 1e-9);
    const slots = wheelSlots(figs, w, pieces, rnd);
    assert.equal(slots.length, figs.length + pieces.length);
    assert.ok(Math.abs(slots.reduce((a, s) => a + s.weight, 0) - 1) < 1e-9);
    const up = slots.flatMap((s, i) => (s.kind === 'upgrade' ? [i] : []));
    assert.equal(up.length, pieces.length);
    for (let k = 0; k < up.length; k++) {
      const next = up[(k + 1) % up.length] + (k === up.length - 1 ? slots.length : 0);
      assert.ok(next - up[k] > 1, 'zwei Upgrade-Felder nebeneinander');
    }
    const f = slots.filter(s => s.kind === 'figure');
    assert.deepEqual(f.map(s => s.fig), figs);
    assert.ok(Math.abs(f[0].weight / f[1].weight - w[0] / w[1]) < 1e-9);
  }
});

test('Eltern-Boost macht seltene Figuren wahrscheinlicher, Summe bleibt 1', () => {
  const figs = wheelOrder('dino');
  const base = figureWeights(figs);
  const w = figureWeights(figs, { boost: 1.2 });
  assert.ok(Math.abs(w.reduce((a, b) => a + b, 0) - 1) < 1e-9);
  const share = (ws, r) => figs.reduce((a, f, i) => a + (f.rarity === r ? ws[i] : 0), 0);
  assert.ok(Math.abs(share(w, 'magisch') - 0.30) < 1e-9);
  assert.ok(Math.abs(share(w, 'legendaer') - 0.06) < 1e-9);
  assert.ok(share(w, 'standard') < share(base, 'standard'));
});
