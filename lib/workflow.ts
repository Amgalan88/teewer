// Тендерийн дүрэм: хаагдах, сонгох, баталгаажуулах, суудал чөлөөлөх, дараагийнхад шилжүүлэх.
import type { Bid, Order, Trip } from "@prisma/client";
import { prisma } from "./db";
import { now } from "./clock";
import { ACTIVE_BID_STATUSES, RULES } from "./constants";
import { orderCode } from "./format";
import { fmt } from "./i18n";
import { notifyUsers } from "./push";

export const HOUR = 60 * 60 * 1000;
export const DAY = 24 * HOUR;

export function confirmDeadline() {
  return new Date(now().getTime() + RULES.CONFIRM_HOURS * HOUR);
}

export function isSuspended(driver: { suspendedUntil: Date | null }) {
  return !!driver.suspendedUntil && driver.suspendedUntil > now();
}

// Хуудас ачаалах бүрт дуудна (мөн /api/cron). Хугацаа дууссан зүйлсийг шинэчилнэ.
export async function runMaintenance() {
  const at = now();

  await prisma.order.updateMany({
    where: { status: "OPEN", biddingClosesAt: { lte: at } },
    data: { status: "CLOSED" },
  });

  const expired = await prisma.bid.findMany({
    where: { status: "SELECTED", confirmDeadline: { lte: at } },
  });
  for (const bid of expired) {
    const updated = await prisma.bid.updateMany({
      where: { id: bid.id, status: "SELECTED" },
      data: { status: "EXPIRED", updatedAt: at },
    });
    if (updated.count === 0) continue; // өөр хүсэлт аль хэдийн боловсруулсан
    await prisma.driver.update({
      where: { id: bid.driverId },
      data: { expiredCount: { increment: 1 } },
    });
    await promoteNext(bid.orderId);
  }
}

// Суудал сул байвал хүлээлгийн жагсаалтаас хамгийн бага үнийн саналыг сонгоно
export async function promoteNext(orderId: string) {
  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order || order.status !== "AWARDED") return;

  let active = await prisma.bid.count({
    where: { orderId, status: { in: ACTIVE_BID_STATUSES } },
  });

  const waitlist = await prisma.bid.findMany({
    where: { orderId, status: "NOT_SELECTED" },
    include: { driver: { include: { user: true } } },
    orderBy: [{ price: "asc" }, { createdAt: "asc" }],
  });

  for (const bid of waitlist) {
    if (active >= order.trucksNeeded) break;
    if (bid.driver.user.status !== "ACTIVE" || isSuspended(bid.driver)) continue;
    const updated = await prisma.bid.updateMany({
      where: { id: bid.id, status: "NOT_SELECTED" },
      data: { status: "SELECTED", confirmDeadline: confirmDeadline(), updatedAt: now() },
    });
    if (updated.count === 0) continue;
    active++;
    await notifySelected(bid.driver.userId, order);
  }
}

export async function notifySelected(userId: string, order: Order) {
  await notifyUsers([userId], (t) => ({
    title: t.notify.selectedTitle,
    body: fmt(t.notify.selectedBody, { code: orderCode(order.code), hours: RULES.CONFIRM_HOURS }),
    url: `/driver/orders/${order.id}`,
  }));
}

// Баталгаажуулсан жолооч ирээгүй / цуцалсан: оноо хасаж, давтвал түр хаана
export async function releaseNoShow(bid: Bid) {
  const updated = await prisma.bid.updateMany({
    where: { id: bid.id, status: { in: ACTIVE_BID_STATUSES } },
    data: { status: "RELEASED", updatedAt: now() },
  });
  if (updated.count === 0) return false;
  const driver = await prisma.driver.update({
    where: { id: bid.driverId },
    data: { noShows: { increment: 1 } },
  });
  if (driver.noShows >= RULES.NO_SHOW_LIMIT) {
    await prisma.driver.update({
      where: { id: driver.id },
      data: { suspendedUntil: new Date(now().getTime() + RULES.SUSPEND_DAYS * DAY) },
    });
  }
  await promoteNext(bid.orderId);
  return true;
}

// Зөвхөн компанийн баталсан рейсээр тооцно
export function earnings(
  order: Pick<Order, "priceUnit">,
  bid: Pick<Bid, "price">,
  trips: Pick<Trip, "status" | "tons">[],
) {
  const approved = trips.filter((t) => t.status === "APPROVED");
  const approvedTons = approved.reduce((s, t) => s + t.tons, 0);
  const amount =
    order.priceUnit === "PER_TON" ? Math.round(approvedTons * bid.price) : approved.length * bid.price;
  return { approvedTons, approvedTrips: approved.length, amount };
}

export async function nextOrderCode() {
  const last = await prisma.order.findFirst({ orderBy: { code: "desc" }, select: { code: true } });
  return (last?.code ?? 0) + 1;
}

// Улаанбаатарын цагаар тухайн өдрийн 00:00
export function ubMidnight(d: Date) {
  const shifted = d.getTime() + 8 * HOUR;
  return new Date(shifted - (shifted % DAY) - 8 * HOUR);
}
