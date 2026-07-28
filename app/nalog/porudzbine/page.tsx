import Link from "next/link";
import { getSessionUser } from "@/lib/auth/user-session";
import { getOrders } from "@/lib/account";
import { Card, EmptyState, StatusBadge } from "@/components/nalog/ui";
import { ORDER_STATUS_LABEL, formatDate, formatMoney, orderTone } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function PorudzbinePage() {
  const user = (await getSessionUser())!;
  const orders = await getOrders(user.uid);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-fg">Porudžbine</h1>
        <p className="mt-2 text-muted">Istorija svih kupovina na tvom nalogu.</p>
      </div>

      {orders.length === 0 ? (
        <EmptyState
          title="Još nema porudžbina."
          action={
            <Link
              href="/#paketi"
              className="rounded-full bg-accent px-5 py-2.5 text-sm font-medium text-white transition-opacity hover:opacity-90"
            >
              Pogledaj pakete
            </Link>
          }
        />
      ) : (
        <Card className="p-0">
          <ul className="divide-y divide-line">
            {orders.map((o) => (
              <li key={o.id} className="px-5 py-4">
                <div className="flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    <p className="truncate text-sm text-fg">{o.item}</p>
                    <p className="text-sm text-faint">
                      #{o.id} · {formatDate(o.created_at)}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-4">
                    <span className="text-sm text-muted">
                      {formatMoney(o.amount, o.currency)}
                    </span>
                    <StatusBadge
                      label={ORDER_STATUS_LABEL[o.status] ?? o.status}
                      tone={orderTone(o.status)}
                    />
                  </div>
                </div>
                {o.status === "pending" && o.payment_method === "invoice" && (
                  <div className="mt-4 grid gap-2 rounded-xl border border-line bg-bg-elev/40 p-4 text-sm text-muted sm:grid-cols-2">
                    {o.payee_name && <p>Primalac: <span className="text-fg">{o.payee_name}</span></p>}
                    {o.bank_account && <p>Račun: <span className="text-fg">{o.bank_account}</span></p>}
                    {o.payment_reference && <p>Poziv na broj: <span className="text-fg">{o.payment_reference}</span></p>}
                    {o.proforma_id && (
                      <a
                        href={`/api/nalog/fakture/${o.proforma_id}`}
                        className="text-accent-soft underline underline-offset-4 sm:text-right"
                      >
                        Preuzmi {o.proforma_number ?? "predračun"}
                      </a>
                    )}
                  </div>
                )}
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
