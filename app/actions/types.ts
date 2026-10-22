import type { Dict } from "@/lib/i18n";
import { fmt } from "@/lib/i18n/fmt";
import type { Result } from "@/lib/services/result";

export type ActionState = { error?: string; ok?: string } | undefined;

// Service-ийн алдааг хэрэглэгчийн хэлээр мессеж болгоно
export function errorState(t: Dict, r: Extract<Result<unknown>, { ok: false }>): ActionState {
  return { error: fmt(t.errors[r.error], r.vars ?? {}) };
}
