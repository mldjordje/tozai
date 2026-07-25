/**
 * Big outlined text marquee — section divider with motion. Decorative.
 */
export default function TextStrip() {
  const items = "AI VIDEO ✦ VIRAL SADRŽAJ ✦ AI EDUKACIJA ✦ TOZAI ✦ ";
  return (
    <div aria-hidden className="relative select-none overflow-hidden py-6 md:py-10">
      <div className="marquee-track flex w-max whitespace-nowrap [animation-duration:36s]">
        <span className="text-strip">{items.repeat(2)}</span>
        <span className="text-strip">{items.repeat(2)}</span>
      </div>
    </div>
  );
}
