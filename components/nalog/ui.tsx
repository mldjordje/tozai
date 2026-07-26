import type { ReactNode } from "react";
import type { StatusTone } from "@/lib/format";

// Small presentational primitives shared across the /nalog pages. Server
// components — no state, no effects.

export function Card({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`rounded-2xl border border-line bg-bg-elev/60 p-5 backdrop-blur-sm md:p-6 ${className}`}
    >
      {children}
    </div>
  );
}

export function SectionTitle({
  title,
  action,
}: {
  title: string;
  action?: ReactNode;
}) {
  return (
    <div className="mb-4 flex items-baseline justify-between gap-4">
      <h2 className="text-sm font-medium uppercase tracking-[0.14em] text-faint">
        {title}
      </h2>
      {action}
    </div>
  );
}

const TONE_CLASS: Record<StatusTone, string> = {
  neutral: "border-line bg-line/40 text-muted",
  live: "border-accent/40 bg-accent/10 text-accent-soft",
  done: "border-emerald-500/30 bg-emerald-500/10 text-emerald-300",
  bad: "border-red-500/30 bg-red-500/10 text-red-300",
};

export function StatusBadge({ label, tone }: { label: string; tone: StatusTone }) {
  return (
    <span
      className={`inline-flex shrink-0 items-center rounded-full border px-2.5 py-1 text-xs font-medium ${TONE_CLASS[tone]}`}
    >
      {label}
    </span>
  );
}

export function EmptyState({
  title,
  hint,
  action,
}: {
  title: string;
  hint?: string;
  action?: ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-dashed border-line px-6 py-12 text-center">
      <p className="text-sm text-muted">{title}</p>
      {hint && <p className="mt-1 text-sm text-faint">{hint}</p>}
      {action && <div className="mt-5 flex justify-center">{action}</div>}
    </div>
  );
}

export function Stat({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <Card>
      <p className="text-xs uppercase tracking-[0.14em] text-faint">{label}</p>
      <p className="mt-2 text-2xl font-semibold tracking-tight text-fg">{value}</p>
      {hint && <p className="mt-1 text-sm text-muted">{hint}</p>}
    </Card>
  );
}
