import type { Order } from "@prisma/client";
import type { Dict } from "@/lib/i18n";
import type { Lang } from "@/lib/constants";
import { date, dateTime, orderCode, tons } from "@/lib/format";
import { cargoImage } from "@/lib/images";
import { StatusBadge } from "./StatusBadge";

type Props = { order: Order; companyName?: string; t: Dict; lang: Lang };

export function OrderSummary({ order, companyName, t, lang }: Props) {
  const cargo = t.cargo[order.cargoType as keyof Dict["cargo"]];
  return (
    <section className="card">
      <div className="order-banner">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={cargoImage(order.cargoType)} alt="" />
      </div>
      <div className="row between" style={{ marginBottom: 12 }}>
        <h1 style={{ margin: 0 }}>
          {cargo} · {tons(order.totalTons)}
        </h1>
        <StatusBadge status={order.status} label={t.orderStatus[order.status as keyof Dict["orderStatus"]]} />
      </div>
      <dl className="kv">
        <dt>№</dt>
        <dd className="num">{orderCode(order.code)}</dd>
        {companyName && (
          <>
            <dt>{t.order.company}</dt>
            <dd>{companyName}</dd>
          </>
        )}
        <dt>{t.order.route}</dt>
        <dd>
          {order.loadPlace} → {order.unloadPlace}
          {order.distanceKm ? ` (${order.distanceKm} км)` : ""}
          {order.routeNote && <div className="muted small">{order.routeNote}</div>}
        </dd>
        <dt>{t.order.region}</dt>
        <dd>{order.region}</dd>
        <dt>{t.order.truckType}</dt>
        <dd>
          {t.truck[order.truckType as keyof Dict["truck"]]} × {order.trucksNeeded}
        </dd>
        <dt>{t.order.priceUnit}</dt>
        <dd>{order.priceUnit === "PER_TON" ? t.order.perTonLong : t.order.perTripLong}</dd>
        <dt>{t.order.period}</dt>
        <dd>
          {date(order.startDate, lang)} — {date(order.endDate, lang)}
        </dd>
        <dt>{t.order.closesAt}</dt>
        <dd>{dateTime(order.biddingClosesAt, lang)}</dd>
        {order.description && (
          <>
            <dt>{t.order.description}</dt>
            <dd style={{ whiteSpace: "pre-wrap" }}>{order.description}</dd>
          </>
        )}
      </dl>
    </section>
  );
}

export function Progress({ done, total }: { done: number; total: number }) {
  const pct = total > 0 ? Math.min(100, (done / total) * 100) : 0;
  return (
    <div className="progress" role="progressbar" aria-valuenow={Math.round(pct)} aria-valuemin={0} aria-valuemax={100}>
      <div style={{ width: `${pct}%` }} />
    </div>
  );
}
