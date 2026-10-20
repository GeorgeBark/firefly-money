import { describe, expect, it } from 'vitest';
import { S, arr, esc, isoDate, money, monthRange, num, sameName } from '../app/src/core/base';

describe('monthRange', () => {
  it('gives the first and last day of the month', () => {
    expect(monthRange(2026, 1)).toMatchObject({ start: '2026-02-01', end: '2026-02-28', y: 2026, m: 1 });
    expect(monthRange(2028, 1).end).toBe('2028-02-29');
  });
  it('wraps months outside 0-11 into the next or previous year', () => {
    expect(monthRange(2026, 12)).toMatchObject({ start: '2027-01-01', y: 2027, m: 0 });
    expect(monthRange(2026, -1)).toMatchObject({ start: '2025-12-01', end: '2025-12-31', y: 2025, m: 11 });
  });
});

describe('small helpers', () => {
  it('escapes HTML', () => {
    expect(esc('<a href="x">Tom & Jerry\'s</a>')).toBe('&lt;a href=&quot;x&quot;&gt;Tom &amp; Jerry&#39;s&lt;/a&gt;');
    expect(esc(null)).toBe('');
  });
  it('reads numbers leniently', () => {
    expect(num('12.5')).toBe(12.5);
    expect(num('')).toBe(0);
    expect(num(undefined)).toBe(0);
  });
  it('unwraps API lists', () => {
    expect(arr([1])).toEqual([1]);
    expect(arr({ data: [2] })).toEqual([2]);
    expect(arr(null)).toEqual([]);
  });
  it('formats dates and money', () => {
    expect(isoDate(new Date(2026, 0, 5))).toBe('2026-01-05');
    S.currency = 'EUR';
    expect(money(1234.5)).toBe('€1,234.50');
    S.currency = 'USD';
    expect(money(-3)).toBe('-$3.00');
  });
  it('compares names ignoring case and spaces', () => {
    expect(sameName(' Groceries', 'groceries ')).toBe(true);
    expect(sameName('a', null)).toBe(false);
  });
});
