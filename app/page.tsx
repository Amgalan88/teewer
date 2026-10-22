/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import { redirect } from "next/navigation";
import { getUser, homeFor } from "@/lib/auth";
import { fmt, getT } from "@/lib/i18n";
import { CARGO_TYPES, RULES } from "@/lib/constants";
import { cargoImage } from "@/lib/images";
import { Parallax, RevealObserver } from "@/components/Reveal";
import {
  IconBell,
  IconHandshake,
  IconLock,
  IconMegaphone,
  IconScale,
  IconTag,
  IconTicket,
  IconTrophy,
  TruckSvg,
} from "@/components/Icons";

// Гарчгийн сүүлчийн таслалаас хойших хэсгийг өнгөөр тодруулна
function splitAccent(text: string) {
  const i = Math.max(text.lastIndexOf(","), text.lastIndexOf("，"));
  if (i < 0) return { lead: "", accent: text };
  return { lead: text.slice(0, i + 1), accent: text.slice(i + 1).trim() };
}

export default async function Home() {
  const user = await getUser();
  if (user) redirect(user.status === "ACTIVE" || user.role === "ADMIN" ? homeFor(user.role) : "/pending");
  const { t } = await getT();
  const L = t.landing;
  const title = splitAccent(L.hero);
  const cargo = CARGO_TYPES.filter((c) => c !== "OTHER" && c !== "CEMENT");

  const steps = [
    { icon: <IconMegaphone />, title: L.step1Title, text: L.step1 },
    { icon: <IconTag />, title: L.step2Title, text: L.step2 },
    { icon: <IconTrophy />, title: L.step3Title, text: L.step3 },
    { icon: <IconScale />, title: L.step4Title, text: L.step4 },
  ];

  return (
    <div className="landing">
      <RevealObserver />
      <Parallax selector=".band > img" />

      {/* ── HERO ── */}
      <section className="hero">
        <img
          className="hero-bg"
          src="/images/hero.webp"
          srcSet="/images/hero-sm.webp 960w, /images/hero.webp 1920w"
          sizes="100vw"
          alt=""
          fetchPriority="high"
        />
        <div className="wrap">
          <div className="hero-in">
            <span className="pill">
              <span className="pulse-dot" />
              {L.badge}
            </span>
            <h1>
              {title.lead} <em>{title.accent}</em>
            </h1>
            <p className="hero-sub">{L.sub}</p>
            <div className="row">
              <Link href="/register?role=company" className="btn primary lg">
                {L.forCompany} →
              </Link>
              <Link href="/register?role=driver" className="btn ghost-light lg">
                {L.forDriver}
              </Link>
            </div>
            <ul className="trust">
              <li>
                <IconLock /> {L.trust1}
              </li>
              <li>
                <IconHandshake /> {L.trust2}
              </li>
              <li>
                <IconTicket /> {L.trust3}
              </li>
            </ul>
          </div>

          <aside className="demo-card" aria-label={L.demoLabel}>
            <div className="demo-label">{L.demoLabel}</div>
            <h3>
              {t.cargo.CONCENTRATE} · 1,000 {t.common.tons}
            </h3>
            <div className="muted small">
              {L.demoRoute} · {t.truck.DUMP} × 5
            </div>
            <ul className="bid-rows">
              {["Б", "Г", "Э", "Д"].map((a) => (
                <li key={a}>
                  <span className="av">{a}</span>
                  <span>{t.company.driver}</span>
                  <span className="sealed">
                    <IconLock size={14} />
                    <span className="sealed-bar" />
                  </span>
                </li>
              ))}
            </ul>
            <div className="demo-foot">
              <span className="muted">{L.demoSealed}</span>
              <span>
                <span className="demo-count">12</span> <span className="muted">{L.demoBids}</span>
              </span>
            </div>
          </aside>
        </div>
      </section>

      <div className="road-strip" aria-hidden="true">
        <TruckSvg />
      </div>

      {/* ── ХЭРХЭН АЖИЛЛАДАГ ── */}
      <section className="section">
        <div className="wrap">
          <div className="section-head" data-reveal>
            <div className="eyebrow">Teewer.mn</div>
            <h2>{L.howTitle}</h2>
            <p>{L.howSub}</p>
          </div>
          <div className="steps-grid">
            {steps.map((s, i) => (
              <article key={i} className="step" data-reveal style={{ "--d": `${i * 0.1}s` } as React.CSSProperties}>
                <span className="step-no">0{i + 1}</span>
                <div className="step-icon">{s.icon}</div>
                <h3>{s.title}</h3>
                <p>{s.text}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* ── АЧААНЫ ТӨРЛҮҮД ── */}
      <section className="section alt">
        <div className="wrap">
          <div className="section-head" data-reveal>
            <div className="eyebrow">{L.cargoTitle}</div>
            <h2>{L.cargoSub}</h2>
          </div>
          <div className="cargo-grid">
            {cargo.map((c, i) => (
              <figure
                key={c}
                className="cargo-tile"
                data-reveal
                style={{ margin: 0, "--d": `${(i % 4) * 0.08}s` } as React.CSSProperties}
              >
                <img src={cargoImage(c)} alt={t.cargo[c]} loading="lazy" width={720} height={540} />
                <span>{t.cargo[c]}</span>
              </figure>
            ))}
          </div>
          <p className="cargo-note" data-reveal>
            {fmt(L.notFor, { min: RULES.MIN_ORDER_TONS })}
          </p>
        </div>
      </section>

      {/* ── КОМПАНИД ── */}
      <section className="section">
        <div className="wrap split">
          <div className="split-img" data-reveal="left">
            <img src="/images/mine.webp" alt="" loading="lazy" width={1400} height={900} />
            <span className="chip-float">
              <IconLock /> {L.trust1}
            </span>
          </div>
          <div data-reveal="right">
            <div className="eyebrow">{L.companyTitle}</div>
            <h2>{L.companyLead}</h2>
            <ul className="checks">
              {[L.companyP1, L.companyP2, L.companyP3].map((p) => (
                <li key={p}>
                  <span className="tick">✓</span>
                  {p}
                </li>
              ))}
            </ul>
            <Link href="/register?role=company" className="btn primary">
              {L.forCompany} →
            </Link>
          </div>
        </div>
      </section>

      {/* ── ЖОЛООЧИД ── */}
      <section className="section alt">
        <div className="wrap split reverse">
          <div className="split-img" data-reveal="right">
            <img src="/images/loader.webp" alt="" loading="lazy" width={1200} height={800} />
            <span className="chip-float">
              <IconBell /> {L.driverP3}
            </span>
          </div>
          <div data-reveal="left">
            <div className="eyebrow">{L.driverTitle}</div>
            <h2>{L.driverLead}</h2>
            <ul className="checks">
              {[L.driverP1, L.driverP2, L.driverP3].map((p) => (
                <li key={p}>
                  <span className="tick">✓</span>
                  {p}
                </li>
              ))}
            </ul>
            <Link href="/register?role=driver" className="btn primary">
              {L.forDriver} →
            </Link>
          </div>
        </div>
      </section>

      {/* ── ДАРХАН ── */}
      <section className="band">
        <img src="/images/darkhan.webp" alt="" loading="lazy" />
        <div className="wrap" data-reveal>
          <span className="pill">
            <span className="pulse-dot" />
            {L.badge}
          </span>
          <h2 style={{ marginTop: 18 }}>{L.pilotTitle}</h2>
          <p>{L.pilotBody}</p>
        </div>
      </section>

      {/* ── ДУУДЛАГА ── */}
      <section className="band cta-band">
        <img src="/images/road.webp" alt="" loading="lazy" />
        <div className="wrap" data-reveal>
          <h2>{L.ctaTitle}</h2>
          <p>{L.ctaBody}</p>
          <div className="row" style={{ justifyContent: "center", marginTop: 24 }}>
            <Link href="/register?role=company" className="btn primary lg">
              {L.forCompany} →
            </Link>
            <Link href="/register?role=driver" className="btn ghost-light lg">
              {L.forDriver}
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
