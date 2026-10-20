// Rendering der Hauptansicht: Kinder-Cards, Task-Listen, Fortschrittsanzeigen, Tabs, Header, Ruhe-Screen.
import { el, svg, clear, $, starIcon, isSingleCard } from './ui.js';
import { TASK_CATALOG, ROUTINE_META } from './data/task-catalog.js';
import { childStats, overallStats, doneOf, spinStatus, nextRoutine, isNight } from './routine.js';
import { formatDuration } from './util.js';
import { THEMES } from './data/themes.js';
import { figureById } from './data/figures.js';
import { levelInfo, levelTitle, focusOf, nextStep, EVO_STEPS } from './data/progression.js';
import { figureView } from './figure-view.js';
import { mountHerd } from './herd.js';

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
const TILE_POP = [{ transform: 'scale(1)' }, { transform: 'scale(1.04)', offset: 0.4 }, { transform: 'scale(1)' }];

// ---------- Aufgabenliste an die verfügbare Höhe anpassen ----------

const MIN_ROW = 48;   // darunter lieber eine weitere Spalte
const MAX_ROW = 76;
const MIN_COL = 130;  // Mindestbreite einer Aufgaben-Spalte
const CRAMPED_ROW = 34; // darunter muss die Wiese weichen

/**
 * Wählt 1–3 Spalten, sodass Zeilen möglichst ≥ MIN_ROW hoch sind und nichts scrollt.
 * Die Zeilenhöhe (--rh) und Spaltenbreite (--cw) landen als Pixel-Variablen an der Liste; daraus skalieren
 * Icon, Text und Haken. Das ersetzt Container-Query-Einheiten und funktioniert so auch in älteren Browsern.
 * Wird es extrem eng, weicht zuerst die Wiese mit dem Team (Klasse is-cramped an der Card).
 */
function fitList(list) {
  const n = Number(list.dataset.n) || 0;
  const H = list.clientHeight, W = list.clientWidth;
  if (!n || !H || !W) return;
  const cs = getComputedStyle(list);
  const gap = parseFloat(cs.rowGap) || 0;
  const rowH = (cols, h = H) => { const rows = Math.ceil(n / cols); return Math.min(MAX_ROW, (h - gap * (rows - 1)) / rows); };
  let best = 1;
  for (let c = 1; c <= 3; c++) {
    if (c > 1 && (W - gap * (c - 1)) / c < MIN_COL) break;
    best = c;
    if (rowH(c) >= MIN_ROW) break;
  }
  const card = list.closest('.child-card');
  if (card) {
    const cramped = card.classList.contains('is-cramped');
    const meadowH = cramped ? 0 : card.querySelector('.card-meadow')?.offsetHeight ?? 0;
    if (!cramped && meadowH > 0 && rowH(best) < CRAMPED_ROW) {
      card.dataset.freed = String(meadowH + (parseFloat(getComputedStyle(card).rowGap) || 0));
      card.classList.add('is-cramped');
      return; // der ResizeObserver meldet gleich die neue, größere Höhe
    }
    // Wiese erst zurückholen, wenn die Zeilen danach immer noch deutlich größer wären (keine Schaukel-Effekte)
    if (cramped && rowH(best, H - Number(card.dataset.freed || 0)) >= CRAMPED_ROW + 8) {
      card.classList.remove('is-cramped');
      return;
    }
  }
  const multi = best > 1;
  list.classList.toggle('is-multi', multi);
  const colGap = multi ? parseFloat(getComputedStyle(list).columnGap) || 0 : 0;
  const rh = Math.max(0, rowH(best));
  list.style.setProperty('--tcols', best);
  list.style.setProperty('--n', Math.ceil(n / best));
  list.style.setProperty('--rh', `${rh.toFixed(1)}px`);
  list.style.setProperty('--cw', `${((W - colGap * (best - 1)) / best).toFixed(1)}px`);
  list.classList.toggle('is-tight', rh <= 40);
}

const listObserver = typeof ResizeObserver === 'function'
  ? new ResizeObserver(entries => { for (const e of entries) fitList(e.target); })
  : null;

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

const FOOT_PATH = 'M12 22c-3.3 0-5.5-2.2-5.5-5 0-2.6 2.4-4.5 5.5-4.5s5.5 1.9 5.5 4.5c0 2.8-2.2 5-5.5 5zM5 11.5C3.6 11.5 2.5 10 2.5 8S3.6 4.5 5 4.5 7.5 6 7.5 8 6.4 11.5 5 11.5zM12 9C10.6 9 9.5 7.3 9.5 5S10.6 1 12 1s2.5 1.7 2.5 4S13.4 9 12 9zM19 11.5c-1.4 0-2.5-1.5-2.5-3.5s1.1-3.5 2.5-3.5S21.5 6 21.5 8 20.4 11.5 19 11.5z';

/** Weg mit Stationen und wanderndem Marker (Dino-Spuren, Planeten, Schatzkarte). */
function trackWidget(theme, total) {
  const cfg = THEMES[theme].track;
  const nodes = [];
  const path = el('div', { class: 'track__path' });
  for (let i = 0; i < Math.max(1, total); i++) {
    const n = theme === 'dino'
      ? svg('svg', { class: 'track__node', viewBox: '0 0 24 24', style: `--i:${i}` }, svg('path', { d: FOOT_PATH }))
      : el('span', { class: 'track__node', style: { '--i': i } });
    nodes.push(n);
    path.append(n);
  }
  const goal = el('span', { class: 'track__goal emoji' }, cfg.goal);
  const marker = el('span', { class: 'track__marker emoji' }, cfg.marker);
  const label = el('div', { class: 'track__label' });
  const lane = el('div', { class: 'track__lane' }, path, goal, marker);
  const root = el('div', { class: 'track', 'data-kind': theme, role: 'progressbar', 'aria-valuemin': 0, 'aria-valuemax': total }, lane, label);
  return {
    root,
    update(done, animate) {
      nodes.forEach((n, i) => {
        const on = i < done;
        if (on && !n.classList.contains('is-on') && animate) { n.classList.add('is-new'); setTimeout(() => n.classList.remove('is-new'), 700); }
        n.classList.toggle('is-on', on);
      });
      const complete = total > 0 && done >= total;
      root.classList.toggle('is-complete', complete);
      goal.textContent = complete && cfg.doneGoal ? cfg.doneGoal : cfg.goal;
      marker.style.setProperty('--p', total ? done / total : 0);
      label.textContent = complete ? cfg.done : cfg.label(done, total);
      root.setAttribute('aria-valuenow', done);
    },
  };
}

function progressWidget(theme, total) {
  if (THEMES[theme].progress === 'track') return trackWidget(theme, total);
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
 * h: { onToggle(childId, taskId, btn), onToggleAll(childId, btn), onSpin(childId), onSelect(childId), onAlbum(childId) }
 */
export function renderMain(state, current, h) {
  const { routine } = current;
  const meta = ROUTINE_META[routine];
  $('#routine-title').textContent = `${meta.title} ${meta.emoji}`;
  $('#btn-end-manual').hidden = !current.manual;

  listObserver?.disconnect();
  for (const c of cards.values()) c.herd.destroy();
  const grid = clear($('#children-grid'));
  grid.classList.toggle('single', state.children.length === 1);
  cards.clear();

  for (const child of state.children) {
    const tasks = child.tasks[routine];
    const rows = new Map();
    const list = el('ul', { class: 'task-list', 'data-n': tasks.length, style: { '--n': Math.max(1, tasks.length) } });
    listObserver?.observe(list);
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
    const level = levelLine();
    const album = el('button', { type: 'button', class: 'card-album', 'aria-label': `Album von ${child.name} öffnen`, title: 'Album', onclick: () => h.onAlbum(child.id) },
      el('span', { class: 'emoji', 'aria-hidden': 'true' }, '📖'));
    const meadow = el('div', { class: 'card-meadow' });
    const card = el('article', { class: 'child-card', 'data-theme': child.theme, 'data-child': child.id, 'aria-label': child.name },
      el('div', { class: 'card-head' },
        el('span', { class: 'card-avatar emoji', 'aria-hidden': 'true' }, child.avatar),
        el('div', { class: 'card-who' }, el('h2', { class: 'card-name' }, child.name), level.root),
        album, count, allBtn),
      progress.root,
      tasks.length ? list : el('p', { class: 'card-done-note' }, 'Keine Aufgaben ausgewählt – im Eltern-Bereich festlegen.'),
      meadow,
      footer);
    grid.append(card);
    const herd = mountHerd(meadow, child, { onOpen: () => h.onAlbum(child.id) });
    cards.set(child.id, { card, rows, progress, count, allBtn, footer, child, routine, level, herd, herdKey: herdKey(child), onSpin: () => h.onSpin(child.id) });
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
  layoutGrid();
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
    if (on && !was && animate) btn.animate?.(TILE_POP, { duration: 450, easing: 'cubic-bezier(.3,1.5,.5,1)' });
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
  c.level.update(child);
  const key = herdKey(child);
  if (key !== c.herdKey) { c.herdKey = key; c.herd.refresh(); }
  updateHeader(state, routine);
}

// ---------- Spieler-Level & Buddy ----------

/** Kleine Level-Zeile unter dem Namen: „Lv 12 · Baumeister“ mit dünner XP-Leiste. */
function levelLine() {
  const text = el('span', { class: 'card-level__text' });
  const fill = el('span', { class: 'card-level__fill' });
  const root = el('div', { class: 'card-level' }, text, el('span', { class: 'card-level__bar', 'aria-hidden': 'true' }, fill));
  return {
    root,
    update(child) {
      const info = levelInfo(child.xp);
      text.textContent = `Lv ${info.level} · ${levelTitle(THEMES[child.theme].levelTitles, info.level)}`;
      fill.style.width = `${info.need ? (info.into / info.need) * 100 : 100}%`;
      root.title = info.need ? `${info.into} / ${info.need} XP bis Level ${info.level + 1}` : 'Höchstes Level!';
    },
  };
}

/** Alles, was das Aussehen des Teams bestimmt. Ändert es sich, wird das Team neu aufgebaut. */
function herdKey(child) {
  const team = child.team ?? [];
  return JSON.stringify([team, team.map(id => [child.evo?.[id] ?? 0, child.acc?.[id] ?? null]), child.focus, child.evo?.[child.focus] ?? 0]);
}

/** Team reagiert: 'cheer' (Aufgabe abgehakt, clientX = Position der Aufgabe) oder 'party' (Routine fertig). */
export function buddyReact(childId, kind = 'cheer', clientX = null) {
  cards.get(childId)?.herd.react(kind, clientX);
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

/** Verteilt die Cards so, dass alles ohne Scrollen ins Fenster passt (Spalten × Zeilen). */
export function layoutGrid() {
  const grid = $('#children-grid');
  const n = Math.max(1, cards.size);
  const width = grid.clientWidth || innerWidth;
  const cols = isSingleCard() ? 1 : Math.max(1, Math.min(n, Math.floor(width / 240)));
  grid.style.setProperty('--cols', cols);
  grid.style.setProperty('--rows', Math.ceil(n / cols));
  if (!listObserver) grid.querySelectorAll('.task-list').forEach(fitList);
}

export function setActiveChild(childId) {
  for (const [id, c] of cards) c.card.classList.toggle('is-active', id === childId);
  for (const tab of document.querySelectorAll('.child-tab')) tab.setAttribute('aria-selected', tab.dataset.child === childId ? 'true' : 'false');
}

export function cardElement(childId) {
  return cards.get(childId)?.card ?? null;
}

// ---------- Ruhe-Screen ----------

let restKey = '';

/** Ruhe-Screen. onAlbum(childId) öffnet das Album eines Kindes. */
export function renderRest(state, now = new Date(), onAlbum = () => {}) {
  const night = isNight(state.settings, now);
  $('#rest-scene').textContent = night ? '🌙' : '☀️';
  const next = nextRoutine(state.settings, now);
  const meta = ROUTINE_META[next.routine];
  const p = clear($('#rest-next'));
  p.append('Nächste Routine startet in ', el('strong', {}, formatDuration(next.inMinutes)), ` – ${meta.emoji} ${meta.title}`);

  // Buddys: tagsüber entspannt, nachts schlafend. Nur neu bauen, wenn sich etwas geändert hat (Animationen laufen weiter).
  const key = JSON.stringify([night, state.children.map(c => [c.id, c.name, c.theme, c.avatar, c.xp, herdKey(c)])]);
  if (key === restKey) return;
  restKey = key;
  const wrap = clear($('#rest-buddies'));
  wrap.classList.toggle('is-night', night);
  for (const child of state.children) {
    const team = (child.team ?? []).map(figureById).filter(Boolean);
    const info = levelInfo(child.xp);
    const focus = focusOf(child);
    const step = focus ? EVO_STEPS[nextStep(child, focus)] : null;
    wrap.append(el('button', {
      type: 'button', class: 'rest-buddy', 'data-theme': child.theme, onclick: () => onAlbum(child.id),
      'aria-label': `Album von ${child.name} öffnen`,
    },
      el('span', { class: `rest-buddy__stage${team.length > 1 ? ' is-team' : ''}` },
        team.length
          ? team.map((fig, i) => figureView(fig, child, { className: `buddy${i ? ' is-side' : ''}`, alt: '' }))
          : el('span', { class: 'rest-buddy__avatar emoji', 'aria-hidden': 'true' }, child.avatar),
        night ? el('span', { class: 'rest-buddy__zzz', 'aria-hidden': 'true' }, 'z', el('span', {}, 'z'), el('span', {}, 'Z')) : null),
      el('span', { class: 'rest-buddy__name' }, child.name),
      el('span', { class: 'rest-buddy__level' }, step ? `Bald: ${step.icon} ${step.label} für ${focus.name}` : `Lv ${info.level} · ${levelTitle(THEMES[child.theme].levelTitles, info.level)}`)));
  }
}

/** Erzwingt beim nächsten renderRest einen Neuaufbau (z. B. nach Änderungen im Album). */
export function invalidateRest() { restKey = ''; }
