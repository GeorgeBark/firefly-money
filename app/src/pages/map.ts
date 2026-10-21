import { html, htmlList } from '../core/html';
import { getAll } from '../core/api';
import { App, el, fmtDay, money, money0, period } from '../core/base';
import { head, monthNav } from '../core/dom';
import { type Group, avatarHtml, normGroup, payeeOf } from '../core/feed';
import { lists } from '../core/lists';
import { VIEWS } from '../core/router';

/* ================= Map: where the money went =================
   Purchases that have a location (the Apple Pay shortcut sends one, see docs/apple-pay.md) as pins, one per payee
   and place, sized by what was spent there. The map pictures are OpenStreetMap's, fetched and kept by this Money
   server (/tile/ in default.conf.template), so the browser only talks to Money. A small map of our own instead of
   a library: it only needs to show pins, pan and zoom. */
const TILE = 256, MAX_Z = 18;
export type Spot = { key: string, name: string, lat: number, lng: number, total: number, groups: Group[] };

// Web Mercator: a point's position in pixels on the whole world map at zoom z
export const toPx = (lat: number, lng: number, z: number) => {
  const s = TILE * 2 ** z, r = Math.max(-85.05, Math.min(85.05, lat)) * Math.PI / 180;
  return { x: (lng + 180) / 360 * s, y: (1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2 * s };
};
// One pin per payee and place (about 100 m apart counts as a different place: two branches of a chain)
export function spotsOf(groups: Group[]): Spot[] {
  const by = new Map<string, Spot>();
  for (const g of groups) {
    const s = g.splits.find(x => x.lat != null && x.lng != null);
    if (!s || g.type !== 'withdrawal') continue;
    const name = payeeOf(g).name, key = name + '@' + s.lat!.toFixed(3) + ',' + s.lng!.toFixed(3);
    const p: Spot = by.get(key) || { key, name: name || '', lat: s.lat!, lng: s.lng!, total: 0, groups: [] };
    p.total += g.total; p.groups.push(g); by.set(key, p);
  }
  return [...by.values()].sort((a, b) => b.total - a.total);
}
// The zoom and centre that show every spot, with some room around them
export function fit(spots: { lat: number, lng: number }[], w: number, h: number) {
  if (!spots.length) return { z: 3, lat: 39.8, lng: -98.6 };
  let z = MAX_Z - 2;
  for (; z > 1; z--) {
    const ps = spots.map(s => toPx(s.lat, s.lng, z)), xs = ps.map(p => p.x), ys = ps.map(p => p.y);
    if (Math.max(...xs) - Math.min(...xs) <= w - 80 && Math.max(...ys) - Math.min(...ys) <= h - 80) break;
  }
  const lats = spots.map(s => s.lat), lngs = spots.map(s => s.lng);
  return { z, lat: (Math.min(...lats) + Math.max(...lats)) / 2, lng: (Math.min(...lngs) + Math.max(...lngs)) / 2 };
}

let view = { z: 3, x: 0, y: 0 }, spots: Spot[] = [];   // x, y: the map's centre in pixels at zoom z
function draw() {
  const box = document.getElementById('map'); if (!box) return;
  const w = box.clientWidth, h = box.clientHeight, n = 2 ** view.z, left = view.x - w / 2, top = view.y - h / 2;
  const tiles: string[] = [];
  for (let tx = Math.floor(left / TILE); tx * TILE < left + w; tx++) {
    for (let ty = Math.max(0, Math.floor(top / TILE)); ty * TILE < top + h && ty < n; ty++) {
      const wx = ((tx % n) + n) % n;
      tiles.push(`<img class="map-tile" alt="" draggable="false" src="/tile/${view.z}/${wx}/${ty}.png" style="left:${Math.round(tx * TILE - left)}px;top:${Math.round(ty * TILE - top)}px">`);
    }
  }
  el('mapTiles').innerHTML = tiles.join('');
  el('mapTiles').querySelectorAll('img').forEach(i => i.addEventListener('error', () => { i.style.visibility = 'hidden'; }, { once: true }));
  const most = Math.max(1, ...spots.map(s => s.total));
  el('mapPins').innerHTML = String(htmlList(spots.map((s, i) => {
    const p = toPx(s.lat, s.lng, view.z), size = Math.round(26 + 18 * Math.sqrt(s.total / most));
    return html`<button type="button" class="map-pin" style="left:${Math.round(p.x - left)}px;top:${Math.round(p.y - top)}px;width:${size}px;height:${size}px" title="${s.name}: ${money(s.total)}" aria-label="${s.name}, ${money(s.total)}" data-onclick="App.mapSpot(${i})">${s.groups.length}</button>`;
  })));
}
function zoom(d: number, cx?: number, cy?: number) {
  const box = document.getElementById('map'); if (!box) return;
  const z = Math.max(2, Math.min(MAX_Z, view.z + d)); if (z === view.z) return;
  // keep the point under the cursor (or the centre) where it is
  const ox = cx === undefined ? 0 : cx - box.clientWidth / 2, oy = cy === undefined ? 0 : cy - box.clientHeight / 2, k = 2 ** (z - view.z);
  view = { z, x: (view.x + ox) * k - ox, y: (view.y + oy) * k - oy };
  draw();
}
function mapZoom(d: number) { zoom(d); }
function mapSpot(i: number) {
  const s = spots[i]; if (!s) return;
  document.querySelectorAll('.map-pin.on').forEach(b => b.classList.remove('on'));
  const pin = document.querySelectorAll('.map-pin')[i]; if (pin) pin.classList.add('on');
  el('mapList').innerHTML = String(spotList(s));
}
const spotList = (s: Spot) => html`<h2 style="margin:0 0 2px">${s.name}</h2><p class="sub-s" style="margin:0 0 10px">${money(s.total)} in ${s.groups.length} purchase${s.groups.length === 1 ? '' : 's'} · <a class="link" href="https://maps.apple.com/?ll=${s.lat},${s.lng}&amp;q=${encodeURIComponent(s.name)}" target="_blank" rel="noopener">Open in Maps ↗</a></p><div class="list">${htmlList(s.groups.map(g => html`<button type="button" class="row" style="width:100%;text-align:left" data-onclick="App.editTx('${g.id}')"><span class="name" style="display:flex;gap:10px;align-items:center">${avatarHtml(g)}<span>${g.splits[0].description}<br><span class="sub-s">${fmtDay(g.date)}</span></span></span><span class="num neg">${money(-g.total)}</span></button>`))}</div>`;

// Drag to pan, wheel or double-click to zoom
function wire() {
  const box = document.getElementById('map'); if (!box || box.dataset.wired) return;
  box.dataset.wired = '1';
  let drag: { x: number, y: number, vx: number, vy: number, moved: boolean } | null = null;
  box.addEventListener('pointerdown', e => {
    if ((e.target as HTMLElement).closest('button')) return;
    drag = { x: e.clientX, y: e.clientY, vx: view.x, vy: view.y, moved: false }; box.setPointerCapture(e.pointerId); box.classList.add('dragging');
  });
  box.addEventListener('pointermove', e => {
    if (!drag) return;
    const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
    if (Math.abs(dx) + Math.abs(dy) > 3) drag.moved = true;
    view = { ...view, x: drag.vx - dx, y: drag.vy - dy }; draw();
  });
  const end = () => { drag = null; box.classList.remove('dragging'); };
  box.addEventListener('pointerup', end); box.addEventListener('pointercancel', end);
  box.addEventListener('wheel', e => { e.preventDefault(); const r = box.getBoundingClientRect(); zoom(e.deltaY < 0 ? 1 : -1, e.clientX - r.left, e.clientY - r.top); }, { passive: false });
  window.addEventListener('resize', draw);
  box.addEventListener('dblclick', e => { const r = box.getBoundingClientRect(); zoom(1, e.clientX - r.left, e.clientY - r.top); });
}

VIEWS.map = async (r, paint) => {
  await lists();
  const p = period();
  const groups = (await getAll('/transactions', { start: p.start, end: p.end, type: 'withdrawal' })).map(normGroup);
  spots = spotsOf(groups);
  const placed = spots.reduce((n, s) => n + s.groups.length, 0), spent = spots.reduce((n, s) => n + s.total, 0);
  const sub = placed ? placed + ' of ' + groups.length + ' purchases have a place · ' + money0(spent) : 'No purchases with a place in ' + p.label;
  paint(html`${head('Map', sub, monthNav())}<section class="panel" style="padding:0;overflow:hidden"><div id="map" class="map"><div id="mapTiles"></div><div id="mapPins"></div><div class="map-zoom"><button type="button" class="round" aria-label="Zoom in" data-onclick="App.mapZoom(1)">+</button><button type="button" class="round" aria-label="Zoom out" data-onclick="App.mapZoom(-1)">−</button></div><div class="map-credit">© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> contributors</div></div></section><section class="panel" id="mapList">${spots.length ? html`<p class="sub-s" style="margin:0">Tap a pin to see what you bought there. Bigger pins are where you spent more.</p>` : html`<div class="center-empty">Purchases get a place when the Apple Pay shortcut sends your location. See <a class="link" href="https://github.com/Muffy0906/firefly-money/blob/main/docs/apple-pay.md" target="_blank" rel="noopener">Optional extras</a>.</div>`}</section>`);
  const box = document.getElementById('map'); if (!box) return;
  const f = fit(spots, box.clientWidth, box.clientHeight), c = toPx(f.lat, f.lng, f.z);
  view = { z: f.z, x: c.x, y: c.y };
  wire(); draw();
};

// The methods markup handlers call (see events.ts), added to App and to its type
const methods = { mapZoom, mapSpot };
Object.assign(App, methods);
type Methods = typeof methods;
declare module '../core/base' { interface AppApi extends Methods {} }
