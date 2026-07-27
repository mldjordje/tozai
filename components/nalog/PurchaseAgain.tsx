import Link from "next/link";
import { Card } from "@/components/nalog/ui";

type PurchasePackage = {
  id: number;
  name: string;
  price: number | null;
  currency: string;
  slug: string | null;
};

function PurchaseGroup({
  title,
  description,
  packages,
  fallbackHref,
  fallbackLabel,
}: {
  title: string;
  description: string;
  packages: PurchasePackage[];
  fallbackHref: string;
  fallbackLabel: string;
}) {
  return (
    <Card className="flex h-full flex-col">
      <h3 className="font-medium text-fg">{title}</h3>
      <p className="mt-2 text-sm leading-relaxed text-muted">{description}</p>
      {packages.length > 0 ? (
        <div className="mt-5 space-y-2 border-t border-line pt-4">
          {packages.map((pkg) => (
            <Link
              key={pkg.id}
              href={`/porudzbina/${pkg.slug}`}
              className="flex items-center justify-between gap-4 rounded-xl px-3 py-2.5 text-sm transition-colors hover:bg-line/50"
            >
              <span className="text-fg">{pkg.name}</span>
              <span className="shrink-0 text-accent-soft">
                {pkg.price == null
                  ? "Pošalji upit →"
                  : `${pkg.price.toLocaleString("sr-RS")} ${pkg.currency} →`}
              </span>
            </Link>
          ))}
        </div>
      ) : (
        <Link
          href={fallbackHref}
          className="mt-5 inline-flex w-fit rounded-full border border-line px-4 py-2 text-sm text-fg transition-colors hover:border-accent-soft"
        >
          {fallbackLabel}
        </Link>
      )}
    </Card>
  );
}

export default function PurchaseAgain({
  videoPackages,
  educationPackages,
  isNew = false,
}: {
  videoPackages: PurchasePackage[];
  educationPackages: PurchasePackage[];
  isNew?: boolean;
}) {
  return (
    <section id="kupi" className="scroll-mt-8">
      <div className="mb-4 flex items-center justify-between gap-4">
        <h2 className="text-lg font-semibold text-fg">
          {isNew ? "Izaberi uslugu" : "Kupi ponovo"}
        </h2>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <PurchaseGroup
          title="AI UGC i video klipovi"
          description="Pošalji novi brief i dobićeš zasebnu procenu za novi paket klipova."
          packages={videoPackages}
          fallbackHref="/#paketi"
          fallbackLabel="Pogledaj AI video pakete"
        />
        <PurchaseGroup
          title="1-na-1 edukacija"
          description="Dopuni wallet novim satima i koristi ih kad ti odgovara."
          packages={educationPackages}
          fallbackHref="/#edukacija"
          fallbackLabel="Pogledaj pakete edukacije"
        />
      </div>
    </section>
  );
}
