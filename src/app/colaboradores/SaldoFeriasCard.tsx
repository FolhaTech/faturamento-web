"use client";

import { useState } from "react";

const currency = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

export function SaldoFeriasCard({
  matricula,
  saldoFeriasInicial,
  saldoUmTercoInicial,
}: {
  matricula: number;
  saldoFeriasInicial: number;
  saldoUmTercoInicial: number;
}) {
  const [valorFerias, setValorFerias] = useState(String(saldoFeriasInicial));
  const [valorUmTerco, setValorUmTerco] = useState(String(saldoUmTercoInicial));
  const [salvoFerias, setSalvoFerias] = useState(saldoFeriasInicial);
  const [salvoUmTerco, setSalvoUmTerco] = useState(saldoUmTercoInicial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState(false);

  async function salvar() {
    setError(null);
    setOk(false);
    const saldoFerias = Number(valorFerias.replace(",", "."));
    const saldoUmTerco = Number(valorUmTerco.replace(",", "."));
    if (!Number.isFinite(saldoFerias) || !Number.isFinite(saldoUmTerco)) return setError("Valor inválido.");

    setBusy(true);
    try {
      const res = await fetch(`/api/colaboradores/${matricula}/saldo-ferias`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ saldoFerias, saldoUmTerco }),
      });
      const data = await res.json();
      if (!res.ok) return setError(data.error ?? "Falha ao salvar.");
      setSalvoFerias(saldoFerias);
      setSalvoUmTerco(saldoUmTerco);
      setOk(true);
    } catch {
      setError("Falha de rede ao salvar.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-neutral-200 bg-white p-4">
      <h2 className="text-sm font-semibold text-neutral-900">Saldo de férias e de 1/3</h2>
      <p className="text-xs text-neutral-500">
        Valores já provisionados/cobrados do tomador ao longo dos meses — férias e 1/3 são rubricas distintas na
        folha, mantidas em saldos separados. Quando um lançamento real de férias (ou de 1/3) aparecer na folha
        (código marcado no campo &quot;Abate saldo&quot; em Encargos), o saldo correspondente é abatido
        automaticamente do valor cobrado, em vez de cobrar o valor cheio de novo.
      </p>
      <div className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1 text-xs font-medium text-neutral-500">
          Saldo de férias
          <input
            value={valorFerias}
            onChange={(e) => setValorFerias(e.target.value)}
            className="w-40 rounded-md border border-neutral-300 px-3 py-1.5 text-sm font-mono"
          />
        </label>
        <label className="flex flex-col gap-1 text-xs font-medium text-neutral-500">
          Saldo de 1/3
          <input
            value={valorUmTerco}
            onChange={(e) => setValorUmTerco(e.target.value)}
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
        <span className="text-xs text-neutral-400">
          Salvo: {currency.format(salvoFerias)} férias · {currency.format(salvoUmTerco)} 1/3
        </span>
      </div>
      {error && <p className="text-sm text-red-700">{error}</p>}
      {ok && <p className="text-sm text-emerald-700">Saldos atualizados.</p>}
    </div>
  );
}
