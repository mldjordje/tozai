"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";

type OrderRow = {
  id: number;
  item: string;
  amount: number;
  currency: string;
  status: string;
  flow: string;
  kind: string | null;
  hours: number | null;
  buyer_type: "individual" | "company";
  provider: string | null;
  provider_ref: string | null;
  note: string | null;
  paid_at: string | null;
  created_at: string;
  quote_request_id: number | null;
  user_email: string | null;
  user_name: string | null;
  user_phone: string | null;
  invoice_number: string | null;
  proforma_number: string | null;
  proforma_id: number | null;
  payment_method: "card" | "invoice" | null;
  payment_reference: string | null;
  project_id: number | null;
  project_status: string | null;
};

const STATUS_LABEL: Record<string, string> = {
  pending: "Čeka uplatu",
  paid: "Plaćeno",
  canceled: "Otkazano",
  refunded: "Refundirano",
};

function money(amount: number, currency: string) {
  return `${amount.toLocaleString("sr-RS")} ${currency}`;
}

function date(iso: string) {
  return new Intl.DateTimeFormat("sr-Latn-RS", { day: "numeric", month: "short", year: "numeric" }).format(
    new Date(iso),
  );
}

export function PorudzbineTab() {
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [filter, setFilter] = useState<"pending" | "paid" | "all">("pending");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<number | null>(null);
  const [confirming, setConfirming] = useState<number | null>(null);
  const [reference, setReference] = useState("");

  const load = useCallback(async () => {
    setError(null);
    try {
      const response = await fetch("/api/admin/porudzbine", { cache: "no-store" });
      const data = await response.json();
      if (!response.ok || !data.ok) throw new Error(data.message);
      setOrders(data.orders);
    } catch {
      setError("Ne mogu da učitam porudžbine.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const visible = useMemo(
    () =>
      orders.filter((order) => {
        if (filter === "all") return true;
        if (filter === "paid") return order.paid_at !== null;
        return order.paid_at === null && order.status !== "canceled";
      }),
    [orders, filter],
  );

  async function markPaid(id: number) {
    setBusy(id);
    setError(null);
    try {
      const response = await fetch("/api/admin/porudzbine", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, action: "mark-paid", reference }),
      });
      const data = await response.json();
      if (!response.ok || !data.ok) {
        setError(data.message ?? "Uplata nije evidentirana.");
        return;
      }
      setConfirming(null);
      setReference("");
      await load();
    } catch {
      setError("Uplata nije evidentirana.");
    } finally {
      setBusy(null);
    }
  }

  async function sendReminder(id: number) {
    setBusy(id);
    setError(null);
    try {
      const response = await fetch("/api/admin/porudzbine", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, action: "payment-reminder" }),
      });
      const data = await response.json();
      if (!response.ok || !data.ok) {
        setError(data.message ?? "Podsetnik nije poslat.");
      }
    } catch {
      setError("Podsetnik nije poslat.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="adm__orders">
      <div>
        <h1>Porudžbine</h1>
        <p className="adm__muted">
          Kad uplata legne na račun, označi porudžbinu kao plaćenu — tek tada se otvara projekat,
          izdaje faktura i klijent može da šalje materijale.
        </p>
      </div>

      {error && <p className="adm__err" role="alert">{error}</p>}

      <div className="adm__filters">
        {[
          ["pending", "Čekaju uplatu"],
          ["paid", "Plaćene"],
          ["all", "Sve"],
        ].map(([value, label]) => (
          <button
            key={value}
            className="adm__filter"
            aria-pressed={filter === value}
            onClick={() => setFilter(value as typeof filter)}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="adm__list">
        {loading && <p className="adm__empty">Učitavanje…</p>}
        {!loading && visible.length === 0 && <p className="adm__empty">Nema porudžbina za ovaj filter.</p>}
        {visible.map((order) => {
          const paid = order.paid_at !== null;
          return (
            <article key={order.id} className="adm__row adm__order-row">
              <div className="adm__order-main">
                <div className="adm__order-head">
                  <div>
                    <strong>#{order.id} · {order.item}</strong>
                    <span>
                      {order.user_name ?? order.user_email ?? "Bez naloga"} ·{" "}
                      {order.buyer_type === "company" ? "Pravno lice" : "Fizičko lice"} · {date(order.created_at)}
                    </span>
                  </div>
                  <span className={`adm__status adm__status--ord-${paid ? "paid" : order.status}`}>
                    {STATUS_LABEL[paid ? "paid" : order.status] ?? order.status}
                  </span>
                </div>

                <div className="adm__order-meta">
                  <span>{money(order.amount, order.currency)}</span>
                  {order.flow === "hours" && order.hours != null && <span>{order.hours} sati</span>}
                  {order.user_email && <a href={`mailto:${order.user_email}`}>{order.user_email}</a>}
                  {order.invoice_number && <span>Faktura {order.invoice_number}</span>}
                  {order.proforma_number && <span>Predračun {order.proforma_number}</span>}
                  {order.payment_reference && <span>Poziv na broj: {order.payment_reference}</span>}
                  {order.project_id && (
                    <Link href="/admin/projekti">Projekat #{order.project_id}</Link>
                  )}
                  {order.provider_ref && <span>Ref: {order.provider_ref}</span>}
                </div>

                {order.note && <p className="adm__order-note">{order.note}</p>}

                {!paid && order.status !== "canceled" && (
                  <div className="adm__btns">
                    <button onClick={() => setConfirming(confirming === order.id ? null : order.id)}>
                      {confirming === order.id ? "Odustani" : "Označi kao plaćeno"}
                    </button>
                    {order.payment_method === "invoice" && (
                      <button disabled={busy === order.id} onClick={() => sendReminder(order.id)}>
                        {busy === order.id ? "Šaljem…" : "Pošalji podsetnik"}
                      </button>
                    )}
                  </div>
                )}

                {confirming === order.id && (
                  <div className="adm__order-confirm">
                    <p>
                      Potvrđuješ da je iznos {money(order.amount, order.currency)} legao na račun.
                      Ovo otvara projekat i izdaje fakturu — ne može da se poništi iz panela.
                    </p>
                    <label>
                      Poziv na broj / referenca (opciono)
                      <input
                        value={reference}
                        onChange={(event) => setReference(event.target.value)}
                        placeholder="npr. izvod 114/2026 ili TEST"
                      />
                    </label>
                    <button
                      className="adm__resched-confirm"
                      disabled={busy === order.id}
                      onClick={() => markPaid(order.id)}
                    >
                      {busy === order.id ? "Evidentiram…" : "Potvrdi uplatu"}
                    </button>
                  </div>
                )}
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}
