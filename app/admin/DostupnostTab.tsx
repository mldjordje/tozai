"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { HOURS, monthKey, monthLabel, daysInMonth, leadBlanks, todayIso } from "./shared";

const WD = ["Pon", "Uto", "Sre", "Čet", "Pet", "Sub", "Ned"];

export function DostupnostTab() {
  const [month, setMonth] = useState(() => monthKey(0));
  const [days, setDays] = useState<Record<string, string[]>>({});
  const [selected, setSelected] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async (m: string) => {
    setError(null);
    try {
      const res = await fetch(`/api/admin/availability?month=${m}`, { cache: "no-store" });
      const data = await res.json();
      if (!data.ok) throw new Error();
      const map: Record<string, string[]> = {};
      for (const d of data.days as { date: string; slots: string[] }[]) map[d.date] = d.slots;
      setDays(map);
    } catch {
      setError("Ne mogu da učitam dostupnost.");
    }
  }, []);

  useEffect(() => {
    load(month);
  }, [month, load]);

  const total = daysInMonth(month);
  const blanks = leadBlanks(month);
  const today = todayIso();

  const cells = useMemo(() => {
    const arr: (string | null)[] = Array.from({ length: blanks }, () => null);
    for (let d = 1; d <= total; d++) arr.push(`${month}-${String(d).padStart(2, "0")}`);
    return arr;
  }, [month, total, blanks]);

  const toggleSlot = async (hour: string) => {
    if (!selected) return;
    const current = days[selected] ?? [];
    const next = current.includes(hour) ? current.filter((h) => h !== hour) : [...current, hour].sort();
    setDays((d) => ({ ...d, [selected]: next }));
    setBusy(true);
    try {
      await fetch("/api/admin/availability", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date: selected, slots: next }),
      });
    } finally {
      setBusy(false);
    }
  };

  const setAll = async (slots: string[]) => {
    if (!selected) return;
    setDays((d) => ({ ...d, [selected]: slots }));
    await fetch("/api/admin/availability", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ date: selected, slots }),
    });
  };

  return (
    <div className="adm__avail">
      <p className="adm__hint adm__avail-note">
        Klikni dan pa uključi termine koje klijent može da rezerviše. Prazan dan = zatvoreno.
      </p>
      {error && <p className="adm__err" role="alert">{error}</p>}

      <div className="adm__cal-head adm__cal-head--month">
        <button onClick={() => setMonth(shift(month, -1))} aria-label="Prethodni mesec">
          <ChevronLeft size={16} />
        </button>
        <strong>{monthLabel(month)}</strong>
        <button onClick={() => setMonth(shift(month, 1))} aria-label="Sledeći mesec">
          <ChevronRight size={16} />
        </button>
      </div>

      <div className="adm__scal">
        <div className="adm__scal-grid">
          {WD.map((w) => (
            <div key={w} className="adm__scal-wd">{w}</div>
          ))}
          {cells.map((date, i) =>
            date === null ? (
              <div key={`b${i}`} />
            ) : (
              <button
                key={date}
                className={`adm__scal-day${(days[date]?.length ?? 0) === 0 ? " adm__scal-day--closed" : ""}`}
                aria-pressed={selected === date}
                disabled={date < today}
                onClick={() => setSelected(date)}
              >
                <span className="adm__scal-num">{Number(date.slice(-2))}</span>
                <span className="adm__scal-hours">{days[date]?.length ? `${days[date].length} termina` : "—"}</span>
                {(days[date]?.length ?? 0) > 0 && <span className="adm__scal-dot" />}
              </button>
            ),
          )}
        </div>
      </div>

      {selected && (
        <div className="adm__scal-editor adm__editor">
          <h3>{selected}</h3>
          <div className="adm__hour-grid">
            {HOURS.map((h) => (
              <button
                key={h}
                className="adm__hour-cell"
                aria-pressed={days[selected]?.includes(h) ?? false}
                disabled={busy}
                onClick={() => toggleSlot(h)}
              >
                {h}
              </button>
            ))}
          </div>
          <div className="adm__editor-actions">
            <button onClick={() => setAll(HOURS)}>Sve</button>
            <button onClick={() => setAll([])}>Zatvori dan</button>
          </div>
        </div>
      )}
    </div>
  );
}

function shift(month: string, delta: number) {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}
