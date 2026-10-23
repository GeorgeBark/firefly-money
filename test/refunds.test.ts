import { describe, expect, it } from 'vitest';
import { blankSplit, refundForm, type TxForm } from '../app/src/features/txform';
import { budgetsLessRefunds, netted, type Refund } from '../app/src/features/refunds';

const refund = (x: Partial<Refund>): Refund => ({ jid: '9', date: '2026-10-10', amount: 30, category: 'Shopping', payee: 'Amazon', budgetId: '2', budget: 'Fun', known: true, ...x });
const entry = (name: string, v: number) => ({ name, difference: v.toFixed(2), difference_float: v, currency_code: 'USD' });
const range = { start: '2026-10-01', end: '2026-10-31' };

describe('refunds come off spending', () => {
  it('nets totals, categories, payees and budgets', () => {
    const rs = [refund({}), refund({ jid: '10', amount: 5, category: '', payee: 'Target', budgetId: '', budget: '' })];
    expect(netted('/insight/expense/total', range, [entry('USD', -200)], rs)[0].difference_float).toBe(-165);
    expect(netted('/insight/income/total', range, [entry('USD', 1035)], rs)[0].difference_float).toBe(1000);
    expect(netted('/insight/expense/category', range, [entry('Shopping', -80), entry('Food', -50)], rs).map((x: { difference_float: number }) => x.difference_float)).toEqual([-50, -50]);
    expect(netted('/insight/income/category', range, [entry('Shopping', 30)], rs)[0].difference_float).toBe(0);
    expect(netted('/insight/expense/no-category', range, [entry('USD', -20)], rs)[0].difference_float).toBe(-15);
    expect(netted('/insight/expense/budget', range, [entry('Fun', -100)], rs)[0].difference_float).toBe(-70);
    expect(netted('/insight/expense/no-budget', range, [entry('USD', -40)], rs)[0].difference_float).toBe(-35);
    expect(netted('/insight/expense/expense', range, [entry('Amazon', -90), entry('Target', -3)], rs).map((x: { difference_float: number }) => x.difference_float)).toEqual([-60, -0]);
  });
  it('only counts refunds in the range, and never goes below zero', () => {
    expect(netted('/insight/expense/total', range, [entry('USD', -10)], [refund({ date: '2026-09-30' })])[0].difference_float).toBe(-10);
    expect(netted('/insight/expense/total', range, [entry('USD', -10)], [refund({})])[0].difference_float).toBe(-0);
  });
  it('leaves no-budget alone when the purchase is unknown', () => {
    expect(netted('/insight/expense/no-budget', range, [entry('USD', -40)], [refund({ known: false, budgetId: '', budget: '' })])[0].difference_float).toBe(-40);
  });
  it('takes refunds off a budget’s spending without changing the cached answer', () => {
    const b = { id: '2', attributes: { name: 'Fun', spent: [{ sum: '-100', currency_code: 'USD' }] } };
    const [out] = budgetsLessRefunds([b], [refund({})]);
    expect(out.attributes.spent.reduce((s: number, x: { sum: string }) => s + +x.sum, 0)).toBe(-70);
    expect(b.attributes.spent).toHaveLength(1);
    expect(budgetsLessRefunds([b], [refund({ amount: 500 })])[0].attributes.spent.reduce((s: number, x: { sum: string }) => s + +x.sum, 0)).toBe(0);
  });
});

describe('refund form', () => {
  it('fills an income form from the purchase', () => {
    const f: TxForm = { id: '5', type: 'withdrawal', date: '2026-10-02', title: '', main: '3', src: '3', dst: '', rules: false,
      splits: [{ ...blankSplit(), jid: '77', description: 'Amazon order', amount: '42.10', counter: 'Amazon', category: 'Shopping', budget: '2', tags: 'gift, refund' }] };
    const r = refundForm(f, '2026-10-20');
    expect(r).toMatchObject({ id: '', type: 'deposit', date: '2026-10-20', main: '3', refundOf: { jid: '77' } });
    expect(r.splits).toHaveLength(1);
    expect(r.splits[0]).toMatchObject({ description: 'Refund: Amazon order', amount: '42.10', counter: 'Amazon', category: 'Shopping', tags: 'gift, Refund', jid: '' });
  });
});
