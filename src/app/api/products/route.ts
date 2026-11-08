import { NextResponse } from "next/server";
import { sqlite, ensureInitialized, getFairState } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";

function canManageStall(userId: number, role: string, stallId: number): boolean {
  if (role === "ADMIN") return true;
  const stall = sqlite
    .prepare("SELECT owner_id FROM stalls WHERE id = ?")
    .get(stallId) as { owner_id: number | null } | undefined;
  return Boolean(stall && Number(stall.owner_id) === userId);
}

export async function POST(request: Request) {
  ensureInitialized();
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  const body = await request.json();
  const stallId = Number(body.stall_id);
  if (!canManageStall(user.id, user.role, stallId)) {
    return NextResponse.json({ error: "Sin permisos sobre este puesto" }, { status: 403 });
  }

  const name = String(body.name || "").trim();
  const price = Number(body.price || 0);
  const unit = String(body.unit || "kg").trim();
  const inStock = body.in_stock === false ? 0 : 1;
  const imageUrl = body.image_url ? String(body.image_url) : null;

  if (!name || Number.isNaN(price) || price < 0) {
    return NextResponse.json(
      { error: "Ingresa un nombre válido y un precio mayor o igual a 0." },
      { status: 400 }
    );
  }

  sqlite
    .prepare(
      `INSERT INTO products (stall_id, name, price, unit, in_stock, image_url)
       VALUES (?, ?, ?, ?, ?, ?)`
    )
    .run(stallId, name, price, unit, inStock, imageUrl);

  return NextResponse.json({ state: getFairState(user.role === "ADMIN") });
}

export async function PUT(request: Request) {
  ensureInitialized();
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  const body = await request.json();
  const prodId = Number(body.id);
  const existing = sqlite
    .prepare("SELECT * FROM products WHERE id = ?")
    .get(prodId) as Record<string, unknown> | undefined;

  if (!existing) {
    return NextResponse.json({ error: "Producto no encontrado" }, { status: 404 });
  }

  const stallId = Number(existing.stall_id);
  if (!canManageStall(user.id, user.role, stallId)) {
    return NextResponse.json({ error: "Sin permisos sobre este puesto" }, { status: 403 });
  }

  const name = String(body.name ?? existing.name).trim();
  const price = Number(body.price ?? existing.price);
  const unit = String(body.unit ?? existing.unit).trim();
  const inStock =
    body.in_stock !== undefined ? (body.in_stock ? 1 : 0) : Number(existing.in_stock);
  const imageUrl =
    body.image_url !== undefined
      ? body.image_url
        ? String(body.image_url)
        : null
      : existing.image_url
        ? String(existing.image_url)
        : null;

  sqlite
    .prepare(
      `UPDATE products
       SET name = ?, price = ?, unit = ?, in_stock = ?, image_url = ?
       WHERE id = ?`
    )
    .run(name, price, unit, inStock, imageUrl, prodId);

  return NextResponse.json({ state: getFairState(user.role === "ADMIN") });
}

export async function DELETE(request: Request) {
  ensureInitialized();
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  const url = new URL(request.url);
  const prodId = Number(url.searchParams.get("id"));
  const existing = sqlite
    .prepare("SELECT stall_id FROM products WHERE id = ?")
    .get(prodId) as { stall_id: number } | undefined;

  if (!existing) {
    return NextResponse.json({ error: "Producto no encontrado" }, { status: 404 });
  }

  if (!canManageStall(user.id, user.role, Number(existing.stall_id))) {
    return NextResponse.json({ error: "Sin permisos" }, { status: 403 });
  }

  sqlite.prepare("DELETE FROM products WHERE id = ?").run(prodId);
  return NextResponse.json({ state: getFairState(user.role === "ADMIN") });
}

