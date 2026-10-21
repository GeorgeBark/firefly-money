import { describe, expect, it } from 'vitest';
import { normGroup } from '../app/src/core/feed';
import { fit, spotsOf, toPx } from '../app/src/pages/map';

const tx = (id: string, payee: string, amount: number, lat?: number, lng?: number, type = 'withdrawal') => normGroup({
  id, attributes: { transactions: [{ transaction_journal_id: id, type, date: '2026-10-10T12:00:00Z', amount: String(amount), description: payee, destination_name: payee, destination_type: 'Expense account', source_name: 'Card', latitude: lat ?? null, longitude: lng ?? null }] },
});

describe('map', () => {
  it('places points with Web Mercator', () => {
    expect(toPx(0, 0, 0)).toEqual({ x: 128, y: 128 });
    expect(toPx(0, -180, 1).x).toBe(0);
    expect(toPx(85.05, 0, 0).y).toBeCloseTo(0, 0);
  });
  it('groups purchases by payee and place, biggest first', () => {
    const spots = spotsOf([
      tx('1', 'Blue Bottle', 5, 40.7411, -73.9897), tx('2', 'Blue Bottle', 6, 40.74112, -73.98968),
      tx('3', 'Blue Bottle', 4, 40.7527, -73.9772), tx('4', 'Grocer', 80, 40.73, -73.99),
      tx('5', 'Online', 20), tx('6', 'Refund', 9, 40.7, -73.9, 'deposit'),
    ]);
    expect(spots.map(s => [s.name, s.groups.length, s.total])).toEqual([['Grocer', 1, 80], ['Blue Bottle', 2, 11], ['Blue Bottle', 1, 4]]);
  });
  it('zooms to show every spot', () => {
    const near = fit([{ lat: 40.74, lng: -73.99 }, { lat: 40.75, lng: -73.98 }], 400, 400);
    const far = fit([{ lat: 40.74, lng: -73.99 }, { lat: 34.05, lng: -118.24 }], 400, 400);
    expect(near.z).toBeGreaterThan(far.z);
    expect(far.lng).toBeCloseTo(-96.1, 1);
    expect(fit([], 400, 400).z).toBe(3);
  });
});
