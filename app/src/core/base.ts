import type { Html } from './html';
import type { Group, TxMeta } from './feed';
import type { Lists } from './lists';

/* ================= Settings ================= */
export const PAGE_SIZE = 50;

/* ================= State & helpers ================= */
// The methods that markup handlers (data-onclick and friends, see events.ts) call; each module adds its own.
// Each module adds its methods to the AppApi type next to where it adds them to App.
export interface AppApi {}
export const App = window.App = {} as AppApi;
export let today = new Date();
export const setToday = (d: Date) => { today = d; };
// Firefly's JSON as the API returns it. Not typed yet: each use reads the fields it needs.
export type ApiData = any;
// The open form in the drawer. Each form keeps its own fields here (txform.ts has the biggest).
export type FormState = ApiData;
export type Feed = { next: number, pages: number, opts: { accountId?: string, select?: boolean }, more: (n: number) => Promise<Group[]>, busy?: boolean };
// The app's state: what's on screen, what's open, and data kept between pages
export interface State {
  y: number, m: number, all?: boolean,                 // the month in view, or all time
  key: string, remember?: boolean,                       // the dashboard password and whether it's kept on this device
  currency: string,
  lists: Lists | null, listsAt?: number,
  freshAfter: number, dirtyAt: number,                   // cached responses older than freshAfter are fetched again; older than dirtyAt are out of date (api.ts)
  tok: number, staleTok?: number,                        // bumped on every navigation, so late responses for an old page are dropped
  form: FormState | null,
  // Pages and navigation
  pageKey?: string, pageHtml?: string | Html, pageLive?: boolean, pageCacheable?: boolean, pageDepth?: number, painted?: boolean, bootStale?: boolean,
  navN?: number, curNav?: number, tabNav?: boolean, kIdx?: number, skelT?: ReturnType<typeof setTimeout>,
  vtDir?: string, vtRun?: (ViewTransition & { kind?: string }) | null, vtFrom?: { node: Element, t: number } | null, lastPtr?: { x: number, y: number },
  // Cache freshness (api.ts)
  swr?: boolean, swrOff?: number, lastRefresh?: number, refreshing?: Promise<void> | null, recalcing?: boolean,
  // Transaction lists
  feed?: Feed | null, txMeta: Record<string, TxMeta>, txPage?: Group[], sel?: Set<string>, pendingDel: Set<string>,
  undoCommit?: (() => void) | null, undoT?: ReturnType<typeof setTimeout>, chartData?: { label: string, income: number, spend: number, go?: string }[],
  // The drawer
  drawerHero?: { id: string, av: Html, name: string, date: string, kicker: string, amount: string } | null, drawerReturn?: HTMLElement | null, drawerTok?: number,
  extrasCtx?: { gid: string, jids: string[] }, linkTypes?: ApiData[] | null,
  // Data kept by pages
  billCache?: Record<string, ApiData>, billRises?: Record<string, ApiData>, subs?: ApiData[], budgetCache?: Record<string, ApiData>, budgetLimits?: Record<string, ApiData>,
  piggyCache?: Record<string, ApiData>, recCache?: Record<string, ApiData>, rules?: Record<string, ApiData>, ruleGroups?: ApiData[], rates?: ApiData[],
  rec?: ApiData, inbox?: ApiData, inboxHist?: { t: number, v: ApiData } | null, loanModel?: ApiData,
  dashEdit?: boolean, dashOptsOpen?: string | null, syncError?: string,
}
export const S: State = { y: today.getFullYear(), m: today.getMonth(), key: '', lists: null, tok: 0, form: null, currency: 'USD',
  freshAfter: 0, dirtyAt: 0, txMeta: {}, pendingDel: new Set() };
// An element by id, for ids the page is known to have; pass the element type when it matters: el<HTMLInputElement>('q')
export const el = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
export type Field = HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;
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
