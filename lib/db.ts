import { PrismaClient } from "@prisma/client";

// Зургийн байтыг (машин, жингийн тасалбар) анхдагчаар ачаалахгүй — зөвхөн зургийн API тодорхой авна
function createClient() {
  return new PrismaClient({ omit: { driver: { truckPhoto: true }, trip: { photo: true } } });
}

const globalForPrisma = globalThis as unknown as { prisma?: ReturnType<typeof createClient> };

export const prisma = globalForPrisma.prisma ?? createClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
