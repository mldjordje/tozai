import Link from "next/link";
import { getSessionUser } from "@/lib/auth/user-session";
import { getPastBookings, getUpcomingBookings, getWalletBalances } from "@/lib/account";
import { Card, EmptyState, SectionTitle, StatusBadge } from "@/components/nalog/ui";
import { BookingCalendar } from "@/components/nalog/BookingCalendar";
import { CancelBooking } from "@/components/nalog/CancelBooking";
import { belgradeNow, CANCEL_CUTOFF_HOURS, minutesUntil } from "@/lib/booking-slots";
import {
  BOOKING_STATUS_LABEL,
  HOUR_KIND_LABEL,
  bookingTone,
  formatDay,
  formatHours,
} from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function EdukacijaPage() {
  const user = (await getSessionUser())!;
  const [wallets, upcoming, past] = await Promise.all([
    getWalletBalances(user.uid),
    getUpcomingBookings(user.uid),
    getPastBookings(user.uid),
  ]);

  const withHours = wallets.filter((w) => w.purchased > 0);
  const totalLeft = wallets.reduce((sum, w) => sum + w.remaining, 0);

  // The cancel cutoff is decided here rather than in the browser: the client's
  // clock is whatever the device says, and the API refuses on Belgrade time.
  const now = belgradeNow();
  const cancellable = (date: string, slot: string) =>
    (minutesUntil(date, slot, now) ?? -1) >= CANCEL_CUTOFF_HOURS * 60;

  return (
    <div className="space-y-10">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-fg">Edukacija</h1>
        <p className="mt-2 text-muted">
          Kupljeni sati stoje u wallet-u. Svaki zakazan termin skida sate sa stanja.
        </p>
      </div>

      {withHours.length === 0 ? (
        <EmptyState
          title="Wallet je prazan."
          hint="Kupi paket sati (2h / 5h / 10h / 20h) pa biraj termine kad ti odgovara."
          action={
            <Link
              href="/#edukacija"
              className="rounded-full bg-accent px-5 py-2.5 text-sm font-medium text-white transition-opacity hover:opacity-90"
            >
              Pogledaj pakete sati
            </Link>
          }
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {withHours.map((w) => (
            <Card key={w.kind}>
              <p className="text-xs uppercase tracking-[0.14em] text-faint">
                {HOUR_KIND_LABEL[w.kind] ?? w.kind}
              </p>
              <p className="mt-2 text-3xl font-semibold tracking-tight text-fg">
                {formatHours(w.remaining)}
              </p>
              <p className="mt-1 text-sm text-muted">
                Iskorišćeno {formatHours(w.used)} od {formatHours(w.purchased)}
              </p>
              <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-line">
                <div
                  className="h-full rounded-full bg-accent"
                  style={{
                    width: `${Math.min(100, Math.round((w.remaining / Math.max(w.purchased, 1)) * 100))}%`,
                  }}
                />
              </div>
            </Card>
          ))}
        </div>
      )}

      {totalLeft >= 1 && <BookingCalendar wallets={wallets} />}
      {totalLeft > 0 && totalLeft < 1 && (
        <Card className="border-accent/30 bg-accent/5">
          <p className="font-medium text-fg">Zakazivanje termina</p>
          <p className="mt-2 text-sm text-muted">
            Na stanju ti je ostalo manje od sat vremena — dopuni wallet da bi mogao da
            zakažeš termin.
          </p>
        </Card>
      )}

      <section>
        <SectionTitle title="Zakazani termini" />
        {upcoming.length === 0 ? (
          <Card>
            <p className="text-sm text-muted">Nemaš zakazanih termina.</p>
          </Card>
        ) : (
          <div className="space-y-3">
            {upcoming.map((b) => (
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
                {b.status === "zakazano" &&
                  (cancellable(b.date, b.start_slot) ? (
                    <CancelBooking id={b.id} />
                  ) : (
                    <p className="mt-3 text-sm text-faint">
                      Termin je bliži od {CANCEL_CUTOFF_HOURS}h — za izmenu nam se javi direktno.
                    </p>
                  ))}
              </Card>
            ))}
          </div>
        )}
      </section>

      {past.length > 0 && (
        <section>
          <SectionTitle title="Prethodni termini" />
          <Card className="p-0">
            <ul className="divide-y divide-line">
              {past.map((b) => (
                <li key={b.id} className="flex items-center justify-between gap-4 px-5 py-4">
                  <div className="min-w-0">
                    <p className="truncate text-sm text-fg">
                      {formatDay(b.date)} · {b.start_slot}
                    </p>
                    <p className="text-sm text-faint">
                      {formatHours(b.hours)}
                      {b.topic ? ` · ${b.topic}` : ""}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-4">
                    {b.recording_url && (
                      <a
                        href={b.recording_url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-sm text-accent-soft underline underline-offset-4"
                      >
                        Snimak
                      </a>
                    )}
                    <StatusBadge
                      label={BOOKING_STATUS_LABEL[b.status] ?? b.status}
                      tone={bookingTone(b.status)}
                    />
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
