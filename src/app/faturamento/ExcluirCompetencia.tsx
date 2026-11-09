"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

/** "10/2026 (Folha)" -> "Folha"; "10/2026 (Prévia)" -> "Prévia"; qualquer outra -> "competência". */
function tipoDaCompetencia(competencia: string): string {
  if (competencia.endsWith(" (Folha)")) return "Folha";
  if (competencia.endsWith(" (Prévia)")) return "Prévia";
  return "competência";
}

/**
 * Exclui a Folha (ou a Prévia) da competência mostrada, em duas etapas: o primeiro clique só abre o aviso do que será apagado;
 * a exclusão acontece no "Confirmar exclusão". Apaga os lançamentos de TODOS os centros de custo dessa competência
 * (ver DELETE /api/movimentos e excluirCompetencia em repo/movimentos.ts) — só enviando os arquivos de novo pra recuperar.
 */
export function ExcluirCompetencia({ competencia, qtdLancamentos }: { competencia: string; qtdLancamentos: number }) {
  const router = useRouter();
  const [confirmando, setConfirmando] = useState(false);
  const [busy, setBusy] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const tipo = tipoDaCompetencia(competencia);

  async function excluir() {
    setErro(null);
    setBusy(true);
    try {
      const res = await fetch("/api/movimentos", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ competencia, confirmar: true }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErro(data.error ?? "Falha ao excluir.");
        return;
      }
      setConfirmando(false);
      // A competência saiu da lista: volta pra tela sem competência escolhida (abre a mais recente).
      router.push("/faturamento");
      router.refresh();
    } catch {
      setErro("Falha de rede ao excluir.");
    } finally {
      setBusy(false);
    }
  }

  if (!confirmando) {
    return (
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => setConfirmando(true)}
          className="rounded-md border border-red-300 bg-white px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-50"
        >
          Excluir esta {tipo}
        </button>
        {erro && <span className="text-xs text-red-700">{erro}</span>}
      </div>
    );
  }

  return (
    <div role="alertdialog" aria-label={`Confirmar exclusão de ${competencia}`} className="flex flex-col gap-3 rounded-lg border border-red-300 bg-red-50 p-4 text-sm text-red-900">
      <p>
        <strong>Excluir {competencia}?</strong>{" "}
        Vão embora os <strong>{qtdLancamentos.toLocaleString("pt-BR")} lançamento(s)</strong> dessa competência, de <strong>todos os centros de custo</strong>.
      </p>
      <ul className="list-disc pl-5 text-xs text-red-800">
        <li>As provisões de férias/13º gravadas por ela saem da Rescisão, e os saldos que ela abateu voltam pros colaboradores.</li>
        <li>As faturas salvas dessa competência são descartadas (ficam só na timeline).</li>
        <li>Descontos lançados, créditos aplicados à mão, % a deduzir e adiantamentos <strong>não</strong> são apagados.</li>
        <li>Não dá pra desfazer: só enviando os arquivos de Movimentos de novo.</li>
      </ul>
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={excluir}
          disabled={busy}
          className="rounded-md bg-red-700 px-4 py-2 text-sm font-medium text-white hover:bg-red-800 disabled:opacity-50"
        >
          {busy ? "Excluindo…" : "Confirmar exclusão"}
        </button>
        <button
          type="button"
          onClick={() => {
            setConfirmando(false);
            setErro(null);
          }}
          disabled={busy}
          className="rounded-md border border-neutral-300 bg-white px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50 disabled:opacity-50"
        >
          Cancelar
        </button>
      </div>
      {erro && <span className="text-xs font-medium text-red-700">{erro}</span>}
    </div>
  );
}
