import { NextResponse } from "next/server";
import { sqlite, ensureInitialized, getFairState } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import { validateStallPlacement } from "@/lib/grid";

function normalizeAliases(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((a) => String(a || "").trim())
    .filter((a) => a.length > 0);
}

export async function POST(request: Request) {
  ensureInitialized();
  const user = await getSessionUser();
  if (!user || user.role !== "ADMIN") {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const body = await request.json();
  const name = String(body.name || "").trim();
  const category = String(body.category || "Verdulería").trim();
  const description = String(body.description || "").trim();
  const imageUrl = body.image_url ? String(body.image_url) : null;
  const mpAliases = normalizeAliases(body.mp_aliases);
  const ownerId = body.owner_id ? Number(body.owner_id) : null;
  const x = body.x !== null && body.x !== undefined && body.x !== "" ? Number(body.x) : null;
  const y = body.y !== null && body.y !== undefined && body.y !== "" ? Number(body.y) : null;
  const w = Math.max(1, Number(body.w || 1));
  const h = Math.max(1, Number(body.h || 1));

  if (!name) {
    return NextResponse.json({ error: "El nombre del puesto es obligatorio." }, { status: 400 });
  }

  if (x !== null && y !== null) {
    const state = getFairState(false);
    const placedOthers = state.stalls
      .filter((s) => s.x !== null && s.y !== null)
      .map((s) => ({ id: s.id, x: s.x!, y: s.y!, w: s.w, h: s.h }));
    const check = validateStallPlacement(
      { x, y, w, h },
      placedOthers,
      state.pathCells,
      state.settings.cols,
      state.settings.rows
    );
    if (!check.valid) {
      return NextResponse.json({ error: check.reason }, { status: 400 });
    }
  }

  const info = sqlite
    .prepare(
      `INSERT INTO stalls (name, category, description, image_url, mp_aliases, owner_id, x, y, w, h)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      name,
      category,
      description,
      imageUrl,
      JSON.stringify(mpAliases),
      ownerId,
      x,
      y,
      w,
      h
    );

  return NextResponse.json({
    id: Number(info.lastInsertRowid),
    state: getFairState(true),
  });
}

export async function PUT(request: Request) {
  ensureInitialized();
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Debes iniciar sesión." }, { status: 401 });
  }

  const body = await request.json();
  const stallId = Number(body.id);
  const existing = sqlite
    .prepare("SELECT * FROM stalls WHERE id = ?")
    .get(stallId) as Record<string, unknown> | undefined;

  if (!existing) {
    return NextResponse.json({ error: "Puesto no encontrado." }, { status: 404 });
  }

  if (user.role !== "ADMIN" && Number(existing.owner_id) !== user.id) {
    return NextResponse.json(
      { error: "No tienes permiso para modificar este puesto." },
      { status: 403 }
    );
  }

  const name = String(body.name ?? existing.name).trim();
  const category = String(body.category ?? existing.category).trim();
  const description = String(body.description ?? existing.description).trim();
  const imageUrl =
    body.image_url !== undefined
      ? body.image_url
        ? String(body.image_url)
        : null
      : existing.image_url
        ? String(existing.image_url)
        : null;

  const mpAliases =
    body.mp_aliases !== undefined
      ? normalizeAliases(body.mp_aliases)
      : JSON.parse(String(existing.mp_aliases || "[]"));

  // Solo ADMIN puede cambiar propietario o coordenadas del mapa
  const ownerId =
    user.role === "ADMIN" && body.owner_id !== undefined
      ? body.owner_id
        ? Number(body.owner_id)
        : null
      : existing.owner_id !== null
        ? Number(existing.owner_id)
        : null;

  const x =
    user.role === "ADMIN" && body.x !== undefined
      ? body.x !== null && body.x !== ""
        ? Number(body.x)
        : null
      : existing.x !== null
        ? Number(existing.x)
        : null;

  const y =
    user.role === "ADMIN" && body.y !== undefined
      ? body.y !== null && body.y !== ""
        ? Number(body.y)
        : null
      : existing.y !== null
        ? Number(existing.y)
        : null;

  const w =
    user.role === "ADMIN" && body.w !== undefined
      ? Math.max(1, Number(body.w || 1))
      : Number(existing.w || 1);

  const h =
    user.role === "ADMIN" && body.h !== undefined
      ? Math.max(1, Number(body.h || 1))
      : Number(existing.h || 1);

  if (user.role === "ADMIN" && x !== null && y !== null) {
    const state = getFairState(false);
    const placedOthers = state.stalls
      .filter((s) => s.id !== stallId && s.x !== null && s.y !== null)
      .map((s) => ({ id: s.id, x: s.x!, y: s.y!, w: s.w, h: s.h }));
    const check = validateStallPlacement(
      { id: stallId, x, y, w, h },
      placedOthers,
      state.pathCells,
      state.settings.cols,
      state.settings.rows
    );
    if (!check.valid) {
      return NextResponse.json({ error: check.reason }, { status: 400 });
    }
  }

  sqlite
    .prepare(
      `UPDATE stalls
       SET name = ?, category = ?, description = ?, image_url = ?, mp_aliases = ?,
           owner_id = ?, x = ?, y = ?, w = ?, h = ?
       WHERE id = ?`
    )
    .run(
      name,
      category,
      description,
      imageUrl,
      JSON.stringify(mpAliases),
      ownerId,
      x,
      y,
      w,
      h,
      stallId
    );

  return NextResponse.json({ state: getFairState(user.role === "ADMIN") });
}

export async function DELETE(request: Request) {
  ensureInitialized();
  const user = await getSessionUser();
  if (!user || user.role !== "ADMIN") {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const url = new URL(request.url);
  const id = Number(url.searchParams.get("id"));
  sqlite.prepare("DELETE FROM stalls WHERE id = ?").run(id);
  return NextResponse.json({ state: getFairState(true) });
}

