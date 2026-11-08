import { NextResponse } from "next/server";
import { sqlite, ensureInitialized } from "@/lib/db";
import {
  encodeSession,
  getSessionUser,
  hashPassword,
  SESSION_COOKIE_NAME,
  type SessionUser,
} from "@/lib/auth";

export async function GET() {
  ensureInitialized();
  const user = await getSessionUser();
  return NextResponse.json({ user });
}

export async function POST(request: Request) {
  ensureInitialized();
  const body = await request.json();

  if (body.action === "logout") {
    const res = NextResponse.json({ ok: true });
    res.cookies.delete(SESSION_COOKIE_NAME);
    return res;
  }

  if (body.action === "create_user") {
    const current = await getSessionUser();
    if (!current || current.role !== "ADMIN") {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }
    const email = String(body.email || "").trim().toLowerCase();
    const name = String(body.name || "").trim();
    const password = String(body.password || "");
    const role = body.role === "ADMIN" ? "ADMIN" : "VENDOR";

    if (!email || !name || password.length < 4) {
      return NextResponse.json(
        { error: "Completa nombre, email y contraseña (mín. 4 caracteres)." },
        { status: 400 }
      );
    }

    try {
      const info = sqlite
        .prepare(
          "INSERT INTO users (email, password_hash, name, role, created_at) VALUES (?, ?, ?, ?, ?)"
        )
        .run(email, hashPassword(password), name, role, new Date().toISOString());

      return NextResponse.json({
        user: { id: Number(info.lastInsertRowid), email, name, role },
      });
    } catch {
      return NextResponse.json(
        { error: "Ese correo electrónico ya está registrado." },
        { status: 400 }
      );
    }
  }

  if (body.action === "delete_user") {
    const current = await getSessionUser();
    if (!current || current.role !== "ADMIN") {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }
    const targetId = Number(body.id);
    if (targetId === current.id) {
      return NextResponse.json(
        { error: "No puedes eliminar tu propio usuario activo." },
        { status: 400 }
      );
    }
    sqlite.prepare("DELETE FROM users WHERE id = ?").run(targetId);
    return NextResponse.json({ ok: true });
  }

  // Default: login
  const email = String(body.email || "").trim().toLowerCase();
  const password = String(body.password || "");

  const row = sqlite
    .prepare("SELECT id, email, name, role, password_hash FROM users WHERE lower(email) = ?")
    .get(email) as
    | { id: number; email: string; name: string; role: "ADMIN" | "VENDOR"; password_hash: string }
    | undefined;

  if (!row || row.password_hash !== hashPassword(password)) {
    return NextResponse.json(
      { error: "Credenciales inválidas. Verifica tu correo y contraseña." },
      { status: 401 }
    );
  }

  const sessionUser: SessionUser = {
    id: Number(row.id),
    email: row.email,
    name: row.name,
    role: row.role,
  };

  const token = encodeSession(sessionUser);
  const res = NextResponse.json({ user: sessionUser });
  res.cookies.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });
  return res;
}

