// Bootstrapping und Router zwischen Onboarding, Hauptansicht und Ruhe-Screen.
import { $, el, clear, confirmDialog, vibrate, isSingleCard } from './ui.js';
import { state, load, save, flush, ensureToday, requestPersistence, replaceState } from './store.js';
import { currentRoutine, isNight, toggleTask, toggleAll, timeInfo } from './routine.js';
import { renderMain, updateChild, setActiveChild, renderRest, layoutGrid, buddyReact, invalidateRest, updateTime, cardHint, hasTeam } from './render.js';
import { openAlbum } from './album.js';
import { startOnboarding } from './onboarding.js';
import { parentLock, openSettings } from './settings.js';
import { initCelebrate, childCompleted, requestSpin, openAllCelebration } from './celebrate.js';
import { THEMES, GENERIC_PRAISE, SPEECH_ALMOST } from './data/themes.js';
import { pick, localDate } from './util.js';
import * as fx from './fx.js';
import { unlockAudio, setSoundEnabledGetter, tapSound, untapSound, introJingle, setVolume } from './audio.js';
import { speak, setSpeechEnabledGetter } from './speech.js';
import { initPwa, showInstallHint } from './pwa.js';
import { isLite, onLiteChange, setLiteMode } from './perf.js';
import { enterDemo } from './demo.js';

let current = null;       // { routine, manual } | null
let renderedKey = '';
let tickTimer = null;
const introPlayed = new Set();
const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');

function reducedMotion() {
  const m = state.settings.reducedMotion;
  return m === 'on' || (m === 'auto' && motionQuery.matches);
}

function applySettings({ freshLite = false } = {}) {
  document.body.classList.toggle('reduce-motion', reducedMotion());
  setLiteMode(state.settings.liteMode, { fresh: freshLite });
  setVolume(state.settings.volume / 100);
}

// Ältere Browser (z. B. iOS < 15.4, Chrome < 108) kennen dvh nicht: dann misst JS die echte Fensterhöhe.
const hasDvh = window.CSS?.supports?.('height', '1dvh') ?? false;
function updateViewportUnit() {
  if (!hasDvh) document.documentElement.style.setProperty('--vh', `${window.innerHeight / 100}px`);
}

function showScreen(name) {
  for (const id of ['onboarding', 'main', 'rest']) $(`#screen-${id}`).hidden = id !== name;
}

// ---------- Hintergrund: Sternenhimmel ----------

/** Ruhige Sterne oben am Himmel (abends und nachts). Sie stehen still: Die einzige Dauer-Animation gehört dem Team. */
function renderSky(on) {
  const sky = clear($('#sky'));
  if (!on) return;
  const n = isLite() ? 10 : 18;
  for (let i = 0; i < n; i++) {
    sky.append(el('span', { class: 'star', style: {
      left: `${(i * 53) % 97}%`, top: `${((i * 37) % 30) + 2}%`,
      '--r': `${i % 3 ? 2 : 3}px`, opacity: String(0.25 + (i % 4) * 0.12),
    } }));
  }
}

// ---------- Router ----------

function tick(force = false) {
  if (!state.setupDone) return;
  const now = new Date();
  const today = localDate(now);
  let dirty = ensureToday(state, today);
  const before = JSON.stringify(state.ui.manualRoutine);
  const cur = currentRoutine(state, now);
  if (JSON.stringify(state.ui.manualRoutine) !== before) dirty = true;
  if (dirty) save();

  const evening = cur?.routine === 'evening';
  const night = !cur && isNight(state.settings, now);
  document.body.classList.toggle('evening', evening);
  document.body.classList.toggle('night', night);
  document.body.classList.toggle('day', !evening && !night);

  const key = cur ? `${cur.routine}|${cur.manual}|${today}` : `rest|${night}`;
  current = cur;
  if (cur) {
    if (force || key !== renderedKey || dirty) {
      renderMain(state, cur, handlers);
      renderSky(evening);
    }
    updateTime(timeInfo(state.settings, cur, now), cur.routine, state.settings.routines[cur.routine]);
    showScreen('main');
  } else {
    renderRest(state, now, openChildAlbum);
    if (force || key !== renderedKey) renderSky(night);
    showScreen('rest');
  }
  renderedKey = key;
}

function startApp() {
  showScreen(null);
  tick(true);
  clearInterval(tickTimer);
  tickTimer = setInterval(() => tick(), 30_000);
}

// ---------- Interaktionen ----------

function playIntroOnce() {
  if (!current) return;
  const k = `${localDate()}|${current.routine}`;
  if (introPlayed.has(k)) return false;
  introPlayed.add(k);
  introJingle(current.routine);
  return true;
}

const handlers = {
  onToggle(childId, taskId, btn) {
    unlockAudio();
    if (!current) return;
    const intro = playIntroOnce();
    const blitz = timeInfo(state.settings, current)?.blitz ?? false;
    const res = toggleTask(state, current.routine, childId, taskId, localDate(), { blitz });
    if (!res) return;
    const r = btn.getBoundingClientRect(); // vor dem DOM-Update lesen: kein erzwungenes Layout
    save();
    updateChild(state, childId);
    const child = state.children.find(c => c.id === childId);
    vibrate(30, state.settings);
    if (res.checked) {
      fx.burstAt(r.right - 40, r.top + r.height / 2, child.theme, 14);
      // Lob erscheint als Sprechblase einer Team-Figur, ohne Team als Hinweis unten in der Card
      const phrase = res.completedNow ? 'Alles fertig! 🎉' : pick(Math.random() < 0.65 ? THEMES[child.theme].praise : GENERIC_PRAISE);
      if (hasTeam(childId)) buddyReact(childId, res.completedNow ? 'party' : 'cheer', r.left + r.width / 2, phrase);
      else cardHint(childId, phrase, 1400);
      if (!intro) tapSound(child.theme); else setTimeout(() => tapSound(child.theme), 500);
      if (res.remaining === 1) setTimeout(() => speak(pick(SPEECH_ALMOST).replace('{Name}', child.name)), 600);
      if (res.completedNow) childCompleted(child, current.routine, res.reward);
    } else {
      untapSound();
      if (hasTeam(childId)) buddyReact(childId, 'oops', null, 'Hoppla! 🙈');
      else cardHint(childId, 'Hoppla! 🙈', 1400);
    }
  },

  /** Kurzer Tipp auf eine erledigte Aufgabe: nichts ändern, nur wackeln und zeigen, wie man zurücknimmt. */
  onHoldHint(childId, btn) {
    btn.animate?.([{ transform: 'none' }, { transform: 'rotate(-1.5deg)' }, { transform: 'rotate(1.5deg)' }, { transform: 'rotate(-1deg)' }, { transform: 'none' }], { duration: 280, easing: 'linear' });
    cardHint(childId, 'Lange drücken zum Zurücknehmen', 1600);
  },

  async onToggleAll(childId) {
    unlockAudio();
    if (!current) return;
    const child = state.children.find(c => c.id === childId);
    const routine = current.routine;
    const allDone = (state.progress[routine][childId]?.length ?? 0) >= child.tasks[routine].length;
    const ok = await confirmDialog(allDone ? `Alle Haken bei ${child.name} entfernen?` : `Alle Aufgaben von ${child.name} abhaken?`, { ok: allDone ? 'Entfernen' : 'Abhaken' });
    if (!ok || !current) return;
    const res = toggleAll(state, current.routine, childId);
    if (!res) return;
    save();
    updateChild(state, childId);
    if (res.completedNow) { buddyReact(childId, 'party'); childCompleted(child, current.routine, res.reward); }
  },

  onSpin(childId) {
    unlockAudio();
    requestSpin(childId);
  },

  onAlbum(childId) {
    unlockAudio();
    openChildAlbum(childId);
  },

  onSelect(childId) {
    state.ui.activeChildId = childId;
    save();
    setActiveChild(childId);
  },
};

function openChildAlbum(childId) {
  unlockAudio();
  openAlbum(childId, {
    onChange: () => {
      invalidateRest();
      if (current) updateChild(state, childId, false);
      else renderRest(state, new Date(), openChildAlbum);
    },
  });
}

function selectRelative(delta) {
  const ids = state.children.map(c => c.id);
  const i = ids.indexOf(state.ui.activeChildId);
  const next = ids[(i + delta + ids.length) % ids.length];
  if (next && next !== state.ui.activeChildId) handlers.onSelect(next);
}

async function openParentArea() {
  unlockAudio();
  if (!(await parentLock())) return;
  openSettings({
    onChange: () => tick(true),
    onSettingsChanged: opts => { applySettings(opts); tick(true); },
    onDemo: () => enterDemo({
      getRoutine: () => current?.routine ?? null,
      // Ohne laufende Routine (Ruhe-Screen) startet die Demo die passende bzw. die Morgenroutine
      ensureRoutine: () => {
        if (!current) state.ui.manualRoutine = { routine: new Date().getHours() >= 14 ? 'evening' : 'morning', date: localDate() };
        tick(true);
      },
      refresh: () => tick(true),
      restart: () => { applySettings(); invalidateRest(); startApp(); },
    }),
    onImported: () => { applySettings(); startApp(); },
    onReset: () => { clearInterval(tickTimer); current = null; renderedKey = ''; clear($('#sky')); document.body.className = 'day'; applySettings(); showOnboarding(); },
  });
}

function showOnboarding() {
  showScreen('onboarding');
  startOnboarding(({ children, customTasks }) => {
    state.children = children;
    state.customTasks = customTasks;
    state.ui.activeChildId = children[0].id;
    state.setupDone = true;
    save();
    requestPersistence();
    startApp();
    if (!state.ui.pwaDismissed) setTimeout(showInstallHint, 1200);
  }, {
    onRestore(next) {
      next.setupDone = true;
      replaceState(next);
      requestPersistence();
      applySettings();
      startApp();
    },
  });
}

function wireStatic() {
  $('#btn-settings').addEventListener('click', openParentArea);
  $('#btn-settings-rest').addEventListener('click', openParentArea);
  $('#btn-trophy').addEventListener('click', () => { unlockAudio(); openAllCelebration(); });
  $('#btn-end-manual').addEventListener('click', async () => {
    if (!(await confirmDialog('Routine beenden und zum Ruhe-Bildschirm wechseln?', { ok: 'Beenden' }))) return;
    state.ui.manualRoutine = null;
    save();
    tick(true);
  });
  for (const r of ['morning', 'evening']) {
    $(`#btn-start-${r}`).addEventListener('click', () => {
      unlockAudio();
      state.ui.manualRoutine = { routine: r, date: localDate() };
      save();
      tick(true);
    });
  }

  // Wischgeste zum Wechseln der Kinder (mobil)
  let sx = null, sy = null;
  const grid = $('#children-grid');
  grid.addEventListener('touchstart', e => { const t = e.touches[0]; sx = t.clientX; sy = t.clientY; }, { passive: true });
  grid.addEventListener('touchend', e => {
    if (sx === null || !isSingleCard()) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - sx, dy = t.clientY - sy;
    sx = sy = null;
    if (Math.abs(dx) > 70 && Math.abs(dy) < 45) selectRelative(dx < 0 ? 1 : -1);
  }, { passive: true });

  document.addEventListener('pointerdown', unlockAudio, { passive: true });
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') tick(); else flush(); });
  window.addEventListener('pagehide', flush);
  document.addEventListener('freeze', flush); // Android friert Apps im Hintergrund ein
  window.addEventListener('appinstalled', () => requestPersistence());
  motionQuery.addEventListener?.('change', () => { applySettings(); tick(true); });
  onLiteChange(() => { if (current) renderSky(document.body.classList.contains('evening')); });
  window.addEventListener('resize', () => {
    updateViewportUnit();
    layoutGrid();
  });
}

async function boot() {
  updateViewportUnit();
  await load();
  if (state.setupDone) requestPersistence(); // bei jedem Start: Chrome sagt oft erst nach der Installation Ja
  setSoundEnabledGetter(() => state.settings.sound);
  setSpeechEnabledGetter(() => state.settings.speech);
  fx.setReducedMotionGetter(reducedMotion);
  applySettings();
  initCelebrate({
    getRoutine: () => current?.routine ?? null,
    refreshChild: id => updateChild(state, id, false),
  });
  wireStatic();
  initPwa({ dismissed: () => { state.ui.pwaDismissed = true; save(); } });

  if (!state.setupDone) showOnboarding();
  else {
    startApp();
    if (!state.ui.pwaDismissed) setTimeout(showInstallHint, 4000);
  }
}

boot();
