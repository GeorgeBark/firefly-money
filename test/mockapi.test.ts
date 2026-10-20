import { describe, expect, it } from 'vitest';
import { NotFound, createMockApi } from '../app/src/demo/mockapi';

describe('demo API', () => {
  const now = new Date(2026, 9, 20);
  it('makes the same data on every visit', () => {
    expect(createMockApi(now)('/transactions', { limit: '500' })).toEqual(createMockApi(now)('/transactions', { limit: '500' }));
  });
  it('has about five months of transactions, newest first, none after today', () => {
    const { data } = createMockApi(now)('/transactions', { limit: '1000' }) as any;
    const dates = data.map(g => g.attributes.transactions[0].date.slice(0, 10));
    expect(dates[0] <= '2026-10-20').toBe(true);
    expect(dates.at(-1)).toBe('2026-05-01');
    expect([...dates].sort().reverse()).toEqual(dates);
  });
  it('pages lists and filters by date', () => {
    const api = createMockApi(now);
    const r = api('/transactions', { limit: '10', page: '2', start: '2026-10-01', end: '2026-10-20' }) as any;
    expect(r.data).toHaveLength(10);
    expect(r.meta.pagination.current_page).toBe(2);
    expect(r.data.every(g => g.attributes.transactions[0].date >= '2026-10-01')).toBe(true);
  });
  it('category totals add up to total spending', () => {
    const api = createMockApi(now), q = { start: '2026-10-01', end: '2026-10-31' };
    const cats = (api('/insight/expense/category', q) as any[]).reduce((s, c) => s + c.difference_float, 0);
    const none = (api('/insight/expense/no-category', q) as any[]).reduce((s, c) => s + c.difference_float, 0);
    expect(cats + none).toBeCloseTo(-(api('/insight/expense/total', q) as any)[0].difference_float, 2);
  });
  it('deletes a transaction', () => {
    const api = createMockApi(now);
    expect(api('/transactions/1', {}, 'DELETE')).toBeNull();
    expect(api('/transactions/1', {})).toEqual({ data: undefined });
  });
  it('keeps preferences, and answers 404 for one never saved', () => {
    const api = createMockApi(now);
    expect(() => api('/preferences/money_settings', {})).toThrow(NotFound);
    api('/preferences', {}, 'POST', { name: 'money_settings', data: { a: 1 } });
    expect((api('/preferences/money_settings', {}) as any).data.attributes.data).toEqual({ a: 1 });
  });
  it('gives balances as of a past date', () => {
    const api = createMockApi(now);
    const bal = (q) => +(api('/accounts', q) as any).data[0].attributes.current_balance;
    expect(bal({ date: '2026-10-20' })).toBeCloseTo(bal({}), 2);
    expect(bal({ date: '2026-06-01' })).not.toBeCloseTo(bal({}), 2);
  });
});
