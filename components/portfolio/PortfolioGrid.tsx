"use client";

import { useEffect, useState } from "react";
import { Play, X } from "lucide-react";
import { embedUrl, posterCandidates } from "@/lib/youtube";
import { DEFAULT_LOCALE, type Locale } from "@/lib/i18n/config";
import { ui } from "@/lib/i18n/ui";

/**
 * Portfolio grid of published Shorts.
 *
 * The player is a façade: what sits in the grid is our own 9:16 card with our
 * poster and our play button, and the YouTube iframe is only created once the
 * visitor asks to watch. That keeps the page free of YouTube's chrome — and of
 * its network requests — until it is actually wanted, and it means twenty
 * works cost twenty images instead of twenty embedded players.
 *
 * What cannot be removed: once playing, the video title and the "Watch on
 * YouTube" affordance belong to the iframe. A public embed offers no parameter
 * to hide them, and covering them over is against YouTube's terms. The frame,
 * the poster and the play state are ours; the player chrome is theirs.
 */

type Work = {
  id: number;
  category_id: number | null;
  title: string;
  client: string | null;
  media_url: string;
  media_type: string;
  youtube_id: string | null;
  poster_url: string | null;
  description: string | null;
};

type Category = { id: number; name: string; slug: string };

/** YouTube's "no such still" placeholder is 120x90. Anything that small is not
 *  a real thumbnail. */
const PLACEHOLDER_WIDTH = 120;

/** Poster with a fallback chain: YouTube does not generate every still for
 *  every video, and a broken image is worse than a 16:9 one. */
function Poster({ work }: { work: Work }) {
  const own = work.poster_url?.trim();
  // The studio's own poster is authoritative; the YouTube stills are only tried
  // when there is none. Exhausting the chain falls through to a plain panel
  // rather than a broken-image icon.
  const chain = own ? [own] : work.youtube_id ? posterCandidates(work.youtube_id) : [];
  const [index, setIndex] = useState(0);
  const src = chain[index];

  if (!src) {
    return <div className="h-full w-full bg-bg-elev" aria-hidden />;
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt=""
      loading="lazy"
      decoding="async"
      onError={() => setIndex((i) => i + 1)}
      onLoad={(e) => {
        // A missing YouTube still is not a 404 — the CDN answers 200 with a
        // grey 120x90 placeholder, so onError never fires and the card would
        // render that placeholder stretched across the frame. Size is the only
        // signal that the still does not exist.
        if (!own && e.currentTarget.naturalWidth <= PLACEHOLDER_WIDTH) setIndex((i) => i + 1);
      }}
      className="h-full w-full object-cover transition-transform duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:scale-[1.05]"
    />
  );
}

export default function PortfolioGrid({
  works,
  categories,
  locale = DEFAULT_LOCALE,
}: {
  works: Work[];
  categories: Category[];
  locale?: Locale;
}) {
  const t = ui(locale).portfolio;
  const [filter, setFilter] = useState<number | null>(null);
  const [open, setOpen] = useState<Work | null>(null);

  const visible = filter === null ? works : works.filter((w) => w.category_id === filter);

  // Escape closes the player, and the page behind it must not scroll while it
  // is open — a lightbox that leaves the body scrolling reads as broken.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(null);
    window.addEventListener("keydown", onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = previous;
    };
  }, [open]);

  if (works.length === 0) {
    return (
      <p className="text-muted">
        {t.empty}
      </p>
    );
  }

  return (
    <>
      {categories.length > 1 && (
        <div className="mb-12 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => setFilter(null)}
            aria-pressed={filter === null}
            className={`rounded-full border px-4 py-2 text-sm transition-colors duration-300 ${
              filter === null
                ? "border-accent bg-accent/10 text-fg"
                : "border-line text-muted hover:border-accent-soft hover:text-fg"
            }`}
          >
            {t.all}
          </button>
          {categories.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => setFilter(c.id)}
              aria-pressed={filter === c.id}
              className={`rounded-full border px-4 py-2 text-sm transition-colors duration-300 ${
                filter === c.id
                  ? "border-accent bg-accent/10 text-fg"
                  : "border-line text-muted hover:border-accent-soft hover:text-fg"
              }`}
            >
              {c.name}
            </button>
          ))}
        </div>
      )}

      <div className="grid grid-cols-2 gap-5 md:grid-cols-3 lg:grid-cols-4">
        {visible.map((work) => (
          <button
            key={work.id}
            type="button"
            onClick={() => setOpen(work)}
            className="group text-left"
            aria-label={`Pusti: ${work.title}`}
          >
            <div className="relative aspect-[9/16] overflow-hidden rounded-2xl border border-line bg-bg-elev shadow-2xl shadow-black/50">
              {work.media_type === "youtube" ? (
                <Poster work={work} />
              ) : work.media_type === "video" ? (
                // eslint-disable-next-line jsx-a11y/media-has-caption
                <video
                  src={work.media_url}
                  poster={work.poster_url ?? undefined}
                  muted
                  playsInline
                  preload="metadata"
                  className="h-full w-full object-cover"
                />
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={work.media_url} alt="" loading="lazy" className="h-full w-full object-cover" />
              )}

              <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/85 via-transparent to-transparent" />
              <div className="pointer-events-none absolute inset-0 grid place-items-center">
                <span className="grid h-14 w-14 place-items-center rounded-full border border-white/25 bg-black/45 backdrop-blur-md transition-transform duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:scale-110">
                  <Play size={20} className="translate-x-[1px] fill-white text-white" />
                </span>
              </div>
              <div className="pointer-events-none absolute inset-x-0 bottom-0 p-4">
                <div className="truncate text-sm font-semibold text-white">{work.title}</div>
                {work.client && <div className="truncate text-xs text-white/65">{work.client}</div>}
              </div>
            </div>
          </button>
        ))}
      </div>

      {open && (
        <div
          className="fixed inset-0 z-[100] grid place-items-center bg-black/90 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-label={open.title}
          onClick={(e) => e.target === e.currentTarget && setOpen(null)}
        >
          <button
            type="button"
            onClick={() => setOpen(null)}
            aria-label={t.back}
            className="absolute right-5 top-5 grid h-11 w-11 place-items-center rounded-full border border-white/20 text-white/80 transition-colors duration-300 hover:border-white/50 hover:text-white"
          >
            <X size={18} />
          </button>

          <div className="w-full max-w-[min(420px,calc((100svh-8rem)*0.5625))]">
            <div className="relative aspect-[9/16] overflow-hidden rounded-2xl border border-line bg-black">
              {open.media_type === "youtube" && open.youtube_id ? (
                <iframe
                  src={embedUrl(open.youtube_id)}
                  title={open.title}
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                  referrerPolicy="strict-origin-when-cross-origin"
                  allowFullScreen
                  className="h-full w-full"
                />
              ) : open.media_type === "video" ? (
                // eslint-disable-next-line jsx-a11y/media-has-caption
                <video
                  src={open.media_url}
                  poster={open.poster_url ?? undefined}
                  controls
                  autoPlay
                  playsInline
                  className="h-full w-full object-contain"
                />
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={open.media_url} alt={open.title} className="h-full w-full object-contain" />
              )}
            </div>
            <div className="mt-4">
              <h2 className="text-lg font-semibold text-fg">{open.title}</h2>
              {open.client && <p className="text-sm text-muted">{open.client}</p>}
              {open.description && (
                <p className="mt-2 text-sm leading-relaxed text-muted">{open.description}</p>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
