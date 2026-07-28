"use client";

import { useEffect, useState } from "react";
import { Plus, Trash2 } from "lucide-react";

type Settings = Record<string, string | null>;

const EMPTY: Settings = {
  name: "TOZA AI", logo_url: "", currency: "EUR", locale: "sr", phone: "", email: "",
  address: "", city: "", company_name: "", pib: "", mb: "", bank_account: "",
  iban: "", swift: "", bank_name: "", bank_address: "",
  vat_note_domestic: "", vat_note_foreign: "", invoice_due_days: "5",
  activity_code: "", registration_number: "",
};

type Social = { label: string; url: string };

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
];

// Suggestions, not a fixed set — one click fills the name and the studio pastes
// the link. Anything else is typed by hand, which is the whole point of the
// list replacing the four fixed columns.
const SUGGESTED = ["Instagram", "TikTok", "YouTube", "LinkedIn", "Facebook", "X", "Threads", "WhatsApp"];

export function PodesavanjaTab() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [socials, setSocials] = useState<Social[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    fetch("/api/admin/settings", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => {
        if (!d.ok) throw new Error();
        setSettings({ ...EMPTY, ...(d.settings ?? {}) });
        setSocials(Array.isArray(d.socials) ? d.socials : []);
      })
      .catch(() => setError("Ne mogu da učitam podešavanja."));
  }, []);

  const editSocial = (index: number, patch: Partial<Social>) => {
    setSocials((list) => list.map((s, i) => (i === index ? { ...s, ...patch } : s)));
    setSaved(false);
  };

  const save = async () => {
    if (!settings) return;
    setBusy(true);
    setError(null);
    setSaved(false);
    try {
      const res = await fetch("/api/admin/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...settings, socials }),
      });
      const d = await res.json();
      if (!d.ok) throw new Error();
      // The server drops half-filled rows; mirror that back so the form shows
      // what is actually stored rather than what was typed and discarded.
      if (Array.isArray(d.socials)) setSocials(d.socials);
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

          <section className="adm__content-section">
            <h3>Društvene mreže</h3>
            <p className="adm__hint">
              Nalepi pun link profila. Ikonica se bira automatski po linku i prikazuje se u
              futeru i u sekciji Kontakt na sajtu. Redosled ovde je redosled na sajtu.
            </p>

            {socials.length === 0 && <p className="adm__empty">Još nema dodatih mreža.</p>}

            {socials.map((social, index) => (
              <div key={index} className="adm__pf-row" style={{ marginTop: 10 }}>
                <input
                  type="text"
                  style={{ flex: "0 0 150px", minWidth: 110 }}
                  placeholder="Instagram"
                  value={social.label}
                  onChange={(e) => editSocial(index, { label: e.target.value })}
                />
                <input
                  type="text"
                  style={{ flex: 1 }}
                  placeholder="https://instagram.com/toza.aii"
                  value={social.url}
                  onChange={(e) => editSocial(index, { url: e.target.value })}
                />
                <button
                  type="button"
                  onClick={() => {
                    setSocials((list) => list.filter((_, i) => i !== index));
                    setSaved(false);
                  }}
                  aria-label={`Obriši ${social.label || "mrežu"}`}
                >
                  <Trash2 size={12} />
                </button>
              </div>
            ))}

            <div className="adm__pf-chips" style={{ marginTop: 14 }}>
              {SUGGESTED.map((label) => (
                <button
                  key={label}
                  type="button"
                  className="adm__chip"
                  onClick={() => {
                    setSocials((list) => [...list, { label, url: "" }]);
                    setSaved(false);
                  }}
                >
                  <Plus size={11} /> {label}
                </button>
              ))}
              <button
                type="button"
                className="adm__chip"
                onClick={() => {
                  setSocials((list) => [...list, { label: "", url: "" }]);
                  setSaved(false);
                }}
              >
                <Plus size={11} /> Druga mreža
              </button>
            </div>
          </section>

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
