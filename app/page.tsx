import Landing, { landingMetadata } from "@/components/pages/Landing";

// Pricing AND copy are admin-driven (packages + site_content tables). ISR keeps
// the landing fast; the admin write routes revalidatePath("/") so edits go live
// within a click.
//
// The page itself lives in components/pages/Landing so /en can render the same
// thing in the other language. Serbian keeps the bare path because that is what
// is indexed and shared.
export const revalidate = 60;

export const metadata = landingMetadata("sr");

export default function Home() {
  return <Landing locale="sr" />;
}
