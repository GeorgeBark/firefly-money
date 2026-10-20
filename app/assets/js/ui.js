'use strict';
/* =====================================================================
   Modern UI, part 2: privacy & density, haptics, pull-to-refresh,
   bottom sheets, inline edits, keyboard navigation, infinite scroll,
   customizable dashboard, sparklines, heatmap, flow chart,
   natural-language quick add.
   ===================================================================== */
const buzz = ms => { try { if (navigator.vibrate) navigator.vibrate(ms); } catch (e) { /* not supported */ } };

/* ---------- Privacy mode & density ---------- */
function applyPrefs() {
  const r = document.documentElement;
  r.classList.toggle('privacy', !!LS.get('privacy', false));
  r.classList.toggle('compact', !!LS.get('compact', false));
  drawToggles();
}
function drawToggles() {
  const p = !!LS.get('privacy', false), c = !!LS.get('compact', false);
  document.querySelectorAll('[data-tg=privacy]').forEach(b => { b.classList.toggle('on', p); b.innerHTML = icon(p ? 'eyeoff' : 'eye') + '<span>' + (p ? 'Show amounts' : 'Hide amounts') + '</span>'; b.title = 'Hide or show amounts (P)'; });
  document.querySelectorAll('[data-tg=compact]').forEach(b => { b.classList.toggle('on', c); b.innerHTML = icon('density') + '<span>' + (c ? 'Comfortable view' : 'Compact view') + '</span>'; });
}
function togglePrivacy() {
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

/* ---------- Pull to refresh (phones) ---------- */
(function pullToRefresh() {
  if (!('ontouchstart' in window)) return;
  const ind = el('ptr'); let y0 = null, d = 0, busyNow = false;
  const blocked = () => scrollY > 0 || el('app').hidden || el('drawer').classList.contains('open') || !el('palette').hidden || busyNow;
  addEventListener('touchstart', e => { y0 = blocked() || e.target.closest('#dash .grip') ? null : e.touches[0].clientY; d = 0; }, { passive: true });
  addEventListener('touchmove', e => {
    if (y0 === null) return;
    d = Math.max(0, Math.min(120, (e.touches[0].clientY - y0) * .5));
    if (scrollY > 0) d = 0;
    ind.style.transform = 'translate(-50%, ' + (d - 50) + 'px) rotate(' + d * 3 + 'deg)';
    ind.style.opacity = Math.min(1, d / 60);
    const armed = d >= 70;
    if (armed !== ind.classList.contains('armed')) { ind.classList.toggle('armed', armed); if (armed) buzz(10); }
  }, { passive: true });
  addEventListener('touchend', async () => {
    if (y0 === null) return; y0 = null;
    if (!ind.classList.contains('armed')) { ind.style.transform = ''; ind.style.opacity = ''; return; }
    ind.classList.remove('armed'); ind.classList.add('busy'); busyNow = true;
    ind.style.transform = 'translate(-50%, 24px)';
    try { await refreshAll({ visible: true }); } catch (e) { /* route shows its own errors */ }
    ind.classList.remove('busy'); ind.style.transform = ''; ind.style.opacity = ''; busyNow = false;
  });
})();

/* ---------- Bottom sheet: drag the handle down to dismiss (phones) ---------- */
(function sheetDrag() {
  const d = el('drawer'); let sy = null, sd = 0, t0 = 0;
  d.addEventListener('touchstart', e => {
    if (innerWidth > 900 || !e.target.closest('.grab, header') || e.target.closest('button')) return;
    sy = e.touches[0].clientY; sd = 0; t0 = Date.now(); d.classList.add('dragging');
  }, { passive: true });
  d.addEventListener('touchmove', e => {
    if (sy === null) return;
    sd = Math.max(0, e.touches[0].clientY - sy);
    d.style.transform = 'translateY(' + sd + 'px)'; el('scrim').style.opacity = String(1 - Math.min(1, sd / 500));
  }, { passive: true });
  d.addEventListener('touchend', () => {
    if (sy === null) return; sy = null; d.classList.remove('dragging'); el('scrim').style.opacity = '';
    const v = sd / Math.max(1, Date.now() - t0);
    if (sd > 120 || (v > .5 && sd > 40)) { S.drawerHero = null; buzz(6); closeDrawer(); }
    d.style.transform = '';
  });
})();

/* ---------- Inline category / budget picker ---------- */
let pickCtx = null;
function pick(node) {
  const tr = node.closest('tr[data-gid]'), meta = tr && S.txMeta[tr.dataset.gid], L = S.lists;
  if (!meta || !L) return;
  const k = node.dataset.k, sp = meta.g.splits[0];
  const items = k === 'category'
    ? [{ v: '', l: 'No category' }, ...L.categories.map(c => ({ v: c.name, l: c.name }))]
    : [{ v: '', l: 'No budget' }, ...L.budgets.filter(b => b.active || b.id === sp.budget_id).map(b => ({ v: b.id, l: b.name }))];
  pickCtx = { tr, meta, k, items, cur: k === 'category' ? sp.category : sp.budget_id, idx: 0, q: '' };
  const box = el('pickpop');
  box.innerHTML = '<input type="text" id="pkq" autocomplete="off" placeholder="' + (k === 'category' ? 'Find or create a category' : 'Find a budget') + '" data-oninput="App.pickFilter(this.value)" data-onkeydown="App.pickKey(event)"><div class="pk-list" id="pkList"></div>';
  box.hidden = false;
  const r = node.getBoundingClientRect(), w = Math.min(280, innerWidth - 24);
  box.style.width = w + 'px';
  box.style.left = Math.max(12, Math.min(innerWidth - w - 12, r.left)) + 'px';
  pickFilter('');
  const h = box.offsetHeight;
  box.style.top = (r.bottom + 6 + h > innerHeight ? Math.max(12, r.top - h - 6) : r.bottom + 6) + 'px';
  el('pkq').focus();
}
function pickList() {
  const c = pickCtx, q = c.q.trim().toLowerCase();
  let list = c.items.filter(x => !q || x.l.toLowerCase().includes(q));
  list.sort((a, b) => (b.l.toLowerCase().startsWith(q) ? 1 : 0) - (a.l.toLowerCase().startsWith(q) ? 1 : 0));
  if (c.k === 'category' && q && !c.items.some(x => x.l.toLowerCase() === q)) list = [...list, { v: c.q.trim(), l: 'Create “' + c.q.trim() + '”', create: true }];
  return list;
}
function pickFilter(q) { pickCtx.q = q; pickCtx.idx = q ? 0 : Math.max(0, pickList().findIndex(x => String(x.v) === String(pickCtx.cur || ''))); drawPick(); }
function drawPick() {
  const c = pickCtx, list = pickList();
  el('pkList').innerHTML = list.map((x, i) => '<div class="pal-item' + (i === c.idx ? ' on' : '') + '" data-onmouseenter="App.pickHover(' + i + ')" data-onmousedown="event.preventDefault();App.pickChoose(' + i + ')">' +
    '<span>' + esc(x.l) + '</span>' + (String(x.v) === String(c.cur) && !x.create ? '<span class="k">✓</span>' : '') + '</div>').join('') || '<div class="empty" style="padding:10px 14px">Nothing matches.</div>';
  const on = el('pkList').querySelector('.on'); if (on) on.scrollIntoView({ block: 'nearest' });
}
function pickHover(i) { if (pickCtx && i !== pickCtx.idx) { pickCtx.idx = i; drawPick(); } }
function pickKey(e) {
  const n = pickList().length;
  if (['ArrowDown', 'ArrowUp', 'Enter', 'Escape'].includes(e.key)) e.stopPropagation();
  if (e.key === 'ArrowDown') { e.preventDefault(); pickCtx.idx = (pickCtx.idx + 1) % n; drawPick(); }
  else if (e.key === 'ArrowUp') { e.preventDefault(); pickCtx.idx = (pickCtx.idx - 1 + n) % n; drawPick(); }
  else if (e.key === 'Enter') { e.preventDefault(); pickChoose(pickCtx.idx); }
  else if (e.key === 'Escape') { e.preventDefault(); closePick(); }
}
function closePick() { const a = document.activeElement; if (a && a.id === 'pkq') a.blur(); el('pickpop').hidden = true; const c = pickCtx; pickCtx = null; return c; }
document.addEventListener('mousedown', e => { if (!el('pickpop').hidden && !e.target.closest('#pickpop')) closePick(); });
document.addEventListener('scroll', e => { if (!el('pickpop').hidden && !(e.target.closest && e.target.closest('#pickpop'))) closePick(); }, true);
function rowFor(g, opts) {
  const t = document.createElement('template'); t.innerHTML = txRows([g], opts);
  return t.content.querySelector('tr[data-gid]');
}
function swapRow(tr, g, opts) {
  const nr = rowFor(g, opts), cb = tr.querySelector('input[data-sel]');
  if (cb && cb.checked) nr.querySelector('input[data-sel]').checked = true;
  if (tr.classList.contains('kfocus')) nr.classList.add('kfocus');
  tr.replaceWith(nr); bindSwipe(); return nr;
}
async function pickChoose(i) {
  const item = pickList()[i], c = closePick(); if (!item || !c) return;
  const { meta, k } = c, g = meta.g, sp = g.splits[0];
  if (String(item.v) === String(c.cur) && !item.create) return;
  const before = { category: sp.category, budget_id: sp.budget_id, budget_name: sp.budget_name };
  if (k === 'category') sp.category = item.v; else { sp.budget_id = item.v; sp.budget_name = item.v ? item.l : ''; }
  let row = c.tr.isConnected ? swapRow(c.tr, g, meta.opts) : null;          // optimistic: show it now
  if (row) row.classList.add('saving');
  buzz(8);
  try {
    const t = { transaction_journal_id: sp.jid };
    if (k === 'category') t.category_name = item.v; else t.budget_id = item.v || '0';
    await api('/transactions/' + g.id, { method: 'PUT', body: { apply_rules: false, fire_webhooks: true, transactions: [t] } });
    invalidate(); if (item.create) S.listsAt = 0;
    if (row && row.isConnected) { row.classList.remove('saving'); row.classList.add('saved'); setTimeout(() => row.classList.remove('saved'), 900); }
    toast((k === 'category' ? 'Category' : 'Budget') + (item.v ? ' set to ' + (item.create ? item.v : item.l) : ' removed'));
  } catch (e) {
    Object.assign(sp, before);
    row = document.querySelector('#view tr[data-gid="' + g.id + '"]'); if (row) swapRow(row, g, meta.opts);
    if (e instanceof AuthError) return showLogin(e.message);
    toast('Couldn’t save: ' + e.message);
  }
}

/* ---------- Keyboard: j/k to move, Enter to open, c/b to recategorize, x to select, p for privacy, ? for help ---------- */
function kRows() { return [...document.querySelectorAll('#view tr[data-gid]')]; }
function kMark(i) {
  const rows = kRows(); if (!rows.length) return;
  S.kIdx = Math.max(0, Math.min(rows.length - 1, i));
  rows.forEach((r, j) => r.classList.toggle('kfocus', j === S.kIdx));
  rows[S.kIdx].scrollIntoView({ block: 'nearest', behavior: reduceMotion ? 'auto' : 'smooth' });
}
document.addEventListener('keydown', e => {
  if (el('app').hidden || typing(e) || e.metaKey || e.ctrlKey || e.altKey) return;
  if (el('drawer').classList.contains('open') || !el('palette').hidden || el('confirm').open || !el('pickpop').hidden) return;
  const k = e.key;
  if (k === 'p' || k === 'P') { e.preventDefault(); return togglePrivacy(); }
  if (k === '?') { e.preventDefault(); return shortcutsSheet(); }
  if (k === 'j' || k === 'ArrowDown' && S.kIdx >= 0) { e.preventDefault(); return kMark((S.kIdx ?? -1) + 1); }
  if (k === 'k' || k === 'ArrowUp' && S.kIdx >= 0) { e.preventDefault(); return kMark(Math.max(0, (S.kIdx ?? 0) - 1)); }
  const tr = S.kIdx >= 0 && kRows()[S.kIdx]; if (!tr) return;
  if (k === 'Enter' || k === 'o') { e.preventDefault(); editTx(tr.dataset.gid); }
  else if (k === 'c' || k === 'b') { const n = [...tr.querySelectorAll('[data-k="' + (k === 'c' ? 'category' : 'budget') + '"]')].find(x => x.offsetParent !== null); if (n) { e.preventDefault(); pick(n); } }
  else if (k === 'x') { const cb = tr.querySelector('input[data-sel]'); if (cb) { cb.checked = !cb.checked; selChanged(); } }
  else if (k === 'Escape') { S.kIdx = -1; kRows().forEach(r => r.classList.remove('kfocus')); }
});
function shortcutsSheet() {
  const rows = [['N', 'New transaction'], ['⌘/Ctrl K', 'Search everything'], ['/', 'Search transactions'], ['J / K', 'Next / previous transaction'], ['Enter', 'Open the selected transaction'],
    ['C', 'Change its category'], ['B', 'Change its budget'], ['X', 'Select it for bulk edit'], ['P', 'Hide or show amounts'], ['Esc', 'Close / clear']];
  openDrawer('Keyboard shortcuts', '<div class="list">' + rows.map(([a, b]) => '<div class="row"><span class="name">' + b + '</span><kbd>' + a + '</kbd></div>').join('') + '</div>');
}

/* ---------- Infinite scroll for transaction lists ---------- */
function bindFeed() {
  const m = el('feedMore'), f = S.feed; if (!m || !f) return;
  const io = new IntersectionObserver(async ents => {
    if (!ents.some(x => x.isIntersecting) || f.busy) return;
    if (S.feed !== f || !m.isConnected) return io.disconnect();
    f.busy = true;
    try {
      const gs = await f.more(f.next);
      if (S.feed !== f || !m.isConnected) return;
      f.next++; appendRows(gs, f.opts);
      if (f.next > f.pages || !gs.length) { io.disconnect(); m.remove(); } else { io.unobserve(m); io.observe(m); }
    } catch (e) { m.textContent = 'Couldn’t load more: ' + e.message; io.disconnect(); }
    finally { f.busy = false; }
  }, { rootMargin: '700px 0px' });
  io.observe(m);
}
function dayNet(tbody) {
  return [...tbody.querySelectorAll('tr[data-gid]')].reduce((s, tr) => { const m = S.txMeta[tr.dataset.gid]; return s + (m ? signed(m.g, m.accountId) : 0); }, 0);
}
function appendRows(gs, opts) {
  const table = document.querySelector('#view table.feed'); if (!table || !gs.length) return;
  const t = document.createElement('template'); t.innerHTML = txRows(gs, opts);
  const bodies = [...t.content.querySelectorAll('tbody.day')], last = table.querySelector('tbody.day:last-of-type');
  if (bodies.length && last && bodies[0].querySelector('.dayhead').dataset.day === last.querySelector('.dayhead').dataset.day) {
    bodies.shift().querySelectorAll('tr[data-gid]').forEach(r => last.appendChild(r));
    const net = dayNet(last), span = last.querySelector('.dayhead .num') || document.createElement('span');
    span.className = 'num ' + (net < 0 ? '' : 'pos'); span.textContent = (net > 0 ? '+' : '') + money(net);
    if (!span.isConnected) last.querySelector('.dayhead div').appendChild(span);
  }
  bodies.forEach(b => table.appendChild(b));
  bindSwipe();
  const all = document.querySelector('.selall input'); if (all && all.checked) selAll(true);
}

/* ---------- Customizable dashboard ----------
   Cards sit in columns you arrange yourself: each card stays in the column and at the height you put it. A wide card
   spans every column and splits the page into bands of columns above and below it. The arrangement is kept for each
   column count (money.dash place[n]), so a phone (1 column) and a desktop (3) each keep their own. */
const DASH_WIDE = ['flow', 'cashflow', 'recent'];
const DASH_NAMES = { safe: 'Safe to spend', attention: 'Needs attention', spending: 'Where it went', budgets: 'Budgets', cash: 'Cash & savings', cards: 'Credit cards',
  loans: 'Loans', bills: 'Coming up', heatmap: 'Daily spending', flow: 'Money flow', cashflow: 'Cash flow', recent: 'Recent transactions',
  payees: 'Top payees', income: 'Income sources', goals: 'Savings goals' };
// Rough card heights, only used to deal cards into columns evenly the first time
const DASH_EST = { safe: 200, attention: 200, spending: 640, budgets: 300, cash: 300, cards: 290, loans: 250, bills: 220, heatmap: 420, payees: 640, income: 260, goals: 260 };
const DASH_COLS = ['', 1, 2, 3, 4];      // '' = as many ~380px columns as fit (max 3)
// hidden also holds the parts above the cards ('hero', 'insights'); cols is the chosen column count; place[n] the arrangement
const dashLayout = () => ({ order: [], hidden: [], wide: null, cols: '', place: {}, ...LS.get('dash', {}) });
const dashShows = part => !dashLayout().hidden.includes(part);
// How many columns fit right now: the chosen count is a maximum, narrow windows get fewer
function dashCount(L) {
  const v = el('view'), w = (v && v.clientWidth) || innerWidth, min = L.cols ? 260 : 380;
  return Math.max(1, Math.min(L.cols || 3, Math.floor((w + 20) / (min + 20))));
}
// The arrangement for n columns: a list of blocks, each a wide card's key or a band of n columns of keys.
// Cards that are gone are dropped; new ones (and ones that changed between wide and narrow) are dealt in at the end.
function dashPlace(L, keys, n, wide, est) {
  const seen = new Set(), ok = (k, isWide) => keys.includes(k) && !seen.has(k) && wide.includes(k) === isWide && seen.add(k);
  const blocks = [];
  ((L.place || {})[n] || []).forEach(b => {
    if (typeof b === 'string') { if (ok(b, true)) blocks.push(b); return; }
    if (!Array.isArray(b)) return;
    const band = [...Array(n)].map((_, i) => (Array.isArray(b[i]) ? b[i] : []).filter(k => typeof k === 'string' && ok(k, false)));
    const last = blocks[blocks.length - 1];
    if (Array.isArray(last)) band.forEach((c, i) => last[i].push(...c)); else blocks.push(band);     // two bands in a row: merge them
  });
  const order = [...L.order.filter(k => keys.includes(k)), ...keys.filter(k => !L.order.includes(k))];
  order.filter(k => !seen.has(k)).forEach(k => {
    if (wide.includes(k)) { blocks.push(k); return; }
    let band = blocks[blocks.length - 1];
    if (!Array.isArray(band)) blocks.push(band = [...Array(n)].map(() => []));
    const h = band.map(c => c.reduce((s, x) => s + est(x), 0)), i = h.indexOf(Math.min(...h));     // the shortest column
    band[i].push(k);
  });
  return blocks.filter(b => !Array.isArray(b) || b.some(c => c.length));
}
/* Freeform tiles (wide screens): every card is a tile on a grid of 24 columns and 8px rows. You can drop it anywhere
   and drag its corner to make it wider or narrower; its height follows its content. Tiles never overlap: when one
   lands on or grows into another, the other moves down. Saved positions live in money.dash free {key: [x, y, w]};
   until you move something the tiles are packed tidily from the column arrangement. Phones keep the single column. */
const GRID = 24, ROW = 8;
const gridMode = () => { const v = el('view'); return ((v && v.clientWidth) || innerWidth) >= 700; };
// Settle tiles so none overlap. `first` keeps its spot; the rest keep their order (top to bottom, left to right) and
// move down just far enough. A floating tile (not placed by you yet) first rises as high as it can.
function gridSettle(ts, first) {
  const order = [...ts].sort((a, b) => (b.k === first) - (a.k === first) || a.y - b.y || a.x - b.x), placed = [];
  for (const t of order) {
    if (t.float && t.k !== first) t.y = 0;
    for (let hit = true; hit;) {
      hit = false;
      for (const p of placed) if (t.x < p.x + p.w && p.x < t.x + t.w && t.y < p.y + p.h && p.y < t.y + t.h) { t.y = p.y + p.h; hit = true; }
    }
    placed.push(t);
  }
  return ts;
}
// Lay the tiles on the page out from their saved spots (data-gx/gy/gw), their measured heights and `over` (the tile
// being dragged or resized, at its new spot). Always starts from the saved spots, so nothing drifts.
function gridLayout(d, over) {
  const gap = parseFloat(getComputedStyle(d).columnGap) || 20;
  const ts = [...d.querySelectorAll(':scope > .w')].map(el => {
    const t = { el, k: el.dataset.w, x: +el.dataset.gx, y: +el.dataset.gy, w: +el.dataset.gw, float: el.dataset.float === '1' };
    if (over && over.k === t.k) Object.assign(t, over, { float: false });
    el.style.gridColumn = (t.x + 1) + ' / span ' + t.w;
    return t;
  });
  ts.forEach(t => { t.h = Math.max(1, Math.ceil((t.el.offsetHeight + gap) / ROW)); });
  gridSettle(ts, over && over.k);
  ts.forEach(t => { t.el.style.gridRow = (t.y + 1) + ' / span ' + t.h; t.el._g = t; });
  return ts;
}
// Keep where the tiles are now as their saved spots
function gridKeep(d) {
  const L = dashLayout(), free = { ...(L.free || {}) };
  d.querySelectorAll(':scope > .w').forEach(el => {
    const t = el._g; if (!t) return;
    el.dataset.gx = t.x; el.dataset.gy = t.y; el.dataset.gw = t.w; delete el.dataset.float;
    free[t.k] = [t.x, t.y, t.w];
  });
  L.free = free; LS.set('dash', L);
}
function dashButton() { return S.dashEdit ? '' : '<button class="btn small" data-onclick="App.dashEdit(true)" title="Move, resize or hide cards">Customize</button>'; }
// top: the insight strip, which shares the cards' column grid so its cards line up with the columns below
function dashboard(W, top = '') {
  const L = dashLayout(), keys = W.map(w => w[0]), map = Object.fromEntries(W), wide = L.wide || DASH_WIDE, edit = !!S.dashEdit, n = dashCount(L);
  const grid = gridMode(), blocks = dashPlace(L, keys, grid ? Math.min(n, 4) : n, wide, k => map[k] ? (DASH_EST[k] || 250) + 20 : 0);
  // Freeform: each tile's spot, either saved or (for tiles you haven't placed) dealt from the column arrangement
  const spot = {};
  if (grid) {
    let i = 0;
    const deal = (k, c, cols) => { const x = Math.round(c * GRID / cols); spot[k] = { k, x, w: Math.round((c + 1) * GRID / cols) - x, y: 1e6 + i++, float: true }; };
    blocks.forEach(b => {
      if (typeof b === 'string') return deal(b, 0, 1);
      for (let r = 0; r < Math.max(...b.map(c => c.length)); r++) b.forEach((c, ci) => { if (c[r]) deal(c[r], ci, b.length); });
    });
    Object.entries(L.free || {}).forEach(([k, v]) => {
      if (!spot[k] || !Array.isArray(v)) return;
      const w = Math.max(4, Math.min(GRID, Math.round(+v[2]) || 8)), x = Math.max(0, Math.min(GRID - w, Math.round(+v[0]) || 0));
      Object.assign(spot[k], { x, y: Math.max(0, Math.round(+v[1]) || 0), w, float: false });
    });
    // A first guess at the heights so the first paint is close; the real ones are measured right after
    gridSettle(Object.values(spot).filter(t => map[t.k] && (edit || !L.hidden.includes(t.k))).map(t => Object.assign(t, { h: Math.ceil(((DASH_EST[t.k] || 250) + 20) / ROW) })));
  }
  const card = k => {
    const html = map[k]; if (!html) return '';
    const off = L.hidden.includes(k); if (off && !edit) return '';
    const isWide = wide.includes(k), g = spot[k];
    if (grid) return '<div class="w' + (off ? ' off' : '') + '" data-w="' + k + '" data-gx="' + g.x + '" data-gy="' + g.y + '" data-gw="' + g.w + '"' + (g.float ? ' data-float="1"' : '') +
      ' style="grid-column:' + (g.x + 1) + ' / span ' + g.w + ';grid-row:' + (g.y + 1) + ' / span ' + g.h + '">' +
      (edit ? '<div class="wctl"><span class="grip" title="Drag to move" aria-hidden="true">⠿</span><strong>' + esc(DASH_NAMES[k] || k) + '</strong><span class="grow"></span>' +
        '<button type="button" data-onclick="App.dashNudge(\'' + k + '\',-1,0)" aria-label="Move left">←</button><button type="button" data-onclick="App.dashNudge(\'' + k + '\',1,0)" aria-label="Move right">→</button>' +
        '<button type="button" data-onclick="App.dashNudge(\'' + k + '\',0,-1)" aria-label="Move up">↑</button><button type="button" data-onclick="App.dashNudge(\'' + k + '\',0,1)" aria-label="Move down">↓</button>' +
        '<button type="button" class="wbtn" data-onclick="App.dashWide(\'' + k + '\')">' + (g.w === GRID ? 'Narrow' : 'Wide') + '</button>' +
        '<button type="button" class="hbtn" data-onclick="App.dashHide(\'' + k + '\')">' + (off ? 'Show' : 'Hide') + '</button></div>' +
        '<span class="rsz" title="Drag to resize" aria-hidden="true"></span>' : '') + html + '</div>';
    return '<div class="w' + (isWide ? ' wide' : '') + (off ? ' off' : '') + '" data-w="' + k + '">' +
      (edit ? '<div class="wctl"><span class="grip" title="Drag to move" aria-hidden="true">⠿</span><strong>' + esc(DASH_NAMES[k] || k) + '</strong><span class="grow"></span>' +
        (n > 1 && !isWide ? '<button type="button" data-onclick="App.dashShift(\'' + k + '\',-1)" aria-label="Move left">←</button><button type="button" data-onclick="App.dashShift(\'' + k + '\',1)" aria-label="Move right">→</button>' : '') +
        '<button type="button" data-onclick="App.dashMove(\'' + k + '\',-1)" aria-label="Move up">↑</button><button type="button" data-onclick="App.dashMove(\'' + k + '\',1)" aria-label="Move down">↓</button>' +
        '<button type="button" class="wbtn" data-onclick="App.dashWide(\'' + k + '\')">' + (isWide ? 'Narrow' : 'Wide') + '</button>' +
        '<button type="button" class="hbtn" data-onclick="App.dashHide(\'' + k + '\')">' + (off ? 'Show' : 'Hide') + '</button></div>' : '') + html + '</div>';
  };
  const body = grid ? keys.map(card).join('') : blocks.map(blk => {
    if (typeof blk === 'string') return card(blk);
    const cols = blk.map(c => c.map(card).join(''));
    return !edit && cols.every(c => !c) ? '' : '<div class="band">' + cols.map(c => '<div class="dcol">' + c + '</div>').join('') + '</div>';
  }).join('');
  const part = (p, label) => '<label class="check"><input type="checkbox"' + (L.hidden.includes(p) ? '' : ' checked') + ' data-onchange="App.dashPart(\'' + p + '\', this.checked)"> ' + label + '</label>';
  return '<div class="dash-wrap" data-n="' + n + '" style="--n:' + n + '">' + top + (edit ? '<div class="dash-bar"><span>' + (grid ? 'Drag a tile anywhere and drag its corner to resize; tiles snap to the grid and push others down.' :
      'Drag a card to any column and height (on a touch screen, by its ⠿ handle), or use the arrows. Wide cards span every column.') + '</span><span class="grow"></span>' +
      (grid ? '<button class="link" data-onclick="App.dashTidy()" title="Close the gaps by moving tiles up">Tidy up</button>' : '') +
      '<button class="link" data-onclick="App.dashReset()">Reset</button><button class="btn small primary" data-onclick="App.dashEdit(false)">Done</button>' +
      '<div class="dash-opts"><span>' + (grid ? 'Arrange in columns' : 'Columns') + '</span><div class="seg mini" id="dashCols">' +
        DASH_COLS.map(c => '<button type="button" class="' + (String(L.cols || '') === String(c) ? 'on' : '') + '" data-onclick="App.dashCols(\'' + c + '\')">' + (c || 'Auto') + '</button>').join('') + '</div>' +
        '<span class="grow"></span>' + part('hero', 'Net worth summary') + part('insights', 'Insights') + '</div></div>' : '') +
    '<div class="cards ' + (grid ? 'grid' : 'free') + (edit ? ' editing' : '') + '" id="dash" data-n="' + n + '" data-mode="' + (grid ? 'grid' : 'cols') + '"' + (L.cols ? ' data-cols="' + esc(String(L.cols)) + '"' : '') + '>' + body + '</div></div>';
}
// Read the arrangement back from the page (only while customizing, when hidden cards are on the page too)
function dashSave(mut) {
  const L = dashLayout(), d = el('dash');
  if (d && d.classList.contains('editing') && !d.classList.contains('grid')) {
    const keysIn = node => [...node.querySelectorAll(':scope > .w')].map(w => w.dataset.w);
    const blocks = [...d.children].map(ch => ch.classList.contains('band') ? [...ch.children].map(keysIn) : ch.dataset.w).filter(Boolean);
    L.place = { ...L.place, [d.dataset.n]: blocks };
    L.order = blocks.flat(2).concat(L.order.filter(k => !d.querySelector('[data-w="' + k + '"]')));
  }
  if (!L.wide) L.wide = DASH_WIDE.slice();
  if (mut) mut(L);
  LS.set('dash', L); return L;
}
function dashAnimate(fn) {
  const ws = [...document.querySelectorAll('#dash .w')];
  vt('dash', fn, () => ws.forEach(w => vtName(w, 'dw-' + w.dataset.w)));
}
const dashRedraw = () => { S.pageKey = ''; PAGES.clear(); route(); };
function dashEdit(on) { S.dashEdit = on; dashRedraw(); }
const dashCard = k => document.querySelector('#dash [data-w="' + k + '"]');
const newBand = n => { const b = document.createElement('div'); b.className = 'band'; b.innerHTML = '<div class="dcol"></div>'.repeat(n); return b; };
// Up and down: within the column, or past a wide card into the band beyond it (same column)
function dashMove(k, dir) {
  const w = dashCard(k); if (!w) return;
  const sib = dir < 0 ? w.previousElementSibling : w.nextElementSibling;
  if (sib) return dashAnimate(() => { dir < 0 ? sib.before(w) : sib.after(w); dashSave(); });
  const col = w.parentElement; if (!col.classList.contains('dcol')) return;
  const i = [...col.parentElement.children].indexOf(col), d = el('dash');
  let blk = dir < 0 ? col.parentElement.previousElementSibling : col.parentElement.nextElementSibling;
  if (!blk) return;
  dashAnimate(() => {
    if (!blk.classList.contains('band')) {       // a wide card: hop over it into the band on its far side
      const far = dir < 0 ? blk.previousElementSibling : blk.nextElementSibling;
      if (!far || !far.classList.contains('band')) { const b = newBand(+d.dataset.n); dir < 0 ? blk.before(b) : blk.after(b); blk = b; } else blk = far;
    }
    const to = blk.children[i]; dir < 0 ? to.appendChild(w) : to.prepend(w);
    dashSave();
  });
}
// Left and right: the same height in the next column
function dashShift(k, dir) {
  const w = dashCard(k); if (!w || !w.parentElement.classList.contains('dcol')) return;
  const col = w.parentElement, to = dir < 0 ? col.previousElementSibling : col.nextElementSibling; if (!to) return;
  const at = to.children[[...col.children].indexOf(w)];
  dashAnimate(() => { at ? at.before(w) : to.appendChild(w); dashSave(); });
}
function dashWide(k) {
  const w = dashCard(k), d = el('dash'); if (!w) return;
  if (d.classList.contains('grid')) {
    const t = w._g, wide = t.w < GRID, nw = wide ? GRID : Math.round(GRID / Math.min(+d.dataset.n, 4)) || 8;
    dashSave(x => { x.wide = wide ? [...new Set([...x.wide, k])] : x.wide.filter(y => y !== k); });
    gridMove(d, { k, x: wide ? 0 : Math.min(t.x, GRID - nw), y: t.y, w: nw });
    w.querySelector('.wbtn').textContent = wide ? 'Narrow' : 'Wide';
    return;
  }
  const L = dashSave(x => { x.wide = x.wide.includes(k) ? x.wide.filter(y => y !== k) : [...x.wide, k]; }), on = L.wide.includes(k);
  dashAnimate(() => {
    if (on) w.closest('.band').after(w);       // full width, right below the band it was in
    else {                                     // back into a column: the shortest one of the band just above (or below)
      const near = [w.previousElementSibling, w.nextElementSibling].find(b => b && b.classList.contains('band'));
      const band = near || (() => { const b = newBand(+d.dataset.n); w.after(b); return b; })();
      const cols = [...band.children];
      cols.reduce((a, c) => c.offsetHeight < a.offsetHeight ? c : a, cols[0])[near === w.previousElementSibling ? 'appendChild' : 'prepend'](w);
    }
    w.classList.toggle('wide', on); w.querySelector('.wbtn').textContent = on ? 'Narrow' : 'Wide';
    dashSave();
  });
}
function dashHide(k) {
  const L = dashSave(x => { x.hidden = x.hidden.includes(k) ? x.hidden.filter(y => y !== k) : [...x.hidden, k]; });
  const w = dashCard(k), off = L.hidden.includes(k);
  w.classList.toggle('off', off); w.querySelector('.hbtn').textContent = off ? 'Show' : 'Hide';
}
function dashCols(c) {
  const grid = el('dash') && el('dash').classList.contains('grid');      // freeform: start over from that many columns
  dashSave(x => { x.cols = DASH_COLS.map(String).includes(String(c)) ? (c ? +c : '') : ''; if (grid) x.free = {}; }); dashRedraw();
}
// Freeform: put a tile at a new spot (others make room, animated) and keep the result
function gridMove(d, over) {
  const ws = [...d.querySelectorAll(':scope > .w')], was = new Map(ws.map(w => [w, w.getBoundingClientRect()]));
  gridLayout(d, over); gridKeep(d);
  ws.forEach(w => {
    const a = was.get(w), b = w.getBoundingClientRect(), dx = a.left - b.left, dy = a.top - b.top;
    if (!dx && !dy) return;
    w.style.transition = 'none'; w.style.transform = 'translate(' + dx + 'px,' + dy + 'px)';
    w.offsetWidth; w.style.transition = 'transform .2s ease'; w.style.transform = '';
  });
}
// The arrows nudge a tile one column sideways, or a card's worth of rows up or down
function dashNudge(k, dx, dy) {
  const w = dashCard(k), d = el('dash'); if (!w || !w._g) return;
  const t = w._g;
  gridMove(d, { k, x: Math.max(0, Math.min(GRID - t.w, t.x + dx)), y: Math.max(0, t.y + dy * 6), w: t.w });
}
// Close the gaps: every tile rises as far as it can, keeping its column and order
function dashTidy() {
  const d = el('dash'); if (!d || !d.classList.contains('grid')) return;
  d.querySelectorAll(':scope > .w').forEach(w => { w.dataset.float = '1'; });
  gridMove(d);
}
// The net-worth summary and the insight strip sit above the cards, so showing or hiding them redraws the page
function dashPart(p, on) { dashSave(x => { x.hidden = x.hidden.filter(y => y !== p).concat(on ? [] : [p]); }); dashRedraw(); }
function dashReset() { LS.set('dash', {}); dashRedraw(); }
// A window resize that changes how many columns fit redraws the overview with that count's arrangement
addEventListener('resize', (() => { let t = 0; return () => { clearTimeout(t); t = setTimeout(() => {
  const d = el('dash'); if (d && !d.classList.contains('moving') && (+d.dataset.n !== dashCount(dashLayout()) || (d.dataset.mode === 'grid') !== gridMode())) { S.pageKey = ''; PAGES.clear(); route({ quiet: true }); }
}, 200); }; })());
// Moving cards in Customize: pointer events, so it works the same with a mouse, a pen or a finger. A mouse can pick a
// card up anywhere on it; touch uses the ⠿ handle so the page still scrolls. The card follows the pointer as a floating
// copy, its slot moves to wherever it would land (the others slide out of the way), and the page scrolls when you hold
// it near the top or bottom edge.
let gridRO = null, gridMO = null;
function bindDash() {
  if (gridRO) { gridRO.disconnect(); gridMO.disconnect(); gridRO = gridMO = null; }
  const d = el('dash'); if (!d) return;
  if (d.classList.contains('grid')) return bindGrid(d);
  if (!d.classList.contains('editing')) return;
  let drag = null;
  const near = (els, x, y) => {      // the element under the pointer, or else the nearest one (so gaps count too)
    let best = null, bd = Infinity;
    for (const e of els) {
      const r = e.getBoundingClientRect(), dx = Math.max(r.left - x, 0, x - r.right), dy = Math.max(r.top - y, 0, y - r.bottom), dist = dx * dx + dy * dy;
      if (dist < bd) { bd = dist; best = e; }
    }
    return best;
  };
  // The first of these whose middle is below the pointer: the slot goes right before it
  const before = (els, y) => els.find(e => { const r = e.getBoundingClientRect(); return r.top + r.height / 2 > y; }) || null;
  const flip = fn => {
    const ws = [...d.querySelectorAll('.w')], was = new Map(ws.map(w => [w, w.getBoundingClientRect()]));
    fn();
    ws.forEach(w => {
      if (w === drag.w) return;
      const a = was.get(w), b = w.getBoundingClientRect(), dx = a.left - b.left, dy = a.top - b.top;
      if (!dx && !dy) return;
      w.style.transition = 'none'; w.style.transform = 'translate(' + dx + 'px,' + dy + 'px)';
      w.offsetWidth; w.style.transition = 'transform .2s ease'; w.style.transform = '';
    });
  };
  const put = (parent, ref) => {
    if (ref === drag.w || (ref ? ref.previousElementSibling === drag.w : parent.lastElementChild === drag.w) && drag.w.parentElement === parent) return;
    flip(() => parent.insertBefore(drag.w, ref));
  };
  const place = () => {
    if (!drag) return;
    const { x, y, w } = drag, top = [...d.children].filter(c => c !== w);
    if (w.classList.contains('wide')) return put(d, before(top, y));      // a wide card goes between bands
    // A narrow card: into the column under the pointer, at the pointer's height
    const t = near([...d.querySelectorAll('.dcol'), ...d.querySelectorAll(':scope > .w.wide')].filter(c => c !== w), x, y); if (!t) return;
    if (t.classList.contains('dcol')) return put(t, before([...t.children].filter(c => c !== w), y));
    // Over a wide card: into the band just above or below it (a new one if there's none), in the column under the pointer
    const r = t.getBoundingClientRect(), up = y < r.top + r.height / 2, n = +d.dataset.n;
    let band = up ? t.previousElementSibling : t.nextElementSibling;
    if (!band || !band.classList.contains('band')) { band = newBand(n); up ? t.before(band) : t.after(band); }
    const col = band.children[Math.max(0, Math.min(n - 1, Math.floor((x - r.left) / (r.width / n))))];
    put(col, up ? null : col.firstElementChild);
  };
  const tick = () => {
    if (!drag || !drag.ghost) return;
    const edge = 70, v = drag.y < edge ? -(edge - drag.y) / 4 : drag.y > innerHeight - edge ? (drag.y - innerHeight + edge) / 4 : 0;
    if (v) { scrollBy(0, v); place(); }
    drag.raf = requestAnimationFrame(tick);
  };
  const lift = () => {
    const r = drag.w.getBoundingClientRect(), g = drag.w.cloneNode(true);
    g.classList.add('dash-ghost'); g.removeAttribute('data-w');
    Object.assign(g.style, { left: r.left + 'px', top: r.top + 'px', width: r.width + 'px' });
    document.body.appendChild(g);
    drag.ghost = g;
    drag.w.classList.add('dragging'); d.classList.add('moving');
    buzz(8);
    drag.raf = requestAnimationFrame(tick);
  };
  const drop = () => {
    if (!drag) return;
    const { w, ghost, raf } = drag; drag = null;
    cancelAnimationFrame(raf);
    d.classList.remove('moving');
    if (!ghost) return;
    const r = w.getBoundingClientRect();
    ghost.style.transition = 'transform .18s ease, opacity .18s'; ghost.style.transform = 'translate(' + (r.left - parseFloat(ghost.style.left)) + 'px,' + (r.top - parseFloat(ghost.style.top)) + 'px)';
    setTimeout(() => { ghost.remove(); w.classList.remove('dragging'); }, 180);
    dashSave();
  };
  d.addEventListener('pointerdown', e => {
    const w = e.target.closest('.w'); if (!w || e.button > 0 || e.target.closest('button, a, input')) return;
    if (e.pointerType !== 'mouse' && !e.target.closest('.grip')) return;     // touch: only the handle, so scrolling still works
    drag = { w, id: e.pointerId, x0: e.clientX, y0: e.clientY, x: e.clientX, y: e.clientY };
    if (e.pointerType !== 'mouse') lift();
    try { d.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
    e.preventDefault();
  });
  d.addEventListener('pointermove', e => {
    if (!drag || e.pointerId !== drag.id) return;
    drag.x = e.clientX; drag.y = e.clientY;
    if (!drag.ghost) { if (Math.hypot(drag.x - drag.x0, drag.y - drag.y0) < 5) return; lift(); }
    drag.ghost.style.transform = 'translate(' + (drag.x - drag.x0) + 'px,' + (drag.y - drag.y0) + 'px)';
    place();
  });
  d.addEventListener('pointerup', drop);
  d.addEventListener('pointercancel', drop);
  d.addEventListener('lostpointercapture', drop);
}

// Freeform tiles: re-measure whenever a tile changes size (data arriving, a narrower window) or is replaced, and let
// you move tiles by dragging them (a mouse anywhere on the tile, touch by the ⠿ handle) and resize them by the corner.
function bindGrid(d) {
  let drag = null, raf = 0;
  const relayout = () => { if (raf) return; raf = requestAnimationFrame(() => { raf = 0; if (d.isConnected) gridLayout(d, drag && drag.over); }); };
  if (window.ResizeObserver) {
    gridRO = new ResizeObserver(relayout);
    const watch = () => { d.querySelectorAll(':scope > .w').forEach(w => gridRO.observe(w)); relayout(); };
    gridMO = new MutationObserver(watch); gridMO.observe(d, { childList: true });
    watch();
  }
  gridLayout(d);
  if (!d.classList.contains('editing')) return;
  const cell = () => { const r = d.getBoundingClientRect(), gap = parseFloat(getComputedStyle(d).columnGap) || 20; return { r, gap, cw: (r.width - gap * (GRID - 1)) / GRID }; };
  const shift = over => {
    if (drag.over && over.x === drag.over.x && over.y === drag.over.y && over.w === drag.over.w) return;
    drag.over = over;
    const ws = [...d.querySelectorAll(':scope > .w')].filter(w => w !== drag.w), was = new Map(ws.map(w => [w, w.getBoundingClientRect()]));
    gridLayout(d, over);
    ws.forEach(w => {
      const a = was.get(w), b = w.getBoundingClientRect(), dx = a.left - b.left, dy = a.top - b.top;
      if (!dx && !dy) return;
      w.style.transition = 'none'; w.style.transform = 'translate(' + dx + 'px,' + dy + 'px)';
      w.offsetWidth; w.style.transition = 'transform .2s ease'; w.style.transform = '';
    });
  };
  const place = () => {
    if (!drag) return;
    const { r, gap, cw } = cell(), t = drag.t;
    if (drag.resize) {
      const w = Math.max(4, Math.min(GRID - t.x, Math.round((drag.x - drag.left + gap) / (cw + gap))));
      return shift({ k: t.k, x: t.x, y: t.y, w });
    }
    const left = drag.r0.left + drag.x - drag.x0 - r.left, top = drag.r0.top + drag.y - drag.y0 - r.top;
    shift({ k: t.k, x: Math.max(0, Math.min(GRID - t.w, Math.round(left / (cw + gap)))), y: Math.max(0, Math.round(top / ROW)), w: t.w });
  };
  const tick = () => {
    if (!drag) return;
    const edge = 70, v = drag.y < edge ? -(edge - drag.y) / 4 : drag.y > innerHeight - edge ? (drag.y - innerHeight + edge) / 4 : 0;
    if (v) { scrollBy(0, v); place(); }
    drag.raf = requestAnimationFrame(tick);
  };
  const lift = () => {
    drag.lifted = true; d.classList.add('moving'); buzz(8);
    if (!drag.resize) {
      const g = drag.w.cloneNode(true);
      g.classList.add('dash-ghost'); g.removeAttribute('data-w'); g.style.gridColumn = g.style.gridRow = '';
      Object.assign(g.style, { left: drag.r0.left + 'px', top: drag.r0.top + 'px', width: drag.r0.width + 'px' });
      document.body.appendChild(g); drag.ghost = g; drag.w.classList.add('dragging');
    }
    drag.raf = requestAnimationFrame(tick);
  };
  const drop = () => {
    if (!drag) return;
    const { w, ghost, lifted } = drag; cancelAnimationFrame(drag.raf);
    const over = drag.over; drag = null;
    d.classList.remove('moving');
    if (!lifted) return;
    gridLayout(d, over); gridKeep(d);
    if (ghost) {
      const r = w.getBoundingClientRect();
      ghost.style.transition = 'transform .18s ease, opacity .18s'; ghost.style.transform = 'translate(' + (r.left - parseFloat(ghost.style.left)) + 'px,' + (r.top - parseFloat(ghost.style.top)) + 'px)';
      setTimeout(() => { ghost.remove(); w.classList.remove('dragging'); }, 180);
    }
  };
  d.addEventListener('pointerdown', e => {
    const w = e.target.closest('.w'); if (!w || !w._g || e.button > 0 || e.target.closest('button, a, input')) return;
    const resize = !!e.target.closest('.rsz');
    if (e.pointerType !== 'mouse' && !resize && !e.target.closest('.grip')) return;     // touch: the handle or the corner, so scrolling still works
    const r0 = w.getBoundingClientRect();
    drag = { w, t: { ...w._g }, resize, id: e.pointerId, x0: e.clientX, y0: e.clientY, x: e.clientX, y: e.clientY, r0, left: r0.left, over: null };
    if (e.pointerType !== 'mouse') lift();
    try { d.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
    e.preventDefault();
  });
  d.addEventListener('pointermove', e => {
    if (!drag || e.pointerId !== drag.id) return;
    drag.x = e.clientX; drag.y = e.clientY;
    if (!drag.lifted) { if (Math.hypot(drag.x - drag.x0, drag.y - drag.y0) < 5) return; lift(); }
    if (drag.ghost) drag.ghost.style.transform = 'translate(' + (drag.x - drag.x0) + 'px,' + (drag.y - drag.y0) + 'px)';
    place();
  });
  d.addEventListener('pointerup', drop);
  d.addEventListener('pointercancel', drop);
  d.addEventListener('lostpointercapture', drop);
}

/* ---------- Sparklines: last 30 days of each account's balance ---------- */
async function balanceSparks(accounts) {
  const start = addDays(todayIso(), -30), end = todayIso(), out = {};
  const gs = (await getAll('/transactions', { start, end, type: 'all' })).map(normGroup);     // one request for every account
  accounts.forEach(a => {
    const byDay = {}; gs.forEach(g => { const v = signed(g, a.id); if (v) { const d = String(g.date).slice(0, 10); byDay[d] = (byDay[d] || 0) + v; } });
    let bal = a.balance; const vals = [];
    for (let i = 0; i <= 30; i++) { const d = addDays(end, -i); vals.push(bal); bal -= byDay[d] || 0; }
    out[a.id] = vals.reverse();
  });
  return out;
}
function sparkline(vals, owed) {
  const v = owed ? vals.map(x => Math.max(0, -x)) : vals, W = 64, H = 20;
  const lo = Math.min(...v), hi = Math.max(...v), rng = hi - lo || 1;
  const pts = v.map((y, i) => [(i / (v.length - 1)) * W, H - 2 - ((y - lo) / rng) * (H - 4)]);
  const up = v[v.length - 1] >= v[0], good = owed ? !up : up;
  const tip = (owed ? 'Owed ' : 'Balance ') + money0(v[0]) + ' → ' + money0(v[v.length - 1]) + ' over 30 days';
  return '<svg class="spark ' + (hi === lo ? 'flat' : good ? 'good' : 'bad') + '" viewBox="0 0 ' + W + ' ' + H + '" width="' + W + '" height="' + H + '" data-tip="' + esc(tip) + '" aria-hidden="true">' +
    '<polyline points="' + pts.map(p => p[0].toFixed(1) + ',' + p[1].toFixed(1)).join(' ') + '"/><circle cx="' + pts[pts.length - 1][0] + '" cy="' + pts[pts.length - 1][1].toFixed(1) + '" r="2"/></svg>';
}

/* ---------- Daily spending heatmap ---------- */
function heatmapPanel(cur, groups) {
  const by = {}, cnt = {};
  groups.forEach(g => { const d = String(g.date).slice(0, 10); by[d] = (by[d] || 0) + g.total; cnt[d] = (cnt[d] || 0) + 1; });
  const dim = new Date(cur.y, cur.m + 1, 0).getDate(), lead = new Date(cur.y, cur.m, 1).getDay(), t = todayIso();
  const max = Math.max(1, ...Object.values(by)), days = Object.keys(by).length;
  let cells = '';
  for (let i = 0; i < lead; i++) cells += '<span class="hm-cell pad"></span>';
  for (let d = 1; d <= dim; d++) {
    const iso = cur.start.slice(0, 8) + pad(d), v = by[iso] || 0, fut = iso > t;
    const pct = v ? Math.round(18 + 82 * Math.sqrt(v / max)) : 0;
    cells += '<button type="button" class="hm-cell' + (fut ? ' fut' : '') + (iso === t ? ' today' : '') + '"' + (v ? ' style="--p:' + pct + '%"' : '') +
      ' data-tip="' + esc(fmtDay(iso) + (v ? ' · ' + money(v) + ' · ' + cnt[iso] + ' purchase' + (cnt[iso] === 1 ? '' : 's') : fut ? '' : ' · nothing spent')) + '"' +
      (v ? ' data-onclick="App.go(\'#/transactions?search=date_on:' + iso + '\')"' : ' disabled') + '><span>' + d + '</span></button>';
  }
  const top = Object.entries(by).sort((a, b) => b[1] - a[1])[0];
  const passed = cur.start.slice(0, 7) === t.slice(0, 7) ? +t.slice(8, 10) : dim, free = Math.max(0, passed - days);
  return '<section class="panel"><h2>Daily spending</h2><p class="lead">Darker days cost more · tap one to see it</p>' +
    '<div class="hm"><div class="hm-dow">' + ['S', 'M', 'T', 'W', 'T', 'F', 'S'].map(x => '<span>' + x + '</span>').join('') + '</div><div class="hm-grid">' + cells + '</div></div>' +
    '<div class="hm-foot"><span>' + (top ? 'Biggest day: <strong class="num">' + money0(top[1]) + '</strong> on ' + fmtDay(top[0]) : 'No spending yet') + '</span><span>' + free + ' no-spend day' + (free === 1 ? '' : 's') + '</span></div></section>';
}

/* ---------- Money flow (income → spending categories + kept) ---------- */
// The chart is laid out at the width it is shown at (one SVG unit = one pixel), so the labels keep their real
// font size and spacing instead of being scaled up on a wide screen or down on a phone.
function sankeyPanel(sources, income, cats, cur) {
  let left = sources.map(x => ({ name: x.name, v: absDiff(x) })).filter(x => x.v > 0).sort((a, b) => b.v - a.v);
  if (!left.length && income > 0) left = [{ name: 'Income', v: income }];
  if (left.length > 4) { const rest = left.slice(3); left = left.slice(0, 3); left.push({ name: rest.length + ' other sources', v: rest.reduce((s, x) => s + x.v, 0) }); }
  let right = cats.map(c => ({ name: c.name, v: c.amt, id: c.id })).sort((a, b) => b.v - a.v);
  if (right.length > 7) { const rest = right.slice(6); right = right.slice(0, 6); right.push({ name: rest.length + ' other categories', v: rest.reduce((s, x) => s + x.v, 0) }); }
  const inc = left.reduce((s, x) => s + x.v, 0), spend = right.reduce((s, x) => s + x.v, 0);
  if (!inc && !spend) return '';
  left.forEach(x => { x.kind = 'in'; });
  right.forEach(x => { x.kind = 'out'; });
  if (spend > inc) left.push({ name: 'From savings', v: spend - inc, kind: 'save' });
  if (inc > spend) right.push({ name: 'Kept', v: inc - spend, kind: 'kept' });
  const d = { left, right, inc, spend };
  return '<section class="panel chart sankey" data-sk="' + esc(JSON.stringify(d)) + '"><h2>Money flow</h2><p class="lead">Where ' + (cur.all ? 'all your' : esc(cur.label) + '’s') + ' income went · hover a band for details</p>' +
    sankeySvg(d, innerWidth < 900 ? innerWidth - 72 : 900) + '</section>';
}
// Shorten a label with … until it fits in px at the chart's label font
let skCtx = null;
function fitText(t, px) {
  if (!skCtx) { skCtx = document.createElement('canvas').getContext('2d'); skCtx.font = '500 12.5px ' + getComputedStyle(document.body).fontFamily; }
  if (skCtx.measureText(t).width <= px) return t;
  let n = t.length;
  while (n > 1 && skCtx.measureText(t.slice(0, n).trimEnd() + '…').width > px) n--;
  return t.slice(0, n).trimEnd() + '…';
}
function sankeySvg({ left, right, inc, spend }, W) {
  left = left.map(n => ({ ...n })); right = right.map(n => ({ ...n }));
  W = Math.max(280, Math.round(W));
  // On a very wide card the bands would stretch thin, so the chart keeps to 1100px in the middle of it
  const CW = Math.min(W, 1100), ox = (W - CW) / 2;
  const total = Math.max(inc, spend), narrow = CW < 560, rows = Math.max(left.length, right.length);
  const LW = narrow ? Math.round(CW * .35) : Math.min(230, Math.max(160, Math.round(CW * .2))), NW = 12, GAP = 10, LINE = 34;
  const H0 = Math.max(220, (LINE + 8) * rows + 24);
  const k = (H0 - 20 - GAP * (rows - 1)) / total;
  // Each side node gets at least a label's height of room, so its label can sit right beside it
  left.concat(right).forEach(n => { n.h = Math.max(2, n.v * k); n.slot = Math.max(n.h + GAP, LINE); });
  const tall = nodes => nodes.reduce((s, n) => s + n.slot, 0) - GAP;
  const H = Math.max(H0, Math.ceil(Math.max(tall(left), tall(right))) + 20);
  const stack = (nodes, x) => { let y = (H - tall(nodes)) / 2; nodes.forEach(n => { n.x = x; n.y = y + (n.slot - GAP - n.h) / 2; y += n.slot; }); };
  const xl = ox + LW, xm = W / 2 - NW / 2, xr = ox + CW - LW - NW;
  stack(left, xl); stack(right, xr);
  const mh = total * k, my = (H - mh) / 2;
  const col = n => ({ in: 'var(--income)', save: 'var(--warn)', out: 'var(--spend)', kept: 'var(--good)' })[n.kind];
  const band = (x0, y0, x1, y1, h) => { const c = (x0 + x1) / 2; return 'M' + x0 + ',' + y0 + 'C' + c + ',' + y0 + ' ' + c + ',' + y1 + ' ' + x1 + ',' + y1 + 'L' + x1 + ',' + (y1 + h) + 'C' + c + ',' + (y1 + h) + ' ' + c + ',' + (y0 + h) + ' ' + x0 + ',' + (y0 + h) + 'Z'; };
  let links = '', nodes = '', my1 = my, my2 = my;
  const share = (n, of) => of ? ' (' + Math.round(n.v / of * 100) + '%)' : '';
  left.forEach(n => { links += '<path class="lk" d="' + band(xl + NW, n.y, xm, my1, n.h) + '" fill="' + col(n) + '" data-tip="' + esc(n.name + ' → ' + money0(n.v) + share(n, total)) + '"/>'; my1 += n.h; });
  right.forEach(n => { links += '<path class="lk" d="' + band(xm + NW, my2, xr, n.y, n.h) + '" fill="' + col(n) + '" data-tip="' + esc(n.name + ' · ' + money0(n.v) + share(n, n.kind === 'kept' ? inc : spend) + (n.kind === 'kept' ? ' of income' : n.kind === 'out' ? ' of spending' : '')) + '"' +
    (n.id ? ' style="cursor:pointer" data-onclick="App.go(\'#/transactions?category=' + n.id + '\')"' : '') + '/>'; my2 += n.h; });
  const label = (n, anchor, x, nm = fitText(n.name, LW - 14)) => '<text x="' + x + '" y="' + (n.ly - 2) + '" text-anchor="' + anchor + '" class="sk-name">' + (nm !== n.name ? '<title>' + esc(n.name) + '</title>' : '') + esc(nm) + '</text>' +
    '<text x="' + x + '" y="' + (n.ly + 12) + '" text-anchor="' + anchor + '" class="sk-amt amtx">' + money0(n.v) + '</text>';
  // Keep two-line labels apart and inside the chart: centre each on its node, push it below the one above,
  // pull any that run off the bottom back up, then make sure the first one still clears the top edge
  const TOP = 14, BOT = H - 18;
  const spread = col2 => {
    let prev = -Infinity; col2.forEach(n => { n.ly = Math.max(n.y + n.h / 2, prev + LINE, TOP); prev = n.ly; });
    let next = Infinity; [...col2].reverse().forEach(n => { n.ly = Math.min(n.ly, next - LINE, BOT); next = n.ly; });
    prev = -Infinity; col2.forEach(n => { n.ly = Math.max(n.ly, prev + LINE, TOP); prev = n.ly; });
  };
  spread(left); spread(right);
  left.forEach(n => { nodes += '<rect x="' + n.x + '" y="' + n.y + '" width="' + NW + '" height="' + n.h + '" rx="3" fill="' + col(n) + '"/>' + label(n, 'end', xl - 8); });
  right.forEach(n => { nodes += '<rect x="' + n.x + '" y="' + n.y + '" width="' + NW + '" height="' + n.h + '" rx="3" fill="' + col(n) + '"/>' + label(n, 'start', xr + NW + 8); });
  nodes += '<rect x="' + xm + '" y="' + my + '" width="' + NW + '" height="' + mh + '" rx="3" fill="var(--text)" opacity=".75"/>';
  return '<svg viewBox="0 0 ' + W + ' ' + H + '" data-w="' + W + '" role="img" aria-label="Income flowing into spending categories">' + links + nodes + '</svg>';
}
// Redraw each money-flow chart at the width its card actually has, now and whenever the card changes size
const skSeen = new WeakSet();
const skObs = 'ResizeObserver' in window ? new ResizeObserver(es => es.forEach(e => fitSankey1(e.target))) : null;
function fitSankey1(sec) {
  const svg = sec.querySelector('svg'), w = Math.round(sec.clientWidth - parseFloat(getComputedStyle(sec).paddingLeft) - parseFloat(getComputedStyle(sec).paddingRight));
  if (!svg || !sec.isConnected || w <= 0 || Math.abs(w - +svg.dataset.w) < 2) return;
  try { svg.outerHTML = sankeySvg(JSON.parse(sec.dataset.sk), w); } catch (e) { /* keep the chart as drawn */ }
}
function fitSankey() {
  document.querySelectorAll('#view .sankey[data-sk]').forEach(sec => {
    fitSankey1(sec);
    if (skObs && !skSeen.has(sec)) { skSeen.add(sec); skObs.observe(sec); }
  });
}

/* ---------- Natural-language quick add ---------- */
const WDAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
const MONS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
const FILLER = new Set(['on', 'with', 'via', 'using', 'at', 'for', 'to', 'from', 'paid', 'spent', 'bought', 'got', 'and', 'the', 'a', 'my', 'in']);
const GENERIC = new Set(['card', 'checking', 'savings', 'saving', 'account', 'bank', 'credit', 'debit', 'loan', 'gold', 'the']);
function nlDate(ws, i) {
  const w = ws[i].toLowerCase().replace(/[,.]$/, ''), t = new Date(); t.setHours(12, 0, 0, 0);
  const iso = d => isoDate(d);
  if (w === 'today') return [iso(t), 1];
  if (w === 'yesterday') { t.setDate(t.getDate() - 1); return [iso(t), 1]; }
  if (w === 'tomorrow') { t.setDate(t.getDate() + 1); return [iso(t), 1]; }
  if (/^\d{1,2}$/.test(w) && /^days?$/i.test(ws[i + 1] || '') && /^ago$/i.test(ws[i + 2] || '')) { t.setDate(t.getDate() - +w); return [iso(t), 3]; }
  const wd = WDAYS.findIndex(d => w.length >= 3 && d.startsWith(w) && (w.length >= 3 && (w === d || w === d.slice(0, 3) || w === d.slice(0, 4))));
  if (wd >= 0) { let back = (t.getDay() - wd + 7) % 7; if (back === 0 && /^last$/i.test(ws[i - 1] || '')) back = 7; t.setDate(t.getDate() - back); return [iso(t), 1]; }
  let m = /^(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?$/.exec(w);
  if (m) { const y = m[3] ? (m[3].length === 2 ? 2000 + +m[3] : +m[3]) : t.getFullYear(); const d = new Date(y, +m[1] - 1, +m[2], 12); if (!m[3] && d > t) d.setFullYear(y - 1); return [iso(d), 1]; }
  const mi = MONS.findIndex(x => w.startsWith(x) && w.length <= 9);
  if (mi >= 0 && /^\d{1,2}(st|nd|rd|th)?,?$/i.test(ws[i + 1] || '')) { const d = new Date(t.getFullYear(), mi, parseInt(ws[i + 1], 10), 12); if (d > t) d.setFullYear(d.getFullYear() - 1); return [iso(d), 2]; }
  return null;
}
function nlAccount(tok) {
  const L = S.lists, w = tok.toLowerCase(); if (w.length < 3) return null;
  const pool = L.own.filter(a => isAsset(a) || isLiab(a));
  const full = pool.filter(a => a.name.toLowerCase() === w); if (full.length) return full[0];
  const hits = pool.filter(a => a.name.toLowerCase().split(/[\s\-–]+/).some(x => x.startsWith(w) && (!GENERIC.has(w) || x === w)));
  return hits.length === 1 ? hits[0] : hits.find(a => a.name.toLowerCase().startsWith(w)) || null;
}
function nlParse(text, submit) {
  const f = S.form; if (!f || f.id) return;
  collectTx();
  if (!f.nlBase) { const s0 = f.splits[0]; f.nlBase = { type: f.type, date: f.date, main: f.main, src: f.src, dst: f.dst, split: { amount: s0.amount, description: s0.description, counter: s0.counter, category: s0.category } }; }
  const base = f.nlBase, L = S.lists, ws = text.trim().split(/\s+/).filter(Boolean), used = new Set(), out = {};
  // dates first (so "sep 12" isn't read as an amount of 12)
  for (let i = 0; i < ws.length; i++) { if (used.has(i) || out.date) continue; const r = nlDate(ws, i); if (r) { out.date = r[0]; for (let j = 0; j < r[1]; j++) used.add(i + j); if (/^last$/i.test(ws[i - 1] || '')) used.add(i - 1); } }
  ws.forEach((w, i) => { if (!used.has(i) && out.amount == null && /^\$?\d+(?:[.,]\d{1,2})?\$?$/.test(w)) { out.amount = w.replace(/\$/g, '').replace(',', '.'); used.add(i); } });
  ws.forEach((w, i) => {
    const lw = w.toLowerCase();
    if (used.has(i)) return;
    if (/^(income|salary|paycheck|payday|refund|received|deposit|earned)$/.test(lw)) { out.type = 'deposit'; used.add(i); if (!/^(received|earned)$/.test(lw)) out.kw = lw[0].toUpperCase() + lw.slice(1); if (/^(salary|paycheck)$/.test(lw)) out.catHint = 'Salary'; }
    else if (/^(transfer|transferred|moved|move)$/.test(lw)) { out.type = 'transfer'; used.add(i); }
    else if (lw[0] === '#' && lw.length > 1) { const c = L.categories.find(c => c.name.toLowerCase().startsWith(lw.slice(1))); out.category = c ? c.name : w.slice(1); used.add(i); }
  });
  const accs = [];
  ws.forEach((w, i) => { if (used.has(i) || FILLER.has(w.toLowerCase())) return; const a = nlAccount(w.replace(/[,.]$/, '')); if (a && !accs.some(x => x.a.id === a.id)) { accs.push({ a, i, from: /^from$/i.test(ws[i - 1] || ''), to: /^to$/i.test(ws[i - 1] || '') }); used.add(i); } });
  // "for groceries" → category if it names one
  ws.forEach((w, i) => { if (!used.has(i) && /^for$/i.test(ws[i - 1] || '') && !out.category) { const c = L.categories.find(c => c.name.toLowerCase().startsWith(w.toLowerCase())); if (c && w.length >= 3) { out.category = c.name; used.add(i); } } });
  if (accs.length >= 2 && !out.type) out.type = 'transfer';
  const payeeWords = ws.filter((w, i) => !used.has(i) && !FILLER.has(w.toLowerCase()));
  let payee = payeeWords.join(' ').replace(/[,.]$/, '');
  const type = out.type || base.type;
  if (payee) {
    const pool = type === 'deposit' ? L.revenue : L.expense, q = payee.toLowerCase();
    const hit = pool.find(a => a.name.toLowerCase() === q) || pool.find(a => a.name.toLowerCase().startsWith(q)) || pool.find(a => a.name.toLowerCase().replace(/[^a-z0-9]/g, '').includes(q.replace(/[^a-z0-9]/g, '')) && q.length >= 4);
    payee = hit ? hit.name : payee.replace(/\b\w/g, c => c.toUpperCase());
  }
  // rebuild the form from the base + what was understood
  f.type = type; f.date = out.date || base.date;
  const sp = f.splits[0];
  Object.assign(sp, base.split);
  if (out.amount) sp.amount = out.amount;
  if (payee) { sp.description = payee; if (type !== 'transfer') sp.counter = payee; }
  else if (out.kw) sp.description = out.kw;
  if (out.category || out.catHint) sp.category = out.category || out.catHint;
  f.main = base.main; f.src = base.src; f.dst = base.dst;
  if (type === 'transfer') {
    const from = accs.find(x => x.from) || accs.find(x => !x.to) || accs[0], to = accs.find(x => x !== from);
    if (from) f.src = from.a.id; if (to) f.dst = to.a.id;
    if (!payee && from && to) sp.description = 'Transfer to ' + to.a.name;
  } else if (accs[0]) f.main = accs[0].a.id;
  const chip = (l, v) => '<span class="nlchip"><em>' + l + '</em>' + esc(v) + '</span>';
  f.nl = text;
  f.nlChips = text.trim() ? [
    type !== base.type ? chip('Type', { deposit: 'Income', transfer: 'Transfer', withdrawal: 'Expense' }[type]) : '',
    out.amount ? chip('Amount', money(num(out.amount))) : '',
    out.date ? chip('Date', dayLabel(out.date)) : '',
    type === 'transfer' ? (accs.length ? chip('From', (L.byId[f.src] || {}).name || '?') + (f.dst ? chip('To', (L.byId[f.dst] || {}).name || '?') : '') : '') : accs[0] ? chip('Account', accs[0].a.name) : '',
    payee && type !== 'transfer' ? chip(type === 'deposit' ? 'From' : 'Payee', payee) : '',
    sp.category && (out.category || out.catHint) ? chip('Category', sp.category) : '',
  ].join('') : '';
  const caret = el('nlq') ? el('nlq').selectionStart : text.length;
  renderTxForm();
  const q = el('nlq'); if (q) { q.focus(); try { q.setSelectionRange(caret, caret); } catch (e) { /* ignore */ } }
  if (payee && type !== 'transfer' && !out.category && !out.catHint) payeeFill(0, payee);
  if (submit) {
    if (num(sp.amount) > 0 && sp.description.trim()) el('txForm').requestSubmit();
    else { const miss = el('drawerBody').querySelector(num(sp.amount) > 0 ? '[data-k=description]' : '[data-k=amount]'); if (miss) miss.focus(); toast(num(sp.amount) > 0 ? 'Add a description' : 'Add an amount'); }
  }
}

/* ---------- After each page paint ---------- */
function afterPaint2(r) {
  bindFeed(); bindDash(); drawToggles(); fitSankey();
  S.kIdx = -1;
}
Object.assign(window.App, {
  buzz, togglePrivacy, toggleDensity, drawToggles, pick, pickFilter, pickKey, pickHover, pickChoose, afterPaint2, balanceSparks, sparkline, heatmapPanel, sankeyPanel, fitSankey,
  dashboard, dashButton, dashEdit, dashMove, dashWide, dashHide, dashReset, dashCols, dashPart, dashShows, dashShift, dashNudge, dashTidy, nlParse, shortcutsSheet,
});
