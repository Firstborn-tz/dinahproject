// js/main.js — the single entry point loaded by index.html.
import { initTheme } from './theme.js';
import { hydrateIcons } from './icons.js';
import { wireAuthModalTriggers, tryAutoLogin, handleAuthUrlErrors } from './auth.js';
import { wireLandingNav, loadPublicSite } from './landing.js';

// Modules that only register inline-onclick handlers on `window` (ui.js,
// auth.js, layout.js and every page file do this themselves) are already
// pulled in through the imports above and through layout.js -> pages.

function hidePageLoader() {
  const el = document.getElementById('page-loader');
  if (!el) return;
  el.classList.add('done');
  setTimeout(() => el.remove(), 400);
}

async function start() {
  initTheme();
  hydrateIcons();
  wireAuthModalTriggers();
  wireLandingNav();

  // Safety net: never leave the user staring at the loader if a request hangs.
  const safety = setTimeout(hidePageLoader, 6000);

  // Public content and session restore run at the same time, not one after
  // the other, so the first screen appears as fast as the slowest single call.
  await Promise.allSettled([loadPublicSite(), tryAutoLogin()]);
  handleAuthUrlErrors();

  clearTimeout(safety);
  hidePageLoader();
}

start();
