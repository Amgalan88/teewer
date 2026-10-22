// Энгийн шугаман дүрс тэмдгүүд (stroke = currentColor)
type P = { size?: number };
const base = (size: number) => ({
  width: size,
  height: size,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
});

export const IconLock = ({ size = 18 }: P) => (
  <svg {...base(size)}>
    <rect x="4" y="11" width="16" height="10" rx="2" />
    <path d="M8 11V7a4 4 0 0 1 8 0v4" />
  </svg>
);
export const IconHandshake = ({ size = 18 }: P) => (
  <svg {...base(size)}>
    <path d="m11 17 2 2a1 1 0 1 0 3-3" />
    <path d="m14 14 2.5 2.5a1 1 0 1 0 3-3l-3.88-3.88a3 3 0 0 0-4.24 0l-.88.88a1 1 0 1 1-3-3l2.81-2.81a5.79 5.79 0 0 1 7.06-.87l.47.28a2 2 0 0 0 1.42.25L21 4" />
    <path d="m21 3 1 11h-2M3 3 2 14l6.5 6.5a1 1 0 1 0 3-3M3 4h8" />
  </svg>
);
export const IconTicket = ({ size = 18 }: P) => (
  <svg {...base(size)}>
    <path d="M3 7a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v2a2 2 0 0 0 0 4v2a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-2a2 2 0 0 0 0-4z" />
    <path d="M13 5v2M13 11v2M13 17v2" />
  </svg>
);
export const IconMegaphone = ({ size = 22 }: P) => (
  <svg {...base(size)}>
    <path d="m3 11 18-5v12L3 14v-3z" />
    <path d="M11.6 16.8a3 3 0 1 1-5.8-1.6" />
  </svg>
);
export const IconTag = ({ size = 22 }: P) => (
  <svg {...base(size)}>
    <path d="M12.6 2.6A2 2 0 0 0 11.2 2H4a2 2 0 0 0-2 2v7.2a2 2 0 0 0 .6 1.4l8.7 8.7a2.4 2.4 0 0 0 3.4 0l6.6-6.6a2.4 2.4 0 0 0 0-3.4z" />
    <circle cx="7.5" cy="7.5" r="1.5" />
  </svg>
);
export const IconTrophy = ({ size = 22 }: P) => (
  <svg {...base(size)}>
    <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6M18 9h1.5a2.5 2.5 0 0 0 0-5H18M4 22h16M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22" />
    <path d="M18 2H6v7a6 6 0 0 0 12 0V2z" />
  </svg>
);
export const IconScale = ({ size = 22 }: P) => (
  <svg {...base(size)}>
    <path d="m16 16 3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1zM2 16l3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1zM7 21h10M12 3v18M3 7h2c2 0 5-1 7-2 2 1 5 2 7 2h2" />
  </svg>
);
export const IconBell = ({ size = 18 }: P) => (
  <svg {...base(size)}>
    <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9M10.3 21a1.94 1.94 0 0 0 3.4 0" />
  </svg>
);

// Хажуу талаас харсан самосвал (замын хөдөлгөөнд)
export function TruckSvg() {
  return (
    <svg className="truck" viewBox="0 0 150 54" aria-hidden="true">
      <path d="M4 14h70l8 22H4z" fill="#f97316" />
      <path d="M8 10h62l4 6H6z" fill="#7c2d12" opacity=".6" />
      <path d="M84 18h26l14 12v12H84z" fill="#fafaf9" />
      <path d="M100 21h9l9 9h-18z" fill="#93c5fd" />
      <rect x="2" y="36" width="124" height="6" rx="2" fill="#44403c" />
      {[22, 46, 100].map((cx) => (
        <g key={cx} className="wheel">
          <circle cx={cx} cy={44} r={8} fill="#1c1917" />
          <circle cx={cx} cy={44} r={3} fill="#a8a29e" />
          <rect x={cx - 0.8} y={37} width={1.6} height={4} fill="#a8a29e" />
        </g>
      ))}
    </svg>
  );
}
