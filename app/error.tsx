"use client";

// Хуудасны алдаа: хэрэглэгчид ойлгомжтой мессеж, админд хайх код (digest)
export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="narrow card" style={{ textAlign: "center" }}>
      <h1>Алдаа гарлаа</h1>
      <p className="muted">
        Уучлаарай, сервер дээр алдаа гарлаа. Түр хүлээгээд дахин оролдоно уу.
        <br />
        Something went wrong on our side. Please try again.
      </p>
      <div className="row" style={{ justifyContent: "center", marginTop: 16 }}>
        <button className="btn primary" onClick={() => reset()}>
          Дахин оролдох
        </button>
        <a className="btn" href="/">
          Нүүр хуудас
        </a>
      </div>
      {error.digest && (
        <p className="muted small" style={{ marginTop: 16 }}>
          Алдааны код: <code>{error.digest}</code>
        </p>
      )}
    </div>
  );
}
