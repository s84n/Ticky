// Eltern-Bereich (⚙️) inkl. Eltern-Sperre.
import { el, clear, openOverlay, confirmDialog, alertDialog } from './ui.js';
import { state, save, saveNow, exportBackup, parseBackup, replaceState, resetAll, removeChild, removeCustomTask, MAX_CHILDREN, requestPersistence, isDemo } from './store.js';
import { THEMES } from './data/themes.js';
import { ROUTINES, ROUTINE_META } from './data/task-catalog.js';
import { validateTimes, goalOf } from './routine.js';
import { basicsEditor, tasksEditor, newChildDraft, customTaskForm } from './child-editor.js';
import { localDate, cryptoRandom, deepClone, parseTime } from './util.js';
import { wrongSound, popSound, setVolume, unlockAudio } from './audio.js';
import { toast, confetti } from './fx.js';
import { VERSION, REPO_URL } from './config.js';
import { pickQuestions } from './data/parent-quiz.js';
import { levelInfo, BLITZ_XP, BOOST_PCTS, BOOST_MINUTES, boostMinutesLeft } from './data/progression.js';
import { openPicker } from './rewards/picker.js';

// ---------- Eltern-Sperre ----------

/** So viele Quizfragen hintereinander müssen stimmen. Nach LOCK_TRIES falschen Versuchen: LOCK_WAIT_MS warten. */
const QUIZ_COUNT = 2, LOCK_TRIES = 2, LOCK_WAIT_MS = 30_000;
const RECENT_KEY = 'ticky_quiz_recent', WAIT_KEY = 'ticky_lock_wait', RECENT_MAX = 24;

/** Gerätelokale Kleinigkeiten (zuletzt gestellte Fragen, Wartezeit) – nicht Teil des Backups. */
const local = {
  get(key, fallback) { try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; } },
  set(key, value) { try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* privat/voll: egal */ } },
};

/**
 * Erwachsenen-Quiz: QUIZ_COUNT Fragen aus dem Erwachsenenalltag, je 4 Antworten. Promise<boolean>.
 * Raten lohnt sich kaum (1 : 16) und wird nach LOCK_TRIES Fehlversuchen mit einer Wartezeit gebremst.
 */
export function parentLock() {
  return new Promise(resolve => {
    let ok = false;
    let questions = [], step = 0, fails = 0, waitTimer = null;
    const progress = el('span', { class: 'lock__kicker' });
    const q = el('p', { class: 'lock__question' });
    const answers = el('div', { class: 'quiz' });
    const msg = el('p', { class: 'lock__msg', 'aria-live': 'polite' });

    function newRound() {
      const recent = local.get(RECENT_KEY, []);
      questions = pickQuestions(QUIZ_COUNT, Array.isArray(recent) ? recent : [], cryptoRandom);
      local.set(RECENT_KEY, [...questions.map(x => x.id), ...recent].slice(0, RECENT_MAX));
      step = 0;
      show();
    }
    function show() {
      const cur = questions[step];
      progress.textContent = `⚙️ Nur für Erwachsene · Frage ${step + 1} von ${questions.length}`;
      q.textContent = cur.q;
      answers.replaceChildren(...cur.answers.map(text =>
        el('button', { type: 'button', class: 'quiz__answer', onclick: e => choose(text, e.currentTarget) }, text)));
      if (!waitTimer) answers.querySelector('button')?.focus({ preventScroll: true });
    }
    function choose(text, btn) {
      if (waitTimer) return;
      if (text === questions[step].correct) {
        step++;
        if (step < questions.length) { msg.textContent = 'Richtig! Noch eine Frage.'; show(); return; }
        ok = true;
        msg.textContent = 'Richtig – Eltern-Bereich öffnet …';
        close();
        return;
      }
      wrongSound();
      btn.classList.add('is-wrong');
      fails++;
      if (fails >= LOCK_TRIES) {
        fails = 0;
        local.set(WAIT_KEY, Date.now() + LOCK_WAIT_MS);
        startWait();
      } else {
        msg.textContent = 'Leider falsch – neue Fragen.';
      }
      setTimeout(newRound, 600);
    }
    /** Wartezeit nach zu vielen Fehlversuchen (übersteht auch einen Neustart der App). */
    function startWait() {
      const until = Number(local.get(WAIT_KEY, 0)) || 0;
      if (until <= Date.now()) return;
      answers.classList.add('is-waiting');
      const tickWait = () => {
        const left = Math.ceil((until - Date.now()) / 1000);
        if (left <= 0) {
          clearInterval(waitTimer);
          waitTimer = null;
          answers.classList.remove('is-waiting');
          msg.textContent = 'Neuer Versuch.';
          answers.querySelector('button')?.focus({ preventScroll: true });
          return;
        }
        msg.textContent = `Zu viele falsche Antworten – bitte ${left} Sekunden warten.`;
      };
      waitTimer = setInterval(tickWait, 1000);
      tickWait();
    }
    const box = el('div', { class: 'lock' },
      el('button', { type: 'button', class: 'icon-btn icon-btn--plain lock__close', 'aria-label': 'Abbrechen', onclick: () => close() }, '✕'),
      el('div', { class: 'lock__head' },
        progress,
        el('h2', {}, 'Beantworte die Fragen, um den Eltern-Bereich zu öffnen')),
      q,
      msg,
      answers);
    newRound();
    startWait();
    const { close } = openOverlay(box, { label: 'Eltern-Sperre', className: 'lock-overlay', onClose: () => { clearInterval(waitTimer); resolve(ok); } });
  });
}

// ---------- Eltern-Bereich ----------

/**
 * Öffnet den Eltern-Bereich. hooks: { onChange() – Hauptansicht neu aufbauen, onReset() – zurück ins Onboarding,
 *   onImported() – nach Import neu starten, onSettingsChanged(opts) – Optionen (Bewegung etc.) anwenden,
 *   onDemo() – Demo-Modus starten }
 */
export function openSettings(hooks) {
  const body = el('div');
  const box = el('div', { class: 'dialog dialog--full' },
    el('div', { class: 'dialog-head' },
      el('h2', {}, '⚙️ Eltern-Bereich'),
      el('button', { type: 'button', class: 'btn', onclick: () => close() }, 'Fertig')),
    body);
  // Restzeit des Eltern-Boosts aktuell halten, solange der Bereich offen ist (nur der Schnellzugriff, Eingaben bleiben)
  let quick = null;
  const boostTimer = setInterval(() => { if (state.boost && quick?.isConnected) quick.replaceWith(quick = quickSection()); }, 20_000);
  const { close } = openOverlay(box, { label: 'Eltern-Bereich', onClose: () => clearInterval(boostTimer) });

  function render() {
    clear(body);
    if (isDemo()) body.append(el('p', { class: 'demo-note' }, '🧪 Demo-Modus aktiv: Änderungen hier werden beim Beenden der Demo verworfen.'));
    quick = quickSection();
    body.append(quick, childrenSection(), customSection(), timesSection(), optionsSection(), demoSection(), dataSection(), infoSection());
  }

  function changed() {
    save();
    hooks.onChange?.();
    render();
  }

  // 0. Schnellzugriff: Zufallsrad und Eltern-Boost
  function quickSection() {
    const sec = el('section', { class: 'settings-section' }, el('h3', {}, '✨ Für zwischendurch'));
    const few = state.children.length < 2;
    const picker = el('button', {
      type: 'button', class: 'quick-btn quick-btn--picker', disabled: few,
      onclick: () => openPicker(state.children, { settings: state.settings }),
    },
    el('span', { class: 'quick-btn__icon', 'aria-hidden': 'true' }, '🎲'),
    el('span', { class: 'quick-btn__text' },
      el('strong', {}, 'Zufallsrad'),
      el('span', {}, few ? 'Ab 2 Kindern' : 'Wer ist zuerst dran? Das Rad entscheidet.')));

    const left = boostMinutesLeft(state.boost);
    const { boostPct: pct, boostMinutes: mins } = state.settings;
    const boost = el('button', {
      type: 'button', class: `quick-btn quick-btn--boost${left ? ' is-active' : ''}`,
      onclick: async () => {
        if (left) {
          if (!(await confirmDialog('Eltern-Boost jetzt beenden?', { ok: 'Beenden' }))) return;
          state.boost = null;
          changed();
          toast('Eltern-Boost beendet.');
          return;
        }
        state.boost = { pct, until: Date.now() + mins * 60_000 };
        changed();
        popSound();
        confetti(60);
        toast(`🚀 Eltern-Boost: +${pct} % für ${mins} Minuten!`);
      },
    },
    el('span', { class: 'quick-btn__icon', 'aria-hidden': 'true' }, '🚀'),
    el('span', { class: 'quick-btn__text' },
      el('strong', {}, left ? `Boost läuft: +${state.boost.pct} %` : 'Eltern-Boost starten'),
      el('span', {}, left ? `Noch ${left} Min · Tippen zum Beenden` : `+${pct} % für ${mins} Minuten`)));

    const choice = (label, values, key, unit) => {
      const seg = el('div', { class: 'segmented', role: 'group', 'aria-label': label });
      for (const v of values) {
        seg.append(el('button', {
          type: 'button', 'aria-pressed': String(state.settings[key] === v),
          onclick: () => { state.settings[key] = v; save(); render(); },
        }, `${key === 'boostPct' ? '+' : ''}${v}${unit}`));
      }
      return el('div', { class: 'switch' }, el('span', {}, label), seg);
    };
    sec.append(el('div', { class: 'quick-grid' }, picker, boost),
      el('p', { class: 'muted' }, 'Eltern-Boost: Für Tage, an denen die Kinder besonders toll mitgemacht haben. Alle Kinder bekommen mehr XP und bessere Chancen am Glücksrad auf seltene Figuren und Upgrades.'),
      choice('Boost-Stärke', BOOST_PCTS, 'boostPct', ' %'),
      choice('Boost-Dauer', BOOST_MINUTES, 'boostMinutes', ' Min'));
    return sec;
  }

  // 1. Kinder verwalten
  function childrenSection() {
    const sec = el('section', { class: 'settings-section' }, el('h3', {}, '👧 Kinder'));
    state.children.forEach((c, i) => {
      sec.append(el('div', { class: 'child-row' },
        el('span', { class: 'child-row__avatar', 'aria-hidden': 'true' }, c.avatar),
        el('div', { class: 'child-row__info' },
          el('div', { class: 'child-row__name' }, c.name),
          el('div', { class: 'child-row__theme' }, `${THEMES[c.theme].name} · ${c.tasks.morning.length} ☀️ / ${c.tasks.evening.length} 🌙`),
          el('div', { class: 'child-row__theme' }, `Level ${levelInfo(c.xp).level} · ${Object.keys(c.figures).length} Figuren`)),
        el('div', { class: 'child-row__actions' },
        el('button', { type: 'button', class: 'icon-btn', disabled: i === 0, 'aria-label': `${c.name} nach oben`, onclick: () => { swap(i, i - 1); } }, '⬆️'),
        el('button', { type: 'button', class: 'icon-btn', disabled: i === state.children.length - 1, 'aria-label': `${c.name} nach unten`, onclick: () => { swap(i, i + 1); } }, '⬇️'),
        el('button', { type: 'button', class: 'icon-btn', 'aria-label': `${c.name} bearbeiten`, onclick: () => editChild(c) }, '✏️'),
        el('button', {
          type: 'button', class: 'icon-btn', disabled: state.children.length <= 1, 'aria-label': `${c.name} löschen`,
          onclick: async () => {
            if (await confirmDialog(`${c.name} wirklich löschen? Fortschritt und gewonnene Figuren gehen verloren.`, { ok: 'Löschen', danger: true })) {
              removeChild(state, c.id);
              changed();
            }
          },
        }, '🗑️'))));
    });
    const full = state.children.length >= MAX_CHILDREN;
    sec.append(el('button', { type: 'button', class: 'add-child', disabled: full, onclick: () => editChild(null) }, full ? 'Maximal 5 Kinder' : '＋ Kind hinzufügen'));
    return sec;
  }

  function swap(i, j) {
    const arr = state.children;
    [arr[i], arr[j]] = [arr[j], arr[i]];
    changed();
  }

  function editChild(child) {
    const isNew = !child;
    const draft = isNew ? newChildDraft(state.children.length) : deepClone(child);
    const customTasks = deepClone(state.customTasks);
    const others = () => state.children.filter(c => c.id !== draft.id);
    const basics = basicsEditor(draft, { allNames: () => others().map(c => c.name) });
    const tasks = tasksEditor(draft, { customTasks, siblings: () => others() });
    const dlg = el('div', { class: 'dialog dialog--wide', 'data-theme': draft.theme },
      el('div', { class: 'dialog-head' }, el('h2', {}, isNew ? 'Neues Kind' : `${child.name} bearbeiten`)),
      basics.root,
      el('h3', {}, 'Aufgaben'),
      tasks.root,
      el('div', { class: 'btn-row btn-row--end', style: { marginTop: '18px' } },
        el('button', { type: 'button', class: 'btn btn--ghost', onclick: () => closeEd() }, 'Abbrechen'),
        el('button', {
          type: 'button', class: 'btn btn--primary', onclick: () => {
            if (!basics.validate()) { basics.focus(); return; }
            if (!tasks.validate()) return;
            state.customTasks = customTasks;
            if (isNew) {
              if (state.children.length >= MAX_CHILDREN) return;
              state.children.push(draft);
            } else {
              const idx = state.children.findIndex(c => c.id === draft.id);
              if (idx >= 0) state.children[idx] = draft;
              // Fortschritt um entfernte Aufgaben bereinigen
              for (const r of ROUTINES) {
                if (state.progress[r][draft.id]) state.progress[r][draft.id] = state.progress[r][draft.id].filter(id => draft.tasks[r].includes(id));
              }
            }
            closeEd();
            changed();
            toast(isNew ? `${draft.name} wurde hinzugefügt.` : 'Gespeichert.');
          },
        }, 'Speichern')));
    const { close: closeEd } = openOverlay(dlg, { label: isNew ? 'Neues Kind' : `${child.name} bearbeiten` });
  }

  // 2. Eigene Aufgaben
  function customSection() {
    const sec = el('section', { class: 'settings-section' }, el('h3', {}, '✏️ Eigene Aufgaben'));
    const entries = Object.entries(state.customTasks);
    if (!entries.length) sec.append(el('p', { class: 'muted' }, 'Noch keine eigenen Aufgaben. Du kannst sie beim Bearbeiten eines Kindes anlegen.'));
    for (const [id, t] of entries) {
      const row = el('div', { class: 'child-row' },
        el('span', { class: 'child-row__avatar', 'aria-hidden': 'true' }, t.icon),
        el('div', { class: 'child-row__info' }, el('div', { class: 'child-row__name' }, t.label), el('div', { class: 'child-row__theme' }, `${ROUTINE_META[t.routine].emoji} ${ROUTINE_META[t.routine].title}`)),
        el('div', { class: 'child-row__actions' },
        el('button', {
          type: 'button', class: 'icon-btn', 'aria-label': `${t.label} bearbeiten`, onclick: () => {
            row.replaceWith(customTaskForm(t.routine, state.customTasks, { existingId: id, onSave: () => changed(), onCancel: () => render() }));
          },
        }, '✏️'),
        el('button', {
          type: 'button', class: 'icon-btn', 'aria-label': `${t.label} löschen`, onclick: async () => {
            if (await confirmDialog(`„${t.label}“ löschen? Die Aufgabe wird bei allen Kindern entfernt.`, { ok: 'Löschen', danger: true })) {
              removeCustomTask(state, id);
              changed();
            }
          },
        }, '🗑️')));
      sec.append(row);
    }
    return sec;
  }

  // 3. Routinezeiten
  function timesSection() {
    const sec = el('section', { class: 'settings-section' }, el('h3', {}, '⏰ Routinezeiten'));
    const err = el('div', { class: 'field__error', 'aria-live': 'polite' });
    const draft = deepClone(state.settings.routines);
    const grid = el('div', { class: 'time-grid' }, el('span'), el('span', { class: 'field__label' }, 'Start'), el('span', { class: 'field__label' }, 'Ende'));
    for (const r of ROUTINES) {
      grid.append(el('span', {}, `${ROUTINE_META[r].emoji} ${ROUTINE_META[r].label}`));
      for (const k of ['start', 'end']) {
        const inp = el('input', { class: 'input', type: 'time', value: draft[r][k], 'aria-label': `${ROUTINE_META[r].title} ${k === 'start' ? 'Start' : 'Ende'}` });
        inp.addEventListener('change', () => {
          draft[r][k] = inp.value;
          const errors = validateTimes(draft);
          err.textContent = errors.join(' ');
          if (!errors.length) { state.settings.routines = deepClone(draft); save(); hooks.onChange?.(); syncGoals(); toast('Zeiten gespeichert.'); }
        });
        grid.append(inp);
      }
    }

    // Blitz-Zeit: Wer vorher fertig ist, bekommt Extra-XP. Leer = automatisch nach drei Vierteln der Zeit.
    const goalGrid = el('div', { class: 'time-grid time-grid--goal' });
    const goalInputs = {};
    const syncGoals = () => { for (const r of ROUTINES) goalInputs[r].value = goalOf(draft[r]) ?? ''; };
    for (const r of ROUTINES) {
      const inp = el('input', { class: 'input', type: 'time', 'aria-label': `${ROUTINE_META[r].title}: Blitz-Bonus bis` });
      goalInputs[r] = inp;
      const store = goal => {
        draft[r].goal = goal;
        state.settings.routines = deepClone(draft); save(); hooks.onChange?.(); syncGoals();
      };
      inp.addEventListener('change', () => {
        const g = parseTime(inp.value), s = parseTime(draft[r].start), e = parseTime(draft[r].end);
        if (g === null || g <= s || g > e) { err.textContent = `${ROUTINE_META[r].title}: Die Blitz-Zeit muss zwischen Start und Ende liegen.`; syncGoals(); return; }
        err.textContent = '';
        store(inp.value);
        toast('Blitz-Zeit gespeichert.');
      });
      goalGrid.append(
        el('span', {}, `⚡ ${ROUTINE_META[r].label}`),
        inp,
        el('button', { type: 'button', class: 'btn btn--small', onclick: () => { err.textContent = ''; store(''); toast('Blitz-Zeit: automatisch.'); } }, 'Auto'));
    }
    syncGoals();
    sec.append(grid,
      el('p', { class: 'muted' }, '⚡ Blitz-Bonus: Wer seine Aufgaben vor dieser Uhrzeit selbst schafft, bekommt +' + BLITZ_XP + ' XP. „Auto“ setzt sie auf drei Viertel des Zeitfensters.'),
      goalGrid, err);
    return sec;
  }

  // 4. Optionen
  function optionsSection() {
    const sec = el('section', { class: 'settings-section' }, el('h3', {}, '🔊 Optionen'));
    const sw = (key, label) => {
      const id = `opt-${key}`;
      const inp = el('input', { id, type: 'checkbox', role: 'switch' });
      inp.checked = state.settings[key];
      inp.addEventListener('change', () => { state.settings[key] = inp.checked; save(); hooks.onSettingsChanged?.(); if (key === 'sound' && inp.checked) popSound(); });
      return el('label', { class: 'switch', for: id }, el('span', {}, label), inp);
    };
    sec.append(sw('sound', 'Sound'), sw('speech', 'Sprachansagen'), sw('timer', 'Zeitleiste & Blitz-Bonus'));
    if ('vibrate' in navigator) sec.append(sw('vibration', 'Vibration'));
    const seg = el('div', { class: 'segmented', role: 'group', 'aria-label': 'Animationen reduzieren' });
    for (const [v, l] of [['auto', 'Automatisch'], ['on', 'Ja'], ['off', 'Nein']]) {
      seg.append(el('button', {
        type: 'button', 'aria-pressed': String(state.settings.reducedMotion === v),
        onclick: () => { state.settings.reducedMotion = v; save(); hooks.onSettingsChanged?.(); render(); },
      }, l));
    }
    sec.append(el('div', { class: 'switch' }, el('span', {}, 'Animationen reduzieren'), seg));

    // Lautstärke: wirkt sofort, ein kurzer Ton zum Probehören nach dem Loslassen
    const vol = el('input', { type: 'range', class: 'range', min: 0, max: 100, step: 5, value: state.settings.volume, 'aria-label': 'Lautstärke' });
    const volText = el('span', { class: 'range-value' }, `${state.settings.volume} %`);
    vol.addEventListener('input', () => { volText.textContent = `${vol.value} %`; setVolume(vol.value / 100); });
    vol.addEventListener('change', () => { state.settings.volume = Number(vol.value); save(); unlockAudio(); popSound(); });
    sec.append(el('label', { class: 'slider-row' }, el('span', {}, 'Lautstärke'), el('span', { class: 'slider-row__ctrl' }, vol, volText)));

    // Sparmodus: weniger gleichzeitige Effekte, kleinere Leuchteffekte – für schwächere Tablets
    const lite = el('div', { class: 'segmented', role: 'group', 'aria-label': 'Sparmodus' });
    for (const [v, l] of [['auto', 'Automatisch'], ['on', 'An'], ['off', 'Aus']]) {
      lite.append(el('button', {
        type: 'button', 'aria-pressed': String(state.settings.liteMode === v),
        onclick: () => { state.settings.liteMode = v; save(); hooks.onSettingsChanged?.({ freshLite: true }); render(); },
      }, l));
    }
    sec.append(el('div', { class: 'switch' }, el('span', {}, 'Sparmodus (für schwächere Geräte)'), lite),
      el('p', { class: 'muted' }, 'Weniger Partikel und Leuchteffekte, ruhigere Figuren. „Automatisch“ schaltet ihn ein, wenn das Gerät schwach ist oder Effekte ruckeln.'));
    return sec;
  }

  // 5. Demo-Modus
  function demoSection() {
    const sec = el('section', { class: 'settings-section' }, el('h3', {}, '🧪 Demo-Modus'));
    sec.append(el('p', { class: 'muted' }, 'Zum Ausprobieren von Glücksrad, Level-up und Feiern. Alles funktioniert wie sonst, aber nichts wird gespeichert: Beim Beenden sind Level, Figuren und Fortschritt wieder genau wie vorher.'));
    if (isDemo()) sec.append(el('p', {}, 'Die Demo läuft bereits. Beenden über „Demo beenden“ unten links.'));
    else sec.append(el('button', { type: 'button', class: 'btn btn--primary', onclick: () => { close(); hooks.onDemo?.(); } }, '🧪 Demo starten'));
    return sec;
  }

  // 6. Daten
  function dataSection() {
    const sec = el('section', { class: 'settings-section' }, el('h3', {}, '💾 Daten'));
    if (isDemo()) return sec.appendChild(el('p', { class: 'muted' }, 'Backup und Zurücksetzen sind im Demo-Modus gesperrt.')).parentNode;
    sec.append(el('p', { class: 'muted' }, 'Alle Daten liegen nur auf diesem Gerät (doppelt gespeichert). Beim Löschen der App- oder Browserdaten geht alles verloren – ein Backup hilft, auch beim Umzug auf ein anderes Gerät.'));
    const status = el('p', { class: 'muted' }, 'Speicherschutz wird geprüft …');
    sec.append(status);
    requestPersistence().then(ok => {
      status.textContent = ok === true
        ? '✅ Speicher ist geschützt: Das Gerät löscht die Daten nicht von selbst.'
        : ok === false
          ? '⚠️ Speicher ist nicht geschützt. Installiere Ticky als App (Menü ⋮ → „App installieren“) und nimm Ticky in den Akku-Einstellungen vom Energiesparen aus. Exportiere zur Sicherheit ab und zu ein Backup.'
          : 'Speicherschutz wird von diesem Browser nicht gemeldet. Exportiere zur Sicherheit ab und zu ein Backup.';
    });
    const file = el('input', { type: 'file', accept: 'application/json,.json', hidden: true });
    file.addEventListener('change', async () => {
      const f = file.files?.[0];
      file.value = '';
      if (!f) return;
      try {
        if (f.size > 2_000_000) throw new Error('Die Datei ist zu groß für ein Ticky-Backup.');
        const next = parseBackup(await f.text());
        const names = next.children.map(c => c.name).join(', ');
        if (!(await confirmDialog(`Backup mit ${next.children.length} Kind(ern) (${names}) importieren? Der aktuelle Stand wird ersetzt.`, { ok: 'Importieren' }))) return;
        next.setupDone = true;
        replaceState(next);
        close();
        hooks.onImported?.();
        toast('Backup importiert.');
      } catch (e) {
        alertDialog(e.message, { title: 'Import nicht möglich' });
      }
    });
    sec.append(el('div', { class: 'btn-row' },
      el('button', {
        type: 'button', class: 'btn', onclick: () => {
          saveNow();
          const blob = new Blob([exportBackup()], { type: 'application/json' });
          const url = URL.createObjectURL(blob);
          const a = el('a', { href: url, download: `ticky-backup-${localDate()}.json` });
          document.body.append(a);
          a.click();
          a.remove();
          setTimeout(() => URL.revokeObjectURL(url), 2000);
        },
      }, '⬇️ Backup exportieren'),
      el('button', { type: 'button', class: 'btn', onclick: () => file.click() }, '⬆️ Backup importieren'),
      file,
      el('button', {
        type: 'button', class: 'btn btn--danger', onclick: async () => {
          if (!(await confirmDialog('Wirklich alles zurücksetzen? Kinder, Aufgaben, Einstellungen und Figuren werden gelöscht.', { ok: 'Weiter', danger: true }))) return;
          if (!(await confirmDialog('Letzte Warnung: Das kann nicht rückgängig gemacht werden. Alles löschen?', { ok: 'Alles löschen', danger: true }))) return;
          resetAll();
          close();
          hooks.onReset?.();
        },
      }, '🗑️ Alles zurücksetzen')));
    return sec;
  }

  // 7. Info
  function infoSection() {
    return el('section', { class: 'settings-section' },
      el('h3', {}, 'ℹ️ Info'),
      el('p', {}, `Ticky Version ${VERSION}`),
      el('p', { class: 'muted' }, 'Datenschutz: Alle Daten bleiben auf diesem Gerät. Keine Server, kein Tracking, keine Cookies.'),
      REPO_URL ? el('p', {}, el('a', { href: REPO_URL, target: '_blank', rel: 'noopener' }, 'Quellcode auf GitHub')) : null);
  }

  render();
}
