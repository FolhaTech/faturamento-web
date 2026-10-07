"use client";

import { lerPercentual, valorACobrar } from "@/lib/percentualCobranca";

const currency = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

/**
 * Campo de porcentagem no card de totais do Faturamento: quanto do Total fatura (com encargos) o
 * usuário quer cobrar. Mostra o valor a cobrar aqui e o percentual segue no link "Exportar PDF"
 * (ver FaturamentoViewer), que o imprime no Resumo do relatório. Não altera a fatura nem os totais.
 */
export function PercentualCobranca({ texto, onChange, totalFatura }: { texto: string; onChange: (novo: string) => void; totalFatura: number }) {
  const percentual = lerPercentual(texto);
  const cobrar = percentual === null ? null : valorACobrar(totalFatura, percentual);

  return (
    <div className="mt-4 rounded-md border border-emerald-200 bg-emerald-50 p-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">Percentual a cobrar</p>
      <div className="mt-2 flex flex-wrap items-end gap-4">
        <label className="flex flex-col gap-1 text-xs font-medium text-neutral-600">
          % do Total fatura (com encargos) — {currency.format(totalFatura)}
          <span className="flex items-center gap-1">
            <input
              value={texto}
              onChange={(e) => onChange(e.target.value)}
              inputMode="decimal"
              placeholder="ex.: 80"
              className="w-24 rounded-md border border-neutral-300 bg-white px-2 py-1.5 text-sm font-normal text-neutral-900"
            />
            <span className="text-sm text-neutral-600">%</span>
          </span>
        </label>
        <div className="flex flex-col gap-0.5">
          <span className="text-xs font-medium text-emerald-900">Valor a cobrar{percentual !== null ? ` (${percentual.toLocaleString("pt-BR")}%)` : ""}</span>
          <span className="font-mono text-lg font-semibold tabular-nums text-emerald-900">{cobrar === null ? "—" : currency.format(cobrar)}</span>
        </div>
        {cobrar !== null && percentual !== null && percentual < 100 && (
          <div className="flex flex-col gap-0.5">
            <span className="text-xs font-medium text-neutral-500">Restante ({(100 - percentual).toLocaleString("pt-BR")}%)</span>
            <span className="font-mono text-sm tabular-nums text-neutral-700">{currency.format(totalFatura - cobrar)}</span>
          </div>
        )}
        <p className="basis-full text-xs text-neutral-500">O percentual digitado também sai no PDF exportado deste centro de custo, no Resumo.</p>
      </div>
    </div>
  );
}
