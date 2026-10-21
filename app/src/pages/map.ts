import { html, htmlList } from '../core/html';
import { getAll } from '../core/api';
import { el, fmtDay, money, money0, period } from '../core/base';
import { head, monthNav } from '../core/dom';
import { type Group, avatarHtml, normGroup, payeeOf } from '../core/feed';
import { lists } from '../core/lists';
import { VIEWS } from '../core/router';
import type * as Leaflet from 'leaflet';

/* ================= Map: where the money went =================
   Purchases that have a location (the Apple Pay shortcut sends one, see docs/apple-pay.md) as pins, one per payee
   and place, sized by what was spent there. The map is Leaflet, loaded only when this page opens (vendor/leaflet.ts).
   Its pictures are OpenStreetMap's, fetched and kept by this Money server (/tile/ in default.conf.template), so the
   browser only talks to Money. */
export type Spot = { key: string, name: string, lat: number, lng: number, total: number, groups: Group[] };

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

// Adds leaflet.js and leaflet.css (built next to app.js, with the same ?v= so a new version isn't cached) once
let leaflet: Promise<typeof Leaflet> | null = null;
function loadLeaflet() {
  return leaflet ||= new Promise((resolve, reject) => {
    const app = document.querySelector<HTMLScriptElement>('script[src*="/app.js"]')?.src || '/assets/js/app.js';
    const css = document.createElement('link');
    css.rel = 'stylesheet'; css.href = app.replace('/app.js', '/leaflet.css');
    const js = document.createElement('script');
    js.src = app.replace('/app.js', '/leaflet.js');
    js.onload = () => resolve((window as unknown as { L: typeof Leaflet }).L);
    js.onerror = () => { leaflet = null; reject(new Error('Couldn’t load the map')); };
    document.head.append(css, js);
  });
}

let map: Leaflet.Map | null = null, pins: Leaflet.Marker[] = [], spots: Spot[] = [];
function showSpot(i: number) {
  const s = spots[i]; if (!s) return;
  pins.forEach((m, j) => { m.getElement()?.classList.toggle('on', i === j); m.setZIndexOffset(i === j ? 1000 : 0); });
  el('mapList').innerHTML = String(spotList(s));
}
const spotList = (s: Spot) => html`<h2 style="margin:0 0 2px">${s.name}</h2><p class="sub-s" style="margin:0 0 10px">${money(s.total)} in ${s.groups.length} purchase${s.groups.length === 1 ? '' : 's'} · <a class="link" href="https://maps.apple.com/?ll=${s.lat},${s.lng}&amp;q=${encodeURIComponent(s.name)}" target="_blank" rel="noopener">Open in Maps ↗</a></p><div class="list">${htmlList(s.groups.map(g => html`<button type="button" class="row" style="width:100%;text-align:left" data-onclick="App.editTx('${g.id}')"><span class="name" style="display:flex;gap:10px;align-items:center">${avatarHtml(g)}<span>${g.splits[0].description}<br><span class="sub-s">${fmtDay(g.date)}</span></span></span><span class="num neg">${money(-g.total)}</span></button>`))}</div>`;

VIEWS.map = async (r, paint) => {
  await lists();
  const p = period();
  const groups = (await getAll('/transactions', { start: p.start, end: p.end, type: 'withdrawal' })).map(normGroup);
  spots = spotsOf(groups);
  const placed = spots.reduce((n, s) => n + s.groups.length, 0), spent = spots.reduce((n, s) => n + s.total, 0);
  const sub = placed ? placed + ' of ' + groups.length + ' purchases have a place · ' + money0(spent) : 'No purchases with a place in ' + p.label;
  paint(html`${head('Map', sub, monthNav())}<section class="panel" style="padding:0;overflow:hidden"><div id="map" class="map"></div></section><section class="panel" id="mapList">${spots.length ? html`<p class="sub-s" style="margin:0">Tap a pin to see what you bought there. Bigger pins are where you spent more.</p>` : html`<div class="center-empty">Purchases get a place when the Apple Pay shortcut sends your location. See <a class="link" href="https://github.com/Muffy0906/firefly-money/blob/main/docs/apple-pay.md" target="_blank" rel="noopener">Optional extras</a>.</div>`}</section>`);
  const L = await loadLeaflet().catch(() => null), box = document.getElementById('map');
  if (map) { map.remove(); map = null; }
  if (!box) return;
  if (!L) { box.innerHTML = String(html`<div class="center-empty">Couldn’t load the map. Check the connection and open the page again.</div>`); return; }
  map = L.map(box, { maxZoom: 19 });
  L.tileLayer('/tile/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> contributors' }).addTo(map);
  const most = Math.max(1, ...spots.map(s => s.total));
  pins = spots.map((s, i) => {
    const size = Math.round(26 + 18 * Math.sqrt(s.total / most));
    return L.marker([s.lat, s.lng], { title: s.name + ': ' + money(s.total), alt: s.name, icon: L.divIcon({ className: 'map-pin', html: String(s.groups.length), iconSize: [size, size] }) })
      .on('click', () => showSpot(i)).addTo(map!);
  });
  if (spots.length) map.fitBounds(L.latLngBounds(spots.map(s => [s.lat, s.lng] as [number, number])), { padding: [40, 40], maxZoom: 16 });
  else map.setView([39.8, -98.6], 3);
};
