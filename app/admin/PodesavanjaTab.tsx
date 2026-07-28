"use client";

import { useEffect, useState } from "react";

type Settings = Record<string, string | null>;

const EMPTY: Settings = {
  name: "TOZA AI", logo_url: "", currency: "EUR", locale: "sr", phone: "", email: "",
  address: "", city: "", company_name: "", pib: "", mb: "", bank_account: "",
  iban: "", swift: "", bank_name: "", bank_address: "",
  vat_note_domestic: "", vat_note_foreign: "", invoice_due_days: "5",
  activity_code: "", registration_number: "",
  instagram: "", tiktok: "", youtube: "", linkedin: "",
};

const SECTIONS: { title: string; fields: { key: string; label: string; placeholder?: string }[] }[] = [
  {
    title: "Brend i kontakt",
    fields: [
      { key: "name", label: "Naziv", placeholder: "TOZA AI" },
      { key: "logo_url", label: "Logo URL" },
      { key: "phone", label: "Telefon", placeholder: "+381 ..." },
      { key: "email", label: "Email" },
      { key: "address", label: "Adresa" },
      { key: "city", label: "Grad" },
      { key: "currency", label: "Valuta", placeholder: "EUR" },
      { key: "locale", label: "Jezik", placeholder: "sr" },
    ],
  },
  {
    title: "Pravni podaci (Legal)",
    fields: [
      { key: "company_name", label: "Pun naziv firme" },
      { key: "pib", label: "PIB" },
      { key: "mb", label: "Matični broj" },
      { key: "bank_account", label: "Žiro račun" },
      { key: "activity_code", label: "Šifra delatnosti" },
      { key: "registration_number", label: "Broj rešenja / registracije" },
      { key: "invoice_due_days", label: "Rok plaćanja (dana)", placeholder: "5" },
    ],
  },
  {
    title: "Devizno plaćanje",
    fields: [
      { key: "iban", label: "IBAN" },
      { key: "swift", label: "SWIFT / BIC" },
      { key: "bank_name", label: "Naziv banke" },
      { key: "bank_address", label: "Adresa banke" },
    ],
  },
  {
    title: "Napomene na fakturi (potvrditi sa knjigovođom)",
    fields: [
      { key: "vat_note_domestic", label: "Domaća PDV napomena" },
      { key: "vat_note_foreign", label: "Inostrana VAT napomena (engleski)" },
    ],
  },
  {
    title: "Društvene mreže",
    fields: [
      { key: "instagram", label: "Instagram" },
      { key: "tiktok", label: "TikTok" },
      { key: "youtube", label: "YouTube" },
      { key: "linkedin", label: "LinkedIn" },
    ],
  },
];

export function PodesavanjaTab() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    fetch("/api/admin/settings", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => (d.ok ? setSettings({ ...EMPTY, ...(d.settings ?? {}) }) : setError("Ne mogu da učitam podešavanja.")))
      .catch(() => setError("Ne mogu da učitam podešavanja."));
  }, []);

  const save = async () => {
    if (!settings) return;
    setBusy(true);
    setError(null);
    setSaved(false);
    try {
      const res = await fetch("/api/admin/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      });
      const d = await res.json();
      if (!d.ok) throw new Error();
      setSaved(true);
    } catch {
      setError("Čuvanje nije uspelo.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="adm__content" style={{ maxWidth: 760 }}>
      {error && <p className="adm__err" role="alert">{error}</p>}
      {!settings && !error && <p className="adm__empty">Učitavanje…</p>}

      {settings && (
        <>
          {SECTIONS.map((sec) => (
            <section key={sec.title} className="adm__content-section">
              <h3>{sec.title}</h3>
              <div className="adm__content-grid">
                {sec.fields.map((f) => (
                  <label key={f.key} className="adm__content-field">
                    <span>{f.label}</span>
                    <input
                      type="text"
                      placeholder={f.placeholder}
                      value={settings[f.key] ?? ""}
                      onChange={(e) => {
                        setSettings({ ...settings, [f.key]: e.target.value });
                        setSaved(false);
                      }}
                    />
                  </label>
                ))}
              </div>
            </section>
          ))}

          <div className="adm__content-save">
            <button type="button" className="adm__resched-confirm" onClick={save} disabled={busy}>
              {busy ? "Čuvam…" : "Sačuvaj podešavanja"}
            </button>
            {saved && <span className="adm__hint">Sačuvano.</span>}
          </div>
        </>
      )}
    </div>
  );
}
