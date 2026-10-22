import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { monthOf, monthRange } from '../app/src/core/base';
import { type Group } from '../app/src/core/feed';
import { blankSplit, copyForm, type TxForm } from '../app/src/features/txform';
import { parseQuestion, questionRange } from '../app/src/pages/ask';
import { budgetPace } from '../app/src/pages/budgets';
import { logForecast, recurDates, scenarioAmount } from '../app/src/pages/forecast';
import { compareRange, toCsv } from '../app/src/pages/reports';
import { matchTransfers } from '../app/src/pages/review';

const setCycle = (d: number | null) => { if (d == null) localStorage.removeItem('money.cycleDay'); else localStorage.setItem('money.cycleDay', String(d)); };
afterEach(() => setCycle(null));

describe('pay-cycle months', () => {
  it('uses calendar months by default', () => {
    expect(monthRange(2026, 1)).toMatchObject({ start: '2026-02-01', end: '2026-02-28', label: 'February 2026' });
    expect(monthOf(new Date(2026, 9, 1, 12))).toEqual([2026, 9]);
  });
  it('runs from the start day to the day before it next month', () => {
    setCycle(15);
    expect(monthRange(2026, 9)).toMatchObject({ start: '2026-10-15', end: '2026-11-14', label: 'October 2026' });
    expect(monthRange(2026, 11)).toMatchObject({ start: '2026-12-15', end: '2027-01-14' });
    expect(monthOf(new Date(2026, 9, 14, 12))).toEqual([2026, 8]);
    expect(monthOf(new Date(2026, 9, 15, 12))).toEqual([2026, 9]);
    expect(monthOf(new Date(2026, 0, 3, 12))).toEqual([2025, 11]);
  });
  it('ignores a day it can’t use', () => {
    setCycle(40);
    expect(monthRange(2026, 9).start).toBe('2026-10-01');
  });
});

describe('budget pace', () => {
  const p = (spent: number, today: string) => budgetPace(spent, 300, '2026-10-01', '2026-10-30', today, 85);
  it('is only for the month that includes today', () => { expect(p(10, '2026-11-02')).toBeNull(); });
  it('marks where today is in the month', () => { expect(p(100, '2026-10-15')!.at).toBeCloseTo(0.5); });
  it('says on pace, ahead of pace or at the warning level', () => {
    expect(p(100, '2026-10-15')).toMatchObject({ tone: 'ok', text: 'On pace' });
    expect(p(200, '2026-10-15')).toMatchObject({ tone: 'warn', text: 'Ahead of pace · may run out around Oct 23' });
    expect(p(270, '2026-10-20')).toMatchObject({ tone: 'warn', text: '90% used with 10 days to go' });
    expect(p(301, '2026-10-20')!.tone).toBe('over');
  });
});

describe('duplicate', () => {
  it('copies every split as new, dated as asked', () => {
    const f: TxForm = { id: '12', type: 'withdrawal', date: '2026-09-01', title: 'Costco', main: '1', src: '1', dst: '', rules: false, draft: 'd1',
      splits: [{ ...blankSplit(), jid: '5', description: 'Food', amount: '40', orig: { amount: '40' } }, { ...blankSplit(), jid: '6', description: 'Soap', amount: '9' }] };
    const c = copyForm(f, '2026-10-22');
    expect(c).toMatchObject({ id: '', date: '2026-10-22', rules: true, title: 'Costco', draft: undefined });
    expect(c.splits.map(s => [s.jid, s.description, s.amount, s.orig])).toEqual([['', 'Food', '40', {}], ['', 'Soap', '9', {}]]);
    expect(f.splits[0].jid).toBe('5');
  });
});

describe('forecast', () => {
  it('carries recurring dates on past the ones Firefly lists', () => {
    expect(recurDates(['2026-11-03', '2026-12-03', '2027-01-03'], '2027-04-10', '')).toEqual(['2026-11-03', '2026-12-03', '2027-01-03', '2027-02-03', '2027-03-03', '2027-04-03']);
    expect(recurDates(['2026-11-03', '2026-11-17'], '2026-12-20', '')).toEqual(['2026-11-03', '2026-11-17', '2026-12-01', '2026-12-15']);
    expect(recurDates(['2026-11-03', '2026-12-03'], '2027-06-01', '2027-01-31')).toEqual(['2026-11-03', '2026-12-03', '2027-01-03']);
    expect(recurDates(['2026-11-30'], '2027-06-01', '')).toEqual(['2026-11-30']);
  });
  it('makes careful and hopeful amounts', () => {
    expect(scenarioAmount({ kind: 'Income', amount: 200 }, 'careful')).toBe(0);
    expect(scenarioAmount({ kind: 'Payday', amount: 2000 }, 'careful')).toBe(2000);
    expect(scenarioAmount({ kind: 'Bill', amount: -100 }, 'careful')).toBeCloseTo(-110);
    expect(scenarioAmount({ kind: 'Recurring', amount: -100 }, 'hopeful')).toBeCloseTo(-90);
    expect(scenarioAmount({ kind: 'Card', amount: -500 }, 'hopeful')).toBe(-500);
  });
  it('notes a forecast once a day and settles it when the day comes', () => {
    let log = logForecast([], 'a', '2026-10-01', 900, 1000);
    expect(log).toEqual([{ acct: 'a', made: '2026-10-01', for: '2026-10-31', v: 900 }]);
    expect(logForecast(log, 'a', '2026-10-01', 950, 1000)).toEqual(log);
    log = logForecast(log, 'a', '2026-11-02', 800, 870);
    expect(log[0]).toMatchObject({ for: '2026-10-31', v: 900, actual: 870 });
    expect(log).toHaveLength(2);
    // Too late to tell: dropped
    expect(logForecast([{ acct: 'a', made: '2026-09-01', for: '2026-10-01', v: 5 }], 'a', '2026-10-20', undefined, 1)).toEqual([]);
  });
});

describe('reports', () => {
  it('compares with the period before or the same dates last year', () => {
    expect(compareRange('2026-10-01', '2026-10-31', 'prev')).toEqual({ start: '2026-09-01', end: '2026-09-30' });
    expect(compareRange('2026-08-01', '2026-10-31', 'prev')).toEqual({ start: '2026-05-01', end: '2026-07-31' });
    expect(compareRange('2026-10-05', '2026-10-14', 'prev')).toEqual({ start: '2026-09-25', end: '2026-10-04' });
    expect(compareRange('2028-02-01', '2028-02-29', 'year')).toEqual({ start: '2027-02-01', end: '2027-02-28' });
    expect(compareRange('2026-10-01', '2026-10-31', '')).toBeNull();
  });
  it('writes CSV with quoting', () => {
    expect(toCsv([['Section', 'Name', 'Amount'], ['Top payees', 'Joe, "the" plumber', 12.5]])).toBe('Section,Name,Amount\r\nTop payees,"Joe, ""the"" plumber",12.50\r\n');
  });
});

describe('transfers to match', () => {
  const tx = (id: string, type: string, date: string, amount: number, src: string, dst: string): Group => ({ id, title: '', type, date, total: amount,
    splits: [{ jid: id, type, date, amount, description: id, source_id: src, source_name: src, source_type: '', destination_id: dst, destination_name: dst, destination_type: '',
      category: '', budget_id: '', budget_name: '', bill_id: '', bill_name: '', tags: [], notes: '' } as unknown as Group['splits'][0]] });
  const own = new Set(['chk', 'sav']);
  const gs = [tx('w1', 'withdrawal', '2026-10-01', 500, 'chk', 'x'), tx('d1', 'deposit', '2026-10-03', 500, 'y', 'sav'), tx('d2', 'deposit', '2026-10-01', 500, 'z', 'chk'),
    tx('w2', 'withdrawal', '2026-10-05', 80, 'chk', 'x'), tx('d3', 'deposit', '2026-10-15', 80, 'y', 'sav')];
  it('pairs money leaving one account with the same amount arriving in another', () => {
    expect(matchTransfers(gs, own, new Set()).map(p => p.id)).toEqual(['w1:d1']);
  });
  it('skips pairs marked as not a pair', () => {
    expect(matchTransfers(gs, own, new Set(['w1:d1']))).toEqual([]);
  });
});

describe('ask', () => {
  beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(new Date(2026, 9, 22, 12)); });
  afterEach(() => vi.useRealTimers());
  const L = { categories: [{ id: '3', name: 'Groceries', notes: '' }, { id: '4', name: 'Gas', notes: '' }], budgets: [], tags: [], expense: [{ id: '9', name: 'Whole Foods' }] } as never;
  it('reads the period', () => {
    expect(questionRange('how much did I spend', '2026-10-22')).toMatchObject({ start: '2026-10-01', end: '2026-10-31', label: 'this month' });
    expect(questionRange('spent last month', '2026-10-22')).toMatchObject({ start: '2026-09-01', end: '2026-09-30' });
    expect(questionRange('in december?', '2026-10-22')).toMatchObject({ start: '2025-12-01' });
    expect(questionRange('this year', '2026-10-22')).toMatchObject({ start: '2026-01-01', end: '2026-10-22' });
    expect(questionRange('last 30 days', '2026-10-22')).toMatchObject({ start: '2026-09-23', end: '2026-10-22' });
  });
  it('reads what kind of question it is and what it names', () => {
    expect(parseQuestion('Why did I spend more this month?', L, '2026-10-22').intent).toBe('why');
    expect(parseQuestion('Which bills are due before payday?', L, '2026-10-22').intent).toBe('bills');
    expect(parseQuestion('How much can I spend?', L, '2026-10-22').intent).toBe('safe');
    expect(parseQuestion('What was my biggest expense last month?', L, '2026-10-22').intent).toBe('biggest');
    expect(parseQuestion('How much did I earn this year?', L, '2026-10-22').intent).toBe('income');
    const q = parseQuestion('How much did I spend on groceries at whole foods?', L, '2026-10-22');
    expect(q).toMatchObject({ intent: 'spentOn', target: { kind: 'payee', name: 'Whole Foods' } });
    expect(parseQuestion('pizza', L, '2026-10-22').intent).toBe('search');
  });
});
