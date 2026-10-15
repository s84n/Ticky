// Darstellung einer Figur inkl. Aufwertung (Bronze/Silber/Gold) und Accessoire – für Welt, Buddy, Reveal und Parade.
import { el } from './ui.js';
import { tierOf, accessoryOf, accessoryById } from './data/progression.js';

/** Setzt Stufe, Rarität und Accessoire an einem Figuren-Container (der Container braucht die Klasse .fig). */
export function decorateFigure(node, fig, child) {
  const tier = child ? tierOf(child, fig.id) : 0;
  node.dataset.tier = String(tier);
  node.dataset.rarity = fig.rarity;
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
