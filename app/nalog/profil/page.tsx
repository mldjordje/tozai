import { notFound } from "next/navigation";
import { getSessionUser } from "@/lib/auth/user-session";
import { getProfile } from "@/lib/account";
import ProfileForm from "@/components/nalog/ProfileForm";

export const dynamic = "force-dynamic";

export default async function ProfilPage() {
  const user = (await getSessionUser())!;
  const profile = await getProfile(user.uid);
  if (!profile) notFound();

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-fg">Profil</h1>
        <p className="mt-2 text-muted">Podaci koji se koriste pri kupovini i naplati.</p>
      </div>

      <ProfileForm profile={profile} />

      <div className="border-t border-line pt-6">
        <a
          href="/api/auth/logout"
          className="text-sm text-faint transition-colors hover:text-fg"
        >
          Odjavi se sa naloga
        </a>
      </div>
    </div>
  );
}
