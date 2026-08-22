import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function getPrismaDatasourceUrl() {
  const directUrl = process.env.DIRECT_URL?.trim();

  // DIRECT_URL may be left over from an older Neon configuration. Never let a
  // stale pooler URL override the current DATABASE_URL.
  if (directUrl && !directUrl.includes("-pooler.")) return directUrl;

  const databaseUrl = process.env.DATABASE_URL?.trim();
  if (!databaseUrl) return directUrl || undefined;

  // Prisma should use the Neon read/write endpoint here. If DATABASE_URL is a
  // pooled Neon URL, transparently switch it to the corresponding direct
  // endpoint and remove the PgBouncer parameter.
  try {
    const url = new URL(databaseUrl);
    url.hostname = url.hostname.replace("-pooler.", ".");
    url.searchParams.delete("pgbouncer");
    return url.toString();
  } catch {
    return databaseUrl.replace("-pooler.", ".");
  }
}

const datasourceUrl = getPrismaDatasourceUrl();

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient(datasourceUrl ? { datasourceUrl } : undefined);

globalForPrisma.prisma = prisma;
