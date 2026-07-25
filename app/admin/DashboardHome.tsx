"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Tag, Images, Users, CalendarDays } from "lucide-react";

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

  useEffect(() => {
    let alive = true;
    fetch("/api/admin/summary", { cache: "no-store" })
      .then((r) => r.json())
      .then((data) => {
        if (!alive) return;
        if (data?.ok) setSummary({ counts: data.counts, recent: data.recent });
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

  return (
    <div className="adm__dash">
      <p className="adm__dash-date">{dateLabel}</p>

      {error && <p className="adm__err" role="alert">{error}</p>}

      <div className="adm__stats">
        <div className="adm__stat">
          <strong>{c ? c.revenueMonth.toLocaleString("sr-RS") : "–"}</strong>
          <span>Prihod ovog meseca (EUR)</span>
        </div>
        <div className="adm__stat">
          <strong>{c ? c.ordersMonth : "–"}</strong>
          <span>Porudžbina ovog meseca</span>
        </div>
        <div className="adm__stat">
          <strong>{c ? c.ordersPending : "–"}</strong>
          <span>Na čekanju</span>
        </div>
        <div className="adm__stat">
          <strong>{c ? c.clients : "–"}</strong>
          <span>Klijenata</span>
        </div>
      </div>

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
