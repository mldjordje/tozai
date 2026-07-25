import Image from "next/image";

/**
 * Proof gallery — client-run AI personas with real audience numbers.
 * Mobile: native horizontal scroll with snap (thumb-driven).
 * Desktop: infinite CSS marquee (track duplicated), pauses on hover,
 * cards slightly tilted and straightening on hover.
 */
const SHOTS = [
  {
    src: "/media/results/ig-toza.png",
    alt: "toza.aii — Instagram profil, 187K pratilaca, verifikovan",
    handle: "toza.aii",
    stat: "187K pratilaca · Instagram",
    wide: true,
  },
  {
    src: "/media/results/tt-toza.png",
    alt: "Toza Ai — TikTok profil, 69.5K pratilaca, 609K lajkova",
    handle: "@tozaai",
    stat: "69.5K pratilaca · 609K lajkova",
    wide: false,
  },
  {
    src: "/media/rezultati.png",
    alt: "TikTok Insights — desetine hiljada lajkova po objavi",
    handle: "TikTok Insights",
    stat: "43K+ lajkova po objavi",
    wide: false,
  },
  {
    src: "/media/results/tt-darija.png",
    alt: "Darija Ai — TikTok profil, 22.1K pratilaca, 753K lajkova",
    handle: "@darijaaai",
    stat: "22.1K pratilaca · 753K lajkova",
    wide: false,
  },
  {
    src: "/media/results/ig-kaja.png",
    alt: "Kaja Sretic — Instagram AI profil, 12.3K pratilaca",
    handle: "kajasretic",
    stat: "12.3K pratilaca · Instagram",
    wide: true,
  },
  {
    src: "/media/results/tt-kajina.png",
    alt: "kajina.perspektiva — TikTok profil, 15.3K pratilaca, 183K lajkova",
    handle: "kajina.perspektiva",
    stat: "15.3K pratilaca · 183K lajkova",
    wide: false,
  },
];

function Card({ shot, tilt = 0 }: { shot: (typeof SHOTS)[number]; tilt?: number }) {
  return (
    <figure
      className={`group relative shrink-0 snap-center overflow-hidden rounded-2xl border border-line bg-bg-elev/60 shadow-xl shadow-black/50 backdrop-blur-sm transition-transform duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] hover:-translate-y-2 hover:rotate-0 md:mr-6 ${
        shot.wide ? "w-[280px] md:w-[320px]" : "w-[220px] md:w-[240px]"
      } ${tilt > 0 ? "md:rotate-[1.5deg]" : tilt < 0 ? "md:rotate-[-1.5deg]" : ""}`}
    >
      <Image
        src={shot.src}
        alt={shot.alt}
        width={shot.wide ? 1358 : 853}
        height={shot.wide ? 1158 : 1846}
        className="h-auto w-full"
        sizes="320px"
      />
      <figcaption className="border-t border-line px-4 py-3">
        <div className="text-sm font-semibold">{shot.handle}</div>
        <div className="mt-0.5 text-xs text-muted">{shot.stat}</div>
      </figcaption>
    </figure>
  );
}

export default function ResultsMarquee() {
  return (
    <>
      {/* Mobile: swipe-through gallery, edges peek so scrollability is obvious */}
      <div className="no-scrollbar mt-10 flex w-full snap-x snap-mandatory gap-4 overflow-x-auto px-6 pb-4 md:hidden">
        {SHOTS.map((shot) => (
          <Card key={shot.src} shot={shot} />
        ))}
        <div className="w-2 shrink-0" aria-hidden />
      </div>

      {/* Desktop: infinite marquee */}
      <div className="marquee-mask relative mt-14 hidden w-full overflow-hidden md:block">
        <div className="marquee-track flex w-max items-start">
          {[...SHOTS, ...SHOTS].map((shot, i) => (
            <Card key={`${shot.src}-${i}`} shot={shot} tilt={i % 2 === 0 ? 1 : -1} />
          ))}
        </div>
      </div>
    </>
  );
}
