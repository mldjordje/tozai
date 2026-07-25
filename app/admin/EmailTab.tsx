"use client";

import { useEffect, useState } from "react";

type Tpl = { key: string; name: string; subject: string; body: string; active: boolean };

export function EmailTab() {
  const [templates, setTemplates] = useState<Tpl[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [savedKey, setSavedKey] = useState<string | null>(null);
  const [busyKey, setBusyKey] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/admin/email-templates", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => (d.ok ? setTemplates(d.templates) : setError("Ne mogu da učitam šablone.")))
      .catch(() => setError("Ne mogu da učitam šablone."))
      .finally(() => setLoading(false));
  }, []);

  const edit = (key: string, fields: Partial<Tpl>) => {
    setTemplates((ts) => ts.map((t) => (t.key === key ? { ...t, ...fields } : t)));
    setSavedKey(null);
  };

  const save = async (t: Tpl) => {
    setBusyKey(t.key);
    setSavedKey(null);
    try {
      const res = await fetch("/api/admin/email-templates", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: t.key, subject: t.subject, body: t.body, active: t.active }),
      });
      const d = await res.json();
      if (d.ok) setSavedKey(t.key);
    } finally {
      setBusyKey(null);
    }
  };

  return (
    <div className="adm__content" style={{ maxWidth: 760 }}>
      <p className="adm__hint" style={{ marginBottom: 8 }}>
        Placeholderi poput <code>{"{{ime}}"}</code>, <code>{"{{iznos}}"}</code>, <code>{"{{datum}}"}</code> se popunjavaju pri slanju.
      </p>
      {error && <p className="adm__err" role="alert">{error}</p>}
      {loading && <p className="adm__empty">Učitavanje…</p>}

      {templates.map((t) => (
        <section key={t.key} className="adm__content-section">
          <h3>{t.name}</h3>
          <div className="adm__content-field" style={{ marginBottom: 12 }}>
            <span>Naslov (subject)</span>
            <input type="text" value={t.subject} onChange={(e) => edit(t.key, { subject: e.target.value })} />
          </div>
          <div className="adm__content-field" style={{ marginBottom: 12 }}>
            <span>Tekst</span>
            <textarea rows={6} value={t.body} onChange={(e) => edit(t.key, { body: e.target.value })} />
          </div>
          <div className="adm__editor-actions">
            <label className="adm__pf-feat">
              <input type="checkbox" checked={t.active} onChange={(e) => edit(t.key, { active: e.target.checked })} /> Aktivan
            </label>
            <button onClick={() => save(t)} disabled={busyKey === t.key}>
              {busyKey === t.key ? "Čuvam…" : "Sačuvaj"}
            </button>
            {savedKey === t.key && <span className="adm__hint">Sačuvano.</span>}
          </div>
        </section>
      ))}
    </div>
  );
}
