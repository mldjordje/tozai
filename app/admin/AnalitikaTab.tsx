"use client";

import { useEffect, useState } from "react";
import { SaobracajPanel } from "./SaobracajPanel";

type Data = {
  totals: { clients: number; orders: number; revenue: number; pending: number; invoices: number };
  byMonth: { month: string; revenue: number; orders: number }[];
  topPackages: { name: string; sales: number; revenue: number }[];
};

export function AnalitikaTab() {
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/admin/analytics", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => (d.ok ? setData(d) : setError("Ne mogu da učitam analitiku.")))
      .catch(() => setError("Ne mogu da učitam analitiku."));
  }, []);

  const t = data?.totals;
  const maxRev = Math.max(1, ...(data?.byMonth.map((m) => m.revenue) ?? [1]));

  return (
    <div className="adm__dash">
      {error && <p className="adm__err" role="alert">{error}</p>}
      {!data && !error && <p className="adm__empty">Učitavanje…</p>}

      {/* Traffic first: it is the top of the funnel the sales numbers below are
          the bottom of. Fetches independently, so Vercel being unreachable never
          hides the database's own figures. */}
      <SaobracajPanel />

      {data && (
        <>
          <div className="adm__stats">
            <div className="adm__stat"><strong>{t!.revenue.toLocaleString("sr-RS")}</strong><span>Ukupan prihod (EUR)</span></div>
            <div className="adm__stat"><strong>{t!.orders}</strong><span>Porudžbina</span></div>
            <div className="adm__stat"><strong>{t!.clients}</strong><span>Klijenata</span></div>
            <div className="adm__stat"><strong>{t!.invoices}</strong><span>Faktura</span></div>
          </div>

          <section className="adm__dash-section">
            <h3>Prihod (poslednjih 6 meseci)</h3>
            {data.byMonth.length === 0 && <p className="adm__empty">Nema podataka još.</p>}
            {data.byMonth.length > 0 && (
              <div style={{ display: "flex", alignItems: "flex-end", gap: 12, height: 160, padding: "12px 0" }}>
                {data.byMonth.map((m) => (
                  <div key={m.month} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
                    <div
                      title={`${m.revenue} EUR`}
                      style={{
                        width: "100%",
                        maxWidth: 48,
                        height: `${(m.revenue / maxRev) * 120}px`,
                        minHeight: 3,
                        background: "linear-gradient(180deg, var(--neon), rgba(46,107,255,.25))",
                        borderRadius: 4,
                      }}
                    />
                    <span className="adm__hint" style={{ fontSize: 10 }}>{m.month.slice(5)}</span>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="adm__dash-section">
            <h3>Najprodavaniji paketi</h3>
            {data.topPackages.length === 0 && <p className="adm__empty">Nema prodaje još.</p>}
            {data.topPackages.length > 0 && (
              <div className="adm__list">
                {data.topPackages.map((p) => (
                  <article key={p.name} className="adm__row" style={{ gridTemplateColumns: "1fr auto auto" }}>
                    <strong>{p.name}</strong>
                    <span className="adm__hint">{p.sales} prodaja</span>
                    <strong>{p.revenue.toLocaleString("sr-RS")} EUR</strong>
                  </article>
                ))}
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}
