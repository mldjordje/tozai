"use client";

import { useEffect, useRef, useState } from "react";
import { Plus, Trash2, Upload } from "lucide-react";

type Category = { id: number; name: string; slug: string; sort: number };
type Work = {
  id: number;
  category_id: number | null;
  title: string;
  client: string | null;
  media_url: string;
  media_type: string;
  poster_url: string | null;
  description: string | null;
  tags: string[];
  featured: boolean;
  sort: number;
};
type Draft = Omit<Work, "id"> & { id?: number };

const emptyDraft = (): Draft => ({
  category_id: null,
  title: "",
  client: "",
  media_url: "",
  media_type: "image",
  poster_url: "",
  description: "",
  tags: [],
  featured: true,
  sort: 0,
});

export function PortfolioTab() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [works, setWorks] = useState<Work[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<Draft | null>(null);
  const [newCat, setNewCat] = useState("");
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = async () => {
    try {
      const res = await fetch("/api/admin/portfolio", { cache: "no-store" });
      const d = await res.json();
      if (d.ok) {
        setCategories(d.categories);
        setWorks(d.works);
      }
    } catch {
      setError("Ne mogu da učitam portfolio.");
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    load();
  }, []);

  const addCategory = async () => {
    if (!newCat.trim()) return;
    await fetch("/api/admin/portfolio?type=category", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newCat, sort: categories.length }),
    });
    setNewCat("");
    await load();
  };

  const removeCategory = async (id: number) => {
    if (!confirm("Obrisati kategoriju? Radovi ostaju bez kategorije.")) return;
    await fetch(`/api/admin/portfolio?type=category&id=${id}`, { method: "DELETE" });
    await load();
  };

  const uploadFile = async (file: File) => {
    if (!editing) return;
    setBusy(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/admin/upload", { method: "POST", body: fd });
      const d = await res.json();
      if (d.ok) {
        setEditing({ ...editing, media_url: d.url, media_type: d.type ?? "image" });
      } else {
        setError(d.message ?? "Upload nije uspeo — nalepi URL ručno.");
      }
    } catch {
      setError("Upload nije uspeo — nalepi URL ručno.");
    } finally {
      setBusy(false);
    }
  };

  const save = async () => {
    if (!editing) return;
    if (!editing.title.trim() || !editing.media_url.trim()) {
      setError("Naslov i medij (URL ili upload) su obavezni.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/portfolio", {
        method: editing.id ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editing),
      });
      const d = await res.json();
      if (!d.ok) throw new Error(d.message);
      setEditing(null);
      await load();
    } catch {
      setError("Čuvanje nije uspelo.");
    } finally {
      setBusy(false);
    }
  };

  const removeWork = async (id: number) => {
    if (!confirm("Obrisati rad?")) return;
    setWorks((w) => w.filter((x) => x.id !== id));
    await fetch(`/api/admin/portfolio?id=${id}`, { method: "DELETE" });
  };

  const catName = (id: number | null) => categories.find((c) => c.id === id)?.name ?? "—";

  return (
    <div className="adm__portfolio">
      {error && <p className="adm__err" role="alert">{error}</p>}

      <section className="adm__pf-section">
        <h3>Kategorije</h3>
        <div className="adm__pf-chips">
          {categories.map((c) => (
            <span key={c.id} className="adm__chip">
              {c.name}
              <button onClick={() => removeCategory(c.id)} aria-label="Obriši">×</button>
            </span>
          ))}
        </div>
        <div className="adm__pf-row">
          <input type="text" placeholder="Nova kategorija" value={newCat} onChange={(e) => setNewCat(e.target.value)} />
          <button onClick={addCategory}>Dodaj</button>
        </div>
      </section>

      <section className="adm__pf-section">
        <h3>Radovi / Case studies</h3>
        <div className="adm__pf-row" style={{ marginBottom: 14 }}>
          <button onClick={() => setEditing(emptyDraft())}>
            <Plus size={13} style={{ verticalAlign: "-2px" }} /> Novi rad
          </button>
        </div>

        {loading && <p className="adm__empty">Učitavanje…</p>}
        {!loading && works.length === 0 && <p className="adm__empty">Još nema radova.</p>}

        <div className="adm__pf-grid">
          {works.map((w) => (
            <div key={w.id} className="adm__pf-card">
              {w.media_type === "video" ? (
                // eslint-disable-next-line jsx-a11y/media-has-caption
                <video src={w.media_url} poster={w.poster_url ?? undefined} muted playsInline />
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={w.media_url} alt={w.title} />
              )}
              <div className="adm__pf-card-body">
                <strong>{w.title}</strong>
                <span className="adm__hint" style={{ fontSize: 10 }}>{catName(w.category_id)}{w.client ? ` · ${w.client}` : ""}</span>
                {!w.featured && <span className="adm__badge adm__badge--default">skriveno</span>}
              </div>
              <div className="adm__pf-card-actions">
                <button onClick={() => setEditing({ ...w, client: w.client ?? "", poster_url: w.poster_url ?? "", description: w.description ?? "" })}>
                  Uredi
                </button>
                <button onClick={() => removeWork(w.id)}>
                  <Trash2 size={12} />
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>

      {editing && (
        <div className="adm__modal" onClick={(e) => e.target === e.currentTarget && setEditing(null)}>
          <div className="adm__modal-box" style={{ padding: 22 }}>
            <button className="adm__modal-x" onClick={() => setEditing(null)} aria-label="Zatvori">×</button>
            <h3 style={{ marginBottom: 16 }}>{editing.id ? "Uredi rad" : "Novi rad"}</h3>
            <div className="adm__pf-form" style={{ border: 0, padding: 0 }}>
              <label className="adm__content-field">
                <span>Naslov</span>
                <input type="text" value={editing.title} onChange={(e) => setEditing({ ...editing, title: e.target.value })} />
              </label>
              <div className="adm__pf-row">
                <label className="adm__content-field" style={{ flex: 1 }}>
                  <span>Klijent</span>
                  <input type="text" value={editing.client ?? ""} onChange={(e) => setEditing({ ...editing, client: e.target.value })} />
                </label>
                <label className="adm__content-field" style={{ flex: 1 }}>
                  <span>Kategorija</span>
                  <select
                    value={editing.category_id ?? ""}
                    onChange={(e) => setEditing({ ...editing, category_id: e.target.value ? Number(e.target.value) : null })}
                  >
                    <option value="">—</option>
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </label>
              </div>

              <label className="adm__content-field">
                <span>Medij (URL slike/videa)</span>
                <input type="text" value={editing.media_url} onChange={(e) => setEditing({ ...editing, media_url: e.target.value })} placeholder="https://… ili upload ispod" />
              </label>
              <div className="adm__pf-upload">
                <button type="button" className="adm__pf-file" onClick={() => fileRef.current?.click()}>
                  <Upload size={13} /> {busy ? "Šaljem…" : "Upload fajl"}
                  <input
                    ref={fileRef}
                    type="file"
                    accept="image/*,video/*"
                    onChange={(e) => e.target.files?.[0] && uploadFile(e.target.files[0])}
                  />
                </button>
                <select value={editing.media_type} onChange={(e) => setEditing({ ...editing, media_type: e.target.value })}>
                  <option value="image">Slika</option>
                  <option value="video">Video</option>
                </select>
              </div>

              <label className="adm__content-field">
                <span>Opis</span>
                <textarea rows={2} value={editing.description ?? ""} onChange={(e) => setEditing({ ...editing, description: e.target.value })} />
              </label>
              <label className="adm__pf-feat">
                <input type="checkbox" checked={editing.featured} onChange={(e) => setEditing({ ...editing, featured: e.target.checked })} />
                Prikaži na sajtu
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
