// Glücksrad: Ziehung zuerst (crypto), dann Animation auf den berechneten Zielwinkel; anschließend Reveal.
import { el, svg, openOverlay, vibrate } from '../ui.js';
import { wheelOrder, figureWeights, withUpgradeSlot, drawIndex, segments, targetRotation, segmentAt, hasLuckBonus } from './draw.js';
import { RARITIES, RARITY_ORDER } from '../data/figures.js';
import { THEMES } from '../data/themes.js';
import { cryptoRandom } from '../util.js';
import { tickSound, whooshSound, revealSound } from '../audio.js';
import { fireworks, confetti, shake, burstAt, flash, isReduced } from '../fx.js';
import { figureView } from '../figure-view.js';
import { animationDone, bezier } from '../perf.js';
import { focusOf, upgradeGuaranteed, UPGRADE_CHANCE, UPGRADE_PITY, EVO_STEPS, nextStep, pathOf, stageOf, accessoryById } from '../data/progression.js';

const ACCESSORY_LABEL = id => { const a = accessoryById(id); return a ? `${a.icon} ${a.label}` : 'Ein Accessoire'; };

const SPIN_EASE = bezier(0.12, 0.67, 0.1, 1);
const POINTER_TICK = [
  { transform: 'translateX(-50%) rotate(0deg)' },
  { transform: 'translateX(-50%) rotate(-14deg)', offset: 0.5 },
  { transform: 'translateX(-50%) rotate(0deg)' },
];

const R = 100; // Radius im SVG-Koordinatensystem (viewBox -100..100)

/** Feldfarben nach design_handoff §4 2c. Standard nutzt den Farbton des Styles, alles andere die App-Palette. */
const GOLD = 'var(--ticky-gold)', GOLD_2 = 'var(--ticky-gold-2)';
const MYTH = ['oklch(0.62 0.2 25)', 'oklch(0.5 0.2 320)'];
const SECRET = ['oklch(0.22 0.02 280)', 'oklch(0.45 0.18 300)'];
const standardColors = hue => [`oklch(0.5 0.1 ${hue})`, `oklch(0.42 0.08 ${hue})`];
const MAGIC = ['var(--color-accent)', 'var(--color-accent-600)'];

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

/** Verlauf von innen nach außen (Farben als style, damit CSS-Variablen und oklch greifen). */
const radial = (id, c1, c2) => svg('radialGradient', { id, cx: '0', cy: '0', r: '100', gradientUnits: 'userSpaceOnUse' },
  svg('stop', { offset: '.15', style: `stop-color:${c1}` }), svg('stop', { offset: '1', style: `stop-color:${c2}` }));

function buildWheelSvg(theme, figures, segs, owned, upgradeFig = null) {
  const std = standardColors(THEMES[theme].hue);
  const defs = svg('defs', {},
    svg('filter', { id: 'w-sil' }, svg('feColorMatrix', { type: 'matrix', values: '0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 0.55 0' })),
    radial('w-up', GOLD, GOLD_2), radial('w-myth', MYTH[0], MYTH[1]), radial('w-secret', SECRET[0], SECRET[1]));
  const g = svg('g', {});
  const slice = (start, end, fill) => g.append(svg('path', { d: segPath(start, end, R), style: `fill:${fill}`, stroke: 'rgba(22, 24, 38, .55)', 'stroke-width': 0.6 }));
  if (upgradeFig) {
    // Goldenes Upgrade-Feld (Index 0) mit der Figur, deren Reise gerade läuft
    const { start, end } = segs[0];
    slice(start, end, 'url(#w-up)');
    const mid = (start + end) / 2;
    const [cx, cy] = pt(mid, R * 0.645);
    const img = svg('image', { href: upgradeFig.svg, x: -13, y: -13, width: 26, height: 26, transform: `translate(${cx.toFixed(2)} ${cy.toFixed(2)}) rotate(${mid.toFixed(2)})` });
    img.append(svg('title', {}, `Upgrade für ${upgradeFig.name}`));
    g.append(img);
    segs = segs.slice(1);
  }
  let stdIdx = 0, magIdx = 0;
  figures.forEach((fig, i) => {
    const { start, end } = segs[i];
    const fill = fig.rarity === 'legendaer' ? GOLD
      : fig.rarity === 'mythisch' ? 'url(#w-myth)'
        : fig.rarity === 'geheim' ? 'url(#w-secret)'
          : fig.rarity === 'magisch' ? MAGIC[magIdx++ % 2] : std[stdIdx++ % 2];
    slice(start, end, fill);
    const mid = (start + end) / 2;
    // Sehr seltene, schmale Felder (Mythisch, Geheim): statt Figur ein Symbol am Rand
    if (fig.rarity === 'mythisch' || fig.rarity === 'geheim') {
      const [sx, sy] = pt(mid, R * 0.89);
      const sym = svg('text', { x: sx.toFixed(2), y: sy.toFixed(2), 'font-size': 7, 'text-anchor': 'middle', 'dominant-baseline': 'central', class: 'wheel-rare-sym' },
        fig.rarity === 'geheim' ? '❓' : '🔥');
      sym.append(svg('title', {}, owned[fig.id] ? fig.name : RARITIES[fig.rarity].label));
      g.append(sym);
      return;
    }
    // Figur im Segment (nicht gewonnene als Silhouette)
    const rr = R * 0.76;
    const arc = ((end - start) * Math.PI / 180) * rr;
    const size = Math.max(9, Math.min(17, arc * 0.85));
    const [cx, cy] = pt(mid, rr);
    const img = svg('image', {
      href: fig.svg, x: -size / 2, y: -size / 2, width: size, height: size,
      transform: `translate(${cx.toFixed(2)} ${cy.toFixed(2)}) rotate(${mid.toFixed(2)})`,
      class: 'wheel-figure-img', filter: owned[fig.id] ? null : 'url(#w-sil)',
    });
    img.append(svg('title', {}, owned[fig.id] ? fig.name : '???'));
    g.append(img);
  });
  const label = `Glücksrad mit ${figures.length} Figuren${upgradeFig ? ` und einem Upgrade-Feld für ${upgradeFig.name}` : ''}`;
  return svg('svg', { viewBox: '-100 -100 200 200', role: 'img', 'aria-label': label }, defs, g);
}

/** Legendenfarbe je Rarität (passend zu den Feldern). */
const legendColor = (r, hue) => ({ standard: standardColors(hue)[0], magisch: MAGIC[0], legendaer: GOLD_2, mythisch: MYTH[0], geheim: SECRET[1] }[r]);

const pointerSvg = () => svg('svg', { class: 'wheel-pointer', viewBox: '0 0 28 26', 'aria-hidden': 'true' },
  svg('path', { d: 'M0 0 H28 L14 26 Z', style: 'fill:var(--color-text)' }));

const pct = v => `${(v * 100).toLocaleString('de-DE', { maximumFractionDigits: 1 })} %`;

/**
 * Öffnet das Glücksrad für ein Kind.
 * Ergebnis: { kind: 'figure', fig } oder { kind: 'upgrade', fig } (goldenes Feld: Upgrade für die verfolgte Figur).
 * commit(result, luckUsed) wird SOFORT nach der Ziehung aufgerufen (Ergebnis speichern, Farm-Schutz) und liefert
 * den Gewinn für die Anzeige. onFinish(result) nach „Los, feiern!“.
 */
export function openWheel(child, { commit, onFinish, onCancel, settings }) {
  const theme = child.theme;
  const figures = wheelOrder(theme);
  const upgradeFig = focusOf(child);
  const upChance = upgradeFig ? UPGRADE_CHANCE : 0;
  const guaranteed = !!upgradeFig && upgradeGuaranteed(child);
  const off = upgradeFig ? 1 : 0;
  const visualWeights = withUpgradeSlot(figureWeights(figures), upChance);
  const segs = segments(visualWeights);
  const luck = hasLuckBonus(child.sinceLegendary);
  const drawWeights = withUpgradeSlot(figureWeights(figures, { luckBonus: luck }), upChance);

  let rotation = 0;
  let spun = false;
  let finished = false;
  let result = null;
  let gain = null; // Gewinn aus commit()

  const rotor = el('div', { class: 'wheel-rotor' }, buildWheelSvg(theme, figures, segs, child.figures, upgradeFig));
  const pointer = pointerSvg();
  const wrap = el('div', { class: 'wheel-wrap' },
    el('div', { class: 'wheel-ring', 'aria-hidden': 'true' }), rotor, pointer,
    el('div', { class: 'wheel-hub', 'aria-hidden': 'true' }, child.avatar));
  const spinBtn = el('button', { type: 'button', class: 'btn btn--primary btn--cta wheel-spin', autofocus: true, onclick: spin }, 'DREHEN!');
  const hue = THEMES[theme].hue;
  const share = r => (r === 'legendaer' && luck ? 0.1 : RARITIES[r].chance / 100) * (1 - upChance);
  const legend = el('div', { class: 'legend', 'aria-hidden': 'true' },
    upgradeFig ? el('span', { style: { '--c': GOLD } }, `Upgrade ${pct(upChance)}`) : null,
    ...RARITY_ORDER.map(r => el('span', { style: { '--c': legendColor(r, hue) } }, `${RARITIES[r].label.replace(/\s.*$/, '')} ${pct(share(r))}`)));
  // Hinweis-Pille: Garantie bzw. Upgrade-Feld hat Vorrang vor dem Glücksbonus
  let hint = luck ? '🍀 Glücksbonus aktiv: doppelte Chance auf Legendär!' : null;
  if (upgradeFig) {
    const step = EVO_STEPS[nextStep(child, upgradeFig)];
    const left = UPGRADE_PITY - (child.sinceUpgrade ?? 0);
    hint = guaranteed
      ? `${step.icon} Diesmal ganz sicher: ${upgradeFig.name} bekommt ${step.label}!`
      : left === 1
        ? `${step.icon} Noch 1 Dreh – dann ganz sicher ein Upgrade für ${upgradeFig.name}`
        : `${step.icon} Goldenes Feld: ${upgradeFig.name} bekommt ${step.label}!`;
  }
  const stage = el('div', { class: 'wheel-stage' },
    el('div', { class: 'wheel-head' },
      el('span', { class: 'wheel-kicker' }, `${THEMES[theme].avatars[0]} ${THEMES[theme].name} · ${figures.length} Figuren`),
      el('h2', { class: 'wheel-title' }, `${child.name}, dreh am Rad!`),
      hint ? el('span', { class: 'wheel-hint' }, hint) : el('span', { class: 'wheel-hint wheel-hint--plain' }, 'Tippe auf „DREHEN!“ oder wische über das Rad.')),
    wrap, legend, spinBtn);

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
    try { runSpin(); }
    catch (e) { console.error('Glücksrad', e); finished = true; close(); onFinish(result); }
  }

  function runSpin() {
    spun = true;
    spinBtn.disabled = true;
    spinBtn.textContent = '…';
    setDismissible(false);
    // 1) Ziehung
    const idx = guaranteed ? 0 : drawIndex(drawWeights, cryptoRandom);
    result = upgradeFig && idx === 0 ? { kind: 'upgrade', fig: upgradeFig } : { kind: 'figure', fig: figures[idx - off] };
    gain = commit(result, luck);
    // 2) Animation zum Zielsegment
    const turns = 5 + Math.floor(cryptoRandom() * 3);
    const target = targetRotation(rotation, segs[idx], turns, cryptoRandom());
    whooshSound();
    const from = rotation;
    rotation = target;
    const dur = isReduced() ? 600 : 4500; // reduzierte Bewegung: in 600 ms per Ease-out aufs Ziel
    // Drehung als Web-Animation: läuft auf dem Compositor und bleibt flüssig, auch wenn der Hauptthread zu tun hat.
    const anim = rotor.animate?.([{ transform: `rotate(${from}deg)` }, { transform: `rotate(${target}deg)` }],
      { duration: dur, easing: isReduced() ? 'ease-out' : 'cubic-bezier(.12,.67,.1,1)', fill: 'forwards' });
    if (anim) rotor.style.transform = `rotate(${target}deg)`;
    else {
      rotor.classList.add('is-spinning');
      requestAnimationFrame(() => { rotor.style.transform = `rotate(${target}deg)`; });
    }
    // Ticks: Winkel aus derselben Kurve berechnen statt jeden Frame den Stil auszulesen.
    const t0 = performance.now();
    let lastSeg = segmentAt(from, segs);
    let running = true;
    const watch = now => {
      if (!running) return;
      const p = Math.min(1, Math.max(0, (now - t0) / dur));
      const s = segmentAt(from + (target - from) * SPIN_EASE(p), segs);
      if (s !== lastSeg) {
        lastSeg = s;
        tickSound();
        vibrate(10, settings);
        pointer.animate?.(POINTER_TICK, { duration: 120, easing: 'ease-out' });
      }
      if (p < 1) requestAnimationFrame(watch);
    };
    requestAnimationFrame(watch);
    const done = () => {
      if (!running) return;
      running = false;
      setTimeout(() => {
        try { reveal(); }
        catch (e) { console.error('Glücksrad-Reveal', e); finished = true; close(); onFinish(result); }
      }, 450);
    };
    if (anim) animationDone(anim, dur + 600).then(done);
    else rotor.addEventListener('transitionend', done, { once: true });
    setTimeout(done, dur + 1200); // Fallback, falls kein Ende-Ereignis kommt (z. B. Tab im Hintergrund)
  }

  function reveal() {
    const { fig } = result;
    const upgrade = result.kind === 'upgrade' ? gain?.upgrade : null;
    const rar = RARITIES[fig.rarity];
    const epic = upgrade === 'verwandlung' || ['legendaer', 'mythisch', 'geheim'].includes(fig.rarity);
    const btn = el('button', { type: 'button', class: 'btn btn--primary btn--cta reveal__btn', onclick: () => { finished = true; close(); onFinish(result); } }, 'Los, feiern! 🎉');
    let badge, name;
    const sub = [];
    if (upgrade) {
      const step = EVO_STEPS[upgrade];
      badge = upgrade === 'verwandlung' ? 'VERWANDLUNG!' : 'UPGRADE!';
      name = `${fig.name} ${step.reveal} ${step.icon}`;
      sub.push(journeyLine(fig));
    } else {
      badge = rar.reveal;
      name = fig.name;
      const count = child.figures[fig.id] ?? 1;
      if (gain?.isNew) {
        const inTeam = child.team?.includes(fig.id);
        sub.push(el('p', { class: 'reveal__sub' }, inTeam ? 'Neu! Sie läuft ab jetzt bei deinen Aufgaben mit.' : 'Neu! Sie wartet in deinem Album – dein Team ist voll.'),
          el('p', { class: 'reveal__extra' }, `⭐ Ihre Upgrade-Reise beginnt: ${pathOf(fig).length} Upgrades warten!`));
      } else if (gain?.upgrade) {
        const step = EVO_STEPS[gain.upgrade];
        sub.push(el('p', { class: 'reveal__sub' }, `Schon ${count}× gewonnen – dafür gibt's ein Upgrade: ${step.icon} ${step.label}!`), journeyLine(fig));
      } else if (gain?.gift) {
        sub.push(el('p', { class: 'reveal__sub' }, `Schon ${count}× gewonnen – Geschenk: ${ACCESSORY_LABEL(gain.gift)} für deine Figuren!`));
      } else {
        sub.push(el('p', { class: 'reveal__sub' }, `Schon ${count}× gewonnen`));
      }
    }
    const box = el('div', { class: 'reveal', 'data-rarity': upgrade ? 'upgrade' : fig.rarity },
      el('p', { class: 'reveal__badge' }, badge),
      el('div', { class: 'reveal__tile' },
        epic ? el('div', { class: 'reveal__rays', 'aria-hidden': 'true' }) : null,
        figureView(fig, child, { className: 'reveal__figure' })),
      el('h2', { class: 'reveal__name' }, name),
      ...sub, btn);
    stage.replaceChildren(box);
    setDismissible(true);
    btn.focus();
    revealSound(upgrade === 'verwandlung' ? 'mythisch' : upgrade ? 'legendaer' : fig.rarity, theme);
    const cx = innerWidth / 2, cy = innerHeight * 0.38;
    if (upgrade === 'verwandlung') {
      flash('rgba(255, 211, 77, .55)');
      shake();
      fireworks(6, { delayStep: 240 });
      confetti(140);
      burstAt(cx, cy, theme, 34);
      setTimeout(() => burstAt(cx, cy, 'zauber', 30), 450);
    } else if (upgrade) {
      fireworks(3, { delayStep: 300 });
      confetti(70);
      burstAt(cx, cy, theme, 26);
    } else if (fig.rarity === 'geheim') {
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

  /** „Upgrade 2 von 3 – als Nächstes: 📏 Wachstum.“ bzw. „Reise geschafft!“ */
  function journeyLine(fig) {
    const path = pathOf(fig);
    const stage = stageOf(child, fig.id);
    const next = EVO_STEPS[path[stage]];
    return el('p', { class: 'reveal__extra' }, next ? `Upgrade ${stage} von ${path.length} – als Nächstes: ${next.icon} ${next.label}.` : 'Reise geschafft! 🏆');
  }

  return { overlay, close };
}
