import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { fmt, getT, type Dict } from "@/lib/i18n";
import { RULES } from "@/lib/constants";
import { dateTime, money, num, tons, unitPrice } from "@/lib/format";
import { earnings, isSuspended, runMaintenance } from "@/lib/workflow";
import { ActionForm } from "@/components/ActionForm";
import { OrderSummary } from "@/components/OrderSummary";
import { PhotoInput } from "@/components/PhotoInput";
import { StatusBadge } from "@/components/StatusBadge";
import {
  cancelJob,
  confirmPaymentReceived,
  confirmSelection,
  declineSelection,
  placeBid,
  submitTrip,
  withdrawBid,
} from "@/app/actions/driver";

export default async function DriverOrderPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireRole("DRIVER");
  await runMaintenance();
  const { t, lang } = await getT();
  const { id } = await params;
  const driver = user.driver!;

  const order = await prisma.order.findUnique({
    where: { id },
    include: { company: { include: { user: true } } },
  });
  if (!order) notFound();

  // Жолооч зөвхөн өөрийн саналыг харна
  const bid = await prisma.bid.findUnique({
    where: { orderId_driverId: { orderId: order.id, driverId: driver.id } },
    include: {
      trips: {
        orderBy: { createdAt: "desc" },
        select: { id: true, tons: true, ticketNo: true, status: true, createdAt: true, photoType: true },
      },
      payments: { orderBy: { paidAt: "desc" } },
    },
  });
  // сонгогдоогүй хүн нээлттэй биш захиалгыг харах шаардлагагүй
  if (!bid && order.status !== "OPEN") notFound();

  const biddingOpen = order.status === "OPEN" && order.biddingClosesAt > new Date();
  const canBid = biddingOpen && (!bid || ["SUBMITTED", "WITHDRAWN"].includes(bid.status));
  const unit = order.priceUnit === "PER_TON" ? t.common.perTon : t.common.perTrip;

  return (
    <>
      {bid && !(biddingOpen && bid.status === "WITHDRAWN") && (
        <section className="card stack">
          <div className="row between">
            <span>
              {t.driver.yourBid}: <b className="num">{unitPrice(bid.price, order.priceUnit, t)}</b>
            </span>
            <StatusBadge status={bid.status} label={t.bidStatus[bid.status as keyof Dict["bidStatus"]]} />
          </div>
          {bid.status === "NOT_SELECTED" && order.status === "AWARDED" && (
            <p className="muted">{t.driver.notSelectedBody}</p>
          )}
          {bid.status === "SELECTED" && bid.confirmDeadline && (
            <>
              <p className="alert warn" style={{ margin: 0 }}>
                <b>{t.driver.selectedTitle}</b> {fmt(t.driver.selectedBody, { time: dateTime(bid.confirmDeadline, lang) })}
              </p>
              <div className="row">
                <ActionForm action={confirmSelection.bind(null, bid.id)}>
                  <button className="btn primary">{t.driver.confirm}</button>
                </ActionForm>
                <ActionForm action={declineSelection.bind(null, bid.id)} confirmText={t.driver.declineConfirm}>
                  <button className="btn danger">{t.driver.decline}</button>
                </ActionForm>
              </div>
            </>
          )}
        </section>
      )}

      {canBid && (
        <section className="card bid-card">
          <h2 style={{ marginBottom: 4 }}>{t.driver.bidTitle}</h2>
          <p className="muted small" style={{ marginTop: 0 }}>
            {t.cargo[order.cargoType as keyof Dict["cargo"]]} · {num(order.totalTons)} {t.common.tons} · {order.loadPlace} →{" "}
            {order.unloadPlace}
          </p>
          {isSuspended(driver) ? (
            <p className="alert error" style={{ margin: 0 }}>
              {fmt(t.driver.suspendedNote, { time: dateTime(driver.suspendedUntil!, lang) })}
            </p>
          ) : (
            <>
              <ActionForm action={placeBid.bind(null, order.id)}>
                <label htmlFor="price" className="small" style={{ fontWeight: 600 }}>
                  {t.driver.priceLabel} ({unit})
                </label>
                <div className="bid-row">
                  <input
                    id="price"
                    name="price"
                    type="number"
                    inputMode="numeric"
                    min="1"
                    step="1"
                    placeholder="0"
                    defaultValue={bid?.status === "SUBMITTED" ? bid.price : undefined}
                    required
                  />
                  <button className="btn primary lg">
                    {bid?.status === "SUBMITTED" ? t.driver.updateBid : t.driver.submitBid}
                  </button>
                </div>
              </ActionForm>
              <p className="muted small" style={{ margin: "8px 0 0" }}>
                🔒 {t.driver.sealed}
              </p>
              {bid?.status === "SUBMITTED" && order.priceUnit === "PER_TON" && (
                <p className="muted small" style={{ margin: "4px 0 0" }}>
                  {fmt(t.driver.estimate, {
                    tons: num(order.totalTons),
                    price: unitPrice(bid.price, order.priceUnit, t),
                    total: money(order.totalTons * bid.price),
                  })}
                </p>
              )}
              {bid?.status === "SUBMITTED" && (
                <ActionForm action={withdrawBid.bind(null, bid.id)} confirmText={t.common.areYouSure}>
                  <button className="linkbtn" style={{ marginTop: 4, paddingLeft: 0 }}>
                    {t.driver.withdraw}
                  </button>
                </ActionForm>
              )}
            </>
          )}
        </section>
      )}

      {!biddingOpen && !bid && <p className="alert warn">{t.driver.closed}</p>}

      <OrderSummary order={order} companyName={order.company.name} t={t} lang={lang} />

      {bid && ["CONFIRMED", "COMPLETED", "RELEASED"].includes(bid.status) && (
        <Work bid={bid} order={order} t={t} lang={lang} />
      )}
    </>
  );
}

type WorkProps = {
  bid: {
    id: string;
    price: number;
    status: string;
    trips: { id: string; tons: number; ticketNo: string; status: string; createdAt: Date; photoType: string | null }[];
    payments: { id: string; amount: number; note: string | null; paidAt: Date; receivedAt: Date | null }[];
  };
  order: { priceUnit: string; status: string; company: { name: string; user: { phone: string; name: string } } };
  t: Dict;
  lang: "mn" | "en" | "zh";
};

function Work({ bid, order, t, lang }: WorkProps) {
  const e = earnings(order, bid, bid.trips);
  const paid = bid.payments.filter((p) => p.receivedAt).reduce((s, p) => s + p.amount, 0);
  const working = bid.status === "CONFIRMED" && order.status === "AWARDED";

  return (
    <>
      <section className="card stack">
        <h2 style={{ margin: 0 }}>{t.driver.myEarnings}</h2>
        <p className="big num" style={{ margin: 0 }}>
          {money(e.amount)}
        </p>
        <dl className="kv">
          <dt>{t.company.approvedTons}</dt>
          <dd className="num">
            {tons(e.approvedTons)} · {e.approvedTrips} {t.common.trips}
          </dd>
          <dt>{t.company.paid}</dt>
          <dd className="num">{money(paid)}</dd>
          <dt>{t.company.balance}</dt>
          <dd className="num">
            <b>{money(e.amount - paid)}</b>
          </dd>
          <dt>{t.driver.contactCompany}</dt>
          <dd>
            {order.company.user.name} · <a href={`tel:${order.company.user.phone}`}>{order.company.user.phone}</a>
          </dd>
        </dl>
      </section>

      {working && (
        <section className="card">
          <h2>{t.driver.addTrip}</h2>
          <ActionForm action={submitTrip.bind(null, bid.id)} resetOnOk>
            <div className="grid2">
              <div className="field">
                <label htmlFor="tons">{t.driver.tons}</label>
                <input id="tons" name="tons" type="number" inputMode="decimal" step="0.01" min="0.01" required />
              </div>
              <div className="field">
                <label htmlFor="ticketNo">{t.driver.ticketNo}</label>
                <input id="ticketNo" name="ticketNo" required />
              </div>
            </div>
            <div className="field">
              <PhotoInput name="photo" label={t.driver.ticketPhoto} required />
            </div>
            <button className="btn primary block">{t.common.send}</button>
          </ActionForm>
        </section>
      )}

      {bid.trips.length > 0 && (
        <section className="card">
          <h2>{t.company.tripsTitle}</h2>
          <ul className="list">
            {bid.trips.map((tr) => (
              <li key={tr.id} className="row between">
                <span className="num small">
                  <b>{tons(tr.tons)}</b> · {t.company.ticket} {tr.ticketNo} · {dateTime(tr.createdAt, lang)}
                </span>
                <StatusBadge status={tr.status} label={t.tripStatus[tr.status as keyof Dict["tripStatus"]]} />
              </li>
            ))}
          </ul>
        </section>
      )}

      {bid.payments.length > 0 && (
        <section className="card">
          <h2>{t.driver.paymentsTitle}</h2>
          <ul className="list">
            {bid.payments.map((p) => (
              <li key={p.id} className="row between">
                <span className="num small">
                  <b>{money(p.amount)}</b> · {dateTime(p.paidAt, lang)}
                  {p.note && <span className="muted"> · {p.note}</span>}
                </span>
                {p.receivedAt ? (
                  <span className="badge green">{t.company.received}</span>
                ) : (
                  <ActionForm action={confirmPaymentReceived.bind(null, p.id)}>
                    <button className="btn sm primary">{t.driver.confirmReceived}</button>
                  </ActionForm>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      {working && (
        <ActionForm
          action={cancelJob.bind(null, bid.id)}
          confirmText={fmt(t.driver.cancelJobConfirm, { limit: RULES.NO_SHOW_LIMIT, days: RULES.SUSPEND_DAYS })}
        >
          <button className="btn sm danger">{t.driver.cancelJob}</button>
        </ActionForm>
      )}
    </>
  );
}
