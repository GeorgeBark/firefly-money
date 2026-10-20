import { describe, expect, it } from 'vitest';
import { LS, addDays, bizDay, daysBetween, fmtSize, monthsFrom } from '../app/src/core/helpers';

describe('date helpers', () => {
  it('adds days across month and year ends', () => {
    expect(addDays('2026-01-31', 1)).toBe('2026-02-01');
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
  });
  it('counts days between dates, across daylight saving changes', () => {
    expect(daysBetween('2026-03-01', '2026-04-01')).toBe(31);
    expect(daysBetween('2026-11-10', '2026-11-01')).toBe(-9);
  });
  it('moves a weekend payment day back to Friday and clamps to the month', () => {
    expect(bizDay(2026, 1, 31)).toBe('2026-02-27');   // Feb 28 2026 is a Saturday
    expect(bizDay(2026, 9, 18)).toBe('2026-10-16');   // Sunday → Friday
    expect(bizDay(2026, 9, 20)).toBe('2026-10-20');   // a Tuesday stays
  });
  it('lists the months between two dates', () => {
    expect(monthsFrom('2026-11-15', '2027-01-02')).toEqual([[2026, 10], [2026, 11], [2027, 0]]);
  });
});

describe('fmtSize', () => {
  it('picks a unit', () => {
    expect(fmtSize(500)).toBe('500 B');
    expect(fmtSize(2048)).toBe('2 KB');
    expect(fmtSize(3 * 1048576)).toBe('3.0 MB');
  });
});

describe('LS', () => {
  it('stores JSON under money.* and falls back on bad data', () => {
    LS.set('t', { a: 1 });
    expect(localStorage.getItem('money.t')).toBe('{"a":1}');
    expect(LS.get('t', null)).toEqual({ a: 1 });
    localStorage.setItem('money.bad', '{oops');
    expect(LS.get('bad', 'fallback')).toBe('fallback');
    expect(LS.get('missing', 7)).toBe(7);
  });
});
