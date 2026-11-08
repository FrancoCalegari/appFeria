/**
 * Dimensiones físicas oficiales del predio de la "Feria de las Heras"
 * y de cada casilla/módulo comercial.
 */
export const FAIR_SURFACE = {
  areaM2: 10085, // 10,085 m²
  areaHa: 1.01, // 1.01 ha
  areaKm2: 0.01, // 0.01 km²
  areaFt2: 108554.04, // 108,554.04 ft²
  areaAcres: 2.49, // 2.49 ac
  perimeterM: 401.3, // 401.30 m
  perimeterKm: 0.4, // 0.40 km
  // Lados del predio (~100.30m x 100.55m => Área ~10,085 m², Perímetro ~401.30 m)
  widthM: 100.3,
  heightM: 100.55,
  // Dimensión habitual de cada casilla asignada: 1.5 a 2.0 metros de frente x 1.5 a 2.0 metros de fondo
  cellMinM: 1.5,
  cellMaxM: 2.0,
  cellNominalM: 2.0, // 2.0 m x 2.0 m = 4 m² por casilla
} as const;

export function formatStallMeters(wCells: number, hCells: number): string {
  const minW = (wCells * FAIR_SURFACE.cellMinM).toFixed(1).replace(/\.0$/, "");
  const maxW = (wCells * FAIR_SURFACE.cellMaxM).toFixed(1).replace(/\.0$/, "");
  const minH = (hCells * FAIR_SURFACE.cellMinM).toFixed(1).replace(/\.0$/, "");
  const maxH = (hCells * FAIR_SURFACE.cellMaxM).toFixed(1).replace(/\.0$/, "");
  const areaMin = (wCells * hCells * FAIR_SURFACE.cellMinM * FAIR_SURFACE.cellMinM)
    .toFixed(1)
    .replace(/\.0$/, "");
  const areaMax = (wCells * hCells * FAIR_SURFACE.cellMaxM * FAIR_SURFACE.cellMaxM)
    .toFixed(0);
  return `${minW}–${maxW}m × ${minH}–${maxH}m (${areaMin}–${areaMax} m²)`;
}

export interface CanvasPalette {
  fill: string;
  stroke: string;
  text: string;
  badgeFill: string;
  badgeText: string;
  emoji: string;
}

const CANVAS_PALETTES: Record<string, CanvasPalette> = {
  Verdulería: {
    fill: "#d1fae5",
    stroke: "#059669",
    text: "#064e3b",
    badgeFill: "#047857",
    badgeText: "#ffffff",
    emoji: "🥬",
  },
  Frutería: {
    fill: "#ffedd5",
    stroke: "#ea580c",
    text: "#7c2d12",
    badgeFill: "#c2410c",
    badgeText: "#ffffff",
    emoji: "🍎",
  },
  Carnicería: {
    fill: "#ffe4e6",
    stroke: "#e11d48",
    text: "#881337",
    badgeFill: "#be123c",
    badgeText: "#ffffff",
    emoji: "🥩",
  },
  Panadería: {
    fill: "#fef3c7",
    stroke: "#d97706",
    text: "#78350f",
    badgeFill: "#b45309",
    badgeText: "#ffffff",
    emoji: "🥖",
  },
  Despensa: {
    fill: "#e0f2fe",
    stroke: "#0284c7",
    text: "#0c4a6e",
    badgeFill: "#0369a1",
    badgeText: "#ffffff",
    emoji: "🛒",
  },
  Fiambrería: {
    fill: "#fef9c3",
    stroke: "#ca8a04",
    text: "#713f12",
    badgeFill: "#a16207",
    badgeText: "#ffffff",
    emoji: "🧀",
  },
  Granja: {
    fill: "#ecfccb",
    stroke: "#65a30d",
    text: "#365314",
    badgeFill: "#4d7c0f",
    badgeText: "#ffffff",
    emoji: "🥚",
  },
  Regionales: {
    fill: "#f3e8ff",
    stroke: "#9333ea",
    text: "#581c87",
    badgeFill: "#7e22ce",
    badgeText: "#ffffff",
    emoji: "🍯",
  },
  "Ropa y Calzado": {
    fill: "#e0e7ff",
    stroke: "#4f46e5",
    text: "#312e81",
    badgeFill: "#4338ca",
    badgeText: "#ffffff",
    emoji: "👕",
  },
};

const DEFAULT_CANVAS_PALETTE: CanvasPalette = {
  fill: "#ccfbf1",
  stroke: "#0d9488",
  text: "#134e4a",
  badgeFill: "#0f766e",
  badgeText: "#ffffff",
  emoji: "🏪",
};

export function getCanvasPalette(category: string): CanvasPalette {
  return CANVAS_PALETTES[category] || DEFAULT_CANVAS_PALETTE;
}

