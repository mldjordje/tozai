import { Fragment } from "react";

/**
 * Renders the `*word*` accent syntax used across the admin-editable copy, for
 * the places that are plain text rather than a KineticTitle reveal.
 *
 * Same marker as KineticTitle so the studio learns one convention: whatever is
 * wrapped in asterisks is the highlighted word.
 */
export default function AccentText({
  text,
  className = "text-accent",
}: {
  text: string;
  className?: string;
}) {
  const parts = text.split(/\*([^*]+)\*/g);
  return (
    <>
      {parts.map((part, i) =>
        // split() with one capture group alternates: plain, captured, plain…
        i % 2 === 1 ? (
          <span key={i} className={className}>
            {part}
          </span>
        ) : (
          <Fragment key={i}>{part}</Fragment>
        ),
      )}
    </>
  );
}

/** The same string with the markers stripped — for aria-label, title and alt. */
export function plainText(text: string): string {
  return text.replace(/\*/g, "");
}
