"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { GrossUpOperacao } from "@/lib/types";

const OPERACOES: { valor: GrossUpOperacao; simbolo: string; label: string; dica: string }[] = [
  { valor: "+", simbolo: "+", label: "soma a tributação", dica: "Nota Fiscal = Fatura + (Fatura × Gross Up)" },
  { valor: "-", simbolo: "−", label: "subtrai a tributação", dica: "Nota Fiscal = Fatura − (Fatura × Gross Up)" },
  { valor: "*", simbolo: "×", label: "multiplica a fatura", dica: "Nota Fiscal = Fatura × Gross Up" },
  { valor: "/", simbolo: "÷", label: "divide a fatura", dica: "Nota Fiscal = Fatura ÷ Gross Up" },
];

export function GrossUpConfigForm({
  tomadorCodigo,
  tomadorNome,
  grossUpInicial,
  grossUpOperacaoInicial,
}: {
  tomadorCodigo: number;
  tomadorNome: string;
  grossUpInicial: number;
  grossUpOperacaoInicial: GrossUpOperacao;
}) {
  const router = useRouter();
  const [valor, setValor] = useState(String(grossUpInicial * 100));
  const [operacao, setOperacao] = useState<GrossUpOperacao>(grossUpOperacaoInicial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState(false);

  const opAtual = OPERACOES.find((o) => o.valor === operacao) ?? OPERACOES[0];

  async function salvar() {
    setError(null);
    setOk(false);
    const num = Number(valor.replace(",", ".")) / 100;
    if (!Number.isFinite(num) || num < 0 || num > 1) {
      return setError("Valor inválido — use um percentual entre 0 e 100 (0 desliga: NF = fatura). Padrão: 13,25%.");
    }

    setBusy(true);
    try {
      const res = await fetch(`/api/tomadores/${tomadorCodigo}/gross-up`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ grossUp: num, grossUpOperacao: operacao }),
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
    <div className="flex flex-wrap items-end gap-2 text-xs">
      <label className="flex flex-col gap-1 font-medium text-neutral-500">
        Gross Up ({tomadorNome})
        <div className="flex items-center gap-1">
          <select
            value={operacao}
            onChange={(e) => setOperacao(e.target.value as GrossUpOperacao)}
            title="Operador entre Fatura e Gross Up"
            className="rounded border border-neutral-300 px-1 py-1 text-sm font-mono text-neutral-900"
          >
            {OPERACOES.map((o) => (
              <option key={o.valor} value={o.valor}>
                {o.simbolo}
              </option>
            ))}
          </select>
          <input
            value={valor}
            onChange={(e) => setValor(e.target.value)}
            title={opAtual.dica}
            className="w-16 rounded border border-neutral-300 px-2 py-1 text-sm font-mono text-neutral-900"
          />
          <span className="text-neutral-500">%</span>
        </div>
        <span className="font-normal text-neutral-400">{opAtual.label}</span>
      </label>
      <button
        type="button"
        onClick={salvar}
        disabled={busy}
        className="rounded-md border border-neutral-300 bg-white px-3 py-1.5 text-xs font-medium hover:bg-neutral-50 disabled:opacity-50"
      >
        {busy ? "Salvando…" : "Salvar"}
      </button>
      {error && <p className="w-full text-red-700">{error}</p>}
      {ok && <p className="w-full text-emerald-700">Gross Up salvo — a fatura já recalcula com o novo valor.</p>}
    </div>
  );
}
