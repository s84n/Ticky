// Ablauf rund um das Fertigwerden: Kind-Abschluss → Glücksrad → Parade → ggf. Gesamt-Feier.
import { el, openOverlay } from './ui.js';
import { state, save, spinKey } from './store.js';
import { THEMES } from './data/themes.js';
import { overallStats, spinStatus } from './routine.js';
import { localDate } from './util.js';
import { toast, flash, shower, banner, fireworks, confetti } from './fx.js';
import { completeSound, fanfareSound, levelUpSound } from './audio.js';
import { openWheel } from './rewards/wheel.js';
import { runParade } from './rewards/parade.js';
import { isEpic } from './data/figures.js';
import { addFigure, applyUpgrade, trackSpin, focusOf, levelTitle, accessoryById } from './data/progression.js';

let hooks = { getRoutine: () => null, refreshChild: () => {} };
const queue = [];
let busy = false;
const celebratedAll = new Set();
const pendingLevelUps = new Map(); // childId → reward (Level-Aufstieg wird nach Rad und Parade gefeiert)

export function initCelebrate(h) { hooks = { ...hooks, ...h }; }

/** Sofort-Feedback, wenn ein Kind alle Aufgaben erledigt hat. reward: XP-Gewinn (nur beim ersten Abschluss am Tag). */
export function childCompleted(child, routine, reward = null) {
  const t = THEMES[child.theme];
  toast(reward ? `Alles fertig! 🎉 +${reward.xp} XP` : 'Alles fertig! 🎉');
  if (reward && reward.levelAfter > reward.levelBefore) pendingLevelUps.set(child.id, reward);
  flash(t.flash);
  shower(child.theme, 80);
  setTimeout(() => shower(child.theme, 80), 650);
  banner(`🏆 ${child.name} ist fertig! 🏆`, child.theme);
  completeSound(child.theme);
  if (spinStatus(state, routine, child.id) === 'pending') setTimeout(() => requestSpin(child.id), 1500);
  else setTimeout(async () => { await showLevelUp(child.id); maybeCelebrateAll(); }, 1500);
}

/** Feiert einen anstehenden Level-Aufstieg. Promise wird erfüllt, wenn der Dialog zu ist. */
function showLevelUp(childId) {
  const reward = pendingLevelUps.get(childId);
  pendingLevelUps.delete(childId);
  const child = state.children.find(c => c.id === childId);
  if (!reward || !child) return Promise.resolve();
  const titles = THEMES[child.theme].levelTitles;
  const oldTitle = levelTitle(titles, reward.levelBefore);
  const newTitle = levelTitle(titles, reward.levelAfter);
  return new Promise(resolve => {
    const box = el('div', { class: 'levelup', 'data-theme': child.theme },
      el('div', { class: 'levelup__badge', 'aria-hidden': 'true' }, String(reward.levelAfter)),
      el('h2', { class: 'levelup__title' }, '⭐ LEVEL UP! ⭐'),
      el('p', { class: 'levelup__text' }, `${child.name} ist jetzt Level ${reward.levelAfter}!`),
      newTitle !== oldTitle ? el('p', { class: 'levelup__rank' }, `Neuer Titel: ${newTitle}`) : null,
      giftLine(reward.gift),
      el('button', { type: 'button', class: 'btn btn--primary btn--big', autofocus: true, onclick: () => close() }, 'Juhu! 🎉'));
    levelUpSound();
    fireworks(2);
    confetti(60);
    const { close } = openOverlay(box, { label: 'Level-Aufstieg', className: 'celebration-overlay', theme: child.theme, onClose: () => { hooks.refreshChild(childId); resolve(); } });
  });
}

function giftLine(accId) {
  const acc = accessoryById(accId);
  return acc ? el('p', { class: 'levelup__gift' }, `Geschenk: ${acc.icon} ${acc.label} für deine Figuren!`) : null;
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
      commit(result) {
        // Ergebnis sofort speichern: Neustart während der Animation ergibt kein zweites Rad.
        const c = state.children.find(x => x.id === child.id);
        if (!c) return null;
        const hadTarget = !!focusOf(c);
        let gain;
        if (result.kind === 'upgrade') {
          gain = { isNew: false, upgrade: applyUpgrade(c, result.fig), gift: null };
        } else {
          gain = addFigure(c, result.fig);
          c.sinceLegendary = isEpic(result.fig.rarity) ? 0 : (c.sinceLegendary ?? 0) + 1;
        }
        trackSpin(c, !!gain.upgrade, hadTarget);
        state.spins[spinKey(localDate(), routine, c.id)] = 'done';
        save();
        return gain;
      },
      async onFinish(result) {
        hooks.refreshChild(child.id);
        if (result) await runParade(result.fig, state.children.find(x => x.id === child.id));
        await showLevelUp(child.id);
        resolve();
      },
      async onCancel() { await showLevelUp(child.id); resolve(); },
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
