// Eltern-Bereich (⚙️) inkl. Eltern-Sperre.
import { el, clear, openOverlay, confirmDialog, alertDialog } from './ui.js';
import { state, save, saveNow, exportBackup, parseBackup, replaceState, resetAll, removeChild, removeCustomTask, MAX_CHILDREN, requestPersistence } from './store.js';
import { THEMES } from './data/themes.js';
import { ROUTINES, ROUTINE_META } from './data/task-catalog.js';
import { validateTimes, goalOf } from './routine.js';
import { basicsEditor, tasksEditor, newChildDraft, customTaskForm } from './child-editor.js';
import { localDate, cryptoRandom, deepClone, parseTime } from './util.js';
import { wrongSound, popSound } from './audio.js';
import { toast } from './fx.js';
import { VERSION, REPO_URL } from './config.js';
import { levelInfo, BLITZ_XP } from './data/progression.js';

// ---------- Eltern-Sperre ----------

/** Zeigt eine Einmaleins-Aufgabe mit zweistelligem Ergebnis. Promise<boolean>. */
export function parentLock() {
  return new Promise(resolve => {
    let ok = false;
    let a, b, answer = '';
    const q = el('div', { class: 'lock__question', 'aria-live': 'polite' });
    const ans = el('div', { class: 'lock__answer', 'aria-label': 'Deine Antwort' });
    function newQuestion() {
      do {
        a = 2 + Math.floor(cryptoRandom() * 8);
        b = 2 + Math.floor(cryptoRandom() * 8);
      } while (a * b < 10);
      answer = '';
      q.textContent = `${a} × ${b} = ?`;
      ans.textContent = '';
    }
    function press(d) {
      if (answer.length >= 2) return;
      answer += d;
      ans.textContent = answer;
    }
    function submit() {
      if (!answer) return;
      if (Number(answer) === a * b) { ok = true; close(); return; }
      wrongSound();
      ans.classList.remove('is-wrong'); void ans.offsetWidth; ans.classList.add('is-wrong');
      setTimeout(newQuestion, 450);
    }
    const keypad = el('div', { class: 'keypad' });
    for (const d of ['1', '2', '3', '4', '5', '6', '7', '8', '9']) keypad.append(el('button', { type: 'button', onclick: () => press(d) }, d));
    keypad.append(
      el('button', { type: 'button', 'aria-label': 'Löschen', onclick: () => { answer = answer.slice(0, -1); ans.textContent = answer; } }, '⌫'),
      el('button', { type: 'button', onclick: () => press('0') }, '0'),
      el('button', { type: 'button', 'aria-label': 'Bestätigen', style: { background: 'var(--ui-accent)', color: '#fff' }, onclick: submit }, 'OK'));
    const box = el('div', { class: 'dialog lock' },
      el('h2', {}, '🔒 Eltern-Bereich'),
      el('p', { class: 'muted' }, 'Bitte rechne kurz:'),
      q, ans, keypad,
      el('button', { type: 'button', class: 'btn btn--ghost', onclick: () => close() }, 'Abbrechen'));
    box.addEventListener('keydown', e => {
      if (/^\d$/.test(e.key)) { press(e.key); e.preventDefault(); }
      else if (e.key === 'Backspace') { answer = answer.slice(0, -1); ans.textContent = answer; }
      else if (e.key === 'Enter' && e.target.tagName !== 'BUTTON') submit();
    });
    newQuestion();
    const { close } = openOverlay(box, { label: 'Eltern-Sperre', onClose: () => resolve(ok) });
  });
}

// ---------- Eltern-Bereich ----------

/**
 * Öffnet den Eltern-Bereich. hooks: { onChange() – Hauptansicht neu aufbauen, onReset() – zurück ins Onboarding,
 *   onImported() – nach Import neu starten, onSettingsChanged() – Optionen (Bewegung etc.) anwenden }
 */
export function openSettings(hooks) {
  const body = el('div');
  const box = el('div', { class: 'dialog dialog--full' },
    el('div', { class: 'dialog-head' },
      el('h2', {}, '⚙️ Eltern-Bereich'),
      el('button', { type: 'button', class: 'btn', onclick: () => close() }, 'Fertig')),
    body);
  const { close } = openOverlay(box, { label: 'Eltern-Bereich' });

  function render() {
    clear(body);
    body.append(childrenSection(), customSection(), timesSection(), optionsSection(), dataSection(), infoSection());
  }

  function changed() {
    save();
    hooks.onChange?.();
    render();
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
    return sec;
  }

  // 5. Daten
  function dataSection() {
    const sec = el('section', { class: 'settings-section' }, el('h3', {}, '💾 Daten'));
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

  // 6. Info
  function infoSection() {
    return el('section', { class: 'settings-section' },
      el('h3', {}, 'ℹ️ Info'),
      el('p', {}, `Ticky Version ${VERSION}`),
      el('p', { class: 'muted' }, 'Datenschutz: Alle Daten bleiben auf diesem Gerät. Keine Server, kein Tracking, keine Cookies.'),
      REPO_URL ? el('p', {}, el('a', { href: REPO_URL, target: '_blank', rel: 'noopener' }, 'Quellcode auf GitHub')) : null);
  }

  render();
}
