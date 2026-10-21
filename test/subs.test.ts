import { describe, expect, it } from 'vitest';
import { billRises, findRecurring, nextDate } from '../app/src/features/subs';

const c = (date: string, amount: number, payee = 'StreamFlix', billId = '') => ({ date, amount, payeeId: payee.toLowerCase(), payee, billId });
const monthly = (payee: string, amount: number, months: number[], day = 4, year = 2026) => months.map(m => c(year + '-' + String(m).padStart(2, '0') + '-' + String(day).padStart(2, '0'), amount, payee));

describe('findRecurring', () => {
  it('finds a monthly subscription and when it comes next', () => {
    const [r] = findRecurring(monthly('StreamFlix', 15.49, [5, 6, 7, 8, 9, 10]), '2026-10-20');
    expect(r).toMatchObject({ payee: 'StreamFlix', freq: 'monthly', skip: 0, amount: 15.49, min: 15.49, max: 15.49, last: '2026-10-04', next: '2026-11-04', count: 6, rose: null });
  });
  it('notices a price rise on the latest charge', () => {
    const cs = [...monthly('StreamFlix', 15.49, [5, 6, 7, 8, 9]), c('2026-10-04', 17.99)];
    expect(findRecurring(cs, '2026-10-20')[0]).toMatchObject({ rose: { from: 15.49, to: 17.99 }, amount: 17.99, min: 17.99, max: 17.99 });
  });
  it('accepts utility bills that vary a little, and a charge that moves a few days', () => {
    const cs = [c('2026-06-02', 90, 'Power'), c('2026-07-03', 104, 'Power'), c('2026-08-01', 88, 'Power'), c('2026-09-05', 99, 'Power'), c('2026-10-02', 95, 'Power')];
    expect(findRecurring(cs, '2026-10-20')[0]).toMatchObject({ freq: 'monthly', min: 88, max: 104, rose: null });
  });
  it('ignores everyday shopping at the same store', () => {
    const cs = ['2026-09-01', '2026-09-03', '2026-09-09', '2026-09-10', '2026-09-21', '2026-10-02', '2026-10-05'].map((d, i) => c(d, [64, 12, 88, 40, 23, 70, 51][i], 'Grocer'));
    expect(findRecurring(cs, '2026-10-20')).toEqual([]);
  });
  it('drops payees already linked to a bill, and ones that stopped', () => {
    expect(findRecurring(monthly('Gym', 40, [5, 6, 7, 8, 9, 10]).map(x => ({ ...x, billId: '3' })), '2026-10-20')).toEqual([]);
    expect(findRecurring(monthly('Gym', 40, [1, 2, 3, 4]), '2026-10-20')).toEqual([]);
  });
  it('finds weekly, every-other-week and yearly charges', () => {
    const weekly = ['2026-09-15', '2026-09-22', '2026-09-29', '2026-10-06', '2026-10-13'].map(d => c(d, 9.99, 'Paper'));
    expect(findRecurring(weekly, '2026-10-20')[0]).toMatchObject({ freq: 'weekly', skip: 0, every: 'week', next: '2026-10-20' });
    const biweekly = ['2026-08-21', '2026-09-04', '2026-09-18', '2026-10-02', '2026-10-16'].map(d => c(d, 30, 'Cleaner'));
    expect(findRecurring(biweekly, '2026-10-20')[0]).toMatchObject({ freq: 'weekly', skip: 1, every: '2 weeks' });
    expect(findRecurring([c('2025-03-10', 99, 'Domain'), c('2026-03-11', 99, 'Domain')], '2026-10-20')[0]).toMatchObject({ freq: 'yearly', next: '2027-03-11' });
  });
  it('puts the biggest yearly cost first', () => {
    const rs = findRecurring([...monthly('Music', 11.99, [7, 8, 9, 10]), ...monthly('Rent', 1500, [7, 8, 9, 10], 1)], '2026-10-20');
    expect(rs.map(r => r.payee)).toEqual(['Rent', 'Music']);
  });
});

describe('nextDate', () => {
  it('keeps the day of the month, clamped to short months', () => {
    expect(nextDate('2026-01-31', 'monthly')).toBe('2026-02-28');
    expect(nextDate('2026-11-15', 'quarterly')).toBe('2027-02-15');
    expect(nextDate('2026-10-01', 'monthly', 1)).toBe('2026-12-01');
  });
});

describe('billRises', () => {
  it('flags a bill whose latest charge is above its highest amount', () => {
    const cs = [c('2026-09-04', 15.49, 'StreamFlix', '7'), c('2026-10-04', 17.99, 'StreamFlix', '7'), c('2026-10-04', 50, 'Gym', '8')];
    expect(billRises(cs, [{ id: '7', max: 15.49 }, { id: '8', max: 50 }])).toEqual({ 7: { last: 17.99, date: '2026-10-04' } });
  });
});
