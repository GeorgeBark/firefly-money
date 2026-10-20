import { html, htmlList } from '../core/html';
import { getAll } from '../core/api';
import { App, S, fmtDate, fmtDay, isoDate, money, money0, num, sameName, todayIso } from '../core/base';
import { head, opt } from '../core/dom';
import { normGroup } from '../core/feed';
import { LS, addDays, bizDay, daysBetween, monthsFrom } from '../core/helpers';
import { isAsset, isCard, isLiab, lists } from '../core/lists';
import { VIEWS, hashWith, route } from '../core/router';
import { billAmount } from './bills';
import { loanHistory } from './loans';

/* ================= Safe-to-spend forecast ================= */
function detectIncome(groups, accIds) {
  const by: any = {};
  groups.forEach(g => g.splits.forEach(s => {
    if (s.type !== 'deposit' || !accIds.includes(s.destination_id)) return;
    const src = S.lists.byId[s.source_id]; if (src && isLiab(src)) return;          // loan money isn't income
    (by[s.source_id] = by[s.source_id] || { name: s.source_name, list: [] }).list.push({ d: String(s.date).slice(0, 10), a: s.amount, cat: s.category });
  }));
  const out = [];
  Object.values<any>(by).forEach(({ name, list }) => {
    if (list.length < 3) return;
    list.sort((a, b) => a.d.localeCompare(b.d));
    const recent = list.slice(-6), lastAmt = recent[recent.length - 1].a;
    if (recent.filter(x => Math.abs(x.a - lastAmt) / lastAmt < .2).length < 3) return;   // needs a steady amount
    const gaps = recent.slice(1).map((x, i) => daysBetween(recent[i].d, x.d)).sort((a, b) => a - b), gap = gaps[Math.floor(gaps.length / 2)];
    const doms = recent.map(x => +x.d.slice(8, 10));
    let p;
    if (gap >= 12 && gap <= 17) {
      const late = doms.filter(d => d >= 25).length, mid = doms.filter(d => d >= 11 && d <= 18).length;
      p = late && mid && late + mid >= doms.length - 1 ? { kind: 'semimonthly' } : { kind: 'every', n: 14 };
    } else if (gap >= 26 && gap <= 35) { const s = doms.slice().sort((a, b) => a - b), med = s[Math.floor(s.length / 2)]; p = { kind: 'monthly', day: med >= 28 ? 31 : med }; }
    else if (gap >= 6 && gap <= 8) p = { kind: 'every', n: 7 };
    else return;
    const last = recent[recent.length - 1].d;
    if (daysBetween(last, todayIso()) > gap * 1.8) return;                                  // stopped arriving
    out.push({ name, amount: lastAmt, p, last, salary: recent.some(x => /salary|payroll/i.test(x.cat)) });
  });
  return out;
}
function incomeDates(inc, from, to) {
  const out = [], p = inc.p;
  if (p.kind === 'every') { for (let d = addDays(inc.last, p.n); d <= to; d = addDays(d, p.n)) if (d >= from) out.push(d); }
  else monthsFrom(from, to).forEach(([y, m]) => (p.kind === 'semimonthly' ? [15, 31] : [p.day]).forEach(day => { const d = bizDay(y, m, day); if (d > inc.last && d >= from && d <= to) out.push(d); }));
  return out.sort();
}
async function forecastModel(sel, horizon) {
  const L = await lists();
  const banks = L.own.filter(a => isAsset(a) && !isCard(a));
  const from = todayIso(), to = addDays(from, horizon);
  const [deps, recs, bills] = await Promise.all([
    getAll('/transactions', { type: 'deposit', start: addDays(from, -120), end: from }),
    getAll('/recurrences').catch(() => []),
    getAll('/bills', { start: from, end: to }).catch(() => []),
  ]);
  const depGroups = deps.map(normGroup);
  // Default account: the one your salary lands in.
  if (!sel) {
    const guess = detectIncome(depGroups, banks.map(a => a.id)).sort((a, b) => (b.salary - a.salary) || b.amount - a.amount)[0];
    const hit = guess && depGroups.flatMap(g => g.splits).find(s => s.source_name === guess.name);
    sel = hit ? hit.destination_id : (banks[0] || {}).id;
  }
  const accIds = sel === 'all' ? banks.map(a => a.id) : [sel];
  const start = accIds.reduce((s, id) => s + ((L.byId[id] || {}).balance || 0), 0);
  const ev = [];
  const add = (date, label, kind, amount, series) => { if (date >= from && date <= to && amount) ev.push({ date, label, kind, amount, key: kind + ':' + series }); };
  const incomes = detectIncome(depGroups, accIds);
  incomes.forEach(inc => incomeDates(inc, from, to).forEach(d => add(d, inc.name, inc.salary ? 'Payday' : 'Income', inc.amount, inc.name)));
  recs.forEach(r => {
    const at = r.attributes; if (at.active === false) return;
    const t = (at.transactions || [])[0] || {}, occ = (at.repetitions || []).flatMap(x => x.occurrences || []).map(d => String(d).slice(0, 10));
    const sign = accIds.includes(String(t.source_id)) ? -1 : accIds.includes(String(t.destination_id)) ? 1 : 0;
    if (sign) [...new Set(occ)].forEach(d => add(d, at.title, 'Recurring', sign * num(t.amount), 'rec' + r.id));
  });
  const loans = L.own.filter(a => isLiab(a) && a.debt > 0), hist = await loanHistory(loans);
  loans.forEach(l => {
    const h = hist[l.id], p = l.plan;
    if (p && p.amount > 0) {
      const src = p.from ? L.accounts.find(x => sameName(x.name, p.from)) : (h && h.last ? L.byId[h.last.from] : null);
      if (!src || !accIds.includes(src.id)) return;
      const day = p.day || (h && h.last ? +h.last.d.slice(8, 10) : 1);
      let left = l.debt;
      monthsFrom(addDays(from, -31), to).forEach(([y, m]) => {
        const d = isoDate(new Date(y, m, Math.min(day, new Date(y, m + 1, 0).getDate()), 12));
        if (left <= 0 || d > to) return;
        if (h && h.last && h.last.d >= addDays(d, -20)) return;           // already paid for this month
        if (d < from && daysBetween(d, from) > 10) return;                // long past: not counted
        const amt = Math.min(p.amount, left); left -= amt;
        add(d < from ? from : d, 'Payment to ' + l.name, 'Loan', -amt, 'loan' + l.id);
      });
      return;
    }
    if (!h || !h.last || daysBetween(h.last.d, from) > 75) return;
    if (!accIds.includes(h.last.from)) return;
    let left = l.debt, day = +h.last.d.slice(8, 10);
    monthsFrom(addDays(h.last.d, 20), to).forEach(([y, m]) => {
      const d = isoDate(new Date(y, m, Math.min(day, new Date(y, m + 1, 0).getDate()), 12));
      if (d <= h.last.d || left <= 0) return;
      const amt = Math.min(h.last.a, left); left -= amt;
      add(d < from ? from : d, 'Payment to ' + l.name, 'Loan', -amt, 'loan' + l.id);
    });
  });
  const firstPay = ev.filter(e => e.kind === 'Payday' || e.kind === 'Income').map(e => e.date).sort()[0];
  L.own.filter(a => isCard(a) && a.balance < 0).forEach(c => {
    let d;
    if (c.paymentDate) { const day = +String(c.paymentDate).slice(8, 10); d = monthsFrom(from, to).map(([y, m]) => isoDate(new Date(y, m, Math.min(day, new Date(y, m + 1, 0).getDate()), 12))).find(x => x >= from); }
    add(d || firstPay || addDays(from, 7), 'Pay off ' + c.name, 'Card', c.balance, 'card' + c.id);
  });
  bills.forEach(b => {
    const at = b.attributes; if (at.active === false || (at.paid_dates || []).length) return;
    (at.pay_dates || []).map(d => String(d).slice(0, 10)).forEach(d => add(d, at.name, 'Bill', -billAmount(at), 'bill' + b.id));
  });
  const excluded = new Set(LS.get('fcExclude', []));
  ev.sort((a, b) => a.date.localeCompare(b.date) || b.amount - a.amount);
  let bal = start, min = start, minDate = from;
  const byDay: any = {};
  ev.forEach(e => { e.off = excluded.has(e.key); if (!e.off) bal += e.amount; e.after = bal; byDay[e.date] = bal; if (bal < min) { min = bal; minDate = e.date; } });
  const series = []; let run = start;
  for (let d = from; d <= to; d = addDays(d, 1)) { if (byDay[d] !== undefined) run = byDay[d]; series.push({ d, v: run }); }
  const buffer = +LS.get('fcBuffer', 100);
  const nextPay = ev.find(e => !e.off && (e.kind === 'Payday' || e.kind === 'Income'));
  return { sel, accIds, name: sel === 'all' ? 'all bank accounts' : (L.byId[sel] || {}).name, banks, start, ev, series, min, minDate, buffer,
    safe: Math.max(0, Math.floor(min - buffer)), short: min < 0 ? -min : 0, nextPay, incomes, horizon };
}
function forecastChart(m) {
  const W = innerWidth < 600 ? 420 : 960, H = W < 960 ? 180 : 220, pt = 14, pb = 26, s = m.series, n = s.length;
  const lo = Math.min(0, ...s.map(x => x.v)), hi = Math.max(...s.map(x => x.v), 1), span = hi - lo || 1;
  const x = i => (W - 8) * i / Math.max(1, n - 1) + 4, y = v => pt + (H - pt - pb) * (1 - (v - lo) / span);
  let path = '';
  s.forEach((p, i) => { path += (i ? ' H' + x(i).toFixed(1) + ' V' : 'M' + x(i).toFixed(1) + ' ') + y(p.v).toFixed(1); });
  const area = path + ' V' + y(lo).toFixed(1) + ' H' + x(0).toFixed(1) + ' Z';
  const byDate: any = {};
  m.ev.filter(e => !e.off).forEach(e => { (byDate[e.date] = byDate[e.date] || []).push(e); });
  const dots = htmlList(Object.entries<any>(byDate).map(([d, list]) => {
    const i = daysBetween(s[0].d, d), last = list[list.length - 1], cx = x(i).toFixed(1), cy = y(last.after).toFixed(1);
    const tip = fmtDate(d) + '\n' + list.map(e => e.label + '  ' + (e.amount > 0 ? '+' : '') + money(e.amount)).join('\n') + '\nBalance after: ' + money(last.after);
    const net = list.reduce((t, e) => t + e.amount, 0);
    return html`<g class="pt" data-tip="${tip}"><rect x="${+cx - 10}" y="${pt}" width="20" height="${H - pt - pb}" fill="transparent"/><circle class="dot" cx="${cx}" cy="${cy}" r="${list.length > 1 ? 5 : 3.5}" fill="${net > 0 ? 'var(--good)' : 'var(--spend)'}"/></g>`;
  }));
  const every = W < 960 && n > 35 ? 14 : 7, ticks = htmlList(s.filter((p, i) => i % every === 0).map(p => { const i = daysBetween(s[0].d, p.d); return html`<text x="${x(i)}" y="${H - 6}" text-anchor="${i === 0 ? 'start' : 'middle'}">${fmtDay(p.d)}</text>`; }));
  return html`<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Projected balance"><defs><linearGradient id="fcg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="var(--good)" stop-opacity=".22"/><stop offset="1" stop-color="var(--good)" stop-opacity="0"/></linearGradient></defs>${lo < 0 ? html`<rect x="0" y="${y(0)}" width="${W}" height="${y(lo) - y(0)}" fill="var(--spend)" opacity=".08"/>` : ''}<line x1="0" x2="${W}" y1="${y(0)}" y2="${y(0)}" stroke="var(--line)" stroke-dasharray="4 4"/><path d="${area}" fill="url(#fcg)"/><path d="${path}" fill="none" stroke="var(--good)" stroke-width="2.2"/>${dots}${ticks}</svg>`;
}
VIEWS.forecast = async (r, paint) => {
  const sel = r.q.account || LS.get('fcAccount', ''), horizon = +(r.q.days || LS.get('fcDays', 60));
  const m = await forecastModel(sel, horizon);
  const kinds = { Payday: 'good', Income: 'good', Recurring: '', Loan: 'warn', Card: 'warn', Bill: 'bad' };
  const rows = htmlList(m.ev.map(e => html`<tr${e.off ? html` style="opacity:.45"` : ''}><td class="sel"><input type="checkbox"${e.off ? '' : ' checked'} title="Include in the forecast" data-onchange="App.fcToggle('${e.key}', this.checked)"></td><td class="date hide-s">${fmtDay(e.date)}</td><td><div class="desc">${e.label}</div><span class="chip ${kinds[e.kind] || ''}">${e.kind}</span><span class="sub-s show-s">${fmtDay(e.date)}</span></td><td class="amt ${e.amount > 0 ? 'pos' : 'neg'}">${e.amount > 0 ? '+' : ''}${money(e.amount)}</td><td class="amt ${e.after < 0 ? 'neg' : ''}">${e.off ? '—' : money(e.after)}</td></tr>`));
  const headline = m.short
    ? html`<div class="eyebrow">Heads up</div><div class="big num negative" data-count="${-m.short}">${money0(-m.short)}</div><div class="sub-s" style="margin-top:6px">Your balance is projected to go <strong>${money(m.short)} below zero</strong> on ${fmtDate(m.minDate)}. Move money in or delay a payment before then.</div>`
    : html`<div class="eyebrow">Safe to spend</div><div class="big num" data-count="${m.safe}">${money0(m.safe)}</div><div class="sub-s" style="margin-top:6px">${m.nextPay ? 'Until your next ' + (m.nextPay.kind === 'Payday' ? 'payday' : 'deposit') + ' on ' + fmtDate(m.nextPay.date) + ', while still covering everything below' : 'While still covering everything below'} and keeping a ${money0(m.buffer)} cushion.</div>`;
  paint(html`${head('Forecast', 'Where ' + m.name + ' is heading over the next ' + m.horizon + ' days',
      html`<select data-onchange="App.fcSet('account', this.value)" style="width:auto">${htmlList(m.banks.map(a => opt(a.id, a.name, m.sel)))}${opt('all', 'All bank accounts', m.sel)}</select><select data-onchange="App.fcSet('days', this.value)" style="width:auto">${htmlList([30, 60, 90].map(d => opt(d, d + ' days', m.horizon)))}</select>`)}<section class="hero" style="margin-bottom:28px"><div>${headline}</div><div class="stats"><div class="stat"><div class="eyebrow">Balance now</div><div class="val num">${money0(m.start)}</div></div><div class="stat"><div class="eyebrow">Lowest point</div><div class="val num ${m.min < 0 ? 'neg' : ''}">${money0(m.min)}</div><div class="sub">${fmtDay(m.minDate)}</div></div><div class="stat"><div class="eyebrow">Cushion</div><div class="val num"><input type="number" min="0" step="10" value="${m.buffer}" data-onchange="App.fcBuffer(this.value)" style="width:110px;font-size:20px;padding:4px 10px"></div><div class="sub">kept aside, never counted as spendable</div></div></div></section><section class="panel chart" style="margin-bottom:20px"><h2>Projected balance</h2><p class="lead">Each dot is a scheduled payment or deposit · the shaded area is below zero</p>${forecastChart(m)}</section><section class="panel flush"><div style="padding:22px 26px 6px"><h2 style="font-size:15px;margin:0 0 3px">What’s coming</h2><p class="lead" style="margin-bottom:8px">Untick anything that won’t happen — the forecast remembers.</p></div>${rows ? html`<table class="tbl"><thead><tr><th class="sel"></th><th class="hide-s">Date</th><th>What</th><th class="r">Amount</th><th class="r">Balance after</th></tr></thead><tbody>${rows}</tbody></table>` : html`<div class="center-empty">Nothing scheduled in this period.</div>`}</section><p class="sub-s" style="margin-top:14px">How this works: paydays are spotted from deposits that repeat on a schedule${m.incomes.length ? ' (' + m.incomes.map(i => i.name + ' ' + money0(i.amount) + ' ' + ({ semimonthly: 'twice a month', monthly: 'monthly', every: 'every ' + i.p.n + ' days' }[i.p.kind])).join(', ') + ')' : ''}. It adds your recurring transactions, bills, loan payments that repeat monthly, and assumes each credit card balance is paid in full on its due date — or on your next payday if the card has no due date in Firefly. Day-to-day card spending isn’t predicted: whatever you put on a card also has to come out of this “safe to spend”.</p>`);
};
function fcToggle(key, on) {
  const s = new Set(LS.get('fcExclude', [])); on ? s.delete(key) : s.add(key); LS.set('fcExclude', [...s]); route();
}
function fcSet(k, v) { LS.set(k === 'account' ? 'fcAccount' : 'fcDays', v); location.hash = hashWith({ [k]: v }); }
function fcBuffer(v) { LS.set('fcBuffer', Math.max(0, num(v))); route(); }
async function safeCard() {
  try {
    const m = await forecastModel(LS.get('fcAccount', ''), 45);
    return html`<section class="panel"><div class="panel-head"><h2>${m.short ? 'Heads up' : 'Safe to spend'}</h2><a class="link" href="#/forecast">Forecast</a></div>${m.short ? html`<div class="total num neg">${money0(-m.short)}</div><p class="sub-s" style="margin:0">${m.name} is projected to dip below zero on ${fmtDate(m.minDate)}.</p>`
        : html`<div class="total num pos">${money0(m.safe)}</div><p class="sub-s" style="margin:0">${m.nextPay ? 'Until ' + fmtDay(m.nextPay.date) + ' · ' : ''}after upcoming bills, rent, card payoffs and loan payments</p>`}</section>`;
  } catch (e) { return ''; }
}

Object.assign(App, {
  fcToggle,
  fcSet,
  fcBuffer,
  safeCard,
});
