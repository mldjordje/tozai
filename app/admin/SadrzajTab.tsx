"use client";

import { useEffect, useState } from "react";

// Editable landing copy. Keys here are the contract the public site reads from
// site_content['landing']; add fields as the landing grows.
const FIELDS: { key: string; label: string; multiline?: boolean; placeholder?: string }[] = [
  { key: "hero_title", label: "Hero — naslov", placeholder: "Build Your Business With AI" },
  { key: "hero_subtitle", label: "Hero — podnaslov", multiline: true },
  { key: "hero_cta", label: "Hero — CTA dugme", placeholder: "Zakaži konsultaciju" },
  { key: "about_title", label: "O nama — naslov" },
  { key: "about_body", label: "O nama — tekst", multiline: true },
  { key: "contact_email", label: "Kontakt email" },
  { key: "contact_phone", label: "Kontakt telefon" },
];

export function SadrzajTab() {
  const [values, setValues] = useState<Record<string, string> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    fetch("/api/admin/content", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => (d.ok ? setValues(d.content ?? {}) : setError("Ne mogu da učitam sadržaj.")))
      .catch(() => setError("Ne mogu da učitam sadržaj."));
  }, []);

  const save = async () => {
    if (!values) return;
    setBusy(true);
    setError(null);
    setSaved(false);
    try {
      const res = await fetch("/api/admin/content", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ values }),
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
      <p className="adm__hint" style={{ marginBottom: 4 }}>
        Tekst landing stranice. Prazna polja koriste podrazumevani tekst sa sajta.
      </p>
      {error && <p className="adm__err" role="alert">{error}</p>}
      {!values && !error && <p className="adm__empty">Učitavanje…</p>}

      {values && (
        <>
          <section className="adm__content-section">
            <div className="adm__content-grid">
              {FIELDS.map((f) => (
                <label key={f.key} className="adm__content-field" style={f.multiline ? { gridColumn: "1/-1" } : undefined}>
                  <span>{f.label}</span>
                  {f.multiline ? (
                    <textarea
                      rows={3}
                      placeholder={f.placeholder}
                      value={values[f.key] ?? ""}
                      onChange={(e) => {
                        setValues({ ...values, [f.key]: e.target.value });
                        setSaved(false);
                      }}
                    />
                  ) : (
                    <input
                      type="text"
                      placeholder={f.placeholder}
                      value={values[f.key] ?? ""}
                      onChange={(e) => {
                        setValues({ ...values, [f.key]: e.target.value });
                        setSaved(false);
                      }}
                    />
                  )}
                </label>
              ))}
            </div>
          </section>

          <div className="adm__content-save">
            <button type="button" className="adm__resched-confirm" onClick={save} disabled={busy}>
              {busy ? "Čuvam…" : "Sačuvaj sadržaj"}
            </button>
            {saved && <span className="adm__hint">Sačuvano.</span>}
          </div>
        </>
      )}
    </div>
  );
}
