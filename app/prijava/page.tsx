import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionUser, safeNextPath } from "@/lib/auth/user-session";

export const metadata: Metadata = {
  title: "Prijava — TOZA AI",
  robots: { index: false, follow: false },
};

// Google is the only customer login. There is no password to lose, and the
// email is verified by Google, which is what invoicing relies on.
const ERRORS: Record<string, string> = {
  config: "Prijava trenutno nije podešena. Pokušaj kasnije.",
  prijava: "Prijava je prekinuta. Pokušaj ponovo.",
  razmena: "Google nije potvrdio prijavu. Pokušaj ponovo.",
  token: "Prijava nije mogla da se potvrdi. Pokušaj ponovo.",
  email: "Google nalog nema potvrđenu email adresu.",
};

export default async function PrijavaPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; greska?: string }>;
}) {
  const params = await searchParams;
  const next = safeNextPath(params.next);

  const user = await getSessionUser();
  if (user) redirect(next);

  const error = params.greska ? (ERRORS[params.greska] ?? ERRORS.prijava) : null;

  return (
    <main className="flex min-h-screen select-text items-center justify-center bg-bg px-5 py-16">
      <div className="w-full max-w-sm">
        <Link
          href="/"
          className="block text-center text-xl font-semibold tracking-tight text-fg"
        >
          TOZA <span className="text-accent">AI</span>
        </Link>

        <div className="mt-8 rounded-2xl border border-line bg-bg-elev/60 p-7 backdrop-blur-sm">
          <h1 className="text-lg font-semibold tracking-tight text-fg">
            Prijavi se na svoj nalog
          </h1>
          <p className="mt-2 text-sm text-muted">
            Pristup projektima, satima edukacije, porudžbinama i fakturama.
          </p>

          {error && (
            <p
              role="alert"
              className="mt-5 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300"
            >
              {error}
            </p>
          )}

          <a
            href={`/api/auth/google?next=${encodeURIComponent(next)}`}
            className="mt-6 flex w-full items-center justify-center gap-3 rounded-full bg-fg px-5 py-3 text-sm font-medium text-bg transition-opacity duration-200 hover:opacity-90"
          >
            <GoogleMark />
            Nastavi sa Google nalogom
          </a>

          <p className="mt-5 text-center text-xs leading-relaxed text-faint">
            Prijavom prihvataš{" "}
            <Link href="/uslovi" className="underline hover:text-muted">
              Uslove korišćenja
            </Link>{" "}
            i{" "}
            <Link href="/privatnost" className="underline hover:text-muted">
              Politiku privatnosti
            </Link>
            .
          </p>
        </div>

        <p className="mt-6 text-center text-sm text-faint">
          <Link href="/" className="hover:text-muted">
            ← Nazad na sajt
          </Link>
        </p>
      </div>
    </main>
  );
}

function GoogleMark() {
  return (
    <svg width="17" height="17" viewBox="0 0 48 48" aria-hidden focusable="false">
      <path
        fill="#EA4335"
        d="M24 9.5c3.5 0 6.6 1.2 9 3.6l6.7-6.7C35.6 2.6 30.2 0 24 0 14.6 0 6.5 5.4 2.6 13.2l7.8 6.1C12.3 13.2 17.7 9.5 24 9.5z"
      />
      <path
        fill="#4285F4"
        d="M46.9 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.9c-.6 3-2.3 5.5-4.8 7.2l7.5 5.8c4.4-4.1 7.3-10.1 7.3-17.5z"
      />
      <path
        fill="#FBBC05"
        d="M10.4 28.7c-.5-1.5-.8-3-.8-4.7s.3-3.2.8-4.7l-7.8-6.1C1 16.3 0 20 0 24s1 7.7 2.6 10.8l7.8-6.1z"
      />
      <path
        fill="#34A853"
        d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.5-5.8c-2.1 1.4-4.8 2.3-8.4 2.3-6.3 0-11.7-3.7-13.6-9.1l-7.8 6.1C6.5 42.6 14.6 48 24 48z"
      />
    </svg>
  );
}
