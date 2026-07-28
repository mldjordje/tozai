"use client";

// SR / EN, above whatever is being edited.
//
// The public site is bilingual, so most content tabs now edit one language at a
// time. A switch rather than doubled-up fields: the forms are already long, and
// the studio writes one language through and then the other, rather than
// alternating field by field.

export function LocaleTabs({
  value,
  onChange,
  note,
}: {
  value: "sr" | "en";
  onChange: (locale: "sr" | "en") => void;
  note?: string;
}) {
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ display: "flex", gap: 6 }}>
        {(
          [
            { key: "sr", label: "Srpski" },
            { key: "en", label: "English" },
          ] as const
        ).map((option) => (
          <button
            key={option.key}
            type="button"
            className="adm__chip"
            aria-pressed={value === option.key}
            onClick={() => onChange(option.key)}
          >
            {option.label}
          </button>
        ))}
      </div>
      {note && (
        <p className="adm__hint" style={{ marginTop: 8 }}>
          {note}
        </p>
      )}
    </div>
  );
}
