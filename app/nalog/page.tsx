import Link from "next/link";
import { getSessionUser } from "@/lib/auth/user-session";
import { getAccountOverview } from "@/lib/account";
import { getPublicPackages } from "@/lib/packages";
import PurchaseAgain from "@/components/nalog/PurchaseAgain";
import { Card, EmptyState, SectionTitle, Stat, StatusBadge } from "@/components/nalog/ui";
import {
  BOOKING_STATUS_LABEL,
  HOUR_KIND_LABEL,
  PROJECT_STATUS_LABEL,
  bookingTone,
  formatDate,
  formatDay,
  formatHours,
  formatMoney,
  projectTone,
} from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function NalogPage() {
  const user = (await getSessionUser())!;
  const [{ wallets, projects, upcoming, orders, invoices }, packages] = await Promise.all([
    getAccountOverview(user.uid),
    getPublicPackages(),
  ]);

  const activeProjects = projects.filter(
    (p) => p.status !== "isporuceno" && p.status !== "otkazano",
  );
  const educationHours = wallets.find((w) => w.kind === "education")?.remaining ?? 0;
  const nextSession = upcoming[0] ?? null;
  const unpaid = orders.filter((o) => o.status === "pending");
  const firstName = user.name?.split(" ")[0] ?? "";

  const isNew = projects.length === 0 && orders.length === 0 && wallets.length === 0;
  const videoPackages = packages.filter((pkg) => pkg.flow === "project" && pkg.slug);
  const educationPackages = packages.filter(
    (pkg) => pkg.flow === "hours" && pkg.grp === "education" && pkg.slug,
  );

  return (
    <div className="space-y-10">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-fg md:text-3xl">
          Zdravo{firstName ? `, ${firstName}` : ""}.
        </h1>
        <p className="mt-2 text-muted">Pregled tvojih projekata, sati i naloga.</p>
      </div>

      {isNew ? (
        <EmptyState
          title="Nalog je spreman, ali još nema aktivnosti."
          hint="Izaberi paket za AI video ili sate 1-na-1 edukacije da počneš."
          action={
            <Link
              href="/#paketi"
              className="rounded-full bg-accent px-5 py-2.5 text-sm font-medium text-white transition-opacity hover:opacity-90"
            >
              Pogledaj pakete
            </Link>
          }
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Stat
            label="Aktivni projekti"
            value={String(activeProjects.length)}
            hint={
              activeProjects.length === 0 ? "Nema projekata u izradi" : undefined
            }
          />
          <Stat
            label="Sati edukacije"
            value={formatHours(educationHours)}
            hint={educationHours === 0 ? "Wallet je prazan" : "Dostupno za zakazivanje"}
          />
          <Stat
            label="Sledeći termin"
            value={nextSession ? formatDay(nextSession.date) : "—"}
            hint={nextSession ? `${nextSession.start_slot} h` : "Nema zakazanih"}
          />
          <Stat
            label="Fakture"
            value={String(invoices.length)}
            hint={unpaid.length > 0 ? `${unpaid.length} čeka uplatu` : undefined}
          />
        </div>
      )}

      {unpaid.length > 0 && (
        <Card className="border-accent/30 bg-accent/5">
          <p className="text-sm text-fg">
            Imaš {unpaid.length}{" "}
            {unpaid.length === 1 ? "porudžbinu" : "porudžbine"} koje čekaju uplatu.
          </p>
          <Link
            href="/nalog/porudzbine"
            className="mt-3 inline-block text-sm text-accent-soft underline underline-offset-4"
          >
            Pogledaj porudžbine
          </Link>
        </Card>
      )}

      <PurchaseAgain
        videoPackages={videoPackages}
        educationPackages={educationPackages}
        isNew={isNew}
      />

      {activeProjects.length > 0 && (
        <section>
          <SectionTitle
            title="Projekti u toku"
            action={
              <Link
                href="/nalog/projekti"
                className="text-sm text-muted transition-colors hover:text-fg"
              >
                Svi projekti
              </Link>
            }
          />
          <div className="space-y-3">
            {activeProjects.slice(0, 3).map((p) => (
              <Link
                key={p.id}
                href={`/nalog/projekti/${p.id}`}
                className="block rounded-2xl border border-line bg-bg-elev/60 p-5 transition-colors hover:border-accent-soft/40"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <p className="truncate font-medium text-fg">{p.title}</p>
                    <p className="mt-1 text-sm text-faint">
                      Naručeno {formatDate(p.created_at)}
                      {p.due_date ? ` · rok ${formatDay(p.due_date)}` : ""}
                    </p>
                  </div>
                  <StatusBadge
                    label={PROJECT_STATUS_LABEL[p.status] ?? p.status}
                    tone={projectTone(p.status)}
                  />
                </div>
                {p.status === "onboarding" && !p.materials_method && (
                  <p className="mt-3 text-sm text-accent-soft">
                    Dodaj materijale da krenemo →
                  </p>
                )}
              </Link>
            ))}
          </div>
        </section>
      )}

      {upcoming.length > 0 && (
        <section>
          <SectionTitle
            title="Zakazani termini"
            action={
              <Link
                href="/nalog/edukacija"
                className="text-sm text-muted transition-colors hover:text-fg"
              >
                Edukacija
              </Link>
            }
          />
          <div className="space-y-3">
            {upcoming.slice(0, 3).map((b) => (
              <Card key={b.id}>
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <p className="font-medium text-fg">
                      {formatDay(b.date)} · {b.start_slot}
                    </p>
                    <p className="mt-1 text-sm text-faint">
                      {HOUR_KIND_LABEL[b.kind] ?? b.kind} · {formatHours(b.hours)}
                      {b.topic ? ` · ${b.topic}` : ""}
                    </p>
                  </div>
                  <StatusBadge
                    label={BOOKING_STATUS_LABEL[b.status] ?? b.status}
                    tone={bookingTone(b.status)}
                  />
                </div>
                {b.meet_url && (
                  <a
                    href={b.meet_url}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-3 inline-block text-sm text-accent-soft underline underline-offset-4"
                  >
                    Otvori link za sastanak
                  </a>
                )}
              </Card>
            ))}
          </div>
        </section>
      )}

      {invoices.length > 0 && (
        <section>
          <SectionTitle
            title="Poslednje fakture"
            action={
              <Link
                href="/nalog/fakture"
                className="text-sm text-muted transition-colors hover:text-fg"
              >
                Sve fakture
              </Link>
            }
          />
          <Card className="p-0">
            <ul className="divide-y divide-line">
              {invoices.slice(0, 4).map((inv) => (
                <li key={inv.id} className="flex items-center justify-between gap-4 px-5 py-4">
                  <div className="min-w-0">
                    <p className="truncate text-sm text-fg">{inv.number}</p>
                    <p className="text-sm text-faint">{formatDate(inv.created_at)}</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-4">
                    <span className="text-sm text-muted">
                      {formatMoney(inv.amount, inv.currency)}
                    </span>
                    {inv.pdf_url && (
                      <a
                        href={inv.pdf_url}
                        className="text-sm text-accent-soft underline underline-offset-4"
                      >
                        PDF
                      </a>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </Card>
        </section>
      )}
    </div>
  );
}
