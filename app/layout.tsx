import type { Metadata, Viewport } from "next";
import Link from "next/link";
import { Inter, Manrope } from "next/font/google";
import "./globals.css";
import { getUser } from "@/lib/auth";
import { getT } from "@/lib/i18n";
import { LANGS } from "@/lib/constants";
import { logout, setLang } from "./actions/auth";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getT();
  return {
    title: t.meta.title,
    description: t.meta.description,
    manifest: "/manifest.webmanifest",
    icons: {
      icon: [
        { url: "/icon.svg", type: "image/svg+xml" },
        { url: "/favicon-32.png", sizes: "32x32", type: "image/png" },
      ],
      apple: { url: "/apple-touch-icon.png", sizes: "180x180" },
    },
    appleWebApp: { capable: true, title: "Teewer.mn", statusBarStyle: "default" },
  };
}

export const viewport: Viewport = { themeColor: "#c2410c", width: "device-width", initialScale: 1 };

const langLabel = { mn: "MN", en: "EN", zh: "中文" } as const;

const inter = Inter({ subsets: ["latin", "cyrillic"], variable: "--font-inter", display: "swap" });
const manrope = Manrope({ subsets: ["latin", "cyrillic"], variable: "--font-manrope", display: "swap" });

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const { t, lang } = await getT();
  const user = await getUser();
  const active = user?.status === "ACTIVE";

  return (
    <html lang={lang} className={`${inter.variable} ${manrope.variable}`} suppressHydrationWarning>
      <head>
        {/* JS ажиллаж байгаа үед л гүйлгэлтийн хөдөлгөөнийг идэвхжүүлнэ */}
        <script dangerouslySetInnerHTML={{ __html: "document.documentElement.classList.add('js')" }} />
      </head>
      <body>
        <header className="topbar">
          <div className="wrap">
            <Link href="/" className="logo">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/icon.svg" alt="" width={30} height={30} />
              <span style={{ color: "inherit" }}>
                Teewer<span>.mn</span>
              </span>
            </Link>
            <nav className="nav">
              {active && user.role === "COMPANY" && (
                <>
                  <Link href="/company">{t.nav.myOrders}</Link>
                  <Link href="/company/orders/new">{t.nav.newOrder}</Link>
                  <Link href="/company/templates">{t.nav.templates}</Link>
                </>
              )}
              {active && user.role === "DRIVER" && <Link href="/driver">{t.nav.tenders}</Link>}
              {user?.role === "ADMIN" && <Link href="/admin">{t.nav.admin}</Link>}
            </nav>
            <div className="topbar-right">
              <form action={setLang} className="langs">
                {LANGS.map((l) => (
                  <button key={l} name="lang" value={l} aria-pressed={l === lang}>
                    {langLabel[l]}
                  </button>
                ))}
              </form>
              {user ? (
                <form action={logout}>
                  <button className="linkbtn" title={user.name}>
                    {t.nav.logout}
                  </button>
                </form>
              ) : (
                <Link href="/login" className="btn sm">
                  {t.nav.login}
                </Link>
              )}
            </div>
          </div>
        </header>
        <main>
          <div className="wrap">{children}</div>
        </main>
        <footer>
          <div className="wrap">
            <span>
              © Teewer.mn · {t.common.pilot}
            </span>
            <Link href="/credits">{t.credits.title}</Link>
          </div>
        </footer>
      </body>
    </html>
  );
}
