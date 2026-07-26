import Link from "next/link";
import { getSessionUser } from "@/lib/auth/user-session";
import { getProjects } from "@/lib/account";
import { EmptyState, StatusBadge } from "@/components/nalog/ui";
import { PROJECT_STATUS_LABEL, formatDate, formatDay, projectTone } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function ProjektiPage() {
  const user = (await getSessionUser())!;
  const projects = await getProjects(user.uid);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-fg">Projekti</h1>
        <p className="mt-2 text-muted">Svaki naručeni AI video paket i njegov status.</p>
      </div>

      {projects.length === 0 ? (
        <EmptyState
          title="Još nemaš nijedan projekat."
          hint="Kad naručiš paket, projekat se otvara ovde odmah po uplati."
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
        <div className="space-y-3">
          {projects.map((p) => (
            <Link
              key={p.id}
              href={`/nalog/projekti/${p.id}`}
              className="block rounded-2xl border border-line bg-bg-elev/60 p-5 transition-colors hover:border-accent-soft/40"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <p className="truncate font-medium text-fg">{p.title}</p>
                  <p className="mt-1 text-sm text-faint">
                    Naručeno {formatDate(p.created_at)}
                    {p.due_date ? ` · rok ${formatDay(p.due_date)}` : ""}
                  </p>
                </div>
                <StatusBadge
                  label={PROJECT_STATUS_LABEL[p.status] ?? p.status}
                  tone={projectTone(p.status)}
                />
              </div>
              {p.status === "onboarding" && !p.materials_method && (
                <p className="mt-3 text-sm text-accent-soft">
                  Dodaj materijale da krenemo →
                </p>
              )}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
