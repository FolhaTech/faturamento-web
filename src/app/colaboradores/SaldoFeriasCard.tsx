"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

const currency = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
function fmt(n: number): string {
  return currency.format(n);
}

export function SaldoFeriasCard({
  matricula,
  saldoFeriasInicial,
  saldoUmTercoInicial,
  competenciaAtual,
  descontoFeriasNaCompetencia,
  descontoUmTercoNaCompetencia,
}: {
  matricula: number;
  saldoFeriasInicial: number;
  saldoUmTercoInicial: number;
  /** Competência escolhida no seletor da tela (ver page.tsx) — pra qual o valor digitado abaixo vai ser lançado. null quando ainda não há nenhuma competência com Movimentos enviados. */
  competenciaAtual: string | null;
  /** Quanto já foi lançado como desconto NESSA competência específica (ver descontosSaldo.ts) — cada mês com o próprio valor, sem se misturar com os outros. */
  descontoFeriasNaCompetencia: number;
  descontoUmTercoNaCompetencia: number;
}) {
  const router = useRouter();
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
        body: JSON.stringify({ saldoFerias, saldoUmTerco, competencia: competenciaAtual }),
      });
      const data = await res.json();
      if (!res.ok) return setError(data.error ?? "Falha ao salvar.");

      setValorFerias(String(data.colaborador.saldoFerias));
      setValorUmTerco(String(data.colaborador.saldoUmTerco));
      if (data.competenciaAplicada) {
        setInfo(`Lançado como desconto na fatura da competência ${data.competenciaAplicada}. Os campos voltaram a 0.`);
      } else if (saldoFerias > 0 || saldoUmTerco > 0) {
        setInfo(
          competenciaAtual
            ? "Valor salvo como saldo pendente (nada lançado ainda)."
            : "Valor salvo, mas ainda não há nenhuma competência com Movimentos enviados — nada foi lançado como desconto ainda.",
        );
      } else {
        setInfo("Saldos atualizados.");
      }
      router.refresh();
    } catch {
      setError("Falha de rede ao salvar.");
    } finally {
      setBusy(false);
    }
  }

  const temDescontoNaCompetencia = descontoFeriasNaCompetencia > 0 || descontoUmTercoNaCompetencia > 0;

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-neutral-200 bg-white p-4">
      <h2 className="text-sm font-semibold text-neutral-900">Desconto de saldo de férias e de 13° salário</h2>
      <p className="text-xs text-neutral-500">
        Preencha um valor e salve para lançá-lo como desconto (crédito) na fatura da competência
        {competenciaAtual ? ` ${competenciaAtual}` : " selecionada acima"} — reduz o total cobrado do tomador
        exatamente pelo valor digitado (com taxa administrativa e gross-up de NF proporcionais). O campo volta a 0
        sozinho depois de aplicado, mas o desconto fica salvo naquela competência pra sempre — mesmo reenviando o
        arquivo de Movimentos dela depois, ele continua sendo cobrado. Cada competência guarda o próprio valor, sem
        replicar pras outras — troque de competência no seletor acima pra lançar em outro mês.
      </p>
      {competenciaAtual && temDescontoNaCompetencia && (
        <p className="text-xs font-medium text-emerald-700">
          Já lançado em {competenciaAtual}:{" "}
          {[
            descontoFeriasNaCompetencia > 0 ? `férias ${fmt(descontoFeriasNaCompetencia)}` : null,
            descontoUmTercoNaCompetencia > 0 ? `13° salário ${fmt(descontoUmTercoNaCompetencia)}` : null,
          ]
            .filter(Boolean)
            .join(" · ")}
        </p>
      )}
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
          Desconto de 13° salário
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
