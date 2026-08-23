import { put } from "@vercel/blob";
import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import sharp from "sharp";
import { requirePermission } from "@/lib/rbac";

const MAX_FILE_SIZE = 12 * 1024 * 1024;
const ALLOWED_TYPES = new Set(["image/png", "image/jpeg", "image/webp", "application/octet-stream"]);
const ALLOWED_EXTENSIONS = new Set(["png", "jpg", "jpeg", "webp"]);
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function makeSafeFolder(value: string) {
  const latin = value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return latin || `case-${Date.now().toString(36)}`;
}

function getUploadError(error: unknown) {
  if (error instanceof Error) return error.message;
  return "Unknown upload error";
}

export async function POST(request: Request) {
  const access = await requirePermission("CASE_CREATE");
  if (!access.user) return access.response;

  const formData = await request.formData().catch(() => null);
  const file = formData?.get("file");
  const requestedFolder =
    typeof formData?.get("caseFolder") === "string"
      ? String(formData.get("caseFolder")).trim()
      : "";

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Выберите изображение." }, { status: 400 });
  }

  const extension = file.name.split(".").pop()?.toLowerCase() ?? "";
  const mimeAllowed = !file.type || ALLOWED_TYPES.has(file.type);

  if (!mimeAllowed || !ALLOWED_EXTENSIONS.has(extension)) {
    return NextResponse.json({ error: "Разрешены только PNG, JPG и WEBP." }, { status: 415 });
  }

  if (file.size <= 0 || file.size > MAX_FILE_SIZE) {
    return NextResponse.json(
      { error: "Размер изображения должен быть от 1 байта до 12 МБ." },
      { status: 413 },
    );
  }

  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    console.error("POST /api/admin/uploads: BLOB_READ_WRITE_TOKEN is missing");
    return NextResponse.json(
      { error: "Blob Storage не подключён: отсутствует BLOB_READ_WRITE_TOKEN в окружении Vercel." },
      { status: 500 },
    );
  }

  try {
    const source = Buffer.from(await file.arrayBuffer());
    let processed: Buffer;
    let processedSuccessfully = true;

    try {
      const metadata = await sharp(source, {
        failOn: "none",
        limitInputPixels: false,
      }).metadata();

      if (!metadata.width || !metadata.height) {
        return NextResponse.json(
          { error: "Файл не удалось распознать как изображение." },
          { status: 400 },
        );
      }

      processed = await sharp(source, {
        failOn: "none",
        limitInputPixels: false,
      })
        .rotate()
        .ensureAlpha()
        .resize(1024, 1024, {
          fit: "inside",
          withoutEnlargement: true,
        })
        .png({ compressionLevel: 9 })
        .toBuffer();

      if (!processed.length) throw new Error("empty image");
    } catch {
      processedSuccessfully = false;
      processed = source;
    }

    const folder = requestedFolder ? makeSafeFolder(requestedFolder) : "processed";
    const filename = `${randomUUID()}.${processedSuccessfully ? "png" : extension}`;
    const pathname = `cases/${folder}/${filename}`;

    const blob = await put(pathname, processed, {
      access: "public",
      addRandomSuffix: false,
      contentType: processedSuccessfully
        ? "image/png"
        : file.type || "application/octet-stream",
      cacheControlMaxAge: 60 * 60 * 24 * 365,
    });

    return NextResponse.json({
      imageUrl: blob.url,
      pathname: blob.pathname,
      format: processedSuccessfully ? "PNG" : extension.toUpperCase(),
      processed: processedSuccessfully,
      caseFolder: folder,
      message: processedSuccessfully
        ? "Изображение обработано и сохранено в постоянное хранилище."
        : "Изображение сохранено в постоянное хранилище без обработки.",
    });
  } catch (error) {
    const reason = getUploadError(error);
    console.error("POST /api/admin/uploads failed", { reason, error });

    return NextResponse.json(
      {
        error: `Не удалось сохранить изображение в Blob Storage: ${reason}`,
      },
      { status: 502 },
    );
  }
}
