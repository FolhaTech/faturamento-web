"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function PlrConfigForm({ valorInicial }: { valorInicial: number }) {
  const router = useRouter();
  const [valor, setValor] = useState(String(valorInicial));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState(false);

  async function salvar() {
    setError(null);
    setOk(false);
    const num = Number(valor.replace(",", "."));
    if (!Number.isFinite(num) || num < 0) return setError("Valor inválido.");

    setBusy(true);
    try {
      const res = await fetch("/api/configuracoes/plr", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ valor: num }),
      });
      const data = await res.json();
      if (!res.ok) return setError(data.error ?? "Falha ao salvar.");
      setOk(true);
      router.refresh();
    } catch {
      setError("Falha de rede ao salvar.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-wrap items-end gap-3 rounded-lg border border-neutral-200 bg-white p-4">
      <label className="flex flex-col gap-1 text-xs font-medium text-neutral-500">
        PLR por colaborador celetista
        <input
          value={valor}
          onChange={(e) => setValor(e.target.value)}
          className="w-32 rounded-md border border-neutral-300 px-3 py-1.5 text-sm font-mono"
        />
      </label>
      <button
        type="button"
        onClick={salvar}
        disabled={busy}
        className="rounded-md border border-neutral-300 bg-white px-4 py-1.5 text-sm font-medium hover:bg-neutral-50 disabled:opacity-50"
      >
        {busy ? "Salvando…" : "Salvar"}
      </button>
      <p className="text-xs text-neutral-400">
        Lançado automaticamente na fatura de todo colaborador celetista, todo mês, até esse valor ser alterado.
      </p>
      {error && <p className="w-full text-sm text-red-700">{error}</p>}
      {ok && <p className="w-full text-sm text-emerald-700">Valor salvo — a fatura já recalcula com o novo PLR.</p>}
    </div>
  );
}
