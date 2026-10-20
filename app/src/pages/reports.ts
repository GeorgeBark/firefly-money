import { html, htmlList, raw } from '../core/html';
import { api } from '../core/api';
import { absDiff, arr, fmtDate, fmtDay, isoDate, money, money0, monthRange, num, sumDiff, todayIso } from '../core/base';
import { head } from '../core/dom';
import { addDays } from '../core/helpers';
import { isAsset, isLiab, lists } from '../core/lists';
import { VIEWS } from '../core/router';
import { cashFlow } from './overview';

/* ================= Reports ================= */
function reportRange(q) {
  const t = new Date(), y = t.getFullYear(), m = t.getMonth();
  const P = {
    'this-month': [monthRange(y, m).start, monthRange(y, m).end], 'last-month': [monthRange(y, m - 1).start, monthRange(y, m - 1).end],
    'last-3': [monthRange(y, m - 2).start, monthRange(y, m).end], 'this-year': [y + '-01-01', y + '-12-31'],
    'last-year': [(y - 1) + '-01-01', (y - 1) + '-12-31'], 'last-12': [monthRange(y, m - 11).start, monthRange(y, m).end],
  };
  if (q.start && q.end) return { start: q.start, end: q.end, preset: '' };
  const p = q.preset || 'this-month';
  return { start: P[p][0], end: P[p][1], preset: p };
}
function shareTable(title, rows, opts: any = {}) {
  rows = rows.filter(r => r.v > 0).sort((a, b) => b.v - a.v);
  const total = rows.reduce((s, r) => s + r.v, 0), top = rows.slice(0, opts.limit || 12), rest = rows.slice(opts.limit || 12);
  if (rest.length) top.push({ name: rest.length + ' others', v: rest.reduce((s, r) => s + r.v, 0) });
  const max = Math.max(1, ...top.map(r => r.v));
  return html`<section class="panel"><div class="panel-head"><h2>${title}</h2><span class="num">${money0(total)}</span></div><p class="lead">${opts.lead || ''}</p>${top.length ? htmlList(top.map(r => html`<div class="cat"><div class="row"><span class="name">${r.href ? html`<a href="${r.href}" style="text-decoration:none">${r.name}</a>` : r.name}</span><span class="num">${money0(r.v)} <span class="neutral">${total ? (r.v / total * 100).toFixed(0) : 0}%</span></span></div><div class="track"><div class="fill${opts.good ? ' good' : ''}" style="width:${(r.v / max * 100).toFixed(1)}%"></div></div></div>`))
      : html`<p class="empty">Nothing in this period.</p>`}</section>`;
}
VIEWS.reports = async (r, paint) => {
  const L = await lists();
  const R = reportRange(r.q), p = { start: R.start, end: R.end };
  const months = [];
  for (let d = new Date(R.start + 'T12:00:00'); isoDate(d) <= R.end && months.length < 36; d = new Date(d.getFullYear(), d.getMonth() + 1, 1, 12)) {
    const mr = monthRange(d.getFullYear(), d.getMonth());
    months.push({ start: mr.start < R.start ? R.start : mr.start, end: mr.end > R.end ? R.end : mr.end, label: mr.short + (months.length === 0 || d.getMonth() === 0 ? ' ’' + String(d.getFullYear()).slice(2) : '') });
  }
  const own = L.accounts.filter(a => (isAsset(a) || isLiab(a)) && a.active);
  const g = path => api(path, { params: p }).catch(() => []);
  const [inc, exp, xfer, byCat, noCat, byBud, noBud, byTag, byPayee, bySrc, byIncCat, trend, balStart, balEnd] = await Promise.all([
    g('/insight/income/total'), g('/insight/expense/total'), g('/insight/transfer/total'), g('/insight/expense/category'), g('/insight/expense/no-category'),
    g('/insight/expense/budget'), g('/insight/expense/no-budget'), g('/insight/expense/tag'), g('/insight/expense/expense'), g('/insight/income/revenue'), g('/insight/income/category'),
    Promise.all(months.map(mo => Promise.all([api('/insight/income/total', { params: mo }).catch(() => []), api('/insight/expense/total', { params: mo }).catch(() => [])])
      .then(([i, e]) => ({ label: mo.label, income: sumDiff(i), spend: sumDiff(e), go: 'report:' + mo.start + ':' + mo.end })))),
    Promise.all(own.map(a => api('/accounts/' + a.id, { params: { date: addDays(R.start, -1) } }).then(x => num(x.data.attributes.current_balance)).catch(() => null))),
    Promise.all(own.map(a => api('/accounts/' + a.id, { params: { date: R.end > todayIso() ? todayIso() : R.end } }).then(x => num(x.data.attributes.current_balance)).catch(() => null))),
  ]);
  const earned = sumDiff(inc), spent = sumDiff(exp), net = earned - spent;
  const rowsOf = (res, link) => arr(res).map(x => ({ name: x.name, v: absDiff(x), href: link && x.id ? link + x.id : '' }));
  const nwS = own.reduce((s, a, i) => s + (balStart[i] ?? 0), 0), nwE = own.reduce((s, a, i) => s + (balEnd[i] ?? 0), 0);
  const presetBtn = (k, l) => html`<a class="btn small${R.preset === k ? ' primary' : ''}" href="#/reports?preset=${k}">${l}</a>`;
  const accRows = htmlList(own.map((a, i) => ({ a, s: balStart[i], e: balEnd[i] })).filter(x => x.s !== null && x.e !== null && (x.s || x.e))
    .map(({ a, s, e }) => html`<tr><td class="desc">${a.name}</td><td class="amt hide-s">${money(s)}</td><td class="amt">${money(e)}</td><td class="amt ${e - s > 0 ? 'pos' : e - s < 0 ? 'neg' : 'neutral'}">${e - s > 0 ? '+' : ''}${money(e - s)}</td></tr>`));
  paint(html`${head('Reports', fmtDate(R.start) + ' – ' + fmtDate(R.end), html`<button class="btn" data-onclick="App.print()">Print</button>`)}<div class="toolbar"><div style="display:flex;gap:6px;flex-wrap:wrap">${presetBtn('this-month', 'This month')}${presetBtn('last-month', 'Last month')}${presetBtn('last-3', 'Last 3 months')}${presetBtn('this-year', 'This year')}${presetBtn('last-year', 'Last year')}${presetBtn('last-12', 'Last 12 months')}</div><form class="range" data-onsubmit="event.preventDefault();App.reportsRange(this)"><input type="date" name="s" value="${R.start}"><span class="neutral">to</span><input type="date" name="e" value="${R.end}"><button class="btn small">Apply</button></form></div><div class="kpis"><div class="kpi"><div class="eyebrow">Earned</div><div class="val num pos">${money0(earned)}</div></div><div class="kpi"><div class="eyebrow">Spent</div><div class="val num neg">${money0(spent)}</div></div><div class="kpi"><div class="eyebrow">Net</div><div class="val num ${net < 0 ? 'neg' : ''}">${money0(net)}</div><div class="sub-s">${earned ? (net / earned * 100).toFixed(0) + '% of income kept' : ''}</div></div><div class="kpi"><div class="eyebrow">Moved between accounts</div><div class="val num">${money0(sumDiff(xfer))}</div></div><div class="kpi"><div class="eyebrow">Balance change</div><div class="val num ${nwE - nwS < 0 ? 'neg' : 'pos'}">${nwE - nwS > 0 ? '+' : ''}${money0(nwE - nwS)}</div><div class="sub-s">across your accounts</div></div></div>${months.length > 1 ? html`<section class="panel chart" style="margin-bottom:20px">${raw(String(cashFlow(trend)).replace('over the last six months · click a month to open it', 'by month · click a month to report on it'))}</section>` : ''}<div class="cards">${shareTable('Spending by category', [...rowsOf(byCat, '#/transactions?category='), { name: 'Uncategorized', v: sumDiff(noCat) }])}${shareTable('Spending by budget', [...rowsOf(byBud, '#/transactions?budget='), { name: 'No budget', v: sumDiff(noBud) }])}${shareTable('Top payees', rowsOf(byPayee, '#/account/'), { limit: 15 })}${shareTable('Income by source', rowsOf(bySrc, '#/account/'), { good: true })}${shareTable('Income by category', rowsOf(byIncCat, '#/transactions?category='), { good: true })}${shareTable('Spending by tag', rowsOf(byTag, '#/transactions?tag='), { lead: 'Tagged spending only' })}</div><section class="panel flush"><div style="padding:22px 26px 6px"><h2 style="font-size:15px;margin:0">Account balances</h2></div>${accRows ? html`<table class="tbl"><thead><tr><th>Account</th><th class="r hide-s">${fmtDay(addDays(R.start, -1))}</th><th class="r">${fmtDay(R.end > todayIso() ? todayIso() : R.end)}</th><th class="r">Change</th></tr></thead><tbody>${accRows}</tbody></table>` : html`<div class="center-empty">No balances.</div>`}</section>`);
};
