import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { uploadFile } from "@/lib/storage";

export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  try {
    const formData = await request.formData();
    const file = formData.get("file");
    const folder = String(formData.get("folder") || "feria");

    if (!file || !(file instanceof File)) {
      return NextResponse.json({ error: "No se adjuntó ningún archivo." }, { status: 400 });
    }

    const result = await uploadFile(file, folder);
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Error al subir imagen" },
      { status: 500 }
    );
  }
}

