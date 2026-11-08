export interface GridRect {
  id?: number;
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface GridPoint {
  x: number;
  y: number;
}

export function isWithinBounds(rect: GridRect, cols: number, rows: number): boolean {
  if (
    !Number.isInteger(rect.x) ||
    !Number.isInteger(rect.y) ||
    !Number.isInteger(rect.w) ||
    !Number.isInteger(rect.h)
  ) {
    return false;
  }
  if (rect.w < 1 || rect.h < 1 || rect.x < 1 || rect.y < 1) {
    return false;
  }
  return rect.x + rect.w - 1 <= cols && rect.y + rect.h - 1 <= rows;
}

export function rectsOverlap(a: GridRect, b: GridRect): boolean {
  return (
    a.x < b.x + b.w &&
    a.x + a.w > b.x &&
    a.y < b.y + b.h &&
    a.y + a.h > b.y
  );
}

export function pointInRect(pt: GridPoint, rect: GridRect): boolean {
  return (
    pt.x >= rect.x &&
    pt.x < rect.x + rect.w &&
    pt.y >= rect.y &&
    pt.y < rect.y + rect.h
  );
}

export function rectHitsPath(rect: GridRect, pathCells: GridPoint[]): boolean {
  return pathCells.some((cell) => pointInRect(cell, rect));
}

export function validateStallPlacement(
  candidate: GridRect,
  otherStalls: GridRect[],
  pathCells: GridPoint[],
  cols: number,
  rows: number
): { valid: boolean; reason?: string } {
  if (!isWithinBounds(candidate, cols, rows)) {
    return {
      valid: false,
      reason: `El puesto (${candidate.x},${candidate.y} de ${candidate.w}×${candidate.h}) excede los límites del mapa (${cols}×${rows}).`,
    };
  }

  for (const other of otherStalls) {
    if (candidate.id !== undefined && other.id === candidate.id) continue;
    if (rectsOverlap(candidate, other)) {
      return {
        valid: false,
        reason: "El puesto se superpone con otro puesto en el mapa.",
      };
    }
  }

  if (rectHitsPath(candidate, pathCells)) {
    return {
      valid: false,
      reason: "El puesto no puede ubicarse sobre una casilla marcada como camino.",
    };
  }

  return { valid: true };
}

export function validateFullMap(
  placedStalls: GridRect[],
  pathCells: GridPoint[],
  cols: number,
  rows: number
): { valid: boolean; reason?: string } {
  if (cols < 1 || cols > 300 || rows < 1 || rows > 300) {
    return { valid: false, reason: "Dimensiones del mapa inválidas (máx 300×300)." };
  }

  for (const pt of pathCells) {
    if (pt.x < 1 || pt.x > cols || pt.y < 1 || pt.y > rows) {
      return {
        valid: false,
        reason: `Camino en (${pt.x}, ${pt.y}) fuera de los límites (${cols}×${rows}).`,
      };
    }
  }

  for (let i = 0; i < placedStalls.length; i++) {
    const check = validateStallPlacement(
      placedStalls[i],
      placedStalls.filter((_, idx) => idx !== i),
      pathCells,
      cols,
      rows
    );
    if (!check.valid) return check;
  }

  return { valid: true };
}

