import { NextResponse } from "next/server";
import { runMaintenance } from "@/lib/workflow";

// Хугацаа дууссан тендер, баталгаажуулалтыг шинэчилнэ. Хуудас ачаалах бүрт мөн ажилладаг.
// Vercel Cron нь `Authorization: Bearer <CRON_SECRET>` илгээнэ; гадны cron бол ?key=<CRON_SECRET>.
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.get("authorization");
  const key = new URL(req.url).searchParams.get("key");
  if (!secret || (auth !== `Bearer ${secret}` && key !== secret)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  await runMaintenance();
  return NextResponse.json({ ok: true });
}
