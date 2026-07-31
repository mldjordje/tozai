import { ImageResponse } from "next/og";

/** The English link-preview card. Same layout and the same reasoning as the
 *  Serbian one in app/opengraph-image.tsx — read that first. */
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "TOZA AI — AI video production and AI education, Niš, Serbia";

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
            AI video production and private 1-on-1 AI training
          </div>
        </div>
        <div style={{ display: "flex", fontSize: 24, color: "#8a8a8a" }}>
          Svetozar Marković PR TOZA AI · Niš, Serbia · toza-ai.rs
        </div>
      </div>
    ),
    size,
  );
}
