import { html, htmlList } from '../core/html';
import { App, el } from '../core/base';
import { NAV, icon, openDrawer } from '../core/dom';

/* ---------- Phone: tab bar, More sheet, swipe to delete ---------- */
function drawTabbar(active: string) {
  const tb = el('tabbar'); tb.hidden = false;
  const t = (r: string, label: string, ic: string) => html`<a href="#/${r}" class="${r === active ? 'on' : ''}">${icon(ic)}<span>${label}</span></a>`;
  tb.innerHTML = String(html`${t('', 'Home', 'overview')}${t('transactions', 'Activity', 'transactions')}<button type="button" class="plus" data-onclick="App.quickAdd()" aria-label="Add transaction"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg></button>${t('budgets', 'Budgets', 'budgets')}<button type="button" data-onclick="App.moreSheet()">${icon('categories')}<span>More</span></button>`);
}
export function moreSheet() {
  openDrawer('Menu', html`<button type="button" class="sheet-search" data-onclick="App.openPalette()">${icon('search')}<span>Search everything</span></button><div class="list">${htmlList(NAV.map(([r, label, ic]) => html`<a class="row" href="#/${r}" data-onclick="App.closeDrawer()" style="padding:14px 0;align-items:center"><span class="name" style="display:flex;gap:12px;align-items:center"><span style="width:20px;display:inline-flex">${icon(ic)}</span>${label}</span><span class="neutral">›</span></a>`))}</div><div class="eyebrow" style="margin-top:22px">Theme</div><div class="themes copy" id="themes2" style="padding:6px 0 0"></div><div class="toggles sheet"><button type="button" class="btn" data-tg="privacy" data-onclick="App.togglePrivacy()"></button><button type="button" class="btn" data-tg="compact" data-onclick="App.toggleDensity()"></button></div><div style="margin-top:22px;display:flex;gap:10px;flex-wrap:wrap"><button class="btn" data-onclick="App.closeDrawer();App.recalcAll()">Recalculate everything</button>${el('ffLink').hidden ? '' : html`<a class="btn" href="${el('ffLink').getAttribute('href')}" target="_blank" rel="noopener">Open Firefly III ↗</a>`}${window.MONEY_NATIVE ? html`<button class="btn" data-onclick="App.nativeSettings()">App settings</button>` : ''}<button class="btn" data-onclick="App.signOut()">Sign out</button></div>`);
  el('themes2').innerHTML = el('themes').innerHTML; if (App.drawToggles) App.drawToggles();
}
export function bindSwipe() {
  if (!('ontouchstart' in window)) return;
  document.querySelectorAll<HTMLElement>('#view tr[data-gid]:not([data-sw])').forEach(tr => {
    tr.dataset.sw = '1';
    let x0 = 0, y0 = 0, dx = 0, active = false;
    tr.addEventListener('touchstart', e => { x0 = e.touches[0].clientX; y0 = e.touches[0].clientY; dx = 0; active = true; }, { passive: true });
    tr.addEventListener('touchmove', e => {
      if (!active) return;
      dx = e.touches[0].clientX - x0; const dy = e.touches[0].clientY - y0;
      if (Math.abs(dy) > Math.abs(dx)) { active = false; tr.style.transform = ''; return; }
      if (dx < 0) { tr.classList.add('swiping'); tr.style.transform = 'translateX(' + Math.max(dx, -120) + 'px)'; if ((dx < -80) !== tr.classList.contains('swipe-del') && App.buzz) App.buzz(6); tr.classList.toggle('swipe-del', dx < -80); }
    }, { passive: true });
    tr.addEventListener('touchend', () => {
      tr.classList.remove('swiping'); tr.style.transform = '';
      if (active && dx < -80) { tr.removeAttribute('data-onclick'); App.softDeleteTx([tr.dataset.gid!]); }
      tr.classList.remove('swipe-del'); active = false;
    });
  });
}

// The methods markup handlers call (see events.ts), added to App and to its type
const methods = {
  drawTabbar,
  moreSheet,
};
Object.assign(App, methods);
type Methods = typeof methods;
declare module '../core/base' { interface AppApi extends Methods {} }
