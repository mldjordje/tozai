import { ImageResponse } from "next/og";

/**
 * The picture every shared link renders with.
 *
 * It used to be the first shot of the proof rail — a screenshot of an Instagram
 * profile with its follower count. That is the single most recognisable visual
 * of a get-rich-quick advert, and it was the first thing an automated reviewer
 * saw of this domain, above copy that had already been rewritten to avoid
 * exactly that reading. The screenshots still sit on the page, in context,
 * under a line saying past results do not guarantee future performance; they no
 * longer stand alone as the advert for the site.
 *
 * Drawn rather than shipped as a file so there is no second asset to keep in
 * sync with the brand, and no follower count baked into a PNG nobody re-opens.
 * Deliberately plain: who we are, what we make, where we are registered.
 */
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "TOZA AI — AI video produkcija i AI edukacija, Niš, Srbija";

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: "#0b0b0b",
          color: "#f5f5f5",
          padding: "72px 80px",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", fontSize: 26, letterSpacing: 6, color: "#8a8a8a" }}>
          AI VIDEO STUDIO
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          <div style={{ display: "flex", fontSize: 104, fontWeight: 600, letterSpacing: -3 }}>
            TOZA AI
          </div>
          <div style={{ display: "flex", fontSize: 40, color: "#c9c9c9", lineHeight: 1.3 }}>
            AI video produkcija i privatna 1-na-1 AI edukacija
          </div>
        </div>
        <div style={{ display: "flex", fontSize: 24, color: "#8a8a8a" }}>
          Svetozar Marković PR TOZA AI · Niš, Srbija · toza-ai.rs
        </div>
      </div>
    ),
    size,
  );
}
