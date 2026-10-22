"use server";

import { after } from "next/server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { Order } from "@prisma/client";
import { getUser } from "@/lib/auth";
import { fmt, getT } from "@/lib/i18n";
import { CARGO_TYPES, PRICE_UNITS, TRUCK_TYPES } from "@/lib/constants";
import { dateTime, money, orderCode, parseLocalDateTime } from "@/lib/format";
import { notifyActiveDrivers, notifyUsers } from "@/lib/push";
import { notifySelected } from "@/lib/workflow";
import * as svc from "@/lib/services/company";
import { errorState, type ActionState } from "./types";

async function currentCompanyId() {
  const user = await getUser();
  if (!user || user.role !== "COMPANY" || user.status !== "ACTIVE" || !user.company) return null;
  return user.company.id;
}

function notifyNewOrder(order: Order) {
  after(() =>
    notifyActiveDrivers((tr) => ({
      title: fmt(tr.notify.newOrderTitle, {
        cargo: tr.cargo[order.cargoType as keyof typeof tr.cargo],
        tons: order.totalTons,
      }),
      body: fmt(tr.notify.newOrderBody, {
        from: order.loadPlace,
        to: order.unloadPlace,
        closes: dateTime(order.biddingClosesAt, "mn"),
      }),
      url: `/driver/orders/${order.id}`,
    })),
  );
}

const orderSchema = z.object({
  cargoType: z.enum(CARGO_TYPES),
  totalTons: z.coerce.number().positive().max(10_000_000),
  loadPlace: z.string().trim().min(2).max(200),
  unloadPlace: z.string().trim().min(2).max(200),
  routeNote: z.string().trim().max(300).optional(),
  distanceKm: z.union([z.literal(""), z.coerce.number().positive().max(5000)]).optional(),
  truckType: z.enum(TRUCK_TYPES),
  priceUnit: z.enum(PRICE_UNITS),
  trucksNeeded: z.coerce.number().int().min(1).max(100),
  startDate: z.string(),
  endDate: z.string(),
  biddingClosesAt: z.string(),
  description: z.string().trim().max(2000).optional(),
  templateId: z.string().optional(),
  saveTemplate: z.literal("on").optional(),
  templateName: z.string().trim().max(100).optional(),
});

export async function createOrder(_: ActionState, fd: FormData): Promise<ActionState> {
  const { t } = await getT();
  const companyId = await currentCompanyId();
  if (!companyId) return { error: t.errors.notAllowed };

  const parsed = orderSchema.safeParse(Object.fromEntries(fd));
  if (!parsed.success) return { error: t.errors.invalid };
  const d = parsed.data;
  const startDate = parseLocalDateTime(d.startDate);
  const endDate = parseLocalDateTime(d.endDate);
  const biddingClosesAt = parseLocalDateTime(d.biddingClosesAt);
  if (!startDate || !endDate || !biddingClosesAt) return { error: t.errors.invalid };
  if (d.saveTemplate && !d.templateName) return { error: t.errors.templateName };

  const fields = {
    cargoType: d.cargoType,
    totalTons: d.totalTons,
    loadPlace: d.loadPlace,
    unloadPlace: d.unloadPlace,
    routeNote: d.routeNote || null,
    distanceKm: typeof d.distanceKm === "number" ? d.distanceKm : null,
    truckType: d.truckType,
    priceUnit: d.priceUnit,
    trucksNeeded: d.trucksNeeded,
    description: d.description || null,
  };
  const result = await svc.createOrder(companyId, {
    ...fields,
    startDate,
    endDate,
    biddingClosesAt,
    templateId: d.templateId || null,
  });
  if (!result.ok) return errorState(t, result);
  const order = result.value;

  if (d.saveTemplate && d.templateName) {
    await svc.templateFromOrder(companyId, order.id, d.templateName);
  }

  notifyNewOrder(order);
  revalidatePath("/", "layout");
  redirect(`/company/orders/${order.id}`);
}

export async function publishTemplate(templateId: string): Promise<ActionState> {
  const { t } = await getT();
  const companyId = await currentCompanyId();
  if (!companyId) return { error: t.errors.notAllowed };
  const result = await svc.publishFromTemplate(companyId, templateId);
  if (!result.ok) return errorState(t, result);
  notifyNewOrder(result.value);
  revalidatePath("/", "layout");
  redirect(`/company/orders/${result.value.id}`);
}

export async function saveTemplateFromOrder(orderId: string, _: ActionState, fd: FormData): Promise<ActionState> {
  const { t } = await getT();
  const companyId = await currentCompanyId();
  if (!companyId) return { error: t.errors.notAllowed };
  const name = String(fd.get("name") ?? "").trim();
  if (!name) return { error: t.errors.templateName };
  const result = await svc.templateFromOrder(companyId, orderId, name);
  if (!result.ok) return errorState(t, result);
  revalidatePath("/", "layout");
  return { ok: t.templates.saved };
}

export async function deleteTemplate(templateId: string): Promise<ActionState> {
  const { t } = await getT();
  const companyId = await currentCompanyId();
  if (!companyId) return { error: t.errors.notAllowed };
  const result = await svc.deleteTemplate(companyId, templateId);
  if (!result.ok) return errorState(t, result);
  revalidatePath("/", "layout");
}

export async function closeBidding(orderId: string): Promise<ActionState> {
  const { t } = await getT();
  const companyId = await currentCompanyId();
  if (!companyId) return { error: t.errors.notAllowed };
  const result = await svc.closeBidding(companyId, orderId);
  if (!result.ok) return errorState(t, result);
  revalidatePath("/", "layout");
}

export async function cancelOrder(orderId: string): Promise<ActionState> {
  const { t } = await getT();
  const companyId = await currentCompanyId();
  if (!companyId) return { error: t.errors.notAllowed };
  const result = await svc.cancelOrder(companyId, orderId);
  if (!result.ok) return errorState(t, result);
  revalidatePath("/", "layout");
}

export async function awardBids(orderId: string, _: ActionState, fd: FormData): Promise<ActionState> {
  const { t } = await getT();
  const companyId = await currentCompanyId();
  if (!companyId) return { error: t.errors.notAllowed };
  const result = await svc.awardBids(companyId, orderId, fd.getAll("bid").map(String));
  if (!result.ok) return errorState(t, result);

  const { order, chosenUserIds, otherUserIds } = result.value;
  after(async () => {
    for (const userId of chosenUserIds) await notifySelected(userId, order);
    await notifyUsers(otherUserIds, (tr) => ({
      title: tr.notify.notSelectedTitle,
      body: fmt(tr.notify.notSelectedBody, { code: orderCode(order.code) }),
      url: `/driver/orders/${order.id}`,
    }));
  });
  revalidatePath("/", "layout");
}

export async function markNoShow(bidId: string): Promise<ActionState> {
  const { t } = await getT();
  const companyId = await currentCompanyId();
  if (!companyId) return { error: t.errors.notAllowed };
  const result = await svc.markNoShow(companyId, bidId);
  if (!result.ok) return errorState(t, result);
  revalidatePath("/", "layout");
}

export async function reviewTrip(tripId: string, decision: "APPROVED" | "REJECTED"): Promise<ActionState> {
  const { t } = await getT();
  const companyId = await currentCompanyId();
  if (!companyId) return { error: t.errors.notAllowed };
  const result = await svc.reviewTrip(companyId, tripId, decision);
  if (!result.ok) return errorState(t, result);
  revalidatePath("/", "layout");
}

export async function recordPayment(bidId: string, _: ActionState, fd: FormData): Promise<ActionState> {
  const { t } = await getT();
  const companyId = await currentCompanyId();
  if (!companyId) return { error: t.errors.notAllowed };
  const amount = Math.round(Number(fd.get("amount")));
  const note = String(fd.get("note") ?? "").trim().slice(0, 300) || null;
  const result = await svc.recordPayment(companyId, bidId, amount, note);
  if (!result.ok) return errorState(t, result);

  const { driverUserId, order } = result.value;
  after(() =>
    notifyUsers([driverUserId], (tr) => ({
      title: tr.notify.paymentTitle,
      body: fmt(tr.notify.paymentBody, { code: orderCode(order.code), amount: money(amount) }),
      url: `/driver/orders/${order.id}`,
    })),
  );
  revalidatePath("/", "layout");
  return { ok: t.ok.saved };
}

export async function completeOrder(orderId: string): Promise<ActionState> {
  const { t } = await getT();
  const companyId = await currentCompanyId();
  if (!companyId) return { error: t.errors.notAllowed };
  const result = await svc.completeOrder(companyId, orderId);
  if (!result.ok) return errorState(t, result);
  revalidatePath("/", "layout");
}
