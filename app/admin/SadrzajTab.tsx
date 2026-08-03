"use client";

import { useEffect, useState } from "react";
import { LocaleTabs } from "./LocaleTabs";
import { Plus, Trash2 } from "lucide-react";
import type { LandingContent, Stat } from "@/lib/content/landing";

// Landing copy editor.
//
// Fields are grouped in the order they appear on the page, so editing reads as
// walking down the site. Every input's placeholder is the shipped default and
// an empty field means exactly that — clear a box to revert that one line.

type Field = { key: keyof LandingContent; label: string; multiline?: boolean; hint?: string };
/** `id` is what the structured editors below key off. The title carries the
 *  section number the page prints, so it moves whenever the page is reordered —
 *  matching on it was one rename away from silently dropping the stats editor. */
type Group = { id: string; title: string; note?: string; fields: Field[] };

const ACCENT_HINT = "Reč u *zvezdicama* je istaknuta.";

const GROUPS: Group[] = [
  {
    id: "hero",
    title: "Hero",
    fields: [
      { key: "hero_eyebrow", label: "Nadnaslov" },
      {
        key: "hero_title",
        label: "Naslov",
        multiline: true,
        hint: `${ACCENT_HINT} Novi red = prelom naslova.`,
      },
      { key: "hero_lead_1", label: "Udarna linija 1" },
      { key: "hero_lead_2", label: "Udarna linija 2" },
      { key: "hero_body", label: "Opis", multiline: true },
      { key: "hero_cta_primary", label: "Glavno dugme" },
      { key: "hero_cta_secondary", label: "Sporedno dugme" },
    ],
  },
  {
    id: "results",
    title: "Rezultati",
    note: "Same slike se dodaju u tabu Rezultati.",
    fields: [
      { key: "results_eyebrow", label: "Nadnaslov" },
      { key: "results_title", label: "Naslov", hint: ACCENT_HINT },
      { key: "results_body", label: "Opis", multiline: true },
      { key: "results_card_title", label: "Poslednja kartica — pitanje", hint: ACCENT_HINT },
      { key: "results_cta", label: "Poslednja kartica — dugme" },
    ],
  },
  {
    id: "packages",
    title: "01 — Paketi",
    note: "Cene i tarife se uređuju u tabu Paketi.",
    fields: [
      { key: "packages_eyebrow", label: "Nadnaslov" },
      { key: "packages_title", label: "Naslov", hint: ACCENT_HINT },
      { key: "packages_body", label: "Opis", multiline: true },
      { key: "packages_note", label: "Napomena ispod kartica", multiline: true },
    ],
  },
  {
    id: "stats",
    title: "02 — Brojevi",
    fields: [
      { key: "stats_eyebrow", label: "Nadnaslov" },
      { key: "stats_title", label: "Naslov", hint: ACCENT_HINT },
    ],
  },
  {
    id: "education",
    title: "03 — Edukacija",
    fields: [
      { key: "education_eyebrow", label: "Nadnaslov" },
      { key: "education_title", label: "Naslov", hint: ACCENT_HINT },
      { key: "education_body", label: "Opis", multiline: true },
    ],
  },
  {
    id: "booking",
    title: "Kontakt / booking",
    note: "Email, telefon i mreže se uređuju u tabu Podešavanja.",
    fields: [
      { key: "booking_badge", label: "Bedž (zeleni indikator)" },
      { key: "booking_title", label: "Naslov", hint: ACCENT_HINT },
      { key: "booking_cta_primary", label: "Dugme" },
      { key: "booking_note", label: "Napomena ispod dugmeta", multiline: true },
    ],
  },
  {
    id: "footer",
    title: "Futer",
    fields: [
      { key: "footer_tagline", label: "Opis pored logotipa", multiline: true },
      { key: "footer_response", label: "Linija u dnu" },
    ],
  },
];

type Values = Record<string, unknown>;

export function SadrzajTab() {
  // Which language is being edited. The two documents are independent, so
  // switching reloads rather than merging — what is on screen is always what is
  // stored for that language.
  const [locale, setLocale] = useState<"sr" | "en">("sr");
  const [values, setValues] = useState<Values | null>(null);
  const [defaults, setDefaults] = useState<LandingContent | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    let live = true;
    setValues(null);
    setSaved(false);
    fetch(`/api/admin/content?locale=${locale}`, { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => {
        if (!live) return;
        if (!d.ok) throw new Error();
        setValues(d.content ?? {});
        setDefaults(d.defaults ?? null);
      })
      .catch(() => live && setError("Ne mogu da učitam sadržaj."));
    return () => {
      live = false;
    };
  }, [locale]);

  const put = (key: string, value: unknown) => {
    setValues((prev) => ({ ...(prev ?? {}), [key]: value }));
    setSaved(false);
  };

  const save = async () => {
    if (!values) return;
    setBusy(true);
    setError(null);
    setSaved(false);
    try {
      const res = await fetch(`/api/admin/content?locale=${locale}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ values }),
      });
      const d = await res.json();
      if (!d.ok) throw new Error();
      // The server drops empty values; mirror that back so the form shows what
      // is actually stored rather than what was typed and discarded.
      setValues(d.values ?? {});
      setSaved(true);
    } catch {
      setError("Čuvanje nije uspelo.");
    } finally {
      setBusy(false);
    }
  };

  // Structured fields fall back to the defaults for editing, because an empty
  // list editor gives the studio nothing to start from.
  const stats = (Array.isArray(values?.stats) ? (values.stats as Stat[]) : defaults?.stats) ?? [];
  const strip =
    (Array.isArray(values?.strip_items) ? (values.strip_items as string[]) : defaults?.strip_items) ?? [];
  const pills =
    (Array.isArray(values?.education_pills)
      ? (values.education_pills as string[])
      : defaults?.education_pills) ?? [];

  return (
    <div className="adm__content" style={{ maxWidth: 860 }}>
      <LocaleTabs value={locale} onChange={setLocale} />
      <p className="adm__hint" style={{ marginBottom: 4 }}>
        Tekst landing stranice{locale === "en" ? " na engleskom (/en)" : " na srpskom (/)"}.
        Prazno polje koristi podrazumevani tekst (vidi se kao siva sugestija u polju).
        Izmene su vidljive na sajtu odmah po čuvanju.
      </p>
      {error && (
        <p className="adm__err" role="alert">
          {error}
        </p>
      )}
      {!values && !error && <p className="adm__empty">Učitavanje…</p>}

      {values && defaults && (
        <>
          {GROUPS.map((group) => (
            <section key={group.id} className="adm__content-section">
              <h3>{group.title}</h3>
              {group.note && <p className="adm__hint">{group.note}</p>}
              <div className="adm__content-grid">
                {group.fields.map((f) => (
                  <label
                    key={f.key}
                    className="adm__content-field"
                    style={f.multiline ? { gridColumn: "1/-1" } : undefined}
                  >
                    <span>{f.label}</span>
                    {f.multiline ? (
                      <textarea
                        rows={f.key === "hero_title" ? 2 : 3}
                        placeholder={defaults[f.key] as string}
                        value={(values[f.key] as string) ?? ""}
                        onChange={(e) => put(f.key, e.target.value)}
                      />
                    ) : (
                      <input
                        type="text"
                        placeholder={defaults[f.key] as string}
                        value={(values[f.key] as string) ?? ""}
                        onChange={(e) => put(f.key, e.target.value)}
                      />
                    )}
                    {f.hint && <span className="adm__hint">{f.hint}</span>}
                  </label>
                ))}

                {/* Structured editors sit inside the group they belong to. */}
                {group.id === "stats" && (
                  <div style={{ gridColumn: "1/-1" }}>
                    <span className="adm__hint">Brojevi (do 8)</span>
                    {stats.map((stat, i) => (
                      <div key={i} className="adm__pf-row" style={{ marginTop: 8 }}>
                        <input
                          type="text"
                          style={{ flex: "0 0 110px", minWidth: 80 }}
                          placeholder="16M+"
                          value={stat.value}
                          onChange={(e) =>
                            put(
                              "stats",
                              stats.map((s, j) => (j === i ? { ...s, value: e.target.value } : s)),
                            )
                          }
                        />
                        <input
                          type="text"
                          style={{ flex: 1 }}
                          placeholder="Monthly Views"
                          value={stat.label}
                          onChange={(e) =>
                            put(
                              "stats",
                              stats.map((s, j) => (j === i ? { ...s, label: e.target.value } : s)),
                            )
                          }
                        />
                        <button
                          type="button"
                          onClick={() => put("stats", stats.filter((_, j) => j !== i))}
                          aria-label="Obriši broj"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    ))}
                    {stats.length < 8 && (
                      <div className="adm__pf-row" style={{ marginTop: 8 }}>
                        <button
                          type="button"
                          onClick={() => put("stats", [...stats, { value: "", label: "" }])}
                        >
                          <Plus size={13} style={{ verticalAlign: "-2px" }} /> Dodaj broj
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {group.id === "education" && (
                  <ChipList
                    label="Oznake iznad kartica"
                    items={pills}
                    onChange={(next) => put("education_pills", next)}
                  />
                )}
              </div>
            </section>
          ))}

          <section className="adm__content-section">
            <h3>Traka u pokretu</h3>
            <p className="adm__hint">
              Reči koje klize između sekcija. Razdvajač (✦) se dodaje automatski.
            </p>
            <ChipList label="" items={strip} onChange={(next) => put("strip_items", next)} />
          </section>

          <div className="adm__content-save">
            <button type="button" className="adm__resched-confirm" onClick={save} disabled={busy}>
              {busy ? "Čuvam…" : "Sačuvaj sadržaj"}
            </button>
            {saved && (
              <span className="adm__hint">
                Sačuvano.{" "}
                <a href="/" target="_blank" rel="noopener noreferrer">
                  Pogledaj sajt →
                </a>
              </span>
            )}
          </div>
        </>
      )}
    </div>
  );
}

/** Editable list of short strings — used for the marquee words and the
 *  education pills, which are the same shape with different labels. */
function ChipList({
  label,
  items,
  onChange,
}: {
  label: string;
  items: string[];
  onChange: (next: string[]) => void;
}) {
  const [draft, setDraft] = useState("");

  const add = () => {
    const value = draft.trim();
    if (!value) return;
    onChange([...items, value]);
    setDraft("");
  };

  return (
    <div style={{ gridColumn: "1/-1" }}>
      {label && <span className="adm__hint">{label}</span>}
      <div className="adm__pf-chips" style={{ marginTop: 6 }}>
        {items.map((item, i) => (
          <span key={`${item}-${i}`} className="adm__chip">
            {item}
            <button
              type="button"
              onClick={() => onChange(items.filter((_, j) => j !== i))}
              aria-label={`Ukloni ${item}`}
            >
              ×
            </button>
          </span>
        ))}
      </div>
      <div className="adm__pf-row" style={{ marginTop: 8 }}>
        <input
          type="text"
          placeholder="Nova stavka"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              add();
            }
          }}
        />
        <button type="button" onClick={add}>
          Dodaj
        </button>
      </div>
    </div>
  );
}
