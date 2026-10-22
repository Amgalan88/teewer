// Утасны дугаар баталгаажуулалтын төлөвийг Verify.MN-ээс шалгаж хадгална.
import { prisma } from "../db";
import { getStatus, type VerifyStatus } from "../verify";

export const VERIFICATION_VALID_MINUTES = 60; // баталгаажсанаас хойш бүртгүүлэх хугацаа
export const MAX_ATTEMPTS_PER_HOUR = 5;

export async function refreshVerification(id: string): Promise<VerifyStatus> {
  const v = await prisma.phoneVerification.findUnique({ where: { id } });
  if (!v) return "EXPIRED";
  if (v.verifiedAt) return "VERIFIED";
  if (v.expiresAt <= new Date()) return "EXPIRED";

  let status: VerifyStatus;
  try {
    status = await getStatus(v.sessionId, v.createdAt);
  } catch {
    return "PENDING"; // түр алдаа: дараагийн шалгалтаар дахин оролдоно
  }
  if (status === "VERIFIED") {
    await prisma.phoneVerification.update({ where: { id }, data: { verifiedAt: new Date() } });
  }
  return status;
}

// Бүртгэлийн үед: дугаар таарч, баталгаажсан, ашиглагдаагүй, хугацаа дуусаагүй бол нэг удаа «зарцуулна»
export async function consumeVerification(id: string, phone: string) {
  const since = new Date(Date.now() - VERIFICATION_VALID_MINUTES * 60_000);
  const used = await prisma.phoneVerification.updateMany({
    where: { id, phone, verifiedAt: { not: null, gte: since }, usedAt: null },
    data: { usedAt: new Date() },
  });
  return used.count === 1;
}
