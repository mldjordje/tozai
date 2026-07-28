"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { MAX_BOOKING_HOURS, startsFor } from "@/lib/booking-slots";
import { formatHours, HOUR_KIND_LABEL } from "@/lib/format";

// The buyer picks a session out of the studio's open hours.
//
// Free slots come from the server (/api/nalog/dostupnost) already stripped of
// booked and past hours; the only thing computed here is which of them can
// *start* a session of the chosen length, using the same helper the API
// validates with — so the calendar never offers a slot the POST would refuse.

type Day = { date: string; slots: string[] };

type Wallet = { kind: string; remaining: number };

const WEEKDAYS = ["Pon", "Uto", "Sre", "Čet", "Pet", "Sub", "Ned"];

function monthKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function shiftMonth(month: string, delta: number) {
  const [y, m] = month.split("-").map(Number);
  return monthKey(new Date(y, m - 1 + delta, 1));
}

function monthLabel(month: string) {
  const [y, m] = month.split("-").map(Number);
  return new Intl.DateTimeFormat("sr-Latn-RS", { month: "long", year: "numeric" }).format(
    new Date(y, m - 1, 1),
  );
}

function monthCells(month: string): (string | null)[] {
  const [y, m] = month.split("-").map(Number);
  const total = new Date(y, m, 0).getDate();
  const lead = (new Date(y, m - 1, 1).getDay() + 6) % 7; // Monday-first
  const cells: (string | null)[] = Array.from({ length: lead }, () => null);
  for (let d = 1; d <= total; d += 1) cells.push(`${month}-${String(d).padStart(2, "0")}`);
  return cells;
}

export function BookingCalendar({ wallets }: { wallets: Wallet[] }) {
  const router = useRouter();
  const bookable = wallets.filter((w) => w.remaining >= 1);

  const [kind, setKind] = useState(bookable[0]?.kind ?? "education");
  const [month, setMonth] = useState(() => monthKey(new Date()));
  const [days, setDays] = useState<Day[]>([]);
  const [loading, setLoading] = useState(true);
  const [date, setDate] = useState<string | null>(null);
  const [hours, setHours] = useState(1);
  const [slot, setSlot] = useState<string | null>(null);
  const [topic, setTopic] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  const balance = bookable.find((w) => w.kind === kind)?.remaining ?? 0;
  const maxHours = Math.max(1, Math.min(MAX_BOOKING_HOURS, Math.floor(balance)));

  const load = useCallback(async (m: string) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/nalog/dostupnost?month=${m}`, { cache: "no-store" });
      const data = await res.json();
      setDays(data.ok ? (data.days as Day[]) : []);
      if (!data.ok) setError("Ne mogu da učitam slobodne termine.");
    } catch {
      setDays([]);
      setError("Ne mogu da učitam slobodne termine.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load(month);
  }, [month, load]);

  // Shortening the session can never invalidate a start time, but lengthening
  // it can — drop a selection that no longer fits rather than posting it.
  useEffect(() => {
    if (hours > maxHours) setHours(maxHours);
  }, [hours, maxHours]);

  const freeByDate = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const d of days) map.set(d.date, d.slots);
    return map;
  }, [days]);

  const starts = useMemo(() => {
    if (!date) return [];
    return startsFor(freeByDate.get(date) ?? [], hours);
  }, [date, freeByDate, hours]);

  useEffect(() => {
    if (slot && !starts.includes(slot)) setSlot(null);
  }, [slot, starts]);

  const cells = useMemo(() => monthCells(month), [month]);

  const submit = async () => {
    if (!date || !slot) return;
    setBusy(true);
    setError(null);
    setDone(null);
    try {
      const res = await fetch("/api/nalog/termini", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date, startSlot: slot, hours, kind, topic }),
      });
      const data = await res.json();
      if (!data.ok) {
        setError(data.message ?? "Termin nije zakazan.");
        // Someone else may have taken it a second ago — refresh the grid so the
        // buyer sees the truth instead of retrying a slot that is gone.
        if (data.code === "taken" || data.code === "closed" || data.code === "past") {
          await load(month);
        }
        return;
      }
      setDone(`Termin je zakazan: ${date} u ${slot}.`);
      setSlot(null);
      setTopic("");
      await load(month);
      router.refresh();
    } catch {
      setError("Greška u komunikaciji sa serverom.");
    } finally {
      setBusy(false);
    }
  };

  if (bookable.length === 0) return null;

  return (
    <section className="rounded-2xl border border-accent/30 bg-accent/5 p-5 md:p-6">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h2 className="font-medium text-fg">Zakaži termin</h2>
        <p className="text-sm text-muted">
          Na stanju: {formatHours(balance)} · {HOUR_KIND_LABEL[kind] ?? kind}
        </p>
      </div>

      {bookable.length > 1 && (
        <div className="mt-4 flex flex-wrap gap-2">
          {bookable.map((w) => (
            <button
              key={w.kind}
              type="button"
              onClick={() => {
                setKind(w.kind);
                setSlot(null);
              }}
              className={`rounded-full border px-4 py-1.5 text-sm transition-colors ${
                kind === w.kind
                  ? "border-accent bg-accent/15 text-fg"
                  : "border-line text-muted hover:text-fg"
              }`}
            >
              {HOUR_KIND_LABEL[w.kind] ?? w.kind}
            </button>
          ))}
        </div>
      )}

      <div className="mt-5 flex items-center justify-between gap-4">
        <button
          type="button"
          aria-label="Prethodni mesec"
          onClick={() => {
            setMonth(shiftMonth(month, -1));
            setDate(null);
            setSlot(null);
          }}
          className="grid h-8 w-8 place-items-center rounded-lg border border-line text-muted transition-colors hover:text-fg"
        >
          <ChevronLeft size={16} />
        </button>
        <strong className="text-sm font-medium capitalize text-fg">{monthLabel(month)}</strong>
        <button
          type="button"
          aria-label="Sledeći mesec"
          onClick={() => {
            setMonth(shiftMonth(month, 1));
            setDate(null);
            setSlot(null);
          }}
          className="grid h-8 w-8 place-items-center rounded-lg border border-line text-muted transition-colors hover:text-fg"
        >
          <ChevronRight size={16} />
        </button>
      </div>

      <div className="mt-4 grid grid-cols-7 gap-1.5">
        {WEEKDAYS.map((w) => (
          <div key={w} className="pb-1 text-center text-xs uppercase tracking-[0.1em] text-faint">
            {w}
          </div>
        ))}
        {cells.map((cell, i) => {
          if (cell === null) return <div key={`b${i}`} />;
          const free = freeByDate.get(cell) ?? [];
          const open = free.length > 0;
          return (
            <button
              key={cell}
              type="button"
              disabled={!open}
              aria-pressed={date === cell}
              onClick={() => {
                setDate(cell);
                setSlot(null);
                setDone(null);
              }}
              className={`aspect-square rounded-lg border text-sm transition-colors ${
                date === cell
                  ? "border-accent bg-accent/15 text-fg"
                  : open
                    ? "border-line text-fg hover:border-accent/50"
                    : "border-transparent text-faint/50"
              }`}
            >
              <span className="block">{Number(cell.slice(-2))}</span>
              {open && (
                <span className="mx-auto mt-0.5 block h-1 w-1 rounded-full bg-accent" aria-hidden />
              )}
            </button>
          );
        })}
      </div>

      {loading && <p className="mt-4 text-sm text-faint">Učitavam slobodne termine…</p>}
      {!loading && days.length === 0 && (
        <p className="mt-4 text-sm text-muted">
          Ovog meseca nema otvorenih termina. Probaj sledeći mesec.
        </p>
      )}

      {date && (
        <div className="mt-5 space-y-4 border-t border-line pt-5">
          <div>
            <p className="text-xs uppercase tracking-[0.14em] text-faint">Trajanje</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {Array.from({ length: maxHours }, (_, i) => i + 1).map((h) => (
                <button
                  key={h}
                  type="button"
                  onClick={() => setHours(h)}
                  className={`rounded-full border px-4 py-1.5 text-sm transition-colors ${
                    hours === h
                      ? "border-accent bg-accent/15 text-fg"
                      : "border-line text-muted hover:text-fg"
                  }`}
                >
                  {h}h
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="text-xs uppercase tracking-[0.14em] text-faint">Početak</p>
            {starts.length === 0 ? (
              <p className="mt-2 text-sm text-muted">
                Nema slobodnog bloka od {hours}h tog dana — skrati sesiju ili izaberi drugi dan.
              </p>
            ) : (
              <div className="mt-2 flex flex-wrap gap-2">
                {starts.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setSlot(s)}
                    className={`rounded-full border px-4 py-1.5 text-sm transition-colors ${
                      slot === s
                        ? "border-accent bg-accent/15 text-fg"
                        : "border-line text-muted hover:text-fg"
                    }`}
                  >
                    {s}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div>
            <label
              htmlFor="booking-topic"
              className="text-xs uppercase tracking-[0.14em] text-faint"
            >
              Tema (opciono)
            </label>
            <input
              id="booking-topic"
              type="text"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="šta želiš da pokrijemo"
              className="mt-2 w-full rounded-xl border border-line bg-bg-elev/60 px-4 py-2.5 text-sm text-fg outline-none placeholder:text-faint focus:border-accent"
            />
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={submit}
              disabled={busy || !slot}
              className="rounded-full bg-accent px-5 py-2.5 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-40"
            >
              {busy ? "Zakazujem…" : `Zakaži ${hours}h`}
            </button>
            <span className="text-sm text-faint">
              Skida {formatHours(hours)} sa stanja. Otkazivanje do 24h pre termina.
            </span>
          </div>
        </div>
      )}

      {error && (
        <p className="mt-4 text-sm text-red-300" role="alert">
          {error}
        </p>
      )}
      {done && (
        <p className="mt-4 text-sm text-emerald-300" role="status">
          {done}
        </p>
      )}
    </section>
  );
}
