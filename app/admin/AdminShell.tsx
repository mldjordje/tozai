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
  Menu,
  X,
} from "lucide-react";

type NavItem = {
  href: string;
  label: string;
  icon: React.ComponentType<{ size?: number; strokeWidth?: number }>;
};

const NAV: NavItem[] = [
  { href: "/admin", label: "Pregled", icon: LayoutDashboard },
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

  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

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
            return (
              <Link
                key={item.href}
                href={item.href}
                className="adm__nav-item"
                aria-current={isActive(item.href) ? "page" : undefined}
              >
                <Icon size={16} strokeWidth={1.6} />
                <span>{item.label}</span>
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
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className="adm__mmenu-item"
                    aria-current={isActive(item.href) ? "page" : undefined}
                  >
                    <Icon size={18} strokeWidth={1.6} />
                    <span>{item.label}</span>
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
