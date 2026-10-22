/* eslint-disable @next/next/no-img-element */
import { getT } from "@/lib/i18n";
import credits from "@/lib/image-credits.json";

export default async function CreditsPage() {
  const { t } = await getT();
  return (
    <div style={{ maxWidth: 760 }}>
      <h1>{t.credits.title}</h1>
      <p className="muted">{t.credits.intro}</p>
      <ul className="list card">
        {credits.map((c) => (
          <li key={c.file} className="media-row">
            <img src={`/images/${c.file}`} alt="" className="cargo-thumb" loading="lazy" />
            <div className="small">
              <div className="item-title">{c.title}</div>
              <div className="muted">
                {t.credits.author}: {c.author || "—"} · {t.credits.license}:{" "}
                {c.licenseUrl ? <a href={c.licenseUrl}>{c.license}</a> : c.license} ·{" "}
                <a href={c.source}>{t.credits.source}</a>
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
