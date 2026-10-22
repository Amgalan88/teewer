import Link from "next/link";
import { getT } from "@/lib/i18n";
import { BANKS, bankLabel, type BankCode } from "@/lib/constants";
import { ActionForm } from "@/components/ActionForm";
import { AuthSide } from "@/components/AuthSide";
import { PhotoInput } from "@/components/PhotoInput";
import { PhoneVerify } from "@/components/PhoneVerify";
import { register } from "../actions/auth";

export default async function RegisterPage({ searchParams }: { searchParams: Promise<{ role?: string }> }) {
  const { t, lang } = await getT();
  const isDriver = (await searchParams).role === "driver";
  const L = t.landing;

  return (
    <div className="auth">
      <AuthSide
        image={isDriver ? "/images/register-driver.webp" : "/images/excavator.webp"}
        title={isDriver ? L.driverLead : L.companyLead}
        points={isDriver ? [L.driverP1, L.driverP2, L.driverP3] : [L.companyP1, L.companyP2, L.companyP3]}
      />
      <div>
        <h1>{t.auth.registerTitle}</h1>
        <nav className="tabs">
          <Link href="/register?role=company" aria-current={!isDriver ? "page" : undefined}>
            {t.auth.asCompany}
          </Link>
          <Link href="/register?role=driver" aria-current={isDriver ? "page" : undefined}>
            {t.auth.asDriver}
          </Link>
        </nav>
        <div className="card">
          <ActionForm action={register} key={isDriver ? "d" : "c"}>
            <input type="hidden" name="role" value={isDriver ? "DRIVER" : "COMPANY"} />
            {isDriver ? (
              <>
                <p className="muted small" style={{ marginTop: 0 }}>
                  {t.auth.driverIntro}
                </p>
                <Field name="name" label={t.auth.driverName} autoComplete="name" />
                <PhoneVerify labels={{ ...t.verify, phone: t.common.phone }} />
                <Field name="email" label={t.auth.email} type="email" autoComplete="email" required={false} />

                <div className="form-section">🚛 {t.auth.sectionTruck}</div>
                <div className="grid2">
                  <Field name="plateNo" label={t.auth.plateNo} placeholder="1234 ДАА" />
                  <Field name="trailerPlateNo" label={t.auth.trailerPlate} required={false} />
                </div>
                <div className="field">
                  <PhotoInput name="truckPhoto" label={t.auth.truckPhoto} hint={t.auth.truckPhotoHint} required />
                </div>

                <div className="form-section">💳 {t.company.bankAccount}</div>
                <div className="grid2">
                  <div className="field">
                    <label htmlFor="bankName">{t.auth.bank}</label>
                    <select id="bankName" name="bankName" required defaultValue="">
                      <option value="" disabled>
                        {t.auth.chooseBank}
                      </option>
                      {(Object.keys(BANKS) as BankCode[]).map((b) => (
                        <option key={b} value={b}>
                          {bankLabel(b, lang)}
                        </option>
                      ))}
                    </select>
                  </div>
                  <Field name="bankAccount" label={t.auth.bankAccount} inputMode="numeric" />
                </div>
                <div className="form-section">🔑 {t.auth.loginTitle}</div>
              </>
            ) : (
              <>
                <Field name="companyName" label={t.auth.companyName} autoComplete="organization" />
                <Field name="registerNo" label={t.auth.companyRegister} />
                <Field name="name" label={t.auth.contactName} autoComplete="name" />
                <PhoneVerify labels={{ ...t.verify, phone: t.common.phone }} />
              </>
            )}
            <Field name="password" label={t.common.password} type="password" autoComplete="new-password" minLength={6} />
            {isDriver && (
              <label className="check">
                <input type="checkbox" name="agree" required />
                <span>{t.auth.agree}</span>
              </label>
            )}
            <button className="btn primary block lg">{t.auth.registerTitle}</button>
          </ActionForm>
        </div>
        <p className="muted">
          {t.auth.haveAccount} <Link href="/login">{t.nav.login}</Link>
        </p>
      </div>
    </div>
  );
}

function Field({
  name,
  label,
  required = true,
  ...rest
}: { name: string; label: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div className="field">
      <label htmlFor={name}>{label}</label>
      <input id={name} name={name} required={required} {...rest} />
    </div>
  );
}
