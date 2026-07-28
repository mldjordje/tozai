"use client";

import { useState } from "react";

/**
 * The issued document, shown in place.
 *
 * A buyer who has just committed to paying should be looking at the proforma,
 * not at instructions for finding it later — a company buyer usually has to
 * forward it to whoever actually makes the transfer, and that has to be
 * possible in the same breath as placing the order.
 *
 * `<object>` renders the PDF where the browser can, and falls back to its
 * children where it cannot — which is every mobile browser. So the download and
 * open-in-tab actions are always present, never conditional on the preview
 * working, and the frame is hidden entirely once the embed reports failure.
 */
export default function InvoiceDocument({
  invoiceId,
  number,
  kind = "proforma",
  className = "",
}: {
  invoiceId: number;
  number: string;
  kind?: "proforma" | "invoice";
  className?: string;
}) {
  const [embedFailed, setEmbedFailed] = useState(false);
  const label = kind === "proforma" ? "Predračun" : "Faktura";
  const inlineHref = `/api/nalog/fakture/${invoiceId}?prikaz=1`;
  const downloadHref = `/api/nalog/fakture/${invoiceId}`;

  return (
    <div className={`rounded-2xl border border-line bg-bg-elev/40 p-5 md:p-6 ${className}`}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-faint">{label}</p>
          <p className="mt-1 text-sm text-fg">{number}</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <a
            href={downloadHref}
            className="rounded-full bg-fg px-5 py-2.5 text-sm font-medium text-bg transition-colors duration-300 hover:bg-white"
          >
            Preuzmi PDF
          </a>
          <a
            href={inlineHref}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-full border border-line px-5 py-2.5 text-sm text-fg transition-colors duration-300 hover:border-accent-soft"
          >
            Otvori
          </a>
        </div>
      </div>

      {!embedFailed && (
        <object
          data={inlineHref}
          type="application/pdf"
          aria-label={`${label} ${number}`}
          className="mt-5 hidden h-[560px] w-full rounded-xl border border-line bg-white md:block"
          onError={() => setEmbedFailed(true)}
        >
          {/* Reached when the browser has no PDF viewer. The actions above
              already cover this case, so the fallback only explains itself. */}
          <p className="p-5 text-sm text-muted">
            Pregled nije dostupan u ovom pregledaču — koristi „Preuzmi PDF“.
          </p>
        </object>
      )}
    </div>
  );
}
