import { html, htmlList } from '../core/html';
import { api, getAll } from '../core/api';
import { busy } from '../core/auth';
import { App, S, el, fmtDate, fmtDay, money, money0, monthRange, num, today, todayIso } from '../core/base';
import { closeDrawer, formError, head, monthNav, openDrawer, opt, toast } from '../core/dom';
import { invalidate, lists } from '../core/lists';
import { VIEWS, route } from '../core/router';

/* ================= Bills ================= */
const FREQ = { daily: ['day', 30.44], weekly: ['week', 4.35], monthly: ['month', 1], quarterly: ['quarter', 1 / 3], 'half-year': ['6 months', 1 / 6], yearly: ['year', 1 / 12] };
export const billAmount = at => at.amount_avg != null ? num(at.amount_avg) : (num(at.amount_min) + num(at.amount_max)) / 2;
VIEWS.bills = async (r, paint) => {
  await lists();
  // Bills are a schedule, so All time shows this month's due and paid status
  const cur = S.all ? monthRange(today.getFullYear(), today.getMonth()) : monthRange(S.y, S.m);
  const bills = await getAll('/bills', { start: cur.start, end: cur.end });
  const active = bills.filter(b => b.attributes.active !== false);
  const monthly = active.reduce((s, b) => s + billAmount(b.attributes) * (FREQ[b.attributes.repeat_freq] || ['', 1])[1] / ((b.attributes.skip || 0) + 1), 0);
  const grp = b => b.attributes.object_group_title || '';
  const rows = htmlList(bills.sort((a, b) => grp(a).localeCompare(grp(b)) || String((a.attributes.pay_dates || [])[0] || '9').localeCompare(String((b.attributes.pay_dates || [])[0] || '9'))).map((b, i, all) => {
    const heading = grp(b) && (i === 0 || grp(all[i - 1]) !== grp(b)) ? html`<tr><td colspan="4" class="eyebrow" style="padding-top:18px">${grp(b)}</td></tr>` : '';
    const at = b.attributes, paid = (at.paid_dates || []).length, due = (at.pay_dates || [])[0];
    const f = FREQ[at.repeat_freq] || [at.repeat_freq, 1], every = (at.skip ? 'Every ' + (at.skip + 1) + ' ' + f[0] + 's' : 'Every ' + f[0]);
    const status = at.active === false ? html`<span class="chip">Inactive</span>` : paid ? html`<span class="chip good">Paid this month</span>` :
      due ? html`<span class="chip warn">Due ${fmtDay(due)}</span>` : html`<span class="chip">Next ${at.next_expected_match ? fmtDate(at.next_expected_match) : '—'}</span>`;
    const amt = num(at.amount_min) === num(at.amount_max) ? money(num(at.amount_min)) : money0(num(at.amount_min)) + '–' + money0(num(at.amount_max));
    return html`${heading}<tr${at.active === false ? html` style="opacity:.5"` : ''}><td><a class="desc" href="#/transactions?bill=${b.id}" style="text-decoration:none">${at.name}</a><div class="sub-s">${every}</div></td><td>${status}</td><td class="amt">${amt}</td><td class="act"><button class="btn small" data-onclick="App.billForm('${b.id}')">Edit</button></td></tr>`;
  }));
  S.billCache = Object.fromEntries(bills.map(b => [String(b.id), b.attributes]));
  paint(html`${head('Bills', 'About ' + money0(monthly) + ' a month across ' + active.length + ' active bill' + (active.length === 1 ? '' : 's'), html`${monthNav()}<button class="btn primary" data-onclick="App.billForm()">+ New bill</button>`)}<section class="panel flush">${rows ? html`<table class="tbl"><thead><tr><th>Bill</th><th>${cur.label}</th><th class="r">Amount</th><th></th></tr></thead><tbody>${rows}</tbody></table>`
      : html`<div class="center-empty">No bills yet. Add rent, subscriptions or insurance to see what’s coming.</div>`}</section><p class="sub-s" style="margin-top:14px">Firefly marks a bill paid when a transaction is linked to it — pick the bill in the transaction form, or let your rules do it.</p>`);
};
function billForm(id) {
  const at = id ? (S.billCache || {})[id] : null;
  S.form = { id };
  openDrawer(id ? 'Edit bill' : 'New bill',
    html`<form id="billForm" data-onsubmit="event.preventDefault();App.saveBill()"><label>Name<input type="text" id="bl-name" value="${at ? at.name : ''}" required></label><div class="grid2"><label>Lowest amount<input type="number" step="0.01" min="0" id="bl-min" value="${at ? num(at.amount_min) : ''}" required></label><label>Highest amount<input type="number" step="0.01" min="0" id="bl-max" value="${at ? num(at.amount_max) : ''}" required></label></div><p class="hint">Use the same number twice for a fixed amount.</p><label>${id ? 'First due date' : 'Next due date'}<input type="date" id="bl-date" value="${at ? String(at.date).slice(0, 10) : todayIso()}" required></label><div class="grid2"><label>Repeats<select id="bl-freq">${htmlList(Object.keys(FREQ).map(k => opt(k, k === 'half-year' ? 'every 6 months' : k, at ? at.repeat_freq : 'monthly')))}</select></label><label>Skip<input type="number" min="0" step="1" id="bl-skip" value="${at ? at.skip || 0 : 0}"></label></div><p class="hint">Skip 1 with “monthly” means every other month.</p><label>Group (optional)<input type="text" id="bl-group" list="dl-groups" value="${at ? at.object_group_title || '' : ''}" placeholder="e.g. Housing, Subscriptions"></label><datalist id="dl-groups">${htmlList([...new Set(Object.values<any>(S.billCache || {}).map(x => x.object_group_title).filter(Boolean))].map(g => html`<option value="${g}">`))}</datalist><label>Notes<textarea id="bl-notes" rows="3">${at ? at.notes || '' : ''}</textarea></label><label class="check"><input type="checkbox" id="bl-active"${!at || at.active !== false ? ' checked' : ''}> Active</label><button type="submit" hidden></button></form>`,
    html`${id ? html`<button class="btn danger" data-onclick="App.deleteThing('bills','${id}','bill')">Delete</button>` : ''}<span class="grow"></span><button class="btn" data-onclick="App.closeDrawer()">Cancel</button><button class="btn primary" id="billSave" data-onclick="App.submit('billForm')">${id ? 'Save' : 'Create bill'}</button>`);
}
async function saveBill() {
  const id = S.form.id, v = x => el(x).value.trim();
  const mn = num(v('bl-min')), mx = num(v('bl-max'));
  if (!v('bl-name')) return formError('Give the bill a name.');
  if (mx < mn) return formError('The highest amount can’t be below the lowest.');
  const body: any = { name: v('bl-name'), amount_min: String(mn), amount_max: String(mx), date: v('bl-date'), repeat_freq: v('bl-freq'), skip: parseInt(v('bl-skip') || '0', 10), active: el('bl-active').checked, notes: el('bl-notes').value, object_group_title: v('bl-group') };
  if (!id) body.currency_code = S.currency;
  await busy(el('billSave'), async () => {
    await api(id ? '/bills/' + id : '/bills', { method: id ? 'PUT' : 'POST', body });
    invalidate(); closeDrawer(); toast(id ? 'Bill saved' : 'Bill created'); route();
  });
}

Object.assign(App, {
  billForm,
  saveBill,
});
