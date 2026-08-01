"use client";

import { motion, AnimatePresence } from "framer-motion";

/**
 * The form furniture both briefs are built out of.
 *
 * Extracted when the web/app rail arrived and needed the same inputs as the
 * video brief: the same label treatment, the same error-under-the-field
 * behaviour, the same country <select>, the same live character counter. The
 * alternative was a second copy of four hundred lines that would drift the
 * first time one of them was restyled.
 *
 * Only the furniture lives here. What each brief asks for, what it validates
 * and where it posts stays in the flow that owns it.
 */

export const EASE = [0.16, 1, 0.3, 1] as const;

export function digitsOnly(value: string) {
  return value.replace(/\D/g, "").slice(0, 7);
}

export function fixedDigits(value: string, length: number) {
  return value.replace(/\D/g, "").slice(0, length);
}

/** Form on the left, sticky summary on the right; stacked with the summary
 *  first on a phone, where it is the reminder of what is being asked about. */
export function Shell({
  children,
  aside,
}: {
  children: React.ReactNode;
  aside: React.ReactNode;
}) {
  return (
    <div className="mt-10 grid gap-10 md:mt-14 lg:grid-cols-[1fr_22rem] lg:gap-16">
      <div className="order-2 max-w-2xl lg:order-1">{children}</div>
      <div className="order-1 lg:order-2">{aside}</div>
    </div>
  );
}

export function Reveal({
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

export function Label({ label, required }: { label: string; required?: boolean }) {
  return (
    <span className="text-xs uppercase tracking-[0.18em] text-faint">
      {label}
      {required && <span className="ml-1 text-accent-soft">*</span>}
    </span>
  );
}

export function Note({ error, hint }: { error?: string; hint?: string }) {
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

export function Field({
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
        aria-invalid={error ? true : undefined}
        className="field mt-3"
      />
      <Note error={error} hint={hint} />
    </label>
  );
}

/**
 * A native <select>, styled as one of the fields.
 *
 * Native rather than a custom listbox: sixty-odd countries is exactly the case
 * where a phone's own picker — searchable, scrollable with one thumb, already
 * familiar — beats anything rebuilt in a div. The only thing worth overriding
 * is the arrow, so it matches the rest of the form rather than the OS.
 */
export function Select({
  label,
  value,
  onChange,
  onBlur,
  options,
  hint,
  error,
  required,
  innerRef,
}: {
  label: string;
  value: string;
  onChange: (event: React.ChangeEvent<HTMLSelectElement>) => void;
  onBlur?: () => void;
  options: { value: string; label: string }[];
  hint?: string;
  error?: string;
  required?: boolean;
  innerRef?: (node: HTMLElement | null) => void;
}) {
  return (
    <label ref={innerRef} className="block max-w-sm scroll-mt-24">
      <Label label={label} required={required} />
      <div className="relative mt-3">
        <select
          value={value}
          onChange={onChange}
          onBlur={onBlur}
          aria-invalid={error ? true : undefined}
          className="field appearance-none pr-11"
        >
          {/* A value the list does not know about — an older profile row typed
              by hand — keeps its own option, so opening the form never silently
              rewrites what the buyer told us before. */}
          {options.some((option) => option.value === value) ? null : (
            <option value={value}>{value}</option>
          )}
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <svg
          viewBox="0 0 24 24"
          aria-hidden
          className="pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-faint"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M6 9l6 6 6-6" />
        </svg>
      </div>
      <Note error={error} hint={hint} />
    </label>
  );
}

/**
 * A textarea with a live counter.
 *
 * `min` of 0 means the field is optional, and then there is no counter to show
 * — a "0 / 0" above an optional box reads as a requirement nobody set.
 */
export function Area({
  label,
  value,
  onChange,
  onBlur,
  placeholder,
  rows,
  min,
  minChars,
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
  minChars: (min: number) => string;
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
        {min > 0 && (
          <span
            className={`text-xs tabular-nums transition-colors duration-300 ${
              reached ? "text-accent-soft" : "text-faint"
            }`}
          >
            {reached ? `${length}` : `${length} / ${min}`}
          </span>
        )}
      </span>
      <textarea
        value={value}
        onChange={onChange}
        onBlur={onBlur}
        placeholder={placeholder}
        rows={rows}
        aria-invalid={error ? true : undefined}
        className="field mt-3"
      />
      <Note
        error={error}
        hint={hint ? (min > 0 ? `${minChars(min)} ${hint}` : hint) : undefined}
      />
    </label>
  );
}
