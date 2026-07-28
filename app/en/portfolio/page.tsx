import PortfolioPage, { portfolioMetadata } from "@/components/pages/PortfolioPage";

export const revalidate = 300;

export const metadata = portfolioMetadata("en");

export default function PortfolioEn() {
  return <PortfolioPage locale="en" />;
}
