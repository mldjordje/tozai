"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import InvoiceDocument from "@/components/nalog/InvoiceDocument";

/**
 * Three steps, one screen: identity, billing, review. The order summary stays
 * pinned beside them so the buyer never loses sight of what they are paying
 * for, and no step ever navigates away — the whole purchase happens in place
 * and only the panel changes.
 *
 * The payment step is where the provider slots in. Today that is a proforma and
 * a bank transfer; when Monri is configured the API returns a redirect intent
 * instead and this component hands off to it, with no other change here.
 */

type Pkg = {
  slug: string;
  name: string;
  price: number | null;
  currency: string;
  unit: string | null;
  description: string | null;
  features: string[];
  flow: string;
  hours: number | null;
};

type Profile = {
  name: string | null;
  phone: string | null;
  isCompany: boolean;
  companyName: string | null;
  pib: string | null;
  mb: string | null;
  address: string | null;
  city: string | null;
  country?: string | null;
};

type ManualIntent = {
  kind: "manual";
  reference: string;
  amount: number;
  currency: string;
  payee: { name: string | null; account: string | null; pib: string | null; mb: string | null };
};
/** The proforma issued alongside a bank-transfer order, so the confirmation
 *  screen can show the document itself rather than a promise of one. */
type Proforma = { id: number; number: string };
type RedirectIntent = { kind: "redirect"; redirectUrl: string };
type FormIntent = { kind: "form"; action: string; fields: Record<string, string> };
type Intent = ManualIntent | RedirectIntent | FormIntent;

/** Mirrors the server payment types — duplicated rather than
 *  imported so this client component pulls in no server-only module. */
type PaymentMethod = "card" | "invoice";
type PaymentAvailability = { card: boolean; invoice: boolean; cardIsTest: boolean };

function money(amount: number | null, currency: string) {
  if (amount == null) return "€—";
  const symbol = currency === "EUR" ? "€" : `${currency} `;
  return `${symbol}${amount.toLocaleString("sr-RS", { maximumFractionDigits: 2 })}`;
}

const STEPS = ["Nalog", "Podaci za račun", "Plaćanje", "Pregled"] as const;

export default function CheckoutFlow({
  pkg,
  user,
  profile,
  paymentAvailability,
}: {
  pkg: Pkg;
  user: { email: string; name: string | null } | null;
  profile: Profile | null;
  paymentAvailability: PaymentAvailability;
}) {
  // Signed-in buyers skip straight to billing; there is nothing to do on step 1.
  const [step, setStep] = useState(user ? 1 : 0);
  const [isCompany, setIsCompany] = useState(profile?.isCompany ?? false);
  const [form, setForm] = useState({
    name: profile?.name ?? user?.name ?? "",
    phone: profile?.phone ?? "",
    companyName: profile?.companyName ?? "",
    pib: profile?.pib ?? "",
    mb: profile?.mb ?? "",
    address: profile?.address ?? "",
    city: profile?.city ?? "",
    country: profile?.country ?? "Srbija",
  });
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>(
    paymentAvailability.card ? "card" : "invoice",
  );
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [placed, setPlaced] = useState<{
    orderId: number;
    intent: Intent;
    proforma: Proforma | null;
  } | null>(null);

  const set = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [key]: e.target.value }));

  const priceUnavailable = pkg.price == null || pkg.price <= 0;

  const billingValid =
    form.name.trim().length > 1 &&
    (!isCompany ||
      (form.companyName.trim() &&
        /^\d{9}$/.test(form.pib.trim()) &&
        /^\d{8}$/.test(form.mb.trim()) &&
        form.address.trim() &&
        form.city.trim()));

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/nalog/porudzbina", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug: pkg.slug, paymentMethod, isCompany, ...form }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setError(data.message ?? "Nešto nije u redu. Pokušaj ponovo.");
        return;
      }
      if (data.intent?.kind === "redirect") {
        window.location.href = data.intent.redirectUrl;
        return;
      }
      if (data.intent?.kind === "form") {
        const form = document.createElement("form");
        form.method = "POST";
        form.action = data.intent.action;
        Object.entries(data.intent.fields as Record<string, string>).forEach(([name, value]) => {
          const input = document.createElement("input");
          input.type = "hidden";
          input.name = name;
          input.value = value;
          form.appendChild(input);
        });
        document.body.appendChild(form);
        form.submit();
        return;
      }
      setPlaced({ orderId: data.orderId, intent: data.intent, proforma: data.proforma ?? null });
    } catch {
      setError("Veza je prekinuta. Pokušaj ponovo.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-14 grid gap-12 lg:grid-cols-[1fr_22rem] lg:gap-16">
      {/* ------------------------------------------------------------ steps */}
      <div className="order-2 lg:order-1">
        {!placed && (
          <ol className="mb-10 flex flex-wrap items-center gap-x-3 gap-y-2 text-xs uppercase tracking-[0.22em]">
            {STEPS.map((label, i) => (
              <li key={label} className="flex items-center gap-3">
                <span className={i === step ? "text-fg" : i < step ? "text-muted" : "text-faint"}>
                  {String(i + 1).padStart(2, "0")} {label}
                </span>
                {i < STEPS.length - 1 && <span className="h-px w-6 bg-line" />}
              </li>
            ))}
          </ol>
        )}

        <AnimatePresence mode="wait">
          <motion.div
            key={placed ? "done" : step}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
          >
            {placed ? (
              <Placed
                orderId={placed.orderId}
                intent={placed.intent}
                proforma={placed.proforma}
                flow={pkg.flow}
              />
            ) : step === 0 ? (
              <SignIn slug={pkg.slug} />
            ) : step === 1 ? (
              <BillingStep
                form={form}
                set={set}
                isCompany={isCompany}
                setIsCompany={setIsCompany}
                email={user?.email ?? ""}
                valid={Boolean(billingValid)}
                onNext={() => setStep(2)}
              />
            ) : step === 2 ? (
              <PaymentStep
                availability={paymentAvailability}
                value={paymentMethod}
                onChange={setPaymentMethod}
                onBack={() => setStep(1)}
                onNext={() => setStep(3)}
              />
            ) : (
              <ReviewStep
                pkg={pkg}
                form={form}
                isCompany={isCompany}
                email={user?.email ?? ""}
                consent={consent}
                setConsent={setConsent}
                busy={busy}
                error={error}
                priceUnavailable={priceUnavailable}
                paymentMethod={paymentMethod}
                cardIsTest={paymentAvailability.cardIsTest}
                onBack={() => setStep(2)}
                onSubmit={submit}
              />
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* ---------------------------------------------------------- summary */}
      <aside className="order-1 lg:order-2">
        <div className="sticky top-28 rounded-2xl border border-line bg-bg-elev/40 p-7 backdrop-blur-md">
          <p className="eyebrow">Porudžbina</p>
          <h2 className="display mt-4 text-2xl">{pkg.name}</h2>
          {pkg.description && <p className="mt-2 text-sm text-muted">{pkg.description}</p>}

          {pkg.features.length > 0 && (
            <ul className="mt-6 space-y-2.5 border-t border-line pt-6">
              {pkg.features.map((f) => (
                <li key={f} className="flex gap-3 text-sm text-muted">
                  <span className="mt-2 h-px w-3 shrink-0 bg-faint" />
                  {f}
                </li>
              ))}
            </ul>
          )}

          <div className="mt-7 flex items-end justify-between border-t border-line pt-6">
            <span className="text-sm text-muted">Ukupno</span>
            <span className="text-3xl tabular-nums">{money(pkg.price, pkg.currency)}</span>
          </div>
          {pkg.unit && <p className="mt-1 text-right text-xs text-faint">{pkg.unit}</p>}

          <p className="mt-6 border-t border-line pt-5 text-xs leading-relaxed text-faint">
            {pkg.flow === "hours"
              ? `Sati se upisuju u tvoj wallet čim uplata bude potvrđena. Termine biraš kasnije, sat po sat — kupovina nije rezervacija.`
              : `Posle potvrde uplate otvara se projekat i popunjavaš brief. Izrada kreće kad brief bude gotov.`}
          </p>
        </div>
      </aside>
    </div>
  );
}

/* -------------------------------------------------------------- step 1 --- */

function SignIn({ slug }: { slug: string }) {
  return (
    <div className="max-w-lg">
      <h2 className="display text-3xl md:text-4xl">Prijavi se da nastaviš.</h2>
      <p className="mt-5 text-muted">
        Porudžbina mora imati vlasnika — preko naloga pratiš status, preuzimaš
        isporuke i račune.
      </p>
      <a
        href={`/api/auth/google?next=${encodeURIComponent(`/porudzbina/${slug}`)}`}
        className="mt-9 inline-flex items-center gap-3 rounded-full bg-fg px-7 py-3.5 text-sm font-medium text-bg transition-colors duration-300 hover:bg-white"
      >
        <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden>
          <path
            fill="currentColor"
            d="M21.35 11.1h-9.17v2.96h5.27c-.23 1.37-1.6 4.02-5.27 4.02-3.17 0-5.76-2.63-5.76-5.87s2.59-5.87 5.76-5.87c1.8 0 3.01.77 3.7 1.43l2.52-2.43C16.78 3.9 14.68 3 12.18 3 7.03 3 2.86 7.16 2.86 12.3s4.17 9.3 9.32 9.3c5.38 0 8.94-3.78 8.94-9.11 0-.61-.07-1.08-.17-1.39z"
          />
        </svg>
        Nastavi sa Google nalogom
      </a>
    </div>
  );
}

/* -------------------------------------------------------------- step 2 --- */

function Field({
  label,
  value,
  onChange,
  placeholder,
  hint,
  inputMode,
}: {
  label: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  placeholder?: string;
  hint?: string;
  inputMode?: "text" | "numeric" | "tel";
}) {
  return (
    <label className="block">
      <span className="text-xs uppercase tracking-[0.2em] text-faint">{label}</span>
      <input
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        inputMode={inputMode}
        className="mt-2.5 w-full border-b border-line bg-transparent pb-2.5 text-fg outline-none transition-colors duration-300 placeholder:text-faint focus:border-accent-soft"
      />
      {hint && <span className="mt-1.5 block text-xs text-faint">{hint}</span>}
    </label>
  );
}

function BillingStep({
  form,
  set,
  isCompany,
  setIsCompany,
  email,
  valid,
  onNext,
}: {
  form: Record<string, string>;
  set: (k: never) => (e: React.ChangeEvent<HTMLInputElement>) => void;
  isCompany: boolean;
  setIsCompany: (v: boolean) => void;
  email: string;
  valid: boolean;
  onNext: () => void;
}) {
  const s = set as unknown as (k: string) => (e: React.ChangeEvent<HTMLInputElement>) => void;
  return (
    <div className="max-w-xl">
      <h2 className="display text-3xl md:text-4xl">Podaci za račun.</h2>
      <p className="mt-4 text-sm text-muted">
        Ovi podaci idu na fakturu. Kasnije ih možeš promeniti u profilu — već
        izdati računi ostaju netaknuti.
      </p>

      <div className="mt-9 inline-flex rounded-full border border-line p-1">
        {[
          { label: "Fizičko lice", value: false },
          { label: "Pravno lice", value: true },
        ].map((o) => (
          <button
            key={o.label}
            type="button"
            onClick={() => setIsCompany(o.value)}
            className={`rounded-full px-5 py-2 text-sm transition-colors duration-300 ${
              isCompany === o.value ? "bg-fg text-bg" : "text-muted hover:text-fg"
            }`}
          >
            {o.label}
          </button>
        ))}
      </div>

      <div className="mt-9 space-y-7">
        <Field label="Ime i prezime" value={form.name} onChange={s("name")} placeholder="Petar Petrović" />
        <div className="block">
          <span className="text-xs uppercase tracking-[0.2em] text-faint">Email</span>
          <p className="mt-2.5 border-b border-line pb-2.5 text-muted">{email}</p>
        </div>
        <Field label="Telefon" value={form.phone} onChange={s("phone")} placeholder="+381 60 000 0000" inputMode="tel" />

        {isCompany && (
          <>
            <Field label="Naziv firme" value={form.companyName} onChange={s("companyName")} />
            <div className="grid gap-7 sm:grid-cols-2">
              <Field label="PIB" value={form.pib} onChange={s("pib")} hint="9 cifara" inputMode="numeric" />
              <Field label="Matični broj" value={form.mb} onChange={s("mb")} hint="8 cifara" inputMode="numeric" />
            </div>
            <Field label="Adresa" value={form.address} onChange={s("address")} />
            <Field label="Grad" value={form.city} onChange={s("city")} />
          </>
        )}
        <Field
          label="Država"
          value={form.country}
          onChange={s("country")}
          placeholder="Srbija"
          hint="Za kupce van Srbije faktura je na engleskom i u EUR."
        />
      </div>

      <button
        type="button"
        disabled={!valid}
        onClick={onNext}
        className="mt-11 rounded-full bg-fg px-8 py-3.5 text-sm font-medium text-bg transition-all duration-300 enabled:hover:bg-white disabled:cursor-not-allowed disabled:opacity-35"
      >
        Nastavi na pregled
      </button>
    </div>
  );
}

/* -------------------------------------------------------------- step 3 --- */

function PaymentStep({
  availability,
  value,
  onChange,
  onBack,
  onNext,
}: {
  availability: PaymentAvailability;
  value: PaymentMethod;
  onChange: (value: PaymentMethod) => void;
  onBack: () => void;
  onNext: () => void;
}) {
  const options: {
    value: PaymentMethod;
    title: string;
    description: string;
    available: boolean;
  }[] = [
    {
      value: "card",
      title: availability.cardIsTest ? "Kartica — test režim" : "Platna kartica",
      description: availability.cardIsTest
        ? "Naplata je isključena; porudžbina se odmah označava kao plaćena."
        : availability.card
          ? "Nastavljaš na sigurnu stranicu procesora plaćanja."
          : "Kartično plaćanje uskoro stiže.",
      available: availability.card,
    },
    {
      value: "invoice",
      title: "Predračun / uplata na račun",
      description:
        "Odmah dobijaš predračun i podatke za uplatu. Konačna faktura stiže kad evidentiramo uplatu.",
      available: true,
    },
  ];

  return (
    <div className="max-w-xl">
      <h2 className="display text-3xl md:text-4xl">Kako želiš da platiš?</h2>
      <div className="mt-9 grid gap-4">
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            disabled={!option.available}
            onClick={() => onChange(option.value)}
            className={`rounded-2xl border p-6 text-left transition-colors ${
              value === option.value
                ? "border-accent-soft bg-bg-elev"
                : "border-line bg-bg-elev/30 hover:border-faint"
            } disabled:cursor-not-allowed disabled:opacity-45`}
          >
            <span className="text-sm font-medium text-fg">{option.title}</span>
            <span className="mt-2 block text-sm leading-relaxed text-muted">
              {option.description}
            </span>
          </button>
        ))}
      </div>
      <div className="mt-10 flex gap-5">
        <button
          type="button"
          onClick={onNext}
          className="rounded-full bg-fg px-8 py-3.5 text-sm font-medium text-bg hover:bg-white"
        >
          Nastavi na pregled
        </button>
        <button type="button" onClick={onBack} className="text-sm text-muted hover:text-fg">
          Nazad
        </button>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------- step 4 --- */

function ReviewStep({
  pkg,
  form,
  isCompany,
  email,
  consent,
  setConsent,
  busy,
  error,
  priceUnavailable,
  paymentMethod,
  cardIsTest,
  onBack,
  onSubmit,
}: {
  pkg: Pkg;
  form: Record<string, string>;
  isCompany: boolean;
  email: string;
  consent: boolean;
  setConsent: (v: boolean) => void;
  busy: boolean;
  error: string | null;
  priceUnavailable: boolean;
  paymentMethod: PaymentMethod;
  cardIsTest: boolean;
  onBack: () => void;
  onSubmit: () => void;
}) {
  return (
    <div className="max-w-xl">
      <h2 className="display text-3xl md:text-4xl">Pregled porudžbine.</h2>

      <dl className="mt-9 space-y-4 border-t border-line pt-7 text-sm">
        <Row k="Kupac" v={isCompany ? form.companyName : form.name} />
        {isCompany && <Row k="PIB / MB" v={`${form.pib} · ${form.mb}`} />}
        {isCompany && <Row k="Adresa" v={`${form.address}, ${form.city}`} />}
        <Row k="Email" v={email} />
        {form.phone && <Row k="Telefon" v={form.phone} />}
        <Row k="Stavka" v={pkg.name} />
        {pkg.flow === "hours" && pkg.hours != null && <Row k="Sati" v={`${pkg.hours}h u wallet`} />}
      </dl>

      {/* Payment method, stated before they commit rather than after. */}
      <div className="mt-9 rounded-2xl border border-line bg-bg-elev/40 p-6">
        <p className="text-xs uppercase tracking-[0.2em] text-faint">Način plaćanja</p>
        {paymentMethod === "card" && !cardIsTest ? (
          <p className="mt-3 text-sm text-muted">
            Bićeš prebačen na sigurnu stranicu za plaćanje karticom.
          </p>
        ) : paymentMethod === "card" ? (
          <>
            <p className="mt-3 text-sm text-amber-300/90">TEST REŽIM — naplata je isključena</p>
            <p className="mt-2 text-sm leading-relaxed text-muted">
              Porudžbina se odmah označava kao plaćena, bez kartice. Služi samo
              za proveru toka posle uplate.
            </p>
          </>
        ) : (
          <>
            <p className="mt-3 text-sm text-fg">Uplata na račun (predračun)</p>
            <p className="mt-2 text-sm leading-relaxed text-muted">
              Kartično plaćanje je u pripremi. Kad potvrdiš porudžbinu, odmah
              dobijaš broj za poziv na uplatu i podatke za prenos — porudžbina
              se aktivira čim uplata bude vidljiva.
            </p>
          </>
        )}
      </div>

      <label className="mt-8 flex cursor-pointer items-start gap-3.5 text-sm text-muted">
        <input
          type="checkbox"
          checked={consent}
          onChange={(e) => setConsent(e.target.checked)}
          className="mt-0.5 h-4 w-4 shrink-0 accent-[color:var(--color-accent)]"
        />
        <span>
          Saglasan/na sam sa uslovima korišćenja i politikom privatnosti.
        </span>
      </label>

      {priceUnavailable && (
        <p className="mt-6 text-sm text-amber-300/90">
          Cena za ovaj paket još nije objavljena — javi nam se i šaljemo ponudu.
        </p>
      )}
      {error && <p className="mt-6 text-sm text-red-300/90">{error}</p>}

      <div className="mt-10 flex flex-wrap items-center gap-4">
        <button
          type="button"
          disabled={!consent || busy || priceUnavailable}
          onClick={onSubmit}
          className="rounded-full bg-fg px-8 py-3.5 text-sm font-medium text-bg transition-all duration-300 enabled:hover:bg-white disabled:cursor-not-allowed disabled:opacity-35"
        >
          {busy ? "Šaljem…" : "Potvrdi porudžbinu"}
        </button>
        <button
          type="button"
          onClick={onBack}
          className="text-sm text-muted transition-colors duration-300 hover:text-fg"
        >
          Nazad
        </button>
      </div>
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between gap-6">
      <dt className="text-faint">{k}</dt>
      <dd className="text-right text-fg">{v}</dd>
    </div>
  );
}

/* --------------------------------------------------------------- placed --- */

function Placed({
  orderId,
  intent,
  proforma,
  flow,
}: {
  orderId: number;
  intent: Intent;
  proforma: Proforma | null;
  flow: string;
}) {
  const manual = intent.kind === "manual" ? intent : null;
  return (
    <div className="max-w-xl">
      <p className="eyebrow">Porudžbina #{orderId}</p>
      <h2 className="display mt-5 text-3xl md:text-5xl">
        Primljeno. <em>Hvala.</em>
      </h2>

      {/* The document comes first: whoever placed the order usually has to hand
          the proforma to whoever makes the transfer, and that should not require
          finding it again somewhere else. */}
      {proforma && (
        <InvoiceDocument
          invoiceId={proforma.id}
          number={proforma.number}
          kind="proforma"
          className="mt-9"
        />
      )}

      {manual && (
        <div className="mt-9 rounded-2xl border border-line bg-bg-elev/40 p-7">
          <p className="text-xs uppercase tracking-[0.2em] text-faint">Podaci za uplatu</p>
          <dl className="mt-5 space-y-4 text-sm">
            <Row k="Iznos" v={money(manual.amount, manual.currency)} />
            <Row k="Poziv na broj" v={manual.reference} />
            {manual.payee.name && <Row k="Primalac" v={manual.payee.name} />}
            {manual.payee.account && <Row k="Račun" v={manual.payee.account} />}
            {manual.payee.pib && <Row k="PIB" v={manual.payee.pib} />}
          </dl>
          {!manual.payee.account && (
            <p className="mt-5 text-sm text-amber-300/90">
              Podatke za uplatu ti šaljemo mejlom — javljamo se u roku od 24h.
            </p>
          )}
        </div>
      )}

      <p className="mt-8 text-sm leading-relaxed text-muted">
        {flow === "hours"
          ? "Čim uplata bude potvrđena, sati ulaze u tvoj wallet i možeš da zakažeš prvi termin."
          : "Čim uplata bude potvrđena, otvaramo projekat i dobijaš link ka brief formi."}
      </p>

      <div className="mt-10 flex flex-wrap gap-4">
        <a
          href={flow === "hours" ? "/nalog/edukacija" : "/nalog/projekti"}
          className="rounded-full bg-fg px-8 py-3.5 text-sm font-medium text-bg transition-colors duration-300 hover:bg-white"
        >
          Idi na nalog
        </a>
        <a
          href="/nalog/porudzbine"
          className="rounded-full border border-line px-8 py-3.5 text-sm text-fg transition-colors duration-300 hover:border-accent-soft"
        >
          Moje porudžbine
        </a>
      </div>
    </div>
  );
}
