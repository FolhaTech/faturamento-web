"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

/** Data ISO (vinda do banco) formatada como "dd/mm/aaaa hh:mm", no fuso do navegador. */
function fmtData(iso: string): string {
  return new Date(iso).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}

export function SalvarFaturaBanner({ competencia, salvoEm }: { competencia: string; salvoEm: string | null }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function salvar() {
    setError(null);
    setBusy(true);
    try {
      const res = await fetch("/api/faturamento/salvar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ competencia }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Falha ao salvar.");
        return;
      }
      router.refresh();
    } catch {
      setError("Falha de rede ao salvar.");
    } finally {
      setBusy(false);
    }
  }

  async function descartar() {
    setError(null);
    setBusy(true);
    try {
      const res = await fetch(`/api/faturamento/salvar?competencia=${encodeURIComponent(competencia)}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "Falha ao descartar.");
        return;
      }
      router.refresh();
    } catch {
      setError("Falha de rede ao descartar.");
    } finally {
      setBusy(false);
    }
  }

  if (salvoEm) {
    return (
      <div className="flex flex-wrap items-center gap-3 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-sm text-emerald-900">
        <span>
          <strong>Fatura salva</strong> em {fmtData(salvoEm)} — os valores abaixo estão congelados desse jeito e não mudam sozinhos se você
          editar checkboxes de INSS/FGTS/Provisões, Gross Up ou PLR depois (isso só afeta competências ainda não salvas).
        </span>
        <div className="ml-auto flex gap-2">
          <button
            type="button"
            onClick={salvar}
            disabled={busy}
            className="rounded-md bg-emerald-700 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-800 disabled:opacity-50"
          >
            {busy ? "Salvando…" : "Salvar de novo com os dados atuais"}
          </button>
          <button
            type="button"
            onClick={descartar}
            disabled={busy}
            className="rounded-md border border-emerald-300 bg-white px-3 py-1.5 text-xs font-medium text-emerald-800 hover:bg-emerald-100 disabled:opacity-50"
          >
            Descartar e voltar ao cálculo ao vivo
          </button>
        </div>
        {error && <p className="w-full text-sm text-red-700">{error}</p>}
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-lg border border-neutral-200 bg-white px-4 py-2.5 text-sm text-neutral-700">
      <span>Mostrando o cálculo ao vivo dessa competência (ainda não salva) — edições em Encargos, Gross Up, PLR ou descontos mudam esses números na hora.</span>
      <button
        type="button"
        onClick={salvar}
        disabled={busy}
        className="ml-auto shrink-0 rounded-md bg-emerald-700 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-800 disabled:opacity-50"
      >
        {busy ? "Salvando…" : "Salvar fatura desta competência"}
      </button>
      {error && <p className="w-full text-sm text-red-700">{error}</p>}
    </div>
  );
}
