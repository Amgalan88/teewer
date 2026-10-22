import type { Prisma } from "@prisma/client";
import { prisma } from "./db";

// Тендер бүрийн товч үзүүлэлт: хэдэн санал, доод үнэ, ажилласан жолооч нарын дундаж үнэ, хүргэсэн тонн
export async function tenderStats(where: Prisma.OrderWhereInput, take?: number) {
  const orders = await prisma.order.findMany({
    where,
    take,
    orderBy: { createdAt: "desc" },
    include: {
      bids: { where: { status: { not: "WITHDRAWN" } }, select: { price: true, status: true } },
      trips: { where: { status: "APPROVED" }, select: { tons: true } },
    },
  });
  return orders.map((o) => {
    const prices = o.bids.map((b) => b.price);
    const worked = o.bids.filter((b) => ["CONFIRMED", "COMPLETED"].includes(b.status)).map((b) => b.price);
    return {
      id: o.id,
      code: o.code,
      createdAt: o.createdAt,
      status: o.status,
      priceUnit: o.priceUnit,
      totalTons: o.totalTons,
      templateId: o.templateId,
      bids: prices.length,
      low: prices.length ? Math.min(...prices) : null,
      awardedAvg: worked.length ? Math.round(worked.reduce((s, p) => s + p, 0) / worked.length) : null,
      delivered: o.trips.reduce((s, t) => s + t.tons, 0),
    };
  });
}

export type TenderStat = Awaited<ReturnType<typeof tenderStats>>[number];
