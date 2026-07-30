import type { Metadata } from "next";
import LegalPage from "@/components/pages/LegalPage";

export const revalidate = 3600;

export const metadata: Metadata = {
  title: "Uslovi korišćenja — TOZA AI",
  description:
    "Uslovi pod kojima TOZA AI prodaje AI video produkciju i privatnu AI edukaciju.",
  alternates: {
    canonical: "/uslovi",
    languages: { sr: "/uslovi", en: "/en/uslovi" },
  },
};

export default function Uslovi() {
  return <LegalPage locale="sr" document="terms" />;
}
