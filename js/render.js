// Rendering der Hauptansicht: Kinder-Cards, Task-Listen, Fortschrittsanzeigen, Tabs, Header, Ruhe-Screen.
import { el, svg, clear, $, starIcon, isSingleCard } from './ui.js';
import { TASK_CATALOG, ROUTINE_META } from './data/task-catalog.js';
import { childStats, overallStats, doneOf, spinStatus, nextRoutine, isNight, goalOf } from './routine.js';
import { formatDuration } from './util.js';
import { THEMES } from './data/themes.js';
import { figureById } from './data/figures.js';
import { levelInfo, levelTitle, focusOf, nextStep, EVO_STEPS, BLITZ_XP } from './data/progression.js';
import { figureView } from './figure-view.js';
import { mountHerd } from './herd.js';
import { wheelComing } from './celebrate.js';

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
const MAX_ROW = 76;    // ab hier wachsen Icon und Text nicht weiter, die Zeile selbst füllt trotzdem die Höhe
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
  const rowH = (cols, h = H) => { const rows = Math.ceil(n / cols); return (h - gap * (rows - 1)) / rows; };
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
  list.style.setProperty('--rh', `${Math.min(MAX_ROW, rh).toFixed(1)}px`); // Skalierung von Icon/Text, nicht die Zeilenhöhe
  list.style.setProperty('--cw', `${((W - colGap * (best - 1)) / best).toFixed(1)}px`);
  list.classList.toggle('is-tight', rh <= 40);
}

const listObserver = typeof ResizeObserver === 'function'
  ? new ResizeObserver(entries => { for (const e of entries) fitList(e.target); })
  : null;

// ---------- Abhaken & Zurücknehmen ----------

const HOLD_MS = 650;

/**
 * Antippen hakt ab. Eine erledigte Aufgabe lässt sich nur durch langes Drücken zurücknehmen
 * (der Stern schrumpft dabei), damit doppelte Tipps nichts kaputt machen. Tastatur und Screenreader
 * (click ohne Zeiger, detail 0) schalten direkt um.
 */
function bindTask(btn, toggle, hint) {
  let timer = null, held = false, sx = 0, sy = 0;
  const cancel = () => { clearTimeout(timer); timer = null; btn.classList.remove('is-holding'); };
  btn.addEventListener('pointerdown', e => {
    held = false;
    if (!btn.classList.contains('is-done') || e.button > 0) return;
    sx = e.clientX; sy = e.clientY;
    btn.classList.add('is-holding');
    timer = setTimeout(() => { timer = null; held = true; btn.classList.remove('is-holding'); toggle(); }, HOLD_MS);
  });
  btn.addEventListener('pointermove', e => { if (timer && Math.hypot(e.clientX - sx, e.clientY - sy) > 12) cancel(); });
  for (const t of ['pointerup', 'pointercancel', 'pointerleave']) btn.addEventListener(t, cancel);
  btn.addEventListener('contextmenu', e => e.preventDefault()); // Android: langes Drücken öffnet sonst ein Menü
  btn.addEventListener('click', e => {
    if (held) { held = false; return; }
    if (!btn.classList.contains('is-done') || e.detail === 0) toggle();
    else hint();
  });
}

// ---------- Fortschrittsanzeigen je Style ----------
// Eine Zeile pro Card: Segmente (Pixel), Sterne (Neon), Pille (Zauber) oder Weg (Dino, Sternenreise, Schatzinsel).

const STAR_POINTS = '12,2 15,9 22,9.5 16.5,14 18.5,21 12,17 5.5,21 7.5,14 2,9.5 9,9';

/** Baut die Anzeige aus Einzelteilen (Segmente, Sterne, Stationen) mit Beschriftung rechts. */
function stepsWidget(cls, total, makePart, labelOf) {
  const parts = [];
  const row = el('div', { class: `${cls}__row` });
  for (let i = 0; i < Math.max(1, total); i++) { const p = makePart(); parts.push(p); row.append(p); }
  const label = el('span', { class: 'progress__label' });
  const root = el('div', { class: `progress ${cls}`, role: 'progressbar', 'aria-valuemin': 0, 'aria-valuemax': total }, row, label);
  return {
    root,
    update(done, animate) {
      parts.forEach((p, i) => {
        const on = i < done;
        if (on && !p.classList.contains('is-on') && animate) { p.classList.add('is-new'); setTimeout(() => p.classList.remove('is-new'), 700); }
        p.classList.toggle('is-on', on);
      });
      label.textContent = labelOf(done, total);
      root.setAttribute('aria-valuenow', done);
    },
  };
}

/** Weg mit Stationen und wanderndem Marker (Dino-Spuren, Planeten, Schatzkarte). */
function trackWidget(theme, total) {
  const cfg = THEMES[theme].track;
  const nodes = [];
  const path = el('div', { class: 'track__path' });
  for (let i = 0; i < Math.max(1, total); i++) { const n = el('span', { class: 'track__node' }); nodes.push(n); path.append(n); }
  const goal = el('span', { class: 'track__goal emoji' }, cfg.goal);
  const marker = el('span', { class: 'track__marker emoji' }, cfg.marker);
  const label = el('span', { class: 'progress__label' });
  const root = el('div', { class: 'progress track', 'data-kind': theme, role: 'progressbar', 'aria-valuemin': 0, 'aria-valuemax': total },
    el('div', { class: 'track__lane' }, path, goal, marker), label);
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
  const kind = THEMES[theme].progress;
  if (kind === 'track') return trackWidget(theme, total);
  if (kind === 'xp') return stepsWidget('xp', total, () => el('span', { class: 'xp__seg' }), (d, t) => `${d} / ${t} XP`);
  if (kind === 'neon') {
    return stepsWidget('stars', total,
      () => svg('svg', { class: 'star', viewBox: '0 0 24 24', 'aria-hidden': 'true' }, svg('polygon', { points: STAR_POINTS })),
      (d, t) => (d >= t && t > 0 ? 'Level geschafft!' : `Level ${d + 1}`));
  }
  // Einhorn-Zauber: Pille mit Verlauf von App-Akzent zu Style-Akzent
  const fill = el('span', { class: 'pill__fill' });
  const label = el('span', { class: 'progress__label' });
  const root = el('div', { class: 'progress pill', role: 'progressbar', 'aria-valuemin': 0, 'aria-valuemax': total },
    el('div', { class: 'pill__bar' }, fill), label);
  return {
    root,
    update(done) {
      fill.style.width = `${total ? (done / total) * 100 : 0}%`;
      label.textContent = `✨ ${done}/${total}`;
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
      const btn = el('button', { type: 'button', class: 'task', role: 'checkbox', 'aria-checked': 'false' },
        el('span', { class: 'task__icon', 'aria-hidden': 'true' }, info.icon),
        el('span', { class: 'task__label' }, info.label),
        el('span', { class: 'task__check', 'aria-hidden': 'true' }, starIcon()));
      bindTask(btn, () => h.onToggle(child.id, id, btn), () => h.onHoldHint?.(child.id, btn));
      rows.set(id, btn);
      list.append(el('li', {}, btn));
    }

    const progress = progressWidget(child.theme, tasks.length);
    const count = el('span', { class: 'card-count' });
    const allBtn = el('button', { type: 'button', class: 'card-all', onclick: () => h.onToggleAll(child.id, allBtn) });
    const footer = el('div', { class: 'card-footer' });
    const level = levelLine();
    const album = el('button', { type: 'button', class: 'card-album', 'aria-label': `Album von ${child.name} öffnen`, title: 'Album', onclick: () => h.onAlbum(child.id) },
      el('span', { class: 'emoji', 'aria-hidden': 'true' }, '📖'), el('span', { class: 'card-album__text' }, 'Album'));
    const meadow = el('div', { class: 'card-meadow' });
    const hint = el('div', { class: 'card-hint', role: 'status', hidden: true });
    const card = el('article', { class: 'child-card', 'data-theme': child.theme, 'data-child': child.id, 'aria-label': child.name },
      el('div', { class: 'card-head' },
        el('span', { class: 'card-avatar emoji', 'aria-hidden': 'true' }, child.avatar),
        el('div', { class: 'card-who' }, el('h2', { class: 'card-name' }, child.name), level.root),
        album, count, allBtn),
      progress.root,
      tasks.length ? list : el('p', { class: 'card-done-note' }, 'Keine Aufgaben ausgewählt – im Eltern-Bereich festlegen.'),
      footer,
      meadow,
      hint);
    grid.append(card);
    const herd = mountHerd(meadow, child, { onOpen: () => h.onAlbum(child.id) });
    cards.set(child.id, { card, rows, progress, count, allBtn, footer, hint, child, routine, level, herd, herdKey: herdKey(child), onSpin: () => h.onSpin(child.id) });
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
  if (stats.complete && spin === 'pending' && !wheelComing(childId)) {
    c.footer.append(el('button', { type: 'button', class: 'spin-btn', onclick: c.onSpin }, '🎡 Glücksrad drehen!'));
  } else if (stats.complete) {
    c.footer.append(el('p', { class: 'card-done-note' }, `Alles geschafft! 🎉`));
  }

  const tab = document.querySelector(`.child-tab[data-child="${childId}"]`);
  tab?.classList.toggle('is-complete', stats.complete);
  c.level.update(child);
  const key = herdKey(child);
  if (key !== c.herdKey) { c.herdKey = key; c.herd.refresh(); }
  c.complete = stats.complete;
  c.herd.setTired(timeLow && !stats.complete);
  updateHeader(state, routine);
}

// ---------- Zeitleiste ----------

let timeLow = false;

/**
 * Zeitleiste im Kopf: Sonne/Mond sitzt auf der aktuellen Position, die Lunte (Restzeit) wird kürzer,
 * ⚡ markiert die Blitz-Zeit. info aus timeInfo(), range = settings.routines[routine].
 */
export function updateTime(info, routine, range = null) {
  const wrap = $('#time-left');
  wrap.hidden = !info;
  timeLow = !!info?.low;
  for (const c of cards.values()) c.herd.setTired(timeLow && !c.complete);
  if (!info) return;
  wrap.classList.toggle('is-low', info.low);
  wrap.classList.toggle('is-blitz', info.blitz);
  wrap.style.setProperty('--p', info.p.toFixed(4));
  wrap.style.setProperty('--goal', info.goalP.toFixed(4));
  $('#time-sun').textContent = ROUTINE_META[routine].emoji;
  const left = info.left >= 60 ? `${Math.floor(info.left / 60)} h ${info.left % 60} min` : `${info.left} min`;
  $('#time-start').textContent = range?.start ?? '';
  $('#time-end').textContent = range?.end ?? '';
  $('#time-text').textContent = info.blitz && range ? `⚡ vor ${goalOf(range)} fertig = +${BLITZ_XP} XP` : `noch ${left}`;
  wrap.title = info.blitz ? 'Vor dem ⚡ fertig = Blitz-Bonus!' : `Restzeit der Routine: ${left}`;
}

// ---------- Spieler-Level & Buddy ----------

/** Kleine Level-Zeile unter dem Namen: „Lv 12 · Baumeister · Pixel-Abenteuer“. */
function levelLine() {
  const root = el('div', { class: 'card-level' });
  return {
    root,
    update(child) {
      const info = levelInfo(child.xp);
      const theme = THEMES[child.theme];
      root.textContent = `Lv ${info.level} · ${levelTitle(theme.levelTitles, info.level)} · ${theme.name}`;
      root.title = info.need ? `${info.into} / ${info.need} XP bis Level ${info.level + 1}` : 'Höchstes Level!';
    },
  };
}

/** Kurzer Hinweis unten in der Card (z. B. „Lange drücken zum Zurücknehmen“ oder Lob ohne Team). */
export function cardHint(childId, text, ms = 1600) {
  const c = cards.get(childId);
  if (!c) return;
  c.hint.textContent = text;
  c.hint.hidden = false;
  clearTimeout(c.hintTimer);
  c.hintTimer = setTimeout(() => { c.hint.hidden = true; }, ms);
}

/** Hat das Kind ein Team auf der Wiese? (Sonst erscheint Lob als Hinweis in der Card.) */
export const hasTeam = childId => (cards.get(childId)?.child.team?.length ?? 0) > 0;

/** Alles, was das Aussehen des Teams bestimmt. Ändert es sich, wird das Team neu aufgebaut. */
function herdKey(child) {
  const team = child.team ?? [];
  return JSON.stringify([team, team.map(id => [child.evo?.[id] ?? 0, child.acc?.[id] ?? null]), child.focus, child.evo?.[child.focus] ?? 0]);
}

/** Team reagiert: 'cheer' (Aufgabe abgehakt, clientX = Position der Aufgabe), 'party' (Routine fertig) oder 'oops'. text: Sprechblase. */
export function buddyReact(childId, kind = 'cheer', clientX = null, text = null) {
  cards.get(childId)?.herd.react(kind, clientX, text);
}

export function updateHeader(state, routine) {
  const s = overallStats(state, routine);
  const pct = s.total ? Math.round((s.done / s.total) * 100) : 0;
  $('#global-fill').style.width = `${pct}%`;
  $('#global-count').textContent = `${s.done} / ${s.total}`;
  $('#global-progress').setAttribute('aria-valuenow', pct);
  // Pokal bleibt sichtbar (gedimmt) und leuchtet erst, wenn alle fertig sind
  const trophy = $('#btn-trophy');
  trophy.disabled = !s.allComplete;
  trophy.classList.toggle('is-ready', s.allComplete);
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
  $('#rest-lead').textContent = night ? 'Schlaf gut! Nächste Routine in' : 'Nächste Routine in';
  $('#rest-countdown').textContent = formatDuration(next.inMinutes);
  $('#rest-tag').textContent = `${meta.emoji} ${meta.title} um ${state.settings.routines[next.routine].start}`;

  // Teams: tagsüber entspannt, nachts schlafend. Nur neu bauen, wenn sich etwas geändert hat (Animationen laufen weiter).
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
      el('span', { class: 'rest-buddy__stage' },
        team.length
          ? team.map((fig, i) => figureView(fig, child, { className: `buddy${i ? ' is-side' : ''}`, alt: '' }))
          : el('span', { class: 'rest-buddy__avatar emoji', 'aria-hidden': 'true' }, child.avatar),
        night ? el('span', { class: 'rest-buddy__zzz', 'aria-hidden': 'true' }, 'zzZ') : null),
      el('span', { class: 'rest-buddy__info' },
        el('span', { class: 'rest-buddy__name' }, child.name),
        el('span', { class: 'rest-buddy__level' }, step ? `Bald: ${step.icon} ${step.label} für ${focus.name}` : `Lv ${info.level} · ${levelTitle(THEMES[child.theme].levelTitles, info.level)}`))));
  }
}

/** Erzwingt beim nächsten renderRest einen Neuaufbau (z. B. nach Änderungen im Album). */
export function invalidateRest() { restKey = ''; }
