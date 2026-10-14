// DOM-Helfer und Overlay-Verwaltung (Fokus-Falle, Escape, Zurück-Geste).
// Nutzereingaben werden ausschließlich über textContent/DOM-APIs gerendert (R-7).

/**
 * Baut ein Element. attrs: Attribute/Properties; on*: Event-Listener; children: Strings werden zu Textknoten.
 * Beispiel: el('button', { class: 'btn', onclick: fn }, 'Text')
 */
export function el(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs ?? {})) {
    if (v === null || v === undefined || v === false) continue;
    if (k.startsWith('on') && typeof v === 'function') node.addEventListener(k.slice(2), v);
    else if (k === 'class') node.className = v;
    else if (k === 'style' && typeof v === 'object') {
      for (const [prop, val] of Object.entries(v)) {
        if (prop.startsWith('--')) node.style.setProperty(prop, val);
        else node.style[prop] = val;
      }
    }
    else if (k === 'dataset') Object.assign(node.dataset, v);
    else if (k === 'text') node.textContent = v;
    else if (v === true) node.setAttribute(k, '');
    else node.setAttribute(k, String(v));
  }
  append(node, children);
  return node;
}

function append(node, children) {
  for (const c of children.flat(Infinity)) {
    if (c === null || c === undefined || c === false) continue;
    node.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
}

export function clear(node) {
  node.replaceChildren();
  return node;
}

export const $ = (sel, root = document) => root.querySelector(sel);

/** Erzeugt SVG-Elemente (für Rad, Sterne, Häkchen). */
export function svg(tag, attrs = {}, ...children) {
  const node = document.createElementNS('http://www.w3.org/2000/svg', tag);
  for (const [k, v] of Object.entries(attrs)) if (v !== null && v !== undefined) node.setAttribute(k, String(v));
  for (const c of children.flat()) if (c) node.append(c);
  return node;
}

export function vibrate(ms, settings) {
  if (settings && !settings.vibration) return;
  try { navigator.vibrate?.(ms); } catch { /* iOS: nicht unterstützt */ }
}

// ---------- Overlays ----------

const stack = [];
// Für die Zurück-Geste halten wir höchstens einen eigenen History-Eintrag vor. Programmatisches Schließen ruft
// bewusst kein history.back() auf (das ist asynchron und kollidiert mit direkt folgendem pushState).
let spareEntry = false;
function ensureHistoryEntry() {
  if (!spareEntry) { history.pushState({ tickyOverlay: true }, ''); spareEntry = true; }
}

const FOCUSABLE = 'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Öffnet ein Overlay. content: Element im Dialog. Gibt { overlay, close } zurück.
 * opts: label, className (Overlay), dismissible (Escape/Zurück/Klick daneben), onClose(reason), theme
 */
export function openOverlay(content, opts = {}) {
  const { label = '', className = '', dismissible = true, onClose, theme, backdropClose = dismissible } = opts;
  const overlay = el('div', { class: `overlay ${className}`, role: 'dialog', 'aria-modal': 'true', 'aria-label': label || null, 'data-theme': theme || null });
  overlay.append(content);
  document.getElementById('overlays').append(overlay);
  const prevFocus = document.activeElement;

  const entry = { overlay, dismissible, closed: false, onClose, prevFocus };
  stack.push(entry);
  ensureHistoryEntry();

  if (backdropClose) {
    overlay.addEventListener('pointerdown', e => { if (e.target === overlay) entry.backdropDown = true; });
    overlay.addEventListener('click', e => { if (e.target === overlay && entry.backdropDown) close('backdrop'); entry.backdropDown = false; });
  }

  requestAnimationFrame(() => {
    const first = overlay.querySelector('[autofocus]') ?? overlay.querySelector(FOCUSABLE);
    (first ?? overlay).focus?.({ preventScroll: true });
  });

  function close(reason = 'code') {
    if (entry.closed) return;
    entry.closed = true;
    const i = stack.indexOf(entry);
    if (i >= 0) stack.splice(i, 1);
    overlay.classList.add('is-closing');
    setTimeout(() => overlay.remove(), 180);
    try { prevFocus?.focus?.({ preventScroll: true }); } catch { /* egal */ }
    onClose?.(reason);
  }
  entry.close = close;
  return { overlay, close, setDismissible: v => { entry.dismissible = v; } };
}

export function topOverlay() {
  return stack[stack.length - 1] ?? null;
}

window.addEventListener('popstate', () => {
  spareEntry = false;
  const top = topOverlay();
  if (!top) return;
  if (top.dismissible) top.close('back');
  if (stack.length) ensureHistoryEntry(); // weitere (oder nicht schließbare) Overlays offen
});

document.addEventListener('keydown', e => {
  const top = topOverlay();
  if (!top) return;
  if (e.key === 'Escape' && top.dismissible) { e.preventDefault(); top.close('escape'); return; }
  if (e.key === 'Tab') {
    const items = [...top.overlay.querySelectorAll(FOCUSABLE)].filter(n => n.offsetParent !== null || n === document.activeElement);
    if (!items.length) { e.preventDefault(); return; }
    const first = items[0], last = items[items.length - 1];
    if (!top.overlay.contains(document.activeElement)) { e.preventDefault(); first.focus(); }
    else if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  }
});

/** Bestätigungsdialog. Gibt Promise<boolean> zurück. */
export function confirmDialog(message, { ok = 'Ja', cancel = 'Abbrechen', danger = false, title = null } = {}) {
  return new Promise(resolve => {
    let result = false;
    const okBtn = el('button', { type: 'button', class: `btn ${danger ? 'btn--danger' : 'btn--primary'}`, onclick: () => { result = true; close(); } }, ok);
    const box = el('div', { class: 'dialog' },
      title ? el('h2', {}, title) : null,
      el('p', { class: 'confirm-text' }, message),
      el('div', { class: 'btn-row btn-row--end' },
        el('button', { type: 'button', class: 'btn btn--ghost', onclick: () => close() }, cancel),
        okBtn));
    const { close } = openOverlay(box, { label: title ?? message, onClose: () => resolve(result) });
    requestAnimationFrame(() => okBtn.focus());
  });
}

/** Einfacher Hinweisdialog. */
export function alertDialog(message, { title = null, ok = 'OK' } = {}) {
  return new Promise(resolve => {
    const box = el('div', { class: 'dialog' },
      title ? el('h2', {}, title) : null,
      el('p', { class: 'confirm-text' }, message),
      el('div', { class: 'btn-row btn-row--end' }, el('button', { type: 'button', class: 'btn btn--primary', autofocus: true, onclick: () => close() }, ok)));
    const { close } = openOverlay(box, { label: title ?? message, onClose: () => resolve() });
  });
}

/** Gold-Stern als Häkchen-Symbol. */
export function starIcon() {
  return svg('svg', { viewBox: '0 0 24 24', 'aria-hidden': 'true' },
    svg('path', { d: 'M12 1.8l3.1 6.4 7 1-5.1 4.9 1.2 7-6.2-3.3-6.2 3.3 1.2-7L1.9 9.2l7-1z', fill: '#FFC93C', stroke: '#E09A00', 'stroke-width': '1.2', 'stroke-linejoin': 'round' }));
}
