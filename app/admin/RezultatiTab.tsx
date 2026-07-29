"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowDown, ArrowUp, RefreshCw, Trash2, Upload } from "lucide-react";
import { readImageSize, uploadToBlob } from "@/lib/blob-upload";
import { LocaleTabs } from "./LocaleTabs";

// Proof rail editor — the screenshots on the landing (#portfolio).
//
// Upload first, describe second: picking a file creates the row immediately, so
// the studio never fills a form and then loses it to a failed upload. Text
// fields save on blur, one card at a time, because each card is independent and
// a global "save everything" button invites losing edits by navigating away.

type Shot = {
  id: number;
  image_url: string;
  blob_pathname: string | null;
  alt: string;
  handle: string;
  stat: string;
  width: number | null;
  height: number | null;
  wide: boolean;
  sort: number;
  active: boolean;
  alt_en: string | null;
  stat_en: string | null;
};

type Status = "idle" | "saving" | "saved";

export function RezultatiTab() {
  const [shots, setShots] = useState<Shot[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [lang, setLang] = useState<"sr" | "en">("sr");
  const [status, setStatus] = useState<Record<number, Status>>({});
  const fileRef = useRef<HTMLInputElement>(null);
  /** Which card the replace-picker was opened for, and which card is mid-swap.
   *  One shared file input rather than one per card: a card is remounted on
   *  every reorder, and a per-card input loses its pending selection with it. */
  const replaceRef = useRef<HTMLInputElement>(null);
  const replaceFor = useRef<number | null>(null);
  const [replacing, setReplacing] = useState<number | null>(null);
  /** Last values known to be persisted, per row — the baseline blur compares
   *  against. A ref, not state: changing it must not re-render the grid. */
  const saved = useRef<Record<number, Partial<Shot>>>({});

  const load = async () => {
    try {
      const res = await fetch("/api/admin/results", { cache: "no-store" });
      const d = await res.json();
      if (!d.ok) throw new Error();
      setShots(d.shots);
      saved.current = Object.fromEntries(
        (d.shots as Shot[]).map((s) => [
          s.id,
          { handle: s.handle, stat: s.stat, alt: s.alt, stat_en: s.stat_en, alt_en: s.alt_en },
        ]),
      );
    } catch {
      setError("Ne mogu da učitam rezultate.");
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    void load();
  }, []);

  const addFile = async (file: File) => {
    setUploading(true);
    setError(null);
    try {
      // Measured before upload: next/image needs the real ratio, and reading it
      // here is the only moment the original file is in hand.
      const [media, size] = await Promise.all([uploadToBlob(file, "rezultati"), readImageSize(file)]);
      if (media.type !== "image") throw new Error("Za rezultate ide slika, ne video.");

      const res = await fetch("/api/admin/results", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          image_url: media.url,
          blob_pathname: media.pathname,
          width: size?.width ?? null,
          height: size?.height ?? null,
          // A screenshot wider than it is tall is a desktop/profile grab; the
          // rail gives those the wide card. The studio can flip it.
          wide: size ? size.width / size.height > 0.9 : false,
        }),
      });
      const d = await res.json();
      if (!d.ok) throw new Error(d.message);
      await load();
    } catch (err) {
      setError(err instanceof Error && err.message ? err.message : "Upload nije uspeo.");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  /** Swap the image on an existing card, keeping its text, order and flags.
   *
   *  The row is updated in one PATCH — new URL, new pathname, new measured size
   *  — and the old file is named for deletion in the same call, so a replaced
   *  screenshot does not leave a paid-for orphan in Blob. `wide` is deliberately
   *  NOT recomputed: it is a layout choice the studio may have made by hand, and
   *  a replacement of the same subject should not silently undo it. */
  const replaceFile = async (shot: Shot, file: File) => {
    setReplacing(shot.id);
    setError(null);
    try {
      const [media, size] = await Promise.all([
        uploadToBlob(file, "rezultati"),
        readImageSize(file),
      ]);
      if (media.type !== "image") throw new Error("Za rezultate ide slika, ne video.");

      const res = await fetch("/api/admin/results", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: shot.id,
          image_url: media.url,
          blob_pathname: media.pathname,
          width: size?.width ?? null,
          height: size?.height ?? null,
          delete_blob: shot.blob_pathname,
        }),
      });
      const d = await res.json();
      if (!d.ok) throw new Error(d.message);
      await load();
    } catch (err) {
      setError(err instanceof Error && err.message ? err.message : "Zamena slike nije uspela.");
    } finally {
      setReplacing(null);
      replaceFor.current = null;
      if (replaceRef.current) replaceRef.current.value = "";
    }
  };

  const patch = async (id: number, body: Partial<Shot>) => {
    setStatus((s) => ({ ...s, [id]: "saving" }));
    try {
      const res = await fetch("/api/admin/results", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, ...body }),
      });
      const d = await res.json();
      if (!d.ok) throw new Error();
      saved.current[id] = { ...saved.current[id], ...body };
      setStatus((s) => ({ ...s, [id]: "saved" }));
    } catch {
      setStatus((s) => ({ ...s, [id]: "idle" }));
      setError("Čuvanje nije uspelo.");
    }
  };

  /** Save a text field on blur, reading the value off the input rather than off
   *  state: a blur that lands in the same tick as the last keystroke still sees
   *  the pre-render state, and would persist the previous value. Skips the
   *  request when nothing actually changed, so tabbing through a card does not
   *  fire three writes. */
  const commit =
    (id: number, field: "handle" | "stat" | "alt" | "stat_en" | "alt_en") =>
    (value: string) => {
    if (saved.current[id]?.[field] === value) return;
    void patch(id, { [field]: value });
  };

  const edit = (id: number, patchLocal: Partial<Shot>) => {
    setShots((list) => list.map((s) => (s.id === id ? { ...s, ...patchLocal } : s)));
    setStatus((s) => ({ ...s, [id]: "idle" }));
  };

  const move = async (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= shots.length) return;
    const next = [...shots];
    [next[index], next[target]] = [next[target], next[index]];
    setShots(next);
    await fetch("/api/admin/results", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ order: next.map((s) => s.id) }),
    });
  };

  const remove = async (shot: Shot) => {
    if (!confirm(`Obrisati "${shot.handle || "sliku"}"? Fajl se briše sa servera.`)) return;
    setShots((list) => list.filter((s) => s.id !== shot.id));
    await fetch(`/api/admin/results?id=${shot.id}`, { method: "DELETE" });
  };

  return (
    <div className="adm__portfolio">
      <p className="adm__hint">
        Slike koje se vrte u sekciji „Rezultati“ na sajtu. Redosled ovde je redosled na sajtu.
        Naslov sekcije i tekst se menjaju u tabu Sadržaj. „Zameni sliku“ ubacuje novu fotografiju
        u istu karticu — tekst, redosled i podešavanja ostaju, stari fajl se briše sa servera.
      </p>
      <LocaleTabs
        value={lang}
        onChange={setLang}
        note={
          lang === "en"
            ? "Prevedi brojku i opis slike. Naziv naloga je zajednički."
            : "Srpski tekst kartica rezultata."
        }
      />
      {error && (
        <p className="adm__err" role="alert">
          {error}
        </p>
      )}

      <section className="adm__pf-section">
        <div className="adm__pf-row" style={{ marginBottom: 14 }}>
          <button type="button" onClick={() => fileRef.current?.click()} disabled={uploading}>
            <Upload size={13} style={{ verticalAlign: "-2px" }} />{" "}
            {uploading ? "Šaljem…" : "Dodaj sliku"}
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            hidden
            onChange={(e) => e.target.files?.[0] && addFile(e.target.files[0])}
          />
        </div>

        {/* The replace picker for every card. Which card it belongs to is held
            in a ref, set by the button that opened it. */}
        <input
          ref={replaceRef}
          type="file"
          accept="image/*"
          hidden
          onChange={(e) => {
            const file = e.target.files?.[0];
            const target = shots.find((s) => s.id === replaceFor.current);
            if (file && target) void replaceFile(target, file);
          }}
        />

        {loading && <p className="adm__empty">Učitavanje…</p>}
        {!loading && shots.length === 0 && <p className="adm__empty">Još nema slika.</p>}

        <div className="adm__pf-grid">
          {shots.map((shot, index) => (
            <div key={shot.id} className="adm__pf-card">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={shot.image_url} alt={shot.alt || shot.handle} />

              <div className="adm__pf-card-body" style={{ gap: 8 }}>
                <label className="adm__content-field">
                  <span>Naziv naloga</span>
                  <input
                    type="text"
                    placeholder="toza.aii"
                    value={shot.handle}
                    onChange={(e) => edit(shot.id, { handle: e.target.value })}
                    onBlur={(e) => commit(shot.id, "handle")(e.target.value)}
                  />
                </label>
                <label className="adm__content-field">
                  <span>Brojka ispod</span>
                  <input
                    type="text"
                    placeholder={lang === "en" ? shot.stat : "187K pratilaca · Instagram"}
                    value={(lang === "en" ? shot.stat_en : shot.stat) ?? ""}
                    onChange={(e) =>
                      edit(shot.id, { [lang === "en" ? "stat_en" : "stat"]: e.target.value })
                    }
                    onBlur={(e) =>
                      commit(shot.id, lang === "en" ? "stat_en" : "stat")(e.target.value)
                    }
                  />
                </label>
                <label className="adm__content-field">
                  <span>Opis slike (za čitače ekrana)</span>
                  <input
                    type="text"
                    placeholder={lang === "en" ? shot.alt : "Instagram profil, 187K pratilaca"}
                    value={(lang === "en" ? shot.alt_en : shot.alt) ?? ""}
                    onChange={(e) =>
                      edit(shot.id, { [lang === "en" ? "alt_en" : "alt"]: e.target.value })
                    }
                    onBlur={(e) =>
                      commit(shot.id, lang === "en" ? "alt_en" : "alt")(e.target.value)
                    }
                  />
                </label>

                <div className="adm__pf-row" style={{ gap: 14 }}>
                  <label className="adm__pf-feat">
                    <input
                      type="checkbox"
                      checked={shot.wide}
                      onChange={(e) => {
                        edit(shot.id, { wide: e.target.checked });
                        void patch(shot.id, { wide: e.target.checked });
                      }}
                    />
                    Široka kartica
                  </label>
                  <label className="adm__pf-feat">
                    <input
                      type="checkbox"
                      checked={shot.active}
                      onChange={(e) => {
                        edit(shot.id, { active: e.target.checked });
                        void patch(shot.id, { active: e.target.checked });
                      }}
                    />
                    Prikaži na sajtu
                  </label>
                </div>

                {status[shot.id] === "saving" && <span className="adm__hint">Čuvam…</span>}
                {status[shot.id] === "saved" && <span className="adm__hint">Sačuvano.</span>}
              </div>

              <div className="adm__pf-card-actions">
                <button
                  type="button"
                  onClick={() => {
                    replaceFor.current = shot.id;
                    replaceRef.current?.click();
                  }}
                  disabled={replacing !== null}
                >
                  <RefreshCw size={11} style={{ verticalAlign: "-1px" }} />{" "}
                  {replacing === shot.id ? "Menjam…" : "Zameni sliku"}
                </button>
                <button type="button" onClick={() => move(index, -1)} disabled={index === 0} aria-label="Pomeri gore">
                  <ArrowUp size={12} />
                </button>
                <button
                  type="button"
                  onClick={() => move(index, 1)}
                  disabled={index === shots.length - 1}
                  aria-label="Pomeri dole"
                >
                  <ArrowDown size={12} />
                </button>
                <button type="button" onClick={() => remove(shot)} aria-label="Obriši">
                  <Trash2 size={12} />
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
