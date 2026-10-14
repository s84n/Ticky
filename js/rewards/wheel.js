// Glücksrad: Ziehung zuerst (crypto), dann Animation auf den berechneten Zielwinkel; anschließend Reveal.
import { el, svg, openOverlay, vibrate } from '../ui.js';
import { wheelOrder, figureWeights, drawIndex, segments, targetRotation, segmentAt, hasLuckBonus } from './draw.js';
import { RARITIES } from '../data/figures.js';
import { THEMES } from '../data/themes.js';
import { cryptoRandom } from '../util.js';
import { tickSound, whooshSound, revealSound } from '../audio.js';
import { fireworks, confetti, shake, burstAt, isReduced } from '../fx.js';

const R = 100; // Radius im SVG-Koordinatensystem (viewBox -100..100)

function pt(angleDeg, r) {
  const a = (angleDeg * Math.PI) / 180;
  return [r * Math.sin(a), -r * Math.cos(a)];
}

function segPath(start, end, r) {
  const [x1, y1] = pt(start, r);
  const [x2, y2] = pt(end, r);
  const large = end - start > 180 ? 1 : 0;
  return `M0 0 L${x1.toFixed(3)} ${y1.toFixed(3)} A${r} ${r} 0 ${large} 1 ${x2.toFixed(3)} ${y2.toFixed(3)} Z`;
}

function buildWheelSvg(theme, figures, segs, owned) {
  const colors = THEMES[theme].wheel;
  const defs = svg('defs', {},
    svg('filter', { id: 'w-sil' }, svg('feColorMatrix', { type: 'matrix', values: '0 0 0 0 0.05  0 0 0 0 0.05  0 0 0 0 0.12  0 0 0 0.75 0' })),
    svg('pattern', { id: 'w-glitter', width: 12, height: 12, patternUnits: 'userSpaceOnUse' },
      svg('circle', { cx: 3, cy: 3, r: 0.9, fill: 'rgba(255,255,255,.7)' }), svg('circle', { cx: 9, cy: 8, r: 0.6, fill: 'rgba(255,255,255,.5)' })),
    svg('radialGradient', { id: 'w-gold', cx: '0', cy: '0', r: '100', gradientUnits: 'userSpaceOnUse' },
      svg('stop', { offset: '0', 'stop-color': '#FFF6C8' }), svg('stop', { offset: '.55', 'stop-color': colors.legendaer[0] }), svg('stop', { offset: '1', 'stop-color': colors.legendaer[1] })));
  const g = svg('g', {});
  let stdIdx = 0, magIdx = 0;
  figures.forEach((fig, i) => {
    const { start, end } = segs[i];
    let fill;
    if (fig.rarity === 'legendaer') fill = 'url(#w-gold)';
    else if (fig.rarity === 'magisch') fill = colors.magisch[magIdx++ % 2];
    else fill = colors.standard[stdIdx++ % 2];
    g.append(svg('path', { d: segPath(start, end, R), fill, stroke: 'rgba(255,255,255,.85)', 'stroke-width': 1.2 }));
    if (fig.rarity === 'magisch') g.append(svg('path', { d: segPath(start, end, R), fill: 'url(#w-glitter)' }));
    if (fig.rarity === 'legendaer') {
      for (let k = 1; k < 4; k++) {
        const a = start + ((end - start) * k) / 4;
        const [x, y] = pt(a, R * 0.96);
        g.append(svg('line', { x1: 0, y1: 0, x2: x, y2: y, stroke: 'rgba(255,255,255,.55)', 'stroke-width': 0.8 }));
      }
    }
    // Figur im Segment
    const mid = (start + end) / 2;
    const span = end - start;
    const rr = R * 0.66;
    const arc = (span * Math.PI / 180) * rr;
    const size = Math.max(16, Math.min(34, arc * 0.85));
    const [cx, cy] = pt(mid, rr);
    const img = svg('image', {
      href: fig.svg, x: -size / 2, y: -size / 2, width: size, height: size,
      transform: `translate(${cx.toFixed(2)} ${cy.toFixed(2)}) rotate(${mid.toFixed(2)})`,
      class: 'wheel-figure-img', filter: owned[fig.id] ? null : 'url(#w-sil)',
    });
    img.append(svg('title', {}, owned[fig.id] ? fig.name : '???'));
    g.append(img);
  });
  g.append(svg('circle', { cx: 0, cy: 0, r: R, fill: 'none', stroke: 'rgba(0,0,0,.25)', 'stroke-width': 2 }));
  return svg('svg', { viewBox: '-100 -100 200 200', role: 'img', 'aria-label': 'Glücksrad mit 10 Figuren' }, defs, g);
}

const pointerSvg = () => svg('svg', { class: 'wheel-pointer', viewBox: '0 0 44 56', 'aria-hidden': 'true' },
  svg('path', { d: 'M22 54 L4 14 A18 18 0 1 1 40 14 Z', fill: '#FF3B5C', stroke: '#fff', 'stroke-width': 3, 'stroke-linejoin': 'round' }),
  svg('circle', { cx: 22, cy: 16, r: 6, fill: '#fff' }));

/**
 * Öffnet das Glücksrad für ein Kind.
 * commit(figure, luckUsed) wird SOFORT nach der Ziehung aufgerufen (Ergebnis speichern, Farm-Schutz),
 * onFinish(figure) nach „Los, feiern!“.
 */
export function openWheel(child, { commit, onFinish, onCancel, settings }) {
  const theme = child.theme;
  const figures = wheelOrder(theme);
  const visualWeights = figureWeights(figures);
  const segs = segments(visualWeights);
  const luck = hasLuckBonus(child.sinceLegendary);
  const drawWeights = figureWeights(figures, { luckBonus: luck });

  let rotation = 0;
  let spun = false;
  let finished = false;
  let result = null;

  const rotor = el('div', { class: 'wheel-rotor' }, buildWheelSvg(theme, figures, segs, child.figures));
  const pointer = pointerSvg();
  const wrap = el('div', { class: 'wheel-wrap' },
    el('div', { class: 'wheel-ring', 'aria-hidden': 'true' }), rotor, pointer,
    el('div', { class: 'wheel-hub', 'aria-hidden': 'true' }, child.avatar));
  const spinBtn = el('button', { type: 'button', class: 'btn btn--primary btn--big wheel-spin', autofocus: true, onclick: spin }, 'DREHEN!');
  const c = THEMES[theme].wheel;
  const legend = el('div', { class: 'legend', 'aria-hidden': 'true' },
    el('span', { style: { '--c': c.standard[0] } }, 'Standard 70 %'),
    el('span', { style: { '--c': c.magisch[0] } }, 'Magisch 25 %'),
    el('span', { style: { '--c': c.legendaer[0] } }, `Legendär ${luck ? '10' : '5'} %`));
  const stage = el('div', { class: 'wheel-stage' },
    el('h2', { class: 'wheel-title' }, `${child.name}, dreh am Rad!`),
    wrap, spinBtn,
    el('p', { class: 'wheel-hint' }, luck ? '🍀 Glücksbonus aktiv: doppelte Chance auf Legendär!' : 'Tippe auf „DREHEN!“ oder wische über das Rad.'),
    legend);

  document.querySelectorAll('.banner').forEach(b => b.remove()); // Champion-Banner nicht über dem Rad
  const { overlay, close, setDismissible } = openOverlay(stage, {
    label: `Glücksrad für ${child.name}`, className: 'wheel-overlay', theme, backdropClose: false,
    onClose: () => { if (!spun) onCancel?.(); else if (!finished) { finished = true; onFinish(result); } },
  });

  // Wischgeste
  let startPt = null;
  wrap.addEventListener('pointerdown', e => { startPt = { x: e.clientX, y: e.clientY, t: performance.now() }; });
  wrap.addEventListener('pointerup', e => {
    if (!startPt) return;
    const dist = Math.hypot(e.clientX - startPt.x, e.clientY - startPt.y);
    startPt = null;
    if (dist > 30) spin();
  });

  function spin() {
    if (spun) return;
    spun = true;
    spinBtn.disabled = true;
    setDismissible(false);
    // 1) Ziehung
    const idx = drawIndex(drawWeights, cryptoRandom);
    result = figures[idx];
    commit(result, luck);
    // 2) Animation zum Zielsegment
    const turns = 5 + Math.floor(cryptoRandom() * 3);
    const target = targetRotation(rotation, segs[idx], turns, cryptoRandom());
    rotation = target;
    whooshSound();
    rotor.classList.add('is-spinning');
    requestAnimationFrame(() => { rotor.style.transform = `rotate(${target}deg)`; });
    let lastSeg = segmentAt(0, segs);
    let running = true;
    const watch = () => {
      if (!running) return;
      const m = getComputedStyle(rotor).transform;
      if (m && m !== 'none') {
        const [a, b] = m.slice(m.indexOf('(') + 1, -1).split(',').map(Number);
        const deg = (Math.atan2(b, a) * 180) / Math.PI;
        const s = segmentAt(deg, segs);
        if (s !== lastSeg) {
          lastSeg = s;
          tickSound();
          vibrate(10, settings);
          pointer.classList.remove('tick'); void pointer.getBoundingClientRect(); pointer.classList.add('tick');
        }
      }
      requestAnimationFrame(watch);
    };
    requestAnimationFrame(watch);
    const done = () => {
      if (!running) return;
      running = false;
      setTimeout(reveal, 450);
    };
    rotor.addEventListener('transitionend', done, { once: true });
    setTimeout(done, isReduced() ? 1600 : 5600); // Fallback
  }

  function reveal() {
    const fig = result;
    const count = child.figures[fig.id] ?? 1;
    const rar = RARITIES[fig.rarity];
    const wrapFig = el('div', { class: 'reveal__figure-wrap' },
      fig.rarity === 'legendaer' ? el('div', { class: 'reveal__rays' }) : null,
      el('div', { class: 'reveal__glow', style: { '--glow': fig.rarity === 'magisch' ? 'rgba(168, 85, 247, .65)' : fig.rarity === 'legendaer' ? 'rgba(255, 210, 80, .6)' : 'rgba(255,255,255,.35)' } }),
      el('img', { class: 'reveal__figure', src: fig.svg, alt: fig.name }));
    const btn = el('button', { type: 'button', class: 'btn btn--primary btn--big', onclick: () => { finished = true; close(); onFinish(fig); } }, 'Los, feiern! 🎉');
    const box = el('div', { class: 'reveal' },
      wrapFig,
      el('div', { class: 'reveal__badge', 'data-rarity': fig.rarity }, rar.label),
      el('h2', { class: 'reveal__title', 'data-rarity': fig.rarity }, rar.reveal),
      el('div', { class: 'reveal__name' }, fig.name),
      el('div', { class: 'reveal__count' }, count <= 1 ? 'Neu!' : `Schon ${count}× gewonnen`),
      btn);
    stage.replaceChildren(box);
    setDismissible(true);
    btn.focus();
    revealSound(fig.rarity, theme);
    const cx = innerWidth / 2, cy = innerHeight * 0.38;
    if (fig.rarity === 'legendaer') {
      shake();
      fireworks(4, { delayStep: 300 });
      confetti(90);
      burstAt(cx, cy, theme, 30);
    } else if (fig.rarity === 'magisch') {
      fireworks(2, { delayStep: 400 });
      burstAt(cx, cy, 'zauber', 24);
    } else {
      fireworks(1);
      burstAt(cx, cy, theme, 16);
    }
  }

  return { overlay, close };
}
