// Leaflet, the map library the Map page uses, built as its own file (assets/js/leaflet.js and leaflet.css) and
// loaded only when the Map page opens, so app.js stays small. See loadLeaflet in pages/map.ts.
import * as L from 'leaflet';
import 'leaflet/dist/leaflet.css';

(window as unknown as { L: typeof L }).L = L;
