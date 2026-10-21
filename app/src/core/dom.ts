import { html, htmlList } from './html';
import { App, S, el, fmtDate, monthRange, today } from './base';

/* ================= UI plumbing ================= */
const ICONS = {
  overview: html`<path d="M3 12l9-8 9 8M5 10v10h14V10"/>`,
  transactions: html`<path d="M4 7h13M13 3l4 4-4 4M20 17H7M11 13l-4 4 4 4"/>`,
  accounts: html`<rect x="3" y="6" width="18" height="13" rx="2"/><path d="M3 10h18M7 15h3"/>`,
  budgets: html`<circle cx="12" cy="12" r="9"/><path d="M12 3v9l6 5"/>`,
  categories: html`<path d="M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z"/>`,
  bills: html`<path d="M6 3h12v18l-3-2-3 2-3-2-3 2zM9 8h6M9 12h6"/>`,
  forecast: html`<path d="M3 17l6-6 4 4 8-8M15 7h6v6"/>`,
  inbox: html`<path d="M22 12h-6l-2 3h-4l-2-3H2M5.5 5h13L22 12v6a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2v-6z"/>`,
  loans: html`<path d="M12 2v20M17 6H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>`,
  recurring: html`<path d="M17 2l3 3-3 3M4 11V9a4 4 0 0 1 4-4h12M7 22l-3-3 3-3M20 13v2a4 4 0 0 1-4 4H4"/>`,
  rules: html`<path d="M4 6h10M4 12h16M4 18h7M17 4v4M11 16v4"/>`,
  reports: html`<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>`,
  settings: html`<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>`,
  piggy: html`<path d="M5 11a7 6 0 0 1 13-2h2v4l-2 1-1 4h-3v-2h-4v2H7l-1-4a5 5 0 0 1-1-3z"/><circle cx="15" cy="11" r=".6"/>`,
  search: html`<circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4"/>`,
  spark: html`<path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8zM19 16l.8 2.2L22 19l-2.2.8L19 22l-.8-2.2L16 19l2.2-.8z"/>`,
  eye: html`<path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>`,
  eyeoff: html`<path d="M3 3l18 18M10.6 5.1A10.4 10.4 0 0 1 12 5c6.4 0 10 7 10 7a17 17 0 0 1-3.2 4.2M6.6 6.6C3.8 8.3 2 12 2 12s3.6 7 10 7c1.6 0 3-.4 4.3-1M9.9 9.9a3 3 0 0 0 4.2 4.2"/>`,
  density: html`<path d="M4 6h16M4 10h16M4 14h16M4 18h16"/>`,
};
export const icon = k => html`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${ICONS[k]}</svg>`;
export const NAV = [['', 'Overview', 'overview'], ['forecast', 'Forecast', 'forecast'], ['transactions', 'Transactions', 'transactions'], ['inbox', 'Categorize', 'inbox'],
  ['accounts', 'Accounts', 'accounts'], ['loans', 'Loan planner', 'loans'],
  ['budgets', 'Budgets', 'budgets'], ['categories', 'Categories & tags', 'categories'], ['bills', 'Bills', 'bills'], ['recurring', 'Recurring', 'recurring'],
  ['piggy', 'Piggy banks', 'piggy'], ['rules', 'Rules', 'rules'], ['reports', 'Reports', 'reports'], ['settings', 'Settings', 'settings']];
export function drawNav(active) {
  el('nav').innerHTML = String(htmlList(NAV.map(([r, label, ic]) => html`<a href="#/${r}" class="${r === active ? 'on' : ''}" data-onmouseenter="App.prefetch('${r}')">${icon(ic)}<span>${label}</span></a>`)));
  if (window.App && App.drawTabbar) App.drawTabbar(active);
}
let toastTimer;
export function toast(msg) {
  const t = el('toast'); t.textContent = msg; t.classList.add('show');
  clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove('show'), 2600);
}
export function confirmBox(title, text, okLabel = 'Delete') {
  return new Promise(res => {
    const d = el<HTMLDialogElement>('confirm');
    d.innerHTML = String(html`<h3>${title}</h3><p>${text}</p><div class="btns"><button class="btn" value="no">Cancel</button><button class="btn primary" value="yes">${okLabel}</button></div>`);
    d.querySelectorAll('button').forEach(b => b.onclick = () => { d.close(); res(b.value === 'yes'); });
    d.oncancel = () => res(false);
    d.showModal();
  });
}

/* ---------- View Transitions (animated morphs between states) ---------- */
export const VT_OK = !!document.startViewTransition && !(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
// Run a DOM update inside a view transition. kind sets a class on <html> so CSS can pick the animation.
export function vt(kind, update, setup?) {
  if (!VT_OK || document.hidden) { update(); return null; }
  const root = document.documentElement;
  if (S.vtRun) { try { S.vtRun.skipTransition(); } catch (e) { /* already done */ } }
  root.classList.add('vt-' + kind);
  if (setup) setup();
  let t;
  try { t = document.startViewTransition(update); } catch (e) { root.classList.remove('vt-' + kind); update(); return null; }
  S.vtRun = t;
  // The browser may skip or abort a transition (a newer one starts, the viewport or scrollbar changes size...).
  // The DOM update still happens, so that's expected, not an error. A real error in the update itself still surfaces.
  const quiet = () => {};
  t.ready.catch(quiet);
  t.updateCallbackDone.catch(e => { if (!(e instanceof DOMException)) setTimeout(() => { throw e; }); });
  t.finished.catch(quiet).then(() => { root.classList.remove('vt-' + kind); if (S.vtRun === t) S.vtRun = null; document.querySelectorAll<HTMLElement>('[data-vtn]').forEach(n => { n.style.viewTransitionName = ''; delete n.dataset.vtn; }); });
  return t;
}
export const vtName = (node, name) => { if (node) { node.style.viewTransitionName = name; node.dataset.vtn = '1'; } };
// Drawer header "hero": the transaction's avatar, payee and amount, so the row can morph into it
function drawerHeroHtml(h) {
  return html`<div class="dhero" data-id="${h.id}">${h.av}<div class="dh-txt"><div class="eyebrow">${h.kicker}</div><h2>${h.name}</h2><div class="sub-s num">${h.amount} · ${fmtDate(h.date)}</div></div></div>`;
}
export function openDrawer(title, bodyHtml, footHtml?) {
  const d = el('drawer'), wasOpen = d.classList.contains('open');
  S.drawerTok = (S.drawerTok || 0) + 1;
  let h = S.drawerHero;
  if (h && !(title === 'Loading…' || title === 'Transaction' || (S.form && S.form.id === h.id))) h = S.drawerHero = null;
  const keep = h && wasOpen && d.querySelector('.dhero[data-id="' + h.id + '"]');
  if (keep) {       // same transaction: keep the header node (it may be mid-animation) and swap the rest
    if (title !== 'Loading…') keep.querySelector('.eyebrow').textContent = title;
    d.querySelectorAll(':scope > .body, :scope > footer').forEach(n => n.remove());
    d.insertAdjacentHTML('beforeend', String(html`<div class="body" id="drawerBody">${bodyHtml}</div>${footHtml ? html`<footer>${footHtml}</footer>` : ''}`));
    return;
  }
  d.innerHTML = String(html`<div class="grab" aria-hidden="true"></div><header>${h ? drawerHeroHtml({ ...h, kicker: title === 'Loading…' ? h.kicker : title }) : html`<h2>${title}</h2>`}<button class="round" type="button" data-onclick="App.closeDrawer()" aria-label="Close">×</button></header><div class="body" id="drawerBody">${bodyHtml}</div>${footHtml ? html`<footer>${footHtml}</footer>` : ''}`);
  if (!wasOpen) S.drawerReturn = document.activeElement;
  d.setAttribute('aria-label', title === 'Loading…' && h ? h.name : title);
  d.classList.add('open'); d.setAttribute('aria-hidden', 'false'); el('scrim').classList.add('open');
  if (!wasOpen) setTimeout(() => { const f = d.querySelector<HTMLElement>('input:not([type=hidden]):not([type=checkbox]):not([type=date]), select'); if (f && innerWidth > 900) f.focus(); }, 280);
}
export function closeDrawer() {
  const d = el('drawer'), h = S.drawerHero;
  S.form = null; S.drawerHero = null;
  const row = h && d.classList.contains('open') && VT_OK && document.querySelector<HTMLElement>('#view tr[data-gid="' + h.id + '"] .av');
  const my = S.drawerTok = (S.drawerTok || 0) + 1;
  const shut = () => {
    if (S.drawerTok !== my) return;
    d.classList.remove('open'); d.setAttribute('aria-hidden', 'true'); el('scrim').classList.remove('open');
    const back = S.drawerReturn; S.drawerReturn = null;
    if (back && back.isConnected && back.focus && d.contains(document.activeElement)) back.focus({ preventScroll: true });
  };
  if (!row) return shut();
  // Morph the drawer's avatar back into its row while the drawer slides away
  vt('drawer-close', () => { const dav = d.querySelector<HTMLElement>('.dhero .av'); if (dav) dav.style.viewTransitionName = ''; shut(); vtName(row, 'txav'); },
    () => vtName(d.querySelector('.dhero .av'), 'txav'));
}
export function formError(msg) {
  const b = el('drawerBody'); if (!b) return toast(msg);
  let e = b.querySelector('.form-err');
  if (!e) { e = document.createElement('div'); e.className = 'form-err'; b.prepend(e); }
  e.textContent = msg; b.scrollTop = 0;
}
export function monthNav() {
  if (S.all) return html`<div class="month"><span>All time</span><button class="btn small" style="margin-left:6px" data-onclick="App.thisMonth()">By month</button></div>`;
  const r = monthRange(S.y, S.m);
  const ahead = (S.y - today.getFullYear()) * 12 + (S.m - today.getMonth());
  const isNow = ahead >= 12;   // allow planning up to a year ahead
  return html`<div class="month"><button class="round" data-onclick="App.shiftMonth(-1)" aria-label="Previous month">‹</button><span>${r.label}</span><button class="round" data-onclick="App.shiftMonth(1)" aria-label="Next month"${isNow ? ' disabled' : ''}>›</button>${ahead !== 0 ? html`<button class="btn small" style="margin-left:6px" data-onclick="App.thisMonth()">Today</button>` : ''}<button class="btn small" style="margin-left:6px" data-onclick="App.allTime()">All time</button></div>`;
}
export function head(title, sub, actions?) {
  return html`<div class="head"><div><h1>${title}</h1>${sub ? html`<p class="sub">${sub}</p>` : ''}</div><div class="actions">${actions || ''}</div></div>`;
}
export const opt = (v, label, sel) => html`<option value="${v}"${String(v) === String(sel) ? ' selected' : ''}>${label}</option>`;

Object.assign(App, {
  closeDrawer,
});
