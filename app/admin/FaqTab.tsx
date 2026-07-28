"use client";

import { useEffect, useState } from "react";
import { Plus, Trash2, Eye, EyeOff } from "lucide-react";
import { LocaleTabs } from "./LocaleTabs";

type Faq = {
  id: number;
  question: string;
  answer: string;
  question_en: string | null;
  answer_en: string | null;
  sort: number;
  active: boolean;
};
type Draft = Omit<Faq, "id"> & { id?: number };

const empty: Draft = {
  question: "",
  answer: "",
  question_en: "",
  answer_en: "",
  sort: 0,
  active: true,
};

export function FaqTab() {
  const [items, setItems] = useState<Faq[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<Draft | null>(null);
  const [lang, setLang] = useState<"sr" | "en">("sr");
  const [busy, setBusy] = useState(false);

  const load = async () => {
    try {
      const res = await fetch("/api/admin/faq", { cache: "no-store" });
      const data = await res.json();
      if (data.ok) setItems(data.items);
    } catch {
      setError("Ne mogu da učitam FAQ.");
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    load();
  }, []);

  const save = async () => {
    if (!editing) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/faq", {
        method: editing.id ? "PATCH" : "POST",
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

  const patch = async (id: number, fields: Partial<Faq>) => {
    setItems((xs) => xs.map((x) => (x.id === id ? { ...x, ...fields } : x)));
    await fetch("/api/admin/faq", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, ...fields }),
    });
  };

  const remove = async (id: number) => {
    if (!confirm("Obrisati pitanje?")) return;
    setItems((xs) => xs.filter((x) => x.id !== id));
    await fetch(`/api/admin/faq?id=${id}`, { method: "DELETE" });
  };

  return (
    <div className="adm__content" style={{ maxWidth: 760 }}>
      {error && <p className="adm__err" role="alert">{error}</p>}

      <div className="adm__pf-row">
        <button
          onClick={() => {
            setLang("sr");
            setEditing({ ...empty, sort: items.length });
          }}
        >
          <Plus size={13} style={{ verticalAlign: "-2px" }} /> Novo pitanje
        </button>
      </div>

      {loading && <p className="adm__empty">Učitavanje…</p>}
      {!loading && items.length === 0 && <p className="adm__empty">Još nema pitanja.</p>}

      <div className="adm__list">
        {items.map((f) => (
          <article key={f.id} className="adm__row" style={{ gridTemplateColumns: "1fr auto", opacity: f.active ? 1 : 0.5 }}>
            <div className="adm__who">
              <strong>{f.question}</strong>
              <p>{f.answer}</p>
            </div>
            <div className="adm__btns">
              <button
                onClick={() => {
                  setLang("sr");
                  setEditing({ ...f });
                }}
              >
                Uredi
              </button>
              <button onClick={() => patch(f.id, { active: !f.active })}>
                {f.active ? <EyeOff size={12} /> : <Eye size={12} />}
              </button>
              <button onClick={() => remove(f.id)}>
                <Trash2 size={12} />
              </button>
            </div>
          </article>
        ))}
      </div>

      {editing && (
        <div className="adm__modal" onClick={(e) => e.target === e.currentTarget && setEditing(null)}>
          <div className="adm__modal-box" style={{ padding: 22 }}>
            <button className="adm__modal-x" onClick={() => setEditing(null)} aria-label="Zatvori">×</button>
            <h3 style={{ marginBottom: 16 }}>{editing.id ? "Uredi pitanje" : "Novo pitanje"}</h3>
            <LocaleTabs
              value={lang}
              onChange={setLang}
              note={
                lang === "en"
                  ? "Engleska verzija. Prazno polje koristi srpski tekst."
                  : "Srpska verzija pitanja."
              }
            />
            <div className="adm__content-field" style={{ marginBottom: 12 }}>
              <span>Pitanje</span>
              <input
                type="text"
                value={(lang === "en" ? editing.question_en : editing.question) ?? ""}
                placeholder={lang === "en" ? editing.question : undefined}
                onChange={(e) =>
                  setEditing({
                    ...editing,
                    [lang === "en" ? "question_en" : "question"]: e.target.value,
                  })
                }
              />
            </div>
            <div className="adm__content-field" style={{ marginBottom: 12 }}>
              <span>Odgovor</span>
              <textarea
                rows={5}
                value={(lang === "en" ? editing.answer_en : editing.answer) ?? ""}
                placeholder={lang === "en" ? editing.answer : undefined}
                onChange={(e) =>
                  setEditing({
                    ...editing,
                    [lang === "en" ? "answer_en" : "answer"]: e.target.value,
                  })
                }
              />
            </div>
            <button className="adm__pf-submit" onClick={save} disabled={busy}>
              {busy ? "Čuvam…" : "Sačuvaj"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
