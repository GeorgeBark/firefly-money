import { describe, expect, it } from 'vitest';
import { isCard, isLiab, normAccount, parsePlan, planText, stripPlan, withPlan } from '../app/src/core/lists';

describe('loan payment plan in account notes', () => {
  it('reads the plan line', () => {
    expect(parsePlan('Car loan\nMonthly payment: $1,250.50 on day 15 from Checking')).toEqual({ amount: 1250.5, day: 15, from: 'Checking' });
    expect(parsePlan('monthly payment: 300')).toEqual({ amount: 300, day: null, from: '' });
    expect(parsePlan('no plan here')).toBeNull();
    expect(parsePlan(null)).toBeNull();
  });
  it('writes it back without touching the other notes', () => {
    const notes = withPlan('Car loan', { amount: 300, day: 1, from: 'Checking' });
    expect(notes).toBe('Car loan\n\nMonthly payment: $300.00 on day 1 from Checking');
    expect(parsePlan(notes)).toEqual({ amount: 300, day: 1, from: 'Checking' });
    expect(stripPlan(notes)).toBe('Car loan');
    expect(withPlan(notes, null)).toBe('Car loan');
  });
  it('describes it', () => {
    expect(planText({ amount: 300, day: 22, from: 'Checking' })).toBe('$300.00/month on the 22nd from Checking');
    expect(planText({ amount: 0 })).toBe('');
  });
});

describe('accounts', () => {
  it('normalizes the API shape', () => {
    const a = normAccount({ id: 7, attributes: { name: 'Visa', type: 'asset', account_role: 'ccAsset', current_balance: '-120.5', notes: 'Monthly payment: 50' } });
    expect(a).toMatchObject({ id: '7', name: 'Visa', balance: -120.5, debt: 120.5, active: true, plan: { amount: 50 } });
    expect(isCard(a)).toBe(true);
  });
  it('knows which types are liabilities', () => {
    expect(['loan', 'debt', 'mortgage', 'liabilities'].every(type => isLiab({ type }))).toBe(true);
    expect(isLiab({ type: 'asset' })).toBe(false);
  });
});
