// Ablauf rund um das Fertigwerden: Kind-Abschluss → Glücksrad → Parade → ggf. Gesamt-Feier.
import { el, openOverlay, autoPress } from './ui.js';
import { figureView } from './figure-view.js';
import { isLite } from './perf.js';
import { state, save, spinKey } from './store.js';
import { THEMES } from './data/themes.js';
import { overallStats, spinStatus } from './routine.js';
import { localDate } from './util.js';
import { toast, flash, shower, banner, fireworks, confetti } from './fx.js';
import { completeSound, fanfareSound, levelUpSound } from './audio.js';
import { openWheel } from './rewards/wheel.js';
import { runParade } from './rewards/parade.js';
import { isEpic, figureById } from './data/figures.js';
import { addFigure, applyUpgrade, trackSpin, focusOf, levelInfo, levelTitle, accessoryById, ACCESSORY_IDS, TEAM_MAX } from './data/progression.js';

// Nach dieser Zeit schließen sich Level-up und Gesamt-Feier von selbst (Tippen schließt sofort).
const LEVELUP_MS = 8000, CELEBRATION_MS = 10000;

let hooks = { getRoutine: () => null, refreshChild: () => {} };
const queue = [];
let busy = false;
const celebratedAll = new Set();
const incoming = new Set(); // Kinder, deren Rad gleich automatisch öffnet
const pendingLevelUps = new Map(); // childId → reward (Level-Aufstieg wird nach Rad und Parade gefeiert)
const forcedRarity = new Map(); // Demo: childId → gewünschtes Rad-Ergebnis

export function initCelebrate(h) { hooks = { ...hooks, ...h }; }

/** Sofort-Feedback, wenn ein Kind alle Aufgaben erledigt hat. reward: XP-Gewinn (nur beim ersten Abschluss am Tag). */
export function childCompleted(child, routine, reward = null) {
  const t = THEMES[child.theme];
  toast(reward ? `Alles fertig! 🎉 +${reward.xp} XP` : 'Alles fertig! 🎉');
  if (reward?.blitz) setTimeout(() => { toast(`⚡ Blitz-Bonus! +${reward.blitz} XP extra`); flash('rgba(255, 221, 87, .55)'); }, 900);
  if (reward && reward.levelAfter > reward.levelBefore) pendingLevelUps.set(child.id, reward);
  flash(t.flash);
  shower(child.theme, 80);
  setTimeout(() => shower(child.theme, 80), 650);
  banner(`🏆 ${child.name} ist fertig! 🏆`, child.theme);
  completeSound(child.theme);
  if (spinStatus(state, routine, child.id) === 'pending') {
    // Das Rad öffnet gleich von selbst: so lange keinen „Glücksrad drehen“-Knopf zeigen, der nicht mehr klickbar wäre
    incoming.add(child.id);
    hooks.refreshChild(child.id);
    setTimeout(() => { incoming.delete(child.id); requestSpin(child.id); }, 1500);
  }
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
  const info = levelInfo(child.xp);
  return new Promise(resolve => {
    const box = el('div', { class: 'levelup', 'data-theme': child.theme },
      el('div', { class: 'levelup__rays', 'aria-hidden': 'true' }),
      el('p', { class: 'levelup__kicker' }, 'LEVEL UP!'),
      el('div', { class: 'levelup__badge' }, el('span', {}, 'Level'), el('strong', {}, String(reward.levelAfter))),
      el('p', { class: 'sr-only' }, `${child.name} ist jetzt Level ${reward.levelAfter}!`),
      newTitle !== oldTitle ? el('div', { class: 'levelup__rank' }, el('span', {}, 'Neuer Titel'), el('strong', {}, newTitle)) : null,
      giftCard(reward.gift),
      info.need ? el('div', { class: 'levelup__xp' },
        el('span', { class: 'levelup__bar' }, el('span', { style: { width: `${(info.into / info.need) * 100}%` } })),
        el('span', {}, `${info.into} / ${info.need} XP bis Level ${info.level + 1}`)) : null,
      el('button', { type: 'button', class: 'btn btn--primary btn--cta', autofocus: true, onclick: () => close() }, 'Juhu! 🎉'));
    autoPress(box.lastChild, LEVELUP_MS);
    levelUpSound();
    fireworks(2);
    confetti(60);
    const { close } = openOverlay(box, { label: 'Level-Aufstieg', className: 'levelup-overlay', theme: child.theme, onClose: () => { hooks.refreshChild(childId); resolve(); } });
  });
}

/** Geschenk-Karte (goldener Rand) mit dem neuen Accessoire. */
function giftCard(accId) {
  const acc = accessoryById(accId);
  return acc ? el('div', { class: 'gift-card' },
    el('span', { class: 'gift-card__icon emoji', 'aria-hidden': 'true' }, acc.icon),
    el('span', { class: 'gift-card__text' }, el('strong', {}, `Geschenk: ${acc.label}`), el('span', {}, 'Im Album kannst du deine Figuren damit schmücken.'))) : null;
}

/** Stellt ein Glücksrad für ein Kind in die Warteschlange (immer nur ein Rad gleichzeitig). */
export function requestSpin(childId) {
  if (current === childId) {
    if (document.querySelector('.wheel-overlay')) return; // Rad ist schon offen
    abortCurrent?.(); // Ablauf hängt ohne sichtbares Rad: freigeben, damit es neu öffnet
  }
  if (queue.includes(childId)) return;
  queue.push(childId);
  hooks.refreshChild(childId); // Knopf weg, solange das Rad wartet oder offen ist
  processQueue();
}

let current = null;
let abortCurrent = null;

async function processQueue() {
  if (busy) return;
  busy = true;
  try {
    while (queue.length) {
      const id = queue.shift();
      const routine = hooks.getRoutine();
      const child = state.children.find(c => c.id === id);
      if (!child || !routine || spinStatus(state, routine, id) !== 'pending') continue;
      current = id;
      // Ein Fehler im Ablauf darf die Warteschlange nie dauerhaft blockieren (sonst öffnet der Knopf kein Rad mehr).
      try { await spinFlow(child, routine); }
      catch (e) { console.error('Glücksrad-Ablauf fehlgeschlagen', e); }
      finally { current = null; abortCurrent = null; forcedRarity.delete(id); hooks.refreshChild(id); }
    }
  } finally {
    busy = false;
  }
  maybeCelebrateAll();
}

function spinFlow(child, routine) {
  return new Promise((resolve, reject) => {
    let settled = false;
    const finish = () => { if (!settled) { settled = true; resolve(); } };
    abortCurrent = finish;
    const after = async (work) => {
      try { await work(); } catch (e) { console.error(e); } finally { finish(); }
    };
    try {
      openWheel(child, {
        settings: state.settings,
        forceRarity: forcedRarity.get(child.id) ?? null,
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
        onFinish: result => after(async () => {
          hooks.refreshChild(child.id);
          if (result) await runParade(result.fig, state.children.find(x => x.id === child.id));
          await showLevelUp(child.id);
        }),
        onCancel: () => after(() => showLevelUp(child.id)),
      });
    } catch (e) {
      settled = true;
      reject(e);
    }
  });
}

export function isBusy() { return busy; }

/** true, solange das Rad dieses Kindes gleich öffnet, wartet oder offen ist (dann braucht es keinen Knopf). */
export function wheelComing(childId) {
  return incoming.has(childId) || queue.includes(childId) || current === childId;
}

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

/** Gesamt-Feier: alle Kinder fertig. Die Teams aller Kinder hüpfen gemeinsam über den Bildschirm. Über 🏆 erneut aufrufbar. */
export function openAllCelebration() {
  const perChild = isLite() ? 1 : TEAM_MAX; // Sparmodus: nur der Anführer jedes Teams
  const party = el('div', { class: 'celebration__party', 'aria-hidden': 'true' });
  let i = 0;
  for (const c of state.children) {
    const team = (c.team ?? []).map(figureById).filter(Boolean).slice(0, perChild);
    const actors = team.length ? team.map(f => figureView(f, c, { alt: '' })) : [el('span', { class: 'party-avatar emoji' }, c.avatar)];
    for (const a of actors) {
      a.classList.add('party-fig');
      a.style.setProperty('--i', i++);
      party.append(a);
    }
  }
  party.style.setProperty('--n', i);
  const kids = el('div', { class: 'celebration__kids' }, ...state.children.map(c =>
    el('div', { class: 'summary-chip', 'data-theme': c.theme }, el('span', { class: 'emoji', 'aria-hidden': 'true' }, c.avatar), el('span', {}, c.name))));
  const btn = el('button', { type: 'button', class: 'btn btn--primary btn--big', autofocus: true, onclick: () => close() }, 'Super! 🎉');
  const box = el('div', { class: 'celebration' },
    el('h2', { class: 'celebration__title' }, '🏆 Alle fertig! 🏆'),
    el('p', { class: 'celebration__sub' }, 'Großartig gemacht!'),
    party, kids, btn);
  autoPress(btn, CELEBRATION_MS);
  fanfareSound();
  fireworks(2, { delayStep: 500 });
  confetti(50);
  const { close } = openOverlay(box, { label: 'Alle fertig', className: 'celebration-overlay' });
}

// ---------- Demo-Modus ----------

let savedCelebrated = null;

/** Demo an/aus: Was in der Demo gefeiert wurde, zählt danach nicht (die echte „Alle fertig“-Feier kommt trotzdem). */
export function setDemoCelebrations(on) {
  if (on) savedCelebrated = new Set(celebratedAll);
  else if (savedCelebrated) {
    celebratedAll.clear();
    for (const k of savedCelebrated) celebratedAll.add(k);
    savedCelebrated = null;
  }
  pendingLevelUps.clear();
  forcedRarity.clear();
}

/** Demo: Glücksrad für ein Kind, optional mit festem Ergebnis (Rarität oder 'upgrade'). */
export function demoSpin(childId, rarity = null) {
  const routine = hooks.getRoutine();
  if (!routine || wheelComing(childId)) return;
  state.spins[spinKey(localDate(), routine, childId)] = 'pending';
  if (rarity) forcedRarity.set(childId, rarity);
  requestSpin(childId);
}

/** Demo: Level-Aufstieg um eine Stufe, mit Geschenk. */
export function demoLevelUp(childId) {
  const child = state.children.find(c => c.id === childId);
  if (!child) return;
  const level = levelInfo(child.xp).level;
  pendingLevelUps.set(childId, { xp: 0, levelBefore: level, levelAfter: level + 1, gift: ACCESSORY_IDS[Math.floor(Math.random() * ACCESSORY_IDS.length)] });
  showLevelUp(childId);
}
