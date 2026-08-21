import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma = globalForPrisma.prisma ?? new PrismaClient();

globalForPrisma.prisma = prisma;

// Ensure Prisma tries to connect with retries on cold starts/serverless environments.
export async function ensurePrismaConnection(retries = 5, delayMs = 1000): Promise<void> {
  try {
    // $connect is safe to call even if already connected; Prisma will reuse the pool.
    await prisma.$connect();
  } catch (err) {
    if (retries <= 0) throw err;
    // eslint-disable-next-line no-console
    console.warn(`Prisma connection failed, retrying in ${delayMs}ms... (${retries} attempts left)`);
    await new Promise((res) => setTimeout(res, delayMs));
    return ensurePrismaConnection(retries - 1, Math.min(delayMs * 2, 5000));
  }
}
