/* How a savings goal (a piggy bank with a target date) is doing. Pure logic, tested in test/pace.test.ts. */

export interface Pace {
  status: 'done' | 'open' | 'late' | 'on' | 'behind';
  left: number; perMonth: number; monthsLeft: number; gap: number;
}
const t = (iso: string) => Date.parse(String(iso).slice(0, 10) + 'T12:00:00Z');
const MONTH = 30.44 * 864e5;

// left: still to save. perMonth: what it takes each month from now to reach the goal on time.
// on/behind: compares what's saved with an even pace from the start date to the target date
// (gap = how far behind that pace). Without a start date a dated goal is always 'on' unless it's late.
export function goalPace(p: { target: number; current: number; startDate?: string; targetDate?: string }, today: string): Pace {
  const left = Math.max(0, p.target - p.current), none = { left, perMonth: 0, monthsLeft: 0, gap: 0 };
  if (!(left > 0)) return { status: 'done', ...none };
  if (!p.targetDate) return { status: 'open', ...none };
  const now = t(today), end = t(p.targetDate);
  if (end <= now) return { status: 'late', ...none, perMonth: left };
  const monthsLeft = Math.max(1, Math.round((end - now) / MONTH)), perMonth = left / monthsLeft;
  const start = p.startDate ? t(p.startDate) : NaN;
  if (!(start < now && start < end)) return { status: 'on', left, perMonth, monthsLeft, gap: 0 };
  const expected = p.target * (now - start) / (end - start), gap = Math.max(0, expected - p.current);
  // A little slack, so a goal a few dollars short of the line doesn't read as behind
  return { status: gap > Math.max(1, p.target * 0.02) ? 'behind' : 'on', left, perMonth, monthsLeft, gap };
}
