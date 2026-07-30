"use client";

import {
  useCallback,
  useEffect,
  useState,
  type Dispatch,
  type SetStateAction,
} from "react";
import { createPortal } from "react-dom";
import Image from "next/image";
import { AnimatePresence, motion } from "framer-motion";
import { useLenis } from "lenis/react";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import {
  shotDescription,
  shotSize,
  shotTitle,
  type ResultShotView,
} from "@/lib/results-shot";
import type { UiStrings } from "@/lib/i18n/ui";

/**
 * Full-size view of one proof shot.
 *
 * The rail crops every card to a fixed width and lays a gradient over its
 * bottom third, so the one thing a visitor actually wants to read — the numbers
 * in the screenshot — is the part the card hides. Opening the shot uncropped,
 * with its own heading and description, is what turns the rail from decoration
 * into evidence.
 *
 * Portalled to <body>: the rail sits inside an `overflow-hidden` sticky
 * container, and a fixed overlay rendered in place would be clipped by it the
 * moment any ancestor grows a transform.
 */
export default function ResultLightbox({
  shots,
  index,
  onSelect,
  onClose,
  t,
}: {
  shots: ResultShotView[];
  /** Index of the open shot, or null when the lightbox is closed. */
  index: number | null;
  onSelect: Dispatch<SetStateAction<number | null>>;
  onClose: () => void;
  t: UiStrings["results"];
}) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  // Lenis owns window scroll on the landing; `overflow: hidden` alone would
  // still leave it easing the page behind the overlay.
  const lenis = useLenis();

  const open = index !== null && index >= 0 && index < shots.length;
  const shot = open ? shots[index] : null;

  // Functional update, not `index + direction`: a held arrow key fires repeats
  // faster than the prop can come back around, and every one of them would
  // otherwise step off the same stale index.
  const go = useCallback(
    (direction: 1 | -1) => {
      if (shots.length === 0) return;
      onSelect((current) =>
        current === null ? current : (current + direction + shots.length) % shots.length,
      );
    },
    [onSelect, shots.length],
  );

  useEffect(() => {
    if (!open) return;

    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
      else if (event.key === "ArrowRight") go(1);
      else if (event.key === "ArrowLeft") go(-1);
    };

    window.addEventListener("keydown", onKey);
    lenis?.stop();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      window.removeEventListener("keydown", onKey);
      lenis?.start();
      document.body.style.overflow = previousOverflow;
    };
  }, [open, onClose, go, lenis]);

  if (!mounted) return null;

  const size = shot ? shotSize(shot) : null;
  const heading = shot ? shotTitle(shot) : "";
  const description = shot ? shotDescription(shot) : "";
  const many = shots.length > 1;

  return createPortal(
    <AnimatePresence>
      {open && shot && size && (
        <motion.div
          key="result-lightbox"
          className="fixed inset-0 z-[120] flex items-center justify-center px-4 py-6 md:px-8"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
          role="dialog"
          aria-modal="true"
          aria-label={heading}
        >
          <button
            type="button"
            onClick={onClose}
            aria-label={t.close}
            className="absolute inset-0 cursor-zoom-out bg-black/90 backdrop-blur-xl"
          />

          <button
            type="button"
            onClick={onClose}
            aria-label={t.close}
            className="absolute right-4 top-4 z-10 grid size-10 place-items-center rounded-full border border-line bg-bg-elev/70 text-muted backdrop-blur-md transition-colors duration-300 hover:border-fg/30 hover:text-fg md:right-8 md:top-8"
          >
            <X size={18} strokeWidth={1.75} aria-hidden />
          </button>

          {many && (
            <>
              <button
                type="button"
                onClick={() => go(-1)}
                aria-label={t.prev}
                className="absolute left-4 top-1/2 z-10 hidden -translate-y-1/2 place-items-center rounded-full border border-line bg-bg-elev/70 p-3 text-muted backdrop-blur-md transition-colors duration-300 hover:border-fg/30 hover:text-fg md:grid"
              >
                <ChevronLeft size={20} strokeWidth={1.75} aria-hidden />
              </button>
              <button
                type="button"
                onClick={() => go(1)}
                aria-label={t.next}
                className="absolute right-4 top-1/2 z-10 hidden -translate-y-1/2 place-items-center rounded-full border border-line bg-bg-elev/70 p-3 text-muted backdrop-blur-md transition-colors duration-300 hover:border-fg/30 hover:text-fg md:grid"
              >
                <ChevronRight size={20} strokeWidth={1.75} aria-hidden />
              </button>
            </>
          )}

          {/* The shot itself is re-keyed per index so switching cross-fades
              instead of swapping a src underneath a static frame. */}
          <motion.div
            key={shot.id ?? shot.image_url}
            className="relative z-[1] flex max-h-full w-full max-w-4xl flex-col items-center gap-6"
            initial={{ opacity: 0, scale: 0.96, y: 18 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97, y: 10 }}
            transition={{ type: "spring", stiffness: 210, damping: 26, mass: 0.7 }}
            drag={many ? "x" : false}
            dragConstraints={{ left: 0, right: 0 }}
            dragElastic={0.14}
            dragMomentum={false}
            onDragEnd={(_, info) => {
              if (info.offset.x < -70) go(1);
              else if (info.offset.x > 70) go(-1);
            }}
          >
            <div className="overflow-hidden rounded-2xl border border-line bg-bg-elev shadow-2xl shadow-black/70 md:rounded-3xl">
              <Image
                src={shot.image_url}
                alt={shot.alt}
                width={size.width}
                height={size.height}
                sizes="(max-width: 768px) 92vw, 70vw"
                draggable={false}
                className="h-auto max-h-[46svh] w-auto max-w-full object-contain md:max-h-[58svh]"
              />
            </div>

            <div className="max-w-xl text-center">
              {many && (
                <p className="eyebrow mb-3 tabular-nums" aria-label={t.position(index + 1, shots.length)}>
                  {String(index + 1).padStart(2, "0")} / {String(shots.length).padStart(2, "0")}
                </p>
              )}
              {heading && <h3 className="display text-3xl md:text-4xl">{heading}</h3>}
              {shot.stat && shot.stat.trim() !== heading && (
                <p className="mt-3 inline-flex rounded-full border border-line bg-bg-elev/60 px-4 py-1.5 text-xs text-fg backdrop-blur-md md:text-sm">
                  {shot.stat}
                </p>
              )}
              {description && (
                <p className="mt-4 text-sm text-muted md:text-base">{description}</p>
              )}
            </div>

            {many && (
              <div className="flex items-center gap-3 md:hidden">
                <button
                  type="button"
                  onClick={() => go(-1)}
                  aria-label={t.prev}
                  className="grid size-11 place-items-center rounded-full border border-line text-muted"
                >
                  <ChevronLeft size={18} strokeWidth={1.75} aria-hidden />
                </button>
                <button
                  type="button"
                  onClick={() => go(1)}
                  aria-label={t.next}
                  className="grid size-11 place-items-center rounded-full border border-line text-muted"
                >
                  <ChevronRight size={18} strokeWidth={1.75} aria-hidden />
                </button>
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
