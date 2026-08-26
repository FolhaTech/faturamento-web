"use client";

import { useState } from "react";

const currency = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

export function SaldoFeriasCard({ matricula, saldoInicial }: { matricula: number; saldoInicial: number }) {
  const [valor, setValor] = useState(String(saldoInicial));
  const [salvo, setSalvo] = useState(saldoInicial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState(false);

  async function salvar() {
    setError(null);
    setOk(false);
    const saldoFerias = Number(valor.replace(",", "."));
    if (!Number.isFinite(saldoFerias)) return setError("Valor inválido.");

    setBusy(true);
    try {
      const res = await fetch(`/api/colaboradores/${matricula}/saldo-ferias`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ saldoFerias }),
      });
      const data = await res.json();
      if (!res.ok) return setError(data.error ?? "Falha ao salvar.");
      setSalvo(saldoFerias);
      setOk(true);
    } catch {
      setError("Falha de rede ao salvar.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-neutral-200 bg-white p-4">
      <h2 className="text-sm font-semibold text-neutral-900">Saldo de férias e 1/3</h2>
      <p className="text-xs text-neutral-500">
        Valor já provisionado/cobrado do tomador ao longo dos meses. Quando um lançamento real de férias/1/3 aparecer na
        folha (código marcado como &quot;Abate saldo férias&quot; em Encargos), esse saldo é abatido automaticamente do
        valor cobrado, em vez de cobrar o valor cheio de novo.
      </p>
      <div className="flex items-end gap-3">
        <label className="flex flex-col gap-1 text-xs font-medium text-neutral-500">
          Saldo atual
          <input
            value={valor}
            onChange={(e) => setValor(e.target.value)}
            className="w-40 rounded-md border border-neutral-300 px-3 py-1.5 text-sm font-mono"
          />
        </label>
        <button
          type="button"
          onClick={salvar}
          disabled={busy}
          className="rounded-md bg-emerald-700 px-4 py-1.5 text-sm font-medium text-white hover:bg-emerald-800 disabled:opacity-50"
        >
          {busy ? "Salvando…" : "Salvar"}
        </button>
        <span className="text-xs text-neutral-400">Salvo: {currency.format(salvo)}</span>
      </div>
      {error && <p className="text-sm text-red-700">{error}</p>}
      {ok && <p className="text-sm text-emerald-700">Saldo atualizado.</p>}
    </div>
  );
}
