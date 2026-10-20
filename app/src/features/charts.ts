import { Html, html, htmlList } from '../core/html';
import { getAll } from '../core/api';
import { App, absDiff, fmtDay, money, money0, pad, todayIso } from '../core/base';
import { normGroup, signed } from '../core/feed';
import { addDays } from '../core/helpers';

/* ---------- Sparklines: last 30 days of each account's balance ---------- */
async function balanceSparks(accounts) {
  const start = addDays(todayIso(), -30), end = todayIso(), out = {};
  const gs = (await getAll('/transactions', { start, end, type: 'all' })).map(normGroup);     // one request for every account
  accounts.forEach(a => {
    const byDay: any = {}; gs.forEach(g => { const v = signed(g, a.id); if (v) { const d = String(g.date).slice(0, 10); byDay[d] = (byDay[d] || 0) + v; } });
    let bal = a.balance; const vals = [];
    for (let i = 0; i <= 30; i++) { const d = addDays(end, -i); vals.push(bal); bal -= byDay[d] || 0; }
    out[a.id] = vals.reverse();
  });
  return out;
}
function sparkline(vals, owed) {
  const v = owed ? vals.map(x => Math.max(0, -x)) : vals, W = 64, H = 20;
  const lo = Math.min(...v), hi = Math.max(...v), rng = hi - lo || 1;
  const pts = v.map((y, i) => [(i / (v.length - 1)) * W, H - 2 - ((y - lo) / rng) * (H - 4)]);
  const up = v[v.length - 1] >= v[0], good = owed ? !up : up;
  const tip = (owed ? 'Owed ' : 'Balance ') + money0(v[0]) + ' → ' + money0(v[v.length - 1]) + ' over 30 days';
  return html`<svg class="spark ${hi === lo ? 'flat' : good ? 'good' : 'bad'}" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" data-tip="${tip}" aria-hidden="true"><polyline points="${pts.map(p => p[0].toFixed(1) + ',' + p[1].toFixed(1)).join(' ')}"/><circle cx="${pts[pts.length - 1][0]}" cy="${pts[pts.length - 1][1].toFixed(1)}" r="2"/></svg>`;
}

/* ---------- Daily spending heatmap ---------- */
function heatmapPanel(cur, groups) {
  const by: any = {}, cnt = {};
  groups.forEach(g => { const d = String(g.date).slice(0, 10); by[d] = (by[d] || 0) + g.total; cnt[d] = (cnt[d] || 0) + 1; });
  const dim = new Date(cur.y, cur.m + 1, 0).getDate(), lead = new Date(cur.y, cur.m, 1).getDay(), t = todayIso();
  const max = Math.max(1, ...Object.values<any>(by)), days = Object.keys(by).length;
  let cells: Html | string = '';
  for (let i = 0; i < lead; i++) cells = html`${cells}<span class="hm-cell pad"></span>`;
  for (let d = 1; d <= dim; d++) {
    const iso = cur.start.slice(0, 8) + pad(d), v = by[iso] || 0, fut = iso > t;
    const pct = v ? Math.round(18 + 82 * Math.sqrt(v / max)) : 0;
    cells = html`${cells}<button type="button" class="hm-cell${fut ? ' fut' : ''}${iso === t ? ' today' : ''}"${v ? html` style="--p:${pct}%"` : ''} data-tip="${fmtDay(iso) + (v ? ' · ' + money(v) + ' · ' + cnt[iso] + ' purchase' + (cnt[iso] === 1 ? '' : 's') : fut ? '' : ' · nothing spent')}"${v ? html` data-onclick="App.go('#/transactions?search=date_on:${iso}')"` : ' disabled'}><span>${d}</span></button>`;
  }
  const top = Object.entries<any>(by).sort((a, b) => b[1] - a[1])[0];
  const passed = cur.start.slice(0, 7) === t.slice(0, 7) ? +t.slice(8, 10) : dim, free = Math.max(0, passed - days);
  return html`<section class="panel"><h2>Daily spending</h2><p class="lead">Darker days cost more · tap one to see it</p><div class="hm"><div class="hm-dow">${htmlList(['S', 'M', 'T', 'W', 'T', 'F', 'S'].map(x => html`<span>${x}</span>`))}</div><div class="hm-grid">${cells}</div></div><div class="hm-foot"><span>${top ? html`Biggest day: <strong class="num">${money0(top[1])}</strong> on ${fmtDay(top[0])}` : 'No spending yet'}</span><span>${free} no-spend day${free === 1 ? '' : 's'}</span></div></section>`;
}

/* ---------- Money flow (income → spending categories + kept) ---------- */
// The chart is laid out at the width it is shown at (one SVG unit = one pixel), so the labels keep their real
// font size and spacing instead of being scaled up on a wide screen or down on a phone.
function sankeyPanel(sources, income, cats, cur) {
  let left = sources.map(x => ({ name: x.name, v: absDiff(x) })).filter(x => x.v > 0).sort((a, b) => b.v - a.v);
  if (!left.length && income > 0) left = [{ name: 'Income', v: income }];
  if (left.length > 4) { const rest = left.slice(3); left = left.slice(0, 3); left.push({ name: rest.length + ' other sources', v: rest.reduce((s, x) => s + x.v, 0) }); }
  let right = cats.map(c => ({ name: c.name, v: c.amt, id: c.id })).sort((a, b) => b.v - a.v);
  if (right.length > 7) { const rest = right.slice(6); right = right.slice(0, 6); right.push({ name: rest.length + ' other categories', v: rest.reduce((s, x) => s + x.v, 0) }); }
  const inc = left.reduce((s, x) => s + x.v, 0), spend = right.reduce((s, x) => s + x.v, 0);
  if (!inc && !spend) return '';
  left.forEach(x => { x.kind = 'in'; });
  right.forEach(x => { x.kind = 'out'; });
  if (spend > inc) left.push({ name: 'From savings', v: spend - inc, kind: 'save' });
  if (inc > spend) right.push({ name: 'Kept', v: inc - spend, kind: 'kept' });
  const d = { left, right, inc, spend };
  return html`<section class="panel chart sankey" data-sk="${JSON.stringify(d)}"><h2>Money flow</h2><p class="lead">Where ${cur.all ? 'all your' : cur.label + '’s'} income went · hover a band for details</p>${sankeySvg(d, innerWidth < 900 ? innerWidth - 72 : 900)}</section>`;
}
// Shorten a label with … until it fits in px at the chart's label font
let skCtx = null;
function fitText(t, px) {
  if (!skCtx) { skCtx = document.createElement('canvas').getContext('2d'); skCtx.font = '500 12.5px ' + getComputedStyle(document.body).fontFamily; }
  if (skCtx.measureText(t).width <= px) return t;
  let n = t.length;
  while (n > 1 && skCtx.measureText(t.slice(0, n).trimEnd() + '…').width > px) n--;
  return t.slice(0, n).trimEnd() + '…';
}
function sankeySvg({ left, right, inc, spend }, W) {
  left = left.map(n => ({ ...n })); right = right.map(n => ({ ...n }));
  W = Math.max(280, Math.round(W));
  // On a very wide card the bands would stretch thin, so the chart keeps to 1100px in the middle of it
  const CW = Math.min(W, 1100), ox = (W - CW) / 2;
  const total = Math.max(inc, spend), narrow = CW < 560, rows = Math.max(left.length, right.length);
  const LW = narrow ? Math.round(CW * .35) : Math.min(230, Math.max(160, Math.round(CW * .2))), NW = 12, GAP = 10, LINE = 34;
  const H0 = Math.max(220, (LINE + 8) * rows + 24);
  const k = (H0 - 20 - GAP * (rows - 1)) / total;
  // Each side node gets at least a label's height of room, so its label can sit right beside it
  left.concat(right).forEach(n => { n.h = Math.max(2, n.v * k); n.slot = Math.max(n.h + GAP, LINE); });
  const tall = nodes => nodes.reduce((s, n) => s + n.slot, 0) - GAP;
  const H = Math.max(H0, Math.ceil(Math.max(tall(left), tall(right))) + 20);
  const stack = (nodes, x) => { let y = (H - tall(nodes)) / 2; nodes.forEach(n => { n.x = x; n.y = y + (n.slot - GAP - n.h) / 2; y += n.slot; }); };
  const xl = ox + LW, xm = W / 2 - NW / 2, xr = ox + CW - LW - NW;
  stack(left, xl); stack(right, xr);
  const mh = total * k, my = (H - mh) / 2;
  const col = n => ({ in: 'var(--income)', save: 'var(--warn)', out: 'var(--spend)', kept: 'var(--good)' })[n.kind];
  const band = (x0, y0, x1, y1, h) => { const c = (x0 + x1) / 2; return 'M' + x0 + ',' + y0 + 'C' + c + ',' + y0 + ' ' + c + ',' + y1 + ' ' + x1 + ',' + y1 + 'L' + x1 + ',' + (y1 + h) + 'C' + c + ',' + (y1 + h) + ' ' + c + ',' + (y0 + h) + ' ' + x0 + ',' + (y0 + h) + 'Z'; };
  let links: Html | string = '', nodes: Html | string = '', my1 = my, my2 = my;
  const share = (n, of) => of ? ' (' + Math.round(n.v / of * 100) + '%)' : '';
  left.forEach(n => { links = html`${links}<path class="lk" d="${band(xl + NW, n.y, xm, my1, n.h)}" fill="${col(n)}" data-tip="${n.name + ' → ' + money0(n.v) + share(n, total)}"/>`; my1 += n.h; });
  right.forEach(n => { links = html`${links}<path class="lk" d="${band(xm + NW, my2, xr, n.y, n.h)}" fill="${col(n)}" data-tip="${n.name + ' · ' + money0(n.v) + share(n, n.kind === 'kept' ? inc : spend) + (n.kind === 'kept' ? ' of income' : n.kind === 'out' ? ' of spending' : '')}"${n.id ? html` style="cursor:pointer" data-onclick="App.go('#/transactions?category=${n.id}')"` : ''}/>`; my2 += n.h; });
  const label = (n, anchor, x, nm = fitText(n.name, LW - 14)) => html`<text x="${x}" y="${n.ly - 2}" text-anchor="${anchor}" class="sk-name">${nm !== n.name ? html`<title>${n.name}</title>` : ''}${nm}</text><text x="${x}" y="${n.ly + 12}" text-anchor="${anchor}" class="sk-amt amtx">${money0(n.v)}</text>`;
  // Keep two-line labels apart and inside the chart: centre each on its node, push it below the one above,
  // pull any that run off the bottom back up, then make sure the first one still clears the top edge
  const TOP = 14, BOT = H - 18;
  const spread = col2 => {
    let prev = -Infinity; col2.forEach(n => { n.ly = Math.max(n.y + n.h / 2, prev + LINE, TOP); prev = n.ly; });
    let next = Infinity; [...col2].reverse().forEach(n => { n.ly = Math.min(n.ly, next - LINE, BOT); next = n.ly; });
    prev = -Infinity; col2.forEach(n => { n.ly = Math.max(n.ly, prev + LINE, TOP); prev = n.ly; });
  };
  spread(left); spread(right);
  left.forEach(n => { nodes = html`${nodes}<rect x="${n.x}" y="${n.y}" width="${NW}" height="${n.h}" rx="3" fill="${col(n)}"/>${label(n, 'end', xl - 8)}`; });
  right.forEach(n => { nodes = html`${nodes}<rect x="${n.x}" y="${n.y}" width="${NW}" height="${n.h}" rx="3" fill="${col(n)}"/>${label(n, 'start', xr + NW + 8)}`; });
  nodes = html`${nodes}<rect x="${xm}" y="${my}" width="${NW}" height="${mh}" rx="3" fill="var(--text)" opacity=".75"/>`;
  return html`<svg viewBox="0 0 ${W} ${H}" data-w="${W}" role="img" aria-label="Income flowing into spending categories">${links}${nodes}</svg>`;
}
// Redraw each money-flow chart at the width its card actually has, now and whenever the card changes size
const skSeen = new WeakSet();
const skObs = 'ResizeObserver' in window ? new ResizeObserver(es => es.forEach(e => fitSankey1(e.target))) : null;
function fitSankey1(sec) {
  const svg = sec.querySelector('svg'), w = Math.round(sec.clientWidth - parseFloat(getComputedStyle(sec).paddingLeft) - parseFloat(getComputedStyle(sec).paddingRight));
  if (!svg || !sec.isConnected || w <= 0 || Math.abs(w - +svg.dataset.w) < 2) return;
  try { svg.outerHTML = sankeySvg(JSON.parse(sec.dataset.sk), w); } catch (e) { /* keep the chart as drawn */ }
}
export function fitSankey() {
  document.querySelectorAll<HTMLElement>('#view .sankey[data-sk]').forEach(sec => {
    fitSankey1(sec);
    if (skObs && !skSeen.has(sec)) { skSeen.add(sec); skObs.observe(sec); }
  });
}

Object.assign(App, {
  balanceSparks,
  sparkline,
  heatmapPanel,
  sankeyPanel,
  fitSankey,
});
