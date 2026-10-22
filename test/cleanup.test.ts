import { describe, expect, it } from 'vitest';
import { usedBy } from '../app/src/pages/cleanup';

const g = (...splits: Record<string, unknown>[]) => ({ attributes: { transactions: splits } });
describe('clean up', () => {
  it('collects the accounts, categories, budgets and tags that transactions use', () => {
    const u = usedBy([g({ source_id: 1, destination_id: '100', category_id: 4, budget_id: null, tags: ['Trip'] }, { source_id: '1', destination_id: '101', category_id: null, tags: [] }), { attributes: {} }]);
    expect([...u.accounts].sort()).toEqual(['1', '100', '101']);
    expect([...u.categories]).toEqual(['4']);
    expect(u.budgets.size).toBe(0);
    expect(u.tags.has('trip')).toBe(true);
  });
});
