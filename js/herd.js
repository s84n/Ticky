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
const CHEERS = ['Super!', 'Yeah!', '⭐', 'Toll!', 'Weiter so!', 'Juhu!', '💪', 'Klasse!'];
const YAWNS = ['Gähn… 😴', '😪', 'Ich werd müde…', 'Schnell, bitte!', '⏰', 'Beeil dich!'];
const WAKE = ['Ich bin wach! 😃', 'Weiter geht’s!', '⚡'];
const rand = (a, b) => a + Math.random() * (b - a);

/**
 * Baut das Team in `meadow` auf. onOpen() öffnet das Album (Tipp auf die leere Wiese oder die Reise-Anzeige).
 * Gibt { react(kind, clientX), setTired(on), refresh(), destroy() } zurück.
 * Müde (die Zeit wird knapp): langsamer, gähnt ab und zu – jede erledigte Aufgabe weckt das Team kurz auf.
 */
export function mountHerd(meadow, child, { onOpen } = {}) {
  let actors = [];
  let tired = false;
  let yawnTimer = null;

  function stop() {
    for (const a of actors) clearTimeout(a.timer);
    clearTimeout(yawnTimer);
    actors = [];
  }

  /** Rechter Rand der Laufstrecke in %: Das Team läuft nicht unter den Reise-Chip. */
  function maxX() {
    const chip = meadow.querySelector('.meadow__focus');
    const w = meadow.clientWidth;
    if (!chip) return 92;
    return w ? Math.max(30, Math.min(92, (chip.offsetLeft / w) * 100 - 7)) : 64;
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
      meadow.append(el('button', { type: 'button', class: 'meadow__empty', onclick: () => onOpen?.() }, 'Schaff deine Aufgaben – dann zieht hier jemand ein! 🌱'));
      return;
    }
    team.forEach((fig, i) => {
      const a = {
        fig, timer: null,
        x: ((i + 0.5) / team.length) * (focusOf(child) ? 56 : 80) + 10 + rand(-4, 4),
        fast: hasStep(child, fig, 'tempo'),
        trick: hasStep(child, fig, 'trick'),
      };
      a.node = el('button', {
        type: 'button', class: `herd-actor${hasStep(child, fig, 'groesse') ? ' is-big' : ''}${i === 0 ? ' is-leader' : ''}${fig.motion === 'fly' ? ' is-fly' : ''}`,
        'aria-label': i === 0 ? `${fig.name}, Anführer` : fig.name, onclick: () => greet(a),
      }, i === 0 ? el('span', { class: 'herd-crown emoji', 'aria-hidden': 'true' }, '👑') : null, figureView(fig, child, { alt: '' }));
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
        el('span', {}, `${stageOf(child, focus.id)}/${pathOf(focus).length} →`),
        el('span', { class: 'emoji', 'aria-hidden': 'true' }, step.icon)));
    }
  }

  /** Position als CSS-Variable: base.css schiebt die Figur per transform (Compositor, kein Layout pro Frame). */
  function setPos(a, dur) {
    a.node.style.transitionDuration = `${dur}s`;
    a.node.style.setProperty('--x', a.x);
  }

  /** Läuft zu x (%), danach cb. */
  function moveTo(a, x, cb, speed = tired ? 0.55 : 1) {
    const dist = Math.abs(x - a.x);
    const dur = Math.max(0.5, (dist * 0.09) / speed / (a.fast ? 1.8 : 1));
    a.node.classList.toggle('is-left', x < a.x);
    a.node.classList.add('is-moving');
    a.x = x;
    setPos(a, dur);
    later(a, () => { a.node.classList.remove('is-moving'); cb?.(); }, dur * 1000);
  }

  function wander(a) {
    moveTo(a, rand(8, maxX()), () => {
      if (a.fast && Math.random() < 0.35) play(a, 'is-salto', 750);
      else if (a.trick && Math.random() < 0.3) play(a, 'is-trick', 1300);
      later(a, () => wander(a), tired ? rand(4000, 9000) : rand(1200, 5200));
    });
  }

  function yawnLater() {
    clearTimeout(yawnTimer);
    if (!tired || !actors.length) return;
    yawnTimer = setTimeout(() => {
      if (!meadow.isConnected || !tired) return;
      bubble(pick(actors), pick(YAWNS));
      yawnLater();
    }, rand(7000, 14000));
  }

  function setTired(on) {
    if (on === tired) return;
    tired = on;
    meadow.classList.toggle('is-tired', on);
    if (on && actors.length) { bubble(pick(actors), pick(YAWNS)); yawnLater(); }
    else clearTimeout(yawnTimer);
  }

  /** Spielt eine CSS-Animation an der Figur ab. */
  function play(a, cls, ms) {
    const inner = a.node.querySelector('.fig');
    inner.classList.remove('is-happy', 'is-salto', 'is-trick', 'is-oops');
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
    a.node.querySelector('.herd-bubble')?.remove();
    const b = el('span', { class: 'herd-bubble' }, text);
    a.node.append(b);
    setTimeout(() => b.remove(), 1400);
  }

  function greet(a) {
    popSound();
    play(a, a.trick ? 'is-trick' : 'is-happy', a.trick ? 1300 : 900);
    bubble(a, Math.random() < 0.5 ? a.fig.name : pick(GREETINGS));
  }

  /**
   * 'cheer': eine Figur flitzt unter die abgehakte Aufgabe (clientX) und jubelt. 'party': alle feiern. 'oops': zurückgenommen.
   * text: Sprechblase (z. B. die Lob-Phrase), sonst eine zufällige.
   */
  function react(kind, clientX = null, text = null) {
    if (!actors.length) return;
    if (kind === 'party') {
      actors.forEach((a, i) => setTimeout(() => play(a, a.trick ? 'is-trick' : a.fast ? 'is-salto' : 'is-happy', 1300), i * 160));
      bubble(actors[0], text ?? pick(['Juhuuu!', 'Geschafft!', '🎉🎉🎉', 'Super!']));
      return;
    }
    if (kind === 'oops') {
      const a = pick(actors);
      play(a, 'is-oops', 700);
      bubble(a, text ?? pick(['Hoppla! 🙈', 'Oh! 🙈', '🤔', 'Nochmal?']));
      return;
    }
    const a = pick(actors);
    // Die anderen hüpfen vor Freude mit, wer gerade müde ist, wird kurz wach
    actors.forEach((o, i) => { if (o !== a) setTimeout(() => play(o, 'is-happy', 900), 120 + i * 140); });
    if (tired) { bubble(a, pick(WAKE)); yawnLater(); }
    else bubble(a, text ?? pick(CHEERS));
    if (isReduced() || clientX === null) { play(a, 'is-happy', 900); return; }
    const r = meadow.getBoundingClientRect();
    const x = Math.min(maxX(), Math.max(8, ((clientX - r.left) / r.width) * 100));
    moveTo(a, x, () => {
      play(a, 'is-happy', 900);
      later(a, () => wander(a), rand(1500, 3500));
    }, 2.2);
  }

  build();
  return {
    react, setTired,
    refresh() { build(); if (tired) yawnLater(); },
    destroy: stop,
  };
}
