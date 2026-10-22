import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getT, type Dict } from "@/lib/i18n";
import { dateTime, orderCode, tons } from "@/lib/format";
import { bankLabel } from "@/lib/constants";
import { isSuspended, runMaintenance } from "@/lib/workflow";
import { ActionForm } from "@/components/ActionForm";
import { StatusBadge } from "@/components/StatusBadge";
import { clearSuspension, setUserStatus } from "@/app/actions/admin";

export default async function AdminPage() {
  await requireRole("ADMIN");
  await runMaintenance();
  const { t, lang } = await getT();

  const [users, orders] = await Promise.all([
    prisma.user.findMany({
      where: { role: { not: "ADMIN" } },
      orderBy: [{ status: "asc" }, { createdAt: "desc" }],
      include: { company: true, driver: true },
    }),
    prisma.order.findMany({ orderBy: { createdAt: "desc" }, take: 20, include: { company: true } }),
  ]);
  const pending = users.filter((u) => u.status === "PENDING");
  const others = users.filter((u) => u.status !== "PENDING");

  const UserRow = ({ u }: { u: (typeof users)[number] }) => (
    <li className="stack">
      <div className="row between">
        <div className="media-row">
          {u.driver?.truckPhotoType && (
            <a href={`/api/drivers/${u.driver.id}/photo`} target="_blank" rel="noreferrer">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={`/api/drivers/${u.driver.id}/photo`} alt={t.auth.truckPhoto} className="cargo-thumb" />
            </a>
          )}
          <div>
          <div className="item-title">
            {u.company?.name ?? u.name} <span className="muted small">· {t.admin[u.role as "COMPANY" | "DRIVER"]}</span>
          </div>
          <div className="muted small num">
            {u.phone}
            {u.email && ` · ${u.email}`}
            {u.company && ` · ${t.auth.contactName}: ${u.name} · ${u.company.registerNo}`}
            {u.driver && ` · ${u.driver.plateNo}`}
            {u.driver?.trailerPlateNo && ` + ${u.driver.trailerPlateNo}`}
            {u.driver && ` · ${bankLabel(u.driver.bankName, lang)} ${u.driver.bankAccount}`}
          </div>
          {u.driver && (
            <div className="muted small">
              ✓ {u.driver.completedJobs} · ✗ {u.driver.noShows} · ⏱ {u.driver.expiredCount}
              {isSuspended(u.driver) && ` · ${t.userStatus.SUSPENDED} → ${dateTime(u.driver.suspendedUntil!, lang)}`}
            </div>
          )}
          </div>
        </div>
        <StatusBadge status={u.status} label={t.userStatus[u.status as keyof Dict["userStatus"]]} />
      </div>
      <div className="row">
        {u.status !== "ACTIVE" && (
          <ActionForm action={setUserStatus.bind(null, u.id, "ACTIVE")}>
            <button className="btn sm primary">{u.status === "PENDING" ? t.admin.approve : t.admin.activate}</button>
          </ActionForm>
        )}
        {u.status !== "SUSPENDED" && (
          <ActionForm action={setUserStatus.bind(null, u.id, "SUSPENDED")} confirmText={t.common.areYouSure}>
            <button className="btn sm danger">{t.admin.suspend}</button>
          </ActionForm>
        )}
        {u.driver && isSuspended(u.driver) && (
          <ActionForm action={clearSuspension.bind(null, u.driver.id)}>
            <button className="btn sm">{t.admin.clearSuspension}</button>
          </ActionForm>
        )}
      </div>
    </li>
  );

  return (
    <>
      <h1>{t.admin.title}</h1>
      <section className="card">
        <h2>
          {t.admin.pendingTitle} ({pending.length})
        </h2>
        {pending.length === 0 ? (
          <p className="muted">{t.common.none}</p>
        ) : (
          <ul className="list">
            {pending.map((u) => (
              <UserRow key={u.id} u={u} />
            ))}
          </ul>
        )}
      </section>

      <section className="card">
        <h2>{t.admin.ordersTitle}</h2>
        {orders.length === 0 ? (
          <p className="muted">{t.common.none}</p>
        ) : (
          <ul className="list">
            {orders.map((o) => (
              <li key={o.id} className="row between">
                <span className="small">
                  {orderCode(o.code)} · {o.company.name} · {t.cargo[o.cargoType as keyof Dict["cargo"]]}{" "}
                  {tons(o.totalTons)} · {o.loadPlace} → {o.unloadPlace}
                </span>
                <StatusBadge status={o.status} label={t.orderStatus[o.status as keyof Dict["orderStatus"]]} />
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="card">
        <h2>
          {t.admin.usersTitle} ({others.length})
        </h2>
        <ul className="list">
          {others.map((u) => (
            <UserRow key={u.id} u={u} />
          ))}
        </ul>
      </section>
      <p className="muted small">
        <Link href="/">Teewer.mn</Link>
      </p>
    </>
  );
}
