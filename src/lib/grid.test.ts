import assert from "node:assert/strict";
import {
  isWithinBounds,
  rectsOverlap,
  rectHitsPath,
  validateStallPlacement,
  validateFullMap,
} from "./grid";

// 1. Bounds check on 7x21 default map
assert.equal(isWithinBounds({ x: 1, y: 1, w: 1, h: 1 }, 7, 21), true);
assert.equal(isWithinBounds({ x: 6, y: 20, w: 2, h: 2 }, 7, 21), true);
assert.equal(isWithinBounds({ x: 7, y: 21, w: 2, h: 1 }, 7, 21), false);
assert.equal(isWithinBounds({ x: 0, y: 1, w: 1, h: 1 }, 7, 21), false);

// 2. Multi-cell rectangle overlap
assert.equal(
  rectsOverlap({ x: 1, y: 1, w: 2, h: 3 }, { x: 2, y: 3, w: 2, h: 1 }),
  true
);
assert.equal(
  rectsOverlap({ x: 1, y: 1, w: 2, h: 3 }, { x: 3, y: 1, w: 1, h: 3 }),
  false
);

// 3. Path collision check
assert.equal(
  rectHitsPath({ x: 2, y: 2, w: 2, h: 2 }, [{ x: 3, y: 3 }]),
  true
);
assert.equal(
  rectHitsPath({ x: 2, y: 2, w: 2, h: 2 }, [{ x: 4, y: 2 }]),
  false
);

// 4. Full map validation
const validCheck = validateFullMap(
  [
    { id: 1, x: 1, y: 1, w: 2, h: 2 },
    { id: 2, x: 5, y: 1, w: 3, h: 1 },
  ],
  [
    { x: 4, y: 1 },
    { x: 4, y: 2 },
  ],
  7,
  21
);
assert.equal(validCheck.valid, true);

const invalidCheck = validateStallPlacement(
  { id: 3, x: 2, y: 2, w: 2, h: 2 },
  [{ id: 1, x: 1, y: 1, w: 2, h: 2 }],
  [],
  7,
  21
);
assert.equal(invalidCheck.valid, false);

console.log("OK: All grid layout and collision tests passed.");

