// js/theme.js
import { icon } from './icons.js';

export function initTheme() {
  const saved = localStorage.getItem('dinah_theme'); // 'light' | 'dark' | null (= follow system)
  if (saved) document.documentElement.setAttribute('data-theme', saved);
  updateThemeToggleIcons();
}

export function currentTheme() {
  const attr = document.documentElement.getAttribute('data-theme');
  if (attr) return attr;
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export function toggleTheme() {
  const next = currentTheme() === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', next);
  localStorage.setItem('dinah_theme', next);
  updateThemeToggleIcons();
}

export function updateThemeToggleIcons() {
  const isDark = currentTheme() === 'dark';
  document.querySelectorAll('.theme-toggle').forEach((btn) => { btn.innerHTML = icon(isDark ? 'sun' : 'moon'); });
}
