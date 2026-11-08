import { DatabaseSync } from "node:sqlite";
import { hashPassword } from "../auth";
import type { FairSettings, FairState, MapCell, Product, Stall, User } from "./schema";

const dbUrl = process.env.DATABASE_URL || "./feria.db";

const globalForDb = globalThis as unknown as {
  sqlite?: DatabaseSync;
  initialized?: boolean;
};

export const sqlite = globalForDb.sqlite ?? new DatabaseSync(dbUrl);

if (process.env.NODE_ENV !== "production") {
  globalForDb.sqlite = sqlite;
}

export function ensureInitialized() {
  if (globalForDb.initialized) return;

  sqlite.exec("PRAGMA journal_mode = WAL;");
  sqlite.exec("PRAGMA foreign_keys = ON;");

  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS fair_settings (
      id INTEGER PRIMARY KEY,
      name TEXT NOT NULL DEFAULT 'Feria de las Heras',
      cols INTEGER NOT NULL DEFAULT 7,
      rows INTEGER NOT NULL DEFAULT 21,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      name TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'VENDOR',
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS stalls (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      category TEXT NOT NULL DEFAULT 'Verdulería',
      description TEXT NOT NULL DEFAULT '',
      image_url TEXT,
      mp_aliases TEXT NOT NULL DEFAULT '[]',
      owner_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      x INTEGER,
      y INTEGER,
      w INTEGER NOT NULL DEFAULT 1,
      h INTEGER NOT NULL DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS map_cells (
      x INTEGER NOT NULL,
      y INTEGER NOT NULL,
      type TEXT NOT NULL DEFAULT 'PATH',
      PRIMARY KEY (x, y)
    );

    CREATE TABLE IF NOT EXISTS products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      stall_id INTEGER NOT NULL REFERENCES stalls(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      price REAL NOT NULL,
      unit TEXT NOT NULL DEFAULT 'kg',
      in_stock INTEGER NOT NULL DEFAULT 1,
      image_url TEXT
    );
  `);

  const existing = sqlite
    .prepare("SELECT COUNT(*) as count FROM fair_settings")
    .get() as { count: number };

  if (existing.count === 0) {
    seedInitialData();
  }

  globalForDb.initialized = true;
}

export function runTransaction<T>(fn: () => T): T {
  sqlite.exec("BEGIN IMMEDIATE");
  try {
    const result = fn();
    sqlite.exec("COMMIT");
    return result;
  } catch (err) {
    sqlite.exec("ROLLBACK");
    throw err;
  }
}

export function seedInitialData() {
  const now = new Date().toISOString();

  const insertSetting = sqlite.prepare(`
    INSERT INTO fair_settings (id, name, cols, rows, updated_at)
    VALUES (1, 'Feria de las Heras', 7, 21, ?)
  `);

  const insertUser = sqlite.prepare(`
    INSERT INTO users (email, password_hash, name, role, created_at)
    VALUES (?, ?, ?, ?, ?)
  `);

  const insertStall = sqlite.prepare(`
    INSERT INTO stalls (name, category, description, mp_aliases, owner_id, x, y, w, h)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const insertPath = sqlite.prepare(`
    INSERT OR IGNORE INTO map_cells (x, y, type)
    VALUES (?, ?, 'PATH')
  `);

  const insertProduct = sqlite.prepare(`
    INSERT INTO products (stall_id, name, price, unit, in_stock)
    VALUES (?, ?, ?, ?, ?)
  `);

  runTransaction(() => {
    insertSetting.run(now);

    insertUser.run(
      "admin@feria.com",
      hashPassword("admin123"),
      "Administración Feria de las Heras",
      "ADMIN",
      now
    );
    const vendor1Info = insertUser.run(
      "puestero1@feria.com",
      hashPassword("puesto123"),
      "Roberto Gómez (El Choclo de Oro)",
      "VENDOR",
      now
    );
    const vendor2Info = insertUser.run(
      "puestero2@feria.com",
      hashPassword("puesto123"),
      "Carla Méndez (Frutería Los Andes)",
      "VENDOR",
      now
    );

    const v1Id = Number(vendor1Info.lastInsertRowid);
    const v2Id = Number(vendor2Info.lastInsertRowid);

    // Caminos peatonales: Pasillo central columna 4 (filas 1 a 21) y pasillos transversales en filas 1, 11 y 21
    for (let y = 1; y <= 21; y++) {
      insertPath.run(4, y);
    }
    for (let x = 1; x <= 7; x++) {
      insertPath.run(x, 1);
      insertPath.run(x, 11);
      insertPath.run(x, 21);
    }

    const s1 = Number(
      insertStall.run(
        "Verdulería El Choclo de Oro",
        "Verdulería",
        "Verduras frescas de chacra todos los días. Venta por mayor y menor.",
        JSON.stringify(["choclo.oro.mp", "roberto.feria.mp"]),
        v1Id,
        1,
        2,
        3,
        2
      ).lastInsertRowid
    );

    const s2 = Number(
      insertStall.run(
        "Frutería Los Andes",
        "Frutería",
        "Frutas de estación seleccionadas del Valle de Uco y Río Negro.",
        JSON.stringify(["fruteria.losandes.mp", "carla.frutas.mp"]),
        v2Id,
        5,
        2,
        3,
        2
      ).lastInsertRowid
    );

    const s3 = Number(
      insertStall.run(
        "Hortalizas Don José",
        "Verdulería",
        "Especialidad en hojas verdes, papas, cebollas y zapallos.",
        JSON.stringify(["donjose.verduras.mp"]),
        v1Id,
        2,
        5,
        2,
        3
      ).lastInsertRowid
    );

    const s4 = Number(
      insertStall.run(
        "Panadería La Espiga",
        "Panadería",
        "Tortitas mendocinas recién horneadas, pan casero y facturas.",
        JSON.stringify(["panaderia.espiga.mp", "espiga.caja2.mp"]),
        null,
        5,
        5,
        2,
        2
      ).lastInsertRowid
    );

    const s5 = Number(
      insertStall.run(
        "Condimentos y Frutos Secos El Sol",
        "Despensa",
        "Especias por peso, nueces, almendras, pasas y legumbres.",
        JSON.stringify(["especias.elsol.mp"]),
        null,
        1,
        9,
        2,
        2
      ).lastInsertRowid
    );

    const s6 = Number(
      insertStall.run(
        "Avícola y Huevos San Martín",
        "Granja",
        "Maples de huevos caseros de campo y pollo fresco.",
        JSON.stringify(["huevos.sanmartin.mp", "granja.las.heras.mp"]),
        null,
        3,
        9,
        1,
        2
      ).lastInsertRowid
    );

    const s7 = Number(
      insertStall.run(
        "Carnicería El Buen Corte",
        "Carnicería",
        "Cortes de novillo, cerdo y embutidos artesanales.",
        JSON.stringify(["carnes.buencorte.mp", "buencorte.feria.mp"]),
        null,
        1,
        12,
        3,
        3
      ).lastInsertRowid
    );

    const s8 = Number(
      insertStall.run(
        "Huerta Verde Orgánica",
        "Verdulería",
        "Verduras agroecológicas sin agroquímicos directo del productor.",
        JSON.stringify(["huerta.verde.mp"]),
        v2Id,
        5,
        12,
        2,
        3
      ).lastInsertRowid
    );

    const s9 = Number(
      insertStall.run(
        "Quesos y Fiambres Valle de Uco",
        "Fiambrería",
        "Quesos criollos, sardo, mozzarella, salames y aceitunas.",
        JSON.stringify(["fiambres.valleuco.mp", "quesos.uco.mp"]),
        null,
        5,
        16,
        3,
        2
      ).lastInsertRowid
    );

    const s10 = Number(
      insertStall.run(
        "Miel y Regionales Cuyo",
        "Regionales",
        "Miel pura de abeja, dulces artesanales y aceite de oliva.",
        JSON.stringify(["miel.cuyo.mp"]),
        null,
        3,
        16,
        1,
        1
      ).lastInsertRowid
    );

    const s11 = Number(
      insertStall.run(
        "Despensa Doña Rosa",
        "Despensa",
        "Harinas, yerba, azúcar, fideos y conservas al mejor precio.",
        JSON.stringify(["donarosa.despensa.mp"]),
        null,
        null,
        null,
        2,
        1
      ).lastInsertRowid
    );

    const initialProducts: Array<[number, string, number, string, number]> = [
      [s1, "Papa negra seleccionada", 950, "kg", 1],
      [s1, "Tomate perita", 1800, "kg", 1],
      [s1, "Cebolla blanca", 1100, "kg", 1],
      [s1, "Choclo dulce", 600, "unidad", 1],
      [s1, "Pimiento rojo", 2900, "kg", 1],

      [s2, "Manzana Roja Deliciosa", 2200, "kg", 1],
      [s2, "Banana Ecuador", 2100, "kg", 1],
      [s2, "Naranja de jugo", 1400, "kg", 1],
      [s2, "Mandarina criolla", 1500, "kg", 1],
      [s2, "Frutilla fresca", 4200, "kg", 1],

      [s3, "Lechuga mantecosa", 1300, "kg", 1],
      [s3, "Acelga fresca", 900, "atado", 1],
      [s3, "Espinaca", 1000, "atado", 1],
      [s3, "Zapallo anco", 1050, "kg", 1],
      [s3, "Zanahoria", 1150, "kg", 1],

      [s4, "Tortitas mendocinas (raspadas/pinchadas)", 2400, "docena", 1],
      [s4, "Pan casero de campo", 1800, "kg", 1],
      [s4, "Facturas surtidas", 4200, "docena", 1],

      [s5, "Nuez mariposa extra light", 1650, "100g", 1],
      [s5, "Almendras peladas", 1900, "100g", 1],
      [s5, "Orégano mendocino", 650, "100g", 1],
      [s5, "Pimentón dulce extra", 700, "100g", 1],

      [s6, "Maple de 30 huevos grandes", 5200, "unidad", 1],
      [s6, "Docena de huevos de campo", 2600, "docena", 1],
      [s6, "Pollo entero fresco", 3400, "kg", 1],

      [s7, "Asado de novillo", 8900, "kg", 1],
      [s7, "Carne molida especial", 6800, "kg", 1],
      [s7, "Chorizo puro cerdo", 6200, "kg", 1],
      [s7, "Milanesas de nalga preparadas", 7900, "kg", 1],

      [s8, "Tomate reliquia agroecológico", 2300, "kg", 1],
      [s8, "Rúcula orgánica", 850, "atado", 1],
      [s8, "Kale / Col rizada", 1100, "atado", 1],
      [s8, "Remolacha con hoja", 1200, "atado", 1],

      [s9, "Queso cremoso", 6900, "kg", 1],
      [s9, "Jamón cocido natural", 1150, "100g", 1],
      [s9, "Salame tipo colonia", 1250, "100g", 1],
      [s9, "Aceitunas verdes rellenas", 5400, "kg", 1],

      [s10, "Miel pura de flores 1kg", 5800, "unidad", 1],
      [s10, "Aceite de oliva virgen extra 500ml", 6900, "unidad", 1],
      [s10, "Dulce de membrillo casero", 3200, "kg", 1],

      [s11, "Yerba mate 1kg", 3600, "unidad", 1],
      [s11, "Aceite de girasol 1.5L", 2900, "unidad", 1],
    ];

    for (const [stallId, name, price, unit, inStock] of initialProducts) {
      insertProduct.run(stallId, name, price, unit, inStock);
    }
  });
}

export function getFairState(includeUsers = false): FairState {
  ensureInitialized();

  const rawSettings = sqlite
    .prepare("SELECT * FROM fair_settings WHERE id = 1")
    .get() as unknown as FairSettings;
  const settings: FairSettings = {
    id: Number(rawSettings.id),
    name: String(rawSettings.name),
    cols: Number(rawSettings.cols),
    rows: Number(rawSettings.rows),
    updated_at: String(rawSettings.updated_at),
  };

  const rawStalls = sqlite
    .prepare(`
      SELECT s.*, u.name as owner_name, u.email as owner_email
      FROM stalls s
      LEFT JOIN users u ON s.owner_id = u.id
      ORDER BY s.id ASC
    `)
    .all() as Array<Record<string, unknown>>;

  const rawProducts = sqlite
    .prepare("SELECT * FROM products ORDER BY id ASC")
    .all() as Array<Record<string, unknown>>;

  const productsByStall = new Map<number, Product[]>();
  for (const p of rawProducts) {
    const prod: Product = {
      id: Number(p.id),
      stall_id: Number(p.stall_id),
      name: String(p.name),
      price: Number(p.price),
      unit: String(p.unit),
      in_stock: Boolean(p.in_stock),
      image_url: p.image_url ? String(p.image_url) : null,
    };
    const list = productsByStall.get(prod.stall_id) ?? [];
    list.push(prod);
    productsByStall.set(prod.stall_id, list);
  }

  const stalls: Stall[] = rawStalls.map((s) => {
    let parsedAliases: string[] = [];
    try {
      parsedAliases = JSON.parse(String(s.mp_aliases || "[]"));
    } catch {
      parsedAliases = [];
    }
    const id = Number(s.id);
    return {
      id,
      name: String(s.name),
      category: String(s.category),
      description: String(s.description || ""),
      image_url: s.image_url ? String(s.image_url) : null,
      mp_aliases: Array.isArray(parsedAliases) ? parsedAliases : [],
      owner_id: s.owner_id !== null && s.owner_id !== undefined ? Number(s.owner_id) : null,
      owner_name: s.owner_name ? String(s.owner_name) : null,
      owner_email: s.owner_email ? String(s.owner_email) : null,
      x: s.x !== null && s.x !== undefined ? Number(s.x) : null,
      y: s.y !== null && s.y !== undefined ? Number(s.y) : null,
      w: Number(s.w || 1),
      h: Number(s.h || 1),
      products: productsByStall.get(id) ?? [],
    };
  });

  const pathCells = sqlite
    .prepare("SELECT x, y, type FROM map_cells WHERE type = 'PATH'")
    .all() as unknown as MapCell[];

  const result: FairState = {
    settings,
    stalls,
    pathCells: pathCells.map((c) => ({ x: Number(c.x), y: Number(c.y), type: "PATH" })),
  };

  if (includeUsers) {
    const rawUsers = sqlite
      .prepare("SELECT id, email, name, role, created_at FROM users ORDER BY id ASC")
      .all() as unknown as User[];
    result.users = rawUsers.map((u) => ({
      id: Number(u.id),
      email: String(u.email),
      name: String(u.name),
      role: u.role === "ADMIN" ? "ADMIN" : "VENDOR",
      created_at: String(u.created_at),
    }));
  }

  return result;
}

export function exportSqlDump(): string {
  ensureInitialized();
  const esc = (v: unknown) => {
    if (v === null || v === undefined) return "NULL";
    if (typeof v === "number") return String(v);
    if (typeof v === "boolean") return v ? "1" : "0";
    return `'${String(v).replace(/'/g, "''")}'`;
  };

  const lines: string[] = [
    "-- Exportación SQL estándar - SaaS Feria de las Heras",
    `-- Generado: ${new Date().toISOString()}`,
    "BEGIN TRANSACTION;",
    "",
    "CREATE TABLE IF NOT EXISTS fair_settings (id INTEGER PRIMARY KEY, name VARCHAR(255) NOT NULL, cols INTEGER NOT NULL, rows INTEGER NOT NULL, updated_at VARCHAR(64) NOT NULL);",
    "CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY, email VARCHAR(255) NOT NULL UNIQUE, password_hash VARCHAR(255) NOT NULL, name VARCHAR(255) NOT NULL, role VARCHAR(32) NOT NULL, created_at VARCHAR(64) NOT NULL);",
    "CREATE TABLE IF NOT EXISTS stalls (id INTEGER PRIMARY KEY, name VARCHAR(255) NOT NULL, category VARCHAR(100) NOT NULL, description TEXT NOT NULL, image_url TEXT, mp_aliases TEXT NOT NULL, owner_id INTEGER REFERENCES users(id), x INTEGER, y INTEGER, w INTEGER NOT NULL, h INTEGER NOT NULL);",
    "CREATE TABLE IF NOT EXISTS map_cells (x INTEGER NOT NULL, y INTEGER NOT NULL, type VARCHAR(32) NOT NULL, PRIMARY KEY (x, y));",
    "CREATE TABLE IF NOT EXISTS products (id INTEGER PRIMARY KEY, stall_id INTEGER NOT NULL REFERENCES stalls(id) ON DELETE CASCADE, name VARCHAR(255) NOT NULL, price DECIMAL(12,2) NOT NULL, unit VARCHAR(32) NOT NULL, in_stock INTEGER NOT NULL, image_url TEXT);",
    "",
  ];

  const tables = ["fair_settings", "users", "stalls", "map_cells", "products"];
  for (const table of tables) {
    const rows = sqlite.prepare(`SELECT * FROM ${table}`).all() as Record<string, unknown>[];
    for (const row of rows) {
      const cols = Object.keys(row).join(", ");
      const vals = Object.values(row).map(esc).join(", ");
      lines.push(`INSERT INTO ${table} (${cols}) VALUES (${vals});`);
    }
    lines.push("");
  }

  lines.push("COMMIT;");
  return lines.join("\n");
}
