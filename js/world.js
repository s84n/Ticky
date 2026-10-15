// Figurenwelt: Die gewonnenen Figuren eines Kindes laufen in einer Style-Landschaft herum.
// Hier wird auch aufgewertet (Bronze/Silber/Gold), werden Accessoires gekauft und der Buddy gewählt.
import { el, clear, openOverlay, confirmDialog } from './ui.js';
import { state, save } from './store.js';
import { THEMES } from './data/themes.js';
import { RARITIES, figureById } from './data/figures.js';
import { wheelOrder } from './rewards/draw.js';
import {
  levelInfo, levelTitle, TIERS, MAX_TIER, ACCESSORIES, tierOf, accessoryOf, nextTierCost,
  upgradeTier, buyAccessory, equipAccessory,
} from './data/progression.js';
import { figureView, decorateFigure } from './figure-view.js';
import { burstAt, isReduced } from './fx.js';
import { popSound, magicSound, completeSound, wrongSound } from './audio.js';
import { pick } from './util.js';

const GREETINGS = ['Hallo!', 'Hihi!', 'Juhu!', '💖', 'Hey!', '✨', 'Yeah!', '😄'];
const rand = (a, b) => a + Math.random() * (b - a);

/** Öffnet die Figurenwelt. onChange() wird nach jeder Änderung (Kauf, Buddy) aufgerufen. */
export function openWorld(childId, { onChange } = {}) {
  const child = state.children.find(c => c.id === childId);
  if (!child) return;
  const theme = THEMES[child.theme];
  const all = wheelOrder(child.theme);
  let closed = false;
  const timers = new Set();
  const later = (fn, ms) => { const t = setTimeout(() => { timers.delete(t); fn(); }, ms); timers.add(t); };

  // ---------- Kopf ----------
  const levelText = el('span', { class: 'world__level-text' });
  const levelFill = el('span', { class: 'world__level-fill' });
  const dust = el('span', { class: 'world__dust', title: 'Sternenstaub' });
  const head = el('header', { class: 'world__head' },
    el('button', { type: 'button', class: 'icon-btn world__back', 'aria-label': 'Zurück', onclick: () => close() }, '⬅️'),
    el('div', { class: 'world__title' },
      el('h2', {}, theme.world.name),
      el('span', { class: 'world__sub' }, `von ${child.name}`)),
    el('div', { class: 'world__stats' },
      el('div', { class: 'world__level' }, levelText, el('span', { class: 'world__level-bar' }, levelFill)),
      dust));

  function renderStats() {
    const info = levelInfo(child.xp);
    levelText.textContent = `Lv ${info.level} · ${levelTitle(theme.levelTitles, info.level)}`;
    levelFill.style.width = `${info.need ? (info.into / info.need) * 100 : 100}%`;
    dust.textContent = `✨ ${child.stardust}`;
    dust.setAttribute('aria-label', `${child.stardust} Sternenstaub`);
  }

  // ---------- Landschaft mit Figuren ----------
  const stage = el('div', { class: 'world__stage' },
    el('div', { class: 'world__sky', 'aria-hidden': 'true' }),
    el('div', { class: 'world__ground', 'aria-hidden': 'true' }));
  theme.world.props.forEach((p, i) => {
    const x = 6 + (i / theme.world.props.length) * 88 + rand(-3, 3);
    const y = i % 2 ? rand(58, 66) : rand(84, 92);
    stage.append(el('span', { class: 'world__prop emoji', 'aria-hidden': 'true', style: { left: `${x}%`, top: `${y}%`, zIndex: Math.round(y), '--s': i % 2 ? '1' : '1.35' } }, p));
  });

  const actors = new Map();
  const owned = () => all.filter(f => child.figures[f.id]);

  function residents() {
    const list = owned();
    const buddy = child.buddy ? figureById(child.buddy) : null;
    if (buddy && !list.includes(buddy)) list.push(buddy); // Buddy aus einem anderen Style darf mitwohnen
    return list;
  }

  function placeActors() {
    for (const a of actors.values()) a.node.remove();
    actors.clear();
    stage.querySelector('.world__empty')?.remove();
    const list = residents();
    if (!list.length) {
      stage.append(el('p', { class: 'world__empty' }, 'Hier wohnt noch niemand. Schaff deine Routine und dreh am Glücksrad – dann zieht die erste Figur ein!'));
      return;
    }
    list.forEach((fig, i) => {
      const fly = fig.motion === 'fly';
      const big = ['legendaer', 'mythisch', 'geheim'].includes(fig.rarity);
      const node = el('button', {
        type: 'button', class: `world-actor${big ? ' is-big' : ''}${fig.id === child.buddy ? ' is-buddy' : ''}`,
        'aria-label': fig.name, onclick: () => greet(fig),
      }, figureView(fig, child, { alt: '' }));
      const a = { node, fig, x: 0, y: 0 };
      // Startpositionen gleichmäßig verteilt
      a.x = 6 + ((i + 0.5) / list.length) * 82;
      a.y = fly ? rand(10, 34) : rand(56, 82);
      setPos(a, true);
      stage.append(node);
      actors.set(fig.id, a);
      if (!isReduced()) later(() => wander(a), rand(300, 2500));
    });
  }

  function setPos(a, instant = false, dur = 0) {
    a.node.style.transitionDuration = instant ? '0s' : `${dur}s`;
    a.node.style.left = `${a.x}%`;
    a.node.style.top = `${a.y}%`;
    a.node.style.zIndex = String(Math.round(a.y) + 10);
  }

  function wander(a) {
    if (closed || !a.node.isConnected) return;
    const fly = a.fig.motion === 'fly';
    const nx = rand(4, 88);
    const ny = fly ? rand(8, 38) : rand(54, 84);
    const dist = Math.hypot(nx - a.x, (ny - a.y) * 0.6);
    const dur = Math.max(1.6, dist * 0.11);
    a.node.classList.toggle('is-left', nx < a.x);
    a.node.classList.add('is-moving');
    a.x = nx; a.y = ny;
    setPos(a, false, dur);
    later(() => {
      a.node.classList.remove('is-moving');
      later(() => wander(a), rand(900, 4200));
    }, dur * 1000);
  }

  function greet(fig) {
    const a = actors.get(fig.id);
    if (!a) return;
    popSound();
    const inner = a.node.querySelector('.fig');
    inner.classList.remove('is-happy');
    void inner.offsetWidth;
    inner.classList.add('is-happy');
    a.node.querySelector('.world-bubble')?.remove();
    const bubble = el('span', { class: 'world-bubble' }, Math.random() < 0.5 ? fig.name : pick(GREETINGS));
    a.node.append(bubble);
    later(() => bubble.remove(), 1800);
    later(() => inner.classList.remove('is-happy'), 900);
    const r = a.node.getBoundingClientRect();
    burstAt(r.left + r.width / 2, r.top + r.height * 0.3, child.theme, 8);
  }

  // ---------- Leiste mit allen Figuren ----------
  const stripCount = el('span', { class: 'world__count' });
  const slots = el('div', { class: 'world__slots', role: 'list' });
  const strip = el('div', { class: 'world__strip' },
    el('div', { class: 'world__strip-head' }, stripCount, el('span', { class: 'world__hint' }, 'Tippe auf eine Figur zum Aufwerten')),
    slots);

  function renderStrip() {
    clear(slots);
    const have = owned().length;
    stripCount.textContent = `${have} / ${all.length} entdeckt`;
    for (const fig of all) {
      const has = !!child.figures[fig.id];
      const secret = !has && fig.rarity === 'geheim';
      const tier = tierOf(child, fig.id);
      slots.append(el('button', {
        type: 'button', role: 'listitem', class: `world-slot${has ? '' : ' is-missing'}`, 'data-rarity': fig.rarity,
        'aria-label': has ? `${fig.name}, ${RARITIES[fig.rarity].label}` : `Noch nicht entdeckt, ${RARITIES[fig.rarity].label}`,
        onclick: () => openSheet(fig),
      },
        secret ? el('span', { class: 'world-slot__secret', 'aria-hidden': 'true' }, '?') : figureView(fig, child, { alt: '', silhouette: !has }),
        has && child.figures[fig.id] > 1 ? el('span', { class: 'world-slot__count' }, `×${child.figures[fig.id]}`) : null,
        tier ? el('span', { class: 'world-slot__medal emoji', 'aria-hidden': 'true' }, TIERS[tier].medal) : null,
        fig.id === child.buddy ? el('span', { class: 'world-slot__buddy emoji', 'aria-hidden': 'true' }, '💛') : null));
    }
  }

  // ---------- Detail-Blatt: Aufwerten, Accessoires, Buddy ----------
  const sheetWrap = el('div', { class: 'world__sheet-wrap', hidden: true, onclick: e => { if (e.target === sheetWrap) closeSheet(); } });
  let sheetFig = null;

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
      el('button', { type: 'button', class: 'icon-btn icon-btn--plain world-sheet__close', 'aria-label': 'Schließen', onclick: closeSheet }, '✖️'));

    const hero = el('div', { class: 'world-sheet__hero' },
      secret ? el('span', { class: 'world-slot__secret', 'aria-hidden': 'true' }, '?') : figureView(fig, child, { alt: has ? fig.name : '', silhouette: !has }));
    sheet.append(hero,
      el('h3', { class: 'world-sheet__name' }, has ? fig.name : secret ? '???' : 'Noch nicht entdeckt'),
      el('div', { class: 'world-sheet__meta' },
        el('span', { class: 'rarity-badge', 'data-rarity': fig.rarity }, rar.label),
        has ? el('span', {}, `${child.figures[fig.id]}× gewonnen`) : el('span', {}, `Chance im Rad: ${rar.short}`)));

    if (!has) {
      sheet.append(el('p', { class: 'world-sheet__hint' }, secret
        ? 'Eine geheime Figur! Niemand weiß, wie sie aussieht … bis du sie im Glücksrad gewinnst.'
        : 'Gewinne diese Figur im Glücksrad, dann zieht sie hier ein.'));
      sheetWrap.append(sheet);
      return;
    }

    // Stufen
    const tier = tierOf(child, fig.id);
    const cost = nextTierCost(child, fig.id);
    const medals = el('div', { class: 'tier-row' });
    for (let t = 1; t <= MAX_TIER; t++) {
      medals.append(el('span', { class: `tier-step${t <= tier ? ' is-on' : ''}`, 'data-tier': t },
        el('span', { class: 'emoji', 'aria-hidden': 'true' }, TIERS[t].medal), TIERS[t].label));
    }
    const tierBtn = cost === null
      ? el('p', { class: 'world-sheet__hint' }, 'Höchste Stufe erreicht! 🌟')
      : el('button', {
        type: 'button', class: 'btn btn--primary', disabled: child.stardust < cost,
        onclick: () => buyTier(fig),
      }, `${TIERS[tier + 1].medal} ${TIERS[tier + 1].label} für ${cost} ✨`);
    const tierHint = cost !== null && child.stardust < cost
      ? el('p', { class: 'world-sheet__hint' }, `Dir fehlen noch ${cost - child.stardust} ✨. Sternenstaub gibt es für doppelte Figuren und für jedes neue Level.`)
      : null;
    sheet.append(el('section', { class: 'world-sheet__sec' }, el('h4', {}, 'Aufwerten'), medals, tierBtn, tierHint));

    // Accessoires
    const current = accessoryOf(child, fig.id);
    const accRow = el('div', { class: 'acc-row' });
    accRow.append(el('button', {
      type: 'button', class: 'acc-choice', 'aria-pressed': String(current === null), onclick: () => setAcc(fig, null),
    }, el('span', { class: 'emoji', 'aria-hidden': 'true' }, '🚫'), el('span', { class: 'acc-choice__label' }, 'Ohne')));
    for (const acc of ACCESSORIES) {
      const ownedAcc = child.wardrobe.includes(acc.id);
      accRow.append(el('button', {
        type: 'button', class: `acc-choice${ownedAcc ? '' : ' is-locked'}`, 'aria-pressed': String(current === acc.id),
        'aria-label': ownedAcc ? acc.label : `${acc.label} für ${acc.cost} Sternenstaub freischalten`,
        onclick: () => ownedAcc ? setAcc(fig, acc.id) : buyAcc(fig, acc),
      }, el('span', { class: 'emoji', 'aria-hidden': 'true' }, acc.icon),
        el('span', { class: 'acc-choice__label' }, ownedAcc ? acc.label : `${acc.cost} ✨`)));
    }
    sheet.append(el('section', { class: 'world-sheet__sec' },
      el('h4', {}, 'Accessoires'),
      el('p', { class: 'world-sheet__hint' }, 'Einmal freigeschaltet, passt es jeder deiner Figuren.'),
      accRow));

    // Buddy
    const isBuddy = child.buddy === fig.id;
    sheet.append(el('button', {
      type: 'button', class: `btn btn--big world-sheet__buddy${isBuddy ? ' is-buddy' : ''}`, disabled: isBuddy,
      onclick: () => { child.buddy = fig.id; commit(); popSound(); placeActors(); renderSheet(); },
    }, isBuddy ? `💛 ${fig.name} ist dein Buddy` : '💛 Als Buddy wählen'));
    sheetWrap.append(sheet);
  }

  async function buyTier(fig) {
    const t = tierOf(child, fig.id) + 1;
    const cost = nextTierCost(child, fig.id);
    if (cost === null) return;
    if (!(await confirmDialog(`${fig.name} für ${cost} Sternenstaub auf ${TIERS[t].label} aufwerten?`, { ok: `${TIERS[t].medal} Aufwerten` }))) return;
    if (upgradeTier(child, fig.id) === null) { wrongSound(); return; }
    commit();
    if (t === MAX_TIER) magicSound(); else completeSound(child.theme);
    refreshFigure(fig);
    const r = sheetWrap.querySelector('.world-sheet__hero')?.getBoundingClientRect();
    if (r) burstAt(r.left + r.width / 2, r.top + r.height / 2, child.theme, 24);
  }

  async function buyAcc(fig, acc) {
    if (child.stardust < acc.cost) {
      wrongSound();
      await confirmDialog(`${acc.label} kostet ${acc.cost} Sternenstaub. Dir fehlen noch ${acc.cost - child.stardust} ✨.`, { ok: 'OK', cancel: 'Schließen' });
      return;
    }
    if (!(await confirmDialog(`${acc.icon} ${acc.label} für ${acc.cost} Sternenstaub freischalten?`, { ok: 'Freischalten' }))) return;
    if (!buyAccessory(child, acc.id)) { wrongSound(); return; }
    equipAccessory(child, fig.id, acc.id);
    commit();
    magicSound();
    refreshFigure(fig);
  }

  function setAcc(fig, accId) {
    if (!equipAccessory(child, fig.id, accId)) return;
    commit();
    popSound();
    refreshFigure(fig);
  }

  function refreshFigure(fig) {
    const a = actors.get(fig.id);
    if (a) decorateFigure(a.node.querySelector('.fig'), fig, child);
    renderSheet();
  }

  function commit() {
    save();
    renderStats();
    renderStrip();
    onChange?.();
  }

  // ---------- Zusammenbauen ----------
  const box = el('div', { class: 'world', 'data-theme': child.theme }, head, stage, strip, sheetWrap);
  box.addEventListener('keydown', e => { if (e.key === 'Escape' && !sheetWrap.hidden) { e.stopPropagation(); closeSheet(); } }, true);
  const { close } = openOverlay(box, {
    label: `${theme.world.name} von ${child.name}`, className: 'world-overlay', theme: child.theme,
    onClose: () => { closed = true; for (const t of timers) clearTimeout(t); timers.clear(); },
  });
  renderStats();
  renderStrip();
  placeActors();
}
