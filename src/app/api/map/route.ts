import { NextResponse } from "next/server";
import { sqlite, ensureInitialized, getFairState, runTransaction, exportSqlDump } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import { validateFullMap, type GridPoint, type GridRect } from "@/lib/grid";

export async function GET(request: Request) {
  ensureInitialized();
  const url = new URL(request.url);
  const user = await getSessionUser();

  if (url.searchParams.get("export") === "sql") {
    if (!user || user.role !== "ADMIN") {
      return NextResponse.json({ error: "Solo administradores" }, { status: 403 });
    }
    const sqlDump = exportSqlDump();
    return new NextResponse(sqlDump, {
      headers: {
        "Content-Type": "application/sql; charset=utf-8",
        "Content-Disposition": 'attachment; filename="feria_las_heras_cloud.sql"',
      },
    });
  }

  const state = getFairState(user?.role === "ADMIN");
  return NextResponse.json(state);
}

export async function PUT(request: Request) {
  ensureInitialized();
  const user = await getSessionUser();
  if (!user || user.role !== "ADMIN") {
    return NextResponse.json({ error: "Solo el administrador puede editar el mapa." }, { status: 403 });
  }

  const body = await request.json();
  const cols = Number(body.cols || 7);
  const rows = Number(body.rows || 21);
  const name = String(body.name || "Feria de las Heras").trim();

  const pathCells: GridPoint[] = Array.isArray(body.pathCells)
    ? body.pathCells.map((c: { x: number; y: number }) => ({
        x: Number(c.x),
        y: Number(c.y),
      }))
    : [];

  const stallPositions: Array<{
    id: number;
    x: number | null;
    y: number | null;
    w: number;
    h: number;
  }> = Array.isArray(body.stalls) ? body.stalls : [];

  const placedStalls: GridRect[] = stallPositions
    .filter((s) => s.x !== null && s.y !== null)
    .map((s) => ({
      id: Number(s.id),
      x: Number(s.x),
      y: Number(s.y),
      w: Math.max(1, Number(s.w || 1)),
      h: Math.max(1, Number(s.h || 1)),
    }));

  const validation = validateFullMap(placedStalls, pathCells, cols, rows);
  if (!validation.valid) {
    return NextResponse.json({ error: validation.reason }, { status: 400 });
  }

  runTransaction(() => {
    sqlite
      .prepare("UPDATE fair_settings SET name = ?, cols = ?, rows = ?, updated_at = ? WHERE id = 1")
      .run(name, cols, rows, new Date().toISOString());

    sqlite.prepare("DELETE FROM map_cells").run();
    const insertPath = sqlite.prepare(
      "INSERT OR IGNORE INTO map_cells (x, y, type) VALUES (?, ?, 'PATH')"
    );
    for (const pt of pathCells) {
      insertPath.run(pt.x, pt.y);
    }

    const updateStallPos = sqlite.prepare(
      "UPDATE stalls SET x = ?, y = ?, w = ?, h = ? WHERE id = ?"
    );
    for (const s of stallPositions) {
      updateStallPos.run(
        s.x !== null && s.x !== undefined ? Number(s.x) : null,
        s.y !== null && s.y !== undefined ? Number(s.y) : null,
        Math.max(1, Number(s.w || 1)),
        Math.max(1, Number(s.h || 1)),
        Number(s.id)
      );
    }
  });

  return NextResponse.json(getFairState(true));
}

