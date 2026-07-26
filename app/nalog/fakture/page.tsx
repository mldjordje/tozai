import { getSessionUser } from "@/lib/auth/user-session";
import { getInvoices } from "@/lib/account";
import { Card, EmptyState } from "@/components/nalog/ui";
import { formatDate, formatMoney } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function FakturePage() {
  const user = (await getSessionUser())!;
  const invoices = await getInvoices(user.uid);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-fg">Fakture</h1>
        <p className="mt-2 text-muted">
          Faktura se generiše automatski po potvrđenoj uplati.
        </p>
      </div>

      {invoices.length === 0 ? (
        <EmptyState
          title="Još nema faktura."
          hint="Prva faktura stiže odmah nakon prve uplate."
        />
      ) : (
        <Card className="p-0">
          <ul className="divide-y divide-line">
            {invoices.map((inv) => (
              <li key={inv.id} className="flex items-center justify-between gap-4 px-5 py-4">
                <div className="min-w-0">
                  <p className="truncate text-sm text-fg">{inv.number}</p>
                  <p className="text-sm text-faint">{formatDate(inv.created_at)}</p>
                </div>
                <div className="flex shrink-0 items-center gap-4">
                  <span className="text-sm text-muted">
                    {formatMoney(inv.amount, inv.currency)}
                  </span>
                  {inv.pdf_url ? (
                    <a
                      href={inv.pdf_url}
                      className="text-sm text-accent-soft underline underline-offset-4"
                    >
                      Preuzmi PDF
                    </a>
                  ) : (
                    <span className="text-sm text-faint">PDF u pripremi</span>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
