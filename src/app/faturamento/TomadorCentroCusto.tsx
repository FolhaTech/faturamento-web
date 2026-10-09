"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { descricaoTomador, type TomadorOpcao } from "./RegimeColaborador";

/**
 * Seletor do Tomador do centro de custo inteiro, no Faturamento: troca o Tomador de TODOS os colaboradores mostrados
 * nesse centro de custo de uma vez (taxa administrativa, regime/FPAS e gross-up passam a ser os do Tomador escolhido).
 * Mostra o Tomador atual quando todos usam o mesmo, ou "misto" quando há mais de um — nesse caso é o jeito rápido de
 * unificar. Troca por matrícula (ver /api/faturamento/tomador-centro-custo), nunca pelo nome do centro de custo.
 */
export function TomadorCentroCusto({
  ccustoNome,
  matriculas,
  codServicoAtuais,
  tomadores,
}: {
  ccustoNome: string;
  matriculas: number[];
  /** Tomador atual de cada colaborador mostrado (null = sem Tomador). */
  codServicoAtuais: (number | null)[];
  tomadores: TomadorOpcao[];
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const distintos = [...new Set(codServicoAtuais)];
  const unico = distintos.length === 1 ? distintos[0] : undefined;
  const ordenados = [...tomadores].sort((a, b) => a.nome.localeCompare(b.nome) || a.fpas - b.fpas || a.codigo - b.codigo);

  async function trocar(codServico: number) {
    const escolhido = tomadores.find((t) => t.codigo === codServico);
    if (!escolhido) return;
    const aviso = `Trocar o Tomador dos ${matriculas.length} colaboradores de "${ccustoNome}" para:\n\n${descricaoTomador(escolhido)}\n\nA taxa administrativa, o regime (FPAS) e o gross-up passam a ser os desse Tomador.\nSe a fatura dessa competência já foi salva, descarte-a ou salve uma nova versão pra ver a mudança.`;
    if (!window.confirm(aviso)) return;

    setErro(null);
    setBusy(true);
    try {
      const res = await fetch("/api/faturamento/tomador-centro-custo", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ codServico, matriculas }),
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
    <div className="flex flex-col gap-2 rounded-lg border border-neutral-200 bg-white p-4">
      <label className="flex flex-col gap-1 text-xs font-medium text-neutral-500">
        Tomador do centro de custo — vale para os {matriculas.length} colaborador(es) de {ccustoNome}
        <select
          value={unico ?? ""}
          disabled={busy}
          onChange={(e) => e.target.value !== "" && trocar(Number(e.target.value))}
          className="max-w-xl rounded-md border border-neutral-300 px-2 py-1.5 text-sm font-normal text-neutral-900 disabled:bg-neutral-100"
        >
          {unico === undefined && <option value="">Misto — escolha um Tomador para unificar</option>}
          {unico === null && <option value="">— sem Tomador —</option>}
          {unico != null && !tomadores.some((t) => t.codigo === unico) && <option value={unico}>Tomador cód. {unico} (não cadastrado)</option>}
          {ordenados.map((t) => (
            <option key={t.codigo} value={t.codigo}>
              {descricaoTomador(t)}
            </option>
          ))}
        </select>
      </label>
      <p className="text-xs text-neutral-500">
        Define a taxa administrativa, o regime e o gross-up de todos os colaboradores deste centro de custo de uma vez. Para um colaborador só, use o seletor
        dentro da linha dele.
      </p>
      {erro && <span className="text-xs text-red-700">{erro}</span>}
    </div>
  );
}
