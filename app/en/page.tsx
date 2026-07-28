import Landing, { landingMetadata } from "@/components/pages/Landing";

// The English home page. Same component, same ISR window, different locale —
// the admin write routes revalidate "/en" alongside "/".
export const revalidate = 60;

export const metadata = landingMetadata("en");

export default function HomeEn() {
  return <Landing locale="en" />;
}
