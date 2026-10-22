import webpush from "web-push";
import { prisma } from "./db";
import { dictFor } from "./i18n";
import type { Dict } from "./i18n";

let configured = false;
function configure() {
  if (configured) return true;
  const pub = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  if (!pub || !priv) return false;
  webpush.setVapidDetails(process.env.VAPID_SUBJECT || "mailto:admin@teewer.mn", pub, priv);
  configured = true;
  return true;
}

type Message = { title: string; body: string; url: string };

// Хэрэглэгч бүрт өөрийн хэлээр мэдэгдэл илгээнэ. Алдаа гарвал үндсэн үйлдлийг зогсоохгүй.
export async function notifyUsers(userIds: string[], build: (t: Dict) => Message) {
  if (!configure() || userIds.length === 0) return;
  const users = await prisma.user.findMany({
    where: { id: { in: userIds } },
    include: { subscriptions: true },
  });
  const sends: Promise<unknown>[] = [];
  for (const user of users) {
    const payload = JSON.stringify(build(dictFor(user.lang)));
    for (const sub of user.subscriptions) {
      sends.push(
        webpush
          .sendNotification({ endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } }, payload)
          .catch(async (err: { statusCode?: number }) => {
            // хүчингүй болсон бүртгэлийг устгана
            if (err.statusCode === 404 || err.statusCode === 410) {
              await prisma.pushSubscription.delete({ where: { id: sub.id } }).catch(() => {});
            }
          }),
      );
    }
  }
  await Promise.all(sends);
}

export async function notifyActiveDrivers(build: (t: Dict) => Message) {
  const drivers = await prisma.user.findMany({
    where: { role: "DRIVER", status: "ACTIVE" },
    select: { id: true },
  });
  await notifyUsers(
    drivers.map((d) => d.id),
    build,
  );
}
