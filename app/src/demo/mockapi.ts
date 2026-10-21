/* A fake Firefly III API with made-up data, for the online demo (demo.ts). It's a port of dev/mock_server.py:
   only the endpoints the UI uses are implemented, writes are accepted but not stored (except deletes), and
   all names and amounts are invented. Keep the two in step when the demo data changes. */

// A small seeded random number generator (mulberry32), so the demo data is the same on every visit
function seeded(seed) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Dates are whole days, kept as UTC midnights so adding days never trips over daylight saving
const DAY = 86400000;
const iso = (t: number) => new Date(t).toISOString().slice(0, 10);
const ymd = (t: number) => { const d = new Date(t); return [d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()]; };
const utc = (y: number, m: number, d: number) => Date.UTC(y, m, d);

export class NotFound extends Error {}

type MockAccount = { id: string, type: 'accounts', attributes: { name: string, type: string, current_balance: string, account_role: string | null, [k: string]: unknown } };
type MockSplit = {
  transaction_journal_id: string, type: string, date: string, amount: string, description: string,
  source_id: string, source_name: string, source_type: string, destination_id: string, destination_name: string, destination_type: string,
  category_name: string | null, category_id: string | null, budget_id: string | null, budget_name: string | null, bill_id: string | null, tags: string[], notes: string,
  foreign_amount: string | null, foreign_currency_code: string | null, reconciled: boolean,
};
type MockGroup = { id: string, type: 'transactions', attributes: { group_title: string | null, transactions: MockSplit[] } };

export function createMockApi(now = new Date()) {
  const random = seeded(7);
  const uniform = (a: number, b: number) => a + (b - a) * random();
  const choice = <T>(xs: T[]) => xs[Math.floor(random() * xs.length)];
  const TODAY = utc(now.getFullYear(), now.getMonth(), now.getDate());
  const [ty, tm, td] = ymd(TODAY);

  const ACC: MockAccount[] = [];
  const acc = (id, name, type, bal = 0, role: string | null = null, kw = {}) => {
    const a: MockAccount = { id: String(id), type: 'accounts', attributes: { name, type, current_balance: String(bal), account_role: role,
      active: true, currency_code: 'USD', include_net_worth: true, notes: '', opening_balance: '0', ...kw } };
    ACC.push(a); return a;
  };
  acc(1, 'Everyday Checking', 'asset', 3240.18, 'defaultAsset');
  acc(2, 'High-Yield Savings', 'asset', 12050.00, 'savingAsset');
  acc(3, 'Rewards Card', 'asset', -612.40, 'ccAsset', { monthly_payment_date: '2026-01-03' });
  acc(4, 'Cashback Card', 'asset', -240.10, 'ccAsset', { monthly_payment_date: '2026-01-31' });
  acc(5, 'Car loan', 'liability', -9020, null, { liability_type: 'loan', current_debt: '9020', interest: '5.9', interest_period: 'yearly' });
  acc(6, 'Acme Corp', 'revenue');
  const PAYEES: [string, string, string | null, number, number][] = [  // name, category, budget, typical amount, per-month count
    ['Green Grocer', 'Groceries', 'Food', 64, 5], ['Corner Market', 'Groceries', 'Food', 48, 4], ['SQ *BEAN THERE COFFEE', 'Dining', 'Food', 7, 6],
    ['Burrito Bar', 'Dining', 'Food', 14, 3], ['Taco Stand', 'Dining', 'Food', 22, 2], ['Fuel Stop', 'Gas', null, 42, 3], ['Online Store', 'Shopping', null, 38, 3],
    ['StreamFlix', 'Subscriptions', null, 15.49, 1], ['Tunes Plus', 'Subscriptions', null, 11.99, 1], ['City Power & Light', 'Utilities', null, 96, 1],
    ['Pharmacy Plus', 'Health', null, 23, 1], ['Big Box Store', 'Shopping', null, 55, 1],
  ];
  const PID = {};
  PAYEES.forEach((p, i) => { PID[p[0]] = String(100 + i); acc(100 + i, p[0], 'expense'); });
  const CATS = [...new Set([...PAYEES.map(p => p[1]), 'Salary', 'Travel'])].sort();
  const CAT_ID = Object.fromEntries(CATS.map((c, i) => [c, String(i + 1)]));
  const BUDGETS = { Food: '1', Fun: '2' };
  const ACC_BY = Object.fromEntries(ACC.map(a => [a.id, a]));

  const PIGGIES = ([['Emergency fund', 10000, 6200, null], ['Summer trip', 2400, 950, iso(TODAY + 200 * DAY)]] as [string, number, number, string | null][])
    .map(([name, t, c, date], i) => ({ id: String(i + 1), attributes: { name, target_amount: String(t), current_amount: String(c), left_to_save: String(t - c),
      target_date: date, active: true, accounts: [{ account_id: '2', name: 'High-Yield Savings', current_amount: String(c) }] } }));

  let TX: MockGroup[] = [];
  const addTx = (d: number, type, amt: number, description, src, dst, cat: string | null = null, bud: string | null = null) => {
    const gid = String(TX.length + 1), s = ACC_BY[src].attributes, t = ACC_BY[dst].attributes;
    TX.push({ id: gid, type: 'transactions', attributes: { group_title: null, transactions: [{
      transaction_journal_id: gid, type, date: iso(d) + 'T12:00:00-05:00', amount: amt.toFixed(2), description,
      source_id: src, source_name: s.name, source_type: s.type, destination_id: dst, destination_name: t.name, destination_type: t.type,
      category_name: cat, category_id: CAT_ID[cat ?? ''] ?? null, budget_id: BUDGETS[bud ?? ''] ?? null, budget_name: bud, bill_id: null, tags: [], notes: '',
      foreign_amount: null, foreign_currency_code: null, reconciled: false }] } });
  };

  // About five months of history: two paychecks a month, everyday spending, and a card payment on the 3rd
  const [sy, sm] = ymd(utc(ty, tm, 1) - 150 * DAY);
  for (let d = utc(sy, sm, 1); d <= TODAY; d += DAY) {
    const [y, m, day] = ymd(d);
    if (day === 15 || d === utc(y, m + 1, 0)) addTx(d, 'deposit', 2850, 'ACME CORP PAYROLL', '6', '1', 'Salary');
    for (const [i, [name, cat, bud, amt, per]] of PAYEES.entries()) {
      if (cat === 'Subscriptions' || cat === 'Utilities') {       // these come on the same day every month
        if (day === 4 + i) {
          const price = cat === 'Utilities' ? amt * uniform(0.85, 1.15) : name === 'StreamFlix' && (TODAY - d) / DAY < 20 ? 17.99 : amt;
          addTx(d, 'withdrawal', Math.round(price * 100) / 100, name, '3', PID[name], cat, bud);
        }
        continue;
      }
      if (random() < per / 30) {
        let mult = 1.0;
        if (cat === 'Dining' && y === ty && m === tm) mult = 1.9;        // dining spike this month
        if (cat === 'Groceries' && y === ty && m === tm) mult = 0.45;    // groceries down
        const src = choice(['1', '3', '3', '4']);
        const title = name === name.toUpperCase() ? name.toLowerCase().replace(/(^|[^a-z])([a-z])/g, (_, a, b) => a + b.toUpperCase()) : name;
        addTx(d, 'withdrawal', Math.round(amt * mult * uniform(0.7, 1.3) * 100) / 100, title, src, PID[name], cat, bud);
      }
    }
    if (day === 3) addTx(d, 'transfer', 400, 'Rewards Card payment', '1', '3');
  }
  addTx(TODAY - Math.min(9, td - 1) * DAY, 'withdrawal', 312.40, 'Airline tickets', '3', PID['Online Store'], 'Travel');
  TX.sort((a, b) => (jd(b).date > jd(a).date ? 1 : jd(b).date < jd(a).date ? -1 : 0));

  function jd(g) { return g.attributes.transactions[0]; }
  const inRange = (g, q) => { const dd = jd(g).date.slice(0, 10); return (!q.start || dd >= q.start) && (!q.end || dd <= q.end); };
  const page = (items, q) => {
    const lim = +(q.limit || 50), p = +(q.page || 1), tot = items.length, pages = Math.max(1, Math.ceil(tot / lim));
    return { data: items.slice((p - 1) * lim, p * lim), meta: { pagination: { total: tot, count: Math.min(lim, tot), per_page: lim, current_page: p, total_pages: pages } } };
  };
  const expenseByCat = (q, nocat = false) => {
    const sums = new Map();
    for (const g of TX) {
      const t = jd(g);
      if (t.type !== 'withdrawal' || !inRange(g, q)) continue;
      const c = t.category_name;
      if (nocat !== (c === null)) continue;
      sums.set(c, (sums.get(c) || 0) + +t.amount);
    }
    if (nocat) return [...sums.values()].map(v => ({ difference: '-' + v.toFixed(2), difference_float: -v, currency_code: 'USD' }));
    return [...sums].map(([c, v]) => ({ id: CAT_ID[c], name: c, difference: '-' + v.toFixed(2), difference_float: -v, currency_code: 'USD' }));
  };
  const total = (q, type) => {
    const v = TX.filter(g => jd(g).type === type && inRange(g, q)).reduce((s, g) => s + +jd(g).amount, 0);
    return [{ difference: v.toFixed(2), difference_float: v, currency_code: 'USD' }];
  };

  // An account as it stood at the end of a past day: today's balance minus everything that moved it since
  const balanceOn = (a, day: string) => {
    const t = a.attributes;
    if (t.type !== 'asset' && t.type !== 'liability') return a;
    let moved = 0;
    for (const g of TX) {
      const j = jd(g);
      if (j.date.slice(0, 10) <= day) continue;
      if (j.destination_id === a.id) moved += +j.amount;
      if (j.source_id === a.id) moved -= +j.amount;
    }
    return { ...a, attributes: { ...t, current_balance: (+t.current_balance - moved).toFixed(2) } };
  };
  const PREFS = {};       // Firefly user preferences (Money keeps its synced settings in one), kept until the page reloads

  // Answers one API call (path without /api/v1). Returns the JSON body, or null for 204 No Content;
  // throws NotFound for a 404.
  return function handle(path: string, q: Record<string, string>, method = 'GET', body: any = {}) {
    let m;
    body = body || {};
    if (path === '/about') return { data: { version: '6.2.0' } };
    if (path === '/accounts') return page(q.date ? ACC.map(a => balanceOn(a, q.date)) : ACC, q);
    if ((m = path.match(/^\/preferences\/([\w.-]+)$/))) {
      if (method === 'PUT' || method === 'POST') PREFS[m[1]] = body.data;
      if (!(m[1] in PREFS)) throw new NotFound();
      return { data: { id: '1', attributes: { name: m[1], data: PREFS[m[1]] } } };
    }
    if (path === '/preferences' && method === 'POST') {
      PREFS[body.name] = body.data; return { data: { id: '1', attributes: { name: body.name, data: body.data } } };
    }
    if ((m = path.match(/^\/accounts\/(\d+)\/transactions$/))) return page(TX.filter(g => [jd(g).source_id, jd(g).destination_id].includes(m[1]) && inRange(g, q)), q);
    if ((m = path.match(/^\/accounts\/(\d+)$/))) return { data: ACC_BY[m[1]] };
    if (path === '/categories') return page(CATS.map(c => ({ id: CAT_ID[c], attributes: { name: c } })), q);
    if (path === '/budgets') {
      return page(Object.entries(BUDGETS).map(([name, bid]) => {
        const spent = q.start ? TX.filter(g => jd(g).budget_id === bid && inRange(g, q)).reduce((s, g) => s + +jd(g).amount, 0) : 0;
        return { id: bid, attributes: { name, active: true, spent: [{ sum: '-' + spent.toFixed(2), currency_code: 'USD' }] } };
      }), q);
    }
    if (path === '/budget-limits') return page([{ id: '1', attributes: { budget_id: '1', amount: '900' } }, { id: '2', attributes: { budget_id: '2', amount: '200' } }], q);
    if (path === '/piggy-banks') return page(PIGGIES, q);
    if (['/bills', '/tags', '/recurrences', '/rule-groups', '/rules', '/link-types', '/webhooks', '/available-budgets'].includes(path)) return page([], q);
    if (path === '/currencies') return page([{ id: '1', attributes: { code: 'USD', name: 'US Dollar', symbol: '$', enabled: true, primary: true } }], q);
    if (path === '/summary/basic') return { 'net-worth-in-USD': { monetary_value: '5418.00' } };
    if (path === '/insight/expense/category') return expenseByCat(q);
    if (path === '/insight/expense/no-category') return expenseByCat(q, true);
    if (path === '/insight/expense/total') return total(q, 'withdrawal');
    if (path === '/insight/income/total') return total(q, 'deposit');
    if (path === '/insight/income/revenue') {
      const v = TX.filter(g => jd(g).type === 'deposit' && inRange(g, q)).reduce((s, g) => s + +jd(g).amount, 0);
      return v ? [{ id: '6', name: 'Acme Corp', difference: v.toFixed(2), difference_float: v, currency_code: 'USD' }] : [];
    }
    if (path === '/insight/expense/expense') {
      const sums = new Map();
      for (const g of TX) { const t = jd(g); if (t.type === 'withdrawal' && inRange(g, q)) sums.set(t.destination_id, (sums.get(t.destination_id) || 0) + +t.amount); }
      return [...sums].map(([i, v]) => ({ id: i, name: ACC_BY[i].attributes.name, difference: '-' + v.toFixed(2), difference_float: -v, currency_code: 'USD' }));
    }
    if (path.startsWith('/insight/')) return [];
    if (path === '/transactions') {
      const type = q.type || 'all';
      return page(TX.filter(g => inRange(g, q) && (type === 'all' || type === 'default' || jd(g).type === type)), q);
    }
    if ((m = path.match(/^\/transactions\/(\d+)$/))) {
      if (method === 'DELETE') { TX = TX.filter(g => g.id !== m[1]); return null; }
      return { data: TX.find(g => g.id === m[1]) };
    }
    if (path === '/search/transactions') {
      const s = (q.query || '').toLowerCase();
      if (s.includes('has_no_category')) return page(TX.filter(g => jd(g).type === 'withdrawal' && !jd(g).category_name), q);
      return page(TX.filter(g => jd(g).description.toLowerCase().includes(s.split(' ')[0])), q);
    }
    if ((m = path.match(/^\/(budgets|categories)\/(\d+)\/transactions$/))) {
      const key = m[1] === 'budgets' ? 'budget_id' : 'category_id';
      return page(TX.filter(g => jd(g)[key] === m[2] && inRange(g, q)), q);
    }
    return page([], q);
  };
}
