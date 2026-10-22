import Link from "next/link";
import { getT } from "@/lib/i18n";
import { ActionForm } from "@/components/ActionForm";
import { AuthSide } from "@/components/AuthSide";
import { login } from "../actions/auth";

export default async function LoginPage() {
  const { t } = await getT();
  const L = t.landing;
  return (
    <div className="auth">
      <AuthSide image="/images/mine.webp" title={L.hero} points={[L.trust1, L.trust2, L.trust3]} />
      <div>
        <h1>{t.auth.loginTitle}</h1>
        <div className="card">
          <ActionForm action={login}>
            <div className="field">
              <label htmlFor="phone">{t.common.phone}</label>
              <input id="phone" name="phone" type="tel" inputMode="numeric" autoComplete="tel" required />
            </div>
            <div className="field">
              <label htmlFor="password">{t.common.password}</label>
              <input id="password" name="password" type="password" autoComplete="current-password" required />
            </div>
            <button className="btn primary block lg">{t.auth.loginTitle}</button>
          </ActionForm>
        </div>
        <p className="muted">
          {t.auth.noAccount} <Link href="/register">{t.nav.register}</Link>
        </p>
      </div>
    </div>
  );
}
