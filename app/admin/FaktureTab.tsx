"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

type DocumentRow = {
  id: number;
  order_id: number | null;
  number: string;
  kind: "proforma" | "invoice";
  scope: "domestic" | "foreign";
  amount: number;
  currency: string;
  item: string | null;
  buyer: {
    name?: string | null;
    companyName?: string | null;
    email?: string | null;
  } | null;
  issued_at: string | null;
  due_date: string | null;
  created_at: string;
  user_name: string | null;
  user_email: string | null;
};

type FormState = {
  kind: "proforma" | "invoice";
  scope: "domestic" | "foreign";
  issuedAt: string;
  dueDate: string;
  item: string;
  amount: string;
  currency: string;
  buyerName: string;
  companyName: string;
  address: string;
  city: string;
  country: string;
  pib: string;
  mb: string;
  email: string;
  phone: string;
};

function isoDate(offsetDays = 0) {
  const date = new Date();
  date.setDate(date.getDate() + offsetDays);
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
}

function initialForm(): FormState {
  return {
    kind: "invoice",
    scope: "domestic",
    issuedAt: isoDate(),
    dueDate: isoDate(5),
    item: "",
    amount: "",
    currency: "EUR",
    buyerName: "",
    companyName: "",
    address: "",
    city: "",
    country: "Srbija",
    pib: "",
    mb: "",
    email: "",
    phone: "",
  };
}

function displayDate(value: string | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("sr-Latn-RS", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(`${value.slice(0, 10)}T12:00:00`));
}

export function FaktureTab() {
  const [documents, setDocuments] = useState<DocumentRow[]>([]);
  const [form, setForm] = useState<FormState>(initialForm);
  const [filter, setFilter] = useState<"all" | "manual" | "automatic">("all");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<{ id: number; number: string } | null>(null);

  const load = useCallback(async () => {
    try {
      const response = await fetch("/api/admin/fakture", { cache: "no-store" });
      const data = await response.json();
      if (!response.ok || !data.ok) throw new Error(data.message);
      setDocuments(data.documents);
    } catch {
      setError("Ne mogu da učitam fakture i predračune.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const visible = useMemo(
    () =>
      documents.filter((document) => {
        if (filter === "all") return true;
        return filter === "manual" ? document.order_id === null : document.order_id !== null;
      }),
    [documents, filter],
  );

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((current) => ({ ...current, [key]: value }));

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setCreated(null);
    try {
      const response = await fetch("/api/admin/fakture", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await response.json();
      if (!response.ok || !data.ok) throw new Error(data.message ?? "Dokument nije generisan.");
      setCreated({ id: data.document.id, number: data.document.number });
      setForm(initialForm());
      await load();
    } catch (issue) {
      setError(issue instanceof Error ? issue.message : "Dokument nije generisan.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="adm__invoices">
      <div>
        <h1>Fakture i predračuni</h1>
        <p className="adm__muted">
          Ručno izdavanje koristi isti PDF obrazac i istu numeraciju kao dokumenti nastali iz porudžbina.
        </p>
      </div>

      {error && <p className="adm__err" role="alert">{error}</p>}
      {created && (
        <p className="adm__invoice-success" role="status">
          Dokument {created.number} je generisan.{" "}
          <a href={`/api/admin/fakture/${created.id}?inline=1`} target="_blank" rel="noreferrer">
            Otvori PDF
          </a>
        </p>
      )}

      <form className="adm__invoice-form" onSubmit={submit}>
        <div className="adm__invoice-form-head">
          <div>
            <h2>Ručno generisanje</h2>
            <p>Broj dokumenta se dodeljuje automatski nakon potvrde.</p>
          </div>
          <button type="submit" disabled={busy}>
            {busy ? "Generišem…" : "Generiši PDF"}
          </button>
        </div>

        <div className="adm__invoice-grid">
          <Field label="Vrsta dokumenta">
            <select value={form.kind} onChange={(event) => set("kind", event.target.value as FormState["kind"])}>
              <option value="invoice">Faktura</option>
              <option value="proforma">Predračun</option>
            </select>
          </Field>
          <Field label="Tržište / jezik">
            <select
              value={form.scope}
              onChange={(event) => {
                const scope = event.target.value as FormState["scope"];
                setForm((current) => ({
                  ...current,
                  scope,
                  country: scope === "domestic" ? "Srbija" : current.country === "Srbija" ? "" : current.country,
                }));
              }}
            >
              <option value="domestic">Domaće — srpski</option>
              <option value="foreign">Inostranstvo — engleski</option>
            </select>
          </Field>
          <Field label="Datum izdavanja">
            <input type="date" required value={form.issuedAt} onChange={(event) => set("issuedAt", event.target.value)} />
          </Field>
          <Field label="Rok plaćanja">
            <input type="date" value={form.dueDate} onChange={(event) => set("dueDate", event.target.value)} />
          </Field>
          <Field label="Opis stavke" wide>
            <input required maxLength={500} value={form.item} onChange={(event) => set("item", event.target.value)} placeholder="npr. AI video produkcija" />
          </Field>
          <Field label="Iznos">
            <input type="number" min="0.01" step="0.01" required value={form.amount} onChange={(event) => set("amount", event.target.value)} placeholder="0.00" />
          </Field>
          <Field label="Valuta">
            <select value={form.currency} onChange={(event) => set("currency", event.target.value)}>
              <option value="EUR">EUR</option>
              <option value="RSD">RSD</option>
              <option value="USD">USD</option>
            </select>
          </Field>
        </div>

        <h3>Podaci kupca</h3>
        <div className="adm__invoice-grid">
          <Field label="Ime i prezime">
            <input value={form.buyerName} onChange={(event) => set("buyerName", event.target.value)} />
          </Field>
          <Field label="Naziv firme">
            <input value={form.companyName} onChange={(event) => set("companyName", event.target.value)} />
          </Field>
          <Field label="Adresa">
            <input value={form.address} onChange={(event) => set("address", event.target.value)} />
          </Field>
          <Field label="Grad">
            <input value={form.city} onChange={(event) => set("city", event.target.value)} />
          </Field>
          <Field label="Država">
            <input value={form.country} onChange={(event) => set("country", event.target.value)} />
          </Field>
          <Field label="Email">
            <input type="email" value={form.email} onChange={(event) => set("email", event.target.value)} />
          </Field>
          <Field label="PIB / Tax ID">
            <input value={form.pib} onChange={(event) => set("pib", event.target.value)} />
          </Field>
          <Field label="Matični broj">
            <input value={form.mb} onChange={(event) => set("mb", event.target.value)} />
          </Field>
          <Field label="Telefon">
            <input value={form.phone} onChange={(event) => set("phone", event.target.value)} />
          </Field>
        </div>
        <p className="adm__hint">Obavezni su ime kupca ili naziv firme, opis, iznos, valuta i datum izdavanja.</p>
      </form>

      <section className="adm__invoice-list">
        <div className="adm__invoice-list-head">
          <div>
            <h2>Svi dokumenti</h2>
            <p>{documents.length} ukupno</p>
          </div>
          <div className="adm__filters">
            {([
              ["all", "Sve"],
              ["manual", "Ručne"],
              ["automatic", "Automatske"],
            ] as const).map(([value, label]) => (
              <button type="button" key={value} className="adm__filter" aria-pressed={filter === value} onClick={() => setFilter(value)}>
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="adm__list">
          {loading && <p className="adm__empty">Učitavanje…</p>}
          {!loading && visible.length === 0 && <p className="adm__empty">Nema dokumenata za ovaj filter.</p>}
          {visible.map((document) => {
            const buyer = document.buyer?.companyName || document.buyer?.name || document.user_name || document.user_email || "Kupac nije naveden";
            return (
              <article className="adm__invoice-row" key={document.id}>
                <div className="adm__invoice-number">
                  <strong>{document.number}</strong>
                  <span>{document.kind === "invoice" ? "Faktura" : "Predračun"}</span>
                </div>
                <div className="adm__invoice-info">
                  <strong>{buyer}</strong>
                  <span>{document.item || "Bez opisa"}</span>
                  <small>
                    {displayDate(document.issued_at)} · {document.scope === "foreign" ? "Inostranstvo" : "Domaće"} ·{" "}
                    {document.order_id === null ? "Ručno" : `Automatski · porudžbina #${document.order_id}`}
                  </small>
                </div>
                <div className="adm__invoice-total">
                  <strong>{document.amount.toLocaleString("sr-RS", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {document.currency}</strong>
                  <a href={`/api/admin/fakture/${document.id}?inline=1`} target="_blank" rel="noreferrer">Otvori PDF</a>
                  <a href={`/api/admin/fakture/${document.id}`}>Preuzmi</a>
                </div>
              </article>
            );
          })}
        </div>
      </section>
    </div>
  );
}

function Field({
  label,
  wide = false,
  children,
}: {
  label: string;
  wide?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className={`adm__invoice-field${wide ? " adm__invoice-field--wide" : ""}`}>
      <span>{label}</span>
      {children}
    </label>
  );
}
