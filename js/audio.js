// Alle Sounds synthetisch über die Web Audio API (keine Audiodateien).
let ctx = null;
let master = null;
let isEnabled = () => true;

export function setSoundEnabledGetter(fn) { isEnabled = fn; }

/** Muss nach einer Nutzergeste aufgerufen werden (Autoplay-Policy). */
export function unlockAudio() {
  try {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = 0.55;
      master.connect(ctx.destination);
    }
    if (ctx.state === 'suspended') ctx.resume();
  } catch { /* kein Audio */ }
}

function ready() {
  return ctx && master && isEnabled() && ctx.state !== 'closed';
}

const NOTE = { C4: 261.63, D4: 293.66, E4: 329.63, F4: 349.23, G4: 392, A4: 440, B4: 493.88, C5: 523.25, D5: 587.33, E5: 659.25, F5: 698.46, G5: 783.99, A5: 880, B5: 987.77, C6: 1046.5, D6: 1174.66, E6: 1318.5, G6: 1567.98, C7: 2093 };

function tone(freq, { at = 0, dur = 0.15, type = 'sine', gain = 0.25, slideTo = null, attack = 0.008, filter = null } = {}) {
  const t0 = ctx.currentTime + at;
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(gain, t0 + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  let out = g;
  if (filter) {
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = filter;
    g.connect(f);
    out = f;
  }
  osc.connect(g);
  out.connect(master);
  osc.start(t0);
  osc.stop(t0 + dur + 0.05);
}

const noiseBuffers = new Map(); // Rauschen je Länge nur einmal erzeugen (Rad-Ticks kommen sehr schnell hintereinander)

function noise({ at = 0, dur = 0.03, gain = 0.15, freq = 3000 } = {}) {
  const t0 = ctx.currentTime + at;
  const len = Math.max(1, Math.floor(ctx.sampleRate * dur));
  let buf = noiseBuffers.get(len);
  if (!buf) {
    buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    noiseBuffers.set(len, buf);
  }
  const src = ctx.createBufferSource();
  src.buffer = buf;
  const f = ctx.createBiquadFilter();
  f.type = 'bandpass';
  f.frequency.value = freq;
  const g = ctx.createGain();
  g.gain.value = gain;
  src.connect(f); f.connect(g); g.connect(master);
  src.start(t0);
}

const seq = (notes, step, opts) => notes.forEach((n, i) => tone(NOTE[n] ?? n, { ...opts, at: (opts?.at ?? 0) + i * step }));

// ---------- Style-Sounds ----------

export function tapSound(theme) {
  if (!ready()) return;
  if (theme === 'pixel') seq(['C5', 'E5', 'G5', 'C6'], 0.055, { type: 'square', dur: 0.08, gain: 0.09 });
  else if (theme === 'neon') { tone(600, { dur: 0.12, slideTo: 1200, gain: 0.2 }); tone(1200, { at: 0.1, dur: 0.18, gain: 0.14 }); }
  else if (theme === 'dino') { tone(150, { dur: 0.16, slideTo: 80, type: 'triangle', gain: 0.35 }); noise({ dur: 0.06, gain: 0.12, freq: 400 }); seq(['G4', 'C5'], 0.08, { at: 0.08, type: 'triangle', dur: 0.15, gain: 0.12 }); }
  else if (theme === 'weltraum') { tone(300, { dur: 0.25, slideTo: 1400, gain: 0.12 }); tone(NOTE.E6, { at: 0.18, dur: 0.2, gain: 0.08, type: 'triangle' }); }
  else if (theme === 'schatz') { tone(NOTE.B5, { dur: 0.07, type: 'square', gain: 0.07 }); tone(NOTE.E6, { at: 0.07, dur: 0.3, type: 'square', gain: 0.07 }); }
  else seq(['C5', 'E5', 'G5', 'C6'], 0.07, { type: 'triangle', dur: 0.35, gain: 0.16 });
}

export function untapSound() {
  if (!ready()) return;
  tone(520, { dur: 0.12, slideTo: 300, type: 'triangle', gain: 0.12 });
}

export function completeSound(theme) {
  if (!ready()) return;
  if (theme === 'pixel') {
    seq(['C5', 'E5', 'G5', 'C6'], 0.09, { type: 'square', dur: 0.12, gain: 0.09 });
    seq(['G5', 'C6'], 0.18, { at: 0.42, type: 'square', dur: 0.35, gain: 0.1 });
  } else if (theme === 'neon') {
    [0, 0.12, 0.24, 0.36].forEach((at, i) => tone(700 + i * 180, { at, dur: 0.15, slideTo: 1400 + i * 200, gain: 0.15 }));
    tone(NOTE.C6, { at: 0.55, dur: 0.5, gain: 0.16, type: 'triangle' });
  } else if (theme === 'dino') {
    for (const at of [0, 0.22, 0.44]) tone(120, { at, dur: 0.2, slideTo: 60, type: 'triangle', gain: 0.4 });
    seq(['C4', 'G4', 'C5', 'E5', 'G5'], 0.1, { at: 0.5, type: 'sawtooth', dur: 0.3, gain: 0.05, filter: 1800 });
  } else if (theme === 'weltraum') {
    tone(200, { dur: 0.9, slideTo: 1600, type: 'sawtooth', gain: 0.04, filter: 2000 });
    seq(['C5', 'G5', 'C6', 'E6', 'G6'], 0.09, { at: 0.5, type: 'sine', dur: 0.5, gain: 0.1 });
  } else if (theme === 'schatz') {
    seq(['B5', 'E6', 'B5', 'E6', 'G6'], 0.08, { type: 'square', dur: 0.12, gain: 0.06 });
    seq(['C5', 'E5', 'G5', 'C6'], 0.12, { at: 0.45, type: 'triangle', dur: 0.4, gain: 0.12 });
  } else {
    seq(['C5', 'E5', 'G5', 'C6', 'E6', 'G6', 'C7'], 0.06, { type: 'sine', dur: 0.6, gain: 0.12 });
    seq(['G5', 'C6'], 0.15, { at: 0.5, type: 'triangle', dur: 0.8, gain: 0.12 });
  }
}

export function tickSound() {
  if (!ready()) return;
  noise({ dur: 0.02, gain: 0.25, freq: 3500 });
  tone(1800, { dur: 0.025, type: 'square', gain: 0.03 });
}

export function whooshSound() {
  if (!ready()) return;
  tone(200, { dur: 0.5, slideTo: 900, type: 'sawtooth', gain: 0.04, filter: 1200 });
}

export function magicSound() {
  if (!ready()) return;
  seq(['E5', 'G5', 'B5', 'D6', 'E6', 'G6'], 0.05, { type: 'sine', dur: 0.7, gain: 0.1 });
  seq(['C6', 'E6', 'G6'], 0.12, { at: 0.35, type: 'triangle', dur: 0.9, gain: 0.08 });
}

/** Orchester-Fanfare (Blechbläser-artige Sägezähne durch Tiefpass + Pauke). */
export function fanfareSound() {
  if (!ready()) return;
  const brass = (n, at, dur) => {
    for (const det of [0, 4]) tone(NOTE[n] * (1 + det / 1200), { at, dur, type: 'sawtooth', gain: 0.06, attack: 0.03, filter: 2400 });
  };
  const chord = (notes, at, dur) => notes.forEach(n => brass(n, at, dur));
  brass('G4', 0, 0.16); brass('G4', 0.18, 0.16); brass('G4', 0.36, 0.16);
  chord(['C5', 'E5', 'G5'], 0.56, 0.55);
  chord(['A4', 'D5', 'F5'], 1.15, 0.25);
  chord(['B4', 'D5', 'G5'], 1.42, 0.25);
  chord(['C5', 'E5', 'G5', 'C6'], 1.72, 1.2);
  for (const at of [0.56, 1.15, 1.72]) tone(70, { at, dur: 0.4, slideTo: 45, gain: 0.35 });
}

export function introJingle(routine) {
  if (!ready()) return;
  if (routine === 'morning') {
    seq(['C5', 'D5', 'E5', 'G5', 'C6'], 0.11, { type: 'triangle', dur: 0.3, gain: 0.13 });
    tone(NOTE.E6, { at: 0.6, dur: 0.5, gain: 0.08 });
  } else {
    seq(['G5', 'E5', 'C5', 'G4'], 0.22, { type: 'sine', dur: 0.7, gain: 0.12 });
  }
}

/** Geheimnisvoller Klang (Ganztonleiter abwärts, dann hell). */
export function mysterySound() {
  if (!ready()) return;
  seq(['C6', 'B5', 'A5', 'G5', 'F5', 'E5'], 0.09, { type: 'sine', dur: 0.5, gain: 0.08 });
  tone(55, { dur: 1.2, type: 'triangle', gain: 0.2 });
  seq(['C6', 'E6', 'G6', 'C7'], 0.08, { at: 0.75, type: 'triangle', dur: 0.8, gain: 0.08 });
}

export function levelUpSound() {
  if (!ready()) return;
  seq(['C5', 'E5', 'G5', 'C6', 'E6', 'G6'], 0.07, { type: 'square', dur: 0.12, gain: 0.05 });
  seq(['C6', 'G6', 'C7'], 0.14, { at: 0.5, type: 'triangle', dur: 0.6, gain: 0.1 });
}

export function revealSound(rarity, theme) {
  if (!ready()) return;
  if (rarity === 'geheim') { mysterySound(); setTimeout(fanfareSound, 1300); }
  else if (rarity === 'mythisch') { fanfareSound(); setTimeout(magicSound, 1900); }
  else if (rarity === 'legendaer') fanfareSound();
  else if (rarity === 'magisch') { magicSound(); setTimeout(() => completeSound(theme), 450); }
  else completeSound(theme);
}

export function wrongSound() {
  if (!ready()) return;
  tone(180, { dur: 0.25, type: 'square', gain: 0.07, filter: 900 });
}

export function popSound() {
  if (!ready()) return;
  tone(900, { dur: 0.08, slideTo: 1500, gain: 0.08 });
}
