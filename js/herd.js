// Das Team (bis zu 3 Figuren) läuft unten auf der Kinder-Card über eine Wiese und reagiert aufs Abhaken.
// Upgrades wirken hier: Turbo = schneller + Saltos, Wachstum = größer, Trick = eigene Einlage, Verwandlung = Aura.
import { el, clear } from './ui.js';
import { figureById } from './data/figures.js';
import { hasStep, focusOf, nextStep, stageOf, pathOf, EVO_STEPS } from './data/progression.js';
import { figureView } from './figure-view.js';
import { isReduced } from './fx.js';
import { popSound } from './audio.js';
import { pick } from './util.js';

const GREETINGS = ['Hallo!', 'Hihi!', 'Juhu!', '💖', 'Hey!', '✨', 'Yeah!', '😄', 'Weiter so!', 'Du schaffst das!'];
const rand = (a, b) => a + Math.random() * (b - a);

/**
 * Baut das Team in `meadow` auf. onOpen() öffnet das Album (Tipp auf die leere Wiese oder die Reise-Anzeige).
 * Gibt { react(kind, clientX), refresh(), destroy() } zurück.
 */
export function mountHerd(meadow, child, { onOpen } = {}) {
  let actors = [];

  function stop() {
    for (const a of actors) clearTimeout(a.timer);
    actors = [];
  }

  function later(a, fn, ms) {
    clearTimeout(a.timer);
    a.timer = setTimeout(() => { if (meadow.isConnected) fn(); }, ms);
  }

  function build() {
    stop();
    clear(meadow);
    const team = (child.team ?? []).map(figureById).filter(Boolean);
    if (!team.length) {
      meadow.append(el('button', { type: 'button', class: 'meadow__empty', onclick: () => onOpen?.() }, '🎡 Schaff deine Aufgaben – dann zieht hier jemand ein!'));
      return;
    }
    team.forEach((fig, i) => {
      const a = {
        fig, timer: null,
        x: ((i + 0.5) / team.length) * 80 + 10 + rand(-6, 6),
        fast: hasStep(child, fig, 'tempo'),
        trick: hasStep(child, fig, 'trick'),
      };
      a.node = el('button', {
        type: 'button', class: `herd-actor${hasStep(child, fig, 'groesse') ? ' is-big' : ''}${i === 0 ? ' is-leader' : ''}${fig.motion === 'fly' ? ' is-fly' : ''}`,
        'aria-label': fig.name, onclick: () => greet(a),
      }, figureView(fig, child, { alt: '' }));
      setPos(a, 0);
      meadow.append(a.node);
      actors.push(a);
      if (!isReduced()) later(a, () => wander(a), rand(400, 2600));
    });
    const focus = focusOf(child);
    if (focus) {
      const step = EVO_STEPS[nextStep(child, focus)];
      meadow.append(el('button', {
        type: 'button', class: 'meadow__focus', onclick: () => onOpen?.(),
        'aria-label': `Upgrade-Reise von ${focus.name}: ${stageOf(child, focus.id)} von ${pathOf(focus).length}. Als Nächstes ${step.label}.`,
      },
        el('img', { src: focus.svg, alt: '' }),
        el('span', {}, `${stageOf(child, focus.id)}/${pathOf(focus).length}`),
        el('span', { class: 'emoji', 'aria-hidden': 'true' }, step.icon)));
    }
  }

  /** Position als CSS-Variable: base.css schiebt die Figur per transform (Compositor, kein Layout pro Frame). */
  function setPos(a, dur) {
    a.node.style.transitionDuration = `${dur}s`;
    a.node.style.setProperty('--x', a.x);
  }

  /** Läuft zu x (%), danach cb. */
  function moveTo(a, x, cb, speed = 1) {
    const dist = Math.abs(x - a.x);
    const dur = Math.max(0.5, (dist * 0.09) / speed / (a.fast ? 1.8 : 1));
    a.node.classList.toggle('is-left', x < a.x);
    a.node.classList.add('is-moving');
    a.x = x;
    setPos(a, dur);
    later(a, () => { a.node.classList.remove('is-moving'); cb?.(); }, dur * 1000);
  }

  function wander(a) {
    moveTo(a, rand(8, 92), () => {
      if (a.fast && Math.random() < 0.35) play(a, 'is-salto', 750);
      else if (a.trick && Math.random() < 0.3) play(a, 'is-trick', 1300);
      later(a, () => wander(a), rand(1200, 5200));
    });
  }

  /** Spielt eine CSS-Animation an der Figur ab. */
  function play(a, cls, ms) {
    const inner = a.node.querySelector('.fig');
    inner.classList.remove('is-happy', 'is-salto', 'is-trick');
    // Neustart der Animation im nächsten Frame statt per erzwungenem Reflow
    requestAnimationFrame(() => requestAnimationFrame(() => {
      inner.classList.add(cls);
      setTimeout(() => inner.classList.remove(cls), ms);
    }));
    if (cls === 'is-trick') hearts(a);
  }

  function hearts(a) {
    for (let k = 0; k < 3; k++) {
      const h = el('span', { class: 'herd-heart', 'aria-hidden': 'true', style: { left: `${30 + k * 20}%`, animationDelay: `${k * 0.15}s` } }, pick(['💖', '⭐', '💫']));
      a.node.append(h);
      setTimeout(() => h.remove(), 1400);
    }
  }

  function bubble(a, text) {
    a.node.querySelector('.world-bubble')?.remove();
    const b = el('span', { class: 'world-bubble' }, text);
    a.node.append(b);
    setTimeout(() => b.remove(), 1800);
  }

  function greet(a) {
    popSound();
    play(a, a.trick ? 'is-trick' : 'is-happy', a.trick ? 1300 : 900);
    bubble(a, Math.random() < 0.5 ? a.fig.name : pick(GREETINGS));
  }

  /** 'cheer': eine Figur flitzt unter die abgehakte Aufgabe (clientX) und jubelt. 'party': alle feiern. */
  function react(kind, clientX = null) {
    if (!actors.length) return;
    if (kind === 'party') {
      actors.forEach((a, i) => setTimeout(() => play(a, a.trick ? 'is-trick' : a.fast ? 'is-salto' : 'is-happy', 1300), i * 160));
      bubble(actors[0], pick(['Juhuuu!', 'Geschafft!', '🎉🎉🎉', 'Super!']));
      return;
    }
    const a = pick(actors);
    if (isReduced() || clientX === null) { play(a, 'is-happy', 900); return; }
    const r = meadow.getBoundingClientRect();
    const x = Math.min(92, Math.max(8, ((clientX - r.left) / r.width) * 100));
    moveTo(a, x, () => {
      play(a, 'is-happy', 900);
      later(a, () => wander(a), rand(1500, 3500));
    }, 2.2);
  }

  build();
  return { react, refresh: build, destroy: stop };
}
