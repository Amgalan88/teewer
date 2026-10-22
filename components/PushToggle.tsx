"use client";

import { useEffect, useState } from "react";

type Labels = { enable: string; enabled: string; unsupported: string; denied: string };
type State = "idle" | "busy" | "on" | "unsupported" | "denied";

function keyToBytes(base64: string) {
  const padded = (base64 + "=".repeat((4 - (base64.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(padded);
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

async function save(sub: PushSubscription) {
  await fetch("/api/push/subscribe", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(sub),
  });
}

export function PushToggle({ labels }: { labels: Labels }) {
  const [state, setState] = useState<State>("idle");
  const key = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

  useEffect(() => {
    if (!key || !("serviceWorker" in navigator) || !("PushManager" in window)) {
      setState("unsupported");
      return;
    }
    navigator.serviceWorker
      .register("/sw.js")
      .then((reg) => reg.pushManager.getSubscription())
      .then(async (sub) => {
        if (sub) {
          await save(sub); // одоогийн хэрэглэгчтэй холбоно
          setState("on");
        } else if (Notification.permission === "denied") {
          setState("denied");
        }
      })
      .catch(() => setState("unsupported"));
  }, [key]);

  async function enable() {
    setState("busy");
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setState("denied");
        return;
      }
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: keyToBytes(key!),
      });
      await save(sub);
      setState("on");
    } catch {
      setState("unsupported");
    }
  }

  if (state === "on") return <span className="badge green">🔔 {labels.enabled}</span>;
  if (state === "unsupported") return <p className="muted small">{labels.unsupported}</p>;
  if (state === "denied") return <p className="muted small">{labels.denied}</p>;
  return (
    <button type="button" className="btn" onClick={enable} disabled={state === "busy"}>
      🔔 {labels.enable}
    </button>
  );
}
