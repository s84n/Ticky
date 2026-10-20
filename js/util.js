// Kleine, DOM-freie Hilfsfunktionen.

/** Lokales Datum als YYYY-MM-DD (bewusst NICHT toISOString – das wäre UTC). */
export function localDate(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Tage zwischen zwei YYYY-MM-DD-Daten (b - a). */
export function daysBetween(a, b) {
  const pa = a.split('-').map(Number);
  const pb = b.split('-').map(Number);
  const ta = Date.UTC(pa[0], pa[1] - 1, pa[2]);
  const tb = Date.UTC(pb[0], pb[1] - 1, pb[2]);
  return Math.round((tb - ta) / 86400000);
}

/** "HH:MM" → Minuten seit Mitternacht; null bei ungültigem Format. */
export function parseTime(str) {
  const m = /^(\d{1,2}):(\d{2})$/.exec(String(str ?? ''));
  if (!m) return null;
  const h = Number(m[1]), min = Number(m[2]);
  if (h > 23 || min > 59) return null;
  return h * 60 + min;
}

export function minutesOfDay(d = new Date()) {
  return d.getHours() * 60 + d.getMinutes();
}

/** Zufalls-ID, z. B. "c_k3j9x". */
export function randomId(prefix) {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  const bytes = new Uint8Array(6);
  globalThis.crypto.getRandomValues(bytes);
  let s = '';
  for (const b of bytes) s += chars[b % chars.length];
  return `${prefix}_${s}`;
}

/** Gleichverteilte Zufallszahl in [0, 1) aus crypto.getRandomValues. */
export function cryptoRandom() {
  const buf = new Uint32Array(1);
  globalThis.crypto.getRandomValues(buf);
  return buf[0] / 4294967296;
}

/** Tiefe Kopie für JSON-artige Daten (structuredClone fehlt z. B. in iOS < 15.4). */
export function deepClone(v) {
  return typeof structuredClone === 'function' ? structuredClone(v) : JSON.parse(JSON.stringify(v));
}

export function pick(arr, rnd = Math.random) {
  return arr[Math.floor(rnd() * arr.length)];
}

export function clamp(v, min, max) {
  return Math.min(max, Math.max(min, v));
}

/** Formatiert Minuten als "2 h 15 min" / "45 min". */
export function formatDuration(totalMin) {
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (h === 0) return `${m} min`;
  if (m === 0) return `${h} h`;
  return `${h} h ${m} min`;
}
