export interface CategoryStyle {
  bg: string;
  border: string;
  text: string;
  badge: string;
  emoji: string;
}

const STYLES: Record<string, CategoryStyle> = {
  Verdulería: {
    bg: "bg-emerald-100 hover:bg-emerald-200/90",
    border: "border-emerald-600",
    text: "text-emerald-950",
    badge: "bg-emerald-700 text-white",
    emoji: "🥬",
  },
  Frutería: {
    bg: "bg-orange-100 hover:bg-orange-200/90",
    border: "border-orange-500",
    text: "text-orange-950",
    badge: "bg-orange-600 text-white",
    emoji: "🍎",
  },
  Carnicería: {
    bg: "bg-rose-100 hover:bg-rose-200/90",
    border: "border-rose-600",
    text: "text-rose-950",
    badge: "bg-rose-700 text-white",
    emoji: "🥩",
  },
  Panadería: {
    bg: "bg-amber-100 hover:bg-amber-200/90",
    border: "border-amber-600",
    text: "text-amber-950",
    badge: "bg-amber-700 text-white",
    emoji: "🥖",
  },
  Despensa: {
    bg: "bg-sky-100 hover:bg-sky-200/90",
    border: "border-sky-600",
    text: "text-sky-950",
    badge: "bg-sky-700 text-white",
    emoji: "🛒",
  },
  Fiambrería: {
    bg: "bg-yellow-100 hover:bg-yellow-200/90",
    border: "border-yellow-600",
    text: "text-yellow-950",
    badge: "bg-yellow-700 text-white",
    emoji: "🧀",
  },
  Granja: {
    bg: "bg-lime-100 hover:bg-lime-200/90",
    border: "border-lime-600",
    text: "text-lime-950",
    badge: "bg-lime-700 text-white",
    emoji: "🥚",
  },
  Regionales: {
    bg: "bg-purple-100 hover:bg-purple-200/90",
    border: "border-purple-600",
    text: "text-purple-950",
    badge: "bg-purple-700 text-white",
    emoji: "🍯",
  },
  "Ropa y Calzado": {
    bg: "bg-indigo-100 hover:bg-indigo-200/90",
    border: "border-indigo-600",
    text: "text-indigo-950",
    badge: "bg-indigo-700 text-white",
    emoji: "👕",
  },
};

const DEFAULT_STYLE: CategoryStyle = {
  bg: "bg-teal-100 hover:bg-teal-200/90",
  border: "border-teal-600",
  text: "text-teal-950",
  badge: "bg-teal-700 text-white",
  emoji: "🏪",
};

export function getCategoryStyle(category: string): CategoryStyle {
  return STYLES[category] || DEFAULT_STYLE;
}

export function formatARS(amount: number): string {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 0,
  }).format(amount);
}

