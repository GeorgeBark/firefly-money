import { html, htmlList } from '../core/html';
import { AuthError, api } from '../core/api';
import { showLogin } from '../core/auth';
import { App, S, el, fmtDate, money, num, sameName, todayIso, type AppApi, type Field } from '../core/base';
import { closeDrawer, formError, icon, openDrawer, opt, toast, vt, vtName } from '../core/dom';
import { avatarHtml, normGroup, payeeOf, signed } from '../core/feed';
import { invalidate, isAsset, isCard, isLiab, lists } from '../core/lists';
import { route } from '../core/router';

/* ================= Transaction form ================= */
export function blankSplit() { return { jid: '', description: '', amount: '', counter: '', category: '', budget: '', bill: '', tags: '', notes: '', fa: '', fc: '', orig: {} }; }
export function newTx(preset: any = {}) {
  const L = S.lists!; S.drawerHero = null;
  const firstAsset = (L.own.find(a => isAsset(a) && !isCard(a)) || L.own[0] || {}).id || '';
  S.form = { id: '', type: preset.type || 'withdrawal', date: preset.date || todayIso(), title: '', main: preset.account || firstAsset, src: preset.account || firstAsset, dst: '', rules: true, splits: [blankSplit()] };
  if (preset.description) S.form.splits[0].description = preset.description;
  if (preset.amount) S.form.splits[0].amount = preset.amount;
  renderTxForm();
}
export async function editTx(id) {
  const meta = S.txMeta && S.txMeta[id], row = document.querySelector<HTMLElement>('#view tr[data-gid="' + id + '"]');
  if (meta) {
    const g = meta.g, v = signed(g, meta.accountId);
    S.drawerHero = { id, av: avatarHtml(g, 'lg'), name: payeeOf(g).name, date: g.date, kicker: 'Transaction',
      amount: !meta.accountId && g.type === 'transfer' ? money(g.total) : (v > 0 ? '+' : '') + money(v) };
  } else S.drawerHero = null;
  const loading = html`<div style="padding:8px 0">${htmlList(['60%', '100%', '100%', '80%'].map(w => html`<div class="sk" style="width:${w};height:38px;margin-bottom:16px"></div>`))}</div>`;
  const rowAv = row && row.querySelector('.av') as HTMLElement;
  const opening = vt('drawer-open', () => { if (rowAv) rowAv.style.viewTransitionName = ''; openDrawer('Loading…', loading); vtName(el('drawer').querySelector('.dhero .av'), 'txav'); },
    () => vtName(rowAv, 'txav'));
  try {
    const [res] = await Promise.all([api('/transactions/' + id), lists()]);
    if (opening) await opening.updateCallbackDone.catch(() => {});   // the drawer shell must be in place before the form goes in
    const g = normGroup(res.data), f = g.splits[0];
    S.form = {
      id: g.id, type: g.type, date: String(g.date).slice(0, 10), title: g.title, rules: false,
      main: g.type === 'deposit' ? f.destination_id : f.source_id, src: f.source_id, dst: f.destination_id,
      splits: g.splits.map(s => {
        const x: any = { jid: s.jid, description: s.description, amount: String(s.amount), counter: g.type === 'deposit' ? s.source_name : s.destination_name,
          category: s.category, budget: s.budget_id, bill: s.bill_id, tags: s.tags.join(', '), notes: s.notes, fa: s.fa, fc: s.fc };
        x.orig = { ...x };
        return x;
      }),
    };
    if (!['withdrawal', 'deposit', 'transfer'].includes(g.type)) {
      openDrawer('Transaction', html`<p>This is a <strong>${g.type}</strong> transaction (${money(g.total)} on ${fmtDate(g.date)}). Edit it in Firefly III.</p>`,
        html`<button class="btn danger" data-onclick="App.deleteTx()">Delete</button><span class="grow"></span><button class="btn" data-onclick="App.closeDrawer()">Close</button>`);
      return;
    }
    renderTxForm();
  } catch (e) {
    if (e instanceof AuthError) return showLogin(e.message);
    openDrawer('Transaction', html`<div class="form-err">${(e as Error).message}</div>`);
  }
}
export function accountOptions(sel, allowEmpty) {
  const L = S.lists!;
  const group = (label, list) => list.length ? html`<optgroup label="${label}">${htmlList(list.map(a => opt(a.id, a.name, sel)))}</optgroup>` : '';
  return html`${allowEmpty ? opt('', 'Choose…', sel) : ''}${group('Bank accounts', L.own.filter(a => isAsset(a) && !isCard(a)))}${group('Credit cards', L.own.filter(isCard))}${group('Loans & debts', L.own.filter(isLiab))}`;
}
export function renderTxForm() {
  const f = S.form, L = S.lists!, multi = f.splits.length > 1;
  const typeBtn = (t, label) => html`<button type="button" class="${f.type === t ? 'on' : ''}" data-onclick="App.txType('${t}')">${label}</button>`;
  const counterList = f.type === 'withdrawal' ? [...L.expense, ...L.own.filter(isLiab)] : [...L.revenue, ...L.own.filter(isLiab)];
  let accountsHtml;
  if (f.type === 'transfer') {
    accountsHtml = html`<div class="grid2"><label>From<select id="f-src" required>${accountOptions(f.src, true)}</select></label><label>To<select id="f-dst" required>${accountOptions(f.dst, true)}</select></label></div>`;
  } else {
    accountsHtml = html`<label>${f.type === 'withdrawal' ? 'Paid from' : 'Deposited into'}<select id="f-main" required>${accountOptions(f.main, true)}</select></label>`;
  }
  const splitHtml = htmlList(f.splits.map((s, i) =>
    html`<div class="split" data-i="${i}">${multi ? html`<div class="split-head"><span>Split ${i + 1}</span><button type="button" class="link" data-onclick="App.removeSplit(${i})">Remove</button></div>` : ''}<label>Description<input type="text" data-k="description" value="${s.description}" required></label><div class="grid2"><label>Amount<input type="number" data-k="amount" value="${s.amount}" step="0.01" min="0.01" inputmode="decimal" required></label>${f.type !== 'transfer' ? html`<label>${f.type === 'withdrawal' ? 'Paid to' : 'Received from'}<input type="text" data-k="counter" list="dl-counter" value="${s.counter}" placeholder="Name" data-onchange="App.payeeFill(${i}, this.value)"></label>` : html`<span></span>`}</div><div class="grid2"><label>Category<input type="text" data-k="category" list="dl-cat" value="${s.category}" placeholder="None"></label>${f.type === 'withdrawal' ? html`<label>Budget<select data-k="budget">${opt('', 'None', s.budget)}${htmlList(L.budgets.filter(b => b.active || b.id === s.budget).map(b => opt(b.id, b.name, s.budget)))}</select></label>` : html`<span></span>`}</div><div class="grid2">${f.type === 'withdrawal' ? html`<label>Bill<select data-k="bill">${opt('', 'None', s.bill)}${htmlList(L.bills.map(b => opt(b.id, b.name, s.bill)))}</select></label>` : html`<span></span>`}<label>Tags<input type="text" data-k="tags" list="dl-tags" value="${s.tags}" placeholder="Comma separated"></label></div>${L.foreign.length ? html`<div class="grid2"><label>Foreign amount (optional)<input type="number" data-k="fa" step="0.01" min="0" value="${s.fa}"></label><label>Foreign currency<select data-k="fc">${opt('', 'None', s.fc)}${htmlList(L.foreign.map(c => opt(c.code, c.code + ' · ' + c.name, s.fc)))}</select></label></div>` : ''}<label>Notes<textarea data-k="notes" rows="2">${s.notes}</textarea></label></div>`));
  const body =
    html`<form id="txForm" data-onsubmit="event.preventDefault();App.saveTx(this)">${f.id ? '' : html`<div class="nlq">${icon('spark')}<input type="text" id="nlq" value="${f.nl || ''}" placeholder="Describe it — e.g. starbucks 5.40 amex yesterday" autocomplete="off" enterkeyhint="done" data-oninput="App.nlParse(this.value)" data-onkeydown="App.nlKey(event,this)"><div id="nlChips" class="nlchips">${f.nlChips || ''}</div></div>`}<div class="seg">${typeBtn('withdrawal', 'Expense')}${typeBtn('deposit', 'Income')}${typeBtn('transfer', 'Transfer')}</div><label>Date<input type="date" id="f-date" value="${f.date}" required></label>${accountsHtml}${multi ? html`<label>Title for the whole transaction<input type="text" id="f-title" value="${f.title}" required></label>` : ''}${splitHtml}<button type="button" class="btn small" data-onclick="App.addSplit()" style="margin-bottom:18px">+ Split into another part</button><label class="check"><input type="checkbox" id="f-rules"${f.rules ? ' checked' : ''}> Run my Firefly rules on this transaction</label><datalist id="dl-counter">${htmlList(counterList.map(a => html`<option value="${a.name}">`))}</datalist><datalist id="dl-cat">${htmlList(L.categories.map(c => html`<option value="${c.name}">`))}</datalist><datalist id="dl-tags">${htmlList(L.tags.map(t => html`<option value="${t.name}">`))}</datalist><button type="submit" hidden></button></form>${f.id ? html`<div id="txExtras"><p class="sub-s">Loading attachments and links…</p></div>` : ''}`;
  const foot = html`${f.id ? html`<button class="btn danger" type="button" data-onclick="App.deleteTx()">Delete</button>` : ''}<span class="grow"></span><button class="btn" type="button" data-onclick="App.closeDrawer()">Cancel</button><button class="btn primary" type="button" id="txSave" data-onclick="App.submit('txForm')">${f.id ? 'Save changes' : 'Add transaction'}</button>`;
  const wasOpen = el('drawer').classList.contains('open') && el('txForm');
  const scroll = wasOpen ? el('drawerBody').scrollTop : 0;
  openDrawer(f.id ? 'Edit transaction' : 'New transaction', body, foot);
  if (wasOpen) el('drawerBody').scrollTop = scroll;
  if (f.id && (window.App as Partial<AppApi>).loadTxExtras) App.loadTxExtras(f.id, f.splits.map(s => s.jid).filter(Boolean));
}
export function collectTx() {
  const f = S.form; if (!f || !el('txForm')) return;
  const v = id => el<Field>(id) ? el<Field>(id).value : undefined;
  f.date = v('f-date') ?? f.date; f.title = v('f-title') ?? f.title; f.rules = el<HTMLInputElement>('f-rules') ? el<HTMLInputElement>('f-rules').checked : f.rules;
  if (el('f-main')) f.main = v('f-main');
  if (el('f-src')) f.src = v('f-src');
  if (el('f-dst')) f.dst = v('f-dst');
  document.querySelectorAll<HTMLElement>('#txForm .split').forEach(card => {
    const s = f.splits[Number(card.dataset.i)];
    card.querySelectorAll<HTMLInputElement>('[data-k]').forEach(inp => { s[inp.dataset.k!] = inp.value; });
  });
}
function resolveCounter(name, kind) {
  const L = S.lists!, pool = kind === 'withdrawal' ? [...L.expense, ...L.own.filter(isLiab)] : [...L.revenue, ...L.own.filter(isLiab)];
  const hit = pool.find(a => sameName(a.name, name));
  return hit ? { id: hit.id } : { name: name.trim() };
}
function buildTxPayload() {
  const f = S.form, edit = !!f.id;
  const txs = f.splits.map(s => {
    const o: any = { type: f.type, date: f.date, amount: String(Math.abs(num(s.amount))), description: s.description.trim() };
    if (edit && s.jid) o.transaction_journal_id = s.jid;
    const changed = k => !edit || !s.jid || String(s[k] || '') !== String((s.orig || {})[k] || '');
    if (f.type === 'withdrawal') {
      o.source_id = f.main;
      if (s.counter.trim()) { const c = resolveCounter(s.counter, 'withdrawal'); c.id ? (o.destination_id = c.id) : (o.destination_name = c.name); }
      if (changed('budget')) o.budget_id = s.budget || '0';
      if (changed('bill')) o.bill_id = s.bill || '0';
    } else if (f.type === 'deposit') {
      o.destination_id = f.main;
      if (s.counter.trim()) { const c = resolveCounter(s.counter, 'deposit'); c.id ? (o.source_id = c.id) : (o.source_name = c.name); }
    } else {
      o.source_id = f.src; o.destination_id = f.dst;
    }
    if (changed('category')) o.category_name = s.category.trim();
    if (changed('tags')) o.tags = s.tags.split(',').map(t => t.trim()).filter(Boolean);
    if (changed('notes')) o.notes = s.notes;
    if (changed('fa') || changed('fc')) {
      if (s.fa && num(s.fa) > 0 && s.fc) { o.foreign_amount = String(num(s.fa)); o.foreign_currency_code = s.fc; }
      else if (edit && s.jid) { o.foreign_amount = '0'; }
    }
    // On edit, fields left out stay as they are in Firefly, so only changed ones are sent.
    return o;
  });
  const body: any = { apply_rules: f.rules, fire_webhooks: true, transactions: txs };
  if (txs.length > 1) body.group_title = f.title.trim();
  if (!edit) body.error_if_duplicate_hash = false;
  return body;
}
async function saveTx(formEl) {
  collectTx();
  const f = S.form;
  if (f.type === 'transfer') {
    if (!f.src || !f.dst) return formError('Choose both accounts for the transfer.');
    if (f.src === f.dst) return formError('A transfer needs two different accounts.');
  } else if (!f.main) return formError('Choose the account.');
  for (const s of f.splits) {
    if (s.fa && num(s.fa) > 0 && !s.fc) return formError('Pick the currency for the foreign amount.');
    if (!s.description.trim()) return formError('Every part needs a description.');
    if (!(num(s.amount) > 0)) return formError('Every part needs an amount above zero.');
  }
  // Optimistic: close right away and show the change; if Firefly refuses, reopen the form with the error.
  const body = buildTxPayload(), row = f.id && document.querySelector<HTMLElement>('#view tr[data-gid="' + f.id + '"]');
  closeDrawer();
  if (row) {
    row.classList.add('saving');
    const d = row.querySelector('.desc'); if (d && f.splits.length === 1) d.textContent = f.splits[0].description;
    const a = row.querySelector('.amt'); if (a && f.splits.length === 1 && f.type !== 'transfer') a.textContent = (f.type === 'deposit' ? '+' : '-') + money(num(f.splits[0].amount)).replace('-', '');
    const c = row.querySelector('.catcol span'); if (c && f.splits.length === 1) { c.textContent = f.splits[0].category || '—'; }
  } else toast('Saving…');
  if (window.App && App.buzz) App.buzz(8);
  try {
    if (f.id) await api('/transactions/' + f.id, { method: 'PUT', body });
    else await api('/transactions', { method: 'POST', body });
    invalidate(); toast(f.id ? 'Transaction updated' : 'Transaction added'); route();
  } catch (e) {
    if (e instanceof AuthError) return showLogin(e.message);
    if (row) row.classList.remove('saving');
    S.drawerHero = null; S.form = f; renderTxForm(); formError((e as Error).message);
  }
}
async function deleteTx() {
  const f = S.form; if (!f || !f.id) return;
  closeDrawer();
  App.softDeleteTx([f.id]);
}

// The methods markup handlers call (see events.ts), added to App and to its type
const methods = {
  editTx,
  saveTx,
  deleteTx,
};
Object.assign(App, methods);
type Methods = typeof methods;
declare module '../core/base' { interface AppApi extends Methods {} }
