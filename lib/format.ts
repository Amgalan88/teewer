import type { Lang } from "./constants";

const TZ = "Asia/Ulaanbaatar";
const locale = (lang: Lang) => (lang === "zh" ? "zh-CN" : lang === "en" ? "en-GB" : "mn-MN");

export function num(n: number) {
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(n);
}

export function money(n: number) {
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(Math.round(n)) + "₮";
}

// 25,000 ₮/тн
export function unitPrice(price: number, unit: string, t: { common: { perTon: string; perTrip: string } }) {
  return `${num(price)} ${unit === "PER_TON" ? t.common.perTon : t.common.perTrip}`;
}

export function tons(n: number) {
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(n) + " тн";
}

export function dateTime(d: Date, lang: Lang) {
  return new Intl.DateTimeFormat(locale(lang), {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(d);
}

export function date(d: Date, lang: Lang) {
  return new Intl.DateTimeFormat(locale(lang), {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

// <input type="datetime-local"> утгыг Улаанбаатарын цагаар (UTC+8) тайлна
export function parseLocalDateTime(value: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2})?$/.test(value)) return null;
  const withTime = value.length === 10 ? `${value}T00:00` : value;
  const d = new Date(`${withTime}:00+08:00`);
  return isNaN(d.getTime()) ? null : d;
}

// Date → <input type="date"> / "datetime-local"-ийн утга (Улаанбаатарын цагаар)
export function toInputDate(d: Date) {
  return new Date(d.getTime() + 8 * 3600_000).toISOString().slice(0, 10);
}

export function toInputDateTime(d: Date) {
  return new Date(d.getTime() + 8 * 3600_000).toISOString().slice(0, 16);
}

export function orderCode(code: number) {
  return "T-" + String(code).padStart(5, "0");
}
