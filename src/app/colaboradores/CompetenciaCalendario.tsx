"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export interface MesDisponivel {
  /** "MM/YYYY", sem sufixo de tipo. */
  base: string;
  /** Competências reais que existem pra esse mês (pode ter Prévia/Folha/Normal juntas) — a primeira da lista é a usada ao trocar de mês. */
  raws: string[];
}

const MESES_ABREV = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
const SUFIXOS_TIPO = [" (Prévia)", " (Folha)"];
const TIPO_LABEL: Record<string, string> = { " (Prévia)": "Prévia", " (Folha)": "Folha", "": "Normal" };

/** "09/2026 (Prévia)" -> " (Prévia)"; "09/2026" (sem sufixo, competência antiga) -> "". */
function sufixoTipo(raw: string): string {
  return SUFIXOS_TIPO.find((s) => raw.endsWith(s)) ?? "";
}

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
 *
 * Um mesmo mês pode ter Prévia e Folha salvas separadas (ver tipoCompetencia.ts) — quando o mês
 * escolhido tem mais de uma, aparecem uns rádios pra marcar qual das duas (ou "Normal", pra
 * competência antiga sem essa marcação) usar; escolher o mês sozinho não é suficiente nesse caso.
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

  const mesAtual = meses.find((m) => m.base === baseAtual);
  const tiposDoMes = mesAtual?.raws.map((raw) => ({ raw, label: TIPO_LABEL[sufixoTipo(raw)] ?? sufixoTipo(raw) })) ?? [];

  function irParaCompetencia(raw: string) {
    setSemDadoEm(null);
    router.push(`${basePath}?competencia=${encodeURIComponent(raw)}`);
  }

  function onChangeMes(value: string) {
    const base = inputMonthParaBase(value);
    const mes = meses.find((m) => m.base === base);
    if (!mes) {
      setSemDadoEm(base);
      return;
    }
    irParaCompetencia(mes.raws[0]);
  }

  return (
    <div className="flex flex-wrap items-center gap-4 rounded-lg border border-neutral-200 bg-white p-4">
      <label className="flex flex-col gap-1 text-xs font-medium text-neutral-500">
        Competência
        <input
          type="month"
          value={baseParaInputMonth(baseAtual)}
          onChange={(e) => onChangeMes(e.target.value)}
          className="rounded-md border border-neutral-300 px-3 py-1.5 text-sm text-neutral-900"
        />
      </label>

      {tiposDoMes.length > 1 && (
        <div className="flex flex-col gap-1 text-xs font-medium text-neutral-500">
          Prévia ou Folha?
          <div className="flex gap-3 py-1">
            {tiposDoMes.map((t) => (
              <label key={t.raw} className="flex items-center gap-1.5 text-sm font-normal text-neutral-700">
                <input type="radio" name="tipoCompetencia" checked={t.raw === competenciaAtual} onChange={() => irParaCompetencia(t.raw)} />
                {t.label}
              </label>
            ))}
          </div>
        </div>
      )}

      {competenciaAtual && <span className="text-sm text-neutral-600">Mostrando: {competenciaAtual}</span>}
      {semDadoEm && (
        <span className="text-sm text-amber-700">Nenhuma competência salva em {formatarBase(semDadoEm)} — mostrando {competenciaAtual ?? "nada"}.</span>
      )}
    </div>
  );
}
