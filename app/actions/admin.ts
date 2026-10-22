"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { getUser } from "@/lib/auth";
import { getT } from "@/lib/i18n";
import type { ActionState } from "./types";

async function isAdmin() {
  const user = await getUser();
  return user?.role === "ADMIN";
}

export async function setUserStatus(userId: string, status: "ACTIVE" | "SUSPENDED"): Promise<ActionState> {
  const { t } = await getT();
  if (!(await isAdmin())) return { error: t.errors.notAllowed };
  const target = await prisma.user.findUnique({ where: { id: userId } });
  if (!target || target.role === "ADMIN") return { error: t.errors.notAllowed };
  await prisma.user.update({ where: { id: userId }, data: { status } });
  revalidatePath("/", "layout");
}

export async function clearSuspension(driverId: string): Promise<ActionState> {
  const { t } = await getT();
  if (!(await isAdmin())) return { error: t.errors.notAllowed };
  await prisma.driver.update({ where: { id: driverId }, data: { suspendedUntil: null } });
  revalidatePath("/", "layout");
}
