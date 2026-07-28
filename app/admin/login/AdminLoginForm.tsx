"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

export function AdminLoginForm({ passwordEnabled }: { passwordEnabled: boolean }) {
  const router = useRouter();
  const params = useSearchParams();
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(
    params.get("error") === "access" ? "Ovaj Google nalog nema pristup admin panelu." : null,
  );
  const [busy, setBusy] = useState(false);
  const next = params.get("next");
  const destination = next?.startsWith("/admin") ? next : "/admin";

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const data = await response.json();
      if (!response.ok || !data.ok) {
        setError(data.message ?? "Greška pri prijavi.");
        return;
      }
      router.replace(destination);
    } catch {
      setError("Greška u mreži. Pokušaj ponovo.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <h1>TOZA AI</h1>
      <p>Admin pristup</p>
      {error && <p className="adm__err" role="alert">{error}</p>}

      <a
        className="adm-login__google"
        href={`/api/auth/google?next=${encodeURIComponent(destination)}`}
      >
        Nastavi preko Google naloga
      </a>

      {passwordEnabled && (
        <>
          <div className="adm-login__or" aria-hidden="true">ili privremeno</div>
          <form onSubmit={submit}>
            <input
              type="password"
              autoComplete="current-password"
              placeholder="Lozinka"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
            <button type="submit" disabled={busy || !password}>
              {busy ? "..." : "Prijavi se lozinkom"}
            </button>
          </form>
        </>
      )}
    </div>
  );
}
