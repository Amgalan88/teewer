import { prisma } from "@/lib/db";
import { getUser } from "@/lib/auth";

// Машины зургийг админ, жолооч өөрөө, мөн тухайн жолоочоос санал авсан компани харна
export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getUser();
  if (!user) return new Response("Unauthorized", { status: 401 });
  const driver = await prisma.driver.findUnique({
    where: { id },
    select: { id: true, truckPhoto: true, truckPhotoType: true },
  });
  if (!driver?.truckPhoto) return new Response("Not found", { status: 404 });

  let allowed = user.role === "ADMIN" || user.driver?.id === driver.id;
  if (!allowed && user.company && user.status === "ACTIVE") {
    const bid = await prisma.bid.findFirst({
      where: { driverId: driver.id, order: { companyId: user.company.id } },
      select: { id: true },
    });
    allowed = !!bid;
  }
  if (!allowed) return new Response("Forbidden", { status: 403 });

  return new Response(driver.truckPhoto, {
    headers: {
      "Content-Type": driver.truckPhotoType ?? "image/jpeg",
      "Cache-Control": "private, max-age=86400",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'; img-src 'self'; style-src 'unsafe-inline'",
    },
  });
}
