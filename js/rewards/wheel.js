// Glücksrad: Ziehung zuerst (crypto), dann Animation auf den berechneten Zielwinkel; anschließend Reveal.
import { el, svg, openOverlay, vibrate } from '../ui.js';
import { wheelOrder, figureWeights, drawIndex, segments, targetRotation, segmentAt, hasLuckBonus } from './draw.js';
import { RARITIES, RARITY_ORDER } from '../data/figures.js';
import { THEMES, RARE_WHEEL } from '../data/themes.js';
import { cryptoRandom } from '../util.js';
import { tickSound, whooshSound, revealSound } from '../audio.js';
import { fireworks, confetti, shake, burstAt, flash, isReduced } from '../fx.js';
import { figureView } from '../figure-view.js';

const R = 100; // Radius im SVG-Koordinatensystem (viewBox -100..100)

const GLOW = {
  standard: 'rgba(255,255,255,.35)',
  magisch: 'rgba(168, 85, 247, .65)',
  legendaer: 'rgba(255, 210, 80, .6)',
  mythisch: 'rgba(239, 68, 68, .65)',
  geheim: 'rgba(167, 139, 250, .8)',
};

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
      svg('stop', { offset: '0', 'stop-color': '#FFF6C8' }), svg('stop', { offset: '.55', 'stop-color': colors.legendaer[0] }), svg('stop', { offset: '1', 'stop-color': colors.legendaer[1] })),
    svg('radialGradient', { id: 'w-myth', cx: '0', cy: '0', r: '100', gradientUnits: 'userSpaceOnUse' },
      svg('stop', { offset: '.2', 'stop-color': '#FCA5A5' }), svg('stop', { offset: '.6', 'stop-color': RARE_WHEEL.mythisch[0] }), svg('stop', { offset: '1', 'stop-color': RARE_WHEEL.mythisch[1] })),
    svg('radialGradient', { id: 'w-secret', cx: '0', cy: '0', r: '100', gradientUnits: 'userSpaceOnUse' },
      svg('stop', { offset: '.2', 'stop-color': '#6D28D9' }), svg('stop', { offset: '.7', 'stop-color': RARE_WHEEL.geheim[1] }), svg('stop', { offset: '1', 'stop-color': RARE_WHEEL.geheim[0] })));
  const g = svg('g', {});
  let stdIdx = 0, magIdx = 0;
  figures.forEach((fig, i) => {
    const { start, end } = segs[i];
    let fill;
    if (fig.rarity === 'legendaer') fill = 'url(#w-gold)';
    else if (fig.rarity === 'mythisch') fill = 'url(#w-myth)';
    else if (fig.rarity === 'geheim') fill = 'url(#w-secret)';
    else if (fig.rarity === 'magisch') fill = colors.magisch[magIdx++ % 2];
    else fill = colors.standard[stdIdx++ % 2];
    g.append(svg('path', { d: segPath(start, end, R), fill, stroke: 'rgba(255,255,255,.85)', 'stroke-width': 1.2 }));
    // Sehr schmale Felder (Mythisch, Geheim): statt Figur ein leuchtendes Symbol am Rand
    if (end - start < 10) {
      const [sx, sy] = pt((start + end) / 2, R * 0.86);
      const sym = svg('text', { x: sx.toFixed(2), y: sy.toFixed(2), 'font-size': 9, 'text-anchor': 'middle', 'dominant-baseline': 'central', class: 'wheel-rare-sym' },
        fig.rarity === 'geheim' ? '❓' : '🔥');
      sym.append(svg('title', {}, owned[fig.id] ? fig.name : RARITIES[fig.rarity].label));
      g.append(sym);
      return;
    }
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
  return svg('svg', { viewBox: '-100 -100 200 200', role: 'img', 'aria-label': `Glücksrad mit ${figures.length} Figuren` }, defs, g);
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
  let gain = null; // { duplicate, dust } aus commit()

  const rotor = el('div', { class: 'wheel-rotor' }, buildWheelSvg(theme, figures, segs, child.figures));
  const pointer = pointerSvg();
  const wrap = el('div', { class: 'wheel-wrap' },
    el('div', { class: 'wheel-ring', 'aria-hidden': 'true' }), rotor, pointer,
    el('div', { class: 'wheel-hub', 'aria-hidden': 'true' }, child.avatar));
  const spinBtn = el('button', { type: 'button', class: 'btn btn--primary btn--big wheel-spin', autofocus: true, onclick: spin }, 'DREHEN!');
  const c = { ...THEMES[theme].wheel, ...RARE_WHEEL };
  const legend = el('div', { class: 'legend', 'aria-hidden': 'true' },
    ...RARITY_ORDER.map(r => el('span', { style: { '--c': c[r][0] } },
      `${RARITIES[r].label.replace(/\s.*$/, '')} ${r === 'legendaer' && luck ? '10 %' : RARITIES[r].short}`)));
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
    gain = commit(result, luck);
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
    const epic = ['legendaer', 'mythisch', 'geheim'].includes(fig.rarity);
    const wrapFig = el('div', { class: 'reveal__figure-wrap', 'data-rarity': fig.rarity },
      epic ? el('div', { class: 'reveal__rays' }) : null,
      el('div', { class: 'reveal__glow', style: { '--glow': GLOW[fig.rarity] } }),
      figureView(fig, child, { className: 'reveal__figure' }));
    const btn = el('button', { type: 'button', class: 'btn btn--primary btn--big', onclick: () => { finished = true; close(); onFinish(fig); } }, 'Los, feiern! 🎉');
    const box = el('div', { class: 'reveal' },
      wrapFig,
      el('div', { class: 'reveal__badge', 'data-rarity': fig.rarity }, rar.label),
      el('h2', { class: 'reveal__title', 'data-rarity': fig.rarity }, rar.reveal),
      el('div', { class: 'reveal__name' }, fig.name),
      el('div', { class: 'reveal__count' }, count <= 1 ? 'Neu! Sie zieht in deine Figurenwelt ein.' : `Schon ${count}× gewonnen`),
      gain?.dust ? el('div', { class: 'reveal__dust' }, `+${gain.dust} ✨ Sternenstaub`) : null,
      btn);
    stage.replaceChildren(box);
    setDismissible(true);
    btn.focus();
    revealSound(fig.rarity, theme);
    const cx = innerWidth / 2, cy = innerHeight * 0.38;
    if (fig.rarity === 'geheim') {
      flash('rgba(167, 139, 250, .6)');
      shake();
      setTimeout(shake, 700);
      fireworks(8, { delayStep: 220 });
      confetti(160);
      burstAt(cx, cy, theme, 36);
      setTimeout(() => burstAt(cx, cy, 'zauber', 30), 500);
    } else if (fig.rarity === 'mythisch') {
      flash('rgba(239, 68, 68, .45)');
      shake();
      fireworks(6, { delayStep: 260 });
      confetti(120);
      burstAt(cx, cy, theme, 32);
    } else if (fig.rarity === 'legendaer') {
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
