import { promises as fs } from "node:fs";
import path from "node:path";
import { NextResponse } from "next/server";
import sharp from "sharp";

export const runtime = "nodejs";

const PUBLIC_SKINS_DIR = path.resolve(process.cwd(), "public", "skins");
const MAX_WIDTH = 512;

function resolveSkinPath(src: string): string | null {
  if (!src.startsWith("/skins/") || src.includes("\\") || src.includes("..")) return null;

  const candidate = path.resolve(process.cwd(), "public", src.slice(1));
  if (candidate !== PUBLIC_SKINS_DIR && !candidate.startsWith(`${PUBLIC_SKINS_DIR}${path.sep}`)) return null;
  return candidate;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const src = url.searchParams.get("src") ?? "";
  const requestedWidth = Number(url.searchParams.get("w") ?? MAX_WIDTH);
  const width = Number.isFinite(requestedWidth)
    ? Math.min(MAX_WIDTH, Math.max(64, Math.round(requestedWidth)))
    : MAX_WIDTH;

  const filePath = resolveSkinPath(src);
  if (!filePath) {
    return NextResponse.json({ error: "Invalid skin path" }, { status: 400 });
  }

  try {
    const input = await fs.readFile(filePath);
    const output = await sharp(input)
      .resize({ width, withoutEnlargement: true })
      .webp({ quality: 88, effort: 4 })
      .toBuffer();

    return new NextResponse(output as BodyInit, {
      headers: {
        "Content-Type": "image/webp",
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch {
    return NextResponse.json({ error: "Skin image not found" }, { status: 404 });
  }
}
