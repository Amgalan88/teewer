import { redirect } from "next/navigation";
import { prisma } from "./db";
import { readSession } from "./session";

export async function getUser() {
  const id = await readSession();
  if (!id) return null;
  return prisma.user.findUnique({
    where: { id },
    include: { company: true, driver: true },
  });
}

export type CurrentUser = NonNullable<Awaited<ReturnType<typeof getUser>>>;

// Хуудсанд: эрхгүй бол тохирох газар руу шилжүүлнэ
export async function requireRole(role: "COMPANY" | "DRIVER" | "ADMIN") {
  const user = await getUser();
  if (!user) redirect("/login");
  if (user.role !== role) redirect(homeFor(user.role));
  if (user.status !== "ACTIVE" && role !== "ADMIN") redirect("/pending");
  return user;
}

export function homeFor(role: string) {
  if (role === "COMPANY") return "/company";
  if (role === "DRIVER") return "/driver";
  return "/admin";
}

export function normalizePhone(raw: string) {
  return raw.replace(/\D/g, "").replace(/^976/, "");
}

// "УБ 12-34 АБВ", "1234убв" → "1234УБВ"
export function normalizePlate(raw: string) {
  return raw.replace(/[\s-]/g, "").toUpperCase();
}
