"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { AccountProfile } from "@/lib/account";

type Form = {
  name: string;
  phone: string;
  address: string;
  city: string;
  country: string;
  is_company: boolean;
  company_name: string;
  pib: string;
  mb: string;
};

function toForm(p: AccountProfile): Form {
  return {
    name: p.name ?? "",
    phone: p.phone ?? "",
    address: p.address ?? "",
    city: p.city ?? "",
    country: p.country ?? "Srbija",
    is_company: p.is_company,
    company_name: p.company_name ?? "",
    pib: p.pib ?? "",
    mb: p.mb ?? "",
  };
}

const inputClass =
  "w-full rounded-xl border border-line bg-bg px-4 py-2.5 text-sm text-fg outline-none transition-colors placeholder:text-faint focus:border-accent-soft";

function Field({
  label,
  value,
  onChange,
  placeholder,
  inputMode,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  inputMode?: "text" | "tel" | "numeric";
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-xs uppercase tracking-[0.14em] text-faint">
        {label}
      </span>
      <input
        className={inputClass}
        value={value}
        placeholder={placeholder}
        inputMode={inputMode}
        onChange={(e) => onChange(e.target.value)}
      />
    </label>
  );
}

export default function ProfileForm({ profile }: { profile: AccountProfile }) {
  const router = useRouter();
  const [form, setForm] = useState<Form>(() => toForm(profile));
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  const set = <K extends keyof Form>(key: K, value: Form[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  async function save(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch("/api/nalog/profil", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = (await res.json()) as { ok: boolean; message?: string };
      if (data.ok) {
        setMessage({ ok: true, text: "Sačuvano." });
        router.refresh();
      } else {
        setMessage({ ok: false, text: data.message ?? "Čuvanje nije uspelo." });
      }
    } catch {
      setMessage({ ok: false, text: "Nema veze sa serverom." });
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={save} className="space-y-8">
      <div className="rounded-2xl border border-line bg-bg-elev/60 p-5 md:p-6">
        <p className="mb-5 text-sm font-medium text-fg">Lični podaci</p>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label="Ime i prezime"
            value={form.name}
            onChange={(v) => set("name", v)}
          />
          <Field
            label="Telefon"
            value={form.phone}
            onChange={(v) => set("phone", v)}
            inputMode="tel"
            placeholder="+381 …"
          />
          <Field label="Adresa" value={form.address} onChange={(v) => set("address", v)} />
          <Field label="Grad" value={form.city} onChange={(v) => set("city", v)} />
          <Field label="Država" value={form.country} onChange={(v) => set("country", v)} />
        </div>
        <p className="mt-4 text-sm text-faint">
          Email ({profile.email}) dolazi sa Google naloga i ne menja se ovde.
        </p>
      </div>

      <div className="rounded-2xl border border-line bg-bg-elev/60 p-5 md:p-6">
        <p className="text-sm font-medium text-fg">Podaci za račun</p>
        <p className="mt-1 text-sm text-muted">
          Ovi podaci se prepisuju na fakturu u trenutku kupovine.
        </p>

        <div className="mt-5 flex gap-2">
          {[
            { value: false, label: "Fizičko lice" },
            { value: true, label: "Pravno lice" },
          ].map((option) => (
            <button
              key={String(option.value)}
              type="button"
              onClick={() => set("is_company", option.value)}
              aria-pressed={form.is_company === option.value}
              className={`rounded-full border px-4 py-2 text-sm transition-colors ${
                form.is_company === option.value
                  ? "border-accent/50 bg-accent/10 text-fg"
                  : "border-line text-muted hover:text-fg"
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>

        {form.is_company && (
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <Field
                label="Naziv firme"
                value={form.company_name}
                onChange={(v) => set("company_name", v)}
              />
            </div>
            <Field
              label="PIB (9 cifara)"
              value={form.pib}
              onChange={(v) => set("pib", v)}
              inputMode="numeric"
            />
            <Field
              label="Matični broj (8 cifara)"
              value={form.mb}
              onChange={(v) => set("mb", v)}
              inputMode="numeric"
            />
          </div>
        )}
      </div>

      <div className="flex items-center gap-4">
        <button
          type="submit"
          disabled={saving}
          className="rounded-full bg-accent px-6 py-2.5 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {saving ? "Čuvam…" : "Sačuvaj"}
        </button>
        {message && (
          <p
            role="status"
            className={`text-sm ${message.ok ? "text-emerald-300" : "text-red-300"}`}
          >
            {message.text}
          </p>
        )}
      </div>
    </form>
  );
}
