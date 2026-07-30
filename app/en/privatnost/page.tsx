import type { Metadata } from "next";
import LegalPage from "@/components/pages/LegalPage";

export const revalidate = 3600;

export const metadata: Metadata = {
  title: "Privacy Policy — TOZA AI",
  description:
    "What TOZA AI collects, why, how long it is kept and what your rights are.",
  alternates: {
    canonical: "/en/privatnost",
    languages: { sr: "/privatnost", en: "/en/privatnost" },
  },
};

export default function Privacy() {
  return <LegalPage locale="en" document="privacy" />;
}
