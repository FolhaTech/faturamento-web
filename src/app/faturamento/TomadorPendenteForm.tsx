"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { GrossUpOperacao } from "@/lib/types";

export interface TomadorPendente {
  codigo: number;
  nome: string;
  grossUp: number;
  grossUpOperacao: GrossUpOperacao;
}

/**
 * Preenche FPAS e Taxa Adm de um Tomador pendente direto no Faturamento (um Tomador criado
 * automaticamente pelo upload nasce sem esses dados e deixa os colaboradores dele fora da fatura
 * até alguém informar — ver upsertTomadoresPendentes). Reaproveita PUT /api/tomadores/[codigo],
 * que já zera `pendente`; Gross Up e operador atuais são reenviados como estão.
 */
export function TomadorPendenteForm({ tomador }: { tomador: TomadorPendente }) {
  const router = useRouter();
  const [fpas, setFpas] = useState<"" | "515" | "655">("");
  const [taxaAdm, setTaxaAdm] = useState("");
  const [busy, setBusy] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function salvar() {
    setErro(null);
    if (fpas === "") return setErro("Escolha o FPAS (regime).");
    const taxa = Number(taxaAdm.replace(",", ".")) / 100;
    if (taxaAdm.trim() === "" || !Number.isFinite(taxa) || taxa < 0) return setErro("Informe a Taxa Adm em % (ex.: 10).");

    setBusy(true);
    try {
      const res = await fetch(`/api/tomadores/${tomador.codigo}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nome: tomador.nome,
          fpas: Number(fpas),
          taxaAdm: taxa,
          grossUp: tomador.grossUp,
          grossUpOperacao: tomador.grossUpOperacao,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setErro(data.error ?? "Falha ao salvar.");
        return;
      }
      router.refresh();
    } catch {
      setErro("Falha de rede ao salvar.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-wrap items-end gap-3 rounded-md border border-amber-200 bg-white p-3">
      <div className="min-w-48 flex-1 text-sm">
        <span className="font-medium text-neutral-900">{tomador.nome}</span> <span className="text-neutral-500">(cód. {tomador.codigo})</span>
      </div>
      <label className="flex flex-col gap-1 text-xs font-medium text-neutral-500">
        FPAS (regime)
        <select
          value={fpas}
          disabled={busy}
          onChange={(e) => setFpas(e.target.value as "" | "515" | "655")}
          className="rounded-md border border-neutral-300 px-2 py-1.5 text-sm font-normal text-neutral-900 disabled:bg-neutral-100"
        >
          <option value="">Selecione…</option>
          <option value="515">515 — Terceiro (CLT)</option>
          <option value="655">655 — Temporário</option>
        </select>
      </label>
      <label className="flex flex-col gap-1 text-xs font-medium text-neutral-500">
        Taxa Adm (%)
        <input
          value={taxaAdm}
          disabled={busy}
          onChange={(e) => setTaxaAdm(e.target.value)}
          inputMode="decimal"
          placeholder="ex.: 10"
          className="w-24 rounded-md border border-neutral-300 px-2 py-1.5 text-sm font-normal text-neutral-900 disabled:bg-neutral-100"
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
      {erro && <span className="basis-full text-xs text-red-700">{erro}</span>}
    </div>
  );
}
