"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";
import {
  CalendarClock,
  ClipboardList,
  FileText,
  LayoutDashboard,
  LogOut,
  Menu,
  Receipt,
  Sparkles,
  UserRound,
  X,
} from "lucide-react";
import type { SessionUser } from "@/lib/auth/user-token";
import BrandLogo from "@/components/brand/Logo";

const LINKS = [
  { href: "/nalog", label: "Pregled", icon: LayoutDashboard },
  { href: "/nalog/projekti", label: "Projekti", icon: Sparkles },
  { href: "/nalog/zahtevi", label: "Upiti i procene", icon: ClipboardList },
  { href: "/nalog/edukacija", label: "Edukacija", icon: CalendarClock },
  { href: "/nalog/porudzbine", label: "Porudžbine", icon: Receipt },
  { href: "/nalog/fakture", label: "Fakture", icon: FileText },
  { href: "/nalog/profil", label: "Profil", icon: UserRound },
];

function initials(user: SessionUser) {
  const source = user.name?.trim() || user.email;
  return source
    .split(/[\s@.]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

export default function AccountShell({
  user,
  children,
}: {
  user: SessionUser;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);

  // "/nalog" must not light up for every child route, the rest match by prefix.
  const isActive = (href: string) =>
    href === "/nalog" ? pathname === "/nalog" : pathname.startsWith(href);

  const nav = (
    <nav className="flex flex-col gap-1">
      {LINKS.map(({ href, label, icon: Icon }) => (
        <Link
          key={href}
          href={href}
          onClick={() => setMenuOpen(false)}
          aria-current={isActive(href) ? "page" : undefined}
          className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-colors duration-200 ${
            isActive(href)
              ? "bg-accent/10 text-fg"
              : "text-muted hover:bg-line/50 hover:text-fg"
          }`}
        >
          <Icon size={17} strokeWidth={1.75} aria-hidden />
          {label}
        </Link>
      ))}
    </nav>
  );

  return (
    <div className="min-h-screen select-text bg-bg text-fg">
      {/* Mobile top bar */}
      <header className="sticky top-0 z-40 flex items-center justify-between border-b border-line bg-bg/90 px-4 py-3 backdrop-blur-md md:hidden">
        <Link href="/" aria-label="TOZA AI — početna" className="text-base">
          <BrandLogo markClassName="size-7" />
        </Link>
        <button
          type="button"
          onClick={() => setMenuOpen((v) => !v)}
          aria-label={menuOpen ? "Zatvori meni" : "Otvori meni"}
          aria-expanded={menuOpen}
          className="rounded-lg border border-line p-2 text-muted"
        >
          {menuOpen ? <X size={18} /> : <Menu size={18} />}
        </button>
      </header>

      {menuOpen && (
        <div className="border-b border-line bg-bg-elev px-4 py-4 md:hidden">{nav}</div>
      )}

      <div className="mx-auto flex w-full max-w-7xl gap-8 px-4 py-6 md:px-8 md:py-10">
        {/* Desktop sidebar */}
        <aside className="sticky top-10 hidden h-fit w-56 shrink-0 md:block">
          <Link href="/" aria-label="TOZA AI — početna" className="mb-8 block text-lg">
            <BrandLogo markClassName="size-8" />
          </Link>
          {nav}
          <div className="mt-8 border-t border-line pt-5">
            <div className="flex items-center gap-3">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-line text-xs font-semibold text-muted">
                {initials(user)}
              </span>
              <span className="min-w-0">
                <span className="block truncate text-sm text-fg">
                  {user.name ?? "Nalog"}
                </span>
                <span className="block truncate text-xs text-faint">{user.email}</span>
              </span>
            </div>
            <a
              href="/api/auth/logout"
              className="mt-4 flex items-center gap-2 text-sm text-faint transition-colors hover:text-fg"
            >
              <LogOut size={15} strokeWidth={1.75} aria-hidden />
              Odjavi se
            </a>
          </div>
        </aside>

        <main className="min-w-0 flex-1 pb-16">{children}</main>
      </div>
    </div>
  );
}
