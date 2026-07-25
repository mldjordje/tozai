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

const ORDER_STATUS: Record<string, string> = {
  pending: "Na čekanju",
  paid: "Plaćeno",
  canceled: "Otkazano",
  refunded: "Refundirano",
};

export function KlijentiTab() {
  const [clients, setClients] = useState<Client[]>([]);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [openId, setOpenId] = useState<number | null>(null);
  const [detail, setDetail] = useState<{ orders: Order[]; wallet: { purchased: number; used: number } | null } | null>(null);
  const [note, setNote] = useState("");
  const [noteBusy, setNoteBusy] = useState(false);
  const [noteSaved, setNoteSaved] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  const onSearch = (value: string) => {
    setQ(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => load(value), 300);
  };

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
    try {
      const res = await fetch(`/api/admin/clients/${c.id}`, { cache: "no-store" });
      const data = await res.json();
      if (data.ok) setDetail({ orders: data.orders, wallet: data.wallet });
    } catch {
      /* ignore */
    }
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
                      <h4>Wallet edukacije</h4>
                      {detail.wallet ? (
                        <div className="adm__client-item">
                          <p>{(detail.wallet.purchased - detail.wallet.used).toFixed(1)}h preostalo</p>
                          <small>kupljeno {detail.wallet.purchased}h · iskorišćeno {detail.wallet.used}h</small>
                        </div>
                      ) : (
                        <p className="adm__hint">Nema kupljenih sati.</p>
                      )}
                    </section>
                  </div>
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
