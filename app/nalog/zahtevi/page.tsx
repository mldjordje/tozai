import VideoRequests from "@/components/nalog/VideoRequests";

export const dynamic = "force-dynamic";

export default function ZahteviPage() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-fg">Upiti i procene</h1>
        <p className="mt-2 text-muted">
          Ovde vidiš poslati brief, privatnu cenu i sledeći korak.
        </p>
      </div>
      <VideoRequests />
    </div>
  );
}
