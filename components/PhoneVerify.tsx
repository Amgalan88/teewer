"use client";

import { useEffect, useRef, useState } from "react";
import { checkPhoneVerification, startPhoneVerification, type VerifyStart } from "@/app/actions/verify";

type Labels = {
  phone: string;
  button: string;
  instruction: string;
  openSms: string;
  waiting: string;
  expiresIn: string;
  verified: string;
  expired: string;
  change: string;
  retry: string;
  cost: string;
  mock: string;
  ownPhone: string;
};

type Session = Extract<VerifyStart, { ok: true }>;
type Stage = "idle" | "starting" | "pending" | "verified" | "expired";

const POLL_MS = 3000;

function fill(s: string, vars: Record<string, string>) {
  return s.replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? `{${k}}`);
}

export function PhoneVerify({ labels }: { labels: Labels }) {
  const [phone, setPhone] = useState("");
  const [stage, setStage] = useState<Stage>("idle");
  const [session, setSession] = useState<Session | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [left, setLeft] = useState(0);
  const [ios, setIos] = useState(false);
  const checking = useRef(false);

  useEffect(() => {
    setIos(/iphone|ipad|ipod/i.test(navigator.userAgent));
  }, []);

  // SMS ирэхийг хүлээж байх үед тогтмол шалгана; SMS апп-аас буцаж ирэхэд шууд шалгана
  useEffect(() => {
    if (stage !== "pending" || !session) return;
    const check = async () => {
      if (checking.current) return;
      checking.current = true;
      try {
        const status = await checkPhoneVerification(session.id);
        if (status === "VERIFIED") setStage("verified");
        if (status === "EXPIRED") setStage("expired");
      } catch {
        // сүлжээний түр алдаа: дараагийн удаа дахин шалгана
      } finally {
        checking.current = false;
      }
    };
    const timer = window.setInterval(check, POLL_MS);
    const onVisible = () => document.visibilityState === "visible" && check();
    document.addEventListener("visibilitychange", onVisible);
    const tick = window.setInterval(() => {
      const ms = new Date(session.expiresAt).getTime() - Date.now();
      setLeft(Math.max(0, Math.floor(ms / 1000)));
      if (ms <= 0) setStage("expired");
    }, 1000);
    return () => {
      window.clearInterval(timer);
      window.clearInterval(tick);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [stage, session]);

  async function start() {
    setError(null);
    setStage("starting");
    try {
      const res = await startPhoneVerification(phone);
      if (!res.ok) {
        setError(res.error);
        setStage("idle");
        return;
      }
      setSession(res);
      setLeft(Math.floor((new Date(res.expiresAt).getTime() - Date.now()) / 1000));
      setStage("pending");
    } catch {
      setStage("idle");
    }
  }

  function reset() {
    setSession(null);
    setStage("idle");
    setError(null);
  }

  const locked = stage === "pending" || stage === "verified" || stage === "starting";
  const smsHref = session ? `sms:${session.shortcode}${ios ? "&" : "?"}body=${encodeURIComponent(session.code)}` : "#";
  const mmss = `${Math.floor(left / 60)}:${String(left % 60).padStart(2, "0")}`;

  return (
    <div className="field">
      <label htmlFor="phone">{labels.phone}</label>
      <div className="row" style={{ flexWrap: "nowrap" }}>
        <input
          id="phone"
          name="phone"
          type="tel"
          inputMode="numeric"
          autoComplete="tel"
          required
          value={phone}
          readOnly={locked}
          onChange={(e) => setPhone(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && stage === "idle") {
              e.preventDefault();
              start();
            }
          }}
        />
        {stage === "idle" || stage === "starting" ? (
          <button type="button" className="btn primary" onClick={start} disabled={stage === "starting" || !phone.trim()}>
            {labels.button}
          </button>
        ) : (
          <button type="button" className="btn" onClick={reset}>
            {labels.change}
          </button>
        )}
      </div>
      {error && (
        <p className="alert error" role="alert" style={{ marginTop: 6 }}>
          {error}
        </p>
      )}

      {stage === "pending" && session && (
        <div className="verify-box" aria-live="polite">
          {session.mock && (
            <p className="badge amber" style={{ margin: "0 0 10px", whiteSpace: "normal", display: "block", borderRadius: 8 }}>
              {labels.mock}
            </p>
          )}
          <p style={{ margin: 0 }}>{fill(labels.instruction, { phone, shortcode: session.shortcode })}</p>
          <div className="verify-code">
            <span className="verify-to">→ {session.shortcode}</span>
            <span className="verify-digits">{session.code}</span>
          </div>
          <a className="btn primary block" href={smsHref}>
            ✉ {labels.openSms}
          </a>
          <div className="row between small muted" style={{ marginTop: 10 }}>
            <span className="row" style={{ gap: 6 }}>
              <span className="spinner" aria-hidden="true" /> {labels.waiting}
            </span>
            <span className="num">{fill(labels.expiresIn, { time: mmss })}</span>
          </div>
          <p className="muted small" style={{ margin: "8px 0 0" }}>
            {labels.ownPhone} {labels.cost}
          </p>
        </div>
      )}

      {stage === "verified" && session && (
        <>
          <p className="alert ok" style={{ marginTop: 6 }}>
            ✓ {labels.verified}
          </p>
          <input type="hidden" name="verificationId" value={session.id} />
        </>
      )}

      {stage === "expired" && (
        <p className="alert error" style={{ marginTop: 6 }}>
          {labels.expired}{" "}
          <button type="button" className="linkbtn" onClick={reset} style={{ color: "inherit", textDecoration: "underline" }}>
            {labels.retry}
          </button>
        </p>
      )}
    </div>
  );
}
