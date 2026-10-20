import { html } from '../core/html';
import { api } from '../core/api';
import { PAGE_SIZE, S, arr, period } from '../core/base';
import { head, icon, monthNav } from '../core/dom';
import { normGroup, txRows } from '../core/feed';
import { lists } from '../core/lists';
import { VIEWS, hashWith } from '../core/router';

/* ================= Transactions page ================= */
VIEWS.transactions = async (r, paint) => {
  const L = await lists();
  const q = r.q, page = Math.max(1, +q.page || 1), type = q.type || 'all', search = (q.search || '').trim();
  const cur = period();
  let endpoint = '/transactions', scope = '';
  const find = (list, id) => (list.find(x => x.id === id) || {}).name || '#' + id;
  if (q.budget) { endpoint = '/budgets/' + q.budget + '/transactions'; scope = 'Budget: ' + find(L.budgets, q.budget); }
  else if (q.category) { endpoint = '/categories/' + q.category + '/transactions'; scope = 'Category: ' + find(L.categories, q.category); }
  else if (q.tag) { endpoint = '/tags/' + q.tag + '/transactions'; scope = 'Tag: ' + find(L.tags, q.tag); }
  else if (q.bill) { endpoint = '/bills/' + q.bill + '/transactions'; scope = 'Bill: ' + find(L.bills, q.bill); }
  const query = search + (type !== 'all' ? ' transaction_type:' + type : '');
  const load = pg => search ? api('/search/transactions', { params: { query, search: query, page: pg, limit: PAGE_SIZE } })
    : api(endpoint, { params: { start: cur.start, end: cur.end, type, page: pg, limit: PAGE_SIZE } });
  const res = await load(page);
  const groups = arr(res).map(normGroup), pg = (res && res.meta && res.meta.pagination) || {};
  if (paint.live) { S.txPage = groups; S.sel = new Set(); }
  const pages = pg.total_pages || 1, total = pg.total ?? groups.length;
  if (paint.live) S.feed = { next: page + 1, pages: pg.total_pages || 1, opts: { select: true }, more: async n => arr(await load(n)).map(normGroup) };
  const tab = (t, label) => html`<a href="${hashWith({ type: t === 'all' ? '' : t, page: '' })}" class="${type === t ? 'on' : ''}">${label}</a>`;
  paint(
    html`${head(scope || 'Transactions', search ? 'Search results across all dates' : total + ' transaction' + (total === 1 ? '' : 's') + (cur.all ? ' in total' : ' in ' + cur.label) +
      (scope ? html` · <a class="link" href="#/transactions">Show all</a>` : ''),
      html`${search ? '' : monthNav()}<button class="btn primary" data-onclick="App.newTx()">+ New transaction</button>`)}<div class="tabs">${tab('all', 'All')}${tab('withdrawal', 'Expenses')}${tab('deposit', 'Income')}${tab('transfer', 'Transfers')}</div><div class="toolbar"><form class="search" data-onsubmit="event.preventDefault();App.search(this.q.value)">${icon('search')}<input type="search" name="q" placeholder="Search all transactions — try: amazon, category:Gas, amount_more:100" value="${search}"></form>${search ? html`<button class="link" data-onclick="App.search('')">Clear search</button>` : ''}${groups.length ? html`<label class="check selall"><input type="checkbox" data-onchange="App.selAll(this.checked)"> Select all</label>` : ''}</div><div id="bulkbar" class="bulkbar" hidden></div><section class="panel flush">${txRows(groups, { select: true, empty: search ? 'Nothing matches that search.' : (cur.all ? 'No transactions yet.' : 'No transactions this month.') })}${page < pages ? html`<div class="more" id="feedMore"><span class="spin"></span>Loading older transactions…</div>` : ''}</section>`);
};
