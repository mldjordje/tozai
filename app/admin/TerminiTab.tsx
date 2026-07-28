"use client";

import { useCallback, useEffect, useState } from "react";
import { fmtDate } from "./shared";

// Booked sessions and everything the studio does around them: hand over the
// meeting link, mark the session held, cancel it (with or without giving the
// hours back), attach the recording afterwards.

type Booking = {
  id: number;
  kind: string;
  date: string;
  start_slot: string;
  hours: number;
  status: string;
  topic: string | null;
  meet_url: string | null;
  recording_url: string | null;
  user_id: number;
  user_name: string | null;
  user_email: string | null;
  user_phone: string | null;
};

type Filter = "upcoming" | "past" | "all";

const FILTERS: { key: Filter; label: string }[] = [
  { key: "upcoming", label: "Predstoje" },
  { key: "past", label: "Prošli" },
  { key: "all", label: "Svi" },
];

const KIND_LABEL: Record<string, string> = {
  education: "Edukacija",
  consulting: "Consulting",
};

const STATUS_LABEL: Record<string, string> = {
  zakazano: "Zakazano",
  odrzano: "Održano",
  otkazano: "Otkazano",
};

const STATUS_CLASS: Record<string, string> = {
  zakazano: "new",
  odrzano: "confirmed",
  otkazano: "canceled",
};

/** End time, so the studio sees the block a session actually occupies. */
function endSlot(start: string, hours: number) {
  const [h, m] = start.split(":").map(Number);
  const end = h + Math.round(hours);
  return `${String(end % 24).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

export function TerminiTab() {
  const [filter, setFilter] = useState<Filter>("upcoming");
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [msg, setMsg] = useState<{ id: number; tone: "ok" | "err"; text: string } | null>(null);
  const [drafts, setDrafts] = useState<Record<number, { meet: string; rec: string }>>({});

  const load = useCallback(async (f: Filter) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/termini?filter=${f}`, { cache: "no-store" });
      const data = await res.json();
      if (!data.ok) throw new Error();
      const list = data.bookings as Booking[];
      setBookings(list);
      setDrafts(
        Object.fromEntries(
          list.map((b) => [b.id, { meet: b.meet_url ?? "", rec: b.recording_url ?? "" }]),
        ),
      );
    } catch {
      setError("Ne mogu da učitam termine.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load(filter);
  }, [filter, load]);

  const act = async (id: number, payload: Record<string, unknown>, okText: string) => {
    setBusyId(id);
    setMsg(null);
    try {
      const res = await fetch("/api/admin/termini", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, ...payload }),
      });
      const data = await res.json();
      if (!data.ok) {
        setMsg({ id, tone: "err", text: data.message ?? "Nije uspelo." });
        return;
      }
      setMsg({ id, tone: "ok", text: okText });
      await load(filter);
    } catch {
      setMsg({ id, tone: "err", text: "Greška u komunikaciji sa serverom." });
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="adm__sessions">
      <p className="adm__hint">
        Termini koje su klijenti rezervisali iz svog naloga. Link za sastanak nalepiš ovde —
        klijent ga odmah vidi na `/nalog/edukacija` i dobija mejl.
      </p>

      <div className="adm__filters">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            className="adm__filter"
            aria-pressed={filter === f.key}
            onClick={() => setFilter(f.key)}
          >
            {f.label}
          </button>
        ))}
      </div>

      {error && <p className="adm__err" role="alert">{error}</p>}
      {loading && <p className="adm__empty">Učitavanje…</p>}
      {!loading && bookings.length === 0 && (
        <p className="adm__empty">
          {filter === "upcoming"
            ? "Nema zakazanih termina. Otvori dane u Dostupnosti da bi klijenti mogli da biraju."
            : "Nema termina."}
        </p>
      )}

      <div className="adm__list">
        {bookings.map((b) => {
          const draft = drafts[b.id] ?? { meet: "", rec: "" };
          const open = b.status === "zakazano";
          return (
            <article key={b.id} className="adm__row adm__session">
              <div className="adm__when">
                <strong>{fmtDate(b.date)}</strong>
                <span>
                  {b.start_slot}–{endSlot(b.start_slot, b.hours)}
                </span>
              </div>

              <div className="adm__who">
                <strong>{b.user_name ?? b.user_email ?? `Klijent #${b.user_id}`}</strong>
                {b.user_email && <a href={`mailto:${b.user_email}`}>{b.user_email}</a>}
                <span className="adm__kind">{KIND_LABEL[b.kind] ?? b.kind}</span>
                <span className="adm__kind">{b.hours}h</span>
                {b.topic && <p>{b.topic}</p>}
                {b.user_phone && <p>Tel: {b.user_phone}</p>}
              </div>

              <div className="adm__actions">
                <span className={`adm__status adm__status--${STATUS_CLASS[b.status] ?? "new"}`}>
                  {STATUS_LABEL[b.status] ?? b.status}
                </span>
                {!b.meet_url && open && (
                  <span className="adm__badge adm__badge--override">Bez linka</span>
                )}
              </div>

              <div className="adm__session-tools">
                <div className="adm__session-field">
                  <label htmlFor={`meet-${b.id}`}>Link za sastanak</label>
                  <div className="adm__pf-row">
                    <input
                      id={`meet-${b.id}`}
                      type="text"
                      placeholder="https://meet.google.com/…"
                      value={draft.meet}
                      onChange={(e) =>
                        setDrafts((d) => ({ ...d, [b.id]: { ...draft, meet: e.target.value } }))
                      }
                    />
                    <button
                      type="button"
                      disabled={busyId === b.id}
                      onClick={() =>
                        act(
                          b.id,
                          { action: "set-meet", meetUrl: draft.meet },
                          draft.meet.trim() === ""
                            ? "Link obrisan."
                            : "Link sačuvan, klijent obavešten.",
                        )
                      }
                    >
                      Sačuvaj
                    </button>
                  </div>
                </div>

                {(!open || b.recording_url) && (
                  <div className="adm__session-field">
                    <label htmlFor={`rec-${b.id}`}>Snimak</label>
                    <div className="adm__pf-row">
                      <input
                        id={`rec-${b.id}`}
                        type="text"
                        placeholder="link na snimak"
                        value={draft.rec}
                        onChange={(e) =>
                          setDrafts((d) => ({ ...d, [b.id]: { ...draft, rec: e.target.value } }))
                        }
                      />
                      <button
                        type="button"
                        disabled={busyId === b.id}
                        onClick={() =>
                          act(b.id, { action: "set-recording", recordingUrl: draft.rec }, "Snimak sačuvan.")
                        }
                      >
                        Sačuvaj
                      </button>
                    </div>
                  </div>
                )}

                {open && (
                  <div className="adm__btns">
                    <button
                      type="button"
                      disabled={busyId === b.id}
                      onClick={() => act(b.id, { action: "mark-held" }, "Označeno kao održano.")}
                    >
                      Održano
                    </button>
                    <button
                      type="button"
                      disabled={busyId === b.id}
                      onClick={() =>
                        act(b.id, { action: "cancel", refund: true }, "Otkazano, sati vraćeni.")
                      }
                    >
                      Otkaži + vrati sate
                    </button>
                    <button
                      type="button"
                      disabled={busyId === b.id}
                      onClick={() =>
                        act(
                          b.id,
                          { action: "cancel", refund: false, reason: "Klijent se nije pojavio." },
                          "Otkazano bez povraćaja.",
                        )
                      }
                    >
                      Nije se pojavio
                    </button>
                  </div>
                )}

                {msg?.id === b.id && (
                  <p className={msg.tone === "ok" ? "adm__hint" : "adm__err"} role="status">
                    {msg.text}
                  </p>
                )}
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}
