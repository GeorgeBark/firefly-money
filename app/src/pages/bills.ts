import { html, htmlList } from '../core/html';
import { api, getAll } from '../core/api';
import { busy } from '../core/auth';
import { App, S, el, fmtDate, fmtDay, money, money0, monthRange, num, today, todayIso, type Field } from '../core/base';
import { closeDrawer, formError, head, monthNav, openDrawer, opt, toast } from '../core/dom';
import { normGroup } from '../core/feed';
import { LS, addDays } from '../core/helpers';
import { invalidate, lists } from '../core/lists';
import { VIEWS, parseHash, route } from '../core/router';
import { billRises, findRecurring } from '../features/subs';

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
      : html`<div class="center-empty">No bills yet. Add rent, subscriptions or insurance to see what’s coming.</div>`}</section><div id="subsBox"></div><p class="sub-s" style="margin-top:14px">Firefly marks a bill paid when a transaction is linked to it — pick the bill in the transaction form, or let your rules do it.</p>`);
  const tok = S.tok;
  // The page may still be animating in when the answer arrives, so wait a moment for the box to exist
  const put = (markup, n = 0) => {
    if (tok !== S.tok || parseHash().name !== 'bills') return;
    const box = el('subsBox');
    if (box) box.innerHTML = markup; else if (n < 40) setTimeout(() => put(markup, n + 1), 50);
  };
  subsPanel(bills).then(m => put(m)).catch(() => {});
};

/* ---------- Subscriptions that aren't bills yet, and bills whose price went up ---------- */
// Looks through the last 13 months of spending (one cached request, shared with every visit to this page)
async function subsPanel(bills) {
  const gs = (await getAll('/transactions', { start: addDays(todayIso(), -400), end: todayIso(), type: 'withdrawal' })).map(normGroup);
  const charges = gs.flatMap(g => g.splits.filter(x => x.type === 'withdrawal').map(x => ({ date: x.date, amount: x.amount, payeeId: x.destination_id, payee: x.destination_name, billId: x.bill_id })));
  const hidden = new Set(LS.get('subsHidden', [])), names = new Set(bills.map(b => String(b.attributes.name).trim().toLowerCase()));
  const found = findRecurring(charges, todayIso()).filter(r => !hidden.has(r.payeeId) && !names.has(r.payee.trim().toLowerCase()));
  const rises = billRises(charges, bills.filter(b => b.attributes.active !== false).map(b => ({ id: String(b.id), max: num(b.attributes.amount_max) })));
  S.subs = found; S.billRises = rises;
  const riseRows = htmlList(Object.entries(rises).map(([id, r]) => {
    const at = (S.billCache || {})[id] || {};
    return html`<div class="row"><span class="name">${at.name}<br><span class="sub-s">Last charge ${money(r.last)} on ${fmtDay(r.date)}, above the bill’s ${money(num(at.amount_max))}</span></span><button class="btn small" data-onclick="App.billRaise('${id}')">Update to ${money(r.last)}</button></div>`;
  }));
  const subRows = htmlList(found.map((r, i) => html`<div class="row"><span class="name">${r.payee}${r.rose ? html` <span class="chip warn">Up from ${money(r.rose.from)}</span>` : ''}<br><span class="sub-s">${r.min === r.max ? money(r.amount) : 'About ' + money(r.amount)} every ${r.every} · ${r.count} charges · last ${fmtDay(r.last)}, next around ${fmtDay(r.next)}</span></span><span style="display:flex;gap:6px;flex:none"><button class="btn small" data-onclick="App.subIgnore(${i})">Not a bill</button><button class="btn small primary" data-onclick="App.subAdd(${i})">Add as bill</button></span></div>`));
  return html`${riseRows ? html`<section class="panel" style="margin-top:20px"><h2>Prices that went up</h2><p class="lead">These bills were charged more than their highest amount</p><div class="list">${riseRows}</div></section>` : ''}${subRows ? html`<section class="panel" style="margin-top:20px"><h2>Looks like a bill</h2><p class="lead">Charges that repeat on a schedule but aren’t bills yet. As bills they show up in Coming up and in the safe-to-spend forecast.</p><div class="list">${subRows}</div></section>` : ''}`;
}
function subAdd(i) {
  const r = S.subs && S.subs[i]; if (!r) return;
  billForm('', { name: r.payee, amount_min: r.min, amount_max: r.max, date: r.next, repeat_freq: r.freq, skip: r.skip, object_group_title: 'Subscriptions', payee: r.payee, since: r.last });
}
function subIgnore(i) {
  const r = S.subs && S.subs[i]; if (!r) return;
  LS.set('subsHidden', [...new Set([...LS.get('subsHidden', []), r.payeeId])]);
  toast(r.payee + ' won’t be suggested again'); route();
}
async function billRaise(id) {
  const at = (S.billCache || {})[id], r = (S.billRises || {})[id]; if (!at || !r) return;
  const fixed = num(at.amount_min) === num(at.amount_max);
  try {
    await api('/bills/' + id, { method: 'PUT', body: { amount_max: String(r.last), ...(fixed ? { amount_min: String(r.last) } : {}) } });
    invalidate(); toast(at.name + ' updated to ' + money(r.last)); route();
  } catch (e) { toast((e as Error).message); }
}
// A rule that links the payee's future charges (and, run once now, the past year's) to the new bill
async function billRule(name, payee) {
  const groups = await getAll('/rule-groups');
  let g = groups.find(x => x.attributes.title === 'Bill rules');
  if (!g) g = (await api('/rule-groups', { method: 'POST', body: { title: 'Bill rules', description: 'Created by Money when a bill is added from a repeating charge.', active: true } })).data;
  const one = o => ({ ...o, active: true, stop_processing: false });
  const res = await api('/rules', { method: 'POST', body: { title: payee + ' → bill ' + name, rule_group_id: String(g.id), trigger: 'store-journal', strict: true, stop_processing: false, active: true,
    triggers: [one({ type: 'destination_account_is', value: payee }), one({ type: 'transaction_type', value: 'withdrawal' })], actions: [one({ type: 'link_to_bill', value: name })] } });
  if (res && res.data) await api('/rules/' + res.data.id + '/trigger', { method: 'POST', params: { start: addDays(todayIso(), -400), end: todayIso() } }).catch(() => {});
}
// pre: values for a new bill (from a repeating charge), with the payee to link it to
function billForm(id, pre?) {
  const at = id ? (S.billCache || {})[id] : pre || null;
  S.form = { id, payee: !id && pre ? pre.payee : '' };
  openDrawer(id ? 'Edit bill' : 'New bill',
    html`<form id="billForm" data-onsubmit="event.preventDefault();App.saveBill()"><label>Name<input type="text" id="bl-name" value="${at ? at.name : ''}" required></label><div class="grid2"><label>Lowest amount<input type="number" step="0.01" min="0" id="bl-min" value="${at ? num(at.amount_min) : ''}" required></label><label>Highest amount<input type="number" step="0.01" min="0" id="bl-max" value="${at ? num(at.amount_max) : ''}" required></label></div><p class="hint">Use the same number twice for a fixed amount.</p><label>${id ? 'First due date' : 'Next due date'}<input type="date" id="bl-date" value="${at ? String(at.date).slice(0, 10) : todayIso()}" required></label><div class="grid2"><label>Repeats<select id="bl-freq">${htmlList(Object.keys(FREQ).map(k => opt(k, k === 'half-year' ? 'every 6 months' : k, at ? at.repeat_freq : 'monthly')))}</select></label><label>Skip<input type="number" min="0" step="1" id="bl-skip" value="${at ? at.skip || 0 : 0}"></label></div><p class="hint">Skip 1 with “monthly” means every other month.</p><label>Group (optional)<input type="text" id="bl-group" list="dl-groups" value="${at ? at.object_group_title || '' : ''}" placeholder="e.g. Housing, Subscriptions"></label><datalist id="dl-groups">${htmlList([...new Set(Object.values<any>(S.billCache || {}).map(x => x.object_group_title).filter(Boolean))].map(g => html`<option value="${g}">`))}</datalist><label>Notes<textarea id="bl-notes" rows="3">${at ? at.notes || '' : ''}</textarea></label><label class="check"><input type="checkbox" id="bl-active"${!at || at.active !== false ? ' checked' : ''}> Active</label>${S.form.payee ? html`<label class="check"><input type="checkbox" id="bl-rule" checked> Link charges from ${S.form.payee} to this bill, past and future (creates a rule)</label>` : ''}<button type="submit" hidden></button></form>`,
    html`${id ? html`<button class="btn danger" data-onclick="App.deleteThing('bills','${id}','bill')">Delete</button>` : ''}<span class="grow"></span><button class="btn" data-onclick="App.closeDrawer()">Cancel</button><button class="btn primary" id="billSave" data-onclick="App.submit('billForm')">${id ? 'Save' : 'Create bill'}</button>`);
}
async function saveBill() {
  const id = S.form.id, v = x => el<Field>(x).value.trim();
  const mn = num(v('bl-min')), mx = num(v('bl-max'));
  if (!v('bl-name')) return formError('Give the bill a name.');
  if (mx < mn) return formError('The highest amount can’t be below the lowest.');
  const body: any = { name: v('bl-name'), amount_min: String(mn), amount_max: String(mx), date: v('bl-date'), repeat_freq: v('bl-freq'), skip: parseInt(v('bl-skip') || '0', 10), active: el<HTMLInputElement>('bl-active').checked, notes: el<HTMLTextAreaElement>('bl-notes').value, object_group_title: v('bl-group') };
  if (!id) body.currency_code = S.currency;
  await busy(el('billSave'), async () => {
    await api(id ? '/bills/' + id : '/bills', { method: id ? 'PUT' : 'POST', body });
    const linked = !id && S.form.payee && el<HTMLInputElement>('bl-rule') && el<HTMLInputElement>('bl-rule').checked;
    if (linked) await billRule(body.name, S.form.payee);
    invalidate(); closeDrawer(); toast(id ? 'Bill saved' : linked ? 'Bill created · past charges linked' : 'Bill created'); route();
  });
}

Object.assign(App, {
  billForm,
  saveBill,
  subAdd,
  subIgnore,
  billRaise,
});
