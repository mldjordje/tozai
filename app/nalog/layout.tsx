import type { Metadata } from "next";
import { redirect } from "next/navigation";
import AccountShell from "@/components/nalog/AccountShell";
import { getSessionUser } from "@/lib/auth/user-session";

export const metadata: Metadata = {
  title: "Nalog — TOZA AI",
  robots: { index: false, follow: false },
};

// Middleware already gates /nalog/*, but the layout reads the session anyway:
// it needs the user for the sidebar, and a second check costs nothing.
export default async function NalogLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getSessionUser();
  if (!user) redirect("/prijava?next=/nalog");

  return <AccountShell user={user}>{children}</AccountShell>;
}
