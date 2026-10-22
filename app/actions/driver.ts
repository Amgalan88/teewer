"use server";

import { after } from "next/server";
import { revalidatePath } from "next/cache";
import { getUser } from "@/lib/auth";
import { fmt, getT } from "@/lib/i18n";
import { orderCode, tons as fmtTons } from "@/lib/format";
import { notifyUsers } from "@/lib/push";
import { MAX_PHOTO_BYTES, PHOTO_TYPES } from "@/lib/constants";
import * as svc from "@/lib/services/driver";
import { errorState, type ActionState } from "./types";


async function currentDriver() {
  const user = await getUser();
  if (!user || user.role !== "DRIVER" || user.status !== "ACTIVE" || !user.driver) return null;
  return { ...user.driver, user };
}

export async function placeBid(orderId: string, _: ActionState, fd: FormData): Promise<ActionState> {
  const { t } = await getT();
  const driver = await currentDriver();
  if (!driver) return { error: t.errors.notAllowed };
  const price = Math.round(Number(fd.get("price")));
  const note = String(fd.get("note") ?? "").trim().slice(0, 300) || null;
  const result = await svc.placeBid(driver.id, orderId, price, note);
  if (!result.ok) return errorState(t, result);
  revalidatePath("/", "layout");
  return { ok: t.ok.bidSent };
}

export async function withdrawBid(bidId: string): Promise<ActionState> {
  const { t } = await getT();
  const driver = await currentDriver();
  if (!driver) return { error: t.errors.notAllowed };
  const result = await svc.withdrawBid(driver.id, bidId);
  if (!result.ok) return errorState(t, result);
  revalidatePath("/", "layout");
}

export async function confirmSelection(bidId: string): Promise<ActionState> {
  const { t } = await getT();
  const driver = await currentDriver();
  if (!driver) return { error: t.errors.notAllowed };
  const result = await svc.confirmSelection(driver.id, bidId);
  if (!result.ok) return errorState(t, result);

  const { order } = result.value;
  after(() =>
    notifyUsers([order.company.userId], (tr) => ({
      title: tr.notify.confirmedTitle,
      body: fmt(tr.notify.confirmedBody, {
        code: orderCode(order.code),
        name: driver.user.name,
        plate: driver.plateNo,
      }),
      url: `/company/orders/${order.id}`,
    })),
  );
  revalidatePath("/", "layout");
}

export async function declineSelection(bidId: string): Promise<ActionState> {
  const { t } = await getT();
  const driver = await currentDriver();
  if (!driver) return { error: t.errors.notAllowed };
  const result = await svc.declineSelection(driver.id, bidId);
  if (!result.ok) return errorState(t, result);
  revalidatePath("/", "layout");
}

export async function cancelJob(bidId: string): Promise<ActionState> {
  const { t } = await getT();
  const driver = await currentDriver();
  if (!driver) return { error: t.errors.notAllowed };
  const result = await svc.cancelJob(driver.id, bidId);
  if (!result.ok) return errorState(t, result);
  revalidatePath("/", "layout");
}

export async function submitTrip(bidId: string, _: ActionState, fd: FormData): Promise<ActionState> {
  const { t } = await getT();
  const driver = await currentDriver();
  if (!driver) return { error: t.errors.notAllowed };

  const photo = fd.get("photo");
  if (!(photo instanceof File) || photo.size === 0 || !PHOTO_TYPES.includes(photo.type)) {
    return { error: t.errors.invalid };
  }
  if (photo.size > MAX_PHOTO_BYTES) return { error: t.errors.photoTooBig };
  const tons = Number(fd.get("tons"));
  const result = await svc.submitTrip(driver.id, bidId, {
    tons,
    ticketNo: String(fd.get("ticketNo") ?? "").trim().slice(0, 50),
    photo: new Uint8Array(await photo.arrayBuffer()),
    photoType: photo.type,
  });
  if (!result.ok) return errorState(t, result);

  const { order } = result.value;
  after(() =>
    notifyUsers([order.company.userId], (tr) => ({
      title: tr.notify.tripTitle,
      body: fmt(tr.notify.tripBody, { code: orderCode(order.code), name: driver.user.name, tons: fmtTons(tons) }),
      url: `/company/orders/${order.id}`,
    })),
  );
  revalidatePath("/", "layout");
  return { ok: t.ok.saved };
}

export async function confirmPaymentReceived(paymentId: string): Promise<ActionState> {
  const { t } = await getT();
  const driver = await currentDriver();
  if (!driver) return { error: t.errors.notAllowed };
  const result = await svc.confirmPaymentReceived(driver.id, paymentId);
  if (!result.ok) return errorState(t, result);
  revalidatePath("/", "layout");
}
