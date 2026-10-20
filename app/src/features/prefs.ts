import { App } from '../core/base';
import { icon, toast, vt } from '../core/dom';
import { LS, buzz } from '../core/helpers';

/* ---------- Privacy mode & density ---------- */
function applyPrefs() {
  const r = document.documentElement;
  r.classList.toggle('privacy', !!LS.get('privacy', false));
  r.classList.toggle('compact', !!LS.get('compact', false));
  drawToggles();
}
export function drawToggles() {
  const p = !!LS.get('privacy', false), c = !!LS.get('compact', false);
  document.querySelectorAll<HTMLElement>('[data-tg=privacy]').forEach(b => { b.classList.toggle('on', p); b.innerHTML = icon(p ? 'eyeoff' : 'eye') + '<span>' + (p ? 'Show amounts' : 'Hide amounts') + '</span>'; b.title = 'Hide or show amounts (P)'; });
  document.querySelectorAll<HTMLElement>('[data-tg=compact]').forEach(b => { b.classList.toggle('on', c); b.innerHTML = icon('density') + '<span>' + (c ? 'Comfortable view' : 'Compact view') + '</span>'; });
}
export function togglePrivacy() {
  const on = !LS.get('privacy', false); LS.set('privacy', on);
  vt('prefs', applyPrefs); buzz(8);
  toast(on ? 'Amounts hidden · press P or hover to peek' : 'Amounts visible');
}
function toggleDensity() { LS.set('compact', !LS.get('compact', false)); vt('prefs', applyPrefs); buzz(8); }
applyPrefs();

/* ---------- While scrolling: lets CSS pause expensive effects (the glass theme's moving light) ---------- */
(function scrollFlag() {
  const root = document.documentElement; let t = 0;
  addEventListener('scroll', () => { if (!t) root.classList.add('scrolling'); clearTimeout(t); t = setTimeout(() => { root.classList.remove('scrolling'); t = 0; }, 160); }, { passive: true, capture: true });
})();

Object.assign(App, {
  togglePrivacy,
  toggleDensity,
  drawToggles,
});
