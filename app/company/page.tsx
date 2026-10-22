import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { fmt, getT, type Dict } from "@/lib/i18n";
import { dateTime, orderCode, tons } from "@/lib/format";
import { runMaintenance } from "@/lib/workflow";
import { cargoImage } from "@/lib/images";
import { StatusBadge } from "@/components/StatusBadge";
import { PushToggle } from "@/components/PushToggle";
import { InstallApp } from "@/components/InstallApp";
import { ActionForm } from "@/components/ActionForm";
import { publishTemplate } from "@/app/actions/company";

export default async function CompanyDashboard() {
  const user = await requireRole("COMPANY");
  await runMaintenance();
  const { t, lang } = await getT();

  const templates = await prisma.orderTemplate.findMany({
    where: { companyId: user.company!.id },
    orderBy: { createdAt: "asc" },
  });
  const orders = await prisma.order.findMany({
    where: { companyId: user.company!.id },
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { bids: { where: { status: { not: "WITHDRAWN" } } } } } },
  });

  return (
    <>
      <div className="row between" style={{ marginBottom: 16 }}>
        <h1 style={{ margin: 0 }}>{user.company!.name}</h1>
        <Link href="/company/orders/new" className="btn primary">
          + {t.nav.newOrder}
        </Link>
      </div>
      <div style={{ marginBottom: 16 }}>
        <PushToggle labels={t.push} />
      </div>
      <InstallApp labels={t.install} />
      {templates.length > 0 && (
        <section className="card">
          <div className="row between" style={{ marginBottom: 8 }}>
            <h2 style={{ margin: 0 }}>{t.templates.title}</h2>
            <Link href="/company/templates" className="small">
              {t.templates.history} →
            </Link>
          </div>
          <ul className="list">
            {templates.map((tpl) => (
              <li key={tpl.id} className="row between">
                <span>
                  <span className="item-title">{tpl.name}</span>
                  <span className="muted small" style={{ display: "block" }}>
                    {t.cargo[tpl.cargoType as keyof Dict["cargo"]]} · {tons(tpl.totalTons)} · {tpl.loadPlace} →{" "}
                    {tpl.unloadPlace}
                  </span>
                </span>
                <ActionForm action={publishTemplate.bind(null, tpl.id)} confirmText={t.templates.publishConfirm}>
                  <button className="btn sm primary">{t.templates.publishNow}</button>
                </ActionForm>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="card">
        <h2>{t.company.dashboardTitle}</h2>
        {orders.length === 0 ? (
          <p className="muted">{t.common.none}</p>
        ) : (
          <ul className="list">
            {orders.map((o) => (
              <li key={o.id}>
                <Link href={`/company/orders/${o.id}`} className="item-link media-row">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={cargoImage(o.cargoType)} alt="" className="cargo-thumb" loading="lazy" />
                  <div>
                    <div className="row between">
                      <span className="item-title">
                        {orderCode(o.code)} · {t.cargo[o.cargoType as keyof Dict["cargo"]]} · {tons(o.totalTons)}
                      </span>
                      <StatusBadge status={o.status} label={t.orderStatus[o.status as keyof Dict["orderStatus"]]} />
                    </div>
                    <div className="muted small">
                      {o.loadPlace} → {o.unloadPlace} · {fmt(t.company.bidsCount, { n: o._count.bids })} ·{" "}
                      {t.order.closesAt}: {dateTime(o.biddingClosesAt, lang)}
                    </div>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
