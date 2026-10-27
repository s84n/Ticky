// Glücksrad: Ziehung zuerst (crypto), dann Animation auf den berechneten Zielwinkel; anschließend Reveal.
import { el, svg, openOverlay, vibrate, autoPress } from '../ui.js';
import { wheelOrder, figureWeights, splitUpgrade, wheelSlots, drawIndex, segments, targetRotation, segmentAt, hasLuckBonus } from './draw.js';
import { RARITIES, RARITY_ORDER } from '../data/figures.js';
import { THEMES } from '../data/themes.js';
import { cryptoRandom } from '../util.js';
import { tickSound, whooshSound, revealSound } from '../audio.js';
import { fireworks, confetti, shake, burstAt, flash, isReduced } from '../fx.js';
import { figureView, playUpgrade } from '../figure-view.js';
import { animationDone, bezier, isLite } from '../perf.js';
import { focusOf, upgradeGuaranteed, upgradeChance, UPGRADE_PITY, EVO_STEPS, STAR_PERKS, STAR_MAX, starReady, nextStep, pathOf, stageOf, accessoryById } from '../data/progression.js';

/** So lange bleibt der Gewinn stehen, bevor es von selbst weitergeht (besondere Gewinne etwas länger). */
const REVEAL_MS = 9000, REVEAL_EPIC_MS = 12000;

const ACCESSORY_LABEL = id => { const a = accessoryById(id); return a ? `${a.icon} ${a.label}` : 'Ein Accessoire'; };

export const SPIN_EASE = bezier(0.12, 0.67, 0.1, 1);
export const POINTER_TICK = [
  { transform: 'translateX(-50%) rotate(0deg)' },
  { transform: 'translateX(-50%) rotate(-14deg)', offset: 0.5 },
  { transform: 'translateX(-50%) rotate(0deg)' },
];

const R = 100; // Radius in Rad-Einheiten (Mittelpunkt 0/0, Rand bei ±100)
const EMOJI_FONT = '"Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif';

/** Feldfarben nach design_handoff §4 2c. Standard nutzt den Farbton des Styles, alles andere die App-Palette. */
const GOLD = 'var(--ticky-gold)', GOLD_2 = 'var(--ticky-gold-2)';
const MYTH = ['oklch(0.62 0.2 25)', 'oklch(0.5 0.2 320)'];
const SECRET = ['oklch(0.22 0.02 280)', 'oklch(0.45 0.18 300)'];
const standardColors = hue => [`oklch(0.5 0.1 ${hue})`, `oklch(0.42 0.08 ${hue})`];
const MAGIC = ['var(--color-accent)', 'var(--color-accent-600)'];

/** oklch → rgb, damit das Canvas die Farben auch auf älteren Browsern (ohne oklch-Unterstützung) sicher malt. */
function oklchToRgb(L, C, H) {
  const h = (H * Math.PI) / 180;
  const a = C * Math.cos(h), b = C * Math.sin(h);
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.2914855480 * b) ** 3;
  const enc = x => {
    x = Math.min(1, Math.max(0, x));
    return Math.round(255 * (x <= 0.0031308 ? 12.92 * x : 1.055 * x ** (1 / 2.4) - 0.055));
  };
  return `rgb(${enc(4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s)}, ${enc(-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s)}, ${enc(-0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s)})`;
}

/** Löst var(--x) über die Design-Tokens auf und rechnet oklch in rgb um. */
export function paint(color) {
  const v = /^var\((--[\w-]+)\)$/.exec(color);
  if (v) color = getComputedStyle(document.documentElement).getPropertyValue(v[1]).trim();
  const o = /^oklch\(\s*([\d.]+)(%?)\s+([\d.]+)\s+([\d.]+)/.exec(color);
  if (o) return oklchToRgb(o[2] ? o[1] / 100 : +o[1], +o[3], +o[4]);
  return color || '#888';
}

export const rad = deg => ((deg - 90) * Math.PI) / 180; // 0° = oben, im Uhrzeigersinn

export function pt(angleDeg, r) {
  const a = (angleDeg * Math.PI) / 180;
  return [r * Math.sin(a), -r * Math.cos(a)];
}

/** Lädt ein Figurenbild fertig dekodiert; null, wenn es nicht lädt. */
function loadImage(src) {
  return new Promise(resolve => {
    const img = new Image();
    img.onload = () => Promise.resolve(img.decode?.()).catch(() => {}).then(() => resolve(img));
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

/** Schwarze, halbtransparente Silhouette (für noch nicht gewonnene Figuren). */
function silhouette(img, px) {
  const c = document.createElement('canvas');
  c.width = c.height = px;
  const x = c.getContext('2d');
  x.drawImage(img, 0, 0, px, px);
  x.globalCompositeOperation = 'source-in';
  x.fillStyle = 'rgba(0, 0, 0, .55)';
  x.fillRect(0, 0, px, px);
  return c;
}

/**
 * Malt das Rad in ein Canvas. Ein einziges Bitmap, das sich nur noch dreht: keine SVG-Verweise (Verläufe, Filter),
 * die auf schwachen Geräten beim Drehen verloren gehen, und kein erneutes Rastern pro Frame.
 */
function drawWheel(canvas, { theme, slots, segs, owned, upgradeFig, images }) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const k = canvas.width / (2 * R);
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.setTransform(k, 0, 0, k, canvas.width / 2, canvas.height / 2);
  const std = standardColors(THEMES[theme].hue).map(paint);
  const magic = MAGIC.map(paint);
  const radial = (c1, c2) => {
    const g = ctx.createRadialGradient(0, 0, 0, 0, 0, R);
    g.addColorStop(0.15, paint(c1));
    g.addColorStop(1, paint(c2));
    return g;
  };
  const slice = (start, end, fill) => {
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.arc(0, 0, R, rad(start), rad(end));
    ctx.closePath();
    ctx.fillStyle = fill;
    ctx.fill();
    ctx.strokeStyle = 'rgba(22, 24, 38, .55)';
    ctx.lineWidth = 0.6;
    ctx.stroke();
  };
  const figure = (src, mid, r, size, sil) => {
    const img = images.get(src);
    if (!img) return;
    const [cx, cy] = pt(mid, r);
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate((mid * Math.PI) / 180);
    ctx.drawImage(sil ? silhouette(img, Math.ceil(size * k)) : img, -size / 2, -size / 2, size, size);
    ctx.restore();
  };
  let stdIdx = 0, magIdx = 0;
  slots.forEach((slot, i) => {
    const { start, end } = segs[i];
    const mid = (start + end) / 2;
    if (slot.kind === 'upgrade') {
      // Goldenes Upgrade-Feld mit der Figur, deren Reise gerade läuft
      slice(start, end, radial(GOLD, GOLD_2));
      const rr = R * 0.7;
      const arc = ((end - start) * Math.PI / 180) * rr;
      figure(upgradeFig.svg, mid, rr, Math.max(10, Math.min(24, arc * 0.8)), false);
      return;
    }
    const fig = slot.fig;
    const fill = fig.rarity === 'legendaer' ? paint(GOLD)
      : fig.rarity === 'mythisch' ? radial(MYTH[0], MYTH[1])
        : fig.rarity === 'geheim' ? radial(SECRET[0], SECRET[1])
          : fig.rarity === 'magisch' ? magic[magIdx++ % 2] : std[stdIdx++ % 2];
    slice(start, end, fill);
    // Sehr seltene, schmale Felder (Mythisch, Geheim): statt Figur ein Symbol am Rand
    if (fig.rarity === 'mythisch' || fig.rarity === 'geheim') {
      const [sx, sy] = pt(mid, R * 0.89);
      ctx.font = `7px ${EMOJI_FONT}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = '#fff';
      ctx.fillText(fig.rarity === 'geheim' ? '❓' : '🔥', sx, sy);
      return;
    }
    // Figur im Segment (nicht gewonnene als Silhouette)
    const rr = R * 0.76;
    const arc = ((end - start) * Math.PI / 180) * rr;
    figure(fig.svg, mid, rr, Math.max(9, Math.min(17, arc * 0.85)), !owned[fig.id]);
  });
}

/** Canvas fürs Rad: Felder sofort, Figuren, sobald ihre Bilder dekodiert sind. */
function buildWheel(theme, figures, slots, segs, owned, upgradeFig = null) {
  const ups = slots.length - figures.length;
  const label = `Glücksrad mit ${figures.length} Figuren${upgradeFig ? ` und ${ups} Upgrade-Feldern für ${upgradeFig.name}` : ''}`;
  const canvas = el('canvas', { role: 'img', 'aria-label': label });
  // Feste Auflösung passend zur größten Radgröße (310 px); CSS skaliert auf die tatsächliche Größe.
  canvas.width = canvas.height = Math.round(310 * Math.min(window.devicePixelRatio || 1, isLite() ? 1.5 : 2));
  const images = new Map();
  const opts = { theme, slots, segs, owned, upgradeFig, images };
  drawWheel(canvas, opts);
  const srcs = [...new Set([...figures.filter(f => f.rarity !== 'mythisch' && f.rarity !== 'geheim'), upgradeFig].filter(Boolean).map(f => f.svg))];
  Promise.all(srcs.map(src => loadImage(src).then(img => { if (img) images.set(src, img); })))
    .then(() => drawWheel(canvas, opts))
    .catch(e => console.error('Glücksrad-Bilder', e));
  return canvas;
}

/** Legendenfarbe je Rarität (passend zu den Feldern). */
const legendColor = (r, hue) => ({ standard: standardColors(hue)[0], magisch: MAGIC[0], legendaer: GOLD_2, mythisch: MYTH[0], geheim: SECRET[1] }[r]);

export const pointerSvg = () => svg('svg', { class: 'wheel-pointer', viewBox: '0 0 28 26', 'aria-hidden': 'true' },
  svg('path', { d: 'M0 0 H28 L14 26 Z', style: 'fill:var(--color-text)' }));

const pct = v => `${(v * 100).toLocaleString('de-DE', { maximumFractionDigits: 1 })} %`;

/**
 * Öffnet das Glücksrad für ein Kind.
 * Ergebnis: { kind: 'figure', fig } oder { kind: 'upgrade', fig } (goldenes Feld: Upgrade für die verfolgte Figur).
 * commit(result, luckUsed) wird SOFORT nach der Ziehung aufgerufen (Ergebnis speichern, Farm-Schutz) und liefert
 * den Gewinn für die Anzeige. onFinish(result) nach „Los, feiern!“.
 * forceRarity (nur Demo-Modus): Ergebnis dieser Rarität bzw. 'upgrade' statt Zufall.
 * boost: Faktor des Eltern-Boosts (1 = keiner) – seltene Figuren und Upgrades werden wahrscheinlicher.
 */
export function openWheel(child, { commit, onFinish, onCancel, settings, forceRarity = null, boost = 1 }) {
  const theme = child.theme;
  const figures = wheelOrder(theme);
  const upgradeFig = focusOf(child);
  const upChance = upgradeFig ? upgradeChance(boost) : 0;
  const guaranteed = !!upgradeFig && upgradeGuaranteed(child);
  // Die Upgrade-Chance verteilt sich bei jedem Dreh anders auf mehrere goldene Felder
  const slots = wheelSlots(figures, figureWeights(figures, { boost }), splitUpgrade(upChance, cryptoRandom), cryptoRandom);
  const segs = segments(slots.map(s => s.weight)); // Optik ohne Glücksbonus
  const luck = hasLuckBonus(child.sinceLegendary);
  const luckWeights = figureWeights(figures, { luckBonus: luck, boost });
  const drawWeights = slots.map(s => (s.kind === 'upgrade' ? s.weight : luckWeights[s.i] * (1 - upChance)));
  const upgradeIdx = slots.flatMap((s, i) => (s.kind === 'upgrade' ? [i] : []));

  let rotation = 0;
  let spun = false;
  let finished = false;
  let result = null;
  let gain = null; // Gewinn aus commit()

  const rotor = el('div', { class: 'wheel-rotor' }, buildWheel(theme, figures, slots, segs, child.figures, upgradeFig));
  const pointer = pointerSvg();
  const wrap = el('div', { class: 'wheel-wrap' },
    el('div', { class: 'wheel-ring', 'aria-hidden': 'true' }), rotor, pointer,
    el('div', { class: 'wheel-hub', 'aria-hidden': 'true' }, child.avatar));
  const spinBtn = el('button', { type: 'button', class: 'btn btn--primary btn--cta wheel-spin', autofocus: true, onclick: spin }, 'DREHEN!');
  const hue = THEMES[theme].hue;
  const share = r => slots.reduce((a, s, i) => a + (s.kind === 'figure' && s.fig.rarity === r ? drawWeights[i] : 0), 0);
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
        : `${step.icon} Goldene Felder: ${upgradeFig.name} bekommt ${step.label}!`;
  }
  const stage = el('div', { class: 'wheel-stage' },
    el('div', { class: 'wheel-head' },
      el('span', { class: 'wheel-kicker' }, `${THEMES[theme].avatars[0]} ${THEMES[theme].name} · ${figures.length} Figuren${boost > 1 ? ` · 🚀 Eltern-Boost +${Math.round((boost - 1) * 100)} %` : ''}`),
      el('h2', { class: 'wheel-title' }, `${child.name}, dreh am Rad!`),
      hint ? el('span', { class: 'wheel-hint' }, hint) : el('span', { class: 'wheel-hint wheel-hint--plain' }, 'Tippe auf „DREHEN!“ oder wische über das Rad.')),
    wrap, legend, spinBtn);

  // Champion-Banner und kurze Meldungen nicht über dem Rad
  document.querySelectorAll('.banner, .toast:not(.toast--sticky)').forEach(b => b.remove());
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
    const idx = forcedIndex() ?? (guaranteed ? anyUpgradeIdx() : drawIndex(drawWeights, cryptoRandom));
    const slot = slots[idx];
    result = slot.kind === 'upgrade' ? { kind: 'upgrade', fig: upgradeFig } : { kind: 'figure', fig: slot.fig };
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

  /** Eines der goldenen Felder, gewichtet nach Größe. */
  function anyUpgradeIdx() {
    const total = upgradeIdx.reduce((a, i) => a + drawWeights[i], 0);
    return upgradeIdx[drawIndex(upgradeIdx.map(i => drawWeights[i] / total), cryptoRandom)];
  }

  /** Demo: Feld der gewünschten Rarität (zufällig unter mehreren), ein Upgrade-Feld oder eine Figur, die einen Stern bekommt. */
  function forcedIndex() {
    if (!forceRarity) return null;
    if (forceRarity === 'upgrade') return upgradeIdx.length ? anyUpgradeIdx() : null;
    if (forceRarity === 'stern') {
      const i = slots.findIndex(s => s.kind === 'figure' && starReady(child, s.fig));
      return i < 0 ? null : i;
    }
    const hits = slots.flatMap((s, i) => (s.kind === 'figure' && s.fig.rarity === forceRarity ? [i] : []));
    return hits.length ? hits[Math.floor(cryptoRandom() * hits.length)] : null;
  }

  function reveal() {
    const { fig } = result;
    const upgrade = result.kind === 'upgrade' ? gain?.upgrade : null;
    const star = gain?.star ?? null; // Duplikat nach fertiger Reise: neuer Stern
    const rar = RARITIES[fig.rarity];
    const epic = upgrade === 'verwandlung' || star === STAR_MAX || ['legendaer', 'mythisch', 'geheim'].includes(fig.rarity);
    const btn = el('button', { type: 'button', class: 'btn btn--primary btn--cta reveal__btn', onclick: () => { if (finished) return; finished = true; close(); onFinish(result); } }, 'Los, feiern! 🎉');
    let badge, name;
    const sub = [];
    if (upgrade) {
      const step = EVO_STEPS[upgrade];
      badge = upgrade === 'verwandlung' ? 'VERWANDLUNG!' : 'UPGRADE!';
      name = `${fig.name} ${step.reveal} ${step.icon}`;
      sub.push(journeyLine(fig));
      if (!child.team?.includes(fig.id)) sub.push(el('p', { class: 'reveal__sub' }, 'Nimm sie im Album ins Team – dann siehst du ihr Upgrade bei deinen Aufgaben.'));
    } else if (star) {
      const perk = STAR_PERKS[star - 1];
      badge = `STERN ${'★'.repeat(star)}${'☆'.repeat(STAR_MAX - star)}`;
      name = `${fig.name} ${perk.reveal} ${perk.icon}`;
      sub.push(el('p', { class: 'reveal__sub' }, `Schon ${child.figures[fig.id]}× gewonnen – Stern ${star} von ${STAR_MAX}!`),
        el('p', { class: 'reveal__extra' }, star < STAR_MAX ? `Als Nächstes: ${STAR_PERKS[star].icon} ${STAR_PERKS[star].label}.` : 'Alle Sterne gesammelt! 🌟'));
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
    const figNode = figureView(fig, child, { className: 'reveal__figure' });
    // Erst der alte Look, dann sichtbar der Wechsel – sonst merkt man das Upgrade nicht
    if (gain?.upgrade) playUpgrade(figNode, gain.upgrade);
    else if (star) playUpgrade(figNode, STAR_PERKS[star - 1].id, 900, 'perks');
    const box = el('div', { class: 'reveal', 'data-rarity': upgrade || star ? 'upgrade' : fig.rarity },
      el('p', { class: 'reveal__badge' }, badge),
      el('div', { class: 'reveal__tile' },
        epic ? el('div', { class: 'reveal__rays', 'aria-hidden': 'true' }) : null,
        figNode),
      el('h2', { class: 'reveal__name' }, name),
      ...sub, btn);
    stage.replaceChildren(box);
    setDismissible(true);
    btn.focus();
    autoPress(btn, epic ? REVEAL_EPIC_MS : REVEAL_MS);
    revealSound(upgrade === 'verwandlung' || star === STAR_MAX ? 'mythisch' : upgrade || star ? 'legendaer' : fig.rarity, theme);
    const cx = innerWidth / 2, cy = innerHeight * 0.38;
    if (upgrade === 'verwandlung') {
      flash('rgba(255, 211, 77, .55)');
      shake();
      fireworks(6, { delayStep: 240 });
      confetti(140);
      burstAt(cx, cy, theme, 34);
      setTimeout(() => burstAt(cx, cy, 'zauber', 30), 450);
    } else if (upgrade || star) {
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
