"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import { motion, useMotionValue, useMotionValueEvent, useScroll } from "framer-motion";
import { ChevronLeft, ChevronRight } from "lucide-react";
import KineticTitle from "@/components/ui/KineticTitle";
import CTAButton from "@/components/ui/CTAButton";
import AccentText from "@/components/ui/AccentText";
import ResultLightbox from "@/components/sections/ResultLightbox";
import { DEFAULTS } from "@/lib/content/landing";
import { shotSize, shotTitle, type ResultShotView } from "@/lib/results-shot";
import { ui } from "@/lib/i18n/ui";
import { DEFAULT_LOCALE, type Locale } from "@/lib/i18n/config";

/**
 * Proof showcase — a real horizontal scroller, not a transformed train.
 *
 * It used to be a `motion.div` translated from `1%` to `-80%` of its own width
 * as the section scrolled. That percentage is the bug: the train's width is the
 * sum of six cards sized in `vw`, so how far `-80%` actually travels changes
 * with the viewport and with however many shots the studio has uploaded. On a
 * wide phone it stopped short and the last cards never appeared; add a seventh
 * shot from /admin/rezultati and it stopped short everywhere.
 *
 * The rail is now a native `overflow-x` scroller, so the end of the travel is
 * whatever `scrollWidth - clientWidth` measures — correct on every device, at
 * any shot count, for free. What each pointer gets:
 *
 * - Touch: nothing but the browser. Snap points, momentum, and the arrows for
 *   anyone who taps rather than swipes. The section is a normal height here —
 *   no pin, no `svh` sticky maths, which is what broke on mobile in the first
 *   place.
 * - Desktop: vertical scroll still drives the rail while the section is pinned,
 *   eased toward a measured target, and the rail stays natively scrollable at
 *   any time (trackpad, shift-wheel) — a manual nudge simply holds until the
 *   page scrolls again.
 *
 * Any card opens full-size in ResultLightbox.
 */

// Shipped fallback, used only when the database has no active rows (or is
// unreachable). The same six shots are seeded into `result_shots` by
// scripts/init-db.mjs, so in practice the rail is admin-driven from day one and
// this exists so the section can never render empty.
const SHOTS: ResultShotView[] = [
  {
    image_url: "/media/results/ig-toza.png",
    alt: "toza.aii — Instagram profil, 187K pratilaca, verifikovan",
    handle: "toza.aii",
    stat: "187K pratilaca · Instagram",
    wide: true,
  },
  {
    image_url: "/media/results/tt-toza.png",
    alt: "Toza Ai — TikTok profil, 69.5K pratilaca, 609K lajkova",
    handle: "@tozaai",
    stat: "69.5K pratilaca · 609K lajkova",
    wide: false,
  },
  {
    image_url: "/media/rezultati.png",
    alt: "TikTok Insights — desetine hiljada lajkova po objavi",
    handle: "TikTok Insights",
    stat: "43K+ lajkova po objavi",
    wide: false,
  },
  {
    image_url: "/media/results/tt-darija.png",
    alt: "Darija Ai — TikTok profil, 22.1K pratilaca, 753K lajkova",
    handle: "@darijaaai",
    stat: "22.1K pratilaca · 753K lajkova",
    wide: false,
  },
  {
    image_url: "/media/results/ig-kaja.png",
    alt: "Kaja Sretic — Instagram AI profil, 12.3K pratilaca",
    handle: "kajasretic",
    stat: "12.3K pratilaca · Instagram",
    wide: true,
  },
  {
    image_url: "/media/results/tt-kajina.png",
    alt: "kajina.perspektiva — TikTok profil, 15.3K pratilaca, 183K lajkova",
    handle: "kajina.perspektiva",
    stat: "15.3K pratilaca · 183K lajkova",
    wide: false,
  },
];

/** The pinned section is 320svh, so its sticky child unpins at (320-100)/320 ≈
 *  0.69. The rail has to finish its travel just before that or the last cards
 *  are still off-screen when the section lets go. */
const DRIVE_FROM = 0.04;
const DRIVE_TO = 0.66;

/** How long a manual swipe or trackpad nudge owns the rail before scroll takes
 *  it back. Long enough to finish the gesture, short enough that the page does
 *  not feel like it stopped driving. */
const MANUAL_HOLD_MS = 900;

function Card({
  shot,
  index,
  onOpen,
  label,
}: {
  shot: ResultShotView;
  index: number;
  onOpen: () => void;
  label: string;
}) {
  const { width, height } = shotSize(shot);
  const heading = shotTitle(shot);
  return (
    <div className="group relative shrink-0 snap-start md:h-full">
      {/* Oversized ghost index behind each card */}
      <span className="pointer-events-none absolute -top-12 left-1 select-none text-7xl font-bold tracking-tighter text-fg/[0.06] md:text-8xl lg:-top-14 lg:text-9xl">
        {String(index + 1).padStart(2, "0")}
      </span>
      <button
        type="button"
        onClick={onOpen}
        aria-label={label}
        // Height-driven on desktop, width-driven on touch — with the real
        // aspect ratio declared either way, so the card is exactly the shape of
        // the shot and the rail never has to guess at a fixed card height.
        style={{ aspectRatio: `${width} / ${height}` }}
        className={`relative block cursor-zoom-in overflow-hidden rounded-2xl border border-line text-left shadow-2xl shadow-black/60 transition-colors duration-500 hover:border-fg/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg md:h-full md:w-auto md:max-w-none md:rounded-3xl ${
          shot.wide ? "w-[76vw] max-w-[340px]" : "w-[62vw] max-w-[260px]"
        }`}
      >
        <Image
          src={shot.image_url}
          alt={shot.alt}
          width={width}
          height={height}
          draggable={false}
          className="h-full w-full object-cover transition-transform duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:scale-[1.045]"
          sizes="(max-width: 768px) 76vw, 400px"
        />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent p-4 pt-14">
          <div className="line-clamp-1 text-sm font-semibold md:text-base">{heading}</div>
          {shot.stat && shot.stat.trim() !== heading && (
            <div className="mt-0.5 line-clamp-1 text-xs text-muted md:text-sm">{shot.stat}</div>
          )}
        </div>
      </button>
    </div>
  );
}

export default function ResultsShowcase({
  locale = DEFAULT_LOCALE,
  // The closing card is the one CTA a buyer reaches while still looking at the
  // proof, so it opens the brief directly instead of scrolling to #booking.
  ctaHref = "#paketi",
  shots = SHOTS,
  eyebrow = DEFAULTS.results_eyebrow,
  title = DEFAULTS.results_title,
  body = DEFAULTS.results_body,
  cardTitle = DEFAULTS.results_card_title,
  ctaLabel = DEFAULTS.results_cta,
}: {
  locale?: Locale;
  ctaHref?: string;
  shots?: ResultShotView[];
  eyebrow?: string;
  title?: string;
  body?: string;
  cardTitle?: string;
  ctaLabel?: string;
} = {}) {
  const t = ui(locale).results;
  const sectionRef = useRef<HTMLElement>(null);
  const railRef = useRef<HTMLDivElement>(null);

  /** While set, the visitor is driving the rail and scroll keeps its hands off. */
  const manualUntilRef = useRef(0);
  /** Marks that the next scroll-driven write is taking the rail back. */
  const resyncRef = useRef(false);
  /** Whether vertical scroll drives the rail at all — desktop only. */
  const drivenRef = useRef(false);

  const [open, setOpen] = useState<number | null>(null);
  const [hinted, setHinted] = useState(false);
  const progress = useMotionValue(0);

  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ["start start", "end end"],
  });

  // Desktop only. A pinned section on a phone means an `svh` sticky child and a
  // scroll position the browser keeps re-measuring as the URL bar collapses —
  // exactly the combination that made this section unreliable there.
  useEffect(() => {
    const query = window.matchMedia("(min-width: 768px)");
    const sync = () => {
      drivenRef.current = query.matches;
    };
    sync();
    query.addEventListener("change", sync);
    return () => query.removeEventListener("change", sync);
  }, []);

  // Scroll writes the rail position straight through. Lenis has already eased
  // window.scrollY by the time this fires, so the rail inherits that easing —
  // running a second spring on top of it only added lag.
  useMotionValueEvent(scrollYProgress, "change", (value) => {
    const rail = railRef.current;
    if (!rail || !drivenRef.current) return;
    if (Date.now() < manualUntilRef.current) return;

    const span = (value - DRIVE_FROM) / (DRIVE_TO - DRIVE_FROM);
    const max = Math.max(0, rail.scrollWidth - rail.clientWidth);
    const left = Math.min(1, Math.max(0, span)) * max;

    // The first frame after a manual nudge would otherwise snap the rail back
    // to wherever the page happens to be; ease that one hand-off, then go back
    // to writing directly.
    if (resyncRef.current) {
      resyncRef.current = false;
      rail.scrollTo({ left, behavior: "smooth" });
      return;
    }
    rail.scrollLeft = left;
  });

  const claimManual = useCallback(() => {
    manualUntilRef.current = Date.now() + MANUAL_HOLD_MS;
    resyncRef.current = true;
    setHinted(true);
  }, []);

  const onRailScroll = useCallback(() => {
    const rail = railRef.current;
    if (!rail) return;
    const max = rail.scrollWidth - rail.clientWidth;
    progress.set(max > 0 ? rail.scrollLeft / max : 0);
  }, [progress]);

  /** Tap-to-advance, for the arrows under the rail on touch. */
  const nudge = useCallback(
    (direction: 1 | -1) => {
      const rail = railRef.current;
      if (!rail) return;
      claimManual();
      rail.scrollBy({
        left: direction * Math.round(rail.clientWidth * 0.7),
        behavior: "smooth",
      });
    },
    [claimManual],
  );

  return (
    <section id="portfolio" ref={sectionRef} className="relative md:h-[320svh]">
      <div className="flex flex-col justify-center overflow-hidden py-20 md:sticky md:top-0 md:h-svh md:py-0 md:pb-7 md:pt-20">
        {/* The headline steps down on shorter desktops rather than eating the
            height the cards need — a 13" laptop was left with a rail so short
            the portrait shots became unreadable slivers. */}
        <div className="shrink-0 px-6 md:flex md:items-end md:justify-between md:gap-12 md:px-12">
          <div>
            <p className="eyebrow mb-5">{eyebrow}</p>
            <KineticTitle
              text={title}
              className="display max-w-3xl text-4xl md:text-5xl lg:text-6xl 2xl:text-7xl"
            />
          </div>
          <p className="mt-4 max-w-md text-sm text-muted md:mt-0 md:max-w-xs md:shrink-0 md:text-base">
            {body}
          </p>
        </div>

        <div
          ref={railRef}
          onScroll={onRailScroll}
          onPointerDown={claimManual}
          onTouchStart={claimManual}
          // Only a sideways wheel is the visitor steering; a vertical one over
          // the rail is the page scrolling, which must keep driving.
          onWheel={(event) => {
            if (Math.abs(event.deltaX) > Math.abs(event.deltaY)) claimManual();
          }}
          // `flex-1 min-h-0` is what keeps the pinned column honest: the rail
          // takes whatever height is left over and the cards size to it, so a
          // short laptop shrinks the shots instead of clipping the headline.
          className="no-scrollbar mt-16 flex snap-x snap-mandatory items-center gap-6 overflow-x-auto overscroll-x-contain scroll-pl-6 px-6 pb-4 pt-16 md:mt-6 md:min-h-0 md:flex-1 md:snap-none md:gap-8 md:scroll-pl-12 md:px-12 lg:gap-10"
        >
          {shots.map((shot, i) => (
            <Card
              key={shot.id ?? shot.image_url}
              shot={shot}
              index={i}
              label={t.open(shotTitle(shot))}
              onOpen={() => setOpen(i)}
            />
          ))}

          {/* Closing card: the pitch */}
          <div className="flex min-h-[340px] w-[70vw] max-w-[320px] shrink-0 snap-start items-center justify-center rounded-3xl border border-line bg-bg-elev/50 p-8 backdrop-blur-md md:h-full md:w-[360px] md:max-w-none">
            <div className="text-center">
              <p className="text-2xl font-semibold tracking-tight md:text-3xl">
                <AccentText text={cardTitle} />
              </p>
              <div className="mt-7">
                <CTAButton href={ctaHref}>{ctaLabel}</CTAButton>
              </div>
            </div>
          </div>
          <div className="w-0 shrink-0 md:w-12" aria-hidden />
        </div>

        <div className="mt-8 flex shrink-0 items-center gap-4 px-6 md:mt-6 md:px-12">
          {/* Progress line — read off the rail itself, so it stays honest on
              a swipe as well as on a scroll. */}
          <div className="h-px flex-1 bg-line">
            <motion.div
              style={{ scaleX: progress }}
              className="h-full origin-left bg-accent"
            />
          </div>

          {/* Touch only: desktop steers the rail by scrolling the page. */}
          <div className="flex shrink-0 items-center gap-2 md:hidden">
            <button
              type="button"
              onClick={() => nudge(-1)}
              aria-label={t.prev}
              className="grid size-10 place-items-center rounded-full border border-line text-muted transition-colors duration-300 active:text-fg"
            >
              <ChevronLeft size={17} strokeWidth={1.75} aria-hidden />
            </button>
            <button
              type="button"
              onClick={() => nudge(1)}
              aria-label={t.next}
              className="grid size-10 place-items-center rounded-full border border-line text-muted transition-colors duration-300 active:text-fg"
            >
              <ChevronRight size={17} strokeWidth={1.75} aria-hidden />
            </button>
          </div>
        </div>

        {!hinted && (
          <motion.p
            className="mt-4 px-6 text-xs text-faint md:hidden"
            aria-hidden
            animate={{ opacity: [0.45, 1, 0.45] }}
            transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
          >
            {t.swipe}
          </motion.p>
        )}
      </div>

      <ResultLightbox
        shots={shots}
        index={open}
        onSelect={setOpen}
        onClose={() => setOpen(null)}
        t={t}
      />
    </section>
  );
}
