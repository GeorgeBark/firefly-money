import { describe, expect, it } from 'vitest';
import { goalPace } from '../app/src/features/pace';
import { monthEnds } from '../app/src/core/helpers';

describe('goalPace', () => {
  it('works out the monthly amount still needed', () => {
    const p = goalPace({ target: 2400, current: 600, targetDate: '2027-04-20' }, '2026-10-20');
    expect(p).toMatchObject({ status: 'on', left: 1800, monthsLeft: 6, perMonth: 300 });
  });
  it('says behind when savings trail an even pace from the start date', () => {
    const p = goalPace({ target: 1200, current: 200, startDate: '2026-04-20', targetDate: '2027-04-20' }, '2026-10-20');
    expect(p.status).toBe('behind');
    expect(Math.round(p.gap)).toBe(402);     // 183 of 365 days have passed, so about $602 should be saved
  });
  it('says on track when ahead of that pace', () => {
    expect(goalPace({ target: 1200, current: 700, startDate: '2026-04-20', targetDate: '2027-04-20' }, '2026-10-20').status).toBe('on');
  });
  it('handles goals that are reached, undated or past their date', () => {
    expect(goalPace({ target: 500, current: 500, targetDate: '2027-01-01' }, '2026-10-20').status).toBe('done');
    expect(goalPace({ target: 500, current: 100 }, '2026-10-20').status).toBe('open');
    expect(goalPace({ target: 500, current: 100, targetDate: '2026-10-01' }, '2026-10-20')).toMatchObject({ status: 'late', perMonth: 400 });
  });
});

describe('monthEnds', () => {
  it('lists month ends before today, oldest first', () => {
    expect(monthEnds('2026-03-15', 4)).toEqual(['2025-12-31', '2026-01-31', '2026-02-28', '2026-03-15']);
  });
  it('steps by quarters', () => {
    expect(monthEnds('2026-10-20', 3, 3)).toEqual(['2026-06-30', '2026-09-30', '2026-10-20']);
  });
});
