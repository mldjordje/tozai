"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

type RequestRow = {
  id: number;
  service_name: string;
  project_title: string;
  brief: { idea: string };
  buyer_type: "individual" | "company";
  clip_count: number;
  business_name: string;
  business_description: string;
  budget_eur: number;
  status: "submitted" | "quoted" | "accepted" | "declined" | "canceled";
  quoted_amount: number | null;
  currency: string;
  turnaround_days: number | null;
  quote_valid_until: string | null;
  admin_note: string | null;
  revisions: number;
  user_email: string;
  user_name: string | null;
  user_phone: string | null;
  order_id: number | null;
  created_at: string;
};

const LABEL: Record<RequestRow["status"], string> = {
  submitted: "Novi",
  quoted: "Procena poslata",
  accepted: "Prihvaćeno",
  declined: "Odbijeno",
  canceled: "Otkazano",
};

function futureDate(days: number) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

export function VideoRequestsTab() {
  const [requests, setRequests] = useState<RequestRow[]>([]);
  const [filter, setFilter] = useState<"active" | RequestRow["status"] | "all">("active");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<number | null>(null);
  const [amount, setAmount] = useState("");
  const [days, setDays] = useState("7");
  const [validUntil, setValidUntil] = useState(futureDate(7));
  const [revisions, setRevisions] = useState("2");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      const response = await fetch("/api/admin/video-zahtevi", { cache: "no-store" });
      const data = await response.json();
      if (!response.ok || !data.ok) throw new Error(data.message);
      setRequests(data.requests);
    } catch {
      setError("Ne mogu da učitam video upite.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const visible = useMemo(
    () => requests.filter((request) => {
      if (filter === "all") return true;
      if (filter === "active") return request.status === "submitted" || request.status === "quoted";
      return request.status === filter;
    }),
    [requests, filter],
  );

  function openQuote(request: RequestRow) {
    setEditing(request.id);
    setAmount(request.quoted_amount != null ? String(request.quoted_amount) : "");
    setDays(request.turnaround_days != null ? String(request.turnaround_days) : "7");
    setValidUntil(request.quote_valid_until ?? futureDate(7));
    setRevisions(String(request.revisions ?? 2));
    setNote(request.admin_note ?? "");
    setError(null);
  }

  async function sendQuote() {
    if (!editing) return;
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/admin/video-zahtevi", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: editing,
          amount: Number(amount),
          currency: "EUR",
          turnaroundDays: Number(days),
          validUntil,
          revisions: Number(revisions),
          note,
        }),
      });
      const data = await response.json();
      if (!response.ok || !data.ok) {
        setError(data.message ?? "Procena nije poslata.");
        return;
      }
      setEditing(null);
      await load();
    } catch {
      setError("Procena nije poslata.");
    } finally {
      setBusy(false);
    }
  }

  async function statusAction(id: number, action: "cancel" | "reopen") {
    const response = await fetch("/api/admin/video-zahtevi", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, action }),
    });
    if (response.ok) await load();
    else setError("Status nije promenjen.");
  }

  return (
    <div className="adm__video">
      <div>
        <h1>Video upiti</h1>
        <p className="adm__muted">Pregledaj ideju i budžet, zatim pošalji privatnu cenu i vreme izrade.</p>
      </div>

      {error && <p className="adm__err" role="alert">{error}</p>}

      <div className="adm__filters">
        {[
          ["active", "Aktivni"],
          ["submitted", "Novi"],
          ["quoted", "Poslate procene"],
          ["accepted", "Prihvaćeni"],
          ["all", "Svi"],
        ].map(([value, label]) => (
          <button key={value} className="adm__filter" aria-pressed={filter === value} onClick={() => setFilter(value as typeof filter)}>
            {label}
          </button>
        ))}
      </div>

      <div className="adm__list">
        {loading && <p className="adm__empty">Učitavanje…</p>}
        {!loading && visible.length === 0 && <p className="adm__empty">Nema upita za ovaj filter.</p>}
        {visible.map((request) => (
          <article key={request.id} className="adm__row adm__video-row">
            <div className="adm__video-main">
              <div className="adm__video-head">
                <div>
                  <strong>{request.business_name}</strong>
                  <span>{request.service_name} · {request.clip_count} klipova</span>
                </div>
                <span className={`adm__status adm__status--req-${request.status}`}>{LABEL[request.status]}</span>
              </div>

              <div className="adm__video-meta">
                <span>{request.buyer_type === "company" ? "Pravno lice" : "Fizičko lice"}</span>
                <span>Budžet: {request.budget_eur.toLocaleString("sr-RS")} EUR</span>
                <a href={`mailto:${request.user_email}`}>{request.user_name ?? request.user_email}</a>
                {request.user_phone && <a href={`tel:${request.user_phone}`}>{request.user_phone}</a>}
              </div>

              <div className="adm__video-brief">
                <p><b>O biznisu</b>{request.business_description}</p>
                <p><b>Ideja</b>{request.brief.idea}</p>
              </div>

              {request.quoted_amount != null && (
                <p className="adm__video-quote-summary">
                  Procena: {request.quoted_amount.toLocaleString("sr-RS")} {request.currency} · {request.turnaround_days} dana · {request.revisions} revizije
                </p>
              )}

              <div className="adm__btns">
                {(request.status === "submitted" || request.status === "quoted") && (
                  <button onClick={() => editing === request.id ? setEditing(null) : openQuote(request)}>
                    {editing === request.id ? "Zatvori" : request.status === "submitted" ? "Dodeli procenu" : "Izmeni procenu"}
                  </button>
                )}
                {(request.status === "submitted" || request.status === "quoted") && (
                  <button onClick={() => statusAction(request.id, "cancel")}>Otkaži</button>
                )}
                {(request.status === "declined" || request.status === "canceled") && (
                  <button onClick={() => statusAction(request.id, "reopen")}>Vrati u obradu</button>
                )}
              </div>

              {editing === request.id && (
                <div className="adm__video-editor">
                  <div className="adm__video-fields">
                    <label>Cena (EUR)<input type="number" min="1" value={amount} onChange={(event) => setAmount(event.target.value)} /></label>
                    <label>Vreme izrade (dana)<input type="number" min="1" max="365" value={days} onChange={(event) => setDays(event.target.value)} /></label>
                    <label>Ponuda važi do<input type="date" value={validUntil} onChange={(event) => setValidUntil(event.target.value)} /></label>
                    <label>Broj revizija<input type="number" min="0" max="20" value={revisions} onChange={(event) => setRevisions(event.target.value)} /></label>
                  </div>
                  <label className="adm__video-note">Napomena kupcu<textarea rows={3} value={note} onChange={(event) => setNote(event.target.value)} placeholder="Šta cena uključuje, format isporuke, posebni uslovi…" /></label>
                  <button className="adm__resched-confirm" disabled={busy} onClick={sendQuote}>
                    {busy ? "Šaljem…" : "Pošalji procenu i email"}
                  </button>
                </div>
              )}
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
