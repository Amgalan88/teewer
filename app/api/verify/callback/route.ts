import { NextResponse } from "next/server";
import { refreshVerification } from "@/lib/services/phone";

// Verify.MN SMS хүлээн авмагц энд GET илгээнэ. Энэ нь зөвхөн мэдэгдэл:
// бодит төлөвийг Verify.MN-ээс өөрсдөө шалгана (хуурамч дуудлага юу ч өөрчлөхгүй).
export async function GET(req: Request) {
  const id = new URL(req.url).searchParams.get("v");
  if (id && id.length <= 64) await refreshVerification(id);
  return NextResponse.json({ ok: true });
}
