"use client";

import { useState } from "react";

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
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  async function salvar() {
    setError(null);
    setInfo(null);
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

      setValorFerias(String(data.colaborador.saldoFerias));
      setValorUmTerco(String(data.colaborador.saldoUmTerco));
      if (data.competenciaAplicada) {
        setInfo(`Lançado como desconto na fatura da competência ${data.competenciaAplicada}. Os campos voltaram a 0.`);
      } else if (saldoFerias > 0 || saldoUmTerco > 0) {
        setInfo("Valor salvo, mas ainda não há nenhuma competência com Movimentos enviados — nada foi lançado como desconto ainda.");
      } else {
        setInfo("Saldos atualizados.");
      }
    } catch {
      setError("Falha de rede ao salvar.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-neutral-200 bg-white p-4">
      <h2 className="text-sm font-semibold text-neutral-900">Desconto de saldo de férias e de 1/3</h2>
      <p className="text-xs text-neutral-500">
        Preencha um valor e salve para lançá-lo como desconto (crédito) na fatura da competência mais recente já
        enviada — reduz o total cobrado do tomador exatamente pelo valor digitado, sem taxa administrativa nem
        gross-up de NF em cima. É um lançamento único: depois de aplicado, o campo volta a 0 sozinho. Reenviar o
        arquivo de Movimentos dessa competência depois apaga esse lançamento junto com o resto.
      </p>
      <div className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1 text-xs font-medium text-neutral-500">
          Desconto de férias
          <input
            value={valorFerias}
            onChange={(e) => setValorFerias(e.target.value)}
            className="w-40 rounded-md border border-neutral-300 px-3 py-1.5 text-sm font-mono"
          />
        </label>
        <label className="flex flex-col gap-1 text-xs font-medium text-neutral-500">
          Desconto de 1/3
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
      </div>
      {error && <p className="text-sm text-red-700">{error}</p>}
      {info && <p className="text-sm text-emerald-700">{info}</p>}
    </div>
  );
}
