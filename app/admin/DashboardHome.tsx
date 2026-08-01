"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Tag, Images, Users, CalendarDays, FolderKanban, Check, Minus, Pencil, Plus, X } from "lucide-react";

type Recent = {
  id: number;
  item: string;
  amount: number;
  currency: string;
  status: string;
  created_at: string;
  client: string;
};

type Summary = {
  counts: {
    clients: number;
    ordersPending: number;
    ordersMonth: number;
    revenueMonth: number;
    activePackages: number;
    activeProjects: number;
    newMaterials: number;
  };
  recent: Recent[];
};

const STATUS_LABEL: Record<string, string> = {
  pending: "Na čekanju",
  paid: "Plaćeno",
  canceled: "Otkazano",
  refunded: "Refundirano",
};

export function DashboardHome() {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editingRevenue, setEditingRevenue] = useState(false);
  const [revenueDraft, setRevenueDraft] = useState("");
  const [adjustment, setAdjustment] = useState("100");
  const [savingRevenue, setSavingRevenue] = useState(false);

  useEffect(() => {
    let alive = true;
    fetch("/api/admin/summary", { cache: "no-store" })
      .then((r) => r.json())
      .then((data) => {
        if (!alive) return;
        if (data?.ok) {
          setSummary({ counts: data.counts, recent: data.recent });
          setRevenueDraft(String(data.counts.revenueMonth));
        }
        else setError("Ne mogu da učitam pregled.");
      })
      .catch(() => alive && setError("Ne mogu da učitam pregled."));
    return () => {
      alive = false;
    };
  }, []);

  const dateLabel = new Intl.DateTimeFormat("sr-Latn-RS", {
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(new Date());

  const c = summary?.counts;

  const changeRevenue = (direction: 1 | -1) => {
    const current = Number(revenueDraft.replace(",", ".")) || 0;
    const amount = Number(adjustment.replace(",", "."));
    if (!Number.isFinite(amount) || amount < 0) return;
    setRevenueDraft(String(Math.max(0, Math.round((current + direction * amount) * 100) / 100)));
  };

  const saveRevenue = async () => {
    const value = Number(revenueDraft.replace(",", "."));
    if (!Number.isFinite(value) || value < 0) {
      setError("Unesi ispravan iznos zarade.");
      return;
    }

    setSavingRevenue(true);
    setError(null);
    try {
      const response = await fetch("/api/admin/summary", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ revenueMonth: value }),
      });
      const data = await response.json();
      if (!response.ok || !data?.ok) throw new Error(data?.message);

      setSummary((current) => current
        ? { ...current, counts: { ...current.counts, revenueMonth: data.revenueMonth } }
        : current);
      setRevenueDraft(String(data.revenueMonth));
      setEditingRevenue(false);
    } catch (saveError) {
      setError(saveError instanceof Error && saveError.message
        ? saveError.message
        : "Čuvanje zarade nije uspelo.");
    } finally {
      setSavingRevenue(false);
    }
  };

  return (
    <div className="adm__dash">
      <p className="adm__dash-date">{dateLabel}</p>

      {error && <p className="adm__err" role="alert">{error}</p>}

      <div className="adm__stats">
        <div className="adm__stat adm__stat--revenue">
          {!editingRevenue ? (
            <div className="adm__revenue-value">
              <strong>{c ? c.revenueMonth.toLocaleString("sr-RS") : "–"}</strong>
              {c && (
                <button
                  type="button"
                  className="adm__revenue-edit"
                  onClick={() => {
                    setRevenueDraft(String(c.revenueMonth));
                    setEditingRevenue(true);
                  }}
                  aria-label="Izmeni zaradu"
                  title="Izmeni zaradu"
                >
                  <Pencil size={14} />
                </button>
              )}
            </div>
          ) : (
            <div className="adm__revenue-editor">
              <input
                className="adm__revenue-total"
                type="number"
                min="0"
                step="0.01"
                value={revenueDraft}
                onChange={(event) => setRevenueDraft(event.target.value)}
                aria-label="Ukupna zarada ovog meseca"
                autoFocus
              />
              <div className="adm__revenue-adjust">
                <button type="button" onClick={() => changeRevenue(-1)} aria-label="Oduzmi iznos">
                  <Minus size={14} />
                </button>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={adjustment}
                  onChange={(event) => setAdjustment(event.target.value)}
                  aria-label="Iznos za dodavanje ili oduzimanje"
                />
                <button type="button" onClick={() => changeRevenue(1)} aria-label="Dodaj iznos">
                  <Plus size={14} />
                </button>
              </div>
              <div className="adm__revenue-actions">
                <button type="button" onClick={saveRevenue} disabled={savingRevenue} aria-label="Sačuvaj zaradu">
                  <Check size={14} />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setRevenueDraft(String(c?.revenueMonth ?? 0));
                    setEditingRevenue(false);
                  }}
                  disabled={savingRevenue}
                  aria-label="Otkaži izmenu"
                >
                  <X size={14} />
                </button>
              </div>
            </div>
          )}
          <span>Prihod ovog meseca (EUR)</span>
        </div>
        <div className="adm__stat">
          <strong>{c ? c.ordersMonth : "–"}</strong>
          <span>Porudžbina ovog meseca</span>
        </div>
        <div className="adm__stat">
          <strong>{c ? c.activeProjects : "–"}</strong>
          <span>Projekata u radu</span>
        </div>
        <div className="adm__stat">
          <strong>{c ? c.clients : "–"}</strong>
          <span>Klijenata</span>
        </div>
      </div>

      {/* The one thing that is genuinely waiting on the studio. */}
      {c && c.newMaterials > 0 && (
        <Link href="/admin/projekti" className="adm__alert">
          <FolderKanban size={16} strokeWidth={1.6} />
          {c.newMaterials === 1
            ? "Klijent je poslao materijale — 1 nepregledan."
            : `Klijenti su poslali materijale — ${c.newMaterials} nepregledanih.`}
        </Link>
      )}

      <section className="adm__dash-section">
        <h3>Poslednje porudžbine</h3>
        {!summary && !error && <p className="adm__empty">Učitavanje…</p>}
        {summary && summary.recent.length === 0 && (
          <p className="adm__empty">Još nema porudžbina. Pojaviće se ovde čim naplata krene.</p>
        )}
        {summary && summary.recent.length > 0 && (
          <div className="adm__list">
            {summary.recent.map((r) => (
              <article key={r.id} className="adm__row adm__row--dash">
                <div className="adm__when">
                  <strong>{r.amount.toLocaleString("sr-RS")} {r.currency}</strong>
                  <span>{STATUS_LABEL[r.status] ?? r.status}</span>
                </div>
                <div className="adm__who">
                  <strong>
                    {r.client}
                    <span className="adm__kind">{r.item}</span>
                  </strong>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="adm__dash-section">
        <h3>Brze akcije</h3>
        <div className="adm__quick">
          <Link href="/admin/projekti" className="adm__quick-btn">
            <FolderKanban size={16} strokeWidth={1.6} /> Projekti u radu
          </Link>
          <Link href="/admin/paketi" className="adm__quick-btn">
            <Tag size={16} strokeWidth={1.6} /> Uredi cenovnik
          </Link>
          <Link href="/admin/portfolio" className="adm__quick-btn">
            <Images size={16} strokeWidth={1.6} /> Dodaj rad
          </Link>
          <Link href="/admin/klijenti" className="adm__quick-btn">
            <Users size={16} strokeWidth={1.6} /> Klijenti
          </Link>
          <Link href="/admin/dostupnost" className="adm__quick-btn">
            <CalendarDays size={16} strokeWidth={1.6} /> Dostupnost
          </Link>
        </div>
      </section>
    </div>
  );
}
