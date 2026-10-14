// Service-Worker-Registrierung, Update-Hinweis und Install-Banner.
import { el, clear, $ } from './ui.js';
import { toast } from './fx.js';

let deferredPrompt = null;
let onDismiss = () => {};

export function isStandalone() {
  return window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
}

const isIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

export function initPwa({ dismissed }) {
  onDismiss = dismissed;
  window.addEventListener('beforeinstallprompt', e => {
    e.preventDefault();
    deferredPrompt = e;
    const banner = $('#install-banner');
    if (!banner.hidden) renderBanner(); // Fallback-Text durch Button ersetzen
  });
  window.addEventListener('appinstalled', () => { hideBanner(); deferredPrompt = null; });
  registerServiceWorker();
}

function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return;
  if (location.protocol !== 'https:' && location.hostname !== 'localhost' && location.hostname !== '127.0.0.1') return;
  let reloading = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (reloading) return;
    reloading = true;
    location.reload();
  });
  navigator.serviceWorker.register('./sw.js').then(reg => {
    const offer = worker => {
      toast('Neue Version verfügbar', { duration: 0, action: { label: 'Neu laden', onClick: () => worker.postMessage('SKIP_WAITING') } });
    };
    if (reg.waiting && navigator.serviceWorker.controller) offer(reg.waiting);
    reg.addEventListener('updatefound', () => {
      const w = reg.installing;
      w?.addEventListener('statechange', () => {
        if (w.state === 'installed' && navigator.serviceWorker.controller) offer(w);
      });
    });
    // Beim Zurückkehren in die App nach Updates schauen
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') reg.update().catch(() => {}); });
  }).catch(err => console.warn('Ticky: Service Worker nicht registriert', err));
}

/** Zeigt den Install-Hinweis (nicht im Standalone-Modus). */
export function showInstallHint() {
  if (isStandalone()) return;
  const banner = $('#install-banner');
  banner.hidden = false;
  renderBanner();
  if (!deferredPrompt && !isIOS()) setTimeout(() => { if (!banner.hidden) renderBanner(true); }, 3000);
}

function renderBanner(fallback = false) {
  const banner = clear($('#install-banner'));
  const text = el('div', { class: 'install-banner__text' }, el('strong', {}, 'Als App speichern'));
  const actions = el('div', { class: 'btn-row' });
  if (deferredPrompt) {
    text.append('Dann startet Ticky wie eine App und die Daten bleiben sicher gespeichert.');
    actions.append(el('button', {
      type: 'button', class: 'btn btn--primary btn--small', onclick: async () => {
        const p = deferredPrompt;
        deferredPrompt = null;
        p.prompt();
        const choice = await p.userChoice.catch(() => null);
        if (choice?.outcome === 'accepted') hideBanner();
        else renderBanner(true);
      },
    }, 'Installieren'));
  } else if (isIOS()) {
    text.append('Tippe unten auf „Teilen“ ', el('span', { 'aria-hidden': 'true' }, '⬆️'), ' und dann auf „Zum Home-Bildschirm“. So bleiben die Daten dauerhaft erhalten.');
  } else if (fallback) {
    text.append('Öffne das Browser-Menü ⋮ und wähle „App installieren“ bzw. „Zum Startbildschirm hinzufügen“.');
  } else {
    text.append('Einen Moment …');
  }
  banner.append(el('img', { class: 'install-banner__icon', src: './assets/icons/icon-192.png', alt: '' }), text, actions,
    el('button', { type: 'button', class: 'icon-btn icon-btn--plain', 'aria-label': 'Hinweis schließen', onclick: () => { hideBanner(); onDismiss(); } }, '✖️'));
}

function hideBanner() {
  $('#install-banner').hidden = true;
}
