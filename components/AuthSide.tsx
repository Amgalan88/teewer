/* eslint-disable @next/next/no-img-element */

// Нэвтрэх/бүртгүүлэх хуудасны зурагтай хажуу хэсэг (өргөн дэлгэц дээр)
export function AuthSide({ image, title, points }: { image: string; title: string; points: string[] }) {
  return (
    <aside className="auth-side" aria-hidden="true">
      <img src={image} alt="" />
      <div className="auth-copy">
        <h2>{title}</h2>
        <ul>
          {points.map((p) => (
            <li key={p}>{p}</li>
          ))}
        </ul>
      </div>
    </aside>
  );
}
