import type { Metadata } from "next";
import LegalPage from "@/components/pages/LegalPage";

export const revalidate = 3600;

export const metadata: Metadata = {
  title: "Terms of Service — TOZA AI",
  description:
    "The terms under which TOZA AI sells AI video production and private AI training.",
  alternates: {
    canonical: "/en/uslovi",
    languages: { sr: "/uslovi", en: "/en/uslovi" },
  },
};

export default function Terms() {
  return <LegalPage locale="en" document="terms" />;
}
