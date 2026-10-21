import { clearCache, getAll } from './api';
import { S, money, num } from './base';

/* ================= Reference lists (cached) ================= */
export function normAccount(a) {
  const t = a.attributes || {};
  return {
    id: String(a.id), name: t.name, type: String(t.type || ''), role: t.account_role || '', active: t.active !== false,
    balance: num(t.current_balance), debt: t.current_debt != null ? Math.abs(num(t.current_debt)) : Math.abs(num(t.current_balance)),
    opening: num(t.opening_balance), liabType: t.liability_type || '', interest: t.interest || '', interestPeriod: t.interest_period || '',
    paymentDate: t.monthly_payment_date || '', number: t.account_number || '', notes: t.notes || '', currency: t.currency_code || '',
    netWorth: t.include_net_worth !== false, openingDate: t.opening_balance_date || '', plan: parsePlan(t.notes),
  };
}
export type Account = ReturnType<typeof normAccount>;
// A loan's planned monthly payment lives in its Firefly notes as one line, e.g.
// "Monthly payment: $500.00 on day 30 from Chase Checking", so every device sees it.
const PLAN_RE = /^[ \t]*Monthly payment:[ \t]*\$?([\d,.]+)(?:[ \t]+on day[ \t]+(\d{1,2}))?(?:[ \t]+from[ \t]+(.+?))?[ \t]*$/im;
export function parsePlan(notes) { const m = PLAN_RE.exec(notes || ''); return m ? { amount: num(m[1].replace(/,/g, '')), day: m[2] ? +m[2] : null, from: m[3] ? m[3].trim() : '' } : null; }
export function stripPlan(notes) { return String(notes || '').replace(PLAN_RE, '').replace(/\n{3,}/g, '\n\n').trim(); }
export function withPlan(notes, p) {
  const base = stripPlan(notes);
  if (!p || !(p.amount > 0)) return base;
  const line = 'Monthly payment: $' + p.amount.toFixed(2) + (p.day ? ' on day ' + p.day : '') + (p.from ? ' from ' + p.from : '');
  return (base ? base + '\n\n' : '') + line;
}
export const ordinal = n => n + (n % 100 >= 11 && n % 100 <= 13 ? 'th' : ['th', 'st', 'nd', 'rd'][n % 10] || 'th');
export const planText = p => p && p.amount > 0 ? money(p.amount) + '/month' + (p.day ? ' on the ' + ordinal(p.day) : '') + (p.from ? ' from ' + p.from : '') : '';
export const isAsset = a => a.type === 'asset';
export const isCard = a => a.type === 'asset' && a.role === 'ccAsset';
export const isLiab = a => a.type.startsWith('liab') || ['loan', 'debt', 'mortgage'].includes(a.type);
export async function lists(force?): Promise<any> {
  if (S.lists && !force && Date.now() - S.listsAt < 300000) return S.lists;
  const [accounts, categories, budgets, bills, tags, currencies] = await Promise.all([
    getAll('/accounts', { type: 'all' }), getAll('/categories'), getAll('/budgets'), getAll('/bills'), getAll('/tags'), getAll('/currencies').catch(() => []),
  ]);
  const acc = accounts.map(normAccount);
  const L: any = {
    accounts: acc,
    byId: Object.fromEntries(acc.map(a => [a.id, a])),
    own: acc.filter(a => (isAsset(a) || isLiab(a)) && a.active),
    expense: acc.filter(a => a.type === 'expense'),
    revenue: acc.filter(a => a.type === 'revenue'),
    categories: categories.map(c => ({ id: String(c.id), name: c.attributes.name, notes: c.attributes.notes || '' })).sort((a, b) => a.name.localeCompare(b.name)),
    budgets: budgets.map(b => ({ id: String(b.id), name: b.attributes.name, active: b.attributes.active !== false, notes: b.attributes.notes || '' })),
    bills: bills.map(b => ({ id: String(b.id), name: b.attributes.name, active: b.attributes.active !== false })),
    tags: tags.map(t => ({ id: String(t.id), name: t.attributes.tag })).sort((a, b) => a.name.localeCompare(b.name)),
    currencies: currencies.map(c => ({ id: String(c.id), code: c.attributes.code, name: c.attributes.name, symbol: c.attributes.symbol, enabled: !!c.attributes.enabled,
      primary: !!(c.attributes.primary || c.attributes.default || c.attributes.native) })),
  };
  L.foreign = L.currencies.filter(c => c.enabled && c.code !== S.currency);
  S.currency = (L.currencies.find(c => c.primary) || acc.find(a => isAsset(a) && a.currency) || {}).code || (acc.find(a => isAsset(a) && a.currency) || {}).currency || S.currency;
  L.foreign = L.currencies.filter(c => c.enabled && c.code !== S.currency);
  S.lists = L; S.listsAt = Date.now();
  return L;
}
export const invalidate = () => { clearCache(); };

