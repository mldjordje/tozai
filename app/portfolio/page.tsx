import PortfolioPage, { portfolioMetadata } from "@/components/pages/PortfolioPage";

// Admin writes revalidatePath("/portfolio"), so a newly published Short is live
// on the next request rather than after the window expires.
export const revalidate = 300;

export const metadata = portfolioMetadata("sr");

export default function Portfolio() {
  return <PortfolioPage locale="sr" />;
}
