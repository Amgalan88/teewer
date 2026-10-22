import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { verifyMode } from "@/lib/verify";

export const dynamic = "force-dynamic";

const REQUIRED = [
  "DATABASE_URL",
  "SESSION_SECRET",
  "NEXT_PUBLIC_VAPID_PUBLIC_KEY",
  "VAPID_PRIVATE_KEY",
  "CRON_SECRET",
  "VERIFY_MN_API_KEY",
  "APP_URL",
];

// холболтын мөр дэх нууц үгийг арилгана
function scrub(s: string) {
  return s.replace(/(:\/\/[^:\s/]+):[^@\s]+@/g, "$1:***@").slice(0, 400);
}

// Оношилгоо: ямар тохиргоо дутуу, сантай холбогдож байгаа эсэх.
// Нийтэд зөвхөн ok/fail; дэлгэрэнгүйг `Authorization: Bearer <CRON_SECRET>`-тэй хүн харна. Утгыг хэзээ ч буцаахгүй.
export async function GET(req: Request) {
  const started = Date.now();
  let db: { ok: boolean; ms?: number; error?: string; code?: string } = { ok: false };
  try {
    await prisma.$queryRaw`SELECT 1`;
    db = { ok: true, ms: Date.now() - started };
  } catch (e) {
    const err = e as { name?: string; code?: string; errorCode?: string; message?: string };
    db = { ok: false, code: err.errorCode ?? err.code ?? err.name, error: scrub(String(err.message ?? e)) };
  }

  const authorized = !!process.env.CRON_SECRET && req.headers.get("authorization") === `Bearer ${process.env.CRON_SECRET}`;
  if (!authorized) return NextResponse.json({ ok: db.ok }, { status: db.ok ? 200 : 503 });

  const dbUrl = process.env.DATABASE_URL ?? "";
  return NextResponse.json({
    ok: db.ok,
    db,
    env: Object.fromEntries(REQUIRED.map((k) => [k, !!process.env[k]])),
    databaseUrl: {
      port: dbUrl.match(/:(\d+)\//)?.[1] ?? null,
      pgbouncer: dbUrl.includes("pgbouncer=true"),
      placeholderLeft: /YOUR-PASSWORD|\[|\]/.test(dbUrl),
    },
    verifyMode: verifyMode(),
    region: process.env.VERCEL_REGION ?? null,
    commit: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? null,
  });
}
