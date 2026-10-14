// Standard-Aufgabenkatalog.
// morning/evening: true = vorausgewählt, false = verfügbar, undefined = in dieser Routine nicht angeboten.
export const TASK_CATALOG = [
  { id: 'umziehen',      icon: '👕', label: 'Umziehen',                      morning: true,  evening: true },
  { id: 'waesche',       icon: '🧺', label: 'Wäsche wegbringen',             morning: true,  evening: true },
  { id: 'toilette',      icon: '🚽', label: 'Toilette',                      morning: true,  evening: true },
  { id: 'waschen',       icon: '🧼', label: 'Hände & Gesicht waschen',       morning: true,  evening: true },
  { id: 'zaehne',        icon: '🪥', label: 'Zähneputzen',                   morning: true,  evening: true },
  { id: 'trinken',       icon: '🥛', label: 'Etwas trinken',                                 evening: true },
  { id: 'musik',         icon: '🎵', label: 'Musik / Hörspiel an',                           evening: true },
  { id: 'nachtlicht',    icon: '🌙', label: 'Nachtlicht an',                                 evening: true },
  { id: 'fruehstueck',   icon: '🥣', label: 'Frühstücken',                   morning: false },
  { id: 'haare',         icon: '🪮', label: 'Haare kämmen',                  morning: false },
  { id: 'bett',          icon: '🛏️', label: 'Bett machen',                   morning: false },
  { id: 'schulranzen',   icon: '🎒', label: 'Schulranzen packen',            morning: false, evening: false },
  { id: 'kleidung_raus', icon: '👖', label: 'Kleidung für morgen rauslegen',                 evening: false },
  { id: 'zimmer',        icon: '🧸', label: 'Spielzeug aufräumen',                           evening: false },
  { id: 'lesen',         icon: '📖', label: 'Lesen / Vorlesen',                              evening: false },
  { id: 'duschen',       icon: '🚿', label: 'Baden / Duschen',                               evening: false },
  { id: 'medizin',       icon: '💊', label: 'Medizin / Vitamine',            morning: false, evening: false },
  { id: 'sonnencreme',   icon: '🧴', label: 'Eincremen',                     morning: false },
  { id: 'schuhe',        icon: '👟', label: 'Schuhe & Jacke anziehen',       morning: false },
  { id: 'tisch',         icon: '🍽️', label: 'Tisch abräumen',                                evening: false },
];

export const ROUTINES = ['morning', 'evening'];

export const ROUTINE_META = {
  morning: { label: 'Morgen', title: 'Morgenroutine', emoji: '☀️' },
  evening: { label: 'Abend', title: 'Abendroutine', emoji: '🌙' },
};

// Emoji-Auswahl für eigene Aufgaben
export const CUSTOM_TASK_EMOJIS = [
  '🐶', '🐱', '🐟', '🐹', '🌱', '🪴', '🧹', '🧽', '🗑️', '🍎',
  '🥕', '🍌', '🥪', '💧', '🧃', '🎻', '🎹', '🎸', '⚽', '🚲',
  '✏️', '📚', '🖍️', '🧩', '🎨', '🧦', '🧢', '🧤', '🧣', '🩲',
  '👓', '🦷', '💤', '🛁', '🙏', '🤗', '📅', '⏰', '🎒', '⭐',
];

export function catalogTasksFor(routine) {
  return TASK_CATALOG.filter(t => t[routine] !== undefined);
}

export function defaultTaskSelection() {
  const sel = {};
  for (const r of ROUTINES) sel[r] = TASK_CATALOG.filter(t => t[r] === true).map(t => t.id);
  return sel;
}
