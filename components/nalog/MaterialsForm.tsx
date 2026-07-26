"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function MaterialsForm({ projectId }: { projectId: number }) {
  const router = useRouter();
  const [method, setMethod] = useState<"wetransfer" | "whatsapp">("wetransfer");
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`/api/nalog/projekti/${projectId}/materijali`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ method, value }),
      });
      const data = await response.json();
      if (!response.ok || !data.ok) {
        setError(data.message ?? "Materijali nisu sačuvani.");
        return;
      }
      router.refresh();
    } catch {
      setError("Veza je prekinuta. Pokušaj ponovo.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit}>
      <div className="grid gap-3 sm:grid-cols-2">
        {[
          { value: "wetransfer", title: "WeTransfer", text: "Pošalji fajlove i nalepi transfer link." },
          { value: "whatsapp", title: "WhatsApp", text: "Ostavi broj; javljamo se za preuzimanje." },
        ].map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={() => {
              setMethod(option.value as typeof method);
              setValue("");
            }}
            className={`rounded-xl border p-4 text-left ${method === option.value ? "border-accent/50 bg-accent/10" : "border-line"}`}
          >
            <span className="block text-sm font-medium text-fg">{option.title}</span>
            <span className="mt-1 block text-xs leading-relaxed text-muted">{option.text}</span>
          </button>
        ))}
      </div>
      <label className="mt-5 block">
        <span className="text-xs uppercase tracking-[0.14em] text-faint">
          {method === "wetransfer" ? "WeTransfer link" : "WhatsApp broj"}
        </span>
        <input
          value={value}
          onChange={(event) => setValue(event.target.value)}
          placeholder={method === "wetransfer" ? "https://we.tl/…" : "+381 6…"}
          className="mt-2 w-full rounded-xl border border-line bg-bg px-4 py-3 text-sm text-fg outline-none focus:border-accent-soft"
        />
      </label>
      {error && <p className="mt-3 text-sm text-red-300">{error}</p>}
      <button type="submit" disabled={busy || value.trim().length < 5} className="mt-5 rounded-full bg-fg px-6 py-3 text-sm font-medium text-bg disabled:opacity-40">
        {busy ? "Čuvam…" : "Potvrdi materijale"}
      </button>
    </form>
  );
}
