// Sammelalbum: alle Figuren eines Kindes, Team (3 Figuren auf dem Aufgaben-Bildschirm) zusammenstellen,
// Upgrade-Reise verfolgen, Sterne ansehen und Accessoires anziehen.
import { el, clear, openOverlay } from './ui.js';
import { state, save } from './store.js';
import { THEMES } from './data/themes.js';
import { RARITIES, figureById } from './data/figures.js';
import { wheelOrder } from './rewards/draw.js';
import {
  levelInfo, levelTitle, ACCESSORIES, EVO_STEPS, TEAM_MAX, UPGRADE_PITY, pathOf, stageOf, nextStep, journeyOpen, focusOf,
  accessoryOf, equipAccessory, toggleTeam, makeLeader, setFocus, STAR_PERKS, STAR_MAX, starsOf,
} from './data/progression.js';
import { figureView } from './figure-view.js';
import { popSound, wrongSound } from './audio.js';

/** „Alex' Album“ bzw. „Mias Album“. */
const possessive = name => (/[sßxz]$/i.test(name) ? `${name}'` : `${name}s`);

/** Stufen einer Reise als Icons, verbunden mit kurzen Linien (erreicht = Gold). */
function stageLine(child, fig) {
  const stage = stageOf(child, fig.id);
  const row = el('span', { class: 'stage-line', 'aria-hidden': 'true' });
  pathOf(fig).forEach((st, i) => {
    if (i) row.append(el('span', { class: `stage-line__link${i <= stage ? ' is-on' : ''}` }));
    row.append(el('span', { class: `stage-line__icon emoji${i < stage ? ' is-on' : ''}` }, EVO_STEPS[st].icon));
  });
  return row;
}

/** Ab dem 2. Stern bekommt die Figur im Album einen Goldrahmen. */
const framed = (child, fig) => starsOf(child, fig.id) >= 2 ? ' has-frame' : '';

/** Wann kommt das nächste Upgrade spätestens? (Garantie nach UPGRADE_PITY Drehs ohne Upgrade) */
function pityText(child) {
  const left = UPGRADE_PITY + 1 - (child.sinceUpgrade ?? 0);
  return left <= 1 ? 'beim nächsten Dreh sicher' : `spätestens in ${left} Drehs`;
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
  const sheetWrap = el('div', { class: 'album-sheet-wrap', hidden: true, onclick: e => { if (e.target === sheetWrap) closeSheet(); } });
  let sheetFig = null;

  function render() {
    const top = body.scrollTop; // Neuaufbau (z. B. Auswahl markieren) soll nicht nach oben springen
    clear(body);
    const info = levelInfo(child.xp);
    const have = all.filter(f => child.figures[f.id]).length;
    body.append(el('div', { class: 'album__stats' },
      el('span', { class: 'tag tag--accent' }, `Lv ${info.level} · ${levelTitle(theme.levelTitles, info.level)}`),
      el('span', { class: 'tag tag--neutral' }, `${have} / ${own.length} entdeckt`)));

    // Team
    const team = (child.team ?? []).map(figureById).filter(Boolean);
    const slots = el('div', { class: 'album-team' });
    for (let i = 0; i < TEAM_MAX; i++) {
      const fig = team[i];
      slots.append(fig
        ? el('button', { type: 'button', class: `album-team__slot${i === 0 ? ' is-leader' : ''}${framed(child, fig)}`, onclick: () => openSheet(fig), 'aria-label': `${fig.name}${i === 0 ? ', Anführer' : ''}` },
          i === 0 ? el('span', { class: 'album-team__crown emoji', 'aria-hidden': 'true' }, '👑') : null,
          figureView(fig, child, { alt: '' }),
          el('span', { class: 'album-team__label' }, i === 0 ? 'Anführer' : 'Team'))
        : el('div', { class: 'album-team__slot is-empty' }, el('span', { class: 'album-team__label' }, 'Frei')));
    }
    body.append(el('section', { class: 'album__sec' }, el('h3', {}, 'Dein Team'), slots));

    // Upgrade-Reise
    const focus = focusOf(child);
    if (focus) {
      const step = EVO_STEPS[nextStep(child, focus)];
      body.append(el('button', { type: 'button', class: 'album-journey', onclick: () => openSheet(focus) },
        figureView(focus, child, { alt: '' }),
        el('span', { class: 'album-journey__text' },
          el('strong', {}, `Upgrade-Reise: ${focus.name}`),
          el('span', { class: 'album-journey__stages' }, stageLine(child, focus), el('span', { class: 'album-journey__count' }, `${stageOf(child, focus.id)}/${pathOf(focus).length}`)),
          el('span', { class: 'album-journey__next' }, `Nächstes: ${step.icon} ${step.label} · ${pityText(child)}`))));
    } else {
      body.append(el('p', { class: 'album-journey album-journey--empty' }, have
        ? 'Alle Reisen geschafft! 🏆 Jede neue Figur bringt eine neue Reise mit.'
        : 'Gewinne deine erste Figur am Glücksrad – dann beginnt ihre Upgrade-Reise.'));
    }

    // Alle Figuren
    const grid = el('div', { class: 'album-grid', role: 'list' });
    for (const fig of all) {
      const has = !!child.figures[fig.id];
      const secret = !has && fig.rarity === 'geheim';
      const stage = stageOf(child, fig.id);
      const done = has && stage >= pathOf(fig).length;
      const stars = starsOf(child, fig.id);
      grid.append(el('button', {
        type: 'button', role: 'listitem', class: `album-slot${has ? '' : ' is-missing'}${sheetFig === fig ? ' is-selected' : ''}${has ? framed(child, fig) : ''}`, 'data-rarity': fig.rarity,
        'aria-label': has ? `${fig.name}, ${RARITIES[fig.rarity].label}` : `Noch nicht entdeckt, ${RARITIES[fig.rarity].label}`,
        onclick: () => openSheet(fig),
      },
        secret ? el('span', { class: 'album-slot__secret', 'aria-hidden': 'true' }, '?') : figureView(fig, child, { alt: '', silhouette: !has }),
        has ? el('span', { class: `album-slot__count${stars ? ' is-stars' : ''}` }, stars ? `★${stars}` : done ? '🏆' : `${stage}/${pathOf(fig).length}`) : null,
        child.team?.includes(fig.id) ? el('span', { class: 'album-slot__team emoji', 'aria-hidden': 'true' }, '🏃') : null));
    }
    body.append(el('section', { class: 'album__sec' }, el('h3', {}, 'Alle Figuren · tippen für Details'), grid));
    body.scrollTop = top;
  }

  // ---------- Detail-Blatt ----------
  function openSheet(fig) {
    sheetFig = fig;
    render();
    renderSheet();
    sheetWrap.hidden = false;
    sheetWrap.querySelector('.album-sheet__close')?.focus({ preventScroll: true });
  }

  function closeSheet() {
    sheetWrap.hidden = true;
    sheetFig = null;
    render();
  }

  function renderSheet() {
    const fig = sheetFig;
    clear(sheetWrap);
    if (!fig) return;
    const has = !!child.figures[fig.id];
    const secret = !has && fig.rarity === 'geheim';
    const rar = RARITIES[fig.rarity];
    const sheet = el('div', { class: 'album-sheet', role: 'group', 'aria-label': has ? fig.name : 'Unbekannte Figur', 'data-rarity': fig.rarity },
      el('span', { class: 'album-sheet__grip', 'aria-hidden': 'true' }),
      el('button', { type: 'button', class: 'icon-btn icon-btn--plain album-sheet__close', 'aria-label': 'Schließen', onclick: closeSheet }, '✕'),
      el('div', { class: 'album-sheet__head' },
        el('div', { class: `album-sheet__hero${has ? framed(child, fig) : ''}` },
          secret ? el('span', { class: 'album-slot__secret', 'aria-hidden': 'true' }, '?') : figureView(fig, child, { alt: has ? fig.name : '', silhouette: !has })),
        el('div', { class: 'album-sheet__title' },
          el('h3', {}, has ? fig.name : secret ? '???' : 'Noch nicht entdeckt'),
          el('span', { class: 'album-sheet__rarity' }, rar.label),
          el('span', { class: 'album-sheet__info' }, has ? `${child.figures[fig.id]}× gewonnen` : `Noch nicht gefunden · ${rar.short} Chance im Rad`))));

    if (!has) {
      sheet.append(el('p', { class: 'album-sheet__hint' }, secret
        ? 'Eine geheime Figur! Niemand weiß, wie sie aussieht … bis du sie im Glücksrad gewinnst.'
        : `Gewinne diese Figur im Glücksrad, dann beginnt ihre Upgrade-Reise mit ${pathOf(fig).length} Upgrades.`));
      sheetWrap.append(sheet);
      return;
    }

    // Reise
    const stage = stageOf(child, fig.id);
    const open = journeyOpen(child, fig);
    const isFocus = child.focus === fig.id;
    sheet.append(el('div', { class: 'album-stages' }, ...pathOf(fig).map((st, i) =>
      el('span', { class: `album-stage${i < stage ? ' is-on' : ''}`, title: EVO_STEPS[st].label },
        el('span', { class: 'emoji', 'aria-hidden': 'true' }, EVO_STEPS[st].icon), el('span', {}, EVO_STEPS[st].short)))));
    const stars = starsOf(child, fig.id);
    if (!open) {
      // Sterne: was jeder Stern bringt, erreichte leuchten
      sheet.append(el('div', { class: 'album-stars' }, ...STAR_PERKS.map((perk, i) =>
        el('span', { class: `album-star${i < stars ? ' is-on' : ''}`, title: perk.label },
          el('span', { class: 'album-star__star', 'aria-hidden': 'true' }, i < stars ? '★' : '☆'),
          el('span', { class: 'emoji', 'aria-hidden': 'true' }, perk.icon), el('span', {}, perk.label)))));
    }
    const nextPerk = STAR_PERKS[stars];
    sheet.append(el('p', { class: 'album-sheet__hint' }, !open
      ? stars >= STAR_MAX
        ? 'Alle Sterne gesammelt! 🌟 Wenn du sie nochmal gewinnst, gibt es ein Accessoire.'
        : `Reise geschafft! 🏆 ${stars} von ${STAR_MAX} Sternen. Gewinnst du sie nochmal, bekommt sie einen Stern: ${nextPerk.icon} ${nextPerk.label}.`
      : isFocus ? 'Diese Reise läuft gerade: Das goldene Feld im Glücksrad gehört ihr.' : 'Gewinnst du sie nochmal, bekommt sie sofort ein Upgrade.'));

    // Accessoires
    const current = accessoryOf(child, fig.id);
    const owned = ACCESSORIES.filter(a => child.wardrobe.includes(a.id));
    sheet.append(el('div', { class: 'album-sheet__acc' },
      el('span', { class: 'album-sheet__label' }, owned.length ? 'Accessoire' : 'Accessoire · gibt es beim Level-Aufstieg'),
      el('div', { class: 'acc-row' },
        el('button', { type: 'button', class: 'acc-choice acc-choice--none', 'aria-pressed': String(current === null), onclick: () => setAcc(fig, null) }, 'Ohne'),
        ...owned.map(acc => el('button', { type: 'button', class: 'acc-choice emoji', 'aria-pressed': String(current === acc.id), 'aria-label': acc.label, title: acc.label, onclick: () => setAcc(fig, acc.id) }, acc.icon)))));

    // Reise verfolgen + Team
    const inTeam = child.team?.includes(fig.id);
    const isLeader = child.team?.[0] === fig.id;
    const full = (child.team?.length ?? 0) >= TEAM_MAX;
    const teamHint = el('p', { class: 'album-sheet__hint', 'aria-live': 'polite' });
    sheet.append(el('div', { class: 'album-sheet__actions' },
      el('button', {
        type: 'button', class: 'btn btn--secondary', disabled: !open || isFocus,
        onclick: () => { setFocus(child, fig.id); commit(); popSound(); },
      }, !open ? 'Reise geschafft 🏆' : isFocus ? 'Reise läuft ⭐' : 'Reise verfolgen'),
      el('button', {
        type: 'button', class: 'btn btn--primary', disabled: isLeader,
        onclick: () => {
          if (inTeam) { makeLeader(child, fig.id); commit(); popSound(); return; }
          if (full) { wrongSound(); teamHint.textContent = `Das Team ist voll (${TEAM_MAX}). Nimm erst eine andere Figur heraus – oder mach diese zum Anführer.`; return; }
          toggleTeam(child, fig.id); commit(); popSound();
        },
      }, isLeader ? 'Ist Anführer 👑' : inTeam ? 'Zum Anführer' : 'Ins Team')),
    el('div', { class: 'album-sheet__more' },
      inTeam ? el('button', { type: 'button', class: 'btn btn--ghost btn--small', onclick: () => { toggleTeam(child, fig.id); commit(); popSound(); } }, 'Aus dem Team nehmen') : null,
      !inTeam && full ? el('button', { type: 'button', class: 'btn btn--ghost btn--small', onclick: () => { makeLeader(child, fig.id); commit(); popSound(); } }, 'Zum Anführer machen') : null),
    teamHint);
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

  const box = el('div', { class: 'album', 'data-theme': child.theme },
    el('header', { class: 'album__head' },
      el('div', { class: 'album__title' }, el('h2', {}, `${possessive(child.name)} Album`), el('span', { class: 'album__sub' }, theme.world.name)),
      el('button', { type: 'button', class: 'icon-btn icon-btn--plain album__close', 'aria-label': 'Schließen', onclick: () => close() }, '✕')),
    body, sheetWrap);
  box.addEventListener('keydown', e => { if (e.key === 'Escape' && !sheetWrap.hidden) { e.stopPropagation(); closeSheet(); } }, true);
  const { close } = openOverlay(box, { label: `${possessive(child.name)} Album`, className: 'album-overlay', theme: child.theme });
  render();
}
