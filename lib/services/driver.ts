// Жолоочийн үйлдлүүдийн бизнесийн логик. Нэвтрэлт, орчуулга, мэдэгдлийг app/actions хариуцна.
import { prisma } from "../db";
import { now } from "../clock";
import { isSuspended, promoteNext, releaseNoShow } from "../workflow";
import { err, ok, type Result } from "./result";

async function activeDriver(driverId: string) {
  const driver = await prisma.driver.findUnique({ where: { id: driverId }, include: { user: true } });
  return driver && driver.user.status === "ACTIVE" ? driver : null;
}

async function ownBid(driverId: string, bidId: string) {
  const bid = await prisma.bid.findUnique({
    where: { id: bidId },
    include: { order: { include: { company: true } } },
  });
  return bid && bid.driverId === driverId ? bid : null;
}

export async function placeBid(driverId: string, orderId: string, price: number, note: string | null): Promise<Result> {
  const driver = await activeDriver(driverId);
  if (!driver) return err("notAllowed");
  if (isSuspended(driver)) return err("suspended");

  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order || order.status !== "OPEN" || order.biddingClosesAt <= now()) return err("biddingClosed");
  if (!Number.isInteger(price) || price <= 0 || price > 1_000_000_000) return err("invalid");

  const key = { orderId_driverId: { orderId, driverId } };
  const existing = await prisma.bid.findUnique({ where: key });
  if (existing && !["SUBMITTED", "WITHDRAWN"].includes(existing.status)) return err("notAllowed");

  const at = now();
  await prisma.bid.upsert({
    where: key,
    create: { orderId, driverId, price, note, createdAt: at, updatedAt: at },
    update: { price, note, status: "SUBMITTED", updatedAt: at },
  });
  return ok(undefined);
}

export async function withdrawBid(driverId: string, bidId: string): Promise<Result> {
  const bid = await ownBid(driverId, bidId);
  if (!bid || bid.status !== "SUBMITTED" || bid.order.status !== "OPEN") return err("notAllowed");
  await prisma.bid.update({ where: { id: bidId }, data: { status: "WITHDRAWN", updatedAt: now() } });
  return ok(undefined);
}

export async function confirmSelection(driverId: string, bidId: string) {
  const bid = await ownBid(driverId, bidId);
  if (!bid || bid.status !== "SELECTED") return err("notAllowed");
  if (!bid.confirmDeadline || bid.confirmDeadline <= now()) return err("deadlinePassed");
  const updated = await prisma.bid.updateMany({
    where: { id: bidId, status: "SELECTED" },
    data: { status: "CONFIRMED", updatedAt: now() },
  });
  if (updated.count === 0) return err("notAllowed");
  return ok({ order: bid.order });
}

export async function declineSelection(driverId: string, bidId: string): Promise<Result> {
  const bid = await ownBid(driverId, bidId);
  if (!bid || bid.status !== "SELECTED") return err("notAllowed");
  const updated = await prisma.bid.updateMany({
    where: { id: bidId, status: "SELECTED" },
    data: { status: "DECLINED", updatedAt: now() },
  });
  if (updated.count > 0) await promoteNext(bid.orderId);
  return ok(undefined);
}

export async function cancelJob(driverId: string, bidId: string): Promise<Result> {
  const bid = await ownBid(driverId, bidId);
  if (!bid || bid.status !== "CONFIRMED") return err("notAllowed");
  await releaseNoShow(bid);
  return ok(undefined);
}

export type TripInput = { tons: number; ticketNo: string; photo: Uint8Array<ArrayBuffer> | null; photoType: string | null };

export async function submitTrip(driverId: string, bidId: string, input: TripInput) {
  const bid = await ownBid(driverId, bidId);
  if (!bid || bid.status !== "CONFIRMED" || bid.order.status !== "AWARDED") return err("notAllowed");
  if (!Number.isFinite(input.tons) || input.tons <= 0 || input.tons > 200 || !input.ticketNo) return err("invalid");
  const trip = await prisma.trip.create({
    data: {
      orderId: bid.orderId,
      bidId,
      tons: input.tons,
      ticketNo: input.ticketNo,
      photo: input.photo,
      photoType: input.photoType,
      createdAt: now(),
    },
  });
  return ok({ trip, order: bid.order });
}

export async function confirmPaymentReceived(driverId: string, paymentId: string): Promise<Result> {
  const payment = await prisma.payment.findUnique({ where: { id: paymentId }, include: { bid: true } });
  if (!payment || payment.bid.driverId !== driverId || payment.receivedAt) return err("notAllowed");
  await prisma.payment.update({ where: { id: paymentId }, data: { receivedAt: now() } });
  return ok(undefined);
}
