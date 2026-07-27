"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  Users,
  Tag,
  Images,
  HelpCircle,
  Mail,
  CalendarDays,
  FileText,
  BarChart3,
  Settings,
  ClipboardList,
  FolderKanban,
  Receipt,
  Menu,
  X,
} from "lucide-react";

type BadgeKey = "newMaterials" | "newRequests" | "unpaidOrders";

type NavItem = {
  href: string;
  label: string;
  icon: React.ComponentType<{ size?: number; strokeWidth?: number }>;
  /** Which live count, if any, lights this item up. */
  badge?: BadgeKey;
};

const NAV: NavItem[] = [
  { href: "/admin", label: "Pregled", icon: LayoutDashboard },
  { href: "/admin/projekti", label: "Projekti", icon: FolderKanban, badge: "newMaterials" },
  { href: "/admin/video-zahtevi", label: "Video upiti", icon: ClipboardList, badge: "newRequests" },
  { href: "/admin/porudzbine", label: "Porudžbine", icon: Receipt, badge: "unpaidOrders" },
  { href: "/admin/klijenti", label: "Klijenti", icon: Users },
  { href: "/admin/paketi", label: "Paketi", icon: Tag },
  { href: "/admin/portfolio", label: "Portfolio", icon: Images },
  { href: "/admin/faq", label: "FAQ", icon: HelpCircle },
  { href: "/admin/email-sabloni", label: "Email šabloni", icon: Mail },
  { href: "/admin/dostupnost", label: "Dostupnost", icon: CalendarDays },
  { href: "/admin/sadrzaj", label: "Sadržaj", icon: FileText },
  { href: "/admin/analitika", label: "Analitika", icon: BarChart3 },
  { href: "/admin/podesavanja", label: "Podešavanja", icon: Settings },
];

export function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const [badges, setBadges] = useState<Partial<Record<BadgeKey, number>>>({});

  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  // Unread counts, refreshed on navigation and every minute. A client sending
  // a WeTransfer link is the one event the studio must not miss, and nothing
  // else in the panel would surface it.
  useEffect(() => {
    let alive = true;
    const read = async () => {
      try {
        const response = await fetch("/api/admin/notifications", { cache: "no-store" });
        const data = await response.json();
        if (alive && data?.ok) setBadges(data.counts);
      } catch {
        /* a missing badge is not worth an error state */
      }
    };
    void read();
    const timer = setInterval(read, 60_000);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, [pathname]);

  const totalBadge =
    (badges.newMaterials ?? 0) + (badges.newRequests ?? 0) + (badges.unpaidOrders ?? 0);

  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setMenuOpen(false);
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [menuOpen]);

  const logout = async () => {
    await fetch("/api/admin/logout", { method: "POST" });
    router.replace("/admin/login");
  };

  const isActive = (href: string) =>
    href === "/admin" ? pathname === "/admin" : pathname.startsWith(href);

  return (
    <div className="adm__shell">
      <aside className="adm__side">
        <div className="adm__brand">
          TOZA AI <small>ADMIN</small>
        </div>
        <nav className="adm__nav">
          {NAV.map((item) => {
            const Icon = item.icon;
            const count = item.badge ? (badges[item.badge] ?? 0) : 0;
            return (
              <Link
                key={item.href}
                href={item.href}
                className="adm__nav-item"
                aria-current={isActive(item.href) ? "page" : undefined}
              >
                <Icon size={16} strokeWidth={1.6} />
                <span>{item.label}</span>
                {count > 0 && (
                  <em className="adm__nav-badge" aria-label={`${count} novo`}>
                    {count}
                  </em>
                )}
              </Link>
            );
          })}
        </nav>
        <button className="adm__logout adm__side-logout" onClick={logout}>
          Odjava
        </button>
      </aside>

      <div className="adm__body">
        <header className="adm__top adm__top--shell">
          <button
            type="button"
            className="adm__burger"
            aria-label={menuOpen ? "Zatvori meni" : "Otvori meni"}
            aria-expanded={menuOpen}
            aria-haspopup="true"
            onClick={() => setMenuOpen((v) => !v)}
          >
            {menuOpen ? <X size={20} strokeWidth={1.6} /> : <Menu size={20} strokeWidth={1.6} />}
            {!menuOpen && totalBadge > 0 && (
              <em className="adm__nav-badge adm__nav-badge--burger">{totalBadge}</em>
            )}
          </button>
          <div className="adm__brand adm__brand--mobile">
            TOZA AI <small>ADMIN</small>
          </div>
          <button className="adm__logout adm__top-logout" onClick={logout}>
            Odjava
          </button>
        </header>

        {menuOpen && (
          <div className="adm__mmenu" role="dialog" aria-modal="true" aria-label="Navigacija">
            <button
              type="button"
              className="adm__mmenu-backdrop"
              aria-label="Zatvori meni"
              onClick={() => setMenuOpen(false)}
            />
            <nav className="adm__mmenu-panel" aria-label="Glavna navigacija">
              {NAV.map((item) => {
                const Icon = item.icon;
                const count = item.badge ? (badges[item.badge] ?? 0) : 0;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className="adm__mmenu-item"
                    aria-current={isActive(item.href) ? "page" : undefined}
                  >
                    <Icon size={18} strokeWidth={1.6} />
                    <span>{item.label}</span>
                    {count > 0 && (
                      <em className="adm__nav-badge" aria-label={`${count} novo`}>
                        {count}
                      </em>
                    )}
                  </Link>
                );
              })}
            </nav>
          </div>
        )}

        <main className="adm__main">{children}</main>
      </div>
    </div>
  );
}
