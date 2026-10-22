import { NextResponse } from "next/server";
import { runMaintenance } from "@/lib/workflow";

// Гадны cron (жишээ нь 5 минут тутам) дуудна: /api/cron?key=CRON_SECRET
// Хуудас ачаалах бүрт мөн ажилладаг тул заавал биш, гэхдээ мэдэгдэл цагтаа очиход тустай.
export async function GET(req: Request) {
  const key = new URL(req.url).searchParams.get("key");
  if (!process.env.CRON_SECRET || key !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  await runMaintenance();
  return NextResponse.json({ ok: true });
}
