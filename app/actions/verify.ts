"use server";

import crypto from "node:crypto";
import { prisma } from "@/lib/db";
import { normalizePhone } from "@/lib/auth";
import { getT } from "@/lib/i18n";
import { createSession, newCode, verifyMode } from "@/lib/verify";
import { MAX_ATTEMPTS_PER_HOUR, refreshVerification } from "@/lib/services/phone";

export type VerifyStart =
  | { ok: true; id: string; code: string; shortcode: string; expiresAt: string; mock: boolean }
  | { ok: false; error: string };

export async function startPhoneVerification(rawPhone: string): Promise<VerifyStart> {
  const { t } = await getT();
  const phone = normalizePhone(rawPhone);
  if (!/^\d{8}$/.test(phone)) return { ok: false, error: t.errors.badPhone };
  if (await prisma.user.findUnique({ where: { phone } })) return { ok: false, error: t.errors.phoneTaken };

  const mode = verifyMode();
  if (mode === "off") return { ok: false, error: t.errors.verifyUnavailable };

  const recent = await prisma.phoneVerification.count({
    where: { phone, createdAt: { gte: new Date(Date.now() - 3600_000) } },
  });
  if (recent >= MAX_ATTEMPTS_PER_HOUR) return { ok: false, error: t.errors.tooManyVerify };

  const id = crypto.randomUUID();
  const code = newCode();
  // Callback нь зөвхөн HTTPS-ээр нийтэд нээлттэй үед (байршуулсны дараа) утга учиртай
  const appUrl = process.env.APP_URL;
  const callback = appUrl?.startsWith("https://") ? `${appUrl}/api/verify/callback?v=${id}` : undefined;

  let session;
  try {
    session = await createSession(phone, code, callback);
  } catch (e) {
    console.error("verify.mn createSession failed:", e);
    return { ok: false, error: t.errors.verifyUnavailable };
  }
  await prisma.phoneVerification.create({
    data: { id, phone, code: session.text, sessionId: session.sessionId, expiresAt: session.expiresAt },
  });
  return {
    ok: true,
    id,
    code: session.text,
    shortcode: session.shortcode,
    expiresAt: session.expiresAt.toISOString(),
    mock: mode === "mock",
  };
}

export async function checkPhoneVerification(id: string) {
  if (typeof id !== "string" || id.length > 64) return "EXPIRED" as const;
  return refreshVerification(id);
}
