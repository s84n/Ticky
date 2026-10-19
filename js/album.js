// Sammelalbum: alle Figuren eines Kindes, Team (3 Figuren auf dem Aufgaben-Bildschirm) zusammenstellen,
// Upgrade-Reise verfolgen und Accessoires anziehen.
import { el, clear, openOverlay } from './ui.js';
import { state, save } from './store.js';
import { THEMES } from './data/themes.js';
import { RARITIES, figureById } from './data/figures.js';
import { wheelOrder } from './rewards/draw.js';
import {
  levelInfo, levelTitle, ACCESSORIES, EVO_STEPS, TEAM_MAX, UPGRADE_PITY, pathOf, stageOf, nextStep, journeyOpen, focusOf,
  accessoryOf, equipAccessory, toggleTeam, makeLeader, setFocus,
} from './data/progression.js';
import { figureView } from './figure-view.js';
import { popSound, wrongSound } from './audio.js';

/** Punktreihe der Upgrade-Reise. labels: Beschriftung unter den Punkten. */
function evoDots(child, fig, { labels = false } = {}) {
  const stage = stageOf(child, fig.id);
  return el('span', { class: `evo-dots${labels ? ' evo-dots--labels' : ''}` }, ...pathOf(fig).map((st, i) => {
    const s = EVO_STEPS[st];
    const cls = i < stage ? ' is-on' : i === stage ? ' is-next' : '';
    const dot = el('span', { class: `evo-dot${cls}`, title: s.label, 'aria-label': `${s.label}${i < stage ? ' (geschafft)' : ''}` }, s.icon);
    return labels ? el('span', { class: 'evo-step' }, dot, el('span', { class: 'evo-step__label' }, s.label)) : dot;
  }));
}

/** Öffnet das Album. onChange() wird nach jeder Änderung (Team, Reise, Accessoire) aufgerufen. */
export function openAlbum(childId, { onChange } = {}) {
  const child = state.children.find(c => c.id === childId);
  if (!child) return;
  const theme = THEMES[child.theme];
  // Figuren des Styles plus gewonnene aus anderen Styles (falls der Style mal gewechselt wurde)
  const own = wheelOrder(child.theme);
  const all = [...own, ...Object.keys(child.figures).map(figureById).filter(f => f && !own.includes(f))];

  const body = el('div', { class: 'album__body' });
  const sheetWrap = el('div', { class: 'world__sheet-wrap', hidden: true, onclick: e => { if (e.target === sheetWrap) closeSheet(); } });
  let sheetFig = null;

  function render() {
    clear(body);
    const info = levelInfo(child.xp);
    const have = all.filter(f => child.figures[f.id]).length;
    body.append(el('div', { class: 'album__stats' },
      el('span', { class: 'album__chip' }, `Lv ${info.level} · ${levelTitle(theme.levelTitles, info.level)}`),
      el('span', { class: 'album__chip' }, `${have} / ${own.length} entdeckt`)));

    // Team
    const team = (child.team ?? []).map(figureById).filter(Boolean);
    const slots = el('div', { class: 'album-team' });
    for (let i = 0; i < TEAM_MAX; i++) {
      const fig = team[i];
      slots.append(fig
        ? el('button', { type: 'button', class: 'album-team__slot', 'data-rarity': fig.rarity, onclick: () => openSheet(fig), 'aria-label': `${fig.name}${i === 0 ? ', Anführer' : ''}` },
          figureView(fig, child, { alt: '' }),
          i === 0 ? el('span', { class: 'album-team__lead' }, '⭐ Anführer') : null)
        : el('div', { class: 'album-team__slot is-empty' }, el('span', { 'aria-hidden': 'true' }, '＋')));
    }
    body.append(el('section', { class: 'album__sec' },
      el('h3', {}, '🏃 Dein Team'),
      el('p', { class: 'album__hint' }, `Diese ${TEAM_MAX} laufen bei deinen Aufgaben mit. Tippe unten auf eine Figur, um sie ins Team zu holen.`),
      slots));

    // Upgrade-Reise
    const focus = focusOf(child);
    const journey = el('section', { class: 'album__sec' }, el('h3', {}, '⭐ Upgrade-Reise'));
    if (focus) {
      const step = EVO_STEPS[nextStep(child, focus)];
      journey.append(
        el('button', { type: 'button', class: 'album-journey', onclick: () => openSheet(focus) },
          figureView(focus, child, { alt: '' }),
          el('span', { class: 'album-journey__text' },
            el('strong', {}, focus.name),
            evoDots(child, focus),
            el('span', {}, `Als Nächstes: ${step.icon} ${step.label}`))),
        el('p', { class: 'album__hint' }, `Auf dem Glücksrad gibt es dafür ein goldenes Feld. Spätestens beim ${UPGRADE_PITY + 1}. Dreh klappt es sicher!`));
    } else {
      journey.append(el('p', { class: 'album__hint' }, have
        ? 'Alle Reisen geschafft! 🏆 Jede neue Figur bringt eine neue Reise mit.'
        : 'Gewinne deine erste Figur am Glücksrad – dann beginnt ihre Upgrade-Reise.'));
    }
    body.append(journey);

    // Alle Figuren
    const grid = el('div', { class: 'album-grid', role: 'list' });
    for (const fig of all) {
      const has = !!child.figures[fig.id];
      const secret = !has && fig.rarity === 'geheim';
      const stage = stageOf(child, fig.id);
      const done = has && stage >= pathOf(fig).length;
      grid.append(el('button', {
        type: 'button', role: 'listitem', class: `world-slot${has ? '' : ' is-missing'}`, 'data-rarity': fig.rarity,
        'aria-label': has ? `${fig.name}, ${RARITIES[fig.rarity].label}` : `Noch nicht entdeckt, ${RARITIES[fig.rarity].label}`,
        onclick: () => openSheet(fig),
      },
        secret ? el('span', { class: 'world-slot__secret', 'aria-hidden': 'true' }, '?') : figureView(fig, child, { alt: '', silhouette: !has }),
        has ? el('span', { class: 'world-slot__count' }, done ? '🏆' : `${stage}/${pathOf(fig).length}`) : null,
        child.team?.includes(fig.id) ? el('span', { class: 'world-slot__buddy emoji', 'aria-hidden': 'true' }, '🏃') : null));
    }
    body.append(el('section', { class: 'album__sec' }, el('h3', {}, '📖 Alle Figuren'), grid));
  }

  // ---------- Detail-Blatt ----------
  function openSheet(fig) {
    sheetFig = fig;
    renderSheet();
    sheetWrap.hidden = false;
    sheetWrap.querySelector('.world-sheet__close')?.focus({ preventScroll: true });
  }

  function closeSheet() {
    sheetWrap.hidden = true;
    sheetFig = null;
  }

  function renderSheet() {
    const fig = sheetFig;
    clear(sheetWrap);
    if (!fig) return;
    const has = !!child.figures[fig.id];
    const secret = !has && fig.rarity === 'geheim';
    const rar = RARITIES[fig.rarity];
    const sheet = el('div', { class: 'world-sheet', role: 'group', 'aria-label': has ? fig.name : 'Unbekannte Figur' },
      el('button', { type: 'button', class: 'icon-btn icon-btn--plain world-sheet__close', 'aria-label': 'Schließen', onclick: closeSheet }, '✖️'),
      el('div', { class: 'world-sheet__hero' },
        secret ? el('span', { class: 'world-slot__secret', 'aria-hidden': 'true' }, '?') : figureView(fig, child, { alt: has ? fig.name : '', silhouette: !has })),
      el('h3', { class: 'world-sheet__name' }, has ? fig.name : secret ? '???' : 'Noch nicht entdeckt'),
      el('div', { class: 'world-sheet__meta' },
        el('span', { class: 'rarity-badge', 'data-rarity': fig.rarity }, rar.label),
        has ? el('span', {}, `${child.figures[fig.id]}× gewonnen`) : el('span', {}, `Chance im Rad: ${rar.short}`)));

    if (!has) {
      sheet.append(
        el('p', { class: 'world-sheet__hint' }, secret
          ? 'Eine geheime Figur! Niemand weiß, wie sie aussieht … bis du sie im Glücksrad gewinnst.'
          : 'Gewinne diese Figur im Glücksrad, dann beginnt ihre Upgrade-Reise.'),
        secret ? null : el('div', { class: 'world-sheet__sec' }, el('h4', {}, `Ihre Reise: ${pathOf(fig).length} Upgrades`), evoDots(child, fig, { labels: true })));
      sheetWrap.append(sheet);
      return;
    }

    // Reise
    const open = journeyOpen(child, fig);
    const isFocus = child.focus === fig.id;
    const sec = el('section', { class: 'world-sheet__sec' }, el('h4', {}, '⭐ Upgrade-Reise'), evoDots(child, fig, { labels: true }));
    if (!open) sec.append(el('p', { class: 'world-sheet__hint' }, 'Reise geschafft! 🏆 Wenn du sie nochmal gewinnst, gibt es ein Accessoire.'));
    else if (isFocus) sec.append(el('p', { class: 'world-sheet__hint' }, 'Diese Reise läuft gerade: Das goldene Feld im Glücksrad gehört ihr.'));
    else {
      sec.append(
        el('p', { class: 'world-sheet__hint' }, 'Gewinnst du sie nochmal, bekommt sie sofort ein Upgrade.'),
        el('button', { type: 'button', class: 'btn', onclick: () => { setFocus(child, fig.id); commit(); popSound(); } }, '⭐ Diese Reise jetzt verfolgen'));
    }
    sheet.append(sec);

    // Team
    const inTeam = child.team?.includes(fig.id);
    const isLeader = child.team?.[0] === fig.id;
    const full = (child.team?.length ?? 0) >= TEAM_MAX;
    const teamRow = el('div', { class: 'btn-row' },
      el('button', {
        type: 'button', class: `btn${inTeam ? '' : ' btn--primary'}`,
        onclick: () => {
          if (!inTeam && full) { wrongSound(); teamHint.textContent = `Das Team ist voll (${TEAM_MAX}). Nimm erst eine andere Figur heraus – oder mach diese zum Anführer.`; return; }
          toggleTeam(child, fig.id); commit(); popSound();
        },
      }, inTeam ? '➖ Aus dem Team' : '➕ Ins Team'),
      isLeader ? null : el('button', { type: 'button', class: 'btn', onclick: () => { makeLeader(child, fig.id); commit(); popSound(); } }, '⭐ Zum Anführer machen'));
    const teamHint = el('p', { class: 'world-sheet__hint' }, isLeader ? 'Sie führt dein Team an und schläft nachts auf dem Ruhe-Bildschirm.' : '');
    sheet.append(el('section', { class: 'world-sheet__sec' }, el('h4', {}, '🏃 Team'), teamRow, teamHint));

    // Accessoires
    const current = accessoryOf(child, fig.id);
    const owned = ACCESSORIES.filter(a => child.wardrobe.includes(a.id));
    const accRow = el('div', { class: 'acc-row' },
      el('button', { type: 'button', class: 'acc-choice', 'aria-pressed': String(current === null), onclick: () => setAcc(fig, null) },
        el('span', { class: 'emoji', 'aria-hidden': 'true' }, '🚫'), el('span', { class: 'acc-choice__label' }, 'Ohne')),
      ...owned.map(acc => el('button', { type: 'button', class: 'acc-choice', 'aria-pressed': String(current === acc.id), onclick: () => setAcc(fig, acc.id) },
        el('span', { class: 'emoji', 'aria-hidden': 'true' }, acc.icon), el('span', { class: 'acc-choice__label' }, acc.label))));
    sheet.append(el('section', { class: 'world-sheet__sec' },
      el('h4', {}, '👑 Accessoires'),
      el('p', { class: 'world-sheet__hint' }, owned.length < ACCESSORIES.length
        ? 'Neue Accessoires gibt es bei jedem Level-Aufstieg und für doppelte Figuren mit fertiger Reise.'
        : 'Du hast alle Accessoires! 🎉'),
      accRow));
    sheetWrap.append(sheet);
  }

  function setAcc(fig, accId) {
    if (!equipAccessory(child, fig.id, accId)) return;
    commit();
    popSound();
  }

  function commit() {
    save();
    render();
    renderSheet();
    onChange?.();
  }

  const box = el('div', { class: 'album world', 'data-theme': child.theme },
    el('header', { class: 'world__head album__head' },
      el('button', { type: 'button', class: 'icon-btn world__back', 'aria-label': 'Zurück', onclick: () => close() }, '⬅️'),
      el('div', { class: 'world__title' }, el('h2', {}, `Album von ${child.name}`), el('span', { class: 'world__sub' }, theme.world.name))),
    body, sheetWrap);
  box.addEventListener('keydown', e => { if (e.key === 'Escape' && !sheetWrap.hidden) { e.stopPropagation(); closeSheet(); } }, true);
  const { close } = openOverlay(box, { label: `Album von ${child.name}`, className: 'world-overlay', theme: child.theme });
  render();
}
