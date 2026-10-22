"use client";

/* eslint-disable @next/next/no-img-element */
import { useEffect, useRef, useState } from "react";

type Labels = {
  button: string;
  title: string;
  body: string;
  later: string;
  close: string;
  iosTitle: string;
  iosStep1: string;
  iosStep2: string;
  iosStep3: string;
  iosNote: string;
  androidTitle: string;
  androidStep1: string;
  androidStep2: string;
};

// Chromium-ийн суулгах үйл явдал (стандарт TS төрөлд байхгүй)
type InstallPromptEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };

const DISMISS_KEY = "teewer-install-dismissed";
const DISMISS_DAYS = 14;

function dismissedRecently() {
  try {
    const at = Number(localStorage.getItem(DISMISS_KEY));
    return at > 0 && Date.now() - at < DISMISS_DAYS * 86_400_000;
  } catch {
    return false;
  }
}

function rememberDismiss() {
  try {
    localStorage.setItem(DISMISS_KEY, String(Date.now()));
  } catch {
    // хувийн горимд хадгалах боломжгүй байж болно
  }
}

function detect() {
  const ua = navigator.userAgent;
  const ios = /iphone|ipad|ipod/i.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  const android = /android/i.test(ua);
  const standalone =
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true;
  return { ios, android, standalone };
}

// Safari-ийн «Хуваалцах» товчны дүрс
const ShareIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
    <path d="M12 3v12M8 7l4-4 4 4" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M6 11H5a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-8a1 1 0 0 0-1-1h-1" strokeLinecap="round" />
  </svg>
);
const PlusIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
    <rect x="3" y="3" width="18" height="18" rx="4" />
    <path d="M12 8v8M8 12h8" strokeLinecap="round" />
  </svg>
);
const DotsIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <circle cx="12" cy="5" r="2" />
    <circle cx="12" cy="12" r="2" />
    <circle cx="12" cy="19" r="2" />
  </svg>
);

export function InstallApp({ labels }: { labels: Labels }) {
  const [mode, setMode] = useState<"hidden" | "prompt" | "ios" | "android">("hidden");
  const [sheet, setSheet] = useState(false);
  const deferred = useRef<InstallPromptEvent | null>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const { ios, android, standalone } = detect();
    if (standalone || dismissedRecently()) return;

    // push мэдэгдэлд хэрэгтэй service worker-ийг урьдчилан бүртгэнэ
    navigator.serviceWorker?.register("/sw.js").catch(() => {});

    const onPrompt = (e: Event) => {
      e.preventDefault();
      deferred.current = e as InstallPromptEvent;
      setMode("prompt");
    };
    const onInstalled = () => setMode("hidden");
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);

    if (ios) setMode("ios");
    // Android дээр суулгах үйл явдал ирэхгүй бол (Firefox гэх мэт) гараар суулгах заавар үзүүлнэ
    const fallback = android ? window.setTimeout(() => setMode((m) => (m === "hidden" ? "android" : m)), 2500) : 0;

    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
      window.clearTimeout(fallback);
    };
  }, []);

  useEffect(() => {
    if (!sheet) return;
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setSheet(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [sheet]);

  if (mode === "hidden") return null;

  async function install() {
    if (mode === "prompt" && deferred.current) {
      await deferred.current.prompt();
      const { outcome } = await deferred.current.userChoice;
      deferred.current = null;
      if (outcome === "accepted") setMode("hidden");
      return;
    }
    setSheet(true);
  }

  function later() {
    rememberDismiss();
    setMode("hidden");
  }

  const steps =
    mode === "ios"
      ? [
          { icon: <ShareIcon />, text: labels.iosStep1 },
          { icon: <PlusIcon />, text: labels.iosStep2 },
          { icon: <img src="/icon-192.png" alt="" width={20} height={20} style={{ borderRadius: 5 }} />, text: labels.iosStep3 },
        ]
      : [
          { icon: <DotsIcon />, text: labels.androidStep1 },
          { icon: <PlusIcon />, text: labels.androidStep2 },
          { icon: <img src="/icon-192.png" alt="" width={20} height={20} style={{ borderRadius: 5 }} />, text: labels.iosStep3 },
        ];

  return (
    <>
      <section className="install-banner" aria-label={labels.title}>
        <img src="/icon-192.png" alt="" width={48} height={48} className="install-icon" />
        <div className="install-copy">
          <div className="item-title">{labels.title}</div>
          <div className="muted small">{labels.body}</div>
        </div>
        <div className="install-actions">
          <button type="button" className="btn primary sm" onClick={install}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden="true">
              <path d="M12 3v12M7 10l5 5 5-5M5 21h14" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            {labels.button}
          </button>
          <button type="button" className="linkbtn" onClick={later}>
            {labels.later}
          </button>
        </div>
      </section>

      {sheet && (
        <div className="sheet-backdrop" onClick={() => setSheet(false)}>
          <div
            className="sheet"
            role="dialog"
            aria-modal="true"
            aria-labelledby="install-sheet-title"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="row between" style={{ marginBottom: 12 }}>
              <h2 id="install-sheet-title" style={{ margin: 0 }}>
                {mode === "ios" ? labels.iosTitle : labels.androidTitle}
              </h2>
              <button ref={closeRef} type="button" className="linkbtn" onClick={() => setSheet(false)}>
                {labels.close} ✕
              </button>
            </div>
            <ol className="install-steps">
              {steps.map((s, i) => (
                <li key={i}>
                  <span className="install-step-no">{i + 1}</span>
                  <span className="install-step-icon">{s.icon}</span>
                  <span>{s.text}</span>
                </li>
              ))}
            </ol>
            {mode === "ios" && <p className="muted small" style={{ marginBottom: 0 }}>{labels.iosNote}</p>}
          </div>
        </div>
      )}
    </>
  );
}
