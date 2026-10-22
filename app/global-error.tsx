"use client";

// Ерөнхий загвар (layout) өөрөө алдаа өгсөн үед
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="mn">
      <body style={{ fontFamily: "system-ui, sans-serif", background: "#f5f3ef", color: "#1a1714", margin: 0 }}>
        <div style={{ maxWidth: 440, margin: "15vh auto", padding: 24, textAlign: "center" }}>
          <div style={{ fontSize: 40, fontWeight: 800, color: "#c2410c" }}>T.</div>
          <h1 style={{ fontSize: 22 }}>Алдаа гарлаа</h1>
          <p style={{ color: "#6b645d" }}>
            Уучлаарай, сервер дээр алдаа гарлаа. Түр хүлээгээд дахин оролдоно уу.
          </p>
          <button
            onClick={() => reset()}
            style={{ background: "#c2410c", color: "#fff", border: 0, borderRadius: 10, padding: "12px 20px", fontWeight: 700 }}
          >
            Дахин оролдох
          </button>
          {error.digest && <p style={{ color: "#6b645d", fontSize: 13, marginTop: 16 }}>Алдааны код: {error.digest}</p>}
        </div>
      </body>
    </html>
  );
}
