import InquiryPage, { inquiryMetadata } from "@/components/pages/InquiryPage";

export const dynamic = "force-dynamic";

export const metadata = inquiryMetadata("sr");

export default function Upit() {
  return <InquiryPage locale="sr" />;
}
