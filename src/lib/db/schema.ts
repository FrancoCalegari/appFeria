export interface FairSettings {
  id: number;
  name: string;
  cols: number;
  rows: number;
  updated_at: string;
}

export interface User {
  id: number;
  email: string;
  password_hash?: string;
  name: string;
  role: "ADMIN" | "VENDOR";
  created_at: string;
}

export interface Product {
  id: number;
  stall_id: number;
  name: string;
  price: number;
  unit: string;
  in_stock: boolean;
  image_url: string | null;
}

export interface Stall {
  id: number;
  name: string;
  category: string;
  description: string;
  image_url: string | null;
  mp_aliases: string[];
  owner_id: number | null;
  owner_name?: string | null;
  owner_email?: string | null;
  x: number | null;
  y: number | null;
  w: number;
  h: number;
  products: Product[];
}

export interface MapCell {
  x: number;
  y: number;
  type: "PATH";
}

export interface FairState {
  settings: FairSettings;
  stalls: Stall[];
  pathCells: MapCell[];
  users?: User[];
}

export const DEFAULT_CATEGORIES = [
  "Verdulería",
  "Frutería",
  "Carnicería",
  "Panadería",
  "Despensa",
  "Fiambrería",
  "Granja",
  "Regionales",
  "Ropa y Calzado",
  "Varios",
] as const;

export const PRODUCT_UNITS = ["kg", "unidad", "atado", "docena", "100g", "litro"] as const;
