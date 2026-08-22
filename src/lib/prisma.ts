import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function getPrismaDatasourceUrl() {
  const directUrl = process.env.DIRECT_URL?.trim();
  if (directUrl) return directUrl;

  const databaseUrl = process.env.DATABASE_URL?.trim();
  if (!databaseUrl) return undefined;

  // The Neon project currently has the pooler disabled. If Vercel still has
  // the pooled DATABASE_URL configured, transparently use the read/write
  // endpoint instead so Prisma can wake the Neon compute normally.
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
