"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export interface MesDisponivel {
  /** "MM/YYYY", sem sufixo de tipo. */
  base: string;
  /** Competências reais que existem pra esse mês (pode ter Prévia/Folha/Normal juntas) — a primeira da lista é a usada ao navegar pra esse mês. */
  raws: string[];
}

const MESES_ABREV = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

/** "MM/YYYY" -> "YYYY-MM", formato exigido por <input type="month">. */
function baseParaInputMonth(base: string): string {
  const [mes, ano] = base.split("/");
  return mes && ano ? `${ano}-${mes}` : "";
}

/** "YYYY-MM" -> "MM/YYYY". */
function inputMonthParaBase(value: string): string {
  const [ano, mes] = value.split("-");
  return mes && ano ? `${mes}/${ano}` : "";
}

function formatarBase(base: string): string {
  const [mes, ano] = base.split("/");
  const idx = Number(mes) - 1;
  return idx >= 0 && idx < 12 ? `${MESES_ABREV[idx]}/${ano}` : base;
}

/**
 * Calendário nativo do navegador (input type="month") pra navegar entre competências — em vez de
 * uma fileira de botões, um por mês. Só deixa ir pra meses que realmente têm alguma competência
 * salva (ver `meses`); escolher um mês sem nada mostra um aviso, sem navegar pra um lugar sem
 * dado nenhum.
 */
export function CompetenciaCalendario({
  meses,
  competenciaAtual,
  basePath,
}: {
  meses: MesDisponivel[];
  competenciaAtual: string | null;
  basePath: string;
}) {
  const router = useRouter();
  const baseAtual = competenciaAtual?.replace(/\s*\((Prévia|Folha)\)$/, "") ?? "";
  const [semDadoEm, setSemDadoEm] = useState<string | null>(null);

  function onChange(value: string) {
    const base = inputMonthParaBase(value);
    const mes = meses.find((m) => m.base === base);
    if (!mes) {
      setSemDadoEm(base);
      return;
    }
    setSemDadoEm(null);
    router.push(`${basePath}?competencia=${encodeURIComponent(mes.raws[0])}`);
  }

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-lg border border-neutral-200 bg-white p-4">
      <label className="flex flex-col gap-1 text-xs font-medium text-neutral-500">
        Competência
        <input
          type="month"
          value={baseParaInputMonth(baseAtual)}
          onChange={(e) => onChange(e.target.value)}
          className="rounded-md border border-neutral-300 px-3 py-1.5 text-sm text-neutral-900"
        />
      </label>
      {competenciaAtual && <span className="text-sm text-neutral-600">Mostrando: {competenciaAtual}</span>}
      {semDadoEm && (
        <span className="text-sm text-amber-700">Nenhuma competência salva em {formatarBase(semDadoEm)} — mostrando {competenciaAtual ?? "nada"}.</span>
      )}
    </div>
  );
}
