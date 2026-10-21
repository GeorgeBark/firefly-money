import { describe, expect, it } from 'vitest';
import { gridDrop, gridSettle, snapStep } from '../app/src/features/grid';

const tile = (k, x, y, w, h, float = false) => ({ k, x, y, w, h, float });
const overlaps = (a, b) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
const noOverlaps = ts => ts.every((a, i) => ts.every((b, j) => i === j || !overlaps(a, b)));

describe('gridSettle', () => {
  it('pushes an overlapped tile down just below the one above it', () => {
    const ts = gridSettle([tile('a', 0, 0, 12, 10), tile('b', 6, 4, 12, 10)]);
    expect(ts[1].y).toBe(10);
    expect(noOverlaps(ts)).toBe(true);
  });
  it('lets the tile being dragged keep its spot and moves the others', () => {
    const ts = gridSettle([tile('a', 0, 0, 12, 10), tile('b', 0, 2, 12, 10)], 'b');
    expect(ts.find(t => t.k === 'b').y).toBe(2);
    expect(ts.find(t => t.k === 'a').y).toBe(12);
  });
  it('keeps gaps you leave on purpose', () => {
    const ts = gridSettle([tile('a', 0, 0, 12, 10), tile('b', 0, 30, 12, 10)]);
    expect(ts[1].y).toBe(30);
  });
  it('raises tiles nobody placed yet as high as they fit', () => {
    const ts = gridSettle([tile('a', 0, 0, 12, 10), tile('b', 12, 50, 12, 10, true), tile('c', 0, 60, 24, 5, true)]);
    expect(ts[1].y).toBe(0);
    expect(ts[2].y).toBe(10);
    expect(noOverlaps(ts)).toBe(true);
  });
  it('drops a new tile where you drag it, even before it has a saved spot', () => {
    const ts = gridSettle([tile('a', 0, 0, 12, 10), tile('b', 12, 40, 12, 10, true)], 'b');
    expect(ts[1].y).toBe(40);
  });
  it('never leaves overlaps in a crowded layout', () => {
    const ts = Array.from({ length: 30 }, (_, i) => tile('t' + i, (i * 7) % 20, (i * 3) % 11, 4 + (i % 9), 5 + (i % 4)));
    expect(noOverlaps(gridSettle(ts, 't5'))).toBe(true);
  });
});

describe('gridDrop', () => {
  it('tucks a dragged tile under one whose lower half it lands in, instead of pushing that one down', () => {
    const ts = gridDrop([tile('a', 0, 0, 12, 20), tile('b', 0, 14, 12, 10)], 'b');
    expect(ts.find(t => t.k === 'a').y).toBe(0);
    expect(ts.find(t => t.k === 'b').y).toBe(20);
  });
  it('swaps once the dragged tile is past the other one\'s middle', () => {
    const ts = gridDrop([tile('a', 0, 0, 12, 20), tile('b', 0, 8, 12, 10)], 'b');
    expect(ts.find(t => t.k === 'b').y).toBe(8);
    expect(ts.find(t => t.k === 'a').y).toBe(18);
  });
});

describe('snapStep', () => {
  it('ignores small wobbles around the current step', () => {
    expect(snapStep(10 + 2.5, 10, 4)).toBe(10);
    expect(snapStep(10 - 2.9, 10, 4)).toBe(10);
  });
  it('moves by whole steps once well past halfway', () => {
    expect(snapStep(13.2, 10, 4)).toBe(14);
    expect(snapStep(1, 10, 4)).toBe(2);
  });
});

describe('packing', () => {
  it('closes empty space when every tile floats up, keeping their order', () => {
    const ts = gridSettle([tile('a', 0, 0, 12, 10, true), tile('b', 0, 200, 12, 10, true), tile('c', 12, 90, 12, 5, true)]);
    expect(ts.map(t => t.y)).toEqual([0, 10, 0]);
  });
});
