import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import sharp from "sharp";
import { requirePermission } from "@/lib/rbac";

const MAX_FILE_SIZE = 8 * 1024 * 1024;
const ALLOWED_TYPES = new Set(["image/png", "image/jpeg", "image/webp"]);
const ALLOWED_EXTENSIONS = new Set(["png", "jpg", "jpeg", "webp"]);

export async function POST(request: Request) {
  const access = await requirePermission("CASE_CREATE");
  if (!access.user) return access.response;

  const formData = await request.formData().catch(() => null);
  const file = formData?.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "Выберите изображение." }, { status: 400 });
  const extension = file.name.split(".").pop()?.toLowerCase() ?? "";
  if (!ALLOWED_TYPES.has(file.type) || !ALLOWED_EXTENSIONS.has(extension)) return NextResponse.json({ error: "Разрешены только PNG, JPG и WEBP." }, { status: 415 });
  if (file.size <= 0 || file.size > MAX_FILE_SIZE) return NextResponse.json({ error: "Размер изображения должен быть от 1 байта до 8 МБ." }, { status: 413 });

  try {
    const source = Buffer.from(await file.arrayBuffer());
    const metadata = await sharp(source).metadata();
    if (!metadata.width || !metadata.height || metadata.width > 6000 || metadata.height > 6000) return NextResponse.json({ error: "Некорректные размеры изображения." }, { status: 400 });
    const raw = await sharp(source).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    const background = { r: raw.data[0], g: raw.data[1], b: raw.data[2], alpha: 1 };

    const processed = await sharp(source)
      .trim({ background, threshold: 24 })
      .resize(1024, 1024, { fit: "inside", withoutEnlargement: true })
      .png({ compressionLevel: 9 })
      .toBuffer();
    const filename = `${randomUUID()}.png`;
    const directory = path.join(process.cwd(), "public", "uploads", "processed");
    await mkdir(directory, { recursive: true });
    await writeFile(path.join(directory, filename), processed, { flag: "wx" });
    return NextResponse.json({ imageUrl: `/uploads/processed/${filename}`, format: "PNG", processed: true });
  } catch {
    return NextResponse.json({ error: "Не удалось обработать изображение." }, { status: 422 });
  }
}