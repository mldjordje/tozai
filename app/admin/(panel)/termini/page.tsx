import { Suspense } from "react";
import { TerminiTab } from "../../TerminiTab";

// The tab reads ?kalendar= to report how the Google consent round trip went,
// which opts it out of prerendering unless it sits behind a boundary.
export default function TerminiPage() {
  return (
    <Suspense fallback={<p className="adm__empty">Učitavanje…</p>}>
      <TerminiTab />
    </Suspense>
  );
}
