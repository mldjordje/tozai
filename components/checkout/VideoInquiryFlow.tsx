"use client";

import { useState } from "react";

type PackageSummary = {
  slug: string;
  name: string;
  description: string | null;
  features: string[];
};

const EMPTY = {
  buyerType: "individual" as "individual" | "company",
  idea: "",
  clipCount: "3",
  businessName: "",
  businessDescription: "",
  budgetEur: "",
};

export default function VideoInquiryFlow({
  pkg,
  user,
}: {
  pkg: PackageSummary;
  user: { email: string; name: string | null } | null;
}) {
  const [form, setForm] = useState(EMPTY);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [requestId, setRequestId] = useState<number | null>(null);

  const set = (key: keyof typeof form) => (
    event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) => setForm((current) => ({ ...current, [key]: event.target.value }));

  const valid =
    form.idea.trim().length >= 20 &&
    form.businessName.trim().length >= 2 &&
    form.businessDescription.trim().length >= 10 &&
    Number(form.clipCount) > 0 &&
    Number(form.budgetEur) > 0;

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!valid) return;
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/nalog/video-zahtevi", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slug: pkg.slug,
          ...form,
          clipCount: Number(form.clipCount),
          budgetEur: Number(form.budgetEur),
        }),
      });
      const data = await response.json();
      if (!response.ok || !data.ok) {
        setError(data.message ?? "Upit nije poslat. Pokušaj ponovo.");
        return;
      }
      setRequestId(data.requestId);
    } catch {
      setError("Veza je prekinuta. Pokušaj ponovo.");
    } finally {
      setBusy(false);
    }
  }

  if (!user) {
    return (
      <div className="mt-14 grid gap-12 lg:grid-cols-[1fr_22rem] lg:gap-16">
        <div>
          <p className="eyebrow">01 — Prijava</p>
          <h2 className="display mt-5 max-w-xl text-3xl md:text-5xl">
            Prijavi se da pošalješ upit.
          </h2>
          <p className="mt-5 max-w-xl text-muted">
            Procena, plaćanje i porudžbina biće vezani za tvoj nalog, tako da
            uvek vidiš šta je sledeće.
          </p>
          <a
            href={`/api/auth/google?next=${encodeURIComponent(`/porudzbina/${pkg.slug}`)}`}
            className="mt-9 inline-flex rounded-full bg-fg px-7 py-3.5 text-sm font-medium text-bg"
          >
            Nastavi sa Google nalogom
          </a>
        </div>
        <Summary pkg={pkg} />
      </div>
    );
  }

  if (requestId) {
    return (
      <div className="mt-14 max-w-2xl">
        <p className="eyebrow">Upit #{requestId}</p>
        <h2 className="display mt-5 text-4xl md:text-5xl">Upit je stigao.</h2>
        <p className="mt-5 leading-relaxed text-muted">
          Pregledaćemo ideju, broj klipova i budžet. Kada procena bude spremna,
          dobićeš email, a privatna cena i vreme izrade pojaviće se na tvom nalogu.
          Tek tada odlučuješ da li prihvataš.
        </p>
        <a
          href="/nalog/zahtevi"
          className="mt-9 inline-flex rounded-full bg-fg px-7 py-3.5 text-sm font-medium text-bg"
        >
          Prati upit
        </a>
      </div>
    );
  }

  return (
    <div className="mt-14 grid gap-12 lg:grid-cols-[1fr_22rem] lg:gap-16">
      <form onSubmit={submit} className="max-w-2xl">
        <p className="eyebrow">02 — Upit</p>
        <h2 className="display mt-5 text-3xl md:text-5xl">Reci nam šta pravimo.</h2>
        <p className="mt-4 text-sm text-muted">
          Upit je besplatan. Ne tražimo materijale dok ne prihvatiš procenu i izvršiš plaćanje.
        </p>

        <div className="mt-9 space-y-8">
          <fieldset>
            <legend className="text-xs uppercase tracking-[0.18em] text-faint">Tip kupca</legend>
            <div className="mt-3 inline-flex rounded-full border border-line p-1">
              {[
                { value: "individual", label: "Fizičko lice" },
                { value: "company", label: "Pravno lice" },
              ].map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setForm((current) => ({ ...current, buyerType: option.value as "individual" | "company" }))}
                  className={`rounded-full px-5 py-2 text-sm ${
                    form.buyerType === option.value ? "bg-fg text-bg" : "text-muted"
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </fieldset>

          <Field label="Biznis / brend *" value={form.businessName} onChange={set("businessName")} placeholder="Naziv biznisa ili brenda" />
          <Area label="Kratko o biznisu *" value={form.businessDescription} onChange={set("businessDescription")} placeholder="Čime se bavite, šta prodajete i kome?" rows={4} />
          <Area label="Ideja za klipove *" value={form.idea} onChange={set("idea")} placeholder="Opiši poruku, proizvod, stil ili rezultat koji želiš…" rows={6} />

          <div className="grid gap-7 sm:grid-cols-2">
            <Field label="Broj klipova *" value={form.clipCount} onChange={set("clipCount")} type="number" min="1" max="100" />
            <Field label="Budžet u evrima *" value={form.budgetEur} onChange={set("budgetEur")} type="number" min="1" placeholder="npr. 800" />
          </div>

          <div className="rounded-2xl border border-line bg-bg-elev/40 p-5 text-sm leading-relaxed text-muted">
            Procena sadrži tačnu cenu i potrebno vreme izrade. Nakon tvoje
            potvrde otvara se Monri plaćanje, a materijale šalješ iz dashboarda
            preko WeTransfer linka ili WhatsApp kontakta.
          </div>
        </div>

        {error && <p className="mt-5 text-sm text-red-300">{error}</p>}
        <button
          type="submit"
          disabled={!valid || busy}
          className="mt-9 rounded-full bg-fg px-8 py-3.5 text-sm font-medium text-bg disabled:cursor-not-allowed disabled:opacity-35"
        >
          {busy ? "Šaljem…" : "Pošalji upit"}
        </button>
      </form>
      <Summary pkg={pkg} />
    </div>
  );
}

function Summary({ pkg }: { pkg: PackageSummary }) {
  return (
    <aside>
      <div className="sticky top-28 rounded-2xl border border-line bg-bg-elev/40 p-7 backdrop-blur-md">
        <p className="eyebrow">AI video usluga</p>
        <h2 className="display mt-4 text-2xl">{pkg.name}</h2>
        {pkg.description && <p className="mt-2 text-sm text-muted">{pkg.description}</p>}
        <ul className="mt-6 space-y-2.5 border-t border-line pt-6">
          {pkg.features.map((feature) => (
            <li key={feature} className="flex gap-3 text-sm text-muted">
              <span className="mt-2 h-px w-3 shrink-0 bg-faint" />
              {feature}
            </li>
          ))}
        </ul>
        <div className="mt-7 border-t border-line pt-6">
          <p className="text-xs uppercase tracking-[0.18em] text-accent-soft">Privatna procena</p>
          <p className="mt-2 text-sm leading-relaxed text-faint">
            Cena nije javna i ne prikazuje se u paketu.
          </p>
        </div>
      </div>
    </aside>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
  min,
  max,
}: {
  label: string;
  value: string;
  onChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
  placeholder?: string;
  type?: string;
  min?: string;
  max?: string;
}) {
  return (
    <label className="block">
      <span className="text-xs uppercase tracking-[0.18em] text-faint">{label}</span>
      <input
        type={type}
        min={min}
        max={max}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        className="mt-2.5 w-full border-b border-line bg-transparent pb-2.5 text-fg outline-none placeholder:text-faint focus:border-accent-soft"
      />
    </label>
  );
}

function Area({
  label,
  value,
  onChange,
  placeholder,
  rows,
}: {
  label: string;
  value: string;
  onChange: (event: React.ChangeEvent<HTMLTextAreaElement>) => void;
  placeholder: string;
  rows: number;
}) {
  return (
    <label className="block">
      <span className="text-xs uppercase tracking-[0.18em] text-faint">{label}</span>
      <textarea
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        rows={rows}
        className="mt-2.5 w-full resize-y rounded-xl border border-line bg-transparent p-3 text-sm text-fg outline-none placeholder:text-faint focus:border-accent-soft"
      />
    </label>
  );
}
