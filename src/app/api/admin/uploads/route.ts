import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import sharp from "sharp";
import { requirePermission } from "@/lib/rbac";

const MAX_FILE_SIZE = 12 * 1024 * 1024;
const ALLOWED_TYPES = new Set(["image/png", "image/jpeg", "image/webp", "application/octet-stream"]);
const ALLOWED_EXTENSIONS = new Set(["png", "jpg", "jpeg", "webp"]);
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: Request) {
  const access = await requirePermission("CASE_CREATE");
  if (!access.user) return access.response;
  const formData = await request.formData().catch(() => null);
  const file = formData?.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "Выберите изображение." }, { status: 400 });
  const extension = file.name.split(".").pop()?.toLowerCase() ?? "";
  const mimeAllowed = !file.type || ALLOWED_TYPES.has(file.type);
  if (!mimeAllowed || !ALLOWED_EXTENSIONS.has(extension)) return NextResponse.json({ error: "Разрешены только PNG, JPG и WEBP." }, { status: 415 });
  if (file.size <= 0 || file.size > MAX_FILE_SIZE) return NextResponse.json({ error: "Размер изображения должен быть от 1 байта до 12 МБ." }, { status: 413 });
  try {
    const source = Buffer.from(await file.arrayBuffer());
    let processed: Buffer;
    let processedSuccessfully = true;
    try {
      const metadata = await sharp(source, { failOn: "none", limitInputPixels: false }).metadata();
      if (!metadata.width || !metadata.height) return NextResponse.json({ error: "Файл не удалось распознать как изображение." }, { status: 400 });
      processed = await sharp(source, { failOn: "none", limitInputPixels: false }).rotate().ensureAlpha().resize(1024, 1024, { fit: "inside", withoutEnlargement: true }).png({ compressionLevel: 9 }).toBuffer();
      if (!processed.length) throw new Error("empty image");
    } catch {
      processedSuccessfully = false;
      processed = source;
    }
    const filename = `${randomUUID()}.${processedSuccessfully ? "png" : extension}`;
    const directory = path.join(process.cwd(), "public", "uploads", "processed");
    await mkdir(directory, { recursive: true });
    await writeFile(path.join(directory, filename), processed, { flag: "wx" });
    return NextResponse.json({ imageUrl: `/uploads/processed/${filename}`, format: processedSuccessfully ? "PNG" : extension.toUpperCase(), processed: processedSuccessfully, message: processedSuccessfully ? "Изображение обработано и сохранено." : "Изображение сохранено без обработки." });
  } catch (error) {
    console.error("POST /api/admin/uploads failed", error);
    return NextResponse.json({ error: "Не удалось сохранить изображение. Проверьте файл и попробуйте ещё раз." }, { status: 422 });
  }
}
