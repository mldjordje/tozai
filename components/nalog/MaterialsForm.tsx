"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/**
 * Hand-off form. Stays available for the whole life of the project, because a
 * WeTransfer link expires long before the work is done and clients routinely
 * remember one more file after they hit send.
 *
 * WhatsApp is offered only until it has been given once — after that the client
 * simply messages us, and re-submitting the same number would just ring the
 * admin's unread badge for nothing.
 */
export default function MaterialsForm({
  projectId,
  whatsappSent,
  compact,
}: {
  projectId: number;
  whatsappSent: boolean;
  compact?: boolean;
}) {
  const router = useRouter();
  const [method, setMethod] = useState<"wetransfer" | "whatsapp">("wetransfer");
  const [value, setValue] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const options = [
    {
      value: "wetransfer" as const,
      title: "WeTransfer",
      text: "Pošalji fajlove i nalepi transfer link.",
    },
    ...(whatsappSent
      ? []
      : [
          {
            value: "whatsapp" as const,
            title: "WhatsApp",
            text: "Ostavi broj; javljamo se za preuzimanje.",
          },
        ]),
  ];

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`/api/nalog/projekti/${projectId}/materijali`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ method, value, note }),
      });
      const data = await response.json();
      if (!response.ok || !data.ok) {
        setError(data.message ?? "Materijali nisu sačuvani.");
        return;
      }
      setValue("");
      setNote("");
      router.refresh();
    } catch {
      setError("Veza je prekinuta. Pokušaj ponovo.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit}>
      {options.length > 1 && (
        <div className="grid gap-3 sm:grid-cols-2">
          {options.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => {
                setMethod(option.value);
                setValue("");
              }}
              className={`rounded-xl border p-4 text-left transition-colors ${
                method === option.value
                  ? "border-accent/50 bg-accent/10"
                  : "border-line hover:border-accent/30"
              }`}
            >
              <span className="block text-sm font-medium text-fg">{option.title}</span>
              <span className="mt-1 block text-xs leading-relaxed text-muted">
                {option.text}
              </span>
            </button>
          ))}
        </div>
      )}

      <label className={options.length > 1 ? "mt-5 block" : "block"}>
        <span className="text-xs uppercase tracking-[0.14em] text-faint">
          {method === "wetransfer" ? "WeTransfer link" : "WhatsApp broj"}
        </span>
        <input
          value={value}
          onChange={(event) => setValue(event.target.value)}
          placeholder={method === "wetransfer" ? "https://we.tl/…" : "+381 6…"}
          inputMode={method === "wetransfer" ? "url" : "tel"}
          className="mt-2 w-full rounded-xl border border-line bg-bg px-4 py-3 text-base text-fg outline-none transition-colors focus:border-accent-soft"
        />
      </label>

      <label className="mt-4 block">
        <span className="text-xs uppercase tracking-[0.14em] text-faint">
          Napomena <span className="normal-case tracking-normal">(opciono)</span>
        </span>
        <input
          value={note}
          onChange={(event) => setNote(event.target.value)}
          placeholder={compact ? "Šta je u ovom transferu?" : "npr. logo u vektoru + snimci proizvoda"}
          className="mt-2 w-full rounded-xl border border-line bg-bg px-4 py-3 text-base text-fg outline-none transition-colors focus:border-accent-soft"
        />
      </label>

      {error && (
        <p role="alert" className="mt-3 text-sm text-red-300">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={busy || value.trim().length < 5}
        className="mt-5 min-h-12 rounded-full bg-fg px-6 text-sm font-medium text-bg transition-colors disabled:opacity-40"
      >
        {busy ? "Čuvam…" : compact ? "Pošalji još jedan link" : "Potvrdi materijale"}
      </button>
    </form>
  );
}
