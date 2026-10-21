import { html, htmlList } from '../core/html';
import { getAll } from '../core/api';
import { App, fmtDay, money, todayIso } from '../core/base';
import { head } from '../core/dom';
import { avatarHtml, normGroup, payeeOf, signed } from '../core/feed';
import { LS, addDays } from '../core/helpers';
import { lists } from '../core/lists';
import { VIEWS, route } from '../core/router';

/* ================= Review: new transactions, until you've looked at them =================
   Firefly has no "reviewed" flag, so the queue is every transaction added (created_at) after the moment you last
   cleared it (reviewedAt), minus the ones you ticked off one by one since (reviewed). Both follow you between
   devices. The first time, it starts two weeks back. */
const LOOKBACK = 60;
export function reviewQueue(raw, reviewedAt: string, done: string[]) {
  // Times come with different offsets (Firefly's own, and this device's), so compare them as moments
  const skip = new Set(done), mark = Date.parse(reviewedAt) || 0, at = g => Date.parse((g.attributes || {}).created_at) || 0;
  return raw.filter(g => at(g) > mark && !skip.has(String(g.id))).sort((a, b) => at(b) - at(a));
}
const since = () => LS.get('reviewedAt', '') || addDays(todayIso(), -14) + 'T00:00:00';
VIEWS.review = async (r, paint) => {
  await lists();
  const raw = await getAll('/transactions', { type: 'all', start: addDays(todayIso(), -LOOKBACK), end: addDays(todayIso(), 7) });
  const queue = reviewQueue(raw, since(), LS.get('reviewed', []));
  // Forget ticked-off ids that have left the queue's window
  const ids = new Set(raw.map(g => String(g.id))), done = LS.get('reviewed', []);
  if (done.some(id => !ids.has(id))) LS.set('reviewed', done.filter(id => ids.has(id)));
  const rows = htmlList(queue.map(normGroup).map(g => {
    const f = g.splits[0], v = signed(g, ''), cats = [...new Set(g.splits.map(s => s.category).filter(Boolean))];
    const what = g.type === 'transfer' ? 'Transfer' : cats.length ? cats.join(', ') : html`<span class="chip warn">Uncategorized</span>`;
    return html`<div class="review-row" data-gid="${g.id}"><button type="button" class="review-main" data-onclick="App.editTx('${g.id}')">${avatarHtml(g)}<span class="txt"><span class="desc">${g.splits.length > 1 ? g.title || f.description : f.description}</span><span class="sub-s">${fmtDay(g.date)} · ${payeeOf(g).name} · ${what}${f.budget_name ? ' · ' + f.budget_name : ''}</span></span><span class="num ${v < 0 ? 'neg' : v > 0 ? 'pos' : 'neutral'}">${v > 0 ? '+' : ''}${money(g.type === 'transfer' ? g.total : v)}</span></button><button type="button" class="btn small" title="Looks right" data-onclick="App.reviewDone('${g.id}')">✓ Looks right</button></div>`;
  }));
  paint(html`${head('Review', queue.length ? queue.length + ' new transaction' + (queue.length === 1 ? '' : 's') + ' to look over' : 'Nothing new to look over', queue.length ? html`<button class="btn" data-onclick="App.reviewAll()">Mark all reviewed</button>` : '')}<section class="panel">${rows ? html`<div class="review-list">${rows}</div>` : html`<div class="center-empty" style="padding:60px 20px"><div style="font-size:40px">✓</div><h2 style="font-size:18px;margin:10px 0 4px">All reviewed</h2>New transactions show up here as Firefly gets them, from imports, rules or other apps.</div>`}</section><p class="sub-s" style="margin-top:14px">Open a transaction to fix its category, budget or amount, then tick it off. Transactions added since ${fmtDay(since().slice(0, 10))} show here.</p>`);
};
function reviewDone(id) {
  LS.set('reviewed', [...new Set([...LS.get('reviewed', []), String(id)])]);
  const row = document.querySelector<HTMLElement>('.review-row[data-gid="' + id + '"]');
  if (row) row.classList.add('gone');
  setTimeout(() => route({ quiet: true }), 220);
}
function reviewAll() { LS.set('reviewedAt', new Date().toISOString()); LS.set('reviewed', []); route(); }

// The methods markup handlers call (see events.ts), added to App and to its type
const methods = {
  reviewDone,
  reviewAll,
};
Object.assign(App, methods);
type Methods = typeof methods;
declare module '../core/base' { interface AppApi extends Methods {} }
