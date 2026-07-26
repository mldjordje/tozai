"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type RequestRow = {
  id: number;
  service_name: string;
  project_title: string;
  brief: { idea: string };
  buyer_type: "individual" | "company";
  clip_count: number;
  business_name: string;
  business_description: string;
  budget_eur: number | null;
  status: "submitted" | "quoted" | "accepted" | "declined" | "canceled";
  quoted_amount: number | null;
  currency: string;
  turnaround_days: number | null;
  quote_valid_until: string | null;
  admin_note: string | null;
  revisions: number;
  order_id: number | null;
  created_at: string;
};

type ManualIntent = {
  kind: "manual";
  reference: string;
  amount: number;
  currency: string;
  payee: { name: string | null; account: string | null };
};
type FormIntent = {
  kind: "form";
  action: string;
  fields: Record<string, string>;
};

const LABEL: Record<RequestRow["status"], string> = {
  submitted: "Čeka procenu",
  quoted: "Procena je spremna",
  accepted: "Prihvaćeno",
  declined: "Odbijeno",
  canceled: "Otkazano",
};

export default function VideoRequests() {
  const [requests, setRequests] = useState<RequestRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [payment, setPayment] = useState<{ orderId: number; intent: ManualIntent } | null>(null);

  async function load() {
    try {
      const response = await fetch("/api/nalog/video-zahtevi", { cache: "no-store" });
      const data = await response.json();
      if (!response.ok || !data.ok) throw new Error(data.message);
      setRequests(data.requests);
    } catch {
      setError("Ne mogu da učitam upite.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function act(id: number, action: "accept" | "decline" | "withdraw") {
    setBusy(id);
    setError(null);
    try {
      const response = await fetch("/api/nalog/video-zahtevi", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, action }),
      });
      const data = await response.json();
      if (!response.ok || !data.ok) {
        setError(data.message ?? "Akcija nije uspela.");
        return;
      }
      if (data.intent?.kind === "redirect") {
        window.location.href = data.intent.redirectUrl;
        return;
      }
      if (data.intent?.kind === "form") {
        submitHostedForm(data.intent as FormIntent);
        return;
      }
      if (action === "accept" && data.intent?.kind === "manual") {
        setPayment({ orderId: data.orderId, intent: data.intent });
      }
      await load();
    } catch {
      setError("Veza je prekinuta. Pokušaj ponovo.");
    } finally {
      setBusy(null);
    }
  }

  if (payment) {
    return (
      <div className="rounded-2xl border border-accent/30 bg-accent/5 p-6">
        <p className="text-xs uppercase tracking-[0.16em] text-accent-soft">Porudžbina #{payment.orderId}</p>
        <h2 className="mt-3 text-xl font-semibold text-fg">Ponuda je prihvaćena.</h2>
        <p className="mt-2 text-sm text-muted">
          Monri nije podešen u ovom okruženju, pa su prikazani podaci za uplatu.
        </p>
        <dl className="mt-5 space-y-3 text-sm">
          <Row label="Iznos" value={`${payment.intent.amount.toLocaleString("sr-RS")} ${payment.intent.currency}`} />
          <Row label="Poziv na broj" value={payment.intent.reference} />
          {payment.intent.payee.name && <Row label="Primalac" value={payment.intent.payee.name} />}
          {payment.intent.payee.account && <Row label="Račun" value={payment.intent.payee.account} />}
        </dl>
        <Link href="/nalog/porudzbine" className="mt-6 inline-flex rounded-full bg-fg px-5 py-2.5 text-sm font-medium text-bg">
          Moje porudžbine
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {error && <p className="rounded-xl border border-red-400/20 bg-red-400/5 p-4 text-sm text-red-300">{error}</p>}
      {loading && <p className="text-sm text-muted">Učitavanje…</p>}
      {!loading && requests.length === 0 && (
        <div className="rounded-2xl border border-dashed border-line p-8 text-center">
          <p className="text-muted">Još nema upita za AI klipove.</p>
          <Link href="/#paketi" className="mt-4 inline-flex rounded-full bg-fg px-5 py-2.5 text-sm font-medium text-bg">
            Pogledaj pakete
          </Link>
        </div>
      )}
      {requests.map((request) => (
        <article key={request.id} className={`rounded-2xl border p-5 ${request.status === "quoted" ? "border-accent/40 bg-accent/5" : "border-line bg-bg-elev/50"}`}>
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-[0.14em] text-faint">Upit #{request.id} · {request.service_name}</p>
              <h2 className="mt-2 text-lg font-medium text-fg">{request.business_name}</h2>
              <p className="mt-1 text-sm text-muted">{request.clip_count} klipova · budžet {request.budget_eur?.toLocaleString("sr-RS")} EUR</p>
            </div>
            <span className="rounded-full border border-line px-3 py-1 text-xs text-muted">{LABEL[request.status]}</span>
          </div>

          <details className="mt-5 border-t border-line pt-4">
            <summary className="cursor-pointer text-sm text-muted">Pogledaj poslati upit</summary>
            <div className="mt-4 space-y-3 text-sm">
              <p><span className="text-faint">O biznisu:</span> {request.business_description}</p>
              <p className="whitespace-pre-line"><span className="text-faint">Ideja:</span> {request.brief.idea}</p>
            </div>
          </details>

          {request.status === "submitted" && (
            <div className="mt-5 flex items-center justify-between gap-4 border-t border-line pt-4">
              <p className="text-sm text-muted">Pregledamo upit. Email stiže čim procena bude spremna.</p>
              <button onClick={() => act(request.id, "withdraw")} disabled={busy === request.id} className="text-sm text-faint hover:text-fg">
                Povuci upit
              </button>
            </div>
          )}

          {request.status === "quoted" && (
            <div className="mt-5 border-t border-line pt-5">
              <div className="grid gap-4 sm:grid-cols-3">
                <Metric label="Cena" value={`${request.quoted_amount?.toLocaleString("sr-RS")} ${request.currency}`} />
                <Metric label="Vreme izrade" value={`${request.turnaround_days} dana`} />
                <Metric label="Revizije" value={String(request.revisions)} />
              </div>
              {request.admin_note && <p className="mt-4 rounded-xl bg-bg-elev p-4 text-sm text-muted">{request.admin_note}</p>}
              <p className="mt-4 text-xs text-faint">Ponuda važi do {request.quote_valid_until}.</p>
              <div className="mt-5 flex flex-wrap gap-3">
                <button onClick={() => act(request.id, "accept")} disabled={busy === request.id} className="rounded-full bg-fg px-6 py-3 text-sm font-medium text-bg disabled:opacity-50">
                  {busy === request.id ? "Otvaram plaćanje…" : "Prihvati i plati"}
                </button>
                <button onClick={() => act(request.id, "decline")} disabled={busy === request.id} className="rounded-full border border-line px-6 py-3 text-sm text-muted">
                  Ne odgovara mi
                </button>
              </div>
            </div>
          )}

          {request.status === "accepted" && request.order_id && (
            <p className="mt-5 border-t border-line pt-4 text-sm text-muted">
              Ponuda je prihvaćena. <Link href="/nalog/porudzbine" className="text-accent-soft underline underline-offset-4">Porudžbina #{request.order_id}</Link>
            </p>
          )}
        </article>
      ))}
    </div>
  );
}

function submitHostedForm(intent: FormIntent) {
  const form = document.createElement("form");
  form.method = "POST";
  form.action = intent.action;
  Object.entries(intent.fields).forEach(([name, value]) => {
    const input = document.createElement("input");
    input.type = "hidden";
    input.name = name;
    input.value = value;
    form.appendChild(input);
  });
  document.body.appendChild(form);
  form.submit();
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs uppercase tracking-[0.14em] text-faint">{label}</p>
      <p className="mt-1 text-lg text-fg">{value}</p>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-faint">{label}</dt>
      <dd className="text-right text-fg">{value}</dd>
    </div>
  );
}
