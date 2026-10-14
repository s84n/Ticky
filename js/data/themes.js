// Style-Definitionen. Farben, die JS braucht (Partikel, Flash, Rad); alles Visuelle sonst in css/themes/*.css.
export const THEMES = {
  pixel: {
    id: 'pixel',
    name: 'Pixel-Abenteuer',
    tagline: 'Blöcke, Erz und XP',
    primary: '#5D8C3E',
    primaryDark: '#3E6B24',
    accent: '#F5C542',
    flash: 'rgba(93, 140, 62, .45)',
    particles: { kind: 'blocks', colors: ['#5D8C3E', '#3E6B24', '#8B5A2B', '#7F7F7F', '#A0A0A0', '#F5C542'], emoji: '⛏️' },
    praise: ['Gut gebaut! 🧱', 'Level up! ⬆️', 'Diamant gefunden! 💎', 'Block-Meister! 🟩', 'Episch! ⚡'],
    ambient: ['🌲', '🪨', '🌿', '🪵', '💎', '⚡', '🏔️'],
    avatars: ['⛏️', '🧱', '🌲', '🐷', '💎', '🗡️'],
    wheel: { standard: ['#5D8C3E', '#4A7A30'], magisch: ['#7C5CD6', '#2BB3B1'], legendaer: ['#F5C542', '#E0A21A'] },
  },
  neon: {
    id: 'neon',
    name: 'Neon-Arcade',
    tagline: 'Glow, Combos, Highscore',
    primary: '#00B2FF',
    primaryDark: '#0D0D12',
    accent: '#FFCC00',
    flash: 'rgba(0, 178, 255, .4)',
    particles: { kind: 'shapes', colors: ['#FF3B3B', '#00B2FF', '#FFCC00', '#7CFF6B', '#FF5CF0'], pops: ['GG!', 'WIN!', 'NICE!', 'PRO!'] },
    praise: ['GG! 🎮', 'Epic Win! 🏆', 'Level geschafft! 🎯', 'Highscore! 🕹️', 'Combo! 💥'],
    ambient: ['⭐', '💫', '🎮', '💥', '🔶', '🔷', '🎯', '🌀'],
    avatars: ['🎮', '🤖', '🕹️', '🚀', '👾', '🦖'],
    wheel: { standard: ['#1B2A4A', '#13203A'], magisch: ['#8B3DFF', '#00C2B8'], legendaer: ['#FFCC00', '#F0A500'] },
  },
  zauber: {
    id: 'zauber',
    name: 'Einhorn-Zauber',
    tagline: 'Glitzer, Feen, Regenbogen',
    primary: '#D946EF',
    primaryDark: '#A21CAF',
    accent: '#FBBF24',
    flash: 'rgba(217, 70, 239, .35)',
    particles: { kind: 'emoji', colors: ['#D946EF', '#A78BFA', '#F472B6', '#FBBF24'], emojis: ['✨', '💖', '🌟', '🦄', '🌈', '💫'] },
    praise: ['Zauberhaft! ✨', 'Magisch! 🦄', 'Regenbogen-Power! 🌈', 'Glitzer! 💖', 'Feen-Kraft! 🧚'],
    ambient: ['✨', '⭐', '💫', '🌸', '💖', '🌟', '🦋', '🌈'],
    avatars: ['🦄', '🧚', '🌈', '🦋', '🐱', '🌸'],
    wheel: { standard: ['#F9A8D4', '#F0ABFC'], magisch: ['#8B5CF6', '#2DD4BF'], legendaer: ['#FBBF24', '#F59E0B'] },
  },
};

export const THEME_IDS = Object.keys(THEMES);

export const GENERIC_PRAISE = ['Super! 🌟', 'Toll gemacht! 👍', 'Klasse! 🎉', 'Weiter so! 💪', 'Prima! ✨', 'Bravo! 👏'];

export const SPEECH_ALMOST = [
  '{Name} hat es bald geschafft!',
  'Nur noch eine Aufgabe für {Name}!',
  '{Name}, du schaffst das!',
  'Fast fertig, {Name}!',
];
