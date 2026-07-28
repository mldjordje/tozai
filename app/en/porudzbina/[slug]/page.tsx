import type { Metadata } from "next";
import CheckoutPage from "@/components/pages/CheckoutPage";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Order — TOZA AI",
  robots: { index: false, follow: false },
};

export default async function CheckoutEn({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  return <CheckoutPage slug={slug} locale="en" />;
}
