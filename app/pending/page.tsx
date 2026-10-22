import { redirect } from "next/navigation";
import { getUser, homeFor } from "@/lib/auth";
import { getT } from "@/lib/i18n";
import { InstallApp } from "@/components/InstallApp";

export default async function PendingPage() {
  const user = await getUser();
  if (!user) redirect("/login");
  if (user.status === "ACTIVE" || user.role === "ADMIN") redirect(homeFor(user.role));
  const { t } = await getT();
  const suspended = user.status === "SUSPENDED";

  return (
    <div className="narrow">
      <div className="card">
        <h1>{suspended ? t.pending.suspendedTitle : t.pending.title}</h1>
        <p className="muted">{suspended ? t.pending.suspendedBody : t.pending.body}</p>
      </div>
      {/* баталгаажуулалт хүлээх хооронд суулгахад хамгийн тохиромжтой */}
      {!suspended && <InstallApp labels={t.install} />}
    </div>
  );
}
