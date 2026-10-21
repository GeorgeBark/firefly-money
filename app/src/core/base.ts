/* ================= Settings ================= */
export const PAGE_SIZE = 50;

/* ================= State & helpers ================= */
// The methods that markup handlers (data-onclick and friends, see events.ts) call; each module adds its own.
export const App: any = (window as any).App = {};
export let today = new Date();
export const setToday = (d: Date) => { today = d; };
export const S: any = { y: today.getFullYear(), m: today.getMonth(), signedIn: false, lists: null, tok: 0, form: null, currency: 'USD' };
export const el = (id: string): any => document.getElementById(id);
export const pad = n => String(n).padStart(2, '0');
export const isoDate = d => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
export const todayIso = () => isoDate(new Date());
export function monthRange(y, m) {
  const d = new Date(y, m, 1), yy = d.getFullYear(), mm = d.getMonth();
  return {
    start: yy + '-' + pad(mm + 1) + '-01',
    end: yy + '-' + pad(mm + 1) + '-' + pad(new Date(yy, mm + 1, 0).getDate()),
    label: d.toLocaleString('en-US', { month: 'long', year: 'numeric' }),
    short: d.toLocaleString('en-US', { month: 'short' }), y: yy, m: mm,
  };
}
// The period the month selector shows: one month, or everything up to today when "All time" is picked.
const ALL_START = '1970-01-01';
export const period = (): any => S.all ? { start: ALL_START, end: todayIso(), label: 'all time', short: 'all time', all: true } : monthRange(S.y, S.m);
export const num = v => { const n = parseFloat(v); return isNaN(n) ? 0 : n; };
export const arr = r => Array.isArray(r) ? r : (r && Array.isArray(r.data)) ? r.data : [];
export const absDiff = x => Math.abs(num(x.difference_float ?? x.difference));
export const sumDiff = r => arr(r).reduce((s, x) => s + absDiff(x), 0);
const FMT = new Map();
function fmtFor(key, make) { let f = FMT.get(key); if (!f) { f = make(); FMT.set(key, f); } return f; }
export const money = (n, dec = 2) => fmtFor(S.currency + dec, () => new Intl.NumberFormat('en-US', { style: 'currency', currency: S.currency, minimumFractionDigits: dec, maximumFractionDigits: dec })).format(n || 0);
export const money0 = n => money(n, 0);
const DAY_FMT = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }), DATE_FMT = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
export const fmtDay = s => s ? DAY_FMT.format(new Date(String(s).slice(0, 10) + 'T12:00:00')) : '';
export const fmtDate = s => s ? DATE_FMT.format(new Date(String(s).slice(0, 10) + 'T12:00:00')) : '';
export const sameName = (a, b) => String(a || '').trim().toLowerCase() === String(b || '').trim().toLowerCase();
