import { S, esc, money, num, todayIso } from './base';
import { daysBetween } from './helpers';

/* ================= Transactions: normalize ================= */
export function normGroup(g) {
  const a = g.attributes || {};
  const splits = (a.transactions || []).map(t => ({
    jid: String(t.transaction_journal_id), type: t.type, date: t.date, amount: num(t.amount), description: t.description || '',
    source_id: String(t.source_id || ''), source_name: t.source_name || '', source_type: t.source_type || '',
    destination_id: String(t.destination_id || ''), destination_name: t.destination_name || '', destination_type: t.destination_type || '',
    category: t.category_name || '', budget_id: t.budget_id ? String(t.budget_id) : '', budget_name: t.budget_name || '',
    bill_id: t.bill_id ? String(t.bill_id) : '', bill_name: t.bill_name || '', tags: t.tags || [], notes: t.notes || '',
    sba: t.source_balance_after, dba: t.destination_balance_after,
    fa: t.foreign_amount != null && t.foreign_amount !== '' ? String(num(t.foreign_amount)) : '', fc: t.foreign_currency_code || '', reconciled: !!t.reconciled,
  }));
  const f = splits[0] || {};
  return { id: String(g.id), title: a.group_title || '', type: f.type, date: f.date, splits, total: splits.reduce((s, x) => s + x.amount, 0) };
}
// Signed amount: negative = money out. With an account in view, sign is relative to that account.
export function signed(g, accountId) {
  if (accountId) return g.splits.reduce((s, x) => s + (x.source_id === accountId ? -x.amount : x.destination_id === accountId ? x.amount : 0), 0);
  if (g.type === 'withdrawal') return -g.total;
  if (g.type === 'deposit') return g.total;
  return 0;
}
function amountCell(g, accountId) {
  const v = signed(g, accountId);
  if (!accountId && g.type === 'transfer') return '<td class="amt neutral">' + money(g.total) + '</td>';
  return '<td class="amt ' + (v < 0 ? 'neg' : v > 0 ? 'pos' : 'neutral') + '">' + (v > 0 ? '+' : '') + money(v) + '</td>';
}

/* ---------- Merchant avatars ---------- */
const AV_NOISE = /^(sq|tst|pos|ach|dd|pp|paypal|aplpay|sp|py|ic|in|web|pmt)\s*\*\s*|^(sq|tst)\s+/i;
export function payeeOf(g) {
  const f = g.splits[0] || {};
  if (g.type === 'transfer') return { name: g.splits.length > 1 ? (g.title || f.description) : f.destination_name || f.description, kind: 'transfer' };
  const side = g.type === 'deposit' ? 'source_name' : 'destination_name';
  const names = [...new Set(g.splits.map(s => s[side]).filter(Boolean))];
  let name = names.length === 1 ? names[0] : (g.title || f.description);
  if (!name || /^\(?(no name|cash account)\)?$/i.test(name)) name = f.description;
  return { name: String(name || '?'), kind: g.type };
}
function monogram(name) {
  const words = String(name).replace(AV_NOISE, '').replace(/[^A-Za-z0-9&' ]+/g, ' ').split(/\s+/).filter(w => w && !/^(the|and|of|inc|llc|co)$/i.test(w));
  if (!words.length) return '•';
  if (words.length === 1 || /^\d/.test(words[1])) return (/^[A-Z]{2,4}$/.test(words[0]) ? words[0].slice(0, 2) : words[0][0]).toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
}
function hueOf(name) {
  let h = 0; const k = String(name).replace(AV_NOISE, '').toLowerCase().replace(/[^a-z]/g, '').slice(0, 10);
  for (let i = 0; i < k.length; i++) h = (h * 31 + k.charCodeAt(i)) >>> 0;
  return h % 360;
}
export function avatarHtml(g, cls = '') {
  const p = payeeOf(g);
  if (p.kind === 'transfer') return '<span class="av xfer ' + cls + '" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 8h13M13 4l4 4-4 4M20 16H7M11 12l-4 4 4 4"/></svg></span>';
  return '<span class="av ' + cls + '" style="--h:' + hueOf(p.name) + '" aria-hidden="true">' + esc(monogram(p.name)) + '</span>';
}

/* ---------- Day labels for the grouped feed ---------- */
export function dayLabel(iso) {
  const d = String(iso).slice(0, 10), t = todayIso(), diff = daysBetween(d, t);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Yesterday';
  if (diff === -1) return 'Tomorrow';
  const dt = new Date(d + 'T12:00:00');
  if (diff > 1 && diff < 7) return dt.toLocaleDateString('en-US', { weekday: 'long' });
  return dt.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', ...(dt.getFullYear() !== new Date().getFullYear() ? { year: 'numeric' } : {}) });
}
S.txMeta = {};
export function txRows(groups, opts: any = {}) {
  if (S.pendingDel && S.pendingDel.size) groups = groups.filter(g => !S.pendingDel.has(g.id));
  if (!groups.length) return '<div class="center-empty">' + (opts.empty || 'No transactions.') + '</div>';
  const cols = (opts.select ? 1 : 0) + 4;
  // Net per day (relative to the account when one is in view; transfers count as zero otherwise)
  const byDay: any = {};
  groups.forEach(g => { const d = String(g.date).slice(0, 10); byDay[d] = (byDay[d] || 0) + signed(g, opts.accountId); });
  let lastDay = '';
  const rows = groups.map(g => {
    const f = g.splits[0], multi = g.splits.length > 1, day = String(g.date).slice(0, 10);
    const desc = multi ? (g.title || f.description) : f.description;
    const dests = [...new Set(g.splits.map(s => s.destination_name))], srcs = [...new Set(g.splits.map(s => s.source_name))];
    const flow = esc(srcs.length > 1 ? srcs.length + ' sources' : srcs[0]) + ' → ' + esc(dests.length > 1 ? dests.length + ' payees' : dests[0]);
    const cats = [...new Set(g.splits.map(s => s.category).filter(Boolean))];
    const buds = [...new Set(g.splits.map(s => s.budget_name).filter(Boolean))];
    const tags = [...new Set<string>(g.splits.flatMap(s => s.tags))].filter(t => !/^Data Import on/.test(t));
    const fx = g.splits.filter(s => s.fa && s.fc).map(s => '<span class="chip">' + esc(s.fc) + ' ' + esc(num(s.fa).toFixed(2)) + '</span>').join('');
    const inl = k => multi ? '' : ' inl" data-k="' + k + '" data-onclick="event.stopPropagation();App.pick(this)" title="Change ' + k;
    const chips = '<span class="cat-s' + inl('category') + '">' + (cats.length ? esc(cats.join(', ')) : g.type === 'withdrawal' ? 'Uncategorized' : g.type === 'deposit' ? 'Income' : 'Transfer') + '</span>' + fx +
      (multi ? '<span class="chip">' + g.splits.length + ' splits</span>' : '') +
      buds.map(b => '<span class="chip' + inl('budget') + '">Budget · ' + esc(b) + '</span>').join('') +
      (!buds.length && !multi && g.type === 'withdrawal' ? '<span class="chip ghost' + inl('budget') + '">+ Budget</span>' : '') +
      tags.map(t => '<span class="chip"># ' + esc(t) + '</span>').join('');
    S.txMeta[g.id] = { g, accountId: opts.accountId || '', opts: { select: !!opts.select, accountId: opts.accountId || '' } };
    let dh = '';
    if (day !== lastDay) {
      const close = lastDay ? '</tbody>' : ''; lastDay = day; const net = byDay[day];
      dh = close + '<tbody class="day"><tr class="dayhead" data-day="' + day + '"><td colspan="' + cols + '"><div><span>' + esc(dayLabel(day)) + '</span>' +
        (Math.abs(net) >= .005 ? '<span class="num ' + (net < 0 ? '' : 'pos') + '">' + (net > 0 ? '+' : '') + money(net) + '</span>' : '') + '</div></td></tr>';
    }
    return dh + '<tr class="click" data-gid="' + g.id + '" data-day="' + day + '" data-onclick="App.editTx(\'' + g.id + '\')">' +
      (opts.select ? '<td class="sel" data-onclick="event.stopPropagation()"><input type="checkbox" data-sel="' + g.id + '" data-onchange="App.selChanged()"' + ((S.sel || new Set()).has(g.id) ? ' checked' : '') + ' aria-label="Select"></td>' : '') +
      '<td><div class="txmain">' + avatarHtml(g) + '<div class="txt"><div class="desc">' + esc(desc) + '</div><div class="meta">' + chips + '</div></div></div></td>' +
      '<td class="flow hide-s"><span>' + flow + '</span></td>' +
      '<td class="catcol hide-s"><span class="' + (cats.length ? '' : 'neutral') + inl('category') + '">' + (cats.length ? esc(cats.join(', ')) : '—') + '</span></td>' +
      amountCell(g, opts.accountId) + '</tr>';
  }).join('');
  return '<table class="tbl feed' + (opts.select ? ' has-sel' : '') + '">' + rows + '</tbody></table>';
}
// After rows are removed (undo-delete, swipe), drop day headers left with nothing under them
export function tidyDays() {
  document.querySelectorAll<HTMLElement>('#view tbody.day').forEach(b => { if (!b.querySelector('tr[data-gid]')) b.remove(); });
}
