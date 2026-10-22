"use server";

import bcrypt from "bcryptjs";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { getUser, homeFor, normalizePhone, normalizePlate } from "@/lib/auth";
import { createSession, destroySession } from "@/lib/session";
import { consumeVerification } from "@/lib/services/phone";
import { getT, isLang } from "@/lib/i18n";
import { BANKS, MAX_PHOTO_BYTES, PHOTO_TYPES, type BankCode } from "@/lib/constants";
import type { ActionState } from "./types";

export async function login(_: ActionState, fd: FormData): Promise<ActionState> {
  const { t } = await getT();
  const phone = normalizePhone(String(fd.get("phone") ?? ""));
  const password = String(fd.get("password") ?? "");
  const user = await prisma.user.findUnique({ where: { phone } });
  if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
    return { error: t.errors.badLogin };
  }
  await createSession(user.id);
  redirect(homeFor(user.role));
}

export async function logout() {
  await destroySession();
  redirect("/");
}

export async function setLang(fd: FormData) {
  const lang = fd.get("lang");
  if (!isLang(lang)) return;
  (await cookies()).set("lang", lang, { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax" });
  const user = await getUser();
  if (user) await prisma.user.update({ where: { id: user.id }, data: { lang } });
  revalidatePath("/", "layout");
}

const base = {
  phone: z.string().transform(normalizePhone).pipe(z.string().regex(/^\d{8}$/)),
  password: z.string().min(6),
  name: z.string().trim().min(2).max(100),
};

const companySchema = z.object({
  ...base,
  companyName: z.string().trim().min(2).max(150),
  registerNo: z.string().trim().toUpperCase().min(4).max(20),
});

const driverSchema = z.object({
  ...base,
  email: z.union([z.literal(""), z.string().trim().toLowerCase().email().max(200)]).optional(),
  plateNo: z.string().transform(normalizePlate).pipe(z.string().min(4).max(15)),
  trailerPlateNo: z.string().transform(normalizePlate).pipe(z.string().max(15)).optional(),
  bankName: z.enum(Object.keys(BANKS) as [BankCode, ...BankCode[]]),
  bankAccount: z
    .string()
    .transform((v) => v.replace(/[\s-]/g, "").toUpperCase())
    .pipe(z.string().regex(/^(MN\d{18}|\d{6,20})$/)),
});

export async function register(_: ActionState, fd: FormData): Promise<ActionState> {
  const { t, lang } = await getT();
  const role = fd.get("role") === "DRIVER" ? "DRIVER" : "COMPANY";
  const raw = Object.fromEntries(fd);

  const phone = normalizePhone(String(raw.phone ?? ""));
  if (!/^\d{8}$/.test(phone)) return { error: t.errors.badPhone };
  if (String(raw.password ?? "").length < 6) return { error: t.errors.weakPassword };
  if (await prisma.user.findUnique({ where: { phone } })) return { error: t.errors.phoneTaken };

  // утас Verify.MN-ээр баталгаажсан байх ёстой (зарцуулахыг хэрэглэгч үүсгэхийн өмнө хийнэ)
  const verificationId = String(raw.verificationId ?? "");
  const verification = verificationId
    ? await prisma.phoneVerification.findUnique({ where: { id: verificationId } })
    : null;
  if (!verification || verification.phone !== phone || !verification.verifiedAt || verification.usedAt) {
    return { error: t.errors.phoneNotVerified };
  }

  if (role === "COMPANY") {
    const parsed = companySchema.safeParse(raw);
    if (!parsed.success) return { error: t.errors.invalid };
    const d = parsed.data;
    if (await prisma.company.findUnique({ where: { registerNo: d.registerNo } })) {
      return { error: t.errors.registerTaken };
    }
    if (!(await consumeVerification(verificationId, phone))) return { error: t.errors.phoneNotVerified };
    const user = await prisma.user.create({
      data: {
        role,
        phone: d.phone,
        passwordHash: await bcrypt.hash(d.password, 10),
        name: d.name,
        lang,
        company: { create: { name: d.companyName, registerNo: d.registerNo } },
      },
    });
    await createSession(user.id);
    redirect("/pending");
  }

  if (raw.agree !== "on") return { error: t.errors.mustAgree };
  const parsed = driverSchema.safeParse(raw);
  if (!parsed.success) {
    const field = parsed.error.issues[0]?.path[0];
    if (field === "email") return { error: t.errors.badEmail };
    if (field === "bankAccount") return { error: t.errors.badAccount };
    return { error: t.errors.invalid };
  }
  const d = parsed.data;
  const email = d.email || null;
  const trailerPlateNo = d.trailerPlateNo || null;
  if (trailerPlateNo === d.plateNo) return { error: t.errors.invalid };

  const photo = fd.get("truckPhoto");
  if (!(photo instanceof File) || photo.size === 0 || !PHOTO_TYPES.includes(photo.type)) {
    return { error: t.errors.photoRequired };
  }
  if (photo.size > MAX_PHOTO_BYTES) return { error: t.errors.photoTooBig };

  // давхар бүртгэлээс сэргийлэх: утас, имэйл, улсын болон чиргүүлийн дугаар давтагдашгүй
  if (email && (await prisma.user.findUnique({ where: { email } }))) return { error: t.errors.emailTaken };
  const plates = [d.plateNo, trailerPlateNo].filter((x): x is string => !!x);
  const clash = await prisma.driver.findFirst({
    where: { OR: [{ plateNo: { in: plates } }, { trailerPlateNo: { in: plates } }] },
  });
  if (clash) {
    return { error: clash.plateNo === d.plateNo || clash.trailerPlateNo === d.plateNo ? t.errors.plateTaken : t.errors.trailerTaken };
  }

  if (!(await consumeVerification(verificationId, phone))) return { error: t.errors.phoneNotVerified };
  // Утсаа баталгаажуулсан жолооч шууд идэвхтэй (компанийг админ шалгана)
  const user = await prisma.user.create({
    data: {
      role,
      status: "ACTIVE",
      phone: d.phone,
      email,
      passwordHash: await bcrypt.hash(d.password, 10),
      name: d.name,
      lang,
      driver: {
        create: {
          plateNo: d.plateNo,
          trailerPlateNo,
          bankName: d.bankName,
          bankAccount: d.bankAccount,
          truckPhoto: new Uint8Array(await photo.arrayBuffer()),
          truckPhotoType: photo.type,
        },
      },
    },
  });
  await createSession(user.id);
  redirect("/driver");
}
