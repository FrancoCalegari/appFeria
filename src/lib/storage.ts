import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";

export type StorageDriver = "local" | "cloud";

export interface UploadResult {
  url: string;
  driver: StorageDriver;
}

/**
 * Adaptador de almacenamiento preparado para exportar a Cloud Storage propio.
 * - En desarrollo (STORAGE_DRIVER=local): guarda en public/uploads/
 * - En producción (STORAGE_DRIVER=cloud): envía mediante HTTP POST/PUT al servicio Cloud Storage propio.
 */
export async function uploadFile(file: File, folder = "feria"): Promise<UploadResult> {
  const driver = (process.env.STORAGE_DRIVER || "local") as StorageDriver;
  const ext = path.extname(file.name || ".jpg").toLowerCase() || ".jpg";
  const safeExt = [".jpg", ".jpeg", ".png", ".webp", ".gif", ".avif"].includes(ext)
    ? ext
    : ".jpg";
  const fileName = `${folder}-${Date.now()}-${crypto.randomBytes(4).toString("hex")}${safeExt}`;

  if (driver === "cloud") {
    const cloudUrl = process.env.CLOUD_STORAGE_URL;
    const cloudKey = process.env.CLOUD_STORAGE_KEY;
    if (!cloudUrl) {
      throw new Error("CLOUD_STORAGE_URL no está configurado en las variables de entorno.");
    }

    const formData = new FormData();
    formData.append("file", file, fileName);
    formData.append("folder", folder);

    const response = await fetch(cloudUrl, {
      method: "POST",
      headers: cloudKey ? { Authorization: `Bearer ${cloudKey}` } : undefined,
      body: formData,
    });

    if (!response.ok) {
      throw new Error(`Error al subir al Cloud Storage (${response.status})`);
    }

    const data = (await response.json()) as { url: string };
    return { url: data.url, driver: "cloud" };
  }

  // Fallback local: guardar en public/uploads
  const buffer = Buffer.from(await file.arrayBuffer());
  const uploadDir = path.join(process.cwd(), "public", "uploads");
  await fs.mkdir(uploadDir, { recursive: true });
  const filePath = path.join(uploadDir, fileName);
  await fs.writeFile(filePath, buffer);

  return {
    url: `/uploads/${fileName}`,
    driver: "local",
  };
}

