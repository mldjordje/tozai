"use client";

import { useEffect, useRef, useState } from "react";
import { Plus, Trash2, Upload } from "lucide-react";
import { uploadToBlob } from "@/lib/blob-upload";
import { parseYouTubeId, posterCandidates } from "@/lib/youtube";
import { LocaleTabs } from "./LocaleTabs";

type Category = { id: number; name: string; name_en: string | null; slug: string; sort: number };
type Work = {
  id: number;
  category_id: number | null;
  title: string;
  client: string | null;
  media_url: string;
  media_type: string;
  youtube_id: string | null;
  poster_url: string | null;
  description: string | null;
  tags: string[];
  featured: boolean;
  sort: number;
  title_en: string | null;
  description_en: string | null;
};
type Draft = Omit<Work, "id"> & { id?: number };

// Works are YouTube Shorts by default — that is what the studio publishes. A
// hosted file stays possible for anything that never went up on YouTube.
const emptyDraft = (): Draft => ({
  category_id: null,
  title: "",
  client: "",
  media_url: "",
  media_type: "youtube",
  youtube_id: null,
  poster_url: "",
  description: "",
  tags: [],
  featured: true,
  sort: 0,
  title_en: "",
  description_en: "",
});

export function PortfolioTab() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [works, setWorks] = useState<Work[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<Draft | null>(null);
  const [newCat, setNewCat] = useState("");
  const [newCatEn, setNewCatEn] = useState("");
  const [lang, setLang] = useState<"sr" | "en">("sr");
  const [busy, setBusy] = useState(false);
  /** Which YouTube still the preview is currently trying — reset per video. */
  const [posterIndex, setPosterIndex] = useState(0);
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
      body: JSON.stringify({ name: newCat, name_en: newCatEn, sort: categories.length }),
    });
    setNewCat("");
    setNewCatEn("");
    await load();
  };

  const patchCategory = async (id: number, fields: Partial<Category>) => {
    setCategories((items) => items.map((item) => (item.id === id ? { ...item, ...fields } : item)));
    await fetch("/api/admin/portfolio?type=category", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, ...fields }),
    });
  };

  const removeCategory = async (id: number) => {
    if (!confirm("Obrisati kategoriju? Radovi ostaju bez kategorije.")) return;
    await fetch(`/api/admin/portfolio?type=category&id=${id}`, { method: "DELETE" });
    await load();
  };

  const uploadFile = async (file: File, target: "media" | "poster") => {
    if (!editing) return;
    setBusy(true);
    setError(null);
    try {
      // Straight from the browser to Blob — a route handler would cap the body
      // at 4.5MB and every portfolio video is bigger than that.
      const media = await uploadToBlob(file, "portfolio");
      setEditing(
        target === "poster"
          ? { ...editing, poster_url: media.url }
          : { ...editing, media_url: media.url, media_type: media.type },
      );
    } catch (err) {
      setError(
        err instanceof Error && err.message
          ? `${err.message} — ili nalepi URL ručno.`
          : "Upload nije uspeo — nalepi URL ručno.",
      );
    } finally {
      setBusy(false);
    }
  };

  const save = async () => {
    if (!editing) return;
    if (!editing.title.trim() || !editing.media_url.trim()) {
      setError("Naslov i medij (link ili upload) su obavezni.");
      return;
    }
    if (editing.media_type === "youtube" && !parseYouTubeId(editing.media_url)) {
      setError("Link nije prepoznat kao YouTube video.");
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

  const isYoutube = editing?.media_type === "youtube";
  const videoId = isYoutube ? parseYouTubeId(editing?.media_url ?? "") : null;
  // A new link starts the fallback chain over; without this a video whose
  // oardefault exists would keep showing the previous video's fallback level.
  useEffect(() => {
    setPosterIndex(0);
  }, [videoId]);

  return (
    <div className="adm__portfolio">
      {error && <p className="adm__err" role="alert">{error}</p>}

      <section className="adm__pf-section">
        <h3>Kategorije</h3>
        <LocaleTabs
          value={lang}
          onChange={setLang}
          note={lang === "en" ? "Engleski nazivi kategorija i radova." : "Srpski nazivi kategorija i radova."}
        />
        <div className="adm__pf-chips">
          {categories.map((c) => (
            <span key={c.id} className="adm__chip">
              <input
                type="text"
                value={(lang === "en" ? c.name_en : c.name) ?? ""}
                placeholder={lang === "en" ? c.name : undefined}
                aria-label={`${lang === "en" ? "Engleski" : "Srpski"} naziv kategorije`}
                onChange={(e) =>
                  setCategories((items) =>
                    items.map((item) =>
                      item.id === c.id
                        ? { ...item, [lang === "en" ? "name_en" : "name"]: e.target.value }
                        : item,
                    ),
                  )
                }
                onBlur={(e) =>
                  void patchCategory(c.id, {
                    [lang === "en" ? "name_en" : "name"]: e.target.value,
                  })
                }
              />
              <button onClick={() => removeCategory(c.id)} aria-label="Obriši">×</button>
            </span>
          ))}
        </div>
        <div className="adm__pf-row">
          <input type="text" placeholder="Nova kategorija" value={newCat} onChange={(e) => setNewCat(e.target.value)} />
          <input
            type="text"
            placeholder="Naziv na engleskom (opciono)"
            value={newCatEn}
            onChange={(e) => setNewCatEn(e.target.value)}
          />
          <button onClick={addCategory}>Dodaj</button>
        </div>
      </section>

      <section className="adm__pf-section">
        <h3>Radovi / Case studies</h3>
        <div className="adm__pf-row" style={{ marginBottom: 14 }}>
          <button
            onClick={() => {
              setLang("sr");
              setEditing(emptyDraft());
            }}
          >
            <Plus size={13} style={{ verticalAlign: "-2px" }} /> Novi rad
          </button>
        </div>

        {loading && <p className="adm__empty">Učitavanje…</p>}
        {!loading && works.length === 0 && <p className="adm__empty">Još nema radova.</p>}

        <div className="adm__pf-grid">
          {works.map((w) => (
            <div key={w.id} className="adm__pf-card">
              {w.media_type === "youtube" && w.youtube_id ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={w.poster_url || posterCandidates(w.youtube_id)[1]} alt={w.title} />
              ) : w.media_type === "video" ? (
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
                <button
                  onClick={() => {
                    setLang("sr");
                    setEditing({
                      ...w,
                      client: w.client ?? "",
                      poster_url: w.poster_url ?? "",
                      description: w.description ?? "",
                      title_en: w.title_en ?? "",
                      description_en: w.description_en ?? "",
                    })
                  }}
                >
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
            <LocaleTabs
              value={lang}
              onChange={setLang}
              note={
                lang === "en"
                  ? "Prevedi naslov i opis. Ostali podaci i medij su zajednički."
                  : "Srpska verzija rada."
              }
            />
            <div className="adm__pf-form" style={{ border: 0, padding: 0 }}>
              <label className="adm__content-field">
                <span>Naslov</span>
                <input
                  type="text"
                  value={(lang === "en" ? editing.title_en : editing.title) ?? ""}
                  placeholder={lang === "en" ? editing.title : undefined}
                  onChange={(e) =>
                    setEditing({
                      ...editing,
                      [lang === "en" ? "title_en" : "title"]: e.target.value,
                    })
                  }
                />
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
                <span>Tip rada</span>
                <select
                  value={isYoutube ? "youtube" : editing.media_type === "video" ? "video" : "image"}
                  onChange={(e) => setEditing({ ...editing, media_type: e.target.value, media_url: "" })}
                >
                  <option value="youtube">YouTube Shorts (link)</option>
                  <option value="video">Video fajl (upload)</option>
                  <option value="image">Slika (upload)</option>
                </select>
              </label>

              {isYoutube ? (
                <>
                  <label className="adm__content-field">
                    <span>Link Shortsa</span>
                    <input
                      type="text"
                      value={editing.media_url}
                      onChange={(e) => setEditing({ ...editing, media_url: e.target.value })}
                      placeholder="https://www.youtube.com/shorts/…"
                    />
                    {/* The id is parsed as you type, so a mistyped link is caught
                        here rather than showing up as a dead card on the site. */}
                    {editing.media_url.trim() &&
                      (videoId ? (
                        <span className="adm__hint">Prepoznat video: {videoId}</span>
                      ) : (
                        <span className="adm__err">Ovo nije ispravan YouTube link.</span>
                      ))}
                  </label>
                  {videoId && (
                    <div className="adm__pf-ytpreview">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        key={videoId}
                        src={
                          editing.poster_url?.trim() ||
                          // Clamped: running off the end of the chain would
                          // blank the src and leave an empty box.
                          posterCandidates(videoId)[
                            Math.min(posterIndex, posterCandidates(videoId).length - 1)
                          ]
                        }
                        alt=""
                        onError={() => setPosterIndex((i) => i + 1)}
                        onLoad={(e) => {
                          // YouTube answers 200 with a grey 120x90 placeholder
                          // for a still it does not have, so only the size says
                          // whether the thumbnail is real.
                          if (!editing.poster_url?.trim() && e.currentTarget.naturalWidth <= 120) {
                            setPosterIndex((i) => i + 1);
                          }
                        }}
                      />
                      <div>
                        <span className="adm__hint">
                          Naslovna se povlači sa YouTube-a. Ako ne valja, uploaduj svoju.
                        </span>
                        <button type="button" className="adm__pf-file" onClick={() => fileRef.current?.click()}>
                          <Upload size={13} /> {busy ? "Šaljem…" : "Naslovna slika"}
                          <input
                            ref={fileRef}
                            type="file"
                            accept="image/*"
                            onChange={(e) => e.target.files?.[0] && uploadFile(e.target.files[0], "poster")}
                          />
                        </button>
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <>
                  <label className="adm__content-field">
                    <span>Medij (URL slike/videa)</span>
                    <input
                      type="text"
                      value={editing.media_url}
                      onChange={(e) => setEditing({ ...editing, media_url: e.target.value })}
                      placeholder="https://… ili upload ispod"
                    />
                  </label>
                  <div className="adm__pf-upload">
                    <button type="button" className="adm__pf-file" onClick={() => fileRef.current?.click()}>
                      <Upload size={13} /> {busy ? "Šaljem…" : "Upload fajl"}
                      <input
                        ref={fileRef}
                        type="file"
                        accept="image/*,video/*"
                        onChange={(e) => e.target.files?.[0] && uploadFile(e.target.files[0], "media")}
                      />
                    </button>
                  </div>
                </>
              )}

              <label className="adm__content-field">
                <span>Opis</span>
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
                />
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
