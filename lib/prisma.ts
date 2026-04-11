import { Pool } from "@neondatabase/serverless";
import { PrismaNeon } from "@prisma/adapter-neon";
import { PrismaClient } from "@prisma/client";

const globalForPrisma = global as unknown as { prisma: PrismaClient | undefined };

const connectionString = process.env.DATABASE_URL!;

export const prisma = (() => {
  if (globalForPrisma.prisma) {
    return globalForPrisma.prisma;
  }

  const pool = new Pool({ connectionString });
  const adapter = new PrismaNeon(pool as any);
  const client = new PrismaClient({
    adapter,
    log: ["query"],
  });

  if (process.env.NODE_ENV !== "production") {
    globalForPrisma.prisma = client;
  }

  return client;
})();

export const db = prisma;
