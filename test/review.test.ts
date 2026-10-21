import { describe, expect, it } from 'vitest';
import { reviewQueue } from '../app/src/pages/review';

const g = (id, created_at) => ({ id, attributes: { created_at } });
describe('review queue', () => {
  const raw = [g('1', '2026-10-10T09:00:00-05:00'), g('2', '2026-10-20T09:00:00-05:00'), g('3', '2026-10-21T01:00:00+02:00'), g('4', null)];
  it('lists what was added after the last review, newest first', () => {
    expect(reviewQueue(raw, '2026-10-15T00:00:00Z', []).map(x => x.id)).toEqual(['3', '2']);
  });
  it('compares times with different offsets as moments', () => {
    // 3 was added at 2026-10-20T23:00Z, before this mark
    expect(reviewQueue(raw, '2026-10-21T00:00:00Z', []).map(x => x.id)).toEqual([]);
    expect(reviewQueue(raw, '2026-10-20T22:00:00Z', []).map(x => x.id)).toEqual(['3']);
  });
  it('leaves out the ones ticked off', () => {
    expect(reviewQueue(raw, '2026-10-01T00:00:00Z', ['2']).map(x => x.id)).toEqual(['3', '1']);
  });
});
