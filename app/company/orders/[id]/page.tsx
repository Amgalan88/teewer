import Link from "next/link";
import { notFound } from "next/navigation";
import type { Prisma } from "@prisma/client";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { fmt, getT, type Dict } from "@/lib/i18n";
import { RULES, bankLabel } from "@/lib/constants";
import { dateTime, money, tons, unitPrice } from "@/lib/format";
import { earnings, isSuspended, runMaintenance } from "@/lib/workflow";
import { ActionForm } from "@/components/ActionForm";
import { OrderSummary, Progress } from "@/components/OrderSummary";
import { StatusBadge } from "@/components/StatusBadge";
import {
  awardBids,
  cancelOrder,
  closeBidding,
  completeOrder,
  markNoShow,
  recordPayment,
  reviewTrip,
  saveTemplateFromOrder,
} from "@/app/actions/company";

// Ажил гүйцэтгэсэн/гүйцэтгэж буй саналууд (чөлөөлөгдсөн ч рейс хийсэн бол төлбөр тооцоонд орно)
const ASSIGNED = ["SELECTED", "CONFIRMED", "COMPLETED", "RELEASED"];

// зургийн байтыг жагсаалтад ачаалахгүй
const tripSelect = {
  id: true,
  tons: true,
  ticketNo: true,
  status: true,
  createdAt: true,
  photoType: true,
} satisfies Prisma.TripSelect;

const orderInclude = {
  template: true,
  bids: {
    where: { status: { not: "WITHDRAWN" } },
    include: {
      driver: { include: { user: true } },
      trips: { orderBy: { createdAt: "desc" }, select: tripSelect },
      payments: { orderBy: { paidAt: "desc" } },
    },
    orderBy: [{ price: "asc" }, { createdAt: "asc" }],
  },
} satisfies Prisma.OrderInclude;

type FullOrder = Prisma.OrderGetPayload<{ include: typeof orderInclude }>;

export default async function CompanyOrderPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireRole("COMPANY");
  await runMaintenance();
  const { t, lang } = await getT();
  const { id } = await params;

  const order = await prisma.order.findUnique({ where: { id }, include: orderInclude });
  if (!order || order.companyId !== user.company!.id) notFound();

  const unit = (p: number) => unitPrice(p, order.priceUnit, t);

  return (
    <>
      <OrderSummary order={order} t={t} lang={lang} />

      {order.status === "OPEN" && (
        <section className="card stack">
          <p className="big">{fmt(t.company.bidsCount, { n: order.bids.length })}</p>
          <p className="muted">{t.company.sealedNote}</p>
          <div className="row">
            <ActionForm action={closeBidding.bind(null, order.id)} confirmText={t.common.areYouSure}>
              <button className="btn primary">{t.company.closeNow}</button>
            </ActionForm>
            <ActionForm action={cancelOrder.bind(null, order.id)} confirmText={t.common.areYouSure}>
              <button className="btn danger">{t.company.cancelOrder}</button>
            </ActionForm>
          </div>
        </section>
      )}

      {order.status === "CLOSED" && <BidSelection order={order} t={t} unit={unit} />}

      {(order.status === "AWARDED" || order.status === "COMPLETED") && (
        <Assignments order={order} t={t} lang={lang} unit={unit} />
      )}

      <Repeat order={order} t={t} />
    </>
  );
}

// Байнгын чиглэл: ижил зарыг дахин нийтлэх эсвэл загвар болгох
function Repeat({ order, t }: { order: FullOrder; t: Dict }) {
  return (
    <section className="card stack" style={{ marginTop: 16 }}>
      <div className="row between">
        <Link href={`/company/orders/new?from=${order.id}`} className="btn">
          ↻ {t.templates.repost}
        </Link>
        {order.template && (
          <Link href="/company/templates" className="badge blue">
            {fmt(t.templates.fromTemplate, { name: order.template.name })}
          </Link>
        )}
      </div>
      {!order.template && (
        <ActionForm action={saveTemplateFromOrder.bind(null, order.id)}>
          <div className="field">
            <label htmlFor="tplName">{t.templates.nameLabel}</label>
            <input id="tplName" name="name" placeholder={t.templates.namePlaceholder} required />
          </div>
          <button className="btn">{t.templates.saveFromOrder}</button>
        </ActionForm>
      )}
    </section>
  );
}

function BidSelection({ order, t, unit }: { order: FullOrder; t: Dict; unit: (p: number) => string }) {
  const bids = order.bids.filter((b) => b.status === "SUBMITTED");
  if (bids.length === 0) {
    return (
      <section className="card stack">
        <p className="muted">{t.company.noBids}</p>
        <ActionForm action={cancelOrder.bind(null, order.id)} confirmText={t.common.areYouSure}>
          <button className="btn danger">{t.company.cancelOrder}</button>
        </ActionForm>
      </section>
    );
  }
  return (
    <section className="card">
      <h2>{t.company.bidsTitle}</h2>
      <p className="alert info">
        {fmt(t.company.selectHint, { n: order.trucksNeeded, hours: RULES.CONFIRM_HOURS })}
      </p>
      <ActionForm action={awardBids.bind(null, order.id)}>
        <ul className="list">
          {bids.map((b, i) => (
            <li key={b.id}>
              <label className="row" style={{ alignItems: "flex-start", cursor: "pointer", flexWrap: "nowrap" }}>
                <input type="checkbox" name="bid" value={b.id} defaultChecked={i < order.trucksNeeded} />
                <span className="rank">{i + 1}</span>
                {b.driver.truckPhotoType && (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img src={`/api/drivers/${b.driver.id}/photo`} alt={t.auth.truckPhoto} className="cargo-thumb" loading="lazy" />
                )}
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span className="row between">
                    <span className="item-title num">{unit(b.price)}</span>
                    {isSuspended(b.driver) && <span className="badge red">{t.userStatus.SUSPENDED}</span>}
                  </span>
                  <span className="small" style={{ display: "block" }}>
                    {b.driver.user.name} · {b.driver.plateNo}
                    {b.driver.trailerPlateNo && ` + ${b.driver.trailerPlateNo}`}
                  </span>
                  <span className="muted small" style={{ display: "block" }}>
                    {t.company.record}:{" "}
                    {fmt(t.company.recordValue, {
                      done: b.driver.completedJobs,
                      noShow: b.driver.noShows,
                      expired: b.driver.expiredCount,
                    })}
                  </span>
                  {b.note && <span className="muted small" style={{ display: "block" }}>“{b.note}”</span>}
                </span>
              </label>
            </li>
          ))}
        </ul>
        <button className="btn primary block" style={{ marginTop: 12 }}>
          {t.company.award}
        </button>
      </ActionForm>
    </section>
  );
}

function Assignments({
  order,
  t,
  lang,
  unit,
}: {
  order: FullOrder;
  t: Dict;
  lang: "mn" | "en" | "zh";
  unit: (p: number) => string;
}) {
  const assigned = order.bids.filter(
    (b) => ASSIGNED.includes(b.status) && (b.status !== "RELEASED" || b.trips.length > 0 || b.payments.length > 0),
  );
  const waitlist = order.bids.filter((b) => b.status === "NOT_SELECTED").length;
  const approvedTons = order.bids
    .flatMap((b) => b.trips)
    .filter((tr) => tr.status === "APPROVED")
    .reduce((s, tr) => s + tr.tons, 0);
  const editable = order.status === "AWARDED";

  return (
    <>
      <section className="card stack">
        <div className="row between">
          <h2 style={{ margin: 0 }}>{t.order.progress}</h2>
          <span className="num">
            {tons(approvedTons)} / {tons(order.totalTons)}
          </span>
        </div>
        <Progress done={approvedTons} total={order.totalTons} />
        <p className="muted small">
          {t.company.remaining}: {tons(Math.max(0, order.totalTons - approvedTons))}
          {waitlist > 0 && ` · ${fmt(t.company.waitlist, { n: waitlist })}`}
        </p>
      </section>

      <h2>{t.company.assignmentsTitle}</h2>
      {assigned.map((b) => {
        const e = earnings(order, b, b.trips);
        const paid = b.payments.reduce((s, p) => s + p.amount, 0);
        return (
          <section key={b.id} className="card stack">
            <div className="row between">
              <div>
                <div className="item-title">
                  {b.driver.user.name} · {b.driver.plateNo}
                  {b.driver.trailerPlateNo && ` + ${b.driver.trailerPlateNo}`}
                </div>
                <div className="muted small num">
                  {unit(b.price)}
                  {b.status !== "SELECTED" && (
                    <>
                      {" · "}
                      {t.company.contact}: <a href={`tel:${b.driver.user.phone}`}>{b.driver.user.phone}</a>
                    </>
                  )}
                </div>
                {b.status !== "SELECTED" && (
                  <div className="small num">
                    💳 {t.company.bankAccount}: <b>{bankLabel(b.driver.bankName, lang)} {b.driver.bankAccount}</b>
                  </div>
                )}
              </div>
              <StatusBadge status={b.status} label={t.bidStatus[b.status as keyof Dict["bidStatus"]]} />
            </div>

            {b.status === "SELECTED" && b.confirmDeadline && (
              <p className="alert warn" style={{ margin: 0 }}>
                {fmt(t.company.waitingConfirm, { time: dateTime(b.confirmDeadline, lang) })}
              </p>
            )}

            {b.status !== "SELECTED" && (
              <dl className="kv">
                <dt>{t.company.approvedTons}</dt>
                <dd className="num">
                  {tons(e.approvedTons)} · {e.approvedTrips} {t.common.trips}
                </dd>
                <dt>{t.company.earned}</dt>
                <dd className="num">{money(e.amount)}</dd>
                <dt>{t.company.paid}</dt>
                <dd className="num">{money(paid)}</dd>
                <dt>{t.company.balance}</dt>
                <dd className="num" style={{ fontWeight: 700 }}>
                  {money(e.amount - paid)}
                </dd>
              </dl>
            )}

            {b.trips.length > 0 && (
              <details open={b.trips.some((tr) => tr.status === "SUBMITTED")}>
                <summary>
                  {t.company.tripsTitle} ({b.trips.length})
                </summary>
                <ul className="list" style={{ marginTop: 8 }}>
                  {b.trips.map((tr) => (
                    <li key={tr.id} className="row" style={{ alignItems: "flex-start" }}>
                      {tr.photoType && (
                        <a href={`/api/trips/${tr.id}/photo`} target="_blank" rel="noreferrer">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={`/api/trips/${tr.id}/photo`} alt={t.company.photo} className="thumb" />
                        </a>
                      )}
                      <div style={{ flex: 1 }}>
                        <div className="num">
                          <b>{tons(tr.tons)}</b> · {t.company.ticket} {tr.ticketNo}
                        </div>
                        <div className="muted small">{dateTime(tr.createdAt, lang)}</div>
                        <div style={{ marginTop: 4 }}>
                          <StatusBadge status={tr.status} label={t.tripStatus[tr.status as keyof Dict["tripStatus"]]} />
                        </div>
                      </div>
                      {tr.status === "SUBMITTED" && (
                        <div className="row">
                          <ActionForm action={reviewTrip.bind(null, tr.id, "APPROVED")}>
                            <button className="btn sm primary">{t.company.approve}</button>
                          </ActionForm>
                          <ActionForm action={reviewTrip.bind(null, tr.id, "REJECTED")} confirmText={t.common.areYouSure}>
                            <button className="btn sm danger">{t.company.reject}</button>
                          </ActionForm>
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              </details>
            )}

            {b.payments.length > 0 && (
              <ul className="list small">
                {b.payments.map((p) => (
                  <li key={p.id} className="row between">
                    <span className="num">
                      {money(p.amount)} · {dateTime(p.paidAt, lang)}
                      {p.note && <span className="muted"> · {p.note}</span>}
                    </span>
                    <span className={`badge ${p.receivedAt ? "green" : "amber"}`}>
                      {p.receivedAt ? t.company.received : t.company.notReceived}
                    </span>
                  </li>
                ))}
              </ul>
            )}

            {b.status !== "SELECTED" && (
              <details>
                <summary>{t.company.paymentTitle}</summary>
                <p className="muted small">{t.company.paymentNote}</p>
                <ActionForm action={recordPayment.bind(null, b.id)} resetOnOk>
                  <div className="grid2">
                    <div className="field">
                      <label htmlFor={`amount-${b.id}`}>{t.company.amount}</label>
                      <input
                        id={`amount-${b.id}`}
                        name="amount"
                        type="number"
                        inputMode="numeric"
                        min="1"
                        defaultValue={Math.max(0, e.amount - paid) || undefined}
                        required
                      />
                    </div>
                    <div className="field">
                      <label htmlFor={`note-${b.id}`}>{t.company.note}</label>
                      <input id={`note-${b.id}`} name="note" />
                    </div>
                  </div>
                  <button className="btn">{t.company.recordPayment}</button>
                </ActionForm>
              </details>
            )}

            {editable && b.status === "CONFIRMED" && (
              <ActionForm action={markNoShow.bind(null, b.id)} confirmText={t.company.noShowConfirm}>
                <button className="btn sm danger">{t.company.markNoShow}</button>
              </ActionForm>
            )}
          </section>
        );
      })}

      {editable && (
        <ActionForm action={completeOrder.bind(null, order.id)} confirmText={t.company.completeConfirm}>
          <button className="btn primary block">{t.company.complete}</button>
        </ActionForm>
      )}
    </>
  );
}
