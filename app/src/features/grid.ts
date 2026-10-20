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
