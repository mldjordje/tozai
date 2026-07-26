"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

/**
 * The work queue. Everything that has been paid for, ordered by what is most
 * likely to need attention: unstarted first, then by deadline.
 *
 * Materials the client sent carry an unread marker; opening a project clears it
 * so the sidebar badge means "something arrived that you have not looked at",
 * not "this project has files".
 */

type ProjectRow = {
  id: number;
  title: string;
  status: string;
  brief: Record<string, unknown> | null;
  revisions_left: number;
  due_date: string | null;
  created_at: string;
  order_id: number | null;
  amount: number | null;
  currency: string | null;
  paid_at: string | null;
  item: string | null;
  user_id: number;
  user_email: string;
  user_name: string | null;
  user_phone: string | null;
  company_name: string | null;
  package_name: string | null;
  materials_count: number;
  materials_unseen: number;
  deliverables_count: number;
};

type MaterialRow = {
  id: number;
  project_id: number;
  method: string;
  value: string;
  note: string | null;
  seen_at: string | null;
  created_at: string;
};

type UpdateRow = {
  id: number;
  project_id: number;
  status: string | null;
  note: string | null;
  author: string;
  created_at: string;
};

const STATUS_LABEL: Record<string, string> = {
  onboarding: "Čeka materijale",
  u_izradi: "U izradi",
  na_reviziji: "Na reviziji",
  isporuceno: "Isporučeno",
  otkazano: "Otkazano",
};

const NEXT_STATUS: { value: string; label: string }[] = [
  { value: "u_izradi", label: "U izradu" },
  { value: "na_reviziji", label: "Na reviziju" },
  { value: "isporuceno", label: "Isporučeno" },
  { value: "otkazano", label: "Otkaži" },
];

const BRIEF_LABEL: Record<string, string> = {
  idea: "Ideja",
  biznis: "Biznis",
  o_biznisu: "O biznisu",
  broj_klipova: "Broj klipova",
  opis: "Opis",
  publika: "Publika",
  ton: "Ton",
  reference: "Reference",
};

function day(value: string | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("sr-Latn-RS", { day: "numeric", month: "short" }).format(
    new Date(value),
  );
}

function dateTime(value: string) {
  return new Intl.DateTimeFormat("sr-Latn-RS", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

export function ProjektiTab() {
  const [projects, setProjects] = useState<ProjectRow[]>([]);
  const [materials, setMaterials] = useState<MaterialRow[]>([]);
  const [updates, setUpdates] = useState<UpdateRow[]>([]);
  const [filter, setFilter] = useState<"active" | "unseen" | string>("active");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState<number | null>(null);
  const [note, setNote] = useState("");
  const [dTitle, setDTitle] = useState("");
  const [dUrl, setDUrl] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      const response = await fetch("/api/admin/projekti", { cache: "no-store" });
      const data = await response.json();
      if (!response.ok || !data.ok) throw new Error(data.message);
      setProjects(data.projects);
      setMaterials(data.materials);
      setUpdates(data.updates);
    } catch {
      setError("Ne mogu da učitam projekte.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const visible = useMemo(
    () =>
      projects.filter((project) => {
        if (filter === "all") return true;
        if (filter === "active")
          return ["onboarding", "u_izradi", "na_reviziji"].includes(project.status);
        if (filter === "unseen") return project.materials_unseen > 0;
        return project.status === filter;
      }),
    [projects, filter],
  );

  const unseenTotal = projects.reduce((sum, p) => sum + p.materials_unseen, 0);

  async function patch(id: number, payload: Record<string, unknown>) {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/admin/projekti", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, ...payload }),
      });
      const data = await response.json();
      if (!response.ok || !data.ok) {
        setError(data.message ?? "Izmena nije sačuvana.");
        return false;
      }
      await load();
      return true;
    } catch {
      setError("Izmena nije sačuvana.");
      return false;
    } finally {
      setBusy(false);
    }
  }

  // Opening a project is the act of reading it — the badge clears here rather
  // than behind a separate "mark as read" button nobody would press.
  async function toggle(project: ProjectRow) {
    if (open === project.id) {
      setOpen(null);
      return;
    }
    setOpen(project.id);
    setNote("");
    setDTitle("");
    setDUrl("");
    if (project.materials_unseen > 0) await patch(project.id, { action: "seen" });
  }

  return (
    <div className="adm__video">
      <div>
        <h1>Projekti</h1>
        <p className="adm__muted">
          Plaćeni poslovi na kojima se radi. {unseenTotal > 0
            ? `${unseenTotal} novih materijala čeka pregled.`
            : "Nema nepregledanih materijala."}
        </p>
      </div>

      {error && (
        <p className="adm__err" role="alert">
          {error}
        </p>
      )}

      <div className="adm__filters">
        {[
          ["active", "Aktivni"],
          ["unseen", `Novi materijali${unseenTotal ? ` (${unseenTotal})` : ""}`],
          ["onboarding", "Čeka materijale"],
          ["u_izradi", "U izradi"],
          ["na_reviziji", "Na reviziji"],
          ["isporuceno", "Isporučeno"],
          ["all", "Svi"],
        ].map(([value, label]) => (
          <button
            key={value}
            className="adm__filter"
            aria-pressed={filter === value}
            onClick={() => setFilter(value)}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="adm__list">
        {loading && <p className="adm__empty">Učitavanje…</p>}
        {!loading && visible.length === 0 && (
          <p className="adm__empty">Nema projekata za ovaj filter.</p>
        )}

        {visible.map((project) => {
          const mine = materials.filter((m) => m.project_id === project.id);
          const trail = updates.filter((u) => u.project_id === project.id);
          const isOpen = open === project.id;
          return (
            <article key={project.id} className="adm__row adm__video-row">
              <div className="adm__video-main">
                <div className="adm__video-head">
                  <div>
                    <strong>{project.title}</strong>
                    <span>
                      {project.package_name ?? project.item ?? "Projekat"} · #{project.id}
                      {project.order_id ? ` · porudžbina #${project.order_id}` : ""}
                    </span>
                  </div>
                  <span className={`adm__status adm__status--proj-${project.status}`}>
                    {STATUS_LABEL[project.status] ?? project.status}
                  </span>
                </div>

                <div className="adm__video-meta">
                  <a href={`mailto:${project.user_email}`}>
                    {project.company_name ?? project.user_name ?? project.user_email}
                  </a>
                  {project.user_phone && <a href={`tel:${project.user_phone}`}>{project.user_phone}</a>}
                  {project.amount != null && (
                    <span>
                      {project.amount.toLocaleString("sr-RS")} {project.currency}
                    </span>
                  )}
                  <span>Rok: {day(project.due_date)}</span>
                  <span>Revizije: {project.revisions_left}</span>
                  <span>Isporuka: {project.deliverables_count}</span>
                </div>

                <p className="adm__proj-flags">
                  {project.materials_unseen > 0 ? (
                    <span className="adm__proj-new">
                      {project.materials_unseen} novih materijala
                    </span>
                  ) : project.materials_count > 0 ? (
                    <span>{project.materials_count} poslatih materijala</span>
                  ) : (
                    <span>Klijent još nije poslao materijale</span>
                  )}
                </p>

                <div className="adm__btns">
                  <button onClick={() => toggle(project)}>
                    {isOpen ? "Zatvori" : "Otvori"}
                  </button>
                  {NEXT_STATUS.filter((s) => s.value !== project.status).map((s) => (
                    <button
                      key={s.value}
                      disabled={busy}
                      onClick={() => patch(project.id, { status: s.value })}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>

                {isOpen && (
                  <div className="adm__video-editor">
                    <section className="adm__proj-block">
                      <h4>Materijali klijenta</h4>
                      {mine.length === 0 ? (
                        <p className="adm__hint">Još ništa nije stiglo.</p>
                      ) : (
                        <ul className="adm__proj-mats">
                          {mine.map((m) => (
                            <li key={m.id}>
                              <span className="adm__proj-mat-kind">
                                {m.method === "wetransfer" ? "WeTransfer" : "WhatsApp"}
                              </span>
                              {m.method === "wetransfer" ? (
                                <a href={m.value} target="_blank" rel="noreferrer">
                                  {m.value}
                                </a>
                              ) : (
                                <a href={`https://wa.me/${m.value.replace(/\D/g, "")}`} target="_blank" rel="noreferrer">
                                  {m.value}
                                </a>
                              )}
                              {m.note && <em>{m.note}</em>}
                              <time>{dateTime(m.created_at)}</time>
                            </li>
                          ))}
                        </ul>
                      )}
                    </section>

                    {project.brief && Object.keys(project.brief).length > 0 && (
                      <section className="adm__proj-block">
                        <h4>Brief</h4>
                        <dl className="adm__proj-brief">
                          {Object.entries(project.brief).map(([key, value]) => (
                            <div key={key}>
                              <dt>{BRIEF_LABEL[key] ?? key}</dt>
                              <dd>{String(value)}</dd>
                            </div>
                          ))}
                        </dl>
                      </section>
                    )}

                    <section className="adm__proj-block">
                      <h4>Dodaj isporuku</h4>
                      <div className="adm__pf-row">
                        <input
                          value={dTitle}
                          onChange={(event) => setDTitle(event.target.value)}
                          placeholder="Naziv (npr. Finalni klip 1)"
                        />
                        <input
                          value={dUrl}
                          onChange={(event) => setDUrl(event.target.value)}
                          placeholder="https://…"
                        />
                        <button
                          disabled={busy || dTitle.trim().length < 2 || dUrl.trim().length < 8}
                          onClick={async () => {
                            if (await patch(project.id, { action: "deliverable", title: dTitle, url: dUrl })) {
                              setDTitle("");
                              setDUrl("");
                            }
                          }}
                        >
                          Dodaj
                        </button>
                      </div>
                    </section>

                    <label className="adm__video-note">
                      Napomena klijentu
                      <textarea
                        rows={3}
                        value={note}
                        onChange={(event) => setNote(event.target.value)}
                        placeholder="Šta je urađeno, šta se čeka, kada stiže sledeći korak…"
                      />
                    </label>
                    <button
                      className="adm__resched-confirm"
                      disabled={busy || note.trim().length < 2}
                      onClick={async () => {
                        if (await patch(project.id, { note })) setNote("");
                      }}
                    >
                      {busy ? "Čuvam…" : "Dodaj napomenu"}
                    </button>

                    <section className="adm__proj-block">
                      <h4>Istorija</h4>
                      {trail.length === 0 ? (
                        <p className="adm__hint">Nema zabeleženih promena.</p>
                      ) : (
                        <ul className="adm__proj-trail">
                          {trail.map((u) => (
                            <li key={u.id}>
                              <span>{u.status ? (STATUS_LABEL[u.status] ?? u.status) : "Napomena"}</span>
                              {u.note && <em>{u.note}</em>}
                              <time>
                                {u.author === "client" ? "klijent" : "admin"} · {dateTime(u.created_at)}
                              </time>
                            </li>
                          ))}
                        </ul>
                      )}
                    </section>
                  </div>
                )}
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}
