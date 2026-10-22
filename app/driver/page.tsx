import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { fmt, getT, type Dict } from "@/lib/i18n";
import { dateTime, orderCode, tons, unitPrice } from "@/lib/format";
import { isSuspended, runMaintenance } from "@/lib/workflow";
import { cargoImage } from "@/lib/images";
import { StatusBadge } from "@/components/StatusBadge";
import { PushToggle } from "@/components/PushToggle";
import { InstallApp } from "@/components/InstallApp";

export default async function DriverDashboard() {
  const user = await requireRole("DRIVER");
  await runMaintenance();
  const { t, lang } = await getT();
  const driver = user.driver!;

  const [open, myBids] = await Promise.all([
    prisma.order.findMany({
      where: { status: "OPEN", biddingClosesAt: { gt: new Date() } },
      orderBy: { biddingClosesAt: "asc" },
      include: { company: true, bids: { where: { driverId: driver.id } } },
    }),
    prisma.bid.findMany({
      where: { driverId: driver.id, order: { status: { not: "OPEN" } } },
      orderBy: { updatedAt: "desc" },
      take: 30,
      include: { order: true },
    }),
  ]);
  const active = myBids.filter((b) => ["SELECTED", "CONFIRMED"].includes(b.status));
  const history = myBids.filter((b) => !["SELECTED", "CONFIRMED"].includes(b.status));

  return (
    <>
      <div className="row between" style={{ marginBottom: 16 }}>
        <div>
          <h1 style={{ margin: 0 }}>{user.name}</h1>
          <div className="muted small">
            🚛 {driver.plateNo}
            {driver.trailerPlateNo && ` + ${driver.trailerPlateNo}`}
          </div>
        </div>
        <PushToggle labels={t.push} />
      </div>

      <InstallApp labels={t.install} />

      {isSuspended(driver) && (
        <p className="alert error" style={{ marginTop: 0 }}>
          {fmt(t.driver.suspendedNote, { time: dateTime(driver.suspendedUntil!, lang) })}
        </p>
      )}

      {active.length > 0 && (
        <section className="card">
          <h2>{t.driver.myJobs}</h2>
          <ul className="list">
            {active.map((b) => (
              <li key={b.id}>
                <Link href={`/driver/orders/${b.orderId}`} className="item-link media-row">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={cargoImage(b.order.cargoType)} alt="" className="cargo-thumb" loading="lazy" />
                  <div>
                    <div className="row between">
                      <span className="item-title">
                        {orderCode(b.order.code)} · {t.cargo[b.order.cargoType as keyof Dict["cargo"]]}
                      </span>
                      <StatusBadge status={b.status} label={t.bidStatus[b.status as keyof Dict["bidStatus"]]} />
                    </div>
                    <div className="muted small">
                      {b.order.loadPlace} → {b.order.unloadPlace} · {unitPrice(b.price, b.order.priceUnit, t)}
                    </div>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="card">
        <h2>{t.driver.dashboardTitle}</h2>
        {open.length === 0 ? (
          <p className="muted">{t.driver.noOpen}</p>
        ) : (
          <ul className="list">
            {open.map((o) => {
              const mine = o.bids.find((b) => b.status === "SUBMITTED");
              return (
                <li key={o.id}>
                  <Link href={`/driver/orders/${o.id}`} className="item-link media-row">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={cargoImage(o.cargoType)} alt="" className="cargo-thumb" loading="lazy" />
                    <div>
                      <div className="row between">
                        <span className="item-title">
                          {t.cargo[o.cargoType as keyof Dict["cargo"]]} · {tons(o.totalTons)}
                        </span>
                        {mine && <span className="badge blue">{unitPrice(mine.price, o.priceUnit, t)}</span>}
                      </div>
                      <div className="small">
                        {o.loadPlace} → {o.unloadPlace}
                      </div>
                      <div className="muted small">
                        {o.company.name} · {t.truck[o.truckType as keyof Dict["truck"]]} × {o.trucksNeeded} ·{" "}
                        {t.order.closesAt}: {dateTime(o.biddingClosesAt, lang)}
                      </div>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {history.length > 0 && (
        <section className="card">
          <h2>{t.driver.myBids}</h2>
          <ul className="list">
            {history.map((b) => (
              <li key={b.id}>
                <Link href={`/driver/orders/${b.orderId}`} className="item-link row between">
                  <span className="small">
                    {orderCode(b.order.code)} · {t.cargo[b.order.cargoType as keyof Dict["cargo"]]} ·{" "}
                    {unitPrice(b.price, b.order.priceUnit, t)}
                  </span>
                  <StatusBadge status={b.status} label={t.bidStatus[b.status as keyof Dict["bidStatus"]]} />
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}
