import { cookies } from "next/headers";
import { LANGS, type Lang } from "../constants";
import mn from "./mn";
import en from "./en";
import zh from "./zh";

export { fmt } from "./fmt";

export type Dict = typeof mn;

const dicts: Record<Lang, Dict> = { mn, en, zh };

export function isLang(v: unknown): v is Lang {
  return typeof v === "string" && (LANGS as readonly string[]).includes(v);
}

export function dictFor(lang: string): Dict {
  return isLang(lang) ? dicts[lang] : mn;
}

export async function getLang(): Promise<Lang> {
  const v = (await cookies()).get("lang")?.value;
  return isLang(v) ? v : "mn";
}

export async function getT() {
  const lang = await getLang();
  return { t: dicts[lang], lang };
}
