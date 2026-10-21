import { afterEach, describe, expect, it, vi } from 'vitest';
import { type Group, dayLabel, monogram, payeeOf } from '../app/src/core/feed';

describe('payeeOf', () => {
  const g = (type, splits, title = '') => ({ type, title, splits }) as unknown as Group;
  it('uses the other side of the transaction', () => {
    expect(payeeOf(g('withdrawal', [{ destination_name: 'Shop', description: 'x' }]))).toEqual({ name: 'Shop', kind: 'withdrawal' });
    expect(payeeOf(g('deposit', [{ source_name: 'Employer', description: 'x' }]))).toEqual({ name: 'Employer', kind: 'deposit' });
  });
  it('falls back to the description for unnamed and cash accounts', () => {
    expect(payeeOf(g('withdrawal', [{ destination_name: '(cash account)', description: 'Coffee' }])).name).toBe('Coffee');
  });
  it('uses the group title when splits go to different payees', () => {
    expect(payeeOf(g('withdrawal', [{ destination_name: 'A' }, { destination_name: 'B' }], 'Weekend')).name).toBe('Weekend');
  });
});

describe('monogram', () => {
  it('takes initials, skipping card-terminal noise and filler words', () => {
    expect(monogram('Whole Foods Market')).toBe('WF');
    expect(monogram('SQ *Blue Bottle Coffee')).toBe('BB');
    expect(monogram('The Home Depot')).toBe('HD');
    expect(monogram('IKEA')).toBe('IK');
    expect(monogram('amazon')).toBe('A');
    expect(monogram('---')).toBe('•');
  });
});

describe('dayLabel', () => {
  afterEach(() => vi.useRealTimers());
  it('names days near today', () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 9, 20, 10));     // Tuesday 20 Oct 2026
    expect(dayLabel('2026-10-20')).toBe('Today');
    expect(dayLabel('2026-10-19T08:00:00')).toBe('Yesterday');
    expect(dayLabel('2026-10-21')).toBe('Tomorrow');
    expect(dayLabel('2026-10-16')).toBe('Friday');
    expect(dayLabel('2026-10-01')).toBe('Thu, Oct 1');
    expect(dayLabel('2025-10-01')).toBe('Wed, Oct 1, 2025');
  });
});
