// Хуурамч өгөгдөл дээр системийг хэдэн долоо хоног бүтэн эргүүлнэ.
// Бүх үйлдэл сайтын ашигладаг service функцээр дамжина: тендер, сонголт, татгалзалт,
// хугацаа хэтрэлт, ирээгүй, рейс, төлбөр.
//
//   npm run demo
//
// АНХААР: админаас бусад бүх өгөгдлийг устгана. Зөвхөн туршилтын (SQLite) өгөгдлийн сан дээр ажиллана.

import bcrypt from "bcryptjs";
import type { Order, OrderTemplate } from "@prisma/client";
import { prisma } from "../lib/db";
import { now, setNow } from "../lib/clock";
import { DAY, HOUR, earnings, isSuspended, runMaintenance, ubMidnight } from "../lib/workflow";
import * as company from "../lib/services/company";
import * as driver from "../lib/services/driver";
import { tenderStats } from "../lib/stats";
import { money, num, orderCode } from "../lib/format";

if (!process.env.DATABASE_URL?.startsWith("file:") && process.env.DEMO_FORCE !== "1") {
  console.error("Demo өгөгдөл зөвхөн туршилтын SQLite сан дээр ажиллана (DATABASE_URL=file:...).");
  process.exit(1);
}

const PASSWORD = "demo1234";
const WEEKS = 5;
const MIN = 60 * 1000;

// ── санамсаргүй (давтагдах) ─────────────────────────────────────────────
let seed = 20261021;
function rand() {
  seed |= 0;
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
const between = (a: number, b: number) => a + rand() * (b - a);
const chance = (p: number) => rand() < p;
const at = (d: Date, ms: number) => new Date(d.getTime() + ms);

// ── хуурамч оролцогчид ──────────────────────────────────────────────────
type Profile = {
  name: string;
  truckType: "DUMP" | "SEMI_TIPPER";
  capacity: number;
  factor: number; // зах зээлийн үнээс хэдэн хувиар (0.93 = 7% хямд)
  floor: number; // үүнээс доош буулгахгүй (өртөг)
  decline: number; // сонгогдоод татгалзах магадлал
  expire: number; // хариу өгөхгүй өнгөрөөх
  noShow: number; // баталгаажуулаад ирэхгүй
  join: number; // тендерт оролцох магадлал
  tripsPerDay: number;
};

const DRIVERS: Profile[] = [
  { name: "Б. Болд", truckType: "DUMP", capacity: 40, factor: 0.94, floor: 0.88, decline: 0.05, expire: 0.02, noShow: 0, join: 0.95, tripsPerDay: 3 },
  { name: "Д. Ганзориг", truckType: "DUMP", capacity: 40, factor: 1.0, floor: 0.9, decline: 0.05, expire: 0.03, noShow: 0, join: 0.9, tripsPerDay: 3 },
  { name: "Ц. Энхтөр", truckType: "SEMI_TIPPER", capacity: 45, factor: 0.9, floor: 0.85, decline: 0.05, expire: 0.4, noShow: 0.05, join: 0.85, tripsPerDay: 2 },
  { name: "О. Мөнх-Эрдэнэ", truckType: "DUMP", capacity: 38, factor: 0.92, floor: 0.86, decline: 0.05, expire: 0.05, noShow: 0.35, join: 0.9, tripsPerDay: 3 },
  { name: "Г. Батзориг", truckType: "SEMI_TIPPER", capacity: 45, factor: 1.05, floor: 0.92, decline: 0.03, expire: 0.02, noShow: 0, join: 0.8, tripsPerDay: 2 },
  { name: "С. Түмэнбаяр", truckType: "DUMP", capacity: 40, factor: 0.97, floor: 0.9, decline: 0.3, expire: 0.03, noShow: 0, join: 0.85, tripsPerDay: 3 },
  { name: "Н. Эрдэнэбат", truckType: "DUMP", capacity: 42, factor: 1.1, floor: 0.95, decline: 0.02, expire: 0.02, noShow: 0, join: 0.7, tripsPerDay: 3 },
  { name: "П. Дорж", truckType: "SEMI_TIPPER", capacity: 45, factor: 0.98, floor: 0.9, decline: 0.05, expire: 0.05, noShow: 0.03, join: 0.85, tripsPerDay: 2 },
  { name: "Ж. Ганбаатар", truckType: "DUMP", capacity: 40, factor: 1.02, floor: 0.9, decline: 0.05, expire: 0.03, noShow: 0, join: 0.8, tripsPerDay: 3 },
  { name: "Э. Сүхбат", truckType: "DUMP", capacity: 40, factor: 0.96, floor: 0.87, decline: 0.03, expire: 0.02, noShow: 0, join: 0.95, tripsPerDay: 3 },
  { name: "Л. Отгонбаяр", truckType: "SEMI_TIPPER", capacity: 44, factor: 1.08, floor: 0.93, decline: 0.05, expire: 0.03, noShow: 0, join: 0.75, tripsPerDay: 2 },
  { name: "Х. Баяр", truckType: "SEMI_TIPPER", capacity: 45, factor: 0.99, floor: 0.9, decline: 0.05, expire: 0.08, noShow: 0.05, join: 0.85, tripsPerDay: 2 },
  { name: "Т. Нямдорж", truckType: "DUMP", capacity: 40, factor: 1.15, floor: 1.0, decline: 0.02, expire: 0.02, noShow: 0, join: 0.6, tripsPerDay: 3 },
  { name: "М. Хүрэлбаатар", truckType: "SEMI_TIPPER", capacity: 45, factor: 0.96, floor: 0.88, decline: 0.05, expire: 0.05, noShow: 0.02, join: 0.9, tripsPerDay: 2 },
];

const COMPANIES = [
  { name: "Дархан Төмөрлөг ХХК", contact: "Б. Ганбат", registerNo: "DEMO001" },
  { name: "Дархан Түлш ХХК", contact: "Ч. Сарантуяа", registerNo: "DEMO002" },
  { name: "Сэлэнгэ Бетон ХХК", contact: "Р. Төмөрбаатар", registerNo: "DEMO003" },
];

type TemplateSpec = company.TemplateInput & { company: number; basePrice: number; offset: number };

const TEMPLATES: TemplateSpec[] = [
  {
    company: 0,
    name: "Баяжмал — Ганхүдэр (7 хоног бүр)",
    cargoType: "CONCENTRATE",
    totalTons: 1000,
    loadPlace: "Дархан, баяжуулах үйлдвэр",
    unloadPlace: "Ганхүдэр ХХК",
    routeNote: "Таван нуурын талбайгаар",
    distanceKm: 35,
    truckType: "ANY",
    priceUnit: "PER_TON",
    trucksNeeded: 5,
    description: "Жингийн тасалбар заавал. Ачилт 08:00–20:00.",
    durationDays: 5,
    biddingHours: 24,
    basePrice: 22000,
    offset: 9 * HOUR, // Даваа 09:00
  },
  {
    company: 1,
    name: "Нүүрс — Дарханы ДЦС (7 хоног бүр)",
    cargoType: "COAL",
    totalTons: 600,
    loadPlace: "Шарын голын уурхай",
    unloadPlace: "Дарханы ДЦС",
    routeNote: null,
    distanceKm: 65,
    truckType: "SEMI_TIPPER",
    priceUnit: "PER_TON",
    trucksNeeded: 4,
    description: null,
    durationDays: 4,
    biddingHours: 24,
    basePrice: 32000,
    offset: DAY + 10 * HOUR, // Мягмар 10:00
  },
  {
    company: 2,
    name: "Дайрга — бетон зуурмагийн үйлдвэр",
    cargoType: "CRUSHED_STONE",
    totalTons: 400,
    loadPlace: "Хонгорын карьер",
    unloadPlace: "Дархан, бетон зуурмагийн үйлдвэр",
    routeNote: null,
    distanceKm: 20,
    truckType: "DUMP",
    priceUnit: "PER_TRIP",
    trucksNeeded: 3,
    description: "Рейс тутам 35–40 тн.",
    durationDays: 3,
    biddingHours: 12,
    basePrice: 260000,
    offset: 2 * DAY + 8 * HOUR, // Лхагва 08:00
  },
];

// ── өгөгдөл бэлтгэх ─────────────────────────────────────────────────────
type SimDriver = Profile & { id: string; userId: string; phone: string; plate: string };
type SimTemplate = TemplateSpec & { tpl: OrderTemplate; companyId: string };

async function reset() {
  await prisma.payment.deleteMany();
  await prisma.trip.deleteMany();
  await prisma.bid.deleteMany();
  await prisma.order.deleteMany();
  await prisma.orderTemplate.deleteMany();
  await prisma.pushSubscription.deleteMany();
  await prisma.driver.deleteMany();
  await prisma.company.deleteMany();
  await prisma.user.deleteMany({ where: { role: { not: "ADMIN" } } });
}

async function seedPeople(start: Date) {
  const passwordHash = await bcrypt.hash(PASSWORD, 10);
  setNow(start);
  const companies = [];
  for (const [i, c] of COMPANIES.entries()) {
    const user = await prisma.user.create({
      data: {
        role: "COMPANY",
        phone: `8800000${i + 1}`,
        passwordHash,
        name: c.contact,
        status: "ACTIVE",
        createdAt: start,
        company: { create: { name: c.name, registerNo: c.registerNo } },
      },
      include: { company: true },
    });
    companies.push(user.company!.id);
  }
  const letters = "АБВГДЕЖЗИКЛМНО";
  const drivers: SimDriver[] = [];
  for (const [i, p] of DRIVERS.entries()) {
    const phone = `990000${String(i + 1).padStart(2, "0")}`;
    const plate = `${2100 + i * 37}ДА${letters[i]}`;
    const user = await prisma.user.create({
      data: {
        role: "DRIVER",
        phone,
        passwordHash,
        name: p.name,
        status: "ACTIVE",
        createdAt: start,
        driver: {
          create: {
            plateNo: plate,
            trailerPlateNo: p.truckType === "SEMI_TIPPER" ? `${3100 + i * 37}ДЧ${letters[i]}` : null,
            bankName: (["KHAN", "GOLOMT", "TDB", "XAC", "STATE"] as const)[i % 5],
            bankAccount: String(5000100200 + i * 1311),
            truckType: p.truckType,
            capacityTons: p.capacity,
          },
        },
      },
      include: { driver: true },
    });
    drivers.push({ ...p, id: user.driver!.id, userId: user.id, phone, plate });
  }
  // админ шалгах дараалалд байгаа хоёр бүртгэл
  await prisma.user.create({
    data: {
      role: "DRIVER",
      phone: "99000099",
      passwordHash,
      name: "Ш. Ариунболд",
      createdAt: now(),
      driver: {
        create: { plateNo: "9999ДАШ", bankName: "KHAN", bankAccount: "5099990000", truckType: "DUMP", capacityTons: 40 },
      },
    },
  });
  await prisma.user.create({
    data: {
      role: "COMPANY",
      phone: "88000099",
      passwordHash,
      name: "Д. Оюун",
      createdAt: now(),
      company: { create: { name: "Шинэ Зам ХХК", registerNo: "DEMO099" } },
    },
  });

  const templates: SimTemplate[] = [];
  for (const spec of TEMPLATES) {
    const companyId = companies[spec.company];
    const res = await company.createTemplate(companyId, spec);
    if (!res.ok) throw new Error(`template: ${res.error}`);
    templates.push({ ...spec, tpl: res.value, companyId });
  }
  return { drivers, templates };
}

// ── мөчлөгийн алхмууд ───────────────────────────────────────────────────
type Log = string[];

const nameOf = (drivers: SimDriver[], driverId: string) => drivers.find((d) => d.id === driverId)!.name;

function roundPrice(spec: TemplateSpec, value: number) {
  const step = spec.priceUnit === "PER_TON" ? 100 : 5000;
  return Math.round(value / step) * step;
}

async function placeBids(o: Order, spec: SimTemplate, drivers: SimDriver[], from: Date, until: Date, skip: string[] = []) {
  const plan = [];
  for (const d of drivers) {
    if (skip.includes(d.id)) continue;
    if (o.truckType !== "ANY" && o.truckType !== d.truckType) continue;
    if (!chance(d.join)) continue;
    plan.push({ d, time: at(from, rand() * (until.getTime() - from.getTime())) });
  }
  plan.sort((a, b) => a.time.getTime() - b.time.getTime());
  let placed = 0;
  for (const { d, time } of plan) {
    setNow(time);
    const dbDriver = await prisma.driver.findUniqueOrThrow({ where: { id: d.id } });
    if (isSuspended(dbDriver)) continue;
    const price = roundPrice(spec, spec.basePrice * d.factor * between(0.97, 1.03));
    const note = chance(0.5) ? `Өдөрт ${d.tripsPerDay} рейс хийнэ` : null;
    const res = await driver.placeBid(d.id, o.id, price, note);
    if (res.ok) placed++;
  }
  return placed;
}

async function selectedBids(orderId: string) {
  return prisma.bid.findMany({ where: { orderId, status: "SELECTED" }, orderBy: { price: "asc" } });
}

// Сонгогдсон жолооч нар хариу өгнө: баталгаажуулах / татгалзах / хариугүй өнгөрөөх.
// Татгалзсан, хугацаа хэтэрсэн суудал систем өөрөө дараагийнхад шилжүүлнэ.
async function respond(o: Order, drivers: SimDriver[], start: Date, log: Log, stopAt?: Date) {
  const handled = new Set<string>();
  let roundStart = start;
  for (let round = 0; round < 8; round++) {
    let responded = false;
    // татгалзалтаар шинээр сонгогдсон хүмүүс мөн энэ ээлжинд, өөрийн сонгогдсон цагаас хариулна
    for (;;) {
      const pending = (await selectedBids(o.id)).filter((b) => !handled.has(b.id));
      if (pending.length === 0) break;
      responded = true;
      // урьдчилан тэмдэглэнэ: тэгвэл шинээр сонгогдсоныг л тайланд бичнэ
      for (const b of pending) handled.add(b.id);
      for (const b of pending) {
        const d = drivers.find((x) => x.id === b.driverId)!;
        const deadline = b.confirmDeadline!.getTime();
        const base = Math.max(roundStart.getTime(), b.updatedAt.getTime());
        const time = new Date(Math.min(base + between(10 * MIN, 2.5 * HOUR), deadline - 5 * MIN));
        if (stopAt && time >= stopAt) continue; // одоогийн мөчөөс хойш: хариугаа хүлээж байгаа
        const r = rand();
        if (r < d.expire) {
          log.push(`  ⏱ ${d.name} хугацаандаа хариу өгсөнгүй`);
        } else if (r < d.expire + d.decline) {
          setNow(time);
          await driver.declineSelection(d.id, b.id);
          log.push(`  ✗ ${d.name} татгалзлаа`);
          await logPromoted(o.id, drivers, handled, log);
        } else {
          setNow(time);
          await driver.confirmSelection(d.id, b.id);
        }
      }
    }
    if (!responded) return;
    // хугацаа хэтэрсэн сонголтуудыг систем дараагийнхад шилжүүлнэ
    const latest = (await selectedBids(o.id)).reduce((m, b) => Math.max(m, b.confirmDeadline!.getTime()), 0);
    if (latest === 0) return;
    const after = new Date(latest + MIN);
    if (stopAt && after >= stopAt) return;
    setNow(after);
    await runMaintenance();
    await logPromoted(o.id, drivers, handled, log);
    roundStart = after;
  }
}

async function logPromoted(orderId: string, drivers: SimDriver[], handled: Set<string>, log: Log) {
  for (const b of await selectedBids(orderId)) {
    if (!handled.has(b.id)) log.push(`    → ${nameOf(drivers, b.driverId)} (${num(b.price)}) хүлээлгээс сонгогдлоо`);
  }
}

let ticket = 1000;

// Ажлын өдрүүд: рейс бүртгэх, компани батлах, ирээгүй жолоочийг чөлөөлөх
async function work(o: Order, spec: SimTemplate, drivers: SimDriver[], log: Log, stopAt?: Date) {
  const noShowChecked = new Set<string>();
  for (let day = 0; day < spec.durationDays + 4; day++) {
    const morning = at(o.startDate, day * DAY + 8 * HOUR);
    if (stopAt && morning >= stopAt) return;

    // өглөө ирээгүй жолоочийг компани чөлөөлнө → суудал дараагийнхад
    const confirmed = await prisma.bid.findMany({ where: { orderId: o.id, status: "CONFIRMED" } });
    for (const b of confirmed) {
      if (noShowChecked.has(b.id)) continue;
      noShowChecked.add(b.id);
      const d = drivers.find((x) => x.id === b.driverId)!;
      if (chance(d.noShow)) {
        setNow(at(morning, 2 * HOUR));
        await company.markNoShow(spec.companyId, b.id);
        const dbDriver = await prisma.driver.findUniqueOrThrow({ where: { id: d.id } });
        log.push(`  ⚠ ${d.name} ирсэнгүй → оноо хасагдлаа (${dbDriver.noShows} дахь удаа)${isSuspended(dbDriver) ? ", 14 хоног хаагдлаа" : ""}`);
        const handled = new Set(confirmed.map((x) => x.id));
        await logPromoted(o.id, drivers, handled, log);
        await respond(o, drivers, now(), log, stopAt);
      }
    }

    const delivered = await approvedTons(o.id);
    if (delivered >= o.totalTons) return;

    // жолооч бүр өдөрт хэдэн рейс
    const working = await prisma.bid.findMany({ where: { orderId: o.id, status: "CONFIRMED" }, orderBy: { price: "asc" } });
    let remaining = o.totalTons - delivered - (await pendingTons(o.id));
    for (const b of working) {
      const d = drivers.find((x) => x.id === b.driverId)!;
      if (b.updatedAt > morning) continue; // өнөөдөр сонгогдсон бол маргаашаас эхэлнэ
      for (let k = 0; k < d.tripsPerDay && remaining > 5; k++) {
        const time = at(morning, (k * 3 + between(0.5, 2.5)) * HOUR);
        if (stopAt && time >= stopAt) break;
        setNow(time);
        const load = Math.min(Math.round(d.capacity * between(0.9, 1.0) * 100) / 100, Math.round(remaining * 100) / 100);
        const res = await driver.submitTrip(d.id, b.id, { tons: load, ticketNo: `ЖТ-${++ticket}`, photo: null, photoType: null });
        if (res.ok) remaining -= load;
      }
    }

    // орой компани тасалбаруудыг шалгана (ойролцоогоор 3% нь тодорхойгүй тасалбар)
    const review = at(o.startDate, day * DAY + 20 * HOUR);
    if (stopAt && review >= stopAt) return;
    setNow(review);
    const trips = await prisma.trip.findMany({ where: { orderId: o.id, status: "SUBMITTED" } });
    let rejected = 0;
    for (const tr of trips) {
      const decision = chance(0.03) ? "REJECTED" : "APPROVED";
      if (decision === "REJECTED") rejected++;
      await company.reviewTrip(spec.companyId, tr.id, decision);
    }
    if (rejected) log.push(`  ⓘ ${day + 1}-р өдөр ${rejected} тасалбар татгалзагдсан (тодорхойгүй)`);
  }
}

async function approvedTons(orderId: string) {
  const r = await prisma.trip.aggregate({ where: { orderId, status: "APPROVED" }, _sum: { tons: true } });
  return r._sum.tons ?? 0;
}

async function pendingTons(orderId: string) {
  const r = await prisma.trip.aggregate({ where: { orderId, status: "SUBMITTED" }, _sum: { tons: true } });
  return r._sum.tons ?? 0;
}

// Компани жолооч бүрт олсон дүнг шилжүүлж, жолооч хүлээн авснаа баталгаажуулна
async function pay(o: Order, spec: SimTemplate, drivers: SimDriver[], when: Date, confirmReceipt: boolean) {
  const bids = await prisma.bid.findMany({
    where: { orderId: o.id, status: { in: ["CONFIRMED", "COMPLETED", "RELEASED"] } },
    include: { trips: true, payments: true },
  });
  for (const b of bids) {
    const owed = earnings(o, b, b.trips).amount - b.payments.reduce((s, p) => s + p.amount, 0);
    if (owed <= 0) continue;
    setNow(at(when, between(0, 3) * HOUR));
    const res = await company.recordPayment(spec.companyId, b.id, owed, "Дансаар шилжүүлэв");
    if (res.ok && confirmReceipt && chance(0.95)) {
      const payment = await prisma.payment.findFirstOrThrow({ where: { bidId: b.id }, orderBy: { paidAt: "desc" } });
      setNow(at(now(), between(1, 6) * HOUR));
      await driver.confirmPaymentReceived(b.driverId, payment.id);
    }
  }
}

// Жолооч нар зөвхөн өөрийн үр дүнг мэддэг тул дараагийн удаа үнээ тохируулна:
// сонгогдоогүй бол бага зэрэг буулгаж, ажилласан бол арай өсгөнө (өртгөөс доош буухгүй).
async function adapt(o: Order, drivers: SimDriver[]) {
  const bids = await prisma.bid.findMany({ where: { orderId: o.id } });
  for (const b of bids) {
    const d = drivers.find((x) => x.id === b.driverId)!;
    if (b.status === "NOT_SELECTED") d.factor = Math.max(d.floor, d.factor * between(0.97, 0.99));
    if (b.status === "COMPLETED") d.factor = d.factor * between(1.0, 1.01);
  }
}

async function summary(o: Order, spec: SimTemplate, log: Log, label: string) {
  const [s] = await tenderStats({ id: o.id });
  const fresh = await prisma.order.findUniqueOrThrow({ where: { id: o.id } });
  const paid = await prisma.payment.aggregate({ where: { orderId: o.id }, _sum: { amount: true } });
  const unit = spec.priceUnit === "PER_TON" ? "₮/тн" : "₮/рейс";
  console.log(
    `\n${orderCode(o.code)}  ${label}  ${spec.name}\n` +
      `  ${s.bids} санал · доод ${s.low ? num(s.low) : "—"} ${unit} · ажилласан дундаж ${s.awardedAvg ? num(s.awardedAvg) : "—"} ${unit}` +
      ` · хүргэсэн ${num(s.delivered)}/${num(o.totalTons)} тн · төлсөн ${money(paid._sum.amount ?? 0)} · [${fresh.status}]`,
  );
  for (const line of log) console.log(line);
}

// ── бүтэн мөчлөг ────────────────────────────────────────────────────────
async function fullCycle(spec: SimTemplate, drivers: SimDriver[], publishAt: Date) {
  const log: Log = [];
  setNow(publishAt);
  const res = await company.publishFromTemplate(spec.companyId, spec.tpl.id);
  if (!res.ok) throw new Error(`publish: ${res.error}`);
  const o = res.value;

  await placeBids(o, spec, drivers, at(publishAt, 20 * MIN), at(o.biddingClosesAt, -30 * MIN));
  setNow(at(o.biddingClosesAt, MIN));
  await runMaintenance();

  // компани хамгийн бага N саналыг сонгоно (сайт дээрх анхдагч сонголттой ижил)
  setNow(at(o.biddingClosesAt, between(0.5, 2) * HOUR));
  const lowest = await prisma.bid.findMany({
    where: { orderId: o.id, status: "SUBMITTED" },
    orderBy: [{ price: "asc" }, { createdAt: "asc" }],
    take: o.trucksNeeded,
  });
  if (lowest.length === 0) {
    await company.cancelOrder(spec.companyId, o.id);
    return { o, log };
  }
  await company.awardBids(spec.companyId, o.id, lowest.map((b) => b.id));
  await respond(o, drivers, now(), log);

  await work(o, spec, drivers, log);
  const lastTrip = await prisma.trip.findFirst({ where: { orderId: o.id }, orderBy: { createdAt: "desc" } });
  setNow(at(lastTrip?.createdAt ?? now(), 4 * HOUR));
  await company.completeOrder(spec.companyId, o.id);
  await pay(o, spec, drivers, at(now(), 15 * HOUR), true);
  await adapt(o, drivers);
  return { o, log };
}

async function main() {
  const realNow = new Date();
  const weekZero = new Date(ubMidnight(realNow).getTime() - WEEKS * 7 * DAY);

  console.log("Өгөгдөл цэвэрлэж, хуурамч оролцогчдыг үүсгэж байна…");
  await reset();
  const { drivers, templates } = await seedPeople(at(weekZero, -3 * DAY));

  // 1) Өнгөрсөн долоо хоногууд: бүтэн мөчлөг
  for (let w = 0; w < WEEKS; w++) {
    console.log(`\n━━━━━━━━ ${w + 1}-р долоо хоног ━━━━━━━━`);
    for (const spec of templates) {
      const { o, log } = await fullCycle(spec, drivers, at(weekZero, w * 7 * DAY + spec.offset));
      await summary(o, spec, log, `${w + 1}/${WEEKS}`);
    }
  }

  // 2) Энэ долоо хоног: сайт дээр бүх төлөвийг харахын тулд янз бүрийн шатанд үлдээнэ
  console.log(`\n━━━━━━━━ Энэ долоо хоног (одоо явагдаж буй) ━━━━━━━━`);
  const [t1, t2, t3] = templates;

  // Дайрга: гүйцэтгэж байгаа (рейсүүд явж байна, зарим тасалбар шалгагдаагүй, нэг суудал хариу хүлээж буй)
  {
    const log: Log = [];
    const publishAt = at(realNow, -3 * DAY - 2 * HOUR);
    setNow(publishAt);
    const res = await company.publishFromTemplate(t3.companyId, t3.tpl.id);
    if (!res.ok) throw new Error(res.error);
    const o = res.value;
    await placeBids(o, t3, drivers, at(publishAt, 20 * MIN), at(o.biddingClosesAt, -30 * MIN));
    setNow(at(o.biddingClosesAt, HOUR));
    await runMaintenance();
    const lowest = await prisma.bid.findMany({
      where: { orderId: o.id, status: "SUBMITTED" },
      orderBy: [{ price: "asc" }, { createdAt: "asc" }],
      take: o.trucksNeeded,
    });
    await company.awardBids(t3.companyId, o.id, lowest.map((b) => b.id));
    await respond(o, drivers, now(), log, realNow);
    await work(o, t3, drivers, log, at(realNow, -90 * MIN));
    // нэг жолооч яг одоо ирээгүй гэж тэмдэглэгдэж, суудал нь хүлээлгийн жагсаалт руу шилжсэн
    const confirmed = await prisma.bid.findMany({ where: { orderId: o.id, status: "CONFIRMED" }, orderBy: { price: "desc" } });
    if (confirmed.length > 1 && (await prisma.bid.count({ where: { orderId: o.id, status: "NOT_SELECTED" } })) > 0) {
      setNow(at(realNow, -HOUR));
      await company.markNoShow(t3.companyId, confirmed[0].id);
      log.push(`  ⚠ ${nameOf(drivers, confirmed[0].driverId)} ирсэнгүй (1 цагийн өмнө)`);
      await logPromoted(o.id, drivers, new Set(), log);
      log.push("    (сонгогдсон жолоочийн хариуг хүлээж байна)");
    }
    await pay(o, t3, drivers, at(realNow, -20 * HOUR), false);
    await summary(o, t3, log, "ЯВАГДАЖ БУЙ");
  }

  // Нүүрс: тендер хаагдсан, компани сонголт хийхийг хүлээж байна
  {
    const publishAt = at(realNow, -30 * HOUR);
    setNow(publishAt);
    const res = await company.publishFromTemplate(t2.companyId, t2.tpl.id);
    if (!res.ok) throw new Error(res.error);
    const o = res.value;
    await placeBids(o, t2, drivers, at(publishAt, 20 * MIN), at(o.biddingClosesAt, -30 * MIN));
    setNow(at(realNow, -MIN));
    await runMaintenance();
    await summary(o, t2, [], "СОНГОЛТ ХҮЛЭЭЖ БУЙ");
  }

  // Баяжмал: тендер нээлттэй, санал авч байна (Б. Болд 99000001 санал өгөөгүй — та туршиж үзнэ үү)
  {
    const publishAt = at(realNow, -6 * HOUR);
    setNow(publishAt);
    const res = await company.publishFromTemplate(t1.companyId, t1.tpl.id);
    if (!res.ok) throw new Error(res.error);
    const o = res.value;
    await placeBids(o, t1, drivers, at(publishAt, 20 * MIN), at(realNow, -10 * MIN), [drivers[0].id]);
    await summary(o, t1, [], "САНАЛ АВЧ БУЙ");
  }

  setNow(null);

  // ── жолоочийн үзүүлэлт ──
  console.log("\n━━━━━━━━ Жолооч нар ━━━━━━━━");
  console.log("Нэр                 Санал Ажил Дуус Ирээгүй Хариугүй  Олсон дүн      Төлөв");
  for (const d of drivers) {
    const dbd = await prisma.driver.findUniqueOrThrow({
      where: { id: d.id },
      include: { bids: { include: { order: true, trips: true } } },
    });
    const worked = dbd.bids.filter((b) => ["CONFIRMED", "COMPLETED", "RELEASED"].includes(b.status) && b.trips.length > 0);
    const earned = worked.reduce((s, b) => s + earnings(b.order, b, b.trips).amount, 0);
    console.log(
      `${d.name.padEnd(20)}${String(dbd.bids.length).padStart(5)}${String(worked.length).padStart(5)}${String(dbd.completedJobs).padStart(5)}` +
        `${String(dbd.noShows).padStart(8)}${String(dbd.expiredCount).padStart(9)}  ${money(earned).padStart(13)}  ${isSuspended(dbd) ? "ХААГДСАН" : ""}`,
    );
  }

  // ── загвар бүрийн үнийн хандлага ──
  console.log("\n━━━━━━━━ Байнгын чиглэлийн үнийн хандлага (доод үнэ) ━━━━━━━━");
  for (const spec of templates) {
    const stats = (await tenderStats({ templateId: spec.tpl.id })).reverse();
    console.log(`${spec.name}: ${stats.map((s) => (s.low ? num(s.low) : "—")).join(" → ")}`);
  }

  console.log(`
━━━━━━━━ Нэвтэрч үзэх (нууц үг: ${PASSWORD}) ━━━━━━━━
Компани:  88000001 ${COMPANIES[0].name} (баяжмал, санал авч буй)
          88000002 ${COMPANIES[1].name} (нүүрс, сонголт хийх ээлж)
          88000003 ${COMPANIES[2].name} (дайрга, ажил явагдаж буй)
Жолооч:   99000001 ${DRIVERS[0].name} (баяжмалын тендерт санал өгөөгүй)
          99000002 … 99000014
Хүлээгдэж буй: 99000099 жолооч, 88000099 компани (админ баталгаажуулна)
Админ:    .env-ийн ADMIN_PHONE / ADMIN_PASSWORD`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
