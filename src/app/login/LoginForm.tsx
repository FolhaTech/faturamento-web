"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, senha }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Falha ao entrar.");
        return;
      }
      router.push("/");
      router.refresh();
    } catch {
      setError("Falha de rede ao entrar.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3 rounded-lg border border-neutral-200 bg-white p-5">
      <label className="flex flex-col gap-1 text-xs font-medium text-neutral-500">
        E-mail
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          autoFocus
          className="rounded-md border border-neutral-300 px-3 py-1.5 text-sm text-neutral-900"
        />
      </label>
      <label className="flex flex-col gap-1 text-xs font-medium text-neutral-500">
        Senha
        <input
          type="password"
          value={senha}
          onChange={(e) => setSenha(e.target.value)}
          required
          className="rounded-md border border-neutral-300 px-3 py-1.5 text-sm text-neutral-900"
        />
      </label>

      {error && <p className="text-sm text-red-700">{error}</p>}

      <button
        type="submit"
        disabled={busy}
        className="mt-1 rounded-md bg-emerald-700 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-800 disabled:opacity-50"
      >
        {busy ? "Entrando…" : "Entrar"}
      </button>
    </form>
  );
}
