// Darstellung einer Figur inkl. Upgrades (Farbe, Turbo, Wachstum, Trick, Verwandlung) und Accessoire –
// für Team, Album, Reveal und Parade.
import { el } from './ui.js';
import { stepsOf, accessoryOf, accessoryById } from './data/progression.js';

/** Stabiler Farbton je Figur für das Farb-Upgrade (90°–270°, damit es sich deutlich vom Original abhebt). */
function hueOf(figId) {
  let h = 0;
  for (const ch of figId) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return 90 + (h % 180);
}

/** Setzt Upgrades, Rarität und Accessoire an einem Figuren-Container (der Container braucht die Klasse .fig). */
export function decorateFigure(node, fig, child) {
  node.dataset.evo = stepsOf(child, fig).join(' ');
  node.dataset.rarity = fig.rarity;
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
