"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Search } from "lucide-react";
import { fmtDate } from "./shared";

type Client = {
  id: number;
  name: string | null;
  email: string;
  avatar_url: string | null;
  phone: string | null;
  is_company: boolean;
  company_name: string | null;
  pib: string | null;
  city: string | null;
  admin_note: string | null;
  created_at: string;
  orders_count: number;
  spent: number;
  hours_left: number;
};

type Order = {
  id: number;
  item: string;
  amount: number;
  currency: string;
  status: string;
  created_at: string;
};

type Wallet = { kind: string; purchased: number; used: number; remaining: number };

type Entry = {
  id: number;
  kind: string;
  hours: number;
  reason: string;
  note: string | null;
  order_id: number | null;
  booking_id: number | null;
  created_at: string;
};

type Booking = {
  id: number;
  kind: string;
  date: string;
  start_slot: string;
  hours: number;
  status: string;
  topic: string | null;
};

type Detail = {
  orders: Order[];
  wallets: Wallet[];
  entries: Entry[];
  bookings: Booking[];
};

type Pkg = {
  id: number;
  name: string;
  grp: string;
  price: number | null;
  currency: string;
  flow: string;
  hours: number | null;
  active: boolean;
};

const ORDER_STATUS: Record<string, string> = {
  pending: "Na čekanju",
  paid: "Plaćeno",
  canceled: "Otkazano",
  refunded: "Refundirano",
};

const KIND_LABEL: Record<string, string> = {
  education: "Edukacija",
  consulting: "Consulting",
};

const REASON_LABEL: Record<string, string> = {
  purchase: "Kupovina",
  manual: "Ručno dodato",
  correction: "Korekcija",
  offline: "Čas van aplikacije",
  booking: "Termin",
  refund: "Povraćaj",
};

const BOOKING_STATUS: Record<string, string> = {
  zakazano: "Zakazano",
  odrzano: "Održano",
  otkazano: "Otkazano",
};

export function KlijentiTab() {
  const [clients, setClients] = useState<Client[]>([]);
  const [packages, setPackages] = useState<Pkg[]>([]);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [openId, setOpenId] = useState<number | null>(null);
  const [detail, setDetail] = useState<Detail | null>(null);
  const [note, setNote] = useState("");
  const [noteBusy, setNoteBusy] = useState(false);
  const [noteSaved, setNoteSaved] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Manual grant forms.
  const [hoursValue, setHoursValue] = useState("");
  const [hoursKind, setHoursKind] = useState("education");
  const [hoursNote, setHoursNote] = useState("");
  // Taking hours off used to mean typing a minus sign into a box labelled
  // "Dodaj sate" — the one operation the studio needs after every lesson held
  // over the phone, and nothing on screen said it was possible.
  const [hoursMode, setHoursMode] = useState<"add" | "subtract">("add");
  const [hoursReason, setHoursReason] = useState<"offline" | "correction">("offline");
  const [pkgId, setPkgId] = useState("");
  const [pkgAmount, setPkgAmount] = useState("");
  const [pkgNote, setPkgNote] = useState("");
  const [grantBusy, setGrantBusy] = useState(false);
  const [grantMsg, setGrantMsg] = useState<{ tone: "ok" | "err"; text: string } | null>(null);

  const load = useCallback(async (query: string) => {
    setError(null);
    try {
      const res = await fetch(`/api/admin/clients?q=${encodeURIComponent(query)}`, { cache: "no-store" });
      const data = await res.json();
      if (!data.ok) throw new Error();
      setClients(data.clients);
    } catch {
      setError("Ne mogu da učitam klijente.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load("");
  }, [load]);

  // The cenovnik is the source of what a cash sale can be: the studio records a
  // package that exists, never a free-text item, so the invoice and analytics
  // line up with the shop.
  useEffect(() => {
    fetch("/api/admin/packages", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => {
        if (d.ok) setPackages(d.packages as Pkg[]);
      })
      .catch(() => {});
  }, []);

  const onSearch = (value: string) => {
    setQ(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => load(value), 300);
  };

  const loadDetail = useCallback(async (clientId: number) => {
    try {
      const res = await fetch(`/api/admin/clients/${clientId}`, { cache: "no-store" });
      const data = await res.json();
      if (data.ok) {
        setDetail({
          orders: data.orders ?? [],
          wallets: data.wallets ?? [],
          entries: data.entries ?? [],
          bookings: data.bookings ?? [],
        });
      }
    } catch {
      /* ignore */
    }
  }, []);

  const openClient = async (c: Client) => {
    if (openId === c.id) {
      setOpenId(null);
      setDetail(null);
      return;
    }
    setOpenId(c.id);
    setDetail(null);
    setNote(c.admin_note ?? "");
    setNoteSaved(false);
    setGrantMsg(null);
    setHoursValue("");
    setHoursNote("");
    setPkgId("");
    setPkgAmount("");
    setPkgNote("");
    await loadDetail(c.id);
  };

  const saveNote = async () => {
    if (openId == null) return;
    setNoteBusy(true);
    setNoteSaved(false);
    try {
      const res = await fetch(`/api/admin/clients/${openId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ admin_note: note }),
      });
      const data = await res.json();
      if (data.ok) {
        setClients((cs) => cs.map((c) => (c.id === openId ? { ...c, admin_note: note.trim() || null } : c)));
        setNoteSaved(true);
      }
    } finally {
      setNoteBusy(false);
    }
  };

  const addHours = async () => {
    if (openId == null) return;
    // The box takes a plain positive number; the Dodaj/Oduzmi switch decides
    // the sign, so nobody has to remember that "-2" is how you spend an hour.
    const typed = Math.abs(Number(hoursValue.replace(",", ".")));
    if (!Number.isFinite(typed) || typed === 0) {
      setGrantMsg({ tone: "err", text: "Unesi broj sati." });
      return;
    }
    const hours = hoursMode === "subtract" ? -typed : typed;
    setGrantBusy(true);
    setGrantMsg(null);
    try {
      const res = await fetch(`/api/admin/clients/${openId}/hours`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          hours,
          kind: hoursKind,
          note: hoursNote,
          reason: hoursMode === "subtract" ? hoursReason : undefined,
        }),
      });
      const data = await res.json();
      if (!data.ok) {
        setGrantMsg({ tone: "err", text: data.message ?? "Nije uspelo." });
        return;
      }
      setGrantMsg({
        tone: "ok",
        text: `Upisano. Novo stanje: ${data.balance}h (${KIND_LABEL[data.kind] ?? data.kind}).`,
      });
      setHoursValue("");
      setHoursNote("");
      await loadDetail(openId);
      await load(q);
    } catch {
      setGrantMsg({ tone: "err", text: "Greška u komunikaciji sa serverom." });
    } finally {
      setGrantBusy(false);
    }
  };

  const addPackage = async () => {
    if (openId == null) return;
    if (!pkgId) {
      setGrantMsg({ tone: "err", text: "Izaberi paket." });
      return;
    }
    setGrantBusy(true);
    setGrantMsg(null);
    try {
      const res = await fetch(`/api/admin/clients/${openId}/paketi`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          packageId: Number(pkgId),
          amount: pkgAmount.trim() === "" ? undefined : Number(pkgAmount.replace(",", ".")),
          note: pkgNote,
        }),
      });
      const data = await res.json();
      if (!data.ok) {
        setGrantMsg({ tone: "err", text: data.message ?? "Nije uspelo." });
        return;
      }
      setGrantMsg({
        tone: "ok",
        text: [
          `Porudžbina #${data.orderId} evidentirana kao plaćena.`,
          data.hoursCredited ? `Dodato ${data.hoursCredited}h na wallet.` : null,
          data.projectId ? `Otvoren projekat #${data.projectId}.` : null,
          data.invoiceCreated ? "Faktura izdata." : null,
        ]
          .filter(Boolean)
          .join(" "),
      });
      setPkgId("");
      setPkgAmount("");
      setPkgNote("");
      await loadDetail(openId);
      await load(q);
    } catch {
      setGrantMsg({ tone: "err", text: "Greška u komunikaciji sa serverom." });
    } finally {
      setGrantBusy(false);
    }
  };

  const selectedPkg = packages.find((p) => String(p.id) === pkgId) ?? null;

  return (
    <div className="adm__clients">
      <div className="adm__search">
        <Search size={15} strokeWidth={1.6} />
        <input
          type="search"
          placeholder="Pretraži po imenu, emailu ili firmi…"
          value={q}
          onChange={(e) => onSearch(e.target.value)}
        />
      </div>

      {error && <p className="adm__err" role="alert">{error}</p>}

      <div className="adm__list">
        {loading && <p className="adm__empty">Učitavanje…</p>}
        {!loading && clients.length === 0 && (
          <p className="adm__empty">Još nema klijenata. Pojaviće se ovde nakon prve prijave/porudžbine.</p>
        )}
        {clients.map((c) => (
          <article key={c.id} className="adm__row adm__client-row">
            <button type="button" className="adm__client-main" onClick={() => openClient(c)} aria-expanded={openId === c.id}>
              <span className="adm__client-avatar adm__client-avatar--fallback">
                {(c.name ?? c.email).slice(0, 1).toUpperCase()}
              </span>
              <span className="adm__client-id">
                <strong>{c.name ?? c.company_name ?? c.email}</strong>
                <a href={`mailto:${c.email}`} onClick={(e) => e.stopPropagation()}>{c.email}</a>
              </span>
              <span className="adm__client-meta">
                <em>{c.orders_count}</em> porudžbina · <em>{c.spent.toLocaleString("sr-RS")}</em> EUR
                {c.hours_left > 0 && <> · <em>{c.hours_left}</em>h edukacije</>}
              </span>
              {c.is_company && <span className="adm__badge adm__badge--override">Firma</span>}
              {c.admin_note && <span className="adm__badge adm__badge--override">Napomena</span>}
            </button>

            {openId === c.id && (
              <div className="adm__client-detail">
                <div className="adm__client-contact">
                  {c.phone && <span><em>Tel</em> <a href={`tel:${c.phone}`}>{c.phone}</a></span>}
                  {c.city && <span><em>Grad</em> {c.city}</span>}
                  {c.is_company && c.company_name && <span><em>Firma</em> {c.company_name}</span>}
                  {c.pib && <span><em>PIB</em> {c.pib}</span>}
                  <span><em>Klijent od</em> {fmtDate(c.created_at)}</span>
                </div>

                <div className="adm__grant">
                  <h4>Plaćeno kešom — upiši ručno</h4>
                  <div className="adm__grant-cols">
                    <section className="adm__grant-card">
                      <strong>Sati u wallet-u</strong>
                      <div className="adm__mode" role="group" aria-label="Dodaj ili oduzmi sate">
                        <button
                          type="button"
                          aria-pressed={hoursMode === "add"}
                          onClick={() => setHoursMode("add")}
                        >
                          Dodaj
                        </button>
                        <button
                          type="button"
                          aria-pressed={hoursMode === "subtract"}
                          onClick={() => setHoursMode("subtract")}
                        >
                          Oduzmi
                        </button>
                      </div>
                      <p className="adm__hint">
                        {hoursMode === "add"
                          ? "Ide pravo u wallet. Klijent odmah može da bira termine i dobija mejl."
                          : "Skida sate sa stanja — za čas koji je održan van aplikacije. Klijent ne dobija mejl."}
                      </p>
                      <div className="adm__grant-row">
                        <input
                          type="number"
                          step="0.5"
                          min="0"
                          placeholder="npr. 5"
                          value={hoursValue}
                          onChange={(e) => setHoursValue(e.target.value)}
                        />
                        <select value={hoursKind} onChange={(e) => setHoursKind(e.target.value)}>
                          <option value="education">Edukacija</option>
                          <option value="consulting">Consulting</option>
                        </select>
                      </div>
                      {hoursMode === "subtract" && (
                        <select
                          aria-label="Razlog oduzimanja"
                          value={hoursReason}
                          onChange={(e) =>
                            setHoursReason(e.target.value as "offline" | "correction")
                          }
                        >
                          <option value="offline">Čas održan van aplikacije</option>
                          <option value="correction">Ispravka greške</option>
                        </select>
                      )}
                      <input
                        type="text"
                        placeholder={
                          hoursMode === "add" ? "napomena (npr. keš 21.7.)" : "napomena (npr. čas 21.7.)"
                        }
                        value={hoursNote}
                        onChange={(e) => setHoursNote(e.target.value)}
                      />
                      <button type="button" onClick={addHours} disabled={grantBusy}>
                        {grantBusy
                          ? "Upisujem…"
                          : hoursMode === "add"
                            ? "Dodaj sate"
                            : "Oduzmi sate"}
                      </button>
                    </section>

                    <section className="adm__grant-card">
                      <strong>Evidentiraj paket</strong>
                      <p className="adm__hint">
                        Pravi porudžbinu označenu kao plaćenu: faktura, sati/projekat i mejl kupcu.
                      </p>
                      <select value={pkgId} onChange={(e) => {
                        setPkgId(e.target.value);
                        const p = packages.find((x) => String(x.id) === e.target.value);
                        setPkgAmount(p?.price != null ? String(p.price) : "");
                      }}>
                        <option value="">— izaberi paket —</option>
                        {packages.filter((p) => p.active).map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.grp === "education" ? "Edukacija" : "Usluge"} · {p.name}
                            {p.price != null ? ` — ${p.price} ${p.currency}` : ""}
                          </option>
                        ))}
                      </select>
                      <div className="adm__grant-row">
                        <input
                          type="number"
                          step="0.01"
                          placeholder="iznos"
                          value={pkgAmount}
                          onChange={(e) => setPkgAmount(e.target.value)}
                        />
                        <span className="adm__hint">
                          {!selectedPkg
                            ? "EUR"
                            : selectedPkg.flow === "hours" && selectedPkg.hours
                              ? `${selectedPkg.currency} · ${selectedPkg.hours}h u wallet`
                              : `${selectedPkg.currency} · otvara projekat`}
                        </span>
                      </div>
                      <input
                        type="text"
                        placeholder="napomena / referenca uplate"
                        value={pkgNote}
                        onChange={(e) => setPkgNote(e.target.value)}
                      />
                      <button type="button" onClick={addPackage} disabled={grantBusy || !pkgId}>
                        {grantBusy ? "Upisujem…" : "Evidentiraj kao plaćeno"}
                      </button>
                    </section>
                  </div>
                  {grantMsg && (
                    <p className={grantMsg.tone === "ok" ? "adm__hint" : "adm__err"} role="status">
                      {grantMsg.text}
                    </p>
                  )}
                </div>

                {detail && (
                  <div className="adm__client-cols">
                    <section>
                      <h4>Porudžbine</h4>
                      {detail.orders.length === 0 && <p className="adm__hint">Nema porudžbina.</p>}
                      {detail.orders.map((o) => (
                        <div key={o.id} className="adm__client-item">
                          <span className={`adm__status adm__status--${o.status === "paid" ? "confirmed" : o.status === "pending" ? "new" : "canceled"}`}>
                            {ORDER_STATUS[o.status] ?? o.status}
                          </span>
                          <p>{o.item} · {o.amount.toLocaleString("sr-RS")} {o.currency}</p>
                          <small>{fmtDate(o.created_at)}</small>
                        </div>
                      ))}
                    </section>
                    <section>
                      <h4>Wallet</h4>
                      {detail.wallets.length === 0 && <p className="adm__hint">Nema kupljenih sati.</p>}
                      {detail.wallets.map((w) => (
                        <div key={w.kind} className="adm__client-item">
                          <p>
                            <strong>{w.remaining}h</strong> preostalo · {KIND_LABEL[w.kind] ?? w.kind}
                          </p>
                          <small>dodato {w.purchased}h · iskorišćeno {w.used}h</small>
                        </div>
                      ))}
                      {detail.entries.length > 0 && (
                        <ul className="adm__ledger">
                          {detail.entries.map((e) => (
                            <li key={e.id}>
                              <em className={e.hours > 0 ? "adm__ledger--plus" : "adm__ledger--minus"}>
                                {e.hours > 0 ? "+" : ""}{e.hours}h
                              </em>
                              <span>
                                {REASON_LABEL[e.reason] ?? e.reason}
                                {e.note ? ` · ${e.note}` : ""}
                              </span>
                              <small>{fmtDate(e.created_at)}</small>
                            </li>
                          ))}
                        </ul>
                      )}
                    </section>
                  </div>
                )}

                {detail && detail.bookings.length > 0 && (
                  <section className="adm__client-bookings">
                    <h4>Termini</h4>
                    <ul className="adm__ledger">
                      {detail.bookings.map((b) => (
                        <li key={b.id}>
                          <em>{b.date} {b.start_slot}</em>
                          <span>
                            {b.hours}h · {KIND_LABEL[b.kind] ?? b.kind}
                            {b.topic ? ` · ${b.topic}` : ""}
                          </span>
                          <small>{BOOKING_STATUS[b.status] ?? b.status}</small>
                        </li>
                      ))}
                    </ul>
                  </section>
                )}

                <div className="adm__client-note">
                  <h4>Napomena o klijentu</h4>
                  <textarea
                    rows={3}
                    placeholder="interne beleške…"
                    value={note}
                    onChange={(e) => {
                      setNote(e.target.value);
                      setNoteSaved(false);
                    }}
                  />
                  <div className="adm__editor-actions">
                    <button type="button" onClick={saveNote} disabled={noteBusy}>
                      {noteBusy ? "Čuvam…" : "Sačuvaj napomenu"}
                    </button>
                    {noteSaved && <span className="adm__hint">Sačuvano.</span>}
                  </div>
                </div>
              </div>
            )}
          </article>
        ))}
      </div>
    </div>
  );
}
