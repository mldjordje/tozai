"use client";

import { useEffect, useMemo, useState } from "react";
import { Plus, Trash2, Star, Eye, EyeOff } from "lucide-react";
import { LocaleTabs } from "./LocaleTabs";

type Pkg = {
  id: number;
  grp: string;
  category: string | null;
  name: string;
  price: number | null;
  currency: string;
  unit: string | null;
  description: string | null;
  features: string[];
  highlighted: boolean;
  cta_label: string | null;
  cta_href: string | null;
  sort: number;
  active: boolean;
  // The English side of the same row. Empty means "not translated" and the
  // English site falls back to the Serbian value for that one field.
  name_en: string | null;
  category_en: string | null;
  unit_en: string | null;
  description_en: string | null;
  cta_label_en: string | null;
  features_en: string[];
};

type Draft = Omit<Pkg, "id"> & { id?: number };

const GROUPS: { key: string; label: string }[] = [
  { key: "services", label: "AI Usluge" },
  { key: "education", label: "Edukacija" },
];

const emptyDraft = (grp: string): Draft => ({
  grp,
  category: "",
  name: "",
  price: null,
  currency: "EUR",
  unit: "",
  description: "",
  features: [],
  highlighted: false,
  cta_label: "",
  cta_href: "",
  sort: 0,
  active: true,
  name_en: "",
  category_en: "",
  unit_en: "",
  description_en: "",
  cta_label_en: "",
  features_en: [],
});

export function PaketiTab() {
  const [packages, setPackages] = useState<Pkg[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<Draft | null>(null);
  // Which language the text fields in the modal are bound to. Price, order and
  // visibility are shared, so they stay put while this flips.
  const [lang, setLang] = useState<"sr" | "en">("sr");
  const [busy, setBusy] = useState(false);

  const load = async () => {
    setError(null);
    try {
      const res = await fetch("/api/admin/packages", { cache: "no-store" });
      const data = await res.json();
      if (!data.ok) throw new Error();
      setPackages(data.packages);
    } catch {
      setError("Ne mogu da učitam pakete.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const grouped = useMemo(() => {
    const map: Record<string, Pkg[]> = {};
    for (const p of packages) (map[p.grp] ??= []).push(p);
    return map;
  }, [packages]);

  const save = async () => {
    if (!editing) return;
    if (!editing.name.trim()) {
      setError("Naziv je obavezan.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const method = editing.id ? "PATCH" : "POST";
      const res = await fetch("/api/admin/packages", {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editing),
      });
      const data = await res.json();
      if (!data.ok) throw new Error(data.message);
      setEditing(null);
      await load();
    } catch {
      setError("Čuvanje nije uspelo.");
    } finally {
      setBusy(false);
    }
  };

  const patch = async (id: number, fields: Partial<Pkg>) => {
    setPackages((ps) => ps.map((p) => (p.id === id ? { ...p, ...fields } : p)));
    await fetch("/api/admin/packages", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, ...fields }),
    });
  };

  const remove = async (id: number) => {
    if (!confirm("Obrisati paket?")) return;
    setPackages((ps) => ps.filter((p) => p.id !== id));
    await fetch(`/api/admin/packages?id=${id}`, { method: "DELETE" });
  };

  return (
    <div className="adm__portfolio">
      {error && <p className="adm__err" role="alert">{error}</p>}
      {loading && <p className="adm__empty">Učitavanje…</p>}

      {!loading &&
        GROUPS.map((g) => (
          <section key={g.key} className="adm__pf-section">
            <h3>{g.label}</h3>
            <div className="adm__pf-grid">
              {(grouped[g.key] ?? []).map((p) => (
                <div
                  key={p.id}
                  className="adm__pf-card"
                  style={{ opacity: p.active ? 1 : 0.5 }}
                >
                  <div className="adm__pf-card-body">
                    <strong>
                      {p.name}
                      {p.highlighted && <Star size={12} style={{ marginLeft: 6, color: "var(--neon)" }} />}
                    </strong>
                    <span className="adm__hint">
                      {p.price != null ? `${p.price.toLocaleString("sr-RS")} ${p.currency}` : "—"} {p.unit ?? ""}
                    </span>
                    {p.description && <span className="adm__hint">{p.description}</span>}
                    {p.features.length > 0 && (
                      <span className="adm__hint" style={{ fontSize: 10 }}>
                        {p.features.length} stavki
                      </span>
                    )}
                  </div>
                  <div className="adm__pf-card-actions">
                    <button
                      onClick={() => {
                        setLang("sr");
                        setEditing({ ...p });
                      }}
                    >
                      Uredi
                    </button>
                    <button onClick={() => patch(p.id, { highlighted: !p.highlighted })}>
                      <Star size={12} /> {p.highlighted ? "Skini" : "Istakni"}
                    </button>
                    <button onClick={() => patch(p.id, { active: !p.active })}>
                      {p.active ? <EyeOff size={12} /> : <Eye size={12} />} {p.active ? "Sakrij" : "Prikaži"}
                    </button>
                    <button onClick={() => remove(p.id)}>
                      <Trash2 size={12} /> Obriši
                    </button>
                  </div>
                </div>
              ))}
            </div>
            <div className="adm__pf-row" style={{ marginTop: 12 }}>
              <button
                onClick={() => {
                  setLang("sr");
                  setEditing(emptyDraft(g.key));
                }}
              >
                <Plus size={13} style={{ verticalAlign: "-2px" }} /> Novi paket ({g.label})
              </button>
            </div>
          </section>
        ))}

      {editing && (
        <div className="adm__modal" onClick={(e) => e.target === e.currentTarget && setEditing(null)}>
          <div className="adm__modal-box" style={{ padding: 22 }}>
            <button className="adm__modal-x" onClick={() => setEditing(null)} aria-label="Zatvori">
              ×
            </button>
            <h3 style={{ marginBottom: 16 }}>{editing.id ? "Uredi paket" : "Novi paket"}</h3>
            <LocaleTabs
              value={lang}
              onChange={setLang}
              note={
                lang === "en"
                  ? "Engleska verzija (/en). Prazno polje = koristi se srpski tekst."
                  : "Srpska verzija (/). Cena, redosled i vidljivost su zajednički za oba jezika."
              }
            />
            <div className="adm__pf-form" style={{ border: 0, padding: 0 }}>
              <Field label="Naziv">
                <input
                  type="text"
                  value={(lang === "en" ? editing.name_en : editing.name) ?? ""}
                  placeholder={lang === "en" ? editing.name : undefined}
                  onChange={(e) =>
                    setEditing({
                      ...editing,
                      [lang === "en" ? "name_en" : "name"]: e.target.value,
                    })
                  }
                />
              </Field>
              <div className="adm__pf-row">
                <Field label="Cena">
                  <input
                    type="number"
                    value={editing.price ?? ""}
                    onChange={(e) => setEditing({ ...editing, price: e.target.value === "" ? null : Number(e.target.value) })}
                  />
                </Field>
                <Field label="Valuta">
                  <input
                    type="text"
                    value={editing.currency}
                    onChange={(e) => setEditing({ ...editing, currency: e.target.value })}
                  />
                </Field>
                <Field label="Jedinica (npr. / mesečno)">
                  <input
                    type="text"
                    value={(lang === "en" ? editing.unit_en : editing.unit) ?? ""}
                    placeholder={lang === "en" ? editing.unit ?? "" : undefined}
                    onChange={(e) =>
                      setEditing({
                        ...editing,
                        [lang === "en" ? "unit_en" : "unit"]: e.target.value,
                      })
                    }
                  />
                </Field>
              </div>
              <Field label="Kategorija">
                <input
                  type="text"
                  value={(lang === "en" ? editing.category_en : editing.category) ?? ""}
                  placeholder={lang === "en" ? editing.category ?? "" : undefined}
                  onChange={(e) =>
                    setEditing({
                      ...editing,
                      [lang === "en" ? "category_en" : "category"]: e.target.value,
                    })
                  }
                />
              </Field>
              <Field label="Opis">
                <textarea
                  rows={2}
                  value={(lang === "en" ? editing.description_en : editing.description) ?? ""}
                  placeholder={lang === "en" ? editing.description ?? "" : undefined}
                  onChange={(e) =>
                    setEditing({
                      ...editing,
                      [lang === "en" ? "description_en" : "description"]: e.target.value,
                    })
                  }
                  style={textareaStyle}
                />
              </Field>
              <Field label="Stavke (jedna po redu)">
                <textarea
                  rows={5}
                  value={(lang === "en" ? editing.features_en : editing.features).join("\n")}
                  placeholder={
                    lang === "en" && editing.features.length > 0
                      ? editing.features.join("\n")
                      : undefined
                  }
                  onChange={(e) =>
                    setEditing({
                      ...editing,
                      [lang === "en" ? "features_en" : "features"]: e.target.value.split("\n"),
                    })
                  }
                  style={textareaStyle}
                />
              </Field>
              <div className="adm__pf-row">
                <Field label="CTA tekst">
                  <input
                    type="text"
                    value={(lang === "en" ? editing.cta_label_en : editing.cta_label) ?? ""}
                    placeholder={lang === "en" ? editing.cta_label ?? "" : undefined}
                    onChange={(e) =>
                      setEditing({
                        ...editing,
                        [lang === "en" ? "cta_label_en" : "cta_label"]: e.target.value,
                      })
                    }
                  />
                </Field>
                <Field label="CTA link">
                  <input
                    type="text"
                    value={editing.cta_href ?? ""}
                    onChange={(e) => setEditing({ ...editing, cta_href: e.target.value })}
                  />
                </Field>
                <Field label="Redosled">
                  <input
                    type="number"
                    value={editing.sort}
                    onChange={(e) => setEditing({ ...editing, sort: Number(e.target.value) })}
                  />
                </Field>
              </div>
              <label className="adm__pf-feat">
                <input
                  type="checkbox"
                  checked={editing.highlighted}
                  onChange={(e) => setEditing({ ...editing, highlighted: e.target.checked })}
                />
                Istaknut (popular)
              </label>
              <label className="adm__pf-feat">
                <input
                  type="checkbox"
                  checked={editing.active}
                  onChange={(e) => setEditing({ ...editing, active: e.target.checked })}
                />
                Aktivan (vidljiv na sajtu)
              </label>
              <button className="adm__pf-submit" onClick={save} disabled={busy}>
                {busy ? "Čuvam…" : "Sačuvaj"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const textareaStyle: React.CSSProperties = {
  padding: "10px 14px",
  border: "1px solid var(--line)",
  borderRadius: 4,
  background: "rgba(255,255,255,.03)",
  color: "#fff",
  font: "inherit",
  resize: "vertical",
};

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="adm__content-field" style={{ flex: 1, minWidth: 120 }}>
      <span>{label}</span>
      {children}
    </label>
  );
}
