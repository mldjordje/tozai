"use client";

import { useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

/**
 * The brief that starts an AI video job. There is no price here on purpose —
 * the studio quotes each job by hand, so this form's only job is to collect
 * enough to quote from, and to make that obvious while the buyer types.
 *
 * WHY THE SIGNED-OUT SCREEN SHOWS NOTHING ELSE. Every "Pošalji upit" on the
 * landing arrives here, and most of the people who click it have no account. A
 * service card sitting above the sign-in button pushed the only useful control
 * off a phone screen, to describe a service the buyer had just read about one
 * click earlier. Signed out, this page is a sign-in screen and nothing more;
 * the service is chosen inside the form, where it can actually be changed.
 *
 * WHY THE SUBMIT BUTTON IS NEVER DISABLED. It used to be, and on a phone that
 * read as a dead button: the minimums are invisible, so a buyer who wrote two
 * short sentences tapped a button that simply did nothing and left. Now the tap
 * always does something — it validates, scrolls to the first problem and says
 * what is missing. Live counters mean it rarely gets that far.
 */

type PackageSummary = {
  slug: string;
  name: string;
  description: string | null;
  features: string[];
};

type ProfileSummary = {
  name: string | null;
  phone: string | null;
  isCompany: boolean;
  companyName: string | null;
  pib: string | null;
  mb: string | null;
  address: string | null;
  city: string | null;
};

/** Mirrors the server-side minimums in /api/nalog/video-zahtevi. Kept here as
 *  one object so the hint text, the counter and the check can never disagree. */
const MIN = {
  name: 2,
  businessName: 2,
  businessDescription: 30,
  idea: 50,
} as const;

const EMPTY = {
  buyerType: "individual" as "individual" | "company",
  name: "",
  phone: "",
  companyName: "",
  pib: "",
  mb: "",
  address: "",
  city: "",
  idea: "",
  clipCount: "3",
  businessName: "",
  businessDescription: "",
  budgetEur: "",
};

type FormState = typeof EMPTY;
type FieldKey = keyof Omit<FormState, "buyerType">;

const EASE = [0.16, 1, 0.3, 1] as const;

function digitsOnly(value: string) {
  return value.replace(/\D/g, "").slice(0, 7);
}

function fixedDigits(value: string, length: number) {
  return value.replace(/\D/g, "").slice(0, length);
}

function validate(form: FormState): Partial<Record<FieldKey, string>> {
  const errors: Partial<Record<FieldKey, string>> = {};
  if (form.name.trim().length < MIN.name) {
    errors.name = "Upiši ime i prezime kontakt osobe.";
  }
  if (form.buyerType === "company") {
    if (form.companyName.trim().length < 2) {
      errors.companyName = "Upiši pun naziv pravnog lica ili preduzetnika.";
    }
    if (!/^\d{9}$/.test(form.pib.trim())) {
      errors.pib = "PIB mora imati tačno 9 cifara.";
    }
    if (!/^\d{8}$/.test(form.mb.trim())) {
      errors.mb = "Matični broj mora imati tačno 8 cifara.";
    }
    if (form.address.trim().length < 3) {
      errors.address = "Upiši adresu sedišta.";
    }
    if (form.city.trim().length < 2) {
      errors.city = "Upiši grad.";
    }
  }
  if (form.businessName.trim().length < MIN.businessName) {
    errors.businessName = "Upiši naziv biznisa ili brenda.";
  }
  if (form.businessDescription.trim().length < MIN.businessDescription) {
    errors.businessDescription = `Još malo — treba nam najmanje ${MIN.businessDescription} karaktera.`;
  }
  if (form.idea.trim().length < MIN.idea) {
    errors.idea = `Opiši ideju sa najmanje ${MIN.idea} karaktera da bismo mogli da procenimo posao.`;
  }
  const clips = Number(form.clipCount);
  if (!Number.isInteger(clips) || clips < 1 || clips > 100) {
    errors.clipCount = "Broj klipova mora biti između 1 i 100.";
  }
  const budget = Number(form.budgetEur);
  if (!Number.isFinite(budget) || budget <= 0) {
    errors.budgetEur = "Upiši okvirni budžet u evrima.";
  }
  return errors;
}

export default function VideoInquiryFlow({
  packages,
  initialSlug,
  user,
  profile,
}: {
  /** Every AI video service the studio currently sells (admin → Paketi). */
  packages: PackageSummary[];
  /** The one the buyer's CTA pointed at — a starting point, not a commitment. */
  initialSlug: string;
  user: { email: string; name: string | null } | null;
  profile: ProfileSummary | null;
}) {
  const [slug, setSlug] = useState(initialSlug);
  // The list is what decides; the URL only seeds it. A slug that has since been
  // retired falls back to the first service rather than rendering an empty aside.
  const pkg = packages.find((item) => item.slug === slug) ?? packages[0];
  const [form, setForm] = useState<FormState>(() => ({
    ...EMPTY,
    buyerType: profile?.isCompany ? "company" : "individual",
    name: profile?.name ?? user?.name ?? "",
    phone: profile?.phone ?? "",
    companyName: profile?.companyName ?? "",
    pib: profile?.pib ?? "",
    mb: profile?.mb ?? "",
    address: profile?.address ?? "",
    city: profile?.city ?? "",
  }));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [requestId, setRequestId] = useState<number | null>(null);
  const [touched, setTouched] = useState<Partial<Record<FieldKey, boolean>>>({});
  const [showAll, setShowAll] = useState(false);
  const fieldRefs = useRef<Partial<Record<FieldKey, HTMLElement | null>>>({});

  const errors = validate(form);
  const requiredCount = form.buyerType === "company" ? 11 : 6;
  const progress = Math.round(
    ((requiredCount - Object.keys(errors).length) / requiredCount) * 100,
  );

  const set =
    (key: FieldKey, transform?: (value: string) => string) =>
    (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      const value = transform ? transform(event.target.value) : event.target.value;
      setForm((current) => ({ ...current, [key]: value }));
    };

  const blur = (key: FieldKey) => () => setTouched((t) => ({ ...t, [key]: true }));

  /** An error is only shown once the buyer has left the field, or once they
   *  have tried to submit — nagging while someone is still typing the first
   *  word is what makes forms feel hostile. */
  const errorFor = (key: FieldKey) =>
    showAll || touched[key] ? errors[key] : undefined;

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);

    const problems = validate(form);
    if (Object.keys(problems).length > 0) {
      setShowAll(true);
      const first = ([
        "name",
        "companyName",
        "pib",
        "mb",
        "address",
        "city",
        "businessName",
        "businessDescription",
        "idea",
        "clipCount",
        "budgetEur",
      ] as FieldKey[])
        .find((key) => problems[key]);
      if (first) {
        const node = fieldRefs.current[first];
        node?.scrollIntoView({ behavior: "smooth", block: "center" });
        (node?.querySelector("input, textarea") as HTMLElement | null)?.focus({ preventScroll: true });
      }
      return;
    }

    setBusy(true);
    try {
      const response = await fetch("/api/nalog/video-zahtevi", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slug,
          ...form,
          clipCount: Number(form.clipCount),
          budgetEur: Number(form.budgetEur),
        }),
      });
      const data = await response.json();
      if (!response.ok || !data.ok) {
        setError(data.message ?? "Upit nije poslat. Pokušaj ponovo.");
        return;
      }
      setRequestId(data.requestId);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch {
      setError("Veza je prekinuta. Proveri internet i pokušaj ponovo.");
    } finally {
      setBusy(false);
    }
  }

  /* ------------------------------------------------------------- signed out */

  if (!user) {
    return (
      <Reveal>
        <div className="mt-10 max-w-xl md:mt-14">
          <p className="eyebrow">Prijava</p>
          <h2 className="display mt-5 text-3xl md:text-5xl">
            Prijavi se da pošalješ upit.
          </h2>
          <p className="mt-5 leading-relaxed text-muted">
            Traje deset sekundi. Uslugu biraš u sledećem koraku, a procena,
            plaćanje i porudžbina vezuju se za tvoj nalog — uvek vidiš šta je
            sledeće, bez traženja po mejlu.
          </p>
          <a
            href={`/api/auth/google?next=${encodeURIComponent(`/porudzbina/${slug}`)}`}
            className="mt-9 inline-flex min-h-12 w-full items-center justify-center gap-3 rounded-full bg-fg px-7 text-sm font-medium text-bg transition-colors duration-300 hover:bg-white active:scale-[0.99] sm:w-auto"
          >
            <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden>
              <path
                fill="currentColor"
                d="M21.35 11.1h-9.17v2.96h5.27c-.23 1.37-1.6 4.02-5.27 4.02-3.17 0-5.76-2.63-5.76-5.87s2.59-5.87 5.76-5.87c1.8 0 3.01.77 3.7 1.43l2.52-2.43C16.78 3.9 14.68 3 12.18 3 7.03 3 2.86 7.16 2.86 12.3s4.17 9.3 9.32 9.3c5.38 0 8.94-3.78 8.94-9.11 0-.61-.07-1.08-.17-1.39z"
              />
            </svg>
            Nastavi sa Google nalogom
          </a>
          <p className="mt-5 text-xs leading-relaxed text-faint">
            Upit je besplatan i ne obavezuje te. Cenu vidiš pre bilo kakvog
            plaćanja.
          </p>
        </div>
      </Reveal>
    );
  }

  /* ------------------------------------------------------------------ sent */

  if (requestId) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: EASE }}
        className="mt-14 max-w-2xl"
      >
        <div className="relative overflow-hidden rounded-3xl border border-line bg-bg-elev/50 p-7 backdrop-blur-md sm:p-10">
          <div
            aria-hidden
            className="pointer-events-none absolute -right-24 -top-24 h-64 w-64 rounded-full bg-[color:var(--color-accent)] opacity-[0.13] blur-3xl"
          />
          <p className="eyebrow">Upit #{requestId}</p>
          <h2 className="display mt-5 text-3xl sm:text-4xl md:text-5xl">
            Upit je <em>stigao</em>.
          </h2>
          <p className="mt-5 leading-relaxed text-muted">
            Pregledaćemo ideju, broj klipova i budžet. Kada procena bude spremna,
            stiže ti email — cena i vreme izrade pojaviće se na tvom nalogu. Tek
            tada odlučuješ da li prihvataš.
          </p>

          <ol className="mt-8 space-y-4 border-t border-line pt-7">
            {[
              "Pregledamo upit i pripremamo procenu.",
              "Cena i rok stižu na tvoj nalog.",
              "Prihvataš, plaćaš i šalješ materijale.",
            ].map((step, i) => (
              <li key={step} className="flex gap-4 text-sm text-muted">
                <span className="mt-px flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-line text-xs tabular-nums text-faint">
                  {i + 1}
                </span>
                {step}
              </li>
            ))}
          </ol>

          <a
            href="/nalog/zahtevi"
            className="mt-9 inline-flex min-h-12 w-full items-center justify-center rounded-full bg-fg px-7 text-sm font-medium text-bg transition-colors duration-300 hover:bg-white sm:w-auto"
          >
            Prati upit
          </a>
        </div>
      </motion.div>
    );
  }

  /* ------------------------------------------------------------------ form */

  return (
    <Shell aside={<Summary key={pkg.slug} pkg={pkg} />}>
      <form onSubmit={submit} noValidate className="pb-28 lg:pb-0">
        <Reveal>
          <p className="eyebrow">Upit</p>
          <h2 className="display mt-5 text-3xl sm:text-4xl md:text-5xl">
            Reci nam šta <em>pravimo</em>.
          </h2>
          <p className="mt-4 max-w-lg text-sm leading-relaxed text-muted">
            Upit je besplatan i ne obavezuje te. Materijale ne tražimo dok ne
            prihvatiš procenu.
          </p>
        </Reveal>

        {/* Completeness, so the buyer can see the form filling up rather than
            guessing why the last step is not available yet. */}
        <Reveal delay={0.05}>
          <div className="mt-8 flex items-center gap-4">
            <div className="h-px flex-1 overflow-hidden bg-line">
              <motion.div
                className="h-px bg-[color:var(--color-accent-soft)]"
                initial={false}
                animate={{ width: `${progress}%` }}
                transition={{ duration: 0.5, ease: EASE }}
              />
            </div>
            <span className="text-xs tabular-nums text-faint">{progress}%</span>
          </div>
        </Reveal>

        <div className="mt-10 space-y-9">
          {packages.length > 1 && (
            <Reveal delay={0.08}>
              <ServicePicker packages={packages} value={slug} onChange={setSlug} />
            </Reveal>
          )}

          <Reveal delay={0.1}>
            <fieldset>
              <legend className="text-xs uppercase tracking-[0.18em] text-faint">
                Tip kupca
              </legend>
              <div className="mt-3.5 inline-flex rounded-full border border-line bg-bg-elev/40 p-1 backdrop-blur-sm">
                {[
                  { value: "individual", label: "Fizičko lice" },
                  { value: "company", label: "Pravno lice" },
                ].map((option) => {
                  const active = form.buyerType === option.value;
                  return (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() =>
                        setForm((current) => ({
                          ...current,
                          buyerType: option.value as FormState["buyerType"],
                        }))
                      }
                      className="relative min-h-11 rounded-full px-5 text-sm transition-colors duration-300"
                    >
                      {active && (
                        <motion.span
                          layoutId="buyer-type-pill"
                          className="absolute inset-0 rounded-full bg-fg"
                          transition={{ type: "spring", stiffness: 420, damping: 34 }}
                        />
                      )}
                      <span className={`relative z-10 ${active ? "text-bg" : "text-muted"}`}>
                        {option.label}
                      </span>
                    </button>
                  );
                })}
              </div>
            </fieldset>
          </Reveal>

          <Reveal delay={0.12}>
            <div className="grid gap-9 sm:grid-cols-2">
              <Field
                label="Ime i prezime"
                required
                value={form.name}
                onChange={set("name")}
                onBlur={blur("name")}
                placeholder="Kontakt osoba"
                error={errorFor("name")}
                innerRef={(node) => (fieldRefs.current.name = node)}
              />
              <Field
                label="Telefon"
                value={form.phone}
                onChange={set("phone")}
                inputMode="tel"
                placeholder="+381 60 000 0000"
              />
            </div>
          </Reveal>

          <AnimatePresence initial={false}>
            {form.buyerType === "company" && (
              <motion.div
                key="company-billing"
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.35, ease: EASE }}
                className="overflow-hidden"
              >
                <div className="rounded-2xl border border-line bg-bg-elev/30 p-5 sm:p-6">
                  <p className="text-xs uppercase tracking-[0.18em] text-accent-soft">
                    Podaci za fakturu
                  </p>
                  <p className="mt-2 text-sm leading-relaxed text-muted">
                    Čuvamo ih uz ovaj upit, da faktura bude spremna kada prihvatiš
                    procenu. Pečat nije potrebno slati.
                  </p>
                  <div className="mt-7 space-y-7">
                    <Field
                      label="Pun naziv pravnog lica / preduzetnika"
                      required
                      value={form.companyName}
                      onChange={set("companyName")}
                      onBlur={blur("companyName")}
                      placeholder="Naziv iz registra"
                      error={errorFor("companyName")}
                      innerRef={(node) => (fieldRefs.current.companyName = node)}
                    />
                    <div className="grid gap-7 sm:grid-cols-2">
                      <Field
                        label="PIB"
                        required
                        value={form.pib}
                        onChange={set("pib", (value) => fixedDigits(value, 9))}
                        onBlur={blur("pib")}
                        inputMode="numeric"
                        placeholder="9 cifara"
                        hint="Tačno 9 cifara"
                        error={errorFor("pib")}
                        innerRef={(node) => (fieldRefs.current.pib = node)}
                      />
                      <Field
                        label="Matični broj"
                        required
                        value={form.mb}
                        onChange={set("mb", (value) => fixedDigits(value, 8))}
                        onBlur={blur("mb")}
                        inputMode="numeric"
                        placeholder="8 cifara"
                        hint="Tačno 8 cifara"
                        error={errorFor("mb")}
                        innerRef={(node) => (fieldRefs.current.mb = node)}
                      />
                    </div>
                    <div className="grid gap-7 sm:grid-cols-2">
                      <Field
                        label="Adresa sedišta"
                        required
                        value={form.address}
                        onChange={set("address")}
                        onBlur={blur("address")}
                        placeholder="Ulica i broj"
                        error={errorFor("address")}
                        innerRef={(node) => (fieldRefs.current.address = node)}
                      />
                      <Field
                        label="Grad"
                        required
                        value={form.city}
                        onChange={set("city")}
                        onBlur={blur("city")}
                        placeholder="Mesto"
                        error={errorFor("city")}
                        innerRef={(node) => (fieldRefs.current.city = node)}
                      />
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <Reveal delay={0.14}>
            <Field
              label="Biznis / brend"
              required
              value={form.businessName}
              onChange={set("businessName")}
              onBlur={blur("businessName")}
              placeholder="Naziv biznisa ili brenda"
              error={errorFor("businessName")}
              innerRef={(node) => (fieldRefs.current.businessName = node)}
            />
          </Reveal>

          <Reveal delay={0.18}>
            <Area
              label="Kratko o biznisu"
              required
              value={form.businessDescription}
              onChange={set("businessDescription")}
              onBlur={blur("businessDescription")}
              placeholder="Čime se bavite, šta prodajete i kome prodajete?"
              rows={4}
              min={MIN.businessDescription}
              hint="Par rečenica je dovoljno."
              error={errorFor("businessDescription")}
              innerRef={(node) => (fieldRefs.current.businessDescription = node)}
            />
          </Reveal>

          <Reveal delay={0.22}>
            <Area
              label="Ideja za klipove"
              required
              value={form.idea}
              onChange={set("idea")}
              onBlur={blur("idea")}
              placeholder="Opiši poruku, proizvod, stil ili rezultat koji želiš…"
              rows={6}
              min={MIN.idea}
              hint="Što konkretnije, to je procena tačnija."
              error={errorFor("idea")}
              innerRef={(node) => (fieldRefs.current.idea = node)}
            />
          </Reveal>

          <Reveal delay={0.26}>
            <div className="grid gap-9 sm:grid-cols-2">
              <Field
                label="Broj klipova"
                required
                value={form.clipCount}
                onChange={set("clipCount", digitsOnly)}
                onBlur={blur("clipCount")}
                inputMode="numeric"
                placeholder="npr. 3"
                hint="1 — 100"
                error={errorFor("clipCount")}
                innerRef={(node) => (fieldRefs.current.clipCount = node)}
              />
              <Field
                label="Budžet u evrima"
                required
                value={form.budgetEur}
                onChange={set("budgetEur", digitsOnly)}
                onBlur={blur("budgetEur")}
                inputMode="numeric"
                placeholder="npr. 800"
                hint="Okvirno — procenu radimo po ideji."
                error={errorFor("budgetEur")}
                innerRef={(node) => (fieldRefs.current.budgetEur = node)}
              />
            </div>
          </Reveal>

          <Reveal delay={0.3}>
            <div className="relative overflow-hidden rounded-2xl border border-line bg-bg-elev/40 p-5 backdrop-blur-sm sm:p-6">
              <div
                aria-hidden
                className="pointer-events-none absolute -left-16 -top-16 h-40 w-40 rounded-full bg-[color:var(--color-accent)] opacity-[0.10] blur-3xl"
              />
              <p className="text-xs uppercase tracking-[0.18em] text-accent-soft">
                Šta sledi
              </p>
              <p className="mt-3 text-sm leading-relaxed text-muted">
                Procena sadrži tačnu cenu i vreme izrade. Kad je prihvatiš,
                otvara se plaćanje, a materijale šalješ iz svog naloga —
                WeTransfer linkom ili preko WhatsApp kontakta.
              </p>
            </div>
          </Reveal>
        </div>

        <AnimatePresence>
          {error && (
            <motion.p
              key="submit-error"
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              role="alert"
              className="mt-7 rounded-xl border border-red-400/25 bg-red-400/5 px-4 py-3 text-sm text-red-300"
            >
              {error}
            </motion.p>
          )}
        </AnimatePresence>

        {/* On a phone the action rides at the bottom of the screen so it is
            reachable from any scroll position; on desktop it sits in the flow. */}
        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-bg/85 px-5 py-4 backdrop-blur-xl lg:static lg:mt-10 lg:border-0 lg:bg-transparent lg:p-0 lg:backdrop-blur-none">
          <div className="mx-auto flex max-w-2xl items-center gap-4 lg:mx-0">
            <button
              type="submit"
              disabled={busy}
              className="min-h-13 flex-1 rounded-full bg-fg px-8 py-3.5 text-sm font-medium text-bg transition-all duration-300 enabled:hover:bg-white enabled:active:scale-[0.99] disabled:opacity-50 lg:flex-none"
            >
              {busy ? "Šaljem…" : "Pošalji upit"}
            </button>
            <span className="hidden text-xs text-faint sm:block">
              Bez obaveze — cenu vidiš pre plaćanja.
            </span>
          </div>
        </div>
      </form>
    </Shell>
  );
}

/* ------------------------------------------------------------------ layout */

function Shell({ children, aside }: { children: React.ReactNode; aside: React.ReactNode }) {
  return (
    <div className="mt-10 grid gap-10 md:mt-14 lg:grid-cols-[1fr_22rem] lg:gap-16">
      <div className="order-2 max-w-2xl lg:order-1">{children}</div>
      <div className="order-1 lg:order-2">{aside}</div>
    </div>
  );
}

function Reveal({
  children,
  delay = 0,
}: {
  children: React.ReactNode;
  delay?: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, ease: EASE, delay }}
    >
      {children}
    </motion.div>
  );
}

/**
 * Which AI video service the brief is for.
 *
 * Rows, not pricing cards: the landing already sold the service, and there is
 * no price to compare here anyway. All this has to do is show what was picked
 * and make changing it a single tap — the aside on the right carries the detail.
 */
function ServicePicker({
  packages,
  value,
  onChange,
}: {
  packages: PackageSummary[];
  value: string;
  onChange: (slug: string) => void;
}) {
  return (
    <fieldset>
      <legend className="text-xs uppercase tracking-[0.18em] text-faint">Usluga</legend>
      <p className="mt-3 max-w-lg text-sm leading-relaxed text-muted">
        Izaberi šta ti treba. Ne moraš da pogodiš iz prve — cena se ionako
        procenjuje po ideji.
      </p>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {packages.map((item) => {
          const active = item.slug === value;
          return (
            <button
              key={item.slug}
              type="button"
              aria-pressed={active}
              onClick={() => onChange(item.slug)}
              className={`relative overflow-hidden rounded-2xl border p-4 text-left transition-colors duration-300 ${
                active
                  ? "border-accent-soft/60 bg-bg-elev/60"
                  : "border-line bg-bg-elev/20 hover:border-faint"
              }`}
            >
              {active && (
                <motion.span
                  layoutId="service-pick-glow"
                  aria-hidden
                  className="pointer-events-none absolute -right-10 -top-10 h-28 w-28 rounded-full bg-[color:var(--color-accent)] opacity-[0.16] blur-2xl"
                  transition={{ type: "spring", stiffness: 320, damping: 34 }}
                />
              )}
              <span className="relative flex items-start gap-3">
                <span
                  className={`mt-1 flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full border transition-colors duration-300 ${
                    active ? "border-accent-soft" : "border-line"
                  }`}
                >
                  {active && (
                    <motion.span
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ duration: 0.25, ease: EASE }}
                      className="h-1.5 w-1.5 rounded-full bg-[color:var(--color-accent-soft)]"
                    />
                  )}
                </span>
                <span className="min-w-0">
                  <span className={`block text-sm ${active ? "text-fg" : "text-muted"}`}>
                    {item.name}
                  </span>
                  {item.description && (
                    <span className="mt-1.5 block text-xs leading-relaxed text-faint">
                      {item.description}
                    </span>
                  )}
                </span>
              </span>
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}

function Summary({ pkg }: { pkg: PackageSummary }) {
  return (
    <aside>
      <motion.div
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: EASE }}
        className="relative overflow-hidden rounded-3xl border border-line bg-bg-elev/40 p-6 backdrop-blur-md sm:p-7 lg:sticky lg:top-28"
      >
        <div
          aria-hidden
          className="pointer-events-none absolute -right-20 -top-20 h-52 w-52 rounded-full bg-[color:var(--color-accent)] opacity-[0.12] blur-3xl"
        />
        <p className="eyebrow">AI video usluga</p>
        <h2 className="display mt-4 text-2xl">{pkg.name}</h2>
        {pkg.description && (
          <p className="mt-2 text-sm leading-relaxed text-muted">{pkg.description}</p>
        )}

        {pkg.features.length > 0 && (
          <ul className="mt-6 space-y-3 border-t border-line pt-6">
            {pkg.features.map((feature) => (
              <li key={feature} className="flex gap-3 text-sm text-muted">
                <span className="mt-2 h-px w-3 shrink-0 bg-faint" />
                {feature}
              </li>
            ))}
          </ul>
        )}

        <div className="mt-7 border-t border-line pt-6">
          <p className="text-xs uppercase tracking-[0.18em] text-accent-soft">
            Privatna procena
          </p>
          <p className="mt-2 text-sm leading-relaxed text-faint">
            Cena nije javna — svaki posao se procenjuje po ideji, broju klipova i
            roku.
          </p>
        </div>
      </motion.div>
    </aside>
  );
}

/* ------------------------------------------------------------------ inputs */

function Label({ label, required }: { label: string; required?: boolean }) {
  return (
    <span className="text-xs uppercase tracking-[0.18em] text-faint">
      {label}
      {required && <span className="ml-1 text-accent-soft">*</span>}
    </span>
  );
}

function Note({ error, hint }: { error?: string; hint?: string }) {
  return (
    <AnimatePresence mode="wait" initial={false}>
      {(error || hint) && (
        <motion.span
          key={error ? "err" : "hint"}
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className={`mt-2 block text-xs leading-relaxed ${error ? "text-red-300" : "text-faint"}`}
        >
          {error ?? hint}
        </motion.span>
      )}
    </AnimatePresence>
  );
}

function Field({
  label,
  value,
  onChange,
  onBlur,
  placeholder,
  hint,
  error,
  required,
  inputMode,
  innerRef,
}: {
  label: string;
  value: string;
  onChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onBlur?: () => void;
  placeholder?: string;
  hint?: string;
  error?: string;
  required?: boolean;
  inputMode?: "text" | "numeric" | "tel";
  innerRef?: (node: HTMLElement | null) => void;
}) {
  return (
    <label ref={innerRef} className="block scroll-mt-24">
      <Label label={label} required={required} />
      <input
        type="text"
        inputMode={inputMode}
        value={value}
        onChange={onChange}
        onBlur={onBlur}
        placeholder={placeholder}
        aria-invalid={Boolean(error)}
        /* text-base, not text-sm: iOS Safari zooms the whole page in on focus
           for anything under 16px, and the buyer never zooms back out. */
        className={`mt-3 w-full border-b bg-transparent pb-3 text-base text-fg outline-none transition-colors duration-300 placeholder:text-faint ${
          error ? "border-red-400/50" : "border-line focus:border-accent-soft"
        }`}
      />
      <Note error={error} hint={hint} />
    </label>
  );
}

function Area({
  label,
  value,
  onChange,
  onBlur,
  placeholder,
  rows,
  min,
  hint,
  error,
  required,
  innerRef,
}: {
  label: string;
  value: string;
  onChange: (event: React.ChangeEvent<HTMLTextAreaElement>) => void;
  onBlur?: () => void;
  placeholder: string;
  rows: number;
  min: number;
  hint?: string;
  error?: string;
  required?: boolean;
  innerRef?: (node: HTMLElement | null) => void;
}) {
  const length = value.trim().length;
  const reached = length >= min;
  return (
    <label ref={innerRef} className="block scroll-mt-24">
      <span className="flex items-baseline justify-between gap-4">
        <Label label={label} required={required} />
        <span
          className={`text-xs tabular-nums transition-colors duration-300 ${
            reached ? "text-accent-soft" : "text-faint"
          }`}
        >
          {reached ? `${length}` : `${length} / ${min}`}
        </span>
      </span>
      <textarea
        value={value}
        onChange={onChange}
        onBlur={onBlur}
        placeholder={placeholder}
        rows={rows}
        aria-invalid={Boolean(error)}
        className={`mt-3 w-full resize-y rounded-2xl border bg-bg-elev/30 p-4 text-base leading-relaxed text-fg outline-none transition-colors duration-300 placeholder:text-faint ${
          error ? "border-red-400/50" : "border-line focus:border-accent-soft"
        }`}
      />
      <Note error={error} hint={hint ? `Minimum ${min} karaktera. ${hint}` : undefined} />
    </label>
  );
}
