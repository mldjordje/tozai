import type { Metadata, Viewport } from "next";
import { Inter, Instrument_Serif } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import SmoothScroll from "@/components/providers/SmoothScroll";
import "./globals.css";

const inter = Inter({
  subsets: ["latin", "latin-ext"],
  variable: "--font-inter",
  display: "swap",
});

// Editorial display face for headlines. Ships one weight (400) by design —
// never apply a bold utility to it or the browser synthesises the weight.
const instrumentSerif = Instrument_Serif({
  weight: "400",
  style: ["normal", "italic"],
  subsets: ["latin", "latin-ext"],
  variable: "--font-instrument",
  display: "swap",
});

export const metadata: Metadata = {
  title: "TOZA AI — Build Your Business With AI",
  description:
    "Kreiramo AI video reklame i pružamo privatnu AI edukaciju. Pametnije. Brže. Profitabilnije.",
  metadataBase: new URL("https://toza-ai.rs"),
  // No `icons` here on purpose: app/icon.svg is the file convention, which Next
  // fingerprints and links itself. A config-based `icons` entry replaces that
  // generated link with an unhashed /icon.svg, so a browser that cached the old
  // favicon keeps showing it — the tab icon is the one asset users have already
  // cached and will not re-request without a new URL.
  openGraph: {
    title: "TOZA AI — Build Your Business With AI",
    description:
      "AI video reklame i privatna AI edukacija. Pametnije. Brže. Profitabilnije.",
    type: "website",
    locale: "sr_RS",
  },
};

export const viewport: Viewport = {
  themeColor: "#0b0b0b",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="sr" className={`${inter.variable} ${instrumentSerif.variable}`}>
      <body>
        <SmoothScroll>{children}</SmoothScroll>
        {/* Vercel Web Analytics. The script only loads on Vercel deployments —
            locally it no-ops — and it still needs Analytics switched on for the
            project in the dashboard (the adspire.rs team, not web.wise018). */}
        <Analytics />
      </body>
    </html>
  );
}
