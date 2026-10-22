// Платформын дүрэм. Хураамжийг эхэндээ 0 байлгаж, дараа нь энд өөрчилнө.
export const RULES = {
  // үүнээс бага дүнтэй ачааг авахгүй (жижиг, нэг удаагийн ажилд зориулаагүй)
  MIN_ORDER_TONS: 100,
  // сонгогдсон жолооч хэдэн цагийн дотор баталгаажуулах
  CONFIRM_HOURS: 3,
  // хэдэн удаа ирээгүй бол түр хаах
  NO_SHOW_LIMIT: 2,
  SUSPEND_DAYS: 14,
  // зар оруулах хураамж (₮)
  LISTING_FEE_MNT: 0,
  // амжилттай дууссан ажлаас жолоочоос авах хураамж (%)
  SUCCESS_FEE_PERCENT: 0,
} as const;

export const CARGO_TYPES = [
  "COAL",
  "IRON_ORE",
  "CONCENTRATE",
  "LIMESTONE",
  "GRAVEL",
  "CRUSHED_STONE",
  "SAND_05",
  "SAND",
  "CEMENT",
  "OTHER",
] as const;

export const TRUCK_TYPES = ["DUMP", "SEMI_TIPPER", "TRAILER", "FLATBED", "ANY"] as const;

export const PRICE_UNITS = ["PER_TON", "PER_TRIP"] as const;

// Жингийн тасалбар, машины зураг: SVG зэрэг скрипт агуулж болох төрлийг хүлээж авахгүй
export const PHOTO_TYPES = ["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"];
export const MAX_PHOTO_BYTES = 3 * 1024 * 1024;

// Монголын банкууд (жолоочийн мөнгө хүлээн авах данс)
export const BANKS = {
  KHAN: { mn: "Хаан банк", en: "Khan Bank" },
  GOLOMT: { mn: "Голомт банк", en: "Golomt Bank" },
  TDB: { mn: "Худалдаа хөгжлийн банк", en: "Trade and Development Bank" },
  XAC: { mn: "Хас банк", en: "XacBank" },
  STATE: { mn: "Төрийн банк", en: "State Bank" },
  CAPITRON: { mn: "Капитрон банк", en: "Capitron Bank" },
  BOGD: { mn: "Богд банк", en: "Bogd Bank" },
  ARIG: { mn: "Ариг банк", en: "Arig Bank" },
  TRANSPORT: { mn: "Тээвэр хөгжлийн банк", en: "Transport and Development Bank" },
  NIB: { mn: "Үндэсний хөрөнгө оруулалтын банк", en: "National Investment Bank" },
  CHINGGIS: { mn: "Чингис хаан банк", en: "Chinggis Khaan Bank" },
  MBANK: { mn: "М банк", en: "M Bank" },
} as const;
export type BankCode = keyof typeof BANKS;

export function bankLabel(code: string, lang: string) {
  const b = BANKS[code as BankCode];
  if (!b) return code;
  return lang === "mn" ? b.mn : b.en;
}

export const LANGS = ["mn", "en", "zh"] as const;
export type Lang = (typeof LANGS)[number];

// Сонгогдсон эсвэл ажил гүйцэтгэж буй (машины суудал эзэлж буй) санал
export const ACTIVE_BID_STATUSES = ["SELECTED", "CONFIRMED"];
