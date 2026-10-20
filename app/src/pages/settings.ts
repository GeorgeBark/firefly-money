import { AuthError, api, getAll } from '../core/api';
import { withAuth } from '../core/auth';
import { App, S, el, esc, fmtDate, num, todayIso } from '../core/base';
import { confirmBox, head, opt, toast } from '../core/dom';
import { saveBlob } from '../core/helpers';
import { invalidate, lists } from '../core/lists';
import { VIEWS, route } from '../core/router';

/* ================= Settings ================= */
const EXPORTS = [['transactions', 'Transactions'], ['accounts', 'Accounts'], ['budgets', 'Budgets'], ['categories', 'Categories'], ['tags', 'Tags'],
  ['bills', 'Bills'], ['piggy-banks', 'Piggy banks'], ['recurring', 'Recurring transactions'], ['rules', 'Rules']];
VIEWS.settings = async (r, paint) => {
  const L = await lists(true);
  const [about, rates, hooks] = await Promise.all([
    api('/about').catch(() => ({})), getAll('/exchange-rates').catch(() => null), getAll('/webhooks').catch(() => null),
  ]);
  const enabled = L.currencies.filter(c => c.enabled), disabled = L.currencies.filter(c => !c.enabled);
  const yr = new Date().getFullYear();
  const cur = '<section class="panel"><h2>Currencies</h2><p class="lead">Your main currency is <strong>' + esc(S.currency) + '</strong>. Enabled currencies can be used for foreign amounts and accounts.</p><div class="list">' +
    enabled.map(c => '<div class="row"><span class="name">' + esc(c.code) + ' · ' + esc(c.name) + (c.code === S.currency ? ' <span class="chip good">Main</span>' : '') + '</span><span style="display:flex;gap:8px">' +
      (c.code !== S.currency ? '<button class="link" data-onclick="App.currency(\'' + c.code + '\',\'primary\')">Make main</button><button class="link" data-onclick="App.currency(\'' + c.code + '\',\'disable\')">Disable</button>' : '') + '</span></div>').join('') +
    '</div><form style="display:flex;gap:8px;margin-top:14px" data-onsubmit="event.preventDefault();App.currency(this.c.value,\'enable\')"><select name="c" style="flex:1">' + disabled.map(c => opt(c.code, c.code + ' · ' + c.name, '')).join('') + '</select><button class="btn">Enable</button></form></section>';
  S.rates = rates || [];
  const showAll = r.q.rates === 'all';
  const rateHtml = rates === null ? '' : '<section class="panel"><h2>Exchange rates</h2><p class="lead">Used to convert foreign amounts in reports.</p>' +
    (rates.length ? '<div class="list">' + rates.slice(0, showAll ? 500 : 6).map(x => { const a = x.attributes; return '<div class="row"><span class="name">1 ' + esc(a.from_currency_code || a.from) + ' = ' + esc(num(a.rate)) + ' ' + esc(a.to_currency_code || a.to) +
      ' <span class="sub-s">on ' + fmtDate(a.date) + '</span></span><button class="link" data-onclick="App.deleteRate(\'' + x.id + '\')">Remove</button></div>'; }).join('') + '</div>' +
      (rates.length > 6 ? '<p style="margin:10px 0 0"><a class="link" href="#/settings' + (showAll ? '' : '?rates=all') + '">' + (showAll ? 'Show fewer' : 'Show all ' + rates.length + ' rates') + '</a></p>' : '') : '<p class="empty">No rates yet.</p>') +
    '<form style="margin-top:14px" data-onsubmit="event.preventDefault();App.addRate(this)"><div class="grid2">' +
    '<label>From<select name="f">' + enabled.map(c => opt(c.code, c.code, S.currency)).join('') + '</select></label>' +
    '<label>To<select name="t">' + enabled.map(c => opt(c.code, c.code, (enabled.find(x => x.code !== S.currency) || {}).code)).join('') + '</select></label>' +
    '<label>Rate<input type="number" step="any" min="0" name="r" required></label><label>Date<input type="date" name="d" value="' + todayIso() + '" required></label></div><button class="btn small">Add rate</button></form></section>';
  const exp = '<section class="panel"><h2>Export data</h2><p class="lead">Download CSV files you can open in Excel or Numbers.</p>' +
    '<div class="grid2"><label>From (transactions only)<input type="date" id="ex-start" value="' + (yr - 1) + '-01-01"></label><label>To<input type="date" id="ex-end" value="' + todayIso() + '"></label></div>' +
    '<div style="display:flex;flex-wrap:wrap;gap:8px">' + EXPORTS.map(([k, l]) => '<button class="btn small" data-onclick="App.exportData(\'' + k + '\', this)">' + l + '</button>').join('') + '</div></section>';
  const TRIG = [['STORE_TRANSACTION', 'A transaction is added'], ['UPDATE_TRANSACTION', 'A transaction is changed'], ['DESTROY_TRANSACTION', 'A transaction is deleted']];
  const hookHtml = hooks === null ? '' : '<section class="panel"><h2>Webhooks</h2><p class="lead">Firefly calls these web addresses when transactions change — for automations like Home Assistant or n8n.</p>' +
    (hooks.length ? '<div class="list">' + hooks.map(x => { const a = x.attributes, tr = a.trigger || (a.triggers || [])[0];
      return '<div class="row"><span class="name"><label class="check" style="margin:0;display:inline-flex"><input type="checkbox"' + (a.active ? ' checked' : '') + ' data-onchange="App.toggleHook(\'' + x.id + '\',this.checked)"> ' + esc(a.title) + '</label>' +
        '<br><span class="sub-s">' + esc((TRIG.find(t => t[0] === tr) || [0, tr])[1]) + ' → ' + esc(a.url) + '</span></span><button class="link" data-onclick="App.deleteHook(\'' + x.id + '\')">Delete</button></div>'; }).join('') + '</div>' : '<p class="empty">No webhooks.</p>') +
    '<form data-onsubmit="event.preventDefault();App.addHook(this)" style="margin-top:14px"><div class="grid2"><label>Name<input type="text" name="t" required></label><label>When<select name="w">' + TRIG.map(([v, l]) => opt(v, l, '')).join('') + '</select></label></div>' +
    '<label>URL<input type="text" name="u" placeholder="https://…" required></label><div class="grid2"><label>Send<select name="r">' + opt('TRANSACTIONS', 'The transaction', '') + opt('ACCOUNTS', 'The accounts involved', '') + opt('NONE', 'Nothing (just ping)', '') + '</select></label><span></span></div>' +
    '<button class="btn small">Add webhook</button></form></section>';
  const ab = (about && about.data) || {};
  const aboutHtml = '<section class="panel"><h2>About</h2><div class="list">' +
    '<div class="row"><span class="name">Money version</span><span>' + esc(moneyVersion() || 'Not stamped (local build or plain files)') + '</span></div>' +
    '<div class="row"><span class="name">Firefly III version</span><span>' + esc(ab.version || '—') + '</span></div>' +
    '<div class="row"><span class="name">API version</span><span>' + esc(ab.api_version || '—') + '</span></div>' +
    '<div class="row"><span class="name">Main currency</span><span>' + esc(S.currency) + '</span></div></div>' +
    '<p class="sub-s" style="margin-top:14px">Your Firefly profile, password, two-factor login, API tokens and user administration aren’t available through Firefly’s API, so change those in Firefly III itself.</p></section>';
  const recalcHtml = '<section class="panel"><h2>Recalculate</h2><p class="lead">If a total looks wrong, throw away everything this app has saved and fetch every number fresh from Firefly III. Your data in Firefly isn’t changed.</p>' +
    '<button class="btn" type="button" data-onclick="App.recalcAll(this)">Recalculate everything</button></section>';
  paint(head('Settings', '', '') + '<div class="cards">' + recalcHtml + cur + rateHtml + exp + hookHtml + aboutHtml + '</div>');
};
// The build stamped into the Docker image by GitHub, e.g. "c78fd51 · 2026-09-30". Empty for a local build or plain files.
function moneyVersion() {
  const m = document.querySelector<HTMLMetaElement>('meta[name="money-version"]'), v = m ? m.content.trim() : '';
  return v && !v.startsWith('$') ? v : '';
}
async function currency(code, action) {
  if (!code) return;
  await withAuth(async () => {
    try { await api('/currencies/' + code + '/' + action, { method: 'POST' }); }
    catch (e) {
      if (action === 'primary') await api('/currencies/' + code + '/default', { method: 'POST' });
      else if (action === 'disable' && e.status === 409) return disableInUse(code);
      else throw e;
    }
    invalidate(); toast({ enable: 'Enabled ', disable: 'Disabled ', primary: 'Main currency is now ' }[action] + code); route();
  });
}
// Firefly refuses (409) to disable a currency that anything still uses. Exchange rates are the usual
// culprit (Firefly adds a set of EUR rates itself), so offer to remove those and try again.
async function disableInUse(code) {
  const rates = (S.rates || []).filter(x => [x.attributes.from_currency_code || x.attributes.from, x.attributes.to_currency_code || x.attributes.to].includes(code));
  if (!rates.length) {
    return confirmBox(code + ' is still in use', 'Firefly won’t disable ' + code + ' while an account, bill, budget, piggy bank or transaction uses it. Change those to another currency first.', 'OK');
  }
  if (!await confirmBox(code + ' is still in use', code + ' has ' + rates.length + ' exchange rate' + (rates.length === 1 ? '' : 's') + ', which stops Firefly from disabling it. Remove ' +
    (rates.length === 1 ? 'that rate' : 'those rates') + ' and disable ' + code + '?', 'Remove & disable')) return;
  let done = 0;
  for (const x of rates) { try { await api('/exchange-rates/' + x.id, { method: 'DELETE' }); done++; } catch (e) { if (e instanceof AuthError) throw e; } }
  try {
    await api('/currencies/' + code + '/disable', { method: 'POST' });
    toast('Removed ' + done + ' rate' + (done === 1 ? '' : 's') + ' and disabled ' + code);
  } catch (e) {
    if (e.status !== 409) throw e;
    await confirmBox(code + ' is still in use', 'The exchange rates are gone, but something else still uses ' + code + ' — an account, bill, budget, piggy bank or transaction. Change those first.', 'OK');
  }
  invalidate(); route();
}
async function addRate(f) {
  if (f.f.value === f.t.value) return toast('Pick two different currencies.');
  await withAuth(async () => { await api('/exchange-rates', { method: 'POST', body: { from: f.f.value, to: f.t.value, rate: String(num(f.r.value)), date: f.d.value } }); toast('Rate added'); route(); });
}
async function deleteRate(id) { await withAuth(async () => { await api('/exchange-rates/' + id, { method: 'DELETE' }); toast('Rate removed'); route(); }); }
async function exportData(kind, btn) {
  btn.disabled = true;
  await withAuth(async () => {
    const params: any = { type: 'csv' };
    if (kind === 'transactions') { params.start = el('ex-start').value; params.end = el('ex-end').value; }
    const blob = await api('/data/export/' + kind, { params, as: 'blob' });
    saveBlob(blob, 'firefly-' + kind + '-' + todayIso() + '.csv');
  });
  btn.disabled = false;
}
async function addHook(f) {
  const body = { title: f.t.value.trim(), url: f.u.value.trim(), active: true, trigger: f.w.value, response: f.r.value, delivery: 'JSON',
    triggers: [f.w.value], responses: [f.r.value], deliveries: ['JSON'] };
  if (!/^https?:\/\//.test(body.url)) return toast('The URL must start with http:// or https://');
  await withAuth(async () => { await api('/webhooks', { method: 'POST', body }); toast('Webhook added'); route(); });
}
async function toggleHook(id, on) { await withAuth(async () => { await api('/webhooks/' + id, { method: 'PUT', body: { active: on } }); toast(on ? 'Webhook on' : 'Webhook off'); }); }
async function deleteHook(id) {
  if (!await confirmBox('Delete this webhook?', 'Firefly will stop calling that address.')) return;
  await withAuth(async () => { await api('/webhooks/' + id, { method: 'DELETE' }); toast('Webhook deleted'); route(); });
}

Object.assign(App, {
  currency,
  addRate,
  deleteRate,
  exportData,
  addHook,
  toggleHook,
  deleteHook,
});
