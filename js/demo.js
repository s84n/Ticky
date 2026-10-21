// Demo-Modus: Effekte ausprobieren (Glücksrad mit festem Ergebnis, Level-up, Feiern), ohne dass Level, Figuren
// oder Fortschritt sich dauerhaft ändern. Speichern ist währenddessen abgeschaltet (store.js), beim Beenden
// wird der gespeicherte Stand neu geladen.
import { el, openOverlay } from './ui.js';
import { state, startDemo, endDemo, isDemo, spinKey } from './store.js';
import { localDate } from './util.js';
import { THEMES } from './data/themes.js';
import { RARITIES } from './data/figures.js';
import { focusOf } from './data/progression.js';
import { childCompleted, openAllCelebration, demoSpin, demoLevelUp, setDemoCelebrations, isBusy } from './celebrate.js';
import { toast } from './fx.js';

let bar = null;
let hooks = { getRoutine: () => null, ensureRoutine: () => {}, refresh: () => {}, restart: () => {} };
let selected = null;

/** hooks: getRoutine(), ensureRoutine() – eine Routine anzeigen, refresh() – Hauptansicht neu, restart() – nach dem Beenden */
export function enterDemo(h) {
  if (isDemo()) return;
  hooks = { ...hooks, ...h };
  startDemo();
  setDemoCelebrations(true);
  document.body.classList.add('is-demo');
  hooks.ensureRoutine();
  bar = el('div', { class: 'demo-bar', role: 'region', 'aria-label': 'Demo-Modus' },
    el('button', { type: 'button', class: 'demo-bar__main', onclick: openPanel }, '🧪 Demo · Effekte'),
    el('button', { type: 'button', class: 'demo-bar__end', onclick: exitDemo }, 'Beenden'));
  document.body.append(bar);
  toast('Demo-Modus: nichts wird gespeichert.');
}

async function exitDemo() {
  if (isBusy()) { toast('Erst das Glücksrad fertig drehen.'); return; }
  bar?.remove();
  bar = null;
  document.body.classList.remove('is-demo');
  await endDemo();
  setDemoCelebrations(false);
  hooks.restart();
  toast('Demo beendet – alles wie vorher.');
}

/** Aufgaben und Glücksräder der laufenden Routine zurücksetzen (zum erneuten Abhaken). */
function resetRoutine() {
  const routine = hooks.getRoutine();
  if (!routine) return;
  for (const c of state.children) {
    state.progress[routine][c.id] = [];
    delete state.spins[spinKey(localDate(), routine, c.id)];
  }
  hooks.refresh();
}

function openPanel() {
  const routine = hooks.getRoutine();
  if (!state.children.some(c => c.id === selected)) selected = state.children[0]?.id ?? null;
  const body = el('div', { class: 'demo-panel' });
  const box = el('div', { class: 'dialog' },
    el('div', { class: 'dialog-head' },
      el('h2', {}, '🧪 Effekte testen'),
      el('button', { type: 'button', class: 'btn', onclick: () => close() }, 'Schließen')),
    body);
  const { close } = openOverlay(box, { label: 'Effekte testen' });
  const run = fn => () => { close(); setTimeout(fn, 200); };

  function render() {
    const child = state.children.find(c => c.id === selected);
    body.replaceChildren();
    if (!child || !routine) { body.append(el('p', { class: 'muted' }, 'Keine Routine aktiv.')); return; }

    const kids = el('div', { class: 'segmented demo-panel__kids', role: 'group', 'aria-label': 'Kind' });
    for (const c of state.children) {
      kids.append(el('button', { type: 'button', 'aria-pressed': String(c.id === selected), onclick: () => { selected = c.id; render(); } }, `${c.avatar} ${c.name}`));
    }

    const wheel = el('div', { class: 'btn-row' },
      el('button', { type: 'button', class: 'btn', onclick: run(() => demoSpin(child.id)) }, '🎲 Zufall'),
      ...['magisch', 'legendaer', 'mythisch', 'geheim'].map(r =>
        el('button', { type: 'button', class: 'btn', onclick: run(() => demoSpin(child.id, r)) }, RARITIES[r].label)),
      focusOf(child) ? el('button', { type: 'button', class: 'btn', onclick: run(() => demoSpin(child.id, 'upgrade')) }, '⭐ Upgrade') : null);

    body.append(
      el('p', { class: 'muted' }, `Alles hier ist nur ein Test – ${THEMES[child.theme].name}-Figuren, Level und XP von ${child.name} bleiben nach der Demo unverändert.`),
      kids,
      el('h3', {}, '🎡 Glücksrad mit Ergebnis'),
      wheel,
      el('h3', {}, '🎉 Feiern'),
      el('div', { class: 'btn-row' },
        el('button', { type: 'button', class: 'btn', onclick: run(() => childCompleted(child, routine, null)) }, '🏁 Kind fertig'),
        el('button', { type: 'button', class: 'btn', onclick: run(() => demoLevelUp(child.id)) }, '⬆️ Level-up'),
        el('button', { type: 'button', class: 'btn', onclick: run(openAllCelebration) }, '🏆 Alle fertig')),
      el('h3', {}, '🔄 Nochmal von vorn'),
      el('div', { class: 'btn-row' },
        el('button', { type: 'button', class: 'btn', onclick: run(resetRoutine) }, 'Alle Haken entfernen')),
      el('p', { class: 'muted' }, 'Danach können die Kinder ganz normal abhaken – mit allen Effekten, Rad und Level-up.'));
  }
  render();
}
