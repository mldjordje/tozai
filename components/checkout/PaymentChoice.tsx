"use client";

import type { PaymentAvailability, PaymentMethod } from "@/lib/payments/selection";

/**
 * The pay-by choice, shared by checkout and quote acceptance so the two cannot
 * describe the same options differently.
 *
 * Card stays visible while it is unavailable, disabled and marked "uskoro":
 * hiding it would tell a buyer this studio only ever takes bank transfers,
 * which is not what we want them to conclude while Monri is pending.
 */
export default function PaymentChoice({
  availability,
  value,
  onChange,
  className = "",
}: {
  availability: PaymentAvailability;
  value: PaymentMethod;
  onChange: (value: PaymentMethod) => void;
  className?: string;
}) {
  const options: {
    value: PaymentMethod;
    title: string;
    description: string;
    available: boolean;
  }[] = [
    {
      value: "card",
      title: availability.cardIsTest ? "Platna kartica — test režim" : "Platna kartica",
      description: availability.cardIsTest
        ? "Naplata je isključena; porudžbina se odmah označava kao plaćena."
        : availability.card
          ? "Nastavljaš na sigurnu stranicu procesora plaćanja."
          : "Uskoro.",
      available: availability.card,
    },
    {
      value: "invoice",
      title: "Predračun / uplata na račun",
      description:
        "Odmah dobijaš predračun i podatke za uplatu — mobilna aplikacija banke, pošta ili menjačnica. Konačna faktura stiže kad evidentiramo uplatu.",
      available: availability.invoice,
    },
  ];

  return (
    <div className={`grid gap-4 ${className}`} role="radiogroup" aria-label="Način plaćanja">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          role="radio"
          aria-checked={value === option.value}
          disabled={!option.available}
          onClick={() => onChange(option.value)}
          className={`rounded-2xl border p-5 text-left transition-colors md:p-6 ${
            value === option.value
              ? "border-accent-soft bg-bg-elev"
              : "border-line bg-bg-elev/30 hover:border-faint"
          } disabled:cursor-not-allowed disabled:opacity-45 disabled:hover:border-line`}
        >
          <span className="flex flex-wrap items-center gap-2 text-sm font-medium text-fg">
            {option.title}
            {!option.available && (
              <span className="rounded-full border border-line px-2 py-0.5 text-[10px] uppercase tracking-[0.14em] text-faint">
                Uskoro
              </span>
            )}
          </span>
          <span className="mt-2 block text-sm leading-relaxed text-muted">
            {option.description}
          </span>
        </button>
      ))}
    </div>
  );
}
