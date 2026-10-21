// Effekte: Partikel, Screen-Flash, Toasts, Banner, Feuerwerk, Konfetti.
// Alle Partikel teilen sich EIN Canvas. Jede Partikelsorte wird einmal samt Leuchten als Sprite vorgerendert,
// danach kostet ein Partikel pro Frame nur noch ein drawImage – keine DOM-Knoten, Filter oder Ebenen.
import { THEMES } from './data/themes.js';
import { el, $, isSingleCard } from './ui.js';
import { pick } from './util.js';
import { isLite, degrade, bezier } from './perf.js';

let reduced = () => false;

export function setReducedMotionGetter(fn) { reduced = fn; }
export const isReduced = () => reduced();
const isMobile = () => window.matchMedia('(max-width: 699.98px)').matches;
// Drei oder mehr Kinder nebeneinander (Tablet quer): Effekte laufen oft gleichzeitig, also jeweils sparsamer.
let crowdedAt = 0, crowdedVal = false;
function crowded() {
  const now = performance.now();
  if (now - crowdedAt > 1000) {
    crowdedAt = now;
    crowdedVal = !isSingleCard() && document.querySelectorAll('#children-grid .child-card').length >= 3;
  }
  return crowdedVal;
}
const scaleCount = n => Math.max(1, Math.round(n * (isMobile() ? 0.5 : 1) * (isLite() ? 0.6 : 1) * (crowded() ? 0.6 : 1)));
const budget = () => (isLite() ? 70 : crowded() ? 100 : 150);
const layer = () => $('#fx-layer');
const rand = (a, b) => a + Math.random() * (b - a);
const EMOJI_FONT = '"Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif';

const EASE = {
  burst: bezier(0.2, 0.8, 0.3, 1),
  shower: bezier(0.15, 0.7, 0.4, 1),
  firework: bezier(0.1, 0.8, 0.3, 1),
  out: bezier(0, 0, 0.58, 1),
  linear: t => t,
};

// ---------- Canvas & Sprites ----------

let canvas = null, ctx = null, dpr = 1, raf = 0;
const parts = [];
const sprites = new Map();

function sizeCanvas() {
  dpr = Math.min(window.devicePixelRatio || 1, isLite() ? 1 : 2);
  const w = Math.round(innerWidth * dpr), h = Math.round(innerHeight * dpr);
  if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
}

function ensureCanvas() {
  if (!canvas) {
    canvas = el('canvas', { class: 'fx-canvas', 'aria-hidden': 'true' });
    layer().prepend(canvas);
    ctx = canvas.getContext('2d');
    window.addEventListener('resize', () => sizeCanvas());
  }
  sizeCanvas();
  return !!ctx;
}

/** Rendert eine Partikelsorte einmal in ein eigenes Canvas (inkl. Glow) und merkt sie sich. */
function sprite(key, w, h, pad, draw) {
  let s = sprites.get(key);
  if (s) return s;
  if (sprites.size > 400) sprites.clear();
  const res = Math.min(2, (window.devicePixelRatio || 1) * (isLite() ? 1 : 1.25));
  const W = w + pad * 2, H = h + pad * 2;
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.ceil(W * res));
  c.height = Math.max(1, Math.ceil(H * res));
  const g = c.getContext('2d');
  g.scale(res, res);
  g.translate(W / 2, H / 2);
  draw(g);
  s = { img: c, w: W, h: H };
  sprites.set(key, s);
  return s;
}

function roundRect(g, x, y, w, h, r) {
  r = Math.min(r, w / 2, h / 2);
  g.beginPath();
  g.moveTo(x + r, y);
  g.arcTo(x + w, y, x + w, y + h, r);
  g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r);
  g.arcTo(x, y, x + w, y, r);
  g.closePath();
}

/** Kreis/Rechteck mit optionalem Leuchten (wie box-shadow 0 0 blur spread). */
function shapeSprite({ w, h = w, color, radius = 0, glow = 0, spread = 0, bevel = false }) {
  w = Math.round(w); h = Math.round(h);
  const key = `s|${w}|${h}|${color}|${radius}|${glow}|${spread}|${bevel}`;
  return sprite(key, w, h, glow + spread + 2, g => {
    const r = radius === 'round' ? Math.min(w, h) / 2 : radius;
    if (glow) {
      g.shadowColor = color;
      g.shadowBlur = glow;
      g.fillStyle = color;
      roundRect(g, -w / 2 - spread, -h / 2 - spread, w + spread * 2, h + spread * 2, r + spread);
      g.fill();
      g.fill(); // zweiter Durchgang: kräftigeres Leuchten
      g.shadowBlur = 0;
    }
    g.fillStyle = color;
    roundRect(g, -w / 2, -h / 2, w, h, r);
    g.fill();
    if (bevel) { // Pixel-Block: dunkle Kante unten rechts
      g.fillStyle = 'rgba(0,0,0,.25)';
      g.fillRect(w / 2 - 2, -h / 2, 2, h);
      g.fillRect(-w / 2, h / 2 - 2, w, 2);
    }
  });
}

function emojiSprite(char, size, glowColor = null) {
  size = Math.round(size / 2) * 2;
  const glow = glowColor ? 6 : 0;
  return sprite(`e|${char}|${size}|${glowColor}`, size * 1.25, size * 1.25, glow + 2, g => {
    g.font = `${size}px ${EMOJI_FONT}`;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    if (glow) { g.shadowColor = glowColor; g.shadowBlur = glow * 1.6; }
    g.fillText(char, 0, size * 0.06);
  });
}

function textSprite(text, color) {
  const size = 26;
  const font = `800 ${size}px "Baloo 2", Nunito, system-ui, sans-serif`;
  ctx.font = font;
  const w = Math.ceil(ctx.measureText(text).width) + 4;
  return sprite(`t|${text}|${color}`, w, size * 1.3, 12, g => {
    g.font = font;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillStyle = color;
    g.shadowColor = color;
    g.shadowBlur = 10;
    g.fillText(text, 0, 1);
  });
}

// ---------- Partikel-Schleife ----------

/**
 * Startet ein Partikel. frames: [{ o (0..1), x, y, s, r (Grad), a, f (Drehung um die Hochachse, Grad) }],
 * wie Web-Animations-Keyframes: `ease` wirkt auf die ganze Dauer, dazwischen wird linear interpoliert.
 */
function spawn(spr, frames, { duration, delay = 0, ease = EASE.linear }) {
  if (parts.length >= budget()) return false;
  parts.push({ spr, frames, dur: duration, delay, ease, t0: performance.now() });
  if (!raf) { last = 0; slow = 0; seen = 0; raf = requestAnimationFrame(frame); }
  return true;
}

let last = 0, slow = 0, seen = 0;

function frame(now) {
  raf = 0;
  // Ruckel-Erkennung: hält das Gerät bei vielen Partikeln keine ~30 fps, wird dauerhaft gespart.
  if (last && parts.length > 25) {
    seen++;
    if (now - last > 34) slow++;
    if (seen >= 40) { if (slow > 24) degrade(); seen = 0; slow = 0; }
  }
  last = now;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  let n = 0;
  for (let i = 0; i < parts.length; i++) {
    const p = parts[i];
    const t = (now - p.t0 - p.delay) / p.dur;
    if (t >= 1) continue;
    parts[n++] = p;
    if (t < 0) continue;
    draw(p, p.ease(t));
  }
  parts.length = n;
  ctx.globalAlpha = 1;
  if (n) raf = requestAnimationFrame(frame);
  else { ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, canvas.width, canvas.height); }
}

function draw(p, e) {
  const f = p.frames;
  let k = 1;
  while (k < f.length - 1 && f[k].o < e) k++;
  const A = f[k - 1], B = f[k];
  const span = B.o - A.o;
  const u = span > 0 ? Math.min(1, Math.max(0, (e - A.o) / span)) : 1;
  const lerp = (key, def) => { const a = A[key] ?? def, b = B[key] ?? a; return a + (b - a) * u; };
  const alpha = lerp('a', 1);
  if (alpha <= 0.01) return;
  const s = lerp('s', 1);
  const rot = (lerp('r', 0) * Math.PI) / 180;
  const flip = A.f === undefined ? 1 : Math.cos((lerp('f', 0) * Math.PI) / 180);
  const cos = Math.cos(rot), sin = Math.sin(rot);
  const sx = s * flip * dpr, sy = s * dpr;
  ctx.globalAlpha = Math.min(1, alpha);
  ctx.setTransform(cos * sx, sin * sx, -sin * sy, cos * sy, lerp('x', 0) * dpr, lerp('y', 0) * dpr);
  const { img, w, h } = p.spr;
  ctx.drawImage(img, -w / 2, -h / 2, w, h);
}

function makeSprite(theme, i) {
  const t = THEMES[theme] ?? THEMES.pixel;
  const p = t.particles;
  if (p.kind === 'blocks') {
    if (i % 7 === 0) return emojiSprite(p.emoji, 26);
    return shapeSprite({ w: rand(8, 16), color: pick(p.colors), bevel: true });
  }
  if (p.kind === 'shapes') {
    return shapeSprite({ w: rand(8, 15), color: pick(p.colors), radius: i % 2 === 0 ? 'round' : 3, glow: 10 });
  }
  return emojiSprite(pick(p.emojis), rand(1.1, 1.9) * 16, pick(p.colors));
}

// ---------- Öffentliche Effekte ----------

/** Partikel-Explosion an einer Bildschirmposition. */
export function burstAt(x, y, theme, count = 14) {
  if (reduced() || !ensureCanvas()) return;
  const n = scaleCount(count);
  for (let i = 0; i < n; i++) {
    const ang = rand(0, Math.PI * 2);
    const dist = rand(50, 140);
    const dx = Math.cos(ang) * dist, dy = Math.sin(ang) * dist - 30;
    const rot = rand(-360, 360);
    spawn(makeSprite(theme, i), [
      { o: 0, x, y, s: 0.4, r: 0, a: 1 },
      { o: 0.5, x: x + dx * 0.7, y: y + dy * 0.7, s: 1, r: rot * 0.6, a: 1 },
      { o: 1, x: x + dx, y: y + dy + 60, s: 0.6, r: rot, a: 0 },
    ], { duration: rand(650, 1000), ease: EASE.burst });
  }
  const t = THEMES[theme];
  if (t?.particles.pops && Math.random() < 0.6) textPop(x, y - 20, pick(t.particles.pops), pick(t.particles.colors));
}

export function textPop(x, y, text, color) {
  if (reduced() || !ensureCanvas()) return;
  spawn(textSprite(text, color), [
    { o: 0, x, y, s: 0.3, a: 0 },
    { o: 0.3, x, y: y - 40, s: 1.15, a: 1 },
    { o: 1, x, y: y - 80, s: 1, a: 0 },
  ], { duration: 900, ease: EASE.out });
}

/** Partikel-Schauer aus der Bildschirmmitte. */
export function shower(theme, count = 80) {
  if (reduced() || !ensureCanvas()) return;
  const n = scaleCount(count);
  const cx = innerWidth / 2, cy = innerHeight / 2;
  for (let i = 0; i < n; i++) {
    const ang = rand(-Math.PI, 0) + rand(-0.3, 0.3);
    const v = rand(200, Math.max(innerWidth, innerHeight) * 0.6);
    const dx = Math.cos(ang) * v, dy = Math.sin(ang) * v;
    spawn(makeSprite(theme, i), [
      { o: 0, x: cx, y: cy, s: 0.5, r: 0, a: 1 },
      { o: 0.45, x: cx + dx * 0.8, y: cy + dy * 0.8, s: 1, r: rand(-180, 180), a: 1 },
      { o: 1, x: cx + dx, y: cy + dy + innerHeight * 0.6, s: 0.8, r: rand(-540, 540), a: 0 },
    ], { duration: rand(1400, 2200), ease: EASE.shower, delay: rand(0, 200) });
  }
}

export function flash(color) {
  const node = el('div', { class: 'flash', style: { background: `radial-gradient(circle at 50% 50%, ${color}, transparent 75%)` } });
  document.body.append(node);
  node.addEventListener('animationend', () => node.remove(), { once: true });
  setTimeout(() => node.remove(), 1200);
}

export function banner(text, theme) {
  const node = el('div', { class: 'banner', 'data-theme': theme }, text);
  document.body.append(node);
  node.addEventListener('animationend', () => node.remove(), { once: true });
  setTimeout(() => node.remove(), 3500);
}

export function toast(text, { action = null, duration = 2600 } = {}) {
  const box = $('#toasts');
  const node = el('div', { class: 'toast' }, el('span', {}, text));
  const remove = () => {
    node.classList.add('is-leaving');
    setTimeout(() => node.remove(), 300);
  };
  if (action) node.append(el('button', { type: 'button', class: 'btn', onclick: () => { action.onClick(); remove(); } }, action.label));
  box.append(node);
  if (duration > 0) setTimeout(remove, duration);
  return remove;
}

const FW_COLORS = ['#FFD34D', '#FF5C8A', '#5CE1FF', '#7CFF6B', '#C08BFF', '#FF9F1C', '#FFFFFF'];

/** n Feuerwerk-Bursts an zufälligen Positionen in der oberen Bildhälfte. */
export function fireworks(n = 1, { delayStep = 350 } = {}) {
  if (reduced() || !ensureCanvas()) return;
  for (let k = 0; k < n; k++) {
    const x = rand(innerWidth * 0.15, innerWidth * 0.85);
    const y = rand(innerHeight * 0.12, innerHeight * 0.45);
    const spr = shapeSprite({ w: 6, color: pick(FW_COLORS), radius: 'round', glow: 8, spread: 2 });
    const count = scaleCount(36);
    for (let i = 0; i < count; i++) {
      const ang = (i / count) * Math.PI * 2;
      const r = rand(80, 150);
      spawn(spr, [
        { o: 0, x, y, s: 1, a: 1 },
        { o: 0.6, x: x + Math.cos(ang) * r, y: y + Math.sin(ang) * r, s: 0.9, a: 1 },
        { o: 1, x: x + Math.cos(ang) * r * 1.1, y: y + Math.sin(ang) * r * 1.1 + 50, s: 0.3, a: 0 },
      ], { duration: rand(1000, 1400), ease: EASE.firework, delay: k * delayStep });
    }
  }
}

const CONFETTI_COLORS = ['#FF5C8A', '#FFD34D', '#5CE1FF', '#7CFF6B', '#C08BFF', '#FF9F1C'];

export function confetti(count = 60) {
  if (reduced() || !ensureCanvas()) return;
  const n = scaleCount(count);
  for (let i = 0; i < n; i++) {
    const x = rand(0, innerWidth);
    const w = rand(7, 12);
    const drift = rand(-80, 80);
    spawn(shapeSprite({ w, h: w * rand(1.3, 2), color: pick(CONFETTI_COLORS), radius: 2 }), [
      { o: 0, x, y: -30, r: 0, f: 0, a: 1 },
      { o: 1, x: x + drift, y: innerHeight + 40, r: rand(-720, 720), f: rand(360, 1080), a: 0.9 },
    ], { duration: rand(2400, 4000), delay: rand(0, 900) });
  }
}

/** Kleines Glitzer-Partikel (für Spuren). */
export function sparkle(x, y, color = '#FFD34D', size = 8) {
  if (reduced() || !ensureCanvas()) return;
  spawn(shapeSprite({ w: size, color, radius: 'round', glow: 10, spread: 3 }), [
    { o: 0, x, y, s: 1, a: 1 },
    { o: 1, x: x + rand(-14, 14), y: y + rand(6, 30), s: 0.1, a: 0 },
  ], { duration: rand(500, 900), ease: EASE.out });
}

export function dust(x, y) {
  if (reduced() || !ensureCanvas()) return;
  spawn(shapeSprite({ w: 14, color: 'rgba(200, 180, 150, .7)', radius: 'round' }), [
    { o: 0, x, y, s: 0.4, a: 0.8 },
    { o: 1, x: x - rand(10, 30), y: y - rand(5, 20), s: 1.6, a: 0 },
  ], { duration: 600, ease: EASE.out });
}

const SHAKE = [
  { translate: '0 0' }, { translate: '-8px 3px', offset: 0.2 }, { translate: '7px -4px', offset: 0.4 },
  { translate: '-5px 2px', offset: 0.6 }, { translate: '4px -2px', offset: 0.8 }, { translate: '0 0' },
];

/** Bildschirm-Wackeln als Web-Animation auf `translate`: stört weder transform noch die CSS-Animationen (z. B. das Einblenden der Overlays). */
export function shake() {
  if (reduced()) return;
  for (const node of [$('#app'), ...document.querySelectorAll('.overlay')]) node?.animate?.(SHAKE, { duration: 500, easing: 'ease-out' });
}
