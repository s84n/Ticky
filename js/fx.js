// Effekte: Partikel, Screen-Flash, Toasts, Lob-Bubbles, Banner, Feuerwerk, Konfetti.
import { THEMES } from './data/themes.js';
import { el, $ } from './ui.js';
import { pick } from './util.js';

const MAX_PARTICLES = 150;
let live = 0;
let reduced = () => false;

export function setReducedMotionGetter(fn) { reduced = fn; }
export const isReduced = () => reduced();
const isMobile = () => window.matchMedia('(max-width: 699.98px)').matches;
const scaleCount = n => Math.max(1, Math.round(isMobile() ? n / 2 : n));
const layer = () => $('#fx-layer');
const rand = (a, b) => a + Math.random() * (b - a);

/** Ein einzelnes Partikel per Web Animations API; wird nach Ende entfernt. */
function particle(node, keyframes, opts) {
  if (live >= MAX_PARTICLES) return null;
  live++;
  layer().append(node);
  const anim = node.animate(keyframes, { fill: 'forwards', ...opts });
  const done = () => { node.remove(); live--; };
  anim.onfinish = done;
  anim.oncancel = done;
  return anim;
}

function makeParticle(theme, i) {
  const t = THEMES[theme] ?? THEMES.pixel;
  const p = t.particles;
  if (p.kind === 'blocks') {
    if (i % 7 === 0) return el('div', { class: 'particle particle--emoji', style: { fontSize: '1.6rem' } }, p.emoji);
    const s = rand(8, 16);
    return el('div', { class: 'particle', style: { width: `${s}px`, height: `${s}px`, background: pick(p.colors), boxShadow: 'inset -2px -2px 0 rgba(0,0,0,.25)' } });
  }
  if (p.kind === 'shapes') {
    const s = rand(8, 15);
    const round = i % 2 === 0;
    const c = pick(p.colors);
    return el('div', { class: 'particle', style: { width: `${s}px`, height: `${s}px`, background: c, borderRadius: round ? '50%' : '3px', boxShadow: `0 0 10px ${c}` } });
  }
  return el('div', { class: 'particle particle--emoji', style: { fontSize: `${rand(1.1, 1.9)}rem`, filter: `drop-shadow(0 0 6px ${pick(p.colors)})` } }, pick(p.emojis));
}

/** Partikel-Explosion an einer Bildschirmposition. */
export function burstAt(x, y, theme, count = 14) {
  if (reduced()) return;
  const n = scaleCount(count);
  for (let i = 0; i < n; i++) {
    const node = makeParticle(theme, i);
    const ang = rand(0, Math.PI * 2);
    const dist = rand(50, 140);
    const dx = Math.cos(ang) * dist, dy = Math.sin(ang) * dist - 30;
    const rot = rand(-360, 360);
    particle(node, [
      { transform: `translate(${x}px, ${y}px) translate(-50%, -50%) scale(.4) rotate(0deg)`, opacity: 1 },
      { transform: `translate(${x + dx * .7}px, ${y + dy * .7}px) translate(-50%, -50%) scale(1) rotate(${rot * .6}deg)`, opacity: 1, offset: .5 },
      { transform: `translate(${x + dx}px, ${y + dy + 60}px) translate(-50%, -50%) scale(.6) rotate(${rot}deg)`, opacity: 0 },
    ], { duration: rand(650, 1000), easing: 'cubic-bezier(.2,.8,.3,1)' });
  }
  const t = THEMES[theme];
  if (t?.particles.pops && Math.random() < .6) textPop(x, y - 20, pick(t.particles.pops), pick(t.particles.colors));
}

export function textPop(x, y, text, color) {
  if (reduced()) return;
  const node = el('div', { class: 'particle particle--text', style: { color } }, text);
  particle(node, [
    { transform: `translate(${x}px, ${y}px) translate(-50%, -50%) scale(.3)`, opacity: 0 },
    { transform: `translate(${x}px, ${y - 40}px) translate(-50%, -50%) scale(1.15)`, opacity: 1, offset: .3 },
    { transform: `translate(${x}px, ${y - 80}px) translate(-50%, -50%) scale(1)`, opacity: 0 },
  ], { duration: 900, easing: 'ease-out' });
}

/** Partikel-Schauer aus der Bildschirmmitte. */
export function shower(theme, count = 80) {
  if (reduced()) return;
  const n = scaleCount(count);
  const cx = innerWidth / 2, cy = innerHeight / 2;
  for (let i = 0; i < n; i++) {
    const node = makeParticle(theme, i);
    const ang = rand(-Math.PI, 0) + rand(-.3, .3);
    const v = rand(200, Math.max(innerWidth, innerHeight) * .6);
    const dx = Math.cos(ang) * v, dy = Math.sin(ang) * v;
    particle(node, [
      { transform: `translate(${cx}px, ${cy}px) translate(-50%, -50%) scale(.5)`, opacity: 1 },
      { transform: `translate(${cx + dx * .8}px, ${cy + dy * .8}px) translate(-50%, -50%) scale(1) rotate(${rand(-180, 180)}deg)`, opacity: 1, offset: .45 },
      { transform: `translate(${cx + dx}px, ${cy + dy + innerHeight * .6}px) translate(-50%, -50%) scale(.8) rotate(${rand(-540, 540)}deg)`, opacity: 0 },
    ], { duration: rand(1400, 2200), easing: 'cubic-bezier(.15,.7,.4,1)', delay: rand(0, 200) });
  }
}

export function flash(color) {
  const node = el('div', { class: 'flash', style: { background: `radial-gradient(circle at 50% 50%, ${color}, transparent 75%)` } });
  document.body.append(node);
  node.addEventListener('animationend', () => node.remove(), { once: true });
  setTimeout(() => node.remove(), 1200);
}

export function praiseAt(text, x, y, theme) {
  const node = el('div', { class: 'praise', 'data-theme': theme, style: { left: `${x}px`, top: `${y}px` } }, text);
  layer().append(node);
  node.addEventListener('animationend', () => node.remove(), { once: true });
  setTimeout(() => node.remove(), 2000);
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
  if (reduced()) return;
  for (let k = 0; k < n; k++) {
    setTimeout(() => {
      const x = rand(innerWidth * .15, innerWidth * .85);
      const y = rand(innerHeight * .12, innerHeight * .45);
      const color = pick(FW_COLORS);
      const count = scaleCount(36);
      for (let i = 0; i < count; i++) {
        const ang = (i / count) * Math.PI * 2;
        const r = rand(80, 150);
        const node = el('div', { class: 'particle', style: { width: '6px', height: '6px', borderRadius: '50%', background: color, boxShadow: `0 0 8px 2px ${color}` } });
        particle(node, [
          { transform: `translate(${x}px, ${y}px) scale(1)`, opacity: 1 },
          { transform: `translate(${x + Math.cos(ang) * r}px, ${y + Math.sin(ang) * r}px) scale(.9)`, opacity: 1, offset: .6 },
          { transform: `translate(${x + Math.cos(ang) * r * 1.1}px, ${y + Math.sin(ang) * r * 1.1 + 50}px) scale(.3)`, opacity: 0 },
        ], { duration: rand(1000, 1400), easing: 'cubic-bezier(.1,.8,.3,1)' });
      }
    }, k * delayStep);
  }
}

const CONFETTI_COLORS = ['#FF5C8A', '#FFD34D', '#5CE1FF', '#7CFF6B', '#C08BFF', '#FF9F1C'];

export function confetti(count = 60) {
  if (reduced()) return;
  const n = scaleCount(count);
  for (let i = 0; i < n; i++) {
    const x = rand(0, innerWidth);
    const w = rand(7, 12);
    const node = el('div', { class: 'particle', style: { width: `${w}px`, height: `${w * rand(1.3, 2)}px`, background: pick(CONFETTI_COLORS), borderRadius: '2px' } });
    const drift = rand(-80, 80);
    particle(node, [
      { transform: `translate(${x}px, -30px) rotate(0deg) rotateY(0deg)`, opacity: 1 },
      { transform: `translate(${x + drift}px, ${innerHeight + 40}px) rotate(${rand(-720, 720)}deg) rotateY(${rand(360, 1080)}deg)`, opacity: .9 },
    ], { duration: rand(2400, 4000), delay: rand(0, 900), easing: 'linear' });
  }
}

/** Kleines Glitzer-Partikel (für Spuren). */
export function sparkle(x, y, color = '#FFD34D', size = 8) {
  if (reduced()) return;
  const node = el('div', { class: 'particle', style: { width: `${size}px`, height: `${size}px`, borderRadius: '50%', background: color, boxShadow: `0 0 10px 3px ${color}` } });
  particle(node, [
    { transform: `translate(${x}px, ${y}px) scale(1)`, opacity: 1 },
    { transform: `translate(${x + rand(-14, 14)}px, ${y + rand(6, 30)}px) scale(.1)`, opacity: 0 },
  ], { duration: rand(500, 900), easing: 'ease-out' });
}

export function dust(x, y) {
  if (reduced()) return;
  const node = el('div', { class: 'particle', style: { width: '14px', height: '14px', borderRadius: '50%', background: 'rgba(200, 180, 150, .7)' } });
  particle(node, [
    { transform: `translate(${x}px, ${y}px) scale(.4)`, opacity: .8 },
    { transform: `translate(${x - rand(10, 30)}px, ${y - rand(5, 20)}px) scale(1.6)`, opacity: 0 },
  ], { duration: 600, easing: 'ease-out' });
}

export function shake() {
  if (reduced()) return;
  document.body.classList.remove('shake');
  void document.body.offsetWidth;
  document.body.classList.add('shake');
  setTimeout(() => document.body.classList.remove('shake'), 600);
}
