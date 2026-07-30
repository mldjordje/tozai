"use client";

import { useEffect, useState } from "react";

// Vercel Web Analytics inside the panel. Fetched separately from the sales
// numbers above it and rendered with its own states, so an unset token or a
// refusing upstream costs this section and nothing else on the tab.

type Point = { date: string; pageviews: number; visitors: number };
type Row = { label: string; pageviews: number; visitors: number };

type Response =
  | {
      ok: true;
      days: number;
      since: string;
      until: string;
      totals: { pageviews: number; visitors: number };
      lifetime: { pageviews: number; visitors: number } | null;
      daily: Point[];
      routes: Row[];
      referrers: Row[];
      countries: Row[];
      devices: Row[];
    }
  | { ok: false; reason: "unconfigured"; missing: string[] }
  | { ok: false; reason: "error"; message: string };

const RANGES = [7, 30, 90];

const fmt = (n: number) => n.toLocaleString("sr-RS");

function RowList({ title, rows, empty }: { title: string; rows: Row[]; empty: string }) {
  return (
    <section className="adm__dash-section">
      <h3>{title}</h3>
      {rows.length === 0 && <p className="adm__empty">{empty}</p>}
      {rows.length > 0 && (
        <div className="adm__list">
          {rows.map((row) => (
            <article
              key={row.label}
              className="adm__row"
              style={{ gridTemplateColumns: "1fr auto auto" }}
            >
              <strong style={{ overflowWrap: "anywhere" }}>{row.label}</strong>
              <span className="adm__hint">{fmt(row.visitors)} posetilaca</span>
              <strong>{fmt(row.pageviews)}</strong>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

export function SaobracajPanel() {
  const [days, setDays] = useState(30);
  const [data, setData] = useState<Response | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let live = true;
    setLoading(true);
    fetch(`/api/admin/traffic?days=${days}`, { cache: "no-store" })
      .then((r) => r.json())
      .then((d: Response) => live && setData(d))
      .catch(
        () =>
          live &&
          setData({ ok: false, reason: "error", message: "Zahtev ka /api/admin/traffic je pao." }),
      )
      .finally(() => live && setLoading(false));
    return () => {
      live = false;
    };
  }, [days]);

  const peak = data?.ok ? Math.max(1, ...data.daily.map((p) => p.pageviews)) : 1;
  // 90 bars cannot each carry a date. Label roughly seven of them whatever the
  // range, so the axis stays readable instead of turning into a grey smear.
  const labelEvery = data?.ok ? Math.max(1, Math.ceil(data.daily.length / 7)) : 1;

  return (
    <>
      <section className="adm__dash-section">
        <h3>Saobraćaj na sajtu</h3>

        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 16 }}>
          {RANGES.map((range) => (
            <button
              key={range}
              type="button"
              onClick={() => setDays(range)}
              className={`adm__switch-chip${days === range ? " adm__switch-chip--on" : ""}`}
            >
              {range} dana
            </button>
          ))}
        </div>

        {loading && <p className="adm__empty">Učitavanje…</p>}

        {!loading && data && !data.ok && data.reason === "unconfigured" && (
          <div>
            <p className="adm__empty">
              Vercel Analytics nije povezan. Nedostaje: <strong>{data.missing.join(", ")}</strong>.
            </p>
            <p className="adm__hint">
              Uputstvo je u ANALYTICS-SETUP.md — treba Vercel access token i projectId, i posle
              dodavanja promenljivih obavezno redeploy.
            </p>
          </div>
        )}

        {!loading && data && !data.ok && data.reason === "error" && (
          <p className="adm__err" role="alert">
            Vercel Analytics ne odgovara: {data.message}
          </p>
        )}

        {!loading && data?.ok && (
          <>
            <div className="adm__stats">
              <div className="adm__stat">
                <strong>{fmt(data.totals.pageviews)}</strong>
                <span>Pregleda ({data.days} dana)</span>
              </div>
              <div className="adm__stat">
                <strong>{fmt(data.totals.visitors)}</strong>
                <span>Posetilaca ({data.days} dana)</span>
              </div>
              <div className="adm__stat">
                <strong>{data.lifetime ? fmt(data.lifetime.pageviews) : "—"}</strong>
                <span>Pregleda ukupno</span>
              </div>
              <div className="adm__stat">
                <strong>{data.lifetime ? fmt(data.lifetime.visitors) : "—"}</strong>
                <span>Posetilaca ukupno</span>
              </div>
            </div>

            <p className="adm__hint" style={{ marginTop: 10 }}>
              {data.since} → {data.until}
            </p>

            {data.daily.length === 0 && (
              <p className="adm__empty">Nema poseta u ovom periodu.</p>
            )}
            {data.daily.length > 0 && (
              <div
                style={{
                  display: "flex",
                  alignItems: "flex-end",
                  gap: data.daily.length > 40 ? 2 : 6,
                  height: 160,
                  padding: "12px 0",
                }}
              >
                {data.daily.map((point, i) => (
                  <div
                    key={point.date}
                    style={{
                      flex: 1,
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      gap: 8,
                      minWidth: 0,
                    }}
                  >
                    <div
                      title={`${point.date} — ${fmt(point.pageviews)} pregleda, ${fmt(point.visitors)} posetilaca`}
                      style={{
                        width: "100%",
                        maxWidth: 48,
                        height: `${(point.pageviews / peak) * 120}px`,
                        minHeight: 3,
                        background: "linear-gradient(180deg, var(--neon), rgba(46,107,255,.25))",
                        borderRadius: 4,
                      }}
                    />
                    <span className="adm__hint" style={{ fontSize: 10, whiteSpace: "nowrap" }}>
                      {i % labelEvery === 0 ? point.date.slice(5) : " "}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </section>

      {!loading && data?.ok && (
        <>
          <RowList
            title="Najgledanije strane"
            rows={data.routes}
            empty="Nema poseta u ovom periodu."
          />
          <RowList
            title="Odakle dolaze"
            rows={data.referrers}
            empty="Nema podataka o izvoru."
          />
          <RowList title="Zemlje" rows={data.countries} empty="Nema podataka o zemljama." />
          <RowList title="Uređaji" rows={data.devices} empty="Nema podataka o uređajima." />
        </>
      )}
    </>
  );
}
