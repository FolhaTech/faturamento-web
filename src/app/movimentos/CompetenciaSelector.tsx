"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export interface MesDisponivel {
  base: string;
  label: string;
  tipos: { tipo: string; raw: string; label: string; qtd: number }[];
}

/** Seletor de competência em dois selects (Mês/Ano + Prévia/Folha/Normal) em vez de um botão por combinação — só mostra os tipos que existem de verdade pro mês escolhido. */
export function CompetenciaSelector({ meses, competenciaAtual }: { meses: MesDisponivel[]; competenciaAtual: string | null }) {
  const router = useRouter();
  const mesAtual = meses.find((m) => m.tipos.some((t) => t.raw === competenciaAtual)) ?? meses[0] ?? null;
  const [baseSelecionada, setBaseSelecionada] = useState(mesAtual?.base ?? "");

  const mes = meses.find((m) => m.base === baseSelecionada) ?? mesAtual;

  function irPara(raw: string) {
    router.push(`/movimentos?competencia=${encodeURIComponent(raw)}`);
  }

  function trocarMes(novaBase: string) {
    setBaseSelecionada(novaBase);
    const novoMes = meses.find((m) => m.base === novaBase);
    const tipoAtual = mes?.tipos.find((t) => t.raw === competenciaAtual)?.tipo;
    const proximoTipo = novoMes?.tipos.find((t) => t.tipo === tipoAtual) ?? novoMes?.tipos[0];
    if (proximoTipo) irPara(proximoTipo.raw);
  }

  return (
    <div className="flex flex-wrap items-end gap-3 rounded-lg border border-neutral-200 bg-white p-4">
      <label className="flex flex-col gap-1 text-xs font-medium text-neutral-500">
        Mês/Ano
        <select
          value={baseSelecionada}
          onChange={(e) => trocarMes(e.target.value)}
          className="min-w-32 rounded-md border border-neutral-300 px-3 py-1.5 text-sm text-neutral-900"
        >
          {meses.map((m) => (
            <option key={m.base} value={m.base}>
              {m.label}
            </option>
          ))}
        </select>
      </label>

      <label className="flex flex-col gap-1 text-xs font-medium text-neutral-500">
        Tipo
        <select
          value={competenciaAtual ?? ""}
          onChange={(e) => irPara(e.target.value)}
          className="min-w-40 rounded-md border border-neutral-300 px-3 py-1.5 text-sm text-neutral-900"
        >
          {mes?.tipos.map((t) => (
            <option key={t.raw} value={t.raw}>
              {t.label} ({t.qtd})
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}
