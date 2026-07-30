import type { Metadata } from "next";
import LegalPage from "@/components/pages/LegalPage";

// The identity block is read from studio_settings, which the owner edits in
// /admin/podesavanja — so the page follows a corrected PIB without a deploy.
export const revalidate = 3600;

export const metadata: Metadata = {
  title: "Politika privatnosti — TOZA AI",
  description:
    "Šta TOZA AI prikuplja, zašto, koliko dugo čuva i koja su tvoja prava.",
  alternates: {
    canonical: "/privatnost",
    languages: { sr: "/privatnost", en: "/en/privatnost" },
  },
};

export default function Privatnost() {
  return <LegalPage locale="sr" document="privacy" />;
}
