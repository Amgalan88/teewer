import { prisma } from "@/lib/db";
import { getUser } from "@/lib/auth";

// Жингийн тасалбарын зургийг зөвхөн тухайн компани, жолооч, админ харна
export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getUser();
  if (!user) return new Response("Unauthorized", { status: 401 });
  const trip = await prisma.trip.findUnique({
    where: { id },
    include: { order: true, bid: true },
    omit: { photo: false },
  });
  if (!trip?.photo) return new Response("Not found", { status: 404 });
  const allowed =
    user.role === "ADMIN" ||
    (user.company && trip.order.companyId === user.company.id) ||
    (user.driver && trip.bid.driverId === user.driver.id);
  if (!allowed) return new Response("Forbidden", { status: 403 });
  return new Response(trip.photo, {
    headers: {
      "Content-Type": trip.photoType ?? "image/jpeg",
      "Cache-Control": "private, max-age=86400",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'; img-src 'self'; style-src 'unsafe-inline'",
    },
  });
}
