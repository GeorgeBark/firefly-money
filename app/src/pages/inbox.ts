import { AuthError, api, eachLimited, getAll } from '../core/api';
import { showLogin } from '../core/auth';
import { App, S, el, esc, fmtDate, money, todayIso } from '../core/base';
import { head, opt, toast } from '../core/dom';
import { normGroup } from '../core/feed';
import { addDays } from '../core/helpers';
import { lists } from '../core/lists';
import { VIEWS, parseHash } from '../core/router';

/* ================= Categorize inbox ================= */
const NOISE = new Set(['SQ', 'TST', 'DD', 'POS', 'ACH', 'WEB', 'PMT', 'PAYMENT', 'PURCHASE', 'IC', 'THE', 'APLPAY', 'PP', 'PAYPAL', 'ZSK', 'IT', 'RAZ', 'DEBIT', 'CARD', 'ONLINE', 'INST', 'XFER']);
function descKey(d) { return String(d || '').toUpperCase().replace(/[^A-Z ]+/g, ' ').split(/\s+/).filter(w => w.length > 1 && !NOISE.has(w)).slice(0, 2).join(' '); }
const bump = (o, k, v) => { if (!k) return; const m = o[k] = o[k] || {}; m[v] = (m[v] || 0) + 1; };
async function inboxHistory() {
  if (S.inboxHist && Date.now() - S.inboxHist.t < 600000) return S.inboxHist.v;
  const all = await getAll('/transactions', { type: 'all', start: addDays(todayIso(), -365), end: todayIso() });
  const h = { payee: {}, key: {}, tok: {}, bud: {}, payeeBud: {} };
  all.map(normGroup).forEach(g => g.splits.forEach(s => {
    if (s.type === 'transfer') return;
    const payee = s.type === 'deposit' ? s.source_id : s.destination_id, k = descKey(s.description);
    if (s.category) { bump(h.payee, payee, s.category); bump(h.key, k, s.category); bump(h.tok, k.split(' ')[0], s.category); }
    if (s.budget_id) { bump(h.bud, s.category, s.budget_id); bump(h.payeeBud, payee, s.budget_id); }
  }));
  S.inboxHist = { t: Date.now(), v: h };
  return h;
}
function suggest(s, h) {
  const score: any = {}, payee = s.type === 'deposit' ? s.source_id : s.destination_id, k = descKey(s.description);
  const addAll = (m, w) => { if (!m) return; const t = Object.values<any>(m).reduce((a, b) => a + b, 0); Object.entries<any>(m).forEach(([c, n]) => { score[c] = (score[c] || 0) + w * n / t; }); };
  const generic = /^(cash|cash account|venmo|zelle|paypal)$/i.test(s.type === 'deposit' ? s.source_name : s.destination_name);
  addAll(generic ? null : h.payee[payee], 3); addAll(h.key[k], 2); addAll(h.tok[k.split(' ')[0]], .7);
  const tot = Object.values<any>(score).reduce((a, b) => a + b, 0) || 1;
  const cats = Object.entries<any>(score).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([c, v]) => ({ c, pct: Math.round(v / tot * 100) }));
  const pickBud = cat => { const m = (!generic && h.payeeBud[payee]) || h.bud[cat]; if (!m) return ''; return Object.entries<any>(m).sort((a, b) => b[1] - a[1])[0][0]; };
  return { cats, pickBud, generic };
}
VIEWS.inbox = async (r, paint) => {
  await lists();
  const q = 'has_no_category:true';
  const [found, h] = await Promise.all([getAll('/search/transactions', { query: q, search: q }), inboxHistory()]);
  const items = [];
  found.map(normGroup).forEach(g => { if (g.type !== 'transfer' && g.splits.some(s => !s.category)) items.push(g); });
  items.sort((a, b) => String(b.date).localeCompare(String(a.date)));
  if (!paint.live) return;
  S.inbox = { items, i: 0, h, done: 0, paint };
  renderInbox();
};
function renderInbox() {
  const I = S.inbox, L = S.lists, g = I.items[I.i];
  if (!g) {
    I.paint(head('Categorize', '', '') + '<section class="panel"><div class="center-empty" style="padding:70px 20px"><div style="font-size:40px">✓</div><h2 style="font-size:18px;margin:10px 0 4px">All caught up</h2>' +
      (I.done ? 'You categorized ' + I.done + ' transaction' + (I.done === 1 ? '' : 's') + '.' : 'Every transaction has a category.') + '</div></section>');
    return;
  }
  const s = g.splits.find(x => !x.category) || g.splits[0], sug = suggest(s, I.h), top = sug.cats[0];
  const payeeName = s.type === 'deposit' ? s.source_name : s.destination_name;
  const payeeId = s.type === 'deposit' ? s.source_id : s.destination_id;
  const similar = sug.generic ? [] : I.items.filter((x, j) => j !== I.i && x.splits.some(y => !y.category && (y.type === 'deposit' ? y.source_id : y.destination_id) === payeeId));
  I.cur = { g, s, payeeName, similar, generic: sug.generic, pickBud: sug.pickBud };
  const bud = top ? sug.pickBud(top.c) : '';
  I.paint(head('Categorize', (I.items.length - I.i) + ' left' + (I.done ? ' · ' + I.done + ' done this session' : ''), '<button class="btn" data-onclick="App.inboxSkip()">Skip <span class="neutral">S</span></button>') +
    '<div class="track" style="margin:-10px 0 24px"><div class="fill good" style="width:' + (I.done / (I.done + I.items.length) * 100).toFixed(1) + '%"></div></div>' +
    '<section class="panel" style="max-width:760px">' +
      '<div class="row" style="align-items:flex-start"><div><div class="eyebrow">' + fmtDate(g.date) + ' · ' + esc(s.type === 'deposit' ? 'Income' : 'Expense') + '</div>' +
        '<div style="font-size:22px;font-weight:600;letter-spacing:-.01em;margin:4px 0">' + esc(s.description) + '</div>' +
        '<div class="sub-s">' + esc(s.source_name) + ' → ' + esc(s.destination_name) + (g.splits.length > 1 ? ' · part of “' + esc(g.title) + '”' : '') + '</div></div>' +
        '<div class="big num ' + (s.type === 'deposit' ? 'pos' : '') + '" style="font-size:34px">' + money(s.amount) + '</div></div>' +
      '<div style="margin:24px 0 6px" class="eyebrow">' + (sug.cats.length ? 'Suggestions' : 'No suggestion yet — pick a category') + '</div>' +
      '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:18px">' + sug.cats.map((c, i) => '<button class="btn' + (i === 0 ? ' primary' : '') + '" data-onclick="App.inboxPick(' + i + ')" data-cat="' + esc(c.c) + '"><span class="neutral" style="color:inherit;opacity:.6">' + (i + 1) + '</span> ' + esc(c.c) + ' <span style="opacity:.6">' + c.pct + '%</span></button>').join('') + '</div>' +
      '<form id="inboxForm" data-onsubmit="event.preventDefault();App.inboxSave()"><div class="grid2"><label>Category<input type="text" id="ib-cat" list="ib-dl" value="' + esc(top ? top.c : '') + '" required></label>' +
        (s.type === 'withdrawal' ? '<label>Budget<select id="ib-bud">' + opt('', 'None', bud) + L.budgets.filter(b => b.active).map(b => opt(b.id, b.name, bud)).join('') + '</select></label>' : '<span></span>') + '</div>' +
        '<datalist id="ib-dl">' + L.categories.map(c => '<option value="' + esc(c.name) + '">').join('') + '</datalist>' +
        (similar.length ? '<label class="check"><input type="checkbox" id="ib-similar" checked> Also do the ' + similar.length + ' other uncategorized from ' + esc(payeeName) + '</label>' : '') +
        '<label class="check"><input type="checkbox" id="ib-rule"' + (similar.length >= 1 && !sug.generic ? ' checked' : '') + '> Always do this for ' + (sug.generic ? '“' + esc(descKey(s.description)) + '”' : esc(payeeName)) + ' from now on (creates a rule)</label>' +
        '<div style="display:flex;gap:10px;margin-top:6px"><button class="btn primary" id="ib-save">Save <span style="opacity:.6">↵</span></button><button type="button" class="btn" data-onclick="App.editTx(\'' + g.id + '\')">Open full transaction</button>' +
        (I.i > 0 ? '<button type="button" class="link" data-onclick="App.inboxBack()">← Back</button>' : '') + '</div></form></section>' +
    '<p class="sub-s" style="margin-top:14px">Keys: <strong>1–3</strong> pick a suggestion · <strong>Enter</strong> save · <strong>S</strong> skip. Suggestions come from how you categorized similar transactions over the past year.</p>');
}
function inboxPick(i) { const b = document.querySelectorAll<HTMLElement>('[data-cat]')[i]; if (!b) return; el('ib-cat').value = b.dataset.cat; const bud = S.inbox.cur.pickBud(b.dataset.cat); if (el('ib-bud') && bud) el('ib-bud').value = bud; }
function inboxSkip() { S.inbox.i++; renderInbox(); }
function inboxBack() { S.inbox.i = Math.max(0, S.inbox.i - 1); renderInbox(); }
async function ensureInboxGroup() {
  const groups = await getAll('/rule-groups');
  const g = groups.find(x => x.attributes.title === '5. Inbox rules');
  if (g) return String(g.id);
  const res = await api('/rule-groups', { method: 'POST', body: { title: '5. Inbox rules', description: 'Created from the Categorize inbox. Runs after your other groups.', active: true } });
  return String(res.data.id);
}
async function inboxSave() {
  const I = S.inbox, { g, s, similar, payeeName, generic } = I.cur, L = S.lists;
  const cat = el('ib-cat').value.trim(); if (!cat) return toast('Pick a category first.');
  const bud = el('ib-bud') ? el('ib-bud').value : '';
  const alsoSimilar = el('ib-similar') && el('ib-similar').checked, makeRule = el('ib-rule') && el('ib-rule').checked;
  const btn = el('ib-save'); btn.disabled = true; btn.textContent = 'Saving…';
  const put = grp => api('/transactions/' + grp.id, { method: 'PUT', body: { apply_rules: false, transactions: grp.splits.filter(x => !x.category).map(x => {
    const o: any = { transaction_journal_id: x.jid, category_name: cat }; if (bud && x.type === 'withdrawal' && !x.budget_id) o.budget_id = bud; return o; }) } });
  try {
    await put(g);
    let n = 1;
    if (alsoSimilar) await eachLimited(similar, 4, async o => { await put(o); n++; });
    if (makeRule) {
      const gid = await ensureInboxGroup();
      const triggers = generic ? [{ type: 'description_contains', value: descKey(s.description) }] : [{ type: s.type === 'deposit' ? 'source_account_is' : 'destination_account_is', value: payeeName }];
      triggers.push({ type: 'transaction_type', value: s.type });
      const actions = [{ type: 'set_category', value: cat }];
      const budName = bud && (L.budgets.find(b => b.id === bud) || {}).name; if (budName) actions.push({ type: 'set_budget', value: budName });
      await api('/rules', { method: 'POST', body: { title: (generic ? descKey(s.description) : payeeName) + ' → ' + cat, rule_group_id: gid, trigger: 'store-journal', strict: true, stop_processing: false, active: true,
        triggers: triggers.map(t => ({ ...t, active: true, stop_processing: false })), actions: actions.map(a => ({ ...a, active: true, stop_processing: false })) } });
    }
    const doneIds = new Set([g.id, ...(alsoSimilar ? similar.map(x => x.id) : [])]);
    I.items = I.items.filter(x => !doneIds.has(x.id)); I.done += n;
    if (I.i >= I.items.length) I.i = Math.max(0, I.items.length - 1);
    if (I.items.length && I.i > 0 && I.i >= I.items.length) I.i = I.items.length - 1;
    // remember this choice for the next suggestions
    bump(I.h.payee, s.type === 'deposit' ? s.source_id : s.destination_id, cat); bump(I.h.key, descKey(s.description), cat);
    toast('Saved' + (n > 1 ? ' · ' + n + ' transactions' : '') + (makeRule ? ' · rule created' : ''));
    renderInbox();
  } catch (e) { if (e instanceof AuthError) return showLogin(e.message); btn.disabled = false; btn.textContent = 'Save'; toast(e.message); }
}
document.addEventListener('keydown', e => {
  if (parseHash().name !== 'inbox' || !S.inbox || !el('inboxForm')) return;
  if (el('drawer').classList.contains('open') || !el('palette').hidden || el('confirm').open || e.metaKey || e.ctrlKey || e.altKey) return;
  const inField = /^(INPUT|SELECT|TEXTAREA)$/.test((e.target as HTMLElement).tagName) && (e.target as HTMLInputElement).type !== 'checkbox';
  if (!inField && /^[123]$/.test(e.key)) { e.preventDefault(); inboxPick(+e.key - 1); }
  else if (!inField && (e.key === 's' || e.key === 'S')) { e.preventDefault(); inboxSkip(); }
  else if (e.key === 'Enter' && (e.target as HTMLElement).tagName !== 'BUTTON' && (e.target as HTMLElement).tagName !== 'TEXTAREA') { e.preventDefault(); inboxSave(); }
});

Object.assign(App, {
  inboxPick,
  inboxSkip,
  inboxBack,
  inboxSave,
});
