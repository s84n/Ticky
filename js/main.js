// Bootstrapping und Router zwischen Onboarding, Hauptansicht und Ruhe-Screen.
import { $, el, clear, confirmDialog, vibrate, isSingleCard } from './ui.js';
import { state, load, save, saveNow, ensureToday, requestPersistence } from './store.js';
import { currentRoutine, isNight, toggleTask, toggleAll } from './routine.js';
import { renderMain, updateChild, setActiveChild, renderRest, layoutGrid } from './render.js';
import { startOnboarding } from './onboarding.js';
import { parentLock, openSettings } from './settings.js';
import { initCelebrate, childCompleted, requestSpin, openAllCelebration } from './celebrate.js';
import { THEMES, GENERIC_PRAISE, SPEECH_ALMOST } from './data/themes.js';
import { pick, localDate } from './util.js';
import * as fx from './fx.js';
import { unlockAudio, setSoundEnabledGetter, tapSound, untapSound, introJingle } from './audio.js';
import { speak, setSpeechEnabledGetter } from './speech.js';
import { initPwa, showInstallHint } from './pwa.js';

let current = null;       // { routine, manual } | null
let renderedKey = '';
let tickTimer = null;
const introPlayed = new Set();
const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');

function reducedMotion() {
  const m = state.settings.reducedMotion;
  return m === 'on' || (m === 'auto' && motionQuery.matches);
}

function applySettings() {
  document.body.classList.toggle('reduce-motion', reducedMotion());
}

function showScreen(name) {
  for (const id of ['onboarding', 'main', 'rest']) $(`#screen-${id}`).hidden = id !== name;
}

// ---------- Hintergrund: Sternenhimmel & Ambient ----------

function renderSky(on) {
  const sky = clear($('#sky'));
  if (!on || reducedMotion()) return;
  const n = window.matchMedia('(max-width: 699.98px)').matches ? 18 : 35;
  for (let i = 0; i < n; i++) {
    const s = el('span', { class: 'star', style: { left: `${Math.random() * 100}%`, top: `${Math.random() * 70}%`, '--d': `${2 + Math.random() * 3}s`, '--delay': `${-Math.random() * 4}s` } });
    if (Math.random() < 0.25) { s.style.width = '4px'; s.style.height = '4px'; }
    sky.append(s);
  }
}

function renderAmbient() {
  const amb = clear($('#ambient'));
  if (!current || reducedMotion()) return;
  const mobile = isSingleCard();
  let emojis = [];
  if (mobile) {
    const active = state.children.find(c => c.id === state.ui.activeChildId) ?? state.children[0];
    const list = THEMES[active?.theme ?? 'pixel'].ambient;
    for (let i = 0; i < 14; i++) emojis.push(list[i % list.length]);
  } else {
    for (const theme of new Set(state.children.map(c => c.theme))) {
      const list = THEMES[theme].ambient;
      for (let i = 0; i < 5; i++) emojis.push(pick(list));
    }
  }
  emojis.forEach((e, i) => {
    amb.append(el('span', {
      class: 'ambient-item',
      style: {
        left: `${(i / emojis.length) * 100 + Math.random() * 5}%`,
        '--s': `${1.2 + Math.random() * 1.2}rem`, '--d': `${18 + Math.random() * 14}s`, '--delay': `${-Math.random() * 30}s`,
        '--dx': `${(Math.random() - 0.5) * 120}px`, '--rot': `${(Math.random() - 0.5) * 90}deg`, '--o': `${0.25 + Math.random() * 0.25}`,
      },
    }, e));
  });
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
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', evening || night ? '#12153A' : '#FDF4EC');

  const key = cur ? `${cur.routine}|${cur.manual}|${today}` : `rest|${night}`;
  current = cur;
  if (cur) {
    if (force || key !== renderedKey || dirty) {
      renderMain(state, cur, handlers);
      renderAmbient();
      renderSky(evening);
    }
    showScreen('main');
  } else {
    renderRest(state, now);
    if (force || key !== renderedKey) { clear($('#ambient')); renderSky(night); }
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
    const res = toggleTask(state, current.routine, childId, taskId);
    if (!res) return;
    save();
    updateChild(state, childId);
    const child = state.children.find(c => c.id === childId);
    vibrate(30, state.settings);
    if (res.checked) {
      const r = btn.getBoundingClientRect();
      fx.burstAt(r.right - 40, r.top + r.height / 2, child.theme, 14);
      const phrases = Math.random() < 0.65 ? THEMES[child.theme].praise : GENERIC_PRAISE;
      fx.praiseAt(pick(phrases), r.left + r.width / 2, r.top, child.theme);
      if (!intro) tapSound(child.theme); else setTimeout(() => tapSound(child.theme), 500);
      if (res.remaining === 1) setTimeout(() => speak(pick(SPEECH_ALMOST).replace('{Name}', child.name)), 600);
      if (res.completedNow) childCompleted(child, current.routine);
    } else {
      untapSound();
    }
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
    if (res.completedNow) childCompleted(child, current.routine);
  },

  onSpin(childId) {
    unlockAudio();
    requestSpin(childId);
  },

  onSelect(childId) {
    state.ui.activeChildId = childId;
    save();
    setActiveChild(childId);
    if (isSingleCard()) renderAmbient();
  },
};

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
    onSettingsChanged: () => { applySettings(); tick(true); },
    onImported: () => { applySettings(); startApp(); },
    onReset: () => { clearInterval(tickTimer); current = null; renderedKey = ''; clear($('#ambient')); clear($('#sky')); document.body.className = 'day'; applySettings(); showOnboarding(); },
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
    saveNow();
    requestPersistence();
    startApp();
    if (!state.ui.pwaDismissed) setTimeout(showInstallHint, 1200);
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
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') tick(); else saveNow(); });
  window.addEventListener('pagehide', saveNow);
  motionQuery.addEventListener?.('change', () => { applySettings(); tick(true); });
  let resizeTimer = null;
  window.addEventListener('resize', () => { clearTimeout(resizeTimer); resizeTimer = setTimeout(() => { if (current) renderAmbient(); }, 300); layoutGrid(); });
}

function boot() {
  load();
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
