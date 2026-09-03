"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

/** Único Tomador com fórmula diferente (ver CODIGO_TOMADOR_NF_SOBRE_TAXA_ADM em calc/engine.ts) — duplicado aqui pra não importar o motor de cálculo num Client Component. */
const CODIGO_TOMADOR_NF_SOBRE_TAXA_ADM = 14;

export function GrossUpConfigForm({
  tomadorCodigo,
  tomadorNome,
  grossUpInicial,
}: {
  tomadorCodigo: number;
  tomadorNome: string;
  grossUpInicial: number;
}) {
  const router = useRouter();
  const [valor, setValor] = useState(String(grossUpInicial * 100));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState(false);

  const especial = tomadorCodigo === CODIGO_TOMADOR_NF_SOBRE_TAXA_ADM;

  async function salvar() {
    setError(null);
    setOk(false);
    const num = Number(valor.replace(",", ".")) / 100;
    if (!Number.isFinite(num) || num < 0 || num > 1) {
      return setError(`Valor inválido — use um percentual entre 0 e 100 (0 desliga: NF = fatura). Padrão: ${especial ? "13,25%" : "86,75%"}.`);
    }

    setBusy(true);
    try {
      const res = await fetch(`/api/tomadores/${tomadorCodigo}/gross-up`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ grossUp: num }),
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
          <input
            value={valor}
            onChange={(e) => setValor(e.target.value)}
            title={especial ? "NF = despesa + (Taxa Adm × Gross Up)" : "NF = fatura ÷ Gross Up"}
            className="w-16 rounded border border-neutral-300 px-2 py-1 text-sm font-mono text-neutral-900"
          />
          <span className="text-neutral-500">%</span>
        </div>
        <span className="font-normal text-neutral-400">{especial ? "soma sobre a Taxa Adm" : "divide a fatura"}</span>
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
