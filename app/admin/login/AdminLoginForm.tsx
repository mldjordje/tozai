"use client";

import { useSearchParams } from "next/navigation";

/**
 * One door: the owner's Google account.
 *
 * The password field that used to sit under this button is gone — see
 * lib/auth/admin-access.ts for why.
 */
export function AdminLoginForm() {
  const params = useSearchParams();
  const error =
    params.get("error") === "access"
      ? "Ovaj Google nalog nema pristup admin panelu."
      : null;
  const next = params.get("next");
  const destination = next?.startsWith("/admin") ? next : "/admin";

  return (
    <div>
      <h1>TOZA AI</h1>
      <p>Admin pristup</p>
      {error && (
        <p className="adm__err" role="alert">
          {error}
        </p>
      )}

      <a
        className="adm-login__google"
        href={`/api/auth/google?next=${encodeURIComponent(destination)}`}
      >
        Nastavi preko Google naloga
      </a>
    </div>
  );
}
