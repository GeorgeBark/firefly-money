import { html, htmlList } from '../core/html';
import { App, S, el } from '../core/base';
import { NAV, closeDrawer } from '../core/dom';
import { isAsset, isCard, isLiab, lists } from '../core/lists';
import { THEMES, setTheme } from '../core/login';

/* ---------- Command palette ---------- */
type PalItem = { label: string, kind: string, go?: string, run?: () => void, low?: boolean };
let palItems: PalItem[] = [], palShown: PalItem[] = [], palIdx = 0;
export async function openPalette() {
  closeDrawer();
  el('palette').hidden = false; el('palQ').value = ''; el('palQ').focus();
  const L = await lists().catch(() => null);
  const items: PalItem[] = NAV.map(([r, label, ic]) => ({ label, kind: 'Page', go: '#/' + r }));
  items.push({ label: 'New transaction', kind: 'Action', run: () => App.quickAdd() }, { label: 'New rule', kind: 'Action', run: () => { location.hash = '#/rules'; setTimeout(() => App.ruleForm(), 400); } },
    { label: 'New recurring transaction', kind: 'Action', run: () => { location.hash = '#/recurring'; setTimeout(() => App.recurForm(), 400); } },
    { label: 'Reconcile an account', kind: 'Action', go: '#/accounts' },
    { label: 'Recalculate everything (fetch all numbers fresh)', kind: 'Action', run: () => App.recalcAll() });
  THEMES.forEach(([k, label]) => items.push({ label: 'Theme: ' + label, kind: 'Theme', run: () => setTheme(k) }));
  if (L) {
    L.accounts.filter(a => a.active && (isAsset(a) || isLiab(a))).forEach(a => items.push({ label: a.name, kind: isCard(a) ? 'Credit card' : isLiab(a) ? 'Loan' : 'Account', go: '#/account/' + a.id }));
    L.budgets.filter(b => b.active).forEach(b => items.push({ label: b.name, kind: 'Budget', go: '#/transactions?budget=' + b.id }));
    L.categories.forEach(c => items.push({ label: c.name, kind: 'Category', go: '#/transactions?category=' + c.id }));
    L.tags.forEach(t => items.push({ label: t.name, kind: 'Tag', go: '#/transactions?tag=' + t.id }));
    L.bills.forEach(b => items.push({ label: b.name, kind: 'Bill', go: '#/transactions?bill=' + b.id }));
    L.expense.forEach(a => items.push({ label: a.name, kind: 'Payee', go: '#/account/' + a.id, low: true }));
  }
  if (S.rules) Object.entries<any>(S.rules).forEach(([id, r]) => items.push({ label: r.title, kind: 'Rule', run: () => { location.hash = '#/rules'; setTimeout(() => App.ruleForm(id), 500); }, low: true }));
  palItems = items; palFilter();
}
function score(label, q) {
  const l = label.toLowerCase();
  if (!q) return 1;
  if (l.startsWith(q)) return 100 - l.length / 100;
  const i = l.indexOf(q); if (i >= 0) return 60 - i;
  let j = 0; for (const ch of l) if (ch === q[j]) j++;   // letters in order, e.g. "cc" → "Capital one Credit card"
  return j === q.length ? 20 : 0;
}
function palFilter() {
  const q = el('palQ').value.trim().toLowerCase();
  palShown = palItems.map(it => ({ it, s: score(it.label, q) - (it.low && q.length < 2 ? 50 : 0) })).filter(x => x.s > 0)
    .sort((a, b) => b.s - a.s).slice(0, 40).map(x => x.it);
  if (q) palShown.push({ label: 'Search transactions for “' + el('palQ').value.trim() + '”', kind: 'Search', go: '#/transactions?search=' + encodeURIComponent(el('palQ').value.trim()) });
  palIdx = 0; drawPal();
}
function drawPal() {
  el('palList').innerHTML = palShown.length ? htmlList(palShown.map((it, i) => html`<div class="pal-item${i === palIdx ? ' on' : ''}" data-i="${i}" data-onmousemove="App.palHover(${i})" data-onclick="App.palRun(${i})"><span>${it.label}</span><span class="k">${it.kind}</span></div>`))
    : html`<div class="pal-item"><span class="neutral">No matches</span></div>`;
  const on = el('palList').querySelector('.on'); if (on) on.scrollIntoView({ block: 'nearest' });
}
function palHover(i) { if (i !== palIdx) { palIdx = i; drawPal(); } }
function palKey(e) {
  if (e.key === 'ArrowDown') { e.preventDefault(); palIdx = Math.min(palShown.length - 1, palIdx + 1); drawPal(); }
  else if (e.key === 'ArrowUp') { e.preventDefault(); palIdx = Math.max(0, palIdx - 1); drawPal(); }
  else if (e.key === 'Enter') { e.preventDefault(); palRun(palIdx); }
  else if (e.key === 'Escape') { e.preventDefault(); closePalette(); }
}
function palRun(i) {
  const it = palShown[i]; if (!it) return;
  closePalette();
  if (it.go) location.hash = it.go; else if (it.run) it.run();
}
function closePalette() { el('palette').hidden = true; }

Object.assign(App, {
  openPalette,
  closePalette,
  palFilter,
  palKey,
  palRun,
  palHover,
});
