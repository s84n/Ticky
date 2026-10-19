// Ersteinrichtung: Willkommen → Kinder anlegen → Aufgaben je Kind → Fertig.
import { el, clear, $, confirmDialog, alertDialog } from './ui.js';
import { THEMES } from './data/themes.js';
import { MAX_CHILDREN, sanitizeName, parseBackup } from './store.js';
import { newChildDraft, basicsEditor, tasksEditor } from './child-editor.js';
import { unlockAudio, popSound } from './audio.js';

/**
 * Startet das Onboarding im Screen-Element. onDone({ children, customTasks }) wird am Ende aufgerufen,
 * onRestore(state) nach dem Wiederherstellen eines Backups.
 */
export function startOnboarding(onDone, { onRestore } = {}) {
  const screen = $('#screen-onboarding');
  const drafts = [newChildDraft(0)];
  const customTasks = {};
  let step = 'welcome';
  let taskIndex = 0;

  const totalSteps = () => 2 + drafts.length + 1;
  const stepNo = () => step === 'welcome' ? 0 : step === 'children' ? 1 : step === 'tasks' ? 2 + taskIndex : totalSteps() - 1;

  function go(next) {
    step = next;
    render();
    window.scrollTo({ top: 0, behavior: 'instant' in window ? 'instant' : 'auto' });
  }

  function progressDots() {
    const wrap = el('div', { class: 'onb-steps', 'aria-hidden': 'true' });
    for (let i = 0; i < totalSteps(); i++) wrap.append(el('span', { class: i <= stepNo() ? 'is-on' : '' }));
    return wrap;
  }

  function render() {
    clear(screen);
    const root = el('div', { class: 'onb' });
    screen.append(root);
    if (step === 'welcome') renderWelcome(root);
    else if (step === 'children') renderChildren(root);
    else if (step === 'tasks') renderTasks(root);
    else renderDone(root);
  }

  function renderWelcome(root) {
    root.append(el('div', { class: 'onb-hero' },
      el('div', { class: 'onb-logo', 'aria-hidden': 'true' }, '✅'),
      el('h1', { class: 'onb-title', id: 'onb-title' }, 'Willkommen bei Ticky!'),
      el('p', { class: 'onb-lead' }, 'Lege fest, welche Kinder mitmachen – alles bleibt nur auf diesem Gerät.'),
      el('button', { type: 'button', class: 'btn btn--primary btn--big', autofocus: true, onclick: () => { unlockAudio(); popSound(); go('children'); } }, "Los geht's 🚀"),
      onRestore ? restoreButton() : null));
  }

  function restoreButton() {
    const file = el('input', { type: 'file', accept: 'application/json,.json', hidden: true });
    file.addEventListener('change', async () => {
      const f = file.files?.[0];
      file.value = '';
      if (!f) return;
      try {
        if (f.size > 2_000_000) throw new Error('Die Datei ist zu groß für ein Ticky-Backup.');
        const next = parseBackup(await f.text());
        const names = next.children.map(c => c.name).join(', ');
        if (!(await confirmDialog(`Backup mit ${next.children.length} Kind(ern) (${names}) wiederherstellen?`, { ok: 'Wiederherstellen' }))) return;
        onRestore(next);
      } catch (e) {
        alertDialog(e.message, { title: 'Wiederherstellen nicht möglich' });
      }
    });
    return el('div', {},
      el('button', { type: 'button', class: 'btn', onclick: () => file.click() }, '⬆️ Backup wiederherstellen'),
      file);
  }

  function renderChildren(root) {
    root.append(progressDots(), el('h1', { class: 'onb-title', id: 'onb-title', style: { fontSize: '1.8rem', textAlign: 'center' } }, 'Wer macht mit?'));
    const editors = [];
    drafts.forEach((d, i) => {
      const others = () => drafts.filter(x => x !== d).map(x => sanitizeName(x.name)).filter(Boolean);
      const ed = basicsEditor(d, { allNames: others });
      editors.push(ed);
      root.append(el('section', { class: 'onb-panel', 'aria-label': `Kind ${i + 1}` },
        el('div', { class: 'onb-panel__head' },
          el('h2', {}, `Kind ${i + 1}`),
          drafts.length > 1 ? el('button', { type: 'button', class: 'icon-btn', 'aria-label': `Kind ${i + 1} entfernen`, title: 'Entfernen', onclick: () => { drafts.splice(i, 1); render(); } }, '🗑️') : null),
        ed.root));
    });
    const full = drafts.length >= MAX_CHILDREN;
    root.append(el('button', {
      type: 'button', class: 'add-child', disabled: full,
      onclick: () => {
        drafts.push(newChildDraft(drafts.length));
        render();
        const panels = screen.querySelectorAll('.onb-panel');
        panels[panels.length - 1]?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        panels[panels.length - 1]?.querySelector('input')?.focus({ preventScroll: true });
      },
    }, full ? 'Maximal 5 Kinder' : '＋ Kind hinzufügen'));

    root.append(el('div', { class: 'onb-nav' },
      el('button', { type: 'button', class: 'btn btn--ghost', onclick: () => go('welcome') }, '← Zurück'),
      el('button', {
        type: 'button', class: 'btn btn--primary', onclick: () => {
          const bad = editors.map(e => e.validate()).findIndex(ok => !ok);
          if (bad >= 0) { editors[bad].focus(); return; }
          taskIndex = 0;
          go('tasks');
        },
      }, 'Weiter →')));
    if (drafts.length === 1 && !drafts[0].name) requestAnimationFrame(() => editors[0].focus());
  }

  function renderTasks(root) {
    const d = drafts[taskIndex];
    root.append(progressDots());
    const ed = tasksEditor(d, { customTasks, siblings: () => drafts });
    root.append(el('section', { class: 'onb-panel', 'data-theme': d.theme },
      el('div', { class: 'onb-panel__head' },
        el('span', { class: 'emoji', style: { fontSize: '2rem' }, 'aria-hidden': 'true' }, d.avatar),
        el('h2', { id: 'onb-title' }, `Aufgaben für ${d.name}`)),
      el('p', { class: 'muted' }, 'Wähle aus, was morgens und abends zu tun ist, und bring die Aufgaben in die richtige Reihenfolge.'),
      ed.root));
    root.append(el('div', { class: 'onb-nav' },
      el('button', { type: 'button', class: 'btn btn--ghost', onclick: () => { if (taskIndex > 0) { taskIndex--; go('tasks'); } else go('children'); } }, '← Zurück'),
      el('button', {
        type: 'button', class: 'btn btn--primary', onclick: () => {
          if (!ed.validate()) return;
          if (taskIndex < drafts.length - 1) { taskIndex++; go('tasks'); } else go('done');
        },
      }, 'Weiter →')));
  }

  function renderDone(root) {
    root.append(progressDots(), el('div', { class: 'onb-hero', style: { paddingTop: '2vh' } },
      el('div', { class: 'onb-logo', 'aria-hidden': 'true' }, '🎉'),
      el('h1', { class: 'onb-title', id: 'onb-title' }, 'Alles bereit!'),
      el('div', { class: 'summary-chips' }, ...drafts.map(d => el('div', { class: 'summary-chip', 'data-theme': d.theme },
        el('span', { class: 'emoji', 'aria-hidden': 'true' }, d.avatar),
        el('span', {}, d.name)))),
      el('p', { class: 'onb-lead' }, 'Im Eltern-Bereich (⚙️) kannst du später alles ändern – Kinder, Aufgaben und Zeiten.'),
      el('div', { class: 'btn-row', style: { justifyContent: 'center' } },
        el('button', { type: 'button', class: 'btn btn--ghost', onclick: () => { taskIndex = drafts.length - 1; go('tasks'); } }, '← Zurück'),
        el('button', {
          type: 'button', class: 'btn btn--primary btn--big', autofocus: true,
          onclick: () => {
            unlockAudio();
            const children = drafts.map(d => ({ ...d, name: sanitizeName(d.name), avatar: d.avatar || THEMES[d.theme].avatars[0] }));
            onDone({ children, customTasks });
          },
        }, 'Starten 🚀'))));
  }

  screen.hidden = false;
  render();
}
