import type { Metadata, Viewport } from "next";
import { Inter, Instrument_Serif } from "next/font/google";
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
  title: "TOZAI — Build Your Business With AI",
  description:
    "Kreiramo AI video reklame i pružamo privatnu AI edukaciju. Pametnije. Brže. Profitabilnije.",
  metadataBase: new URL("https://toza-ai.rs"),
  icons: {
    icon: "/media/tozai-mark.svg",
  },
  openGraph: {
    title: "TOZAI — Build Your Business With AI",
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
      </body>
    </html>
  );
}
