import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { fmt, getT, type Dict } from "@/lib/i18n";
import { date, num, orderCode, tons } from "@/lib/format";
import { tenderStats } from "@/lib/stats";
import { runMaintenance } from "@/lib/workflow";
import { ActionForm } from "@/components/ActionForm";
import { StatusBadge } from "@/components/StatusBadge";
import { deleteTemplate, publishTemplate } from "@/app/actions/company";

export default async function TemplatesPage() {
  const user = await requireRole("COMPANY");
  await runMaintenance();
  const { t, lang } = await getT();
  const companyId = user.company!.id;

  const [templates, stats] = await Promise.all([
    prisma.orderTemplate.findMany({ where: { companyId }, orderBy: { createdAt: "asc" } }),
    tenderStats({ companyId, templateId: { not: null } }),
  ]);

  return (
    <>
      <h1>{t.templates.title}</h1>
      <p className="alert info">{t.templates.hint}</p>
      {templates.length === 0 && <p className="muted">{t.templates.empty}</p>}

      {templates.map((tpl) => {
        const history = stats.filter((s) => s.templateId === tpl.id);
        const unit = tpl.priceUnit === "PER_TON" ? t.common.perTon : t.common.perTrip;
        return (
          <section key={tpl.id} className="card stack">
            <div className="row between">
              <h2 style={{ margin: 0 }}>{tpl.name}</h2>
              <span className="badge gray">{fmt(t.templates.tenders, { n: history.length })}</span>
            </div>
            <div>
              <div>
                {t.cargo[tpl.cargoType as keyof Dict["cargo"]]} · {tons(tpl.totalTons)} · {tpl.loadPlace} →{" "}
                {tpl.unloadPlace}
              </div>
              <div className="muted small">
                {fmt(t.templates.schedule, { hours: tpl.biddingHours, days: tpl.durationDays, trucks: tpl.trucksNeeded })}{" "}
                · {unit}
              </div>
            </div>
            <div className="row">
              <ActionForm action={publishTemplate.bind(null, tpl.id)} confirmText={t.templates.publishConfirm}>
                <button className="btn primary">{t.templates.publishNow}</button>
              </ActionForm>
              <Link href={`/company/orders/new?template=${tpl.id}`} className="btn">
                {t.templates.editPublish}
              </Link>
              <ActionForm action={deleteTemplate.bind(null, tpl.id)} confirmText={t.common.areYouSure}>
                <button className="linkbtn">{t.templates.delete}</button>
              </ActionForm>
            </div>

            <h3 style={{ marginTop: 16 }}>{t.templates.history}</h3>
            {history.length === 0 ? (
              <p className="muted small">{t.templates.noHistory}</p>
            ) : (
              <div className="table-wrap">
                <table className="table num">
                  <thead>
                    <tr>
                      <th>{t.templates.colDate}</th>
                      <th>{t.common.status}</th>
                      <th className="r">{t.templates.colBids}</th>
                      <th className="r">
                        {t.templates.colLow}, {unit}
                      </th>
                      <th className="r">
                        {t.templates.colAwarded}, {unit}
                      </th>
                      <th className="r">{t.templates.colDelivered}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {history.map((h) => (
                      <tr key={h.id}>
                        <td>
                          <Link href={`/company/orders/${h.id}`}>{orderCode(h.code)}</Link>
                          <div className="muted small">{date(h.createdAt, lang)}</div>
                        </td>
                        <td>
                          <StatusBadge status={h.status} label={t.orderStatus[h.status as keyof Dict["orderStatus"]]} />
                        </td>
                        <td className="r">{h.bids}</td>
                        <td className="r">{h.low !== null ? num(h.low) : "—"}</td>
                        <td className="r">{h.awardedAvg !== null ? num(h.awardedAvg) : "—"}</td>
                        <td className="r">{h.delivered > 0 ? tons(h.delivered) : "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        );
      })}
    </>
  );
}
