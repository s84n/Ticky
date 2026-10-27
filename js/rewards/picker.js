// Zufallsrad im Eltern-Bereich: lost eines der Kinder aus (z. B. wer heute zuerst vorgelesen bekommt).
// Wer gewonnen hat, fliegt für die nächste Runde raus – so entsteht auf Wunsch eine ganze Reihenfolge.
import { el, openOverlay, vibrate } from '../ui.js';
import { segments, targetRotation, segmentAt } from './draw.js';
import { paint, rad, pt, pointerSvg, SPIN_EASE, POINTER_TICK } from './wheel.js';
import { THEMES } from '../data/themes.js';
import { cryptoRandom } from '../util.js';
import { tickSound, whooshSound, revealSound } from '../audio.js';
import { confetti, burstAt, isReduced } from '../fx.js';
import { animationDone, isLite } from '../perf.js';

const R = 100;
const EMOJI_FONT = '"Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif';

/** Malt ein Rad mit gleich großen Feldern, je Kind in der Farbe seines Styles. */
function drawPicker(canvas, kids, segs) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const k = canvas.width / (2 * R);
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.setTransform(k, 0, 0, k, canvas.width / 2, canvas.height / 2);
  const font = getComputedStyle(document.body).fontFamily;
  kids.forEach((c, i) => {
    const { start, end } = segs[i];
    const hue = THEMES[c.theme].hue;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.arc(0, 0, R, rad(start), rad(end));
    ctx.closePath();
    ctx.fillStyle = paint(i % 2 ? `oklch(0.46 0.12 ${hue})` : `oklch(0.56 0.14 ${hue})`);
    ctx.fill();
    ctx.strokeStyle = 'rgba(22, 24, 38, .7)';
    ctx.lineWidth = 0.8;
    ctx.stroke();
    // Avatar außen, Name zur Mitte hin – entlang des Radius, damit auch lange Namen passen
    const mid = (start + end) / 2;
    const [ax, ay] = pt(mid, R * 0.84);
    ctx.save();
    ctx.translate(ax, ay);
    ctx.rotate((mid * Math.PI) / 180);
    ctx.font = `${kids.length > 4 ? 13 : 16}px ${EMOJI_FONT}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(c.avatar, 0, 0);
    ctx.restore();
    ctx.save();
    ctx.rotate(rad(mid));
    // Auf der linken Hälfte um 180° drehen, damit der Name nicht auf dem Kopf steht
    const flip = mid > 180;
    if (flip) ctx.rotate(Math.PI);
    ctx.font = `600 ${kids.length > 4 ? 10 : 12}px ${font}`;
    ctx.textAlign = flip ? 'left' : 'right';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#fff';
    ctx.shadowColor = 'rgba(0, 0, 0, .5)';
    ctx.shadowBlur = 2;
    ctx.fillText(c.name, flip ? -R * 0.72 : R * 0.72, 0, R * 0.42);
    ctx.restore();
  });
}

/** Öffnet das Zufallsrad für die übergebenen Kinder (mindestens 2). */
export function openPicker(children, { settings }) {
  let pool = [...children];
  let order = [];
  let segs = [];
  let rotation = 0;
  let spinning = false;
  let stale = false; // Gewinner steht noch im Rad

  const canvas = el('canvas', { role: 'img' });
  canvas.width = canvas.height = Math.round(310 * Math.min(window.devicePixelRatio || 1, isLite() ? 1.5 : 2));
  const rotor = el('div', { class: 'wheel-rotor' }, canvas);
  const pointer = pointerSvg();
  const wrap = el('div', { class: 'wheel-wrap' },
    el('div', { class: 'wheel-ring', 'aria-hidden': 'true' }), rotor, pointer,
    el('div', { class: 'wheel-hub', 'aria-hidden': 'true' }, '🎲'));
  const title = el('h2', { class: 'wheel-title' }, 'Wer ist dran?');
  const hint = el('span', { class: 'wheel-hint wheel-hint--plain' }, 'Tippe auf „DREHEN!“ oder wische über das Rad.');
  const list = el('ol', { class: 'picker-order', 'aria-live': 'polite' });
  const spinBtn = el('button', { type: 'button', class: 'btn btn--primary btn--cta wheel-spin', autofocus: true, onclick: () => spin() }, 'DREHEN!');
  const stage = el('div', { class: 'wheel-stage' },
    el('div', { class: 'wheel-head picker-head' },
      el('div', {},
        el('span', { class: 'wheel-kicker' }, '🎲 Zufallsrad'),
        title,
        hint),
      el('button', { type: 'button', class: 'icon-btn icon-btn--plain', 'aria-label': 'Schließen', onclick: () => close() }, '✕')),
    wrap, list, spinBtn);

  const { close } = openOverlay(stage, { label: 'Zufallsrad', className: 'picker-overlay', backdropClose: false });

  function redraw() {
    stale = false;
    segs = segments(pool.map(() => 1 / pool.length));
    canvas.setAttribute('aria-label', `Zufallsrad mit ${pool.map(c => c.name).join(', ')}`);
    drawPicker(canvas, pool, segs);
  }

  let startPt = null;
  wrap.addEventListener('pointerdown', e => { startPt = { x: e.clientX, y: e.clientY }; });
  wrap.addEventListener('pointerup', e => {
    if (!startPt) return;
    const dist = Math.hypot(e.clientX - startPt.x, e.clientY - startPt.y);
    startPt = null;
    if (dist > 30) spin();
  });

  function spin() {
    if (spinning) return;
    // Alle ausgelost: neue Runde mit allen Kindern
    if (pool.length < 2) {
      pool = [...children];
      order = [];
      list.replaceChildren();
      title.textContent = 'Wer ist dran?';
      redraw();
    } else if (stale) redraw();
    spinning = true;
    spinBtn.disabled = true;
    spinBtn.textContent = '…';
    const idx = Math.floor(cryptoRandom() * pool.length);
    const turns = 4 + Math.floor(cryptoRandom() * 3);
    const from = rotation;
    const target = targetRotation(rotation, segs[idx], turns, cryptoRandom());
    rotation = target;
    whooshSound();
    const dur = isReduced() ? 600 : 4000;
    const anim = rotor.animate?.([{ transform: `rotate(${from}deg)` }, { transform: `rotate(${target}deg)` }],
      { duration: dur, easing: isReduced() ? 'ease-out' : 'cubic-bezier(.12,.67,.1,1)', fill: 'forwards' });
    rotor.style.transform = `rotate(${target}deg)`;
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
      setTimeout(() => reveal(idx), 300);
    };
    if (anim) animationDone(anim, dur + 600).then(done);
    setTimeout(done, dur + 1200);
  }

  function reveal(idx) {
    const winner = pool[idx];
    order.push(winner);
    pool = pool.filter(c => c !== winner);
    // Bleibt nur noch ein Kind übrig, steht der letzte Platz fest
    if (pool.length === 1) { order.push(pool[0]); pool = []; }
    title.textContent = order.length === 1 ? `🎉 ${winner.name} ist dran!` : `🎉 Als Nächstes: ${winner.name}!`;
    list.replaceChildren(...order.map((c, i) => el('li', { class: 'summary-chip', 'data-theme': c.theme },
      el('span', { class: 'picker-order__nr' }, `${i + 1}.`),
      el('span', { class: 'emoji', 'aria-hidden': 'true' }, c.avatar),
      el('span', {}, c.name))));
    hint.textContent = pool.length ? 'Weiterdrehen lost unter den anderen aus.' : 'Reihenfolge steht fest.';
    revealSound('magisch', winner.theme);
    confetti(60);
    const r = wrap.getBoundingClientRect();
    burstAt(r.left + r.width / 2, r.top + r.height / 2, winner.theme, 22);
    spinBtn.textContent = pool.length >= 2 ? 'Wer ist als Nächstes?' : '🔁 Neu auslosen';
    spinBtn.disabled = false;
    spinning = false;
    spinBtn.focus();
    // Gewinner kurz stehen lassen, dann aus dem Rad nehmen (spätestens beim nächsten Dreh)
    if (pool.length >= 2) { stale = true; setTimeout(() => { if (stale && !spinning) redraw(); }, 900); }
  }

  redraw();
}
