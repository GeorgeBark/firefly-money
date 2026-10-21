/* The Overview's snap grid: tile sizes and how tiles settle so none overlap. No DOM here. */

/* Freeform tiles (wide screens): every card is a tile on a grid of 24 columns and 8px rows. You can drop it anywhere
   and drag its corner to make it wider or narrower; its height follows its content. Tiles never overlap: when one
   lands on or grows into another, the other moves down. Saved positions live in money.dash free {key: [x, y, w]};
   until you move something the tiles are packed tidily from the column arrangement. Phones keep the single column. */
export const GRID = 24, ROW = 8;
// Settle tiles so none overlap. `first` keeps its spot; the rest keep their order (top to bottom, left to right) and
// move down just far enough. A floating tile (not placed by you yet) first rises as high as it can.
export function gridSettle(ts, first?) {
  const order = [...ts].sort((a, b) => +(b.k === first) - +(a.k === first) || a.y - b.y || a.x - b.x), placed = [];
  for (const t of order) {
    if (t.float && t.k !== first) t.y = 0;
    for (let hit = true; hit;) {
      hit = false;
      for (const p of placed) if (t.x < p.x + p.w && p.x < t.x + t.w && t.y < p.y + p.h && p.y < t.y + t.h) { t.y = p.y + p.h; hit = true; }
    }
    placed.push(t);
  }
  return ts;
}
// Where a dragged tile lands: when its top edge is in the lower half of a tile it overlaps, it goes just below that
// tile instead of pushing it out of the way, so a tile has to be dragged past another's middle to swap with it.
export function gridDrop(ts, k) {
  const t = ts.find(x => x.k === k);
  if (t) for (let moved = true; moved;) {
    moved = false;
    for (const p of ts) if (p !== t && t.x < p.x + p.w && p.x < t.x + t.w && t.y > p.y + p.h / 2 && t.y < p.y + p.h) { t.y = p.y + p.h; moved = true; }
  }
  return gridSettle(ts, k);
}
// Snap a dragged position (in grid units) to steps of `step` with a dead zone: it moves on only once the pointer is
// well past the halfway point, so a few pixels of wobble don't make the other tiles jump back and forth.
export function snapStep(pos: number, cur: number, step: number, dead = 0.25) {
  const d = pos - cur;
  return Math.abs(d) < step * (0.5 + dead) ? cur : cur + Math.round(d / step) * step;
}
