// Компанийн үйлдлүүдийн бизнесийн логик. Нэвтрэлт, орчуулга, мэдэгдлийг app/actions хариуцна.
import type { Order, OrderTemplate } from "@prisma/client";
import { prisma } from "../db";
import { now } from "../clock";
import { RULES } from "../constants";
import {
  DAY,
  HOUR,
  confirmDeadline,
  earnings,
  nextOrderCode,
  releaseNoShow,
  ubMidnight,
} from "../workflow";
import { err, ok, type Result } from "./result";

export type OrderFields = {
  cargoType: string;
  totalTons: number;
  region?: string;
  loadPlace: string;
  unloadPlace: string;
  routeNote: string | null;
  distanceKm: number | null;
  truckType: string;
  priceUnit: string;
  trucksNeeded: number;
  description: string | null;
};

export type OrderInput = OrderFields & {
  startDate: Date;
  endDate: Date;
  biddingClosesAt: Date;
  templateId?: string | null;
};

async function ownOrder(companyId: string, orderId: string) {
  const order = await prisma.order.findUnique({ where: { id: orderId } });
  return order && order.companyId === companyId ? order : null;
}

async function ownBid(companyId: string, bidId: string) {
  const bid = await prisma.bid.findUnique({ where: { id: bidId }, include: { order: true, driver: true } });
  return bid && bid.order.companyId === companyId ? bid : null;
}

export async function createOrder(companyId: string, input: OrderInput): Promise<Result<Order>> {
  if (input.totalTons < RULES.MIN_ORDER_TONS) return err("minTons", { min: RULES.MIN_ORDER_TONS });
  if (input.biddingClosesAt <= now()) return err("closeInPast");
  if (input.endDate < input.startDate) return err("endBeforeStart");

  // Чиглэл/ачаа/нэгж өөрчлөгдсөн бол загварын үнийн түүхийг бохирдуулахгүйн тулд холбохгүй
  let templateId: string | null = null;
  if (input.templateId) {
    const tpl = await prisma.orderTemplate.findUnique({ where: { id: input.templateId } });
    const same =
      tpl?.companyId === companyId &&
      tpl.cargoType === input.cargoType &&
      tpl.loadPlace === input.loadPlace &&
      tpl.unloadPlace === input.unloadPlace &&
      tpl.truckType === input.truckType &&
      tpl.priceUnit === input.priceUnit;
    if (same) templateId = tpl.id;
  }

  const order = await prisma.order.create({
    data: {
      code: await nextOrderCode(),
      companyId,
      cargoType: input.cargoType,
      totalTons: input.totalTons,
      region: input.region ?? "Дархан-Уул",
      loadPlace: input.loadPlace,
      unloadPlace: input.unloadPlace,
      routeNote: input.routeNote,
      distanceKm: input.distanceKm,
      truckType: input.truckType,
      priceUnit: input.priceUnit,
      trucksNeeded: input.trucksNeeded,
      startDate: input.startDate,
      endDate: input.endDate,
      biddingClosesAt: input.biddingClosesAt,
      description: input.description,
      listingFee: RULES.LISTING_FEE_MNT,
      templateId,
      createdAt: now(),
    },
  });
  return ok(order);
}

export async function closeBidding(companyId: string, orderId: string): Promise<Result> {
  const order = await ownOrder(companyId, orderId);
  if (!order || order.status !== "OPEN") return err("notAllowed");
  await prisma.order.update({ where: { id: order.id }, data: { status: "CLOSED", biddingClosesAt: now() } });
  return ok(undefined);
}

export async function cancelOrder(companyId: string, orderId: string): Promise<Result> {
  const order = await ownOrder(companyId, orderId);
  if (!order || !["OPEN", "CLOSED"].includes(order.status)) return err("notAllowed");
  await prisma.order.update({ where: { id: order.id }, data: { status: "CANCELLED" } });
  return ok(undefined);
}

export async function awardBids(
  companyId: string,
  orderId: string,
  bidIds: string[],
): Promise<Result<{ order: Order; chosenUserIds: string[]; otherUserIds: string[] }>> {
  const order = await ownOrder(companyId, orderId);
  if (!order || order.status !== "CLOSED") return err("notAllowed");
  if (bidIds.length < 1 || bidIds.length > order.trucksNeeded) {
    return err("selectCount", { n: order.trucksNeeded });
  }
  const bids = await prisma.bid.findMany({
    where: { orderId: order.id, status: "SUBMITTED" },
    include: { driver: true },
  });
  const chosen = bids.filter((b) => bidIds.includes(b.id));
  if (chosen.length !== bidIds.length) return err("invalid");

  const at = now();
  await prisma.$transaction([
    prisma.bid.updateMany({
      where: { id: { in: bidIds } },
      data: { status: "SELECTED", confirmDeadline: confirmDeadline(), updatedAt: at },
    }),
    // үлдсэн саналууд хүлээлгийн жагсаалтад үлдэнэ
    prisma.bid.updateMany({
      where: { orderId: order.id, status: "SUBMITTED" },
      data: { status: "NOT_SELECTED", updatedAt: at },
    }),
    prisma.order.update({ where: { id: order.id }, data: { status: "AWARDED" } }),
  ]);

  return ok({
    order,
    chosenUserIds: chosen.map((b) => b.driver.userId),
    otherUserIds: bids.filter((b) => !bidIds.includes(b.id)).map((b) => b.driver.userId),
  });
}

export async function markNoShow(companyId: string, bidId: string): Promise<Result> {
  const bid = await ownBid(companyId, bidId);
  if (!bid || bid.status !== "CONFIRMED" || bid.order.status !== "AWARDED") return err("notAllowed");
  await releaseNoShow(bid);
  return ok(undefined);
}

export async function reviewTrip(
  companyId: string,
  tripId: string,
  decision: "APPROVED" | "REJECTED",
): Promise<Result> {
  const trip = await prisma.trip.findUnique({ where: { id: tripId }, include: { order: true } });
  if (!trip || trip.order.companyId !== companyId || trip.status !== "SUBMITTED") return err("notAllowed");
  await prisma.trip.update({ where: { id: trip.id }, data: { status: decision } });
  return ok(undefined);
}

export async function recordPayment(
  companyId: string,
  bidId: string,
  amount: number,
  note: string | null,
): Promise<Result<{ driverUserId: string; order: Order }>> {
  const bid = await ownBid(companyId, bidId);
  if (!bid || !["CONFIRMED", "COMPLETED", "RELEASED"].includes(bid.status)) return err("notAllowed");
  if (!Number.isFinite(amount) || amount <= 0) return err("invalid");
  await prisma.payment.create({
    data: { orderId: bid.orderId, bidId: bid.id, amount: Math.round(amount), note, paidAt: now() },
  });
  return ok({ driverUserId: bid.driver.userId, order: bid.order });
}

export async function completeOrder(companyId: string, orderId: string): Promise<Result> {
  const order = await ownOrder(companyId, orderId);
  if (!order || order.status !== "AWARDED") return err("notAllowed");

  const working = await prisma.bid.findMany({
    where: { orderId: order.id, status: "CONFIRMED" },
    include: { trips: true },
  });
  const at = now();
  await prisma.$transaction([
    ...working.map((bid) =>
      prisma.bid.update({
        where: { id: bid.id },
        data: {
          status: "COMPLETED",
          updatedAt: at,
          successFee: Math.round((earnings(order, bid, bid.trips).amount * RULES.SUCCESS_FEE_PERCENT) / 100),
        },
      }),
    ),
    ...working.map((bid) =>
      prisma.driver.update({ where: { id: bid.driverId }, data: { completedJobs: { increment: 1 } } }),
    ),
    // баталгаажуулаагүй сонголтууд торгуульгүйгээр хаагдана
    prisma.bid.updateMany({
      where: { orderId: order.id, status: "SELECTED" },
      data: { status: "NOT_SELECTED", confirmDeadline: null, updatedAt: at },
    }),
    prisma.order.update({ where: { id: order.id }, data: { status: "COMPLETED" } }),
  ]);
  return ok(undefined);
}

// ── Байнгын чиглэлийн загвар ──────────────────────────────────────────

export type TemplateInput = OrderFields & { name: string; durationDays: number; biddingHours: number };

function clampTemplate(input: TemplateInput) {
  return {
    cargoType: input.cargoType,
    totalTons: input.totalTons,
    region: input.region,
    loadPlace: input.loadPlace,
    unloadPlace: input.unloadPlace,
    routeNote: input.routeNote,
    distanceKm: input.distanceKm,
    truckType: input.truckType,
    priceUnit: input.priceUnit,
    trucksNeeded: input.trucksNeeded,
    description: input.description,
    name: input.name.trim().slice(0, 100),
    durationDays: Math.min(365, Math.max(1, Math.round(input.durationDays))),
    biddingHours: Math.min(168, Math.max(1, Math.round(input.biddingHours))),
  };
}

export async function createTemplate(companyId: string, input: TemplateInput): Promise<Result<OrderTemplate>> {
  if (!input.name.trim()) return err("invalid");
  if (input.totalTons < RULES.MIN_ORDER_TONS) return err("minTons", { min: RULES.MIN_ORDER_TONS });
  const tpl = await prisma.orderTemplate.create({
    data: { ...clampTemplate(input), companyId, createdAt: now() },
  });
  return ok(tpl);
}

// Нийтэлсэн зараас загвар үүсгэнэ: хугацааг зарын өөрийнхөөс тооцно
export async function templateFromOrder(
  companyId: string,
  orderId: string,
  name: string,
): Promise<Result<OrderTemplate>> {
  const order = await ownOrder(companyId, orderId);
  if (!order) return err("notAllowed");
  const result = await createTemplate(companyId, {
    name,
    cargoType: order.cargoType,
    totalTons: order.totalTons,
    region: order.region,
    loadPlace: order.loadPlace,
    unloadPlace: order.unloadPlace,
    routeNote: order.routeNote,
    distanceKm: order.distanceKm,
    truckType: order.truckType,
    priceUnit: order.priceUnit,
    trucksNeeded: order.trucksNeeded,
    description: order.description,
    durationDays: (order.endDate.getTime() - order.startDate.getTime()) / DAY,
    biddingHours: (order.biddingClosesAt.getTime() - order.createdAt.getTime()) / HOUR,
  });
  if (result.ok && !order.templateId) {
    await prisma.order.update({ where: { id: order.id }, data: { templateId: result.value.id } });
  }
  return result;
}

export async function deleteTemplate(companyId: string, templateId: string): Promise<Result> {
  const tpl = await prisma.orderTemplate.findUnique({ where: { id: templateId } });
  if (!tpl || tpl.companyId !== companyId) return err("notAllowed");
  await prisma.orderTemplate.delete({ where: { id: tpl.id } });
  return ok(undefined);
}

// Загвараас шинэ зарын огноог тооцно: тендер biddingHours нээлттэй, дараагийн өдрөөс эхэлнэ
export function templateDates(tpl: Pick<OrderTemplate, "biddingHours" | "durationDays">, from = now()) {
  const biddingClosesAt = new Date(from.getTime() + tpl.biddingHours * HOUR);
  const startDate = new Date(ubMidnight(biddingClosesAt).getTime() + DAY);
  const endDate = new Date(startDate.getTime() + tpl.durationDays * DAY);
  return { biddingClosesAt, startDate, endDate };
}

// Нэг товшилтоор дахин нийтлэх
export async function publishFromTemplate(companyId: string, templateId: string): Promise<Result<Order>> {
  const tpl = await prisma.orderTemplate.findUnique({ where: { id: templateId } });
  if (!tpl || tpl.companyId !== companyId) return err("notAllowed");
  return createOrder(companyId, {
    cargoType: tpl.cargoType,
    totalTons: tpl.totalTons,
    region: tpl.region,
    loadPlace: tpl.loadPlace,
    unloadPlace: tpl.unloadPlace,
    routeNote: tpl.routeNote,
    distanceKm: tpl.distanceKm,
    truckType: tpl.truckType,
    priceUnit: tpl.priceUnit,
    trucksNeeded: tpl.trucksNeeded,
    description: tpl.description,
    ...templateDates(tpl),
    templateId: tpl.id,
  });
}
