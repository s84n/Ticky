// Ablauf rund um das Fertigwerden: Kind-Abschluss → Glücksrad → Parade → ggf. Gesamt-Feier.
import { el, openOverlay } from './ui.js';
import { state, save, saveNow, spinKey } from './store.js';
import { THEMES } from './data/themes.js';
import { overallStats, spinStatus } from './routine.js';
import { localDate } from './util.js';
import { toast, flash, shower, banner, fireworks, confetti } from './fx.js';
import { completeSound, fanfareSound } from './audio.js';
import { openWheel } from './rewards/wheel.js';
import { runParade } from './rewards/parade.js';

let hooks = { getRoutine: () => null, refreshChild: () => {} };
const queue = [];
let busy = false;
const celebratedAll = new Set();

export function initCelebrate(h) { hooks = { ...hooks, ...h }; }

/** Sofort-Feedback, wenn ein Kind alle Aufgaben erledigt hat. */
export function childCompleted(child, routine) {
  const t = THEMES[child.theme];
  toast('Alles fertig! 🎉');
  flash(t.flash);
  shower(child.theme, 80);
  setTimeout(() => shower(child.theme, 80), 650);
  banner(`🏆 ${child.name} ist fertig! 🏆`, child.theme);
  completeSound(child.theme);
  if (spinStatus(state, routine, child.id) === 'pending') setTimeout(() => requestSpin(child.id), 1500);
  else maybeCelebrateAll();
}

/** Stellt ein Glücksrad für ein Kind in die Warteschlange (immer nur ein Rad gleichzeitig). */
export function requestSpin(childId) {
  if (queue.includes(childId) || current === childId) return;
  queue.push(childId);
  processQueue();
}

let current = null;

async function processQueue() {
  if (busy) return;
  busy = true;
  while (queue.length) {
    const id = queue.shift();
    const routine = hooks.getRoutine();
    const child = state.children.find(c => c.id === id);
    if (!child || !routine || spinStatus(state, routine, id) !== 'pending') continue;
    current = id;
    await spinFlow(child, routine);
    current = null;
  }
  busy = false;
  maybeCelebrateAll();
}

function spinFlow(child, routine) {
  return new Promise(resolve => {
    openWheel(child, {
      settings: state.settings,
      commit(fig) {
        // Ergebnis sofort speichern: Neustart während der Animation ergibt kein zweites Rad.
        const c = state.children.find(x => x.id === child.id);
        if (!c) return;
        c.figures[fig.id] = (c.figures[fig.id] ?? 0) + 1;
        c.sinceLegendary = fig.rarity === 'legendaer' ? 0 : (c.sinceLegendary ?? 0) + 1;
        state.spins[spinKey(localDate(), routine, c.id)] = 'done';
        save();
        saveNow();
      },
      async onFinish(fig) {
        hooks.refreshChild(child.id);
        if (fig) await runParade(fig);
        resolve();
      },
      onCancel() { resolve(); },
    });
  });
}

export function isBusy() { return busy; }

function maybeCelebrateAll() {
  const routine = hooks.getRoutine();
  if (!routine || busy) return;
  const key = `${localDate()}|${routine}`;
  if (celebratedAll.has(key)) return;
  if (!overallStats(state, routine).allComplete) return;
  if (state.children.some(c => spinStatus(state, routine, c.id) === 'pending')) return;
  celebratedAll.add(key);
  setTimeout(openAllCelebration, 500);
}

/** Gesamt-Feier: alle Kinder fertig. Über 🏆 erneut aufrufbar. */
export function openAllCelebration() {
  const kids = el('div', { class: 'celebration__kids' }, ...state.children.map(c =>
    el('div', { class: 'summary-chip', 'data-theme': c.theme }, el('span', { class: 'emoji', 'aria-hidden': 'true' }, c.avatar), el('span', {}, c.name))));
  const box = el('div', { class: 'celebration' },
    el('h2', { class: 'celebration__title' }, '🏆 Alle fertig! 🏆'),
    el('p', { class: 'celebration__sub' }, 'Großartig gemacht!'),
    kids,
    el('button', { type: 'button', class: 'btn btn--primary btn--big', autofocus: true, onclick: () => close() }, 'Super! 🎉'));
  fanfareSound();
  fireworks(3);
  confetti(80);
  const timer = setInterval(() => { fireworks(2); confetti(30); }, 1800);
  const { close } = openOverlay(box, { label: 'Alle fertig', className: 'celebration-overlay', onClose: () => clearInterval(timer) });
}
