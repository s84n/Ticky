// Rendering der Hauptansicht: Kinder-Cards, Task-Listen, Fortschrittsanzeigen, Tabs, Header, Ruhe-Screen.
import { el, svg, clear, $, starIcon } from './ui.js';
import { TASK_CATALOG, ROUTINE_META } from './data/task-catalog.js';
import { childStats, overallStats, doneOf, spinStatus, nextRoutine, isNight } from './routine.js';
import { formatDuration } from './util.js';

/** Icon + Label einer Aufgabe (Katalog oder eigene). */
export function taskInfo(id, state) {
  if (id.startsWith('custom_')) {
    const t = state.customTasks[id];
    return t ? { icon: t.icon, label: t.label } : { icon: '❔', label: 'Unbekannt' };
  }
  const t = TASK_CATALOG.find(x => x.id === id);
  return t ? { icon: t.icon, label: t.label } : { icon: '❔', label: id };
}

const cards = new Map();

// ---------- Fortschrittsanzeigen je Style ----------

const STAR_PATH = 'M12 1.8l3.1 6.4 7 1-5.1 4.9 1.2 7-6.2-3.3-6.2 3.3 1.2-7L1.9 9.2l7-1z';

function starsWidget(total, cls) {
  const wrap = el('div', { class: cls === 'neon-star' ? 'neon-stars' : 'magic-stars', 'aria-hidden': 'true' });
  const size = total > 8 ? Math.max(14, Math.floor(260 / total)) : 30;
  wrap.style.setProperty('--star', `${size}px`);
  const stars = [];
  for (let i = 0; i < total; i++) {
    const s = svg('svg', { class: cls, viewBox: '0 0 24 24' }, svg('path', { d: STAR_PATH }));
    stars.push(s);
    wrap.append(s);
  }
  return { wrap, stars };
}

function progressWidget(theme, total) {
  if (theme === 'pixel') {
    const segs = [];
    const bar = el('div', { class: 'xp__bar' });
    for (let i = 0; i < Math.max(1, total); i++) { const s = el('span', { class: 'xp__seg' }); segs.push(s); bar.append(s); }
    const label = el('div', { class: 'xp__label' });
    const root = el('div', { class: 'xp', role: 'progressbar', 'aria-valuemin': 0, 'aria-valuemax': total }, bar, label);
    return {
      root,
      update(done, animate) {
        segs.forEach((s, i) => {
          const on = i < done;
          if (on && !s.classList.contains('is-on') && animate) { s.classList.add('is-new'); setTimeout(() => s.classList.remove('is-new'), 800); }
          s.classList.toggle('is-on', on);
        });
        label.textContent = `${done} / ${total} XP`;
        root.setAttribute('aria-valuenow', done);
      },
    };
  }
  const isNeon = theme === 'neon';
  const { wrap, stars } = starsWidget(total, isNeon ? 'neon-star' : 'magic-star');
  const fill = el('span', { class: isNeon ? 'level__fill' : 'rainbow__fill' });
  const bar = el('div', { class: isNeon ? 'level' : 'rainbow' }, fill);
  const label = isNeon ? el('div', { class: 'level__label' }) : null;
  const root = el('div', { class: isNeon ? 'neon-progress' : 'magic-progress', role: 'progressbar', 'aria-valuemin': 0, 'aria-valuemax': total }, wrap, bar, label);
  return {
    root,
    update(done, animate) {
      stars.forEach((s, i) => {
        const on = i < done;
        if (on && !s.classList.contains('is-on') && animate) { s.classList.add('is-new'); setTimeout(() => s.classList.remove('is-new'), 600); }
        s.classList.toggle('is-on', on);
      });
      fill.style.width = `${total ? (done / total) * 100 : 0}%`;
      if (label) label.textContent = done >= total && total > 0 ? 'LEVEL COMPLETE!' : `Level ${done + 1}`;
      root.setAttribute('aria-valuenow', done);
    },
  };
}

// ---------- Hauptansicht ----------

/**
 * Baut die komplette Hauptansicht neu auf.
 * h: { onToggle(childId, taskId, btn), onToggleAll(childId, btn), onSpin(childId), onSelect(childId), onTrophy(), onEndManual() }
 */
export function renderMain(state, current, h) {
  const { routine } = current;
  const meta = ROUTINE_META[routine];
  $('#routine-title').textContent = `${meta.title} ${meta.emoji}`;
  $('#btn-end-manual').hidden = !current.manual;

  const grid = clear($('#children-grid'));
  grid.classList.toggle('single', state.children.length === 1);
  cards.clear();

  for (const child of state.children) {
    const tasks = child.tasks[routine];
    const rows = new Map();
    const list = el('ul', { class: 'task-list' });
    for (const id of tasks) {
      const info = taskInfo(id, state);
      const btn = el('button', {
        type: 'button', class: 'task', role: 'checkbox', 'aria-checked': 'false',
        onclick: () => h.onToggle(child.id, id, btn),
      },
        el('span', { class: 'task__icon', 'aria-hidden': 'true' }, info.icon),
        el('span', { class: 'task__label' }, info.label),
        el('span', { class: 'task__check', 'aria-hidden': 'true' }, starIcon()));
      rows.set(id, btn);
      list.append(el('li', {}, btn));
    }

    const progress = progressWidget(child.theme, tasks.length);
    const count = el('span', { class: 'card-count' });
    const allBtn = el('button', { type: 'button', class: 'card-all', onclick: () => h.onToggleAll(child.id, allBtn) });
    const footer = el('div', { class: 'card-footer' });
    const card = el('article', { class: 'child-card', 'data-theme': child.theme, 'data-child': child.id, 'aria-label': child.name },
      el('div', { class: 'card-head' },
        el('span', { class: 'card-avatar emoji', 'aria-hidden': 'true' }, child.avatar),
        el('h2', { class: 'card-name' }, child.name),
        count, allBtn),
      progress.root,
      tasks.length ? list : el('p', { class: 'card-done-note' }, 'Keine Aufgaben ausgewählt – im Eltern-Bereich festlegen.'),
      footer);
    grid.append(card);
    cards.set(child.id, { card, rows, progress, count, allBtn, footer, child, routine, onSpin: () => h.onSpin(child.id) });
  }

  // Tabs (mobil)
  const tabs = clear($('#child-tabs'));
  tabs.classList.toggle('has-tabs', state.children.length > 1);
  tabs.setAttribute('role', 'tablist');
  for (const child of state.children) {
    tabs.append(el('button', {
      type: 'button', class: 'child-tab', role: 'tab', 'data-theme': child.theme, 'data-child': child.id,
      onclick: () => h.onSelect(child.id),
    }, el('span', { class: 'child-tab__avatar', 'aria-hidden': 'true' }, child.avatar), el('span', { class: 'child-tab__name' }, child.name)));
  }

  for (const child of state.children) updateChild(state, child.id, false);
  setActiveChild(state.ui.activeChildId ?? state.children[0]?.id);
  updateHeader(state, routine);
}

/** Aktualisiert eine Card in-place (ohne Neuaufbau, damit Animationen erhalten bleiben). */
export function updateChild(state, childId, animate = true) {
  const c = cards.get(childId);
  if (!c) return;
  const { routine, child } = c;
  const done = new Set(doneOf(state, routine, childId));
  for (const [id, btn] of c.rows) {
    const on = done.has(id);
    const was = btn.classList.contains('is-done');
    btn.classList.toggle('is-done', on);
    btn.setAttribute('aria-checked', on ? 'true' : 'false');
    if (on && !was && animate) { btn.classList.remove('just-done'); void btn.offsetWidth; btn.classList.add('just-done'); }
  }
  const stats = childStats(state, routine, child);
  c.progress.update(stats.done, animate);
  c.count.textContent = `${stats.done}/${stats.total}`;
  c.allBtn.textContent = stats.complete ? '☒' : '☑';
  c.allBtn.setAttribute('aria-label', stats.complete ? `Alle Haken bei ${child.name} entfernen` : `Alle Aufgaben von ${child.name} abhaken`);
  c.allBtn.title = c.allBtn.getAttribute('aria-label');
  c.allBtn.hidden = stats.total === 0;

  clear(c.footer);
  const spin = spinStatus(state, routine, childId);
  if (stats.complete && spin === 'pending') {
    c.footer.append(el('button', { type: 'button', class: 'spin-btn', onclick: c.onSpin }, '🎡 Glücksrad drehen!'));
  } else if (stats.complete) {
    c.footer.append(el('p', { class: 'card-done-note' }, `Alles geschafft! 🎉`));
  }

  const tab = document.querySelector(`.child-tab[data-child="${childId}"]`);
  tab?.classList.toggle('is-complete', stats.complete);
  updateHeader(state, routine);
}

export function updateHeader(state, routine) {
  const s = overallStats(state, routine);
  const pct = s.total ? Math.round((s.done / s.total) * 100) : 0;
  $('#global-fill').style.width = `${pct}%`;
  $('#global-fill').style.backgroundPosition = `${100 - pct}% 0`;
  $('#global-count').textContent = `${s.done} / ${s.total}`;
  $('#global-progress').setAttribute('aria-valuenow', pct);
  $('#btn-trophy').hidden = !s.allComplete;
}

export function setActiveChild(childId) {
  for (const [id, c] of cards) c.card.classList.toggle('is-active', id === childId);
  for (const tab of document.querySelectorAll('.child-tab')) tab.setAttribute('aria-selected', tab.dataset.child === childId ? 'true' : 'false');
}

export function cardElement(childId) {
  return cards.get(childId)?.card ?? null;
}

// ---------- Ruhe-Screen ----------

export function renderRest(state, now = new Date()) {
  const night = isNight(state.settings, now);
  $('#rest-scene').textContent = night ? '🌙' : '☀️';
  const next = nextRoutine(state.settings, now);
  const meta = ROUTINE_META[next.routine];
  const p = clear($('#rest-next'));
  p.append('Nächste Routine startet in ', el('strong', {}, formatDuration(next.inMinutes)), ` – ${meta.emoji} ${meta.title}`);
}
