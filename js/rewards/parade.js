// Siegesparade: die gewonnene Figur läuft/hüpft/fliegt über den Bildschirm (pointer-events: none).
import { el, $ } from '../ui.js';
import { sparkle, dust, confetti, isReduced } from '../fx.js';
import { decorateFigure } from '../figure-view.js';
import { isLite, animationDone } from '../perf.js';

const svgCache = new Map();

/** Lädt das SVG einer Figur als DOM-Knoten (für Teilanimationen inline statt <img>). */
export async function loadFigureSvg(fig) {
  let text = svgCache.get(fig.svg);
  if (!text) {
    const res = await fetch(fig.svg);
    if (!res.ok) throw new Error(`Figur nicht gefunden: ${fig.svg}`);
    text = await res.text();
    svgCache.set(fig.svg, text);
  }
  const doc = new DOMParser().parseFromString(text, 'image/svg+xml');
  const node = doc.documentElement;
  if (node.nodeName !== 'svg') throw new Error('Ungültiges SVG');
  node.querySelectorAll('script, foreignObject').forEach(n => n.remove());
  return document.importNode(node, true);
}

const wait = ms => new Promise(r => setTimeout(r, ms));

const RAINBOW = ['#F87171', '#FBBF24', '#A3E635', '#38BDF8', '#A78BFA', '#F472B6'];

/** Startet die Parade. child (optional) bringt Aufwertung und Accessoire mit. Promise wird erfüllt, wenn sie vorbei ist. */
export async function runParade(fig, child = null) {
  const layer = $('#parade-layer');
  // Inline-SVG erlaubt Bein-/Flügel-Animationen. Schwache Geräte bekommen das Bild: wird nur einmal gerastert.
  let svgNode;
  try {
    if (isLite()) throw new Error('lite');
    svgNode = await loadFigureSvg(fig);
  } catch {
    svgNode = el('img', { class: 'fig__img', src: fig.svg, alt: '' });
  }
  const rare = fig.rarity === 'mythisch' || fig.rarity === 'geheim';
  const legendary = fig.rarity === 'legendaer' || rare;
  const magic = fig.rarity === 'magisch' || rare;

  if (isReduced()) {
    const node = decorateFigure(el('div', { class: 'parade-bow fig' }, svgNode), fig, child);
    layer.append(node);
    const a = node.animate([
      { opacity: 0, transform: 'translate(-50%, -50%) scale(.9)' },
      { opacity: 1, transform: 'translate(-50%, -50%) scale(1)', offset: .2 },
      { opacity: 1, transform: 'translate(-50%, -45%) rotate(8deg) scale(1)', offset: .5 },
      { opacity: 1, transform: 'translate(-50%, -50%) scale(1)', offset: .75 },
      { opacity: 0, transform: 'translate(-50%, -50%) scale(.95)' },
    ], { duration: 2600, easing: 'ease-in-out', fill: 'forwards' });
    await animationDone(a, 3200);
    node.remove();
    return;
  }

  const base = Math.min(innerWidth * 0.3, 170);
  const size = Math.round(base * (rare ? 1.7 : legendary ? 1.5 : 1));
  const passes = fig.rarity === 'geheim' ? 3 : legendary ? 2 : 1;
  let ltr = Math.random() < 0.5;
  if (legendary) confetti(rare ? 150 : 110);

  for (let p = 0; p < passes; p++) {
    const opts = { legendary, magic, rainbow: fig.rarity === 'geheim', fire: fig.rarity === 'mythisch', child };
    const tasks = [runPass(layer, svgNode.cloneNode(true), fig, size, ltr, { ...opts, echo: false })];
    if (magic && !isLite()) tasks.push(runPass(layer, svgNode.cloneNode(true), fig, size, ltr, { ...opts, echo: true, delay: 180 }));
    await Promise.all(tasks);
    ltr = !ltr;
  }
}

async function runPass(layer, svgNode, fig, size, ltr, { legendary, magic, rainbow, fire, child, echo, delay = 0 }) {
  if (delay) await wait(delay);
  const inner = decorateFigure(el('div', { class: 'parade-inner fig' }, svgNode), fig, echo ? null : child);
  const actor = el('div', { class: `parade-actor${ltr ? '' : ' is-flipped'}${echo ? ' is-echo' : ''}`, 'data-motion': fig.motion, style: { '--size': `${size}px` } }, inner);
  layer.append(actor);

  const W = innerWidth, H = innerHeight;
  const x0 = ltr ? -size - 20 : W + 20;
  const x1 = ltr ? W + 20 : -size - 20;
  const duration = 5000;
  let yBase;
  if (fig.motion === 'fly') yBase = H * 0.18;
  else yBase = H * 0.72 - size;

  const move = actor.animate([
    { transform: `translate(${x0}px, ${yBase}px)` },
    { transform: `translate(${x1}px, ${yBase}px)` },
  ], { duration, easing: 'linear', fill: 'forwards' });

  let innerAnim;
  if (fig.motion === 'walk') {
    innerAnim = inner.animate([
      { transform: 'translateY(0) scale(1.04, .96)' },
      { transform: 'translateY(-10px) scale(.97, 1.03)' },
      { transform: 'translateY(0) scale(1.04, .96)' },
    ], { duration: 360, iterations: Infinity, easing: 'ease-in-out' });
  } else if (fig.motion === 'hop') {
    const hopH = Math.min(H * 0.25, 180);
    const frames = [];
    const hops = 5;
    const period = 1 / hops;
    for (let i = 0; i < hops; i++) {
      const o = i * period;
      frames.push({ offset: o, transform: 'translateY(0) scale(1.15, .85)', easing: 'ease-out' });
      frames.push({ offset: o + 0.08 * period, transform: 'translateY(-6px) scale(.95, 1.08)', easing: 'ease-out' });
      frames.push({ offset: o + 0.5 * period, transform: `translateY(${-hopH}px) scale(1, 1) rotate(${ltr ? 8 : -8}deg)`, easing: 'ease-in' });
    }
    frames.push({ offset: 1, transform: 'translateY(0) scale(1.15, .85)' });
    innerAnim = inner.animate(frames, { duration, fill: 'forwards' });
  } else {
    const amp = Math.min(H * 0.12, 90);
    const frames = [];
    for (let i = 0; i <= 20; i++) {
      const t = i / 20;
      const y = Math.sin(t * Math.PI * 4) * amp;
      const rot = Math.cos(t * Math.PI * 4) * 8 * (ltr ? 1 : -1);
      frames.push({ offset: t, transform: `translateY(${y.toFixed(1)}px) rotate(${(-rot).toFixed(1)}deg)` });
    }
    innerAnim = inner.animate(frames, { duration, easing: 'linear', fill: 'forwards' });
  }

  // Spuren
  let trail = true;
  const baseColor = fire ? '#FF5A36' : legendary ? '#FFD34D' : magic ? '#C084FC' : '#FFFFFF';
  let last = 0, k = 0;
  const loop = (ts) => {
    if (!trail) return;
    if (!echo && ts - last > (legendary || magic ? (isLite() ? 90 : 50) : 100)) {
      last = ts;
      const trailColor = rainbow ? RAINBOW[k++ % RAINBOW.length] : fire && k++ % 2 ? '#FFB020' : baseColor;
      const r = inner.getBoundingClientRect();
      const tailX = ltr ? r.left + r.width * 0.2 : r.right - r.width * 0.2;
      if (fig.motion === 'walk' && !legendary && !magic) dust(tailX, r.bottom - 8);
      else if (fig.motion === 'walk') { dust(tailX, r.bottom - 8); sparkle(tailX, r.top + r.height * 0.5, trailColor, legendary ? 10 : 7); }
      else if (fig.motion === 'fly' || legendary || magic) sparkle(tailX, r.top + r.height * 0.55, trailColor, legendary ? 10 : 7);
    }
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);

  await animationDone(move, duration + 1500);
  trail = false;
  innerAnim.cancel();
  actor.remove();
}
