// Formular-Bausteine zum Anlegen/Bearbeiten eines Kindes (genutzt im Onboarding und im Eltern-Bereich).
import { el, clear } from './ui.js';
import { THEMES, THEME_IDS } from './data/themes.js';
import { catalogTasksFor, ROUTINES, ROUTINE_META, CUSTOM_TASK_EMOJIS, defaultTaskSelection } from './data/task-catalog.js';
import { NAME_MAX, TASK_LABEL_MAX, sanitizeName } from './store.js';
import { randomId } from './util.js';
import { taskInfo } from './render.js';

export function newChildDraft(index = 0) {
  const theme = THEME_IDS[index % THEME_IDS.length];
  return { id: randomId('c'), name: '', theme, avatar: THEMES[theme].avatars[0], tasks: defaultTaskSelection(), figures: {}, sinceLegendary: 0, sinceUpgrade: 0, xp: 0, wardrobe: [], evo: {}, acc: {}, team: [], focus: null };
}

/** Style-Kachel: Avatar, Name und live eingesetzter Kindername mit Kurzbeschreibung. Radius = Card-Radius des Styles. */
function themeTile(theme, name) {
  const t = THEMES[theme];
  const preview = el('span', { class: 'theme-tile__preview' });
  const avatar = el('span', { class: 'theme-tile__avatar emoji', 'aria-hidden': 'true' }, t.avatars[0]);
  const setName = n => { preview.textContent = `${n || 'Name'} · ${t.short}`; };
  setName(name);
  return {
    parts: [el('span', { class: 'theme-tile__mark', 'aria-hidden': 'true' }), avatar, el('span', { class: 'theme-tile__name' }, t.name), preview],
    setName,
    setAvatar: a => { avatar.textContent = a; },
  };
}

/**
 * Name, Style, Avatar.
 * ctx: { onChange(), allNames: () => string[] (andere Kinder, für Duplikat-Hinweis) }
 */
export function basicsEditor(draft, ctx = {}) {
  const root = el('div', { class: 'editor' });
  const nameId = `name-${draft.id}`;
  const err = el('div', { class: 'field__error', 'aria-live': 'polite' });
  const hint = el('div', { class: 'field__hint' });
  const input = el('input', {
    id: nameId, class: 'input', type: 'text', maxlength: NAME_MAX, autocomplete: 'off', enterkeyhint: 'done',
    placeholder: 'z. B. Alex', value: draft.name,
  });
  const previews = [];
  input.addEventListener('input', () => {
    draft.name = input.value.slice(0, NAME_MAX);
    for (const p of previews) p.setName(sanitizeName(draft.name));
    updateHints();
    ctx.onChange?.();
  });
  function updateHints() {
    const n = sanitizeName(draft.name);
    const dup = n && (ctx.allNames?.() ?? []).some(x => x.toLowerCase() === n.toLowerCase());
    hint.textContent = dup ? 'Diesen Namen gibt es schon – das ist erlaubt, kann aber verwirren.' : '';
    err.textContent = '';
  }
  root.append(el('div', { class: 'field' }, el('label', { class: 'field__label', for: nameId }, 'Name'), input, hint, err));

  // Style
  const tiles = el('div', { class: 'theme-tiles', role: 'radiogroup', 'aria-label': 'Style wählen' });
  const avatarRow = el('div', { class: 'avatar-row', role: 'radiogroup', 'aria-label': 'Avatar wählen' });
  const tileOf = new Map();
  for (const t of THEME_IDS) {
    const prev = themeTile(t, sanitizeName(draft.name));
    previews.push(prev);
    tileOf.set(t, prev);
    const tile = el('button', {
      type: 'button', class: 'theme-tile', 'data-theme': t, role: 'radio', 'aria-checked': String(draft.theme === t), 'aria-label': THEMES[t].name,
      onclick: () => {
        const changed = draft.theme !== t;
        draft.theme = t;
        if (changed && !THEMES[t].avatars.includes(draft.avatar)) draft.avatar = THEMES[t].avatars[0];
        for (const b of tiles.children) b.setAttribute('aria-checked', String(b === tile));
        renderAvatars();
        ctx.onChange?.();
      },
    }, prev.parts);
    tiles.append(tile);
  }
  root.append(el('div', { class: 'field' }, el('span', { class: 'field__label' }, 'Wähle deine Welt'), tiles));

  function renderAvatars() {
    for (const [t, tile] of tileOf) tile.setAvatar(t === draft.theme ? draft.avatar : THEMES[t].avatars[0]); // gewählte Kachel zeigt den gewählten Avatar
    clear(avatarRow);
    for (const a of THEMES[draft.theme].avatars) {
      avatarRow.append(el('button', {
        type: 'button', class: 'avatar-choice', 'data-theme': draft.theme, role: 'radio', 'aria-checked': String(draft.avatar === a), 'aria-label': `Avatar ${a}`,
        onclick: () => { draft.avatar = a; renderAvatars(); ctx.onChange?.(); },
      }, a));
    }
  }
  renderAvatars();
  root.append(el('div', { class: 'field' }, el('span', { class: 'field__label' }, 'Dein Zeichen'), avatarRow));

  updateHints();
  return {
    root,
    focus: () => input.focus(),
    /** Prüft und zeigt Fehler an. */
    validate() {
      const n = sanitizeName(draft.name);
      if (!n) { err.textContent = 'Bitte einen Namen eingeben.'; return false; }
      draft.name = n;
      return true;
    },
  };
}

/**
 * Aufgabenauswahl für beide Routinen.
 * ctx: { customTasks (Arbeitskopie, wird ggf. erweitert), siblings: () => [{id,name,tasks}], onChange() }
 */
export function tasksEditor(draft, ctx) {
  const root = el('div', { class: 'editor' });
  const errors = el('div', { class: 'field__error', 'aria-live': 'polite' });
  const pickers = ROUTINES.map(r => taskPicker(draft, r, ctx, () => { errors.textContent = ''; }));
  root.append(...pickers.map(p => p.root), errors);
  root.append(el('p', { class: 'field__hint' }, 'Tipp: Die letzte Aufgabe ⭐ sollte die Lieblingsaufgabe sein – das motiviert bis zum Schluss.'));
  return {
    root,
    refresh: () => pickers.forEach(p => p.render()),
    validate() {
      const missing = ROUTINES.filter(r => draft.tasks[r].length === 0).map(r => ROUTINE_META[r].title);
      if (missing.length) { errors.textContent = `Bitte mindestens eine Aufgabe für ${missing.join(' und ')} auswählen.`; return false; }
      return true;
    },
  };
}

function taskPicker(draft, routine, ctx, onAnyChange) {
  const meta = ROUTINE_META[routine];
  const root = el('section', { class: 'task-picker', 'aria-label': `Aufgaben ${meta.label}` });
  let formOpen = false;

  function changed(focusSel) {
    onAnyChange();
    ctx.onChange?.();
    render();
    if (focusSel) root.querySelector(focusSel)?.focus();
  }

  function render() {
    clear(root);
    const head = el('div', { class: 'task-picker__head' }, el('h4', {}, `${meta.emoji} ${meta.label}`));
    const sibs = (ctx.siblings?.() ?? []).filter(s => s.id !== draft.id && s.tasks[routine].length);
    if (sibs.length) {
      const sel = el('select', { class: 'input', style: { width: 'auto', minHeight: '40px', fontSize: '.9rem' }, 'aria-label': 'Auswahl übernehmen' },
        el('option', { value: '' }, 'Wie bei … übernehmen'),
        ...sibs.map(s => el('option', { value: s.id }, `Wie bei ${s.name || 'Kind'} übernehmen`)));
      sel.addEventListener('change', () => {
        const src = sibs.find(s => s.id === sel.value);
        if (src) { draft.tasks[routine] = [...src.tasks[routine]]; changed(); }
      });
      head.append(sel);
    }
    root.append(head);

    const list = draft.tasks[routine];
    const ul = el('ol', { class: 'selected-list' });
    list.forEach((id, i) => {
      const info = taskInfo(id, { customTasks: ctx.customTasks });
      const move = (d) => {
        const arr = draft.tasks[routine];
        [arr[i], arr[i + d]] = [arr[i + d], arr[i]];
        changed(`[data-task="${id}"] [data-dir="${d}"]:not(:disabled), [data-task="${id}"] .icon-btn`);
      };
      ul.append(el('li', { class: 'selected-item', 'data-task': id },
        el('span', { class: 'selected-item__pos' }, `${i + 1}.`),
        el('span', { class: 'selected-item__icon', 'aria-hidden': 'true' }, info.icon),
        el('span', { class: 'selected-item__label' }, info.label),
        el('button', { type: 'button', class: 'icon-btn', 'data-dir': '-1', disabled: i === 0, 'aria-label': `${info.label} nach oben`, onclick: () => move(-1) }, '⬆️'),
        el('button', { type: 'button', class: 'icon-btn', 'data-dir': '1', disabled: i === list.length - 1, 'aria-label': `${info.label} nach unten`, onclick: () => move(1) }, '⬇️'),
        el('button', { type: 'button', class: 'icon-btn', 'aria-label': `${info.label} entfernen`, onclick: () => { draft.tasks[routine] = list.filter(x => x !== id); changed(); } }, '✖️')));
    });
    if (!list.length) ul.append(el('li', { class: 'muted' }, 'Noch keine Aufgabe ausgewählt.'));
    root.append(ul);

    const available = [
      ...catalogTasksFor(routine).map(t => t.id),
      ...Object.entries(ctx.customTasks).filter(([, t]) => t.routine === routine).map(([id]) => id),
    ].filter(id => !list.includes(id));
    const chips = el('div', { class: 'chip-list', 'aria-label': 'Weitere Aufgaben' });
    for (const id of available) {
      const info = taskInfo(id, { customTasks: ctx.customTasks });
      chips.append(el('button', {
        type: 'button', class: 'chip', 'aria-label': `${info.label} hinzufügen`,
        onclick: () => { draft.tasks[routine] = [...draft.tasks[routine], id]; changed(); },
      }, el('span', { class: 'emoji', 'aria-hidden': 'true' }, info.icon), `＋ ${info.label}`));
    }
    chips.append(el('button', { type: 'button', class: 'chip chip--add', onclick: () => { formOpen = true; render(); root.querySelector('.custom-form input[type=text]')?.focus(); } }, '＋ Eigene Aufgabe'));
    root.append(chips);

    if (formOpen) root.append(customTaskForm(routine, ctx.customTasks, {
      onSave(id, task) {
        formOpen = false;
        if (task.routine === routine) draft.tasks[routine] = [...draft.tasks[routine], id];
        else draft.tasks[task.routine] = [...draft.tasks[task.routine], id];
        ctx.onCustomAdded?.();
        changed();
      },
      onCancel() { formOpen = false; render(); },
    }));
  }
  render();
  return { root, render };
}

/** Formular für eine eigene Aufgabe (anlegen oder bearbeiten). */
export function customTaskForm(routine, customTasks, { onSave, onCancel, existingId = null }) {
  const existing = existingId ? customTasks[existingId] : null;
  let icon = existing?.icon ?? CUSTOM_TASK_EMOJIS[0];
  let r = existing?.routine ?? routine;
  const err = el('div', { class: 'field__error', 'aria-live': 'polite' });
  const uid = randomId('f');
  const label = el('input', { id: uid, class: 'input', type: 'text', maxlength: TASK_LABEL_MAX, placeholder: 'z. B. Hund füttern', value: existing?.label ?? '', autocomplete: 'off' });
  const free = el('input', { class: 'input input--emoji', type: 'text', maxlength: 8, 'aria-label': 'Eigenes Emoji', placeholder: '🙂' });
  const grid = el('div', { class: 'emoji-grid', role: 'radiogroup', 'aria-label': 'Emoji wählen' });
  const renderGrid = () => {
    clear(grid);
    for (const e of CUSTOM_TASK_EMOJIS) {
      grid.append(el('button', { type: 'button', role: 'radio', 'aria-checked': String(e === icon), 'aria-label': e, onclick: () => { icon = e; free.value = ''; renderGrid(); } }, e));
    }
  };
  renderGrid();
  free.addEventListener('input', () => { if (free.value.trim()) { icon = free.value.trim(); renderGrid(); } });
  const seg = el('div', { class: 'segmented', role: 'group', 'aria-label': 'Routine' });
  const renderSeg = () => {
    clear(seg);
    for (const x of ROUTINES) seg.append(el('button', { type: 'button', 'aria-pressed': String(x === r), onclick: () => { r = x; renderSeg(); } }, `${ROUTINE_META[x].emoji} ${ROUTINE_META[x].label}`));
  };
  renderSeg();

  return el('div', { class: 'custom-form' },
    el('div', { class: 'field' }, el('label', { class: 'field__label', for: uid }, 'Bezeichnung'), label),
    el('div', { class: 'field' }, el('span', { class: 'field__label' }, 'Emoji'), grid, el('div', { style: { display: 'flex', gap: '10px', alignItems: 'center' } }, el('span', { class: 'field__hint' }, 'oder eigenes:'), free)),
    existingId ? null : el('div', { class: 'field' }, el('span', { class: 'field__label' }, 'Routine'), seg),
    err,
    el('div', { class: 'btn-row btn-row--end' },
      el('button', { type: 'button', class: 'btn btn--ghost', onclick: onCancel }, 'Abbrechen'),
      el('button', {
        type: 'button', class: 'btn btn--primary', onclick: () => {
          const text = label.value.trim().replace(/\s+/g, ' ').slice(0, TASK_LABEL_MAX);
          if (!text) { err.textContent = 'Bitte eine Bezeichnung eingeben.'; label.focus(); return; }
          const id = existingId ?? randomId('custom');
          customTasks[id] = { icon: [...icon].slice(0, 4).join('') || '⭐', label: text, routine: existing?.routine ?? r };
          onSave(id, customTasks[id]);
        },
      }, existingId ? 'Speichern' : 'Hinzufügen')));
}
