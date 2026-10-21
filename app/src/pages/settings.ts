import { html, htmlList } from '../core/html';
import { AuthError, api, getAll, type ApiError } from '../core/api';
import { withAuth } from '../core/auth';
import { App, S, el, fmtDate, isoDate, num, todayIso } from '../core/base';
import { confirmBox, head, opt, toast } from '../core/dom';
import { LS, saveBlob } from '../core/helpers';
import { logosOn } from '../core/logo';
import { invalidate, lists } from '../core/lists';
import { VIEWS, route } from '../core/router';

/* ================= Settings ================= */
const EXPORTS = [['transactions', 'Transactions'], ['accounts', 'Accounts'], ['budgets', 'Budgets'], ['categories', 'Categories'], ['tags', 'Tags'],
  ['bills', 'Bills'], ['piggy-banks', 'Piggy banks'], ['recurring', 'Recurring transactions'], ['rules', 'Rules']];
VIEWS.settings = async (r, paint) => {
  const L = await lists(true);
  const [about, rates, hooks, ingest] = await Promise.all([
    api('/about').catch(() => ({})), getAll('/exchange-rates').catch(() => null), getAll('/webhooks').catch(() => null), ingestKey(),
  ]);
  const enabled = L.currencies.filter(c => c.enabled), disabled = L.currencies.filter(c => !c.enabled);
  const yr = new Date().getFullYear();
  const cur = html`<section class="panel"><h2>Currencies</h2><p class="lead">Your main currency is <strong>${S.currency}</strong>. Enabled currencies can be used for foreign amounts and accounts.</p><div class="list">${htmlList(enabled.map(c => html`<div class="row"><span class="name">${c.code} · ${c.name}${c.code === S.currency ? html` <span class="chip good">Main</span>` : ''}</span><span style="display:flex;gap:8px">${c.code !== S.currency ? html`<button class="link" data-onclick="App.currency('${c.code}','primary')">Make main</button><button class="link" data-onclick="App.currency('${c.code}','disable')">Disable</button>` : ''}</span></div>`))}</div><form style="display:flex;gap:8px;margin-top:14px" data-onsubmit="event.preventDefault();App.currency(this.c.value,'enable')"><select name="c" style="flex:1">${htmlList(disabled.map(c => opt(c.code, c.code + ' · ' + c.name, '')))}</select><button class="btn">Enable</button></form></section>`;
  S.rates = rates || [];
  const showAll = r.q.rates === 'all';
  const rateHtml = rates === null ? '' : html`<section class="panel"><h2>Exchange rates</h2><p class="lead">Used to convert foreign amounts in reports.</p>${rates.length ? html`<div class="list">${htmlList(rates.slice(0, showAll ? 500 : 6).map(x => { const a = x.attributes; return html`<div class="row"><span class="name">1 ${a.from_currency_code || a.from} = ${num(a.rate)} ${a.to_currency_code || a.to} <span class="sub-s">on ${fmtDate(a.date)}</span></span><button class="link" data-onclick="App.deleteRate('${x.id}')">Remove</button></div>`; }))}</div>${rates.length > 6 ? html`<p style="margin:10px 0 0"><a class="link" href="#/settings${showAll ? '' : '?rates=all'}">${showAll ? 'Show fewer' : 'Show all ' + rates.length + ' rates'}</a></p>` : ''}` : html`<p class="empty">No rates yet.</p>`}<form style="margin-top:14px" data-onsubmit="event.preventDefault();App.addRate(this)"><div class="grid2"><label>From<select name="f">${htmlList(enabled.map(c => opt(c.code, c.code, S.currency)))}</select></label><label>To<select name="t">${htmlList(enabled.map(c => opt(c.code, c.code, (enabled.find(x => x.code !== S.currency) || {}).code)))}</select></label><label>Rate<input type="number" step="any" min="0" name="r" required></label><label>Date<input type="date" name="d" value="${todayIso()}" required></label></div><button class="btn small">Add rate</button></form></section>`;
  const exp = html`<section class="panel"><h2>Export data</h2><p class="lead">Download CSV files you can open in Excel or Numbers.</p><div class="grid2"><label>From (transactions only)<input type="date" id="ex-start" value="${yr - 1}-01-01"></label><label>To<input type="date" id="ex-end" value="${todayIso()}"></label></div><div style="display:flex;flex-wrap:wrap;gap:8px">${htmlList(EXPORTS.map(([k, l]) => html`<button class="btn small" data-onclick="App.exportData('${k}', this)">${l}</button>`))}</div></section>`;
  const TRIG = [['STORE_TRANSACTION', 'A transaction is added'], ['UPDATE_TRANSACTION', 'A transaction is changed'], ['DESTROY_TRANSACTION', 'A transaction is deleted']];
  const hookHtml = hooks === null ? '' : html`<section class="panel"><h2>Webhooks</h2><p class="lead">Firefly calls these web addresses when transactions change — for automations like Home Assistant or n8n.</p>${hooks.length ? html`<div class="list">${htmlList(hooks.map(x => { const a = x.attributes, tr = a.trigger || (a.triggers || [])[0];
      return html`<div class="row"><span class="name"><label class="check" style="margin:0;display:inline-flex"><input type="checkbox"${a.active ? ' checked' : ''} data-onchange="App.toggleHook('${x.id}',this.checked)"> ${a.title}</label><br><span class="sub-s">${(TRIG.find(t => t[0] === tr) || [0, tr])[1]} → ${a.url}</span></span><button class="link" data-onclick="App.deleteHook('${x.id}')">Delete</button></div>`; }))}</div>` : html`<p class="empty">No webhooks.</p>`}<form data-onsubmit="event.preventDefault();App.addHook(this)" style="margin-top:14px"><div class="grid2"><label>Name<input type="text" name="t" required></label><label>When<select name="w">${htmlList(TRIG.map(([v, l]) => opt(v, l, '')))}</select></label></div><label>URL<input type="text" name="u" placeholder="https://…" required></label><div class="grid2"><label>Send<select name="r">${opt('TRANSACTIONS', 'The transaction', '')}${opt('ACCOUNTS', 'The accounts involved', '')}${opt('NONE', 'Nothing (just ping)', '')}</select></label><span></span></div><button class="btn small">Add webhook</button></form></section>`;
  const ab = (about && about.data) || {};
  const aboutHtml = html`<section class="panel"><h2>About</h2><div class="list"><div class="row"><span class="name">Money version</span><span>${moneyVersion() || 'Not stamped (local build or plain files)'}</span></div><div class="row"><span class="name">Firefly III version</span><span>${ab.version || '—'}</span></div><div class="row"><span class="name">API version</span><span>${ab.api_version || '—'}</span></div><div class="row"><span class="name">Main currency</span><span>${S.currency}</span></div></div><p class="sub-s" style="margin-top:14px">Your Firefly profile, password, two-factor login, API tokens and user administration aren’t available through Firefly’s API, so change those in Firefly III itself.</p></section>`;
  const recalcHtml = html`<section class="panel"><h2>Recalculate</h2><p class="lead">If a total looks wrong, throw away everything this app has saved and fetch every number fresh from Firefly III. Your data in Firefly isn’t changed.</p><button class="btn" type="button" data-onclick="App.recalcAll(this)">Recalculate everything</button></section>`;
  const syncOff = !!LS.get('syncOff', false), syncAt = LS.get('syncAt', 0);
  const syncHtml = html`<section class="panel"><h2>Sync between devices</h2><p class="lead">Your Overview layout, dismissed insights, forecast, loan plan and subscription choices are saved in Firefly III, so they follow you to every device. Theme, hidden amounts and density stay with each device.</p><label class="check"><input type="checkbox"${syncOff ? '' : ' checked'} data-onchange="App.toggleSync(this.checked)"> Sync this device’s settings</label><p class="sub-s">${syncOff ? 'Off: this device keeps its own settings.' : S.syncError ? html`<span class="up">Couldn’t sync: ${S.syncError}</span>` : syncAt ? 'Last synced ' + fmtDate(isoDate(new Date(syncAt))) + ' at ' + new Date(syncAt).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }) + '.' : 'Nothing synced yet.'}</p>${syncOff ? '' : html`<button class="btn small" type="button" data-onclick="App.syncNow()">Sync now</button>`}</section>`;
  const logoHtml = html`<section class="panel"><h2>Logos</h2><p class="lead">Show payees’ and banks’ logos instead of their initials. Your Money server fetches each logo from DuckDuckGo’s icon service by the payee’s website (guessed from its name; change it in the account’s settings) and keeps it, so your browser never contacts another site.</p><label class="check"><input type="checkbox"${logosOn() ? ' checked' : ''} data-onchange="App.toggleLogos(this.checked)"> Show logos</label></section>`;
  paint(html`${head('Settings', '', '')}<div class="cards">${recalcHtml}${syncHtml}${logoHtml}${applePayHtml(ingest)}${cur}${rateHtml}${exp}${hookHtml}${aboutHtml}</div>`);
};
// The build stamped into the Docker image by GitHub, e.g. "c78fd51 · 2026-09-30". Empty for a local build or plain files.
function moneyVersion() {
  const m = document.querySelector<HTMLMetaElement>('meta[name="money-version"]'), v = m ? m.content.trim() : '';
  return v && !v.startsWith('$') ? v : '';
}
async function currency(code: string, action: string) {
  if (!code) return;
  await withAuth(async () => {
    try { await api('/currencies/' + code + '/' + action, { method: 'POST' }); }
    catch (e) {
      if (action === 'primary') await api('/currencies/' + code + '/default', { method: 'POST' });
      else if (action === 'disable' && (e as ApiError).status === 409) return disableInUse(code);
      else throw e;
    }
    invalidate(); toast(({ enable: 'Enabled ', disable: 'Disabled ', primary: 'Main currency is now ' } as Record<string, string>)[action] + code); route();
  });
}
// Firefly refuses (409) to disable a currency that anything still uses. Exchange rates are the usual
// culprit (Firefly adds a set of EUR rates itself), so offer to remove those and try again.
async function disableInUse(code: string) {
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
    if ((e as ApiError).status !== 409) throw e;
    await confirmBox(code + ' is still in use', 'The exchange rates are gone, but something else still uses ' + code + ' — an account, bill, budget, piggy bank or transaction. Change those first.', 'OK');
  }
  invalidate(); route();
}
async function addRate(f: HTMLFormElement) {
  if (f.f.value === f.t.value) return toast('Pick two different currencies.');
  await withAuth(async () => { await api('/exchange-rates', { method: 'POST', body: { from: f.f.value, to: f.t.value, rate: String(num(f.r.value)), date: f.d.value } }); toast('Rate added'); route(); });
}
async function deleteRate(id: string) { await withAuth(async () => { await api('/exchange-rates/' + id, { method: 'DELETE' }); toast('Rate removed'); route(); }); }
async function exportData(kind: string, btn: HTMLButtonElement) {
  btn.disabled = true;
  await withAuth(async () => {
    const params: any = { type: 'csv' };
    if (kind === 'transactions') { params.start = el<HTMLInputElement>('ex-start').value; params.end = el<HTMLInputElement>('ex-end').value; }
    const blob = await api('/data/export/' + kind, { params, as: 'blob' });
    saveBlob(blob, 'firefly-' + kind + '-' + todayIso() + '.csv');
  });
  btn.disabled = false;
}
async function addHook(f: HTMLFormElement) {
  const body = { title: f.t.value.trim(), url: f.u.value.trim(), active: true, trigger: f.w.value, response: f.r.value, delivery: 'JSON',
    triggers: [f.w.value], responses: [f.r.value], deliveries: ['JSON'] };
  if (!/^https?:\/\//.test(body.url)) return toast('The URL must start with http:// or https://');
  await withAuth(async () => { await api('/webhooks', { method: 'POST', body }); toast('Webhook added'); route(); });
}
async function toggleHook(id: string, on: boolean) { await withAuth(async () => { await api('/webhooks/' + id, { method: 'PUT', body: { active: on } }); toast(on ? 'Webhook on' : 'Webhook off'); }); }
async function deleteHook(id: string) {
  if (!await confirmBox('Delete this webhook?', 'Firefly will stop calling that address.')) return;
  await withAuth(async () => { await api('/webhooks/' + id, { method: 'DELETE' }); toast('Webhook deleted'); route(); });
}

// Apple Pay auto-logging (app/ingest.js): the address and key the iPhone Shortcut sends each payment to.
// Null when this server doesn't have it (an older image, or the plain-files setup without nginx).
async function ingestKey(): Promise<string | null> {
  try {
    const r = await fetch('/api/money-ingest', { cache: 'no-store', headers: { 'X-Money': '1' } });
    return r.ok ? (await r.json()).key || null : null;
  } catch (e) { return null; }
}
function applePayHtml(key: string | null) {
  if (!key) return '';
  const url = location.origin + '/api/money-ingest';
  return html`<section class="panel"><h2>Apple Pay</h2><p class="lead">Log Apple Pay purchases the moment you pay. An iPhone Shortcut sends the amount, merchant and card here, and Money adds the expense to the account named like the card, tagged “Apple Pay”, with the category from the last time. Your iPhone must be able to reach this address when you pay, so outside your home network it needs a VPN (like Tailscale) or a reverse proxy.</p><div class="list"><div class="row"><span class="name" style="flex:none">Address</span><span style="display:flex;gap:8px;align-items:center;min-width:0"><code style="overflow-wrap:anywhere;font-size:13px">${url}</code><button class="link" type="button" data-onclick="App.copyText('${url}', 'Address copied')">Copy</button></span></div><div class="row"><span class="name">Key</span><span style="display:flex;gap:8px;align-items:center"><code>••••••••</code><button class="link" type="button" data-onclick="App.copyText('${key}', 'Key copied')">Copy</button></span></div></div><p class="sub-s" style="margin-top:14px">Treat the key like a password: anyone with it can add expenses. Changing the dashboard password or Firefly token gives a new key. <a class="link" href="https://github.com/Muffy0906/firefly-money/blob/main/docs/apple-pay.md" target="_blank" rel="noopener">Set up the Shortcut ↗</a></p></section>`;
}
async function copyText(text: string, done: string) {
  try { await navigator.clipboard.writeText(text); toast(done); } catch (e) { toast('Couldn’t copy. Your browser blocked it.'); }
}

function toggleLogos(on: boolean) { LS.set('logos', !!on); toast(on ? 'Logos on' : 'Logos off'); }

// The methods markup handlers call (see events.ts), added to App and to its type
const methods = {
  currency,
  toggleLogos,
  copyText,
  addRate,
  deleteRate,
  exportData,
  addHook,
  toggleHook,
  deleteHook,
};
Object.assign(App, methods);
type Methods = typeof methods;
declare module '../core/base' { interface AppApi extends Methods {} }
