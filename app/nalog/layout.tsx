import type { Metadata } from "next";
import { redirect } from "next/navigation";
import AccountShell from "@/components/nalog/AccountShell";
import { getSessionUser } from "@/lib/auth/user-session";

export const metadata: Metadata = {
  title: "Nalog — TOZA AI",
  robots: { index: false, follow: false },
  manifest: "/manifest-nalog.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "TOZA Nalog",
  },
  icons: {
    icon: [{ url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" }],
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
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
