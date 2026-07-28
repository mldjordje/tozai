"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

// Cancel a session and get the hours back. The cutoff is enforced server-side;
// this only surfaces whatever the API says, so the rule lives in one place.
export function CancelBooking({ id }: { id: number }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cancel = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/nalog/termini/${id}`, { method: "DELETE" });
      const data = await res.json();
      if (!data.ok) {
        setError(data.message ?? "Termin nije otkazan.");
        setConfirming(false);
        return;
      }
      router.refresh();
    } catch {
      setError("Greška u komunikaciji sa serverom.");
      setConfirming(false);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mt-3 flex flex-wrap items-center gap-3">
      {confirming ? (
        <>
          <button
            type="button"
            onClick={cancel}
            disabled={busy}
            className="rounded-full border border-red-500/40 px-4 py-1.5 text-sm text-red-300 transition-colors hover:bg-red-500/10 disabled:opacity-40"
          >
            {busy ? "Otkazujem…" : "Potvrdi otkazivanje"}
          </button>
          <button
            type="button"
            onClick={() => setConfirming(false)}
            className="text-sm text-faint underline underline-offset-4"
          >
            Odustani
          </button>
        </>
      ) : (
        <button
          type="button"
          onClick={() => setConfirming(true)}
          className="text-sm text-faint underline underline-offset-4 transition-colors hover:text-muted"
        >
          Otkaži termin
        </button>
      )}
      {error && (
        <span className="text-sm text-red-300" role="alert">
          {error}
        </span>
      )}
    </div>
  );
}
