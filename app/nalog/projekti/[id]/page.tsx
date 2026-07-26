import Link from "next/link";
import { notFound } from "next/navigation";
import { getSessionUser } from "@/lib/auth/user-session";
import { getProjectDetail } from "@/lib/account";
import { Card, SectionTitle, StatusBadge } from "@/components/nalog/ui";
import {
  PROJECT_STATUS_FLOW,
  PROJECT_STATUS_LABEL,
  formatDate,
  formatDay,
  projectTone,
} from "@/lib/format";
import MaterialsForm from "@/components/nalog/MaterialsForm";

export const dynamic = "force-dynamic";

// Labels for the brief keys the onboarding form writes into projects.brief.
const BRIEF_LABEL: Record<string, string> = {
  idea: "Ideja za klipove",
  biznis: "Biznis / brend",
  o_biznisu: "Kratko o biznisu",
  broj_klipova: "Broj klipova",
  opis: "Opis projekta",
  publika: "Ciljna publika",
  ton: "Ton i stil",
  reference: "Referentni linkovi",
  materijali: "Materijali",
  kontakt: "Kontakt za materijale",
};

export default async function ProjekatPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const projectId = Number(id);
  if (!Number.isInteger(projectId)) notFound();

  const user = (await getSessionUser())!;
  const project = await getProjectDetail(user.uid, projectId);
  if (!project) notFound();

  const currentStep = PROJECT_STATUS_FLOW.indexOf(
    project.status as (typeof PROJECT_STATUS_FLOW)[number],
  );

  return (
    <div className="space-y-10">
      <div>
        <Link
          href="/nalog/projekti"
          className="text-sm text-faint transition-colors hover:text-muted"
        >
          ← Projekti
        </Link>
        <div className="mt-3 flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-fg">
              {project.title}
            </h1>
            <p className="mt-2 text-muted">
              {project.package_name ? `${project.package_name} · ` : ""}
              naručeno {formatDate(project.created_at)}
              {project.due_date ? ` · rok ${formatDay(project.due_date)}` : ""}
            </p>
          </div>
          <StatusBadge
            label={PROJECT_STATUS_LABEL[project.status] ?? project.status}
            tone={projectTone(project.status)}
          />
        </div>
      </div>

      {/* Progress rail */}
      <ol className="grid gap-3 sm:grid-cols-4">
        {PROJECT_STATUS_FLOW.map((step, i) => {
          const done = currentStep >= 0 && i < currentStep;
          const active = i === currentStep;
          return (
            <li
              key={step}
              className={`rounded-xl border px-4 py-3 ${
                active
                  ? "border-accent/50 bg-accent/10"
                  : done
                    ? "border-line bg-bg-elev/60"
                    : "border-dashed border-line"
              }`}
            >
              <p className="text-xs uppercase tracking-[0.14em] text-faint">
                Korak {i + 1}
              </p>
              <p
                className={`mt-1 text-sm ${active || done ? "text-fg" : "text-faint"}`}
              >
                {PROJECT_STATUS_LABEL[step]}
              </p>
            </li>
          );
        })}
      </ol>

      {project.status === "onboarding" && !project.materials_method && (
        <Card className="border-accent/30 bg-accent/5">
          <p className="font-medium text-fg">Dodaj materijale za izradu</p>
          <p className="mt-2 text-sm text-muted">
            Ideju već imamo iz upita. Sada izaberi kako želiš da nam predaš
            fajlove, pa projekat odmah prelazi u izradu.
          </p>
          <div className="mt-6">
            <MaterialsForm projectId={project.id} />
          </div>
        </Card>
      )}

      {project.materials_method && (
        <Card>
          <p className="text-xs uppercase tracking-[0.14em] text-faint">Materijali</p>
          <p className="mt-2 text-sm text-fg">
            {project.materials_method === "wetransfer"
              ? "WeTransfer link je primljen."
              : "WhatsApp kontakt je primljen."}
          </p>
        </Card>
      )}

      {project.brief && (
        <section>
          <SectionTitle title="Brief" />
          <Card>
            <dl className="space-y-4">
              {Object.entries(project.brief).map(([key, value]) => (
                <div key={key}>
                  <dt className="text-xs uppercase tracking-[0.14em] text-faint">
                    {BRIEF_LABEL[key] ?? key}
                  </dt>
                  <dd className="mt-1 whitespace-pre-line text-sm text-fg">
                    {String(value)}
                  </dd>
                </div>
              ))}
            </dl>
          </Card>
        </section>
      )}

      <section>
        <SectionTitle title="Isporuke" />
        {project.deliverables.length === 0 ? (
          <Card>
            <p className="text-sm text-muted">
              Još nema isporučenih materijala. Sve što završimo pojavljuje se ovde.
            </p>
          </Card>
        ) : (
          <Card className="p-0">
            <ul className="divide-y divide-line">
              {project.deliverables.map((d) => (
                <li key={d.id} className="flex items-center justify-between gap-4 px-5 py-4">
                  <div className="min-w-0">
                    <p className="truncate text-sm text-fg">{d.title}</p>
                    <p className="text-sm text-faint">{formatDate(d.created_at)}</p>
                  </div>
                  <a
                    href={d.url}
                    target="_blank"
                    rel="noreferrer"
                    className="shrink-0 text-sm text-accent-soft underline underline-offset-4"
                  >
                    Otvori
                  </a>
                </li>
              ))}
            </ul>
          </Card>
        )}
        <p className="mt-3 text-sm text-faint">
          Preostalo revizija: {project.revisions_left}
        </p>
      </section>

      <section>
        <SectionTitle title="Istorija" />
        {project.updates.length === 0 ? (
          <Card>
            <p className="text-sm text-muted">Nema zabeleženih promena.</p>
          </Card>
        ) : (
          <ol className="space-y-3">
            {project.updates.map((u) => (
              <li key={u.id} className="flex gap-4">
                <span className="mt-2 size-1.5 shrink-0 rounded-full bg-accent" />
                <div className="min-w-0 flex-1 border-b border-line pb-3">
                  <p className="text-sm text-fg">
                    {u.status
                      ? (PROJECT_STATUS_LABEL[u.status] ?? u.status)
                      : "Napomena"}
                  </p>
                  {u.note && <p className="mt-1 text-sm text-muted">{u.note}</p>}
                  <p className="mt-1 text-xs text-faint">{formatDate(u.created_at)}</p>
                </div>
              </li>
            ))}
          </ol>
        )}
      </section>
    </div>
  );
}
