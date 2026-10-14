// Sprachansagen (de-DE) über die Speech Synthesis API. Erst nach einer Nutzergeste aktiv.
let isEnabled = () => true;
let voice = null;

export function setSpeechEnabledGetter(fn) { isEnabled = fn; }

function pickVoice() {
  const voices = window.speechSynthesis?.getVoices?.() ?? [];
  const de = voices.filter(v => /^de(-|_|$)/i.test(v.lang));
  voice = de.find(v => /de-DE/i.test(v.lang) && v.localService) ?? de.find(v => /de-DE/i.test(v.lang)) ?? de[0] ?? null;
}

if ('speechSynthesis' in window) {
  pickVoice();
  window.speechSynthesis.addEventListener?.('voiceschanged', pickVoice);
}

export function speak(text) {
  if (!isEnabled() || !('speechSynthesis' in window)) return;
  try {
    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'de-DE';
    if (voice) u.voice = voice;
    u.rate = 1;
    u.pitch = 1.1;
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(u);
  } catch { /* nicht verfügbar */ }
}
