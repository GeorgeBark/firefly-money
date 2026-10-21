// Auto-logging, run inside nginx (njs). Loaded by default.conf.template.
//
// An iPhone Shortcut (a Wallet "Transaction" automation, see docs/apple-pay.md) POSTs each Apple Pay tap to
// /api/money-ingest with {amount, merchant, card}, and this records it in Firefly as a withdrawal from the
// account that matches the card, tagged "Apple Pay". The Shortcut can't sign in, so it sends a key instead:
// Settings in the app shows it (GET /api/money-ingest with a session). The key is made from DASH_PASSWORD and
// FIREFLY_TOKEN, so changing either gives a new key, and the old one stops working.
//
// njs supports less JavaScript than a browser: no for…of, and no await inside a call's arguments.
import crypto from 'crypto';

const TAG = 'Apple Pay';
const FF = '/__firefly/api/v1';     // the internal location that forwards to Firefly with its token

const env = k => process.env[k] || '';
const mac = (key, s) => crypto.createHmac('sha256', key).update(s).digest('base64url');
function same(a, b) {
  const x = mac('money-compare', a), y = mac('money-compare', b);
  let d = 0;
  for (let i = 0; i < x.length; i++) d |= x.charCodeAt(i) ^ y.charCodeAt(i);
  return d === 0;
}
const key = () => mac(env('FIREFLY_TOKEN'), 'money-ingest\n' + env('DASH_PASSWORD'));

// "$1,234.56", "1.234,56 €", "-4.50", 12.3 → "1234.56", "1234.56", "-4.50", "12.30"; null when there's no number
function parseAmount(v) {
  if (typeof v === 'number') return isFinite(v) && v !== 0 ? v.toFixed(2) : null;
  const s = String(v || '').replace(/[\s ]/g, ''), neg = /^[^\d]*[-−(]/.test(s);
  let n = s.replace(/[^\d.,]/g, '');
  if (!/\d/.test(n)) return null;
  const dot = n.lastIndexOf('.'), comma = n.lastIndexOf(',');
  // the last separator is the decimal point when two or fewer digits follow it ("4,50"), else it groups thousands
  const dec = Math.max(dot, comma);
  if (dec >= 0 && n.length - dec - 1 <= 2) n = n.slice(0, dec).replace(/[.,]/g, '') + '.' + n.slice(dec + 1);
  else n = n.replace(/[.,]/g, '');
  const x = parseFloat(n);
  return x > 0 ? (neg ? -x : x).toFixed(2) : null;
}

const words = s => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
// The account a Wallet card name means: the same name, one name inside the other ("Apple Card" ↔ "Apple Card
// (Goldman)"), or the card's last four digits at the end of the account number. Null unless exactly one fits.
function matchAccount(accounts, card) {
  const c = words(card); if (!c) return null;
  const tries = [
    a => words(a.name) === c,
    a => { const n = words(a.name); return n.length >= 3 && (c.includes(n) || n.includes(c)); },
    a => { const d = /(\d{4})\D*$/.exec(card), num = (a.number || '').replace(/\D/g, ''); return !!d && num.length >= 4 && num.endsWith(d[1]); },
  ];
  for (let i = 0; i < tries.length; i++) { const hits = accounts.filter(tries[i]); if (hits.length === 1) return hits[0]; if (hits.length > 1) return null; }
  return null;
}

async function ff(r, method, path, args, body) {
  const res = await r.subrequest(FF + path, { method, args: args || '', body: body === undefined ? '' : JSON.stringify(body) });
  let data = null;
  try { data = JSON.parse(res.responseText || 'null'); } catch (e) { /* not JSON */ }
  return { status: res.status, data };
}
const own = async r => {
  const out = [];
  const types = ['asset', 'liabilities'];
  for (let i = 0; i < types.length; i++) {
    const res = await ff(r, 'GET', '/accounts', 'type=' + types[i] + '&limit=500');
    if (res.status !== 200) throw new Error('Firefly answered ' + res.status);
    ((res.data && res.data.data) || []).forEach(x => {
      const a = x.attributes || {};
      if (a.active !== false) out.push({ id: x.id, name: a.name || '', number: a.account_number || a.iban || '' });
    });
  }
  return out;
};
// The category and budget last used with this payee, as the app's quick add fills them (features/polish.ts)
async function lastUse(r, payee) {
  try {
    const found = await ff(r, 'GET', '/search/accounts', 'field=name&type=expense&limit=10&query=' + encodeURIComponent(payee));
    const acc = ((found.data && found.data.data) || []).find(x => words(x.attributes && x.attributes.name) === words(payee));
    if (!acc) return {};
    const txs = await ff(r, 'GET', '/accounts/' + acc.id + '/transactions', 'limit=25&type=withdrawal');
    const splits = ((txs.data && txs.data.data) || []).reduce((all, g) => all.concat((g.attributes && g.attributes.transactions) || []), []).filter(s => s.destination_id === acc.id);
    const s = splits.find(x => x.category_name) || splits[0];
    return s ? { category_name: s.category_name || undefined, budget_id: s.budget_id || undefined } : {};
  } catch (e) { return {}; }
}

function say(r, status, text) {
  r.headersOut['Content-Type'] = 'text/plain; charset=utf-8';
  r.headersOut['Cache-Control'] = 'no-store';
  r.return(status, text + '\n');
}

// GET (signed in to the app): the key for the Shortcut. POST (with the key): log a payment.
async function endpoint(r) {
  if (r.method === 'GET') {
    if (r.variables.money_session !== '1' || !r.headersIn['X-Money']) return say(r, 401, 'Sign in to Money first.');
    r.headersOut['Content-Type'] = 'application/json';
    r.headersOut['Cache-Control'] = 'no-store';
    return r.return(200, JSON.stringify({ key: key() }));
  }
  if (r.method !== 'POST') return say(r, 405, 'Use POST.');
  const auth = /^Bearer\s+(\S+)$/i.exec(r.headersIn['Authorization'] || '');
  if (!env('DASH_PASSWORD') || !auth || !same(auth[1], key())) return say(r, 401, 'Wrong key: copy it again from Money → Settings → Apple Pay.');

  let b = {};
  try { b = JSON.parse(r.requestText || '{}') || {}; } catch (e) { return say(r, 400, 'Send JSON: {"amount", "merchant", "card"}.'); }
  const amount = parseAmount(b.amount), merchant = String(b.merchant || '').trim().slice(0, 200);
  if (!amount) return say(r, 400, 'No amount in "' + String(b.amount || '') + '".');
  if (!merchant) return say(r, 400, 'No merchant.');

  try {
    const accounts = await own(r);
    const acc = b.account ? accounts.find(a => words(a.name) === words(b.account)) : matchAccount(accounts, b.card);
    if (!acc) return say(r, 422, 'No account matches ' + (b.account ? '"' + b.account + '"' : 'the card "' + (b.card || '') + '"') + '. Set "account" in the Shortcut to one of: ' + accounts.map(a => a.name).join(', '));
    const refund = amount[0] === '-', abs = refund ? amount.slice(1) : amount;
    const usual = refund ? {} : await lastUse(r, merchant);
    const split = Object.assign(usual, {
      type: refund ? 'deposit' : 'withdrawal',
      date: new Date().toISOString().replace(/\.\d+Z$/, 'Z'),
      amount: abs,
      description: merchant,
      tags: [TAG],
      notes: 'Logged by the Apple Pay shortcut' + (b.card ? ' (' + String(b.card).slice(0, 100) + ')' : '') + '.',
    }, refund ? { source_name: merchant, destination_id: acc.id } : { source_id: acc.id, destination_name: merchant });
    const res = await ff(r, 'POST', '/transactions', '', { error_if_duplicate_hash: true, apply_rules: true, fire_webhooks: true, transactions: [split] });
    if (res.status === 200) return say(r, 200, (refund ? 'Refund of ' : 'Logged ') + abs + ' at ' + merchant + ' (' + acc.name + ').');
    const msg = res.data && res.data.message || '';
    if (res.status === 422 && /duplicate/i.test(msg + JSON.stringify(res.data && res.data.errors || {}))) return say(r, 200, 'Already logged.');
    return say(r, 502, 'Firefly refused it (' + res.status + '): ' + (msg || 'no reason given'));
  } catch (e) {
    return say(r, 502, 'Couldn’t reach Firefly: ' + e.message);
  }
}

export default { endpoint, parseAmount, matchAccount };
