import { test } from 'node:test';
import assert from 'node:assert/strict';
import { wheelOrder, figureWeights, drawIndex, segments, targetRotation, segmentAt, hasLuckBonus } from '../js/rewards/draw.js';
import { LUCK_THRESHOLD } from '../js/data/figures.js';

// Reproduzierbarer Zufall (mulberry32)
function seeded(seed) {
  return () => {
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

for (const theme of ['pixel', 'neon', 'zauber']) {
  test(`${theme}: 100.000 Ziehungen ≈ 70/25/5 % und jede Figur wird erreicht`, () => {
    const figs = wheelOrder(theme);
    assert.equal(figs.length, 10);
    const w = figureWeights(figs);
    assert.ok(Math.abs(w.reduce((a, b) => a + b, 0) - 1) < 1e-9);
    const rnd = seeded(42);
    const N = 100000;
    const byRarity = { standard: 0, magisch: 0, legendaer: 0 };
    const hits = new Array(figs.length).fill(0);
    for (let i = 0; i < N; i++) {
      const idx = drawIndex(w, rnd);
      hits[idx]++;
      byRarity[figs[idx].rarity]++;
    }
    assert.ok(Math.abs(byRarity.standard / N - 0.70) < 0.01, `standard ${byRarity.standard / N}`);
    assert.ok(Math.abs(byRarity.magisch / N - 0.25) < 0.01, `magisch ${byRarity.magisch / N}`);
    assert.ok(Math.abs(byRarity.legendaer / N - 0.05) < 0.01, `legendaer ${byRarity.legendaer / N}`);
    assert.ok(hits.every(h => h > 0));
  });
}

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
