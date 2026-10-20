// Leistungsprofil: Schwache Geräte bekommen weniger gleichzeitige Effekte – gleich aussehend, nur sparsamer.
// „lite“ wird beim Start geschätzt (Speicher, Kerne) und zur Laufzeit gesetzt, wenn Effekte spürbar ruckeln.
const KEY = 'ticky-lite';
const listeners = new Set();

function guess() {
  try { if (localStorage.getItem(KEY) === '1') return true; } catch { /* privat/gesperrt */ }
  const mem = navigator.deviceMemory ?? 8;
  const cores = navigator.hardwareConcurrency ?? 8;
  return mem <= 2 || cores <= 4;
}

let lite = guess();
document.documentElement.classList.toggle('lite', lite);

export const isLite = () => lite;

/** Wird aufgerufen, wenn das Gerät im Betrieb überfordert ist. Bleibt für dieses Gerät gespeichert. */
export function degrade() {
  if (lite) return;
  lite = true;
  document.documentElement.classList.add('lite');
  try { localStorage.setItem(KEY, '1'); } catch { /* egal */ }
  for (const fn of listeners) fn();
}

export function onLiteChange(fn) { listeners.add(fn); }

/** Kurven wie CSS cubic-bezier(x1, y1, x2, y2), für Canvas- und JS-Animationen. */
export function bezier(x1, y1, x2, y2) {
  const cx = 3 * x1, bx = 3 * (x2 - x1) - cx, ax = 1 - cx - bx;
  const cy = 3 * y1, by = 3 * (y2 - y1) - cy, ay = 1 - cy - by;
  const sx = t => ((ax * t + bx) * t + cx) * t;
  const sy = t => ((ay * t + by) * t + cy) * t;
  const dx = t => (3 * ax * t + 2 * bx) * t + cx;
  return x => {
    if (x <= 0) return 0;
    if (x >= 1) return 1;
    let t = x;
    for (let i = 0; i < 6; i++) {
      const err = sx(t) - x;
      if (Math.abs(err) < 1e-5) break;
      const d = dx(t);
      if (Math.abs(d) < 1e-6) break;
      t -= err / d;
    }
    if (t < 0 || t > 1) { // Fallback: Bisektion
      let lo = 0, hi = 1; t = x;
      for (let i = 0; i < 20; i++) { if (sx(t) < x) lo = t; else hi = t; t = (lo + hi) / 2; }
    }
    return sy(t);
  };
}

/** Promise, die sicher erfüllt wird, wenn eine Web-Animation endet (auch ohne Animation.finished, mit Zeitlimit). */
export function animationDone(anim, maxMs) {
  return new Promise(resolve => {
    let done = false;
    const end = () => { if (!done) { done = true; resolve(); } };
    if (anim?.finished?.then) anim.finished.then(end, end);
    else if (anim) { anim.onfinish = end; anim.oncancel = end; }
    setTimeout(end, maxMs);
  });
}
