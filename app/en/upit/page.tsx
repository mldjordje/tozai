import InquiryPage, { inquiryMetadata } from "@/components/pages/InquiryPage";

export const dynamic = "force-dynamic";

export const metadata = inquiryMetadata("en");

export default function UpitEn() {
  return <InquiryPage locale="en" />;
}
