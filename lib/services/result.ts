import type mn from "../i18n/mn";

export type ErrorKey = keyof typeof mn.errors;

export type Result<T = undefined> =
  | { ok: true; value: T }
  | { ok: false; error: ErrorKey; vars?: Record<string, string | number> };

export function ok<T>(value: T): Result<T> {
  return { ok: true, value };
}

export function err(error: ErrorKey, vars?: Record<string, string | number>): { ok: false; error: ErrorKey; vars?: Record<string, string | number> } {
  return { ok: false, error, vars };
}
