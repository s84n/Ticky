// Darstellung einer Figur inkl. Upgrades (Farbe, Turbo, Wachstum, Trick, Verwandlung), Stern-Effekten und Accessoire –
// für Team, Album, Reveal und Parade.
import { el } from './ui.js';
import { stepsOf, perksOf, accessoryOf, accessoryById } from './data/progression.js';

/** Stabiler Farbton je Figur für das Farb-Upgrade (90°–270°, damit es sich deutlich vom Original abhebt). */
function hueOf(figId) {
  let h = 0;
  for (const ch of figId) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return 90 + (h % 180);
}

/**
 * Figuren mit kaum Farbe (gemessen: unter 40 % kräftige Pixel). Farbton drehen ändert an Weiß, Grau und Schwarz nichts:
 * Helle werden deshalb eingefärbt, dunkle bekommen zusätzlich einen farbigen Schein.
 */
const PALE = new Set(['pixel_02', 'pixel_03', 'pixel_06', 'dino_03', 'dino_12', 'zauber_01', 'zauber_04', 'zauber_07', 'weltraum_02', 'neon_06', 'schatz_06']);
const DARK = new Set(['neon_12', 'weltraum_12']);

/**
 * Ebenen für die Stern-Effekte. Schimmer und Regenbogen liegen über der Figur und sind per Maske auf ihre Form
 * zugeschnitten. base.css blendet jede Ebene nur ein, wenn ihr Effekt in data-perks steht.
 */
const PERK_LAYERS = { glitzer: 'fig__twinkle', schimmer: 'fig__fx fig__shine', begleiter: 'fig__orbit', regenbogen: 'fig__fx fig__rainbow' };

/** Setzt Upgrades, Sterne, Rarität und Accessoire an einem Figuren-Container (der Container braucht die Klasse .fig). */
export function decorateFigure(node, fig, child) {
  node.dataset.evo = stepsOf(child, fig).join(' ');
  const perks = child ? perksOf(child, fig.id) : [];
  node.dataset.perks = perks.join(' ');
  // Absolut: Eine relative url() in einer CSS-Variablen würde relativ zu css/base.css aufgelöst
  if (perks.length) node.style.setProperty('--mask', `url("${new URL(fig.svg, document.baseURI).href}")`);
  node.querySelectorAll(':scope > .fig__perk').forEach(n => n.remove());
  for (const id of perks) if (PERK_LAYERS[id]) node.append(el('span', { class: `fig__perk ${PERK_LAYERS[id]}`, 'aria-hidden': 'true' }));
  node.dataset.rarity = fig.rarity;
  if (PALE.has(fig.id)) node.dataset.tint = 'pale';
  else if (DARK.has(fig.id)) node.dataset.tint = 'dark';
  node.style.setProperty('--hue', `${hueOf(fig.id)}deg`);
  node.style.setProperty('--hx', `${fig.head[0]}%`);
  node.style.setProperty('--hy', `${fig.head[1]}%`);
  node.querySelector(':scope > .fig__acc')?.remove();
  const acc = child ? accessoryById(accessoryOf(child, fig.id)) : null;
  if (acc) node.append(el('span', { class: 'fig__acc', 'aria-hidden': 'true' }, acc.icon));
  return node;
}

/** <div class="fig"> mit <img> der Figur. opts: { className, alt, silhouette } */
export function figureView(fig, child, { className = '', alt = fig.name, silhouette = false } = {}) {
  const node = el('div', { class: `fig ${className}`.trim(), 'data-motion': fig.motion },
    el('img', { class: 'fig__img', src: fig.svg, alt: silhouette ? '' : alt, draggable: 'false' }));
  if (silhouette) node.classList.add('is-silhouette');
  return silhouette ? node : decorateFigure(node, fig, child);
}

/**
 * Enthüllung eines Upgrades oder Sterns: Die Figur erscheint erst im alten Look und wechselt dann sichtbar in den neuen
 * (neue Farbe blendet über, Turbo flitzt, Wachstum wächst, Schimmer setzt ein …). key: 'evo' (Upgrade) oder 'perks' (Stern).
 * Gibt eine Funktion zum Abbrechen zurück.
 */
export function playUpgrade(node, step, delay = 900, key = 'evo') {
  const full = node.dataset[key];
  node.dataset[key] = full.split(' ').filter(s => s !== step).join(' ');
  node.dataset.new = step;
  const t = setTimeout(() => {
    node.dataset[key] = full;
    node.classList.add('is-upgraded');
    if (step === 'tempo') node.classList.add('is-dashing');
  }, delay);
  return () => clearTimeout(t);
}
