"use client";

import { useState, useSyncExternalStore } from "react";

const currency = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

/** Evento próprio: o "storage" do navegador só dispara em OUTRAS abas, não na que gravou. */
const EVENTO = "faturamento:percentual-cobranca";

function assinar(onChange: () => void): () => void {
  window.addEventListener(EVENTO, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(EVENTO, onChange);
    window.removeEventListener("storage", onChange);
  };
}

function lerArmazenado(chave: string): string {
  try {
    return window.localStorage.getItem(chave) ?? "";
  } catch {
    return "";
  }
}


/** "80", "80,5" ou "80.5" -> número; vazio/inválido/negativo -> null. */
function lerPercentual(texto: string): number | null {
  const limpo = texto.trim().replace("%", "").replace(",", ".");
  if (limpo === "") return null;
  const n = Number(limpo);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

/**
 * Campo de porcentagem no card de totais do Faturamento: quanto do Total fatura (com encargos) o
 * usuário quer cobrar. Só calcula e mostra o valor — não altera a fatura, os totais nem o PDF. O
 * último percentual digitado fica lembrado neste navegador, por competência + centro de custo.
 */
export function PercentualCobranca({ competencia, ccustoCodigo, totalFatura }: { competencia: string; ccustoCodigo: string; totalFatura: number }) {
  const chave = `faturamento:percentual-cobranca:${competencia}:${ccustoCodigo}`;
  // No servidor (e na hidratação) o campo nasce vazio; no navegador lê o valor lembrado.
  const texto = useSyncExternalStore(assinar, () => lerArmazenado(chave), () => "");
  // Sem armazenamento (janela privada, bloqueado) o valor digitado fica só aqui, pro campo continuar funcionando.
  const [semArmazenamento, setSemArmazenamento] = useState<string | null>(null);

  function alterar(novo: string) {
    try {
      if (novo.trim() === "") window.localStorage.removeItem(chave);
      else window.localStorage.setItem(chave, novo);
      window.dispatchEvent(new Event(EVENTO));
    } catch {
      setSemArmazenamento(novo);
    }
  }

  const textoAtual = semArmazenamento ?? texto;

  const percentual = lerPercentual(textoAtual);
  const valorACobrar = percentual === null ? null : (totalFatura * percentual) / 100;

  return (
    <div className="mt-4 rounded-md border border-emerald-200 bg-emerald-50 p-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">Percentual a cobrar</p>
      <div className="mt-2 flex flex-wrap items-end gap-4">
        <label className="flex flex-col gap-1 text-xs font-medium text-neutral-600">
          % do Total fatura (com encargos) — {currency.format(totalFatura)}
          <span className="flex items-center gap-1">
            <input
              value={textoAtual}
              onChange={(e) => alterar(e.target.value)}
              inputMode="decimal"
              placeholder="ex.: 80"
              className="w-24 rounded-md border border-neutral-300 bg-white px-2 py-1.5 text-sm font-normal text-neutral-900"
            />
            <span className="text-sm text-neutral-600">%</span>
          </span>
        </label>
        <div className="flex flex-col gap-0.5">
          <span className="text-xs font-medium text-emerald-900">
            Valor a cobrar{percentual !== null ? ` (${percentual.toLocaleString("pt-BR")}%)` : ""}
          </span>
          <span className="font-mono text-lg font-semibold tabular-nums text-emerald-900">{valorACobrar === null ? "—" : currency.format(valorACobrar)}</span>
        </div>
        {valorACobrar !== null && percentual !== null && percentual < 100 && (
          <div className="flex flex-col gap-0.5">
            <span className="text-xs font-medium text-neutral-500">Restante ({(100 - percentual).toLocaleString("pt-BR")}%)</span>
            <span className="font-mono text-sm tabular-nums text-neutral-700">{currency.format(totalFatura - valorACobrar)}</span>
          </div>
        )}
      </div>
    </div>
  );
}
