"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setError(data.message ?? "Greška pri prijavi.");
        return;
      }
      const next = params.get("next");
      router.replace(next && next.startsWith("/admin") ? next : "/admin");
    } catch {
      setError("Greška u mreži. Pokušaj ponovo.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit}>
      <h1>TOZA AI</h1>
      <p>Admin pristup</p>
      {error && <p className="adm__err" role="alert">{error}</p>}
      <input
        type="password"
        autoComplete="current-password"
        placeholder="Lozinka"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        autoFocus
      />
      <button type="submit" disabled={busy || !password}>
        {busy ? "..." : "Prijavi se"}
      </button>
      {/* Google login for the team lands once the client buys the domain and
          OAuth is configured. Shown disabled so the door is visibly "coming". */}
      <div className="adm-login__or" aria-hidden="true">uskoro</div>
      <button type="button" className="adm-login__google" disabled title="Dostupno kad se zakupi domen">
        Prijava preko Google (uskoro)
      </button>
    </form>
  );
}

export default function AdminLoginPage() {
  return (
    <div className="adm-login">
      <Suspense fallback={null}>
        <LoginForm />
      </Suspense>
    </div>
  );
}
