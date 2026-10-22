import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { fmt, getT } from "@/lib/i18n";
import { CARGO_TYPES, RULES, TRUCK_TYPES } from "@/lib/constants";
import { toInputDate, toInputDateTime } from "@/lib/format";
import { DAY, HOUR } from "@/lib/workflow";
import { templateDates, type OrderFields } from "@/lib/services/company";
import { ActionForm } from "@/components/ActionForm";
import { createOrder } from "@/app/actions/company";

type Prefill = OrderFields & {
  startDate: Date;
  endDate: Date;
  biddingClosesAt: Date;
  templateId?: string;
  templateName?: string;
};

// ?template=… эсвэл ?from=… (өмнөх зар) өгвөл маягтыг урьдчилан бөглөнө
async function loadPrefill(companyId: string, templateId?: string, fromId?: string): Promise<Prefill | null> {
  if (templateId) {
    const tpl = await prisma.orderTemplate.findUnique({ where: { id: templateId } });
    if (tpl?.companyId !== companyId) return null;
    return { ...tpl, ...templateDates(tpl), templateId: tpl.id, templateName: tpl.name };
  }
  if (fromId) {
    const order = await prisma.order.findUnique({ where: { id: fromId }, include: { template: true } });
    if (order?.companyId !== companyId) return null;
    const dates = templateDates({
      biddingHours: Math.max(1, Math.round((order.biddingClosesAt.getTime() - order.createdAt.getTime()) / HOUR)),
      durationDays: Math.max(1, Math.round((order.endDate.getTime() - order.startDate.getTime()) / DAY)),
    });
    return { ...order, ...dates, templateId: order.templateId ?? undefined, templateName: order.template?.name };
  }
  return null;
}

export default async function NewOrderPage({
  searchParams,
}: {
  searchParams: Promise<{ template?: string; from?: string }>;
}) {
  const user = await requireRole("COMPANY");
  const { t } = await getT();
  const sp = await searchParams;
  const p = await loadPrefill(user.company!.id, sp.template, sp.from);

  return (
    <div style={{ maxWidth: 640 }}>
      <h1>{t.company.newOrderTitle}</h1>
      {p?.templateName && <p className="badge blue">{fmt(t.templates.fromTemplate, { name: p.templateName })}</p>}
      <p className="alert info">{t.company.newOrderHint}</p>
      <div className="card">
        <ActionForm action={createOrder}>
          {p?.templateId && <input type="hidden" name="templateId" value={p.templateId} />}
          <div className="grid2">
            <div className="field">
              <label htmlFor="cargoType">{t.order.cargoType}</label>
              <select id="cargoType" name="cargoType" defaultValue={p?.cargoType} required>
                {CARGO_TYPES.map((c) => (
                  <option key={c} value={c}>
                    {t.cargo[c]}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label htmlFor="totalTons">{t.order.totalTons}</label>
              <input
                id="totalTons"
                name="totalTons"
                type="number"
                inputMode="decimal"
                min={RULES.MIN_ORDER_TONS}
                step="any"
                defaultValue={p?.totalTons}
                required
              />
            </div>
            <div className="field">
              <label htmlFor="loadPlace">{t.order.loadPlace}</label>
              <input id="loadPlace" name="loadPlace" defaultValue={p?.loadPlace} required />
            </div>
            <div className="field">
              <label htmlFor="unloadPlace">{t.order.unloadPlace}</label>
              <input id="unloadPlace" name="unloadPlace" defaultValue={p?.unloadPlace} required />
            </div>
          </div>
          <div className="field">
            <label htmlFor="routeNote">{t.order.routeNote}</label>
            <input id="routeNote" name="routeNote" defaultValue={p?.routeNote ?? ""} />
          </div>
          <div className="grid2">
            <div className="field">
              <label htmlFor="distanceKm">{t.order.distanceKm}</label>
              <input
                id="distanceKm"
                name="distanceKm"
                type="number"
                inputMode="decimal"
                min="0"
                step="any"
                defaultValue={p?.distanceKm ?? ""}
              />
            </div>
            <div className="field">
              <label htmlFor="truckType">{t.order.truckType}</label>
              <select id="truckType" name="truckType" defaultValue={p?.truckType} required>
                {TRUCK_TYPES.map((x) => (
                  <option key={x} value={x}>
                    {t.truck[x]}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label htmlFor="trucksNeeded">{t.order.trucksNeeded}</label>
              <input
                id="trucksNeeded"
                name="trucksNeeded"
                type="number"
                inputMode="numeric"
                min="1"
                max="100"
                defaultValue={p?.trucksNeeded ?? 5}
                required
              />
            </div>
            <div className="field">
              <span>{t.order.priceUnit}</span>
              <label className="check" style={{ marginBottom: 4 }}>
                <input type="radio" name="priceUnit" value="PER_TON" defaultChecked={p?.priceUnit !== "PER_TRIP"} />
                <span>{t.order.perTonLong}</span>
              </label>
              <label className="check" style={{ marginBottom: 0 }}>
                <input type="radio" name="priceUnit" value="PER_TRIP" defaultChecked={p?.priceUnit === "PER_TRIP"} />
                <span>{t.order.perTripLong}</span>
              </label>
            </div>
            <div className="field">
              <label htmlFor="startDate">{t.order.startDate}</label>
              <input
                id="startDate"
                name="startDate"
                type="date"
                defaultValue={p ? toInputDate(p.startDate) : undefined}
                required
              />
            </div>
            <div className="field">
              <label htmlFor="endDate">{t.order.endDate}</label>
              <input id="endDate" name="endDate" type="date" defaultValue={p ? toInputDate(p.endDate) : undefined} required />
            </div>
          </div>
          <div className="field">
            <label htmlFor="biddingClosesAt">{t.order.biddingClosesAt}</label>
            <input
              id="biddingClosesAt"
              name="biddingClosesAt"
              type="datetime-local"
              defaultValue={p ? toInputDateTime(p.biddingClosesAt) : undefined}
              required
            />
          </div>
          <div className="field">
            <label htmlFor="description">{t.order.description}</label>
            <textarea id="description" name="description" rows={3} defaultValue={p?.description ?? ""} />
          </div>
          {!p?.templateId && (
            <div className="card" style={{ background: "var(--bg)" }}>
              <label className="check">
                <input type="checkbox" name="saveTemplate" />
                <span>{t.templates.saveAsTemplate}</span>
              </label>
              <div className="field" style={{ marginBottom: 0 }}>
                <label htmlFor="templateName">{t.templates.nameLabel}</label>
                <input id="templateName" name="templateName" placeholder={t.templates.namePlaceholder} />
              </div>
            </div>
          )}
          <button className="btn primary block">{t.company.publish}</button>
        </ActionForm>
      </div>
    </div>
  );
}
