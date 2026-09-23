import type { PreviaTotalPorCcusto } from "../calc/faturaCompetencia";
import type { CalculatedLine } from "../calc/engine";
import { ensureSchema, getDb } from "../db";

export interface FaturaSalva {
  competencia: string;
  lines: CalculatedLine[];
  warnings: string[];
  salvoEm: string;
  /** Total já cobrado na Prévia correspondente, por Ccusto, congelado no momento de salvar — ver calcularPreviaTotalFaturaPorCcusto em faturaCompetencia.ts. Array vazio quando não havia Prévia (ou é a própria Prévia, ou a foto é antiga). */
  previaTotalFaturaPorCcusto: PreviaTotalPorCcusto[];
}

interface Row {
  competencia: string;
  lines: string;
  warnings: string;
  salvo_em: string;
  previa_total_fatura: string;
}

function toFaturaSalva(row: Row): FaturaSalva {
  return {
    competencia: row.competencia,
    lines: JSON.parse(row.lines) as CalculatedLine[],
    warnings: JSON.parse(row.warnings) as string[],
    salvoEm: row.salvo_em,
    previaTotalFaturaPorCcusto: JSON.parse(row.previa_total_fatura) as PreviaTotalPorCcusto[],
  };
}

/** Foto congelada da competência, se alguém já tiver salvado uma — null quando ainda não foi salva (tela mostra o cálculo ao vivo). */
export async function getFaturaSalva(competencia: string): Promise<FaturaSalva | null> {
  await ensureSchema();
  const rows = await getDb()<Row[]>`SELECT * FROM faturas_salvas WHERE competencia = ${competencia}`;
  return rows[0] ? toFaturaSalva(rows[0]) : null;
}

/** Salva (ou substitui) a foto da competência — quem chama decide o que vai em `lines`/`warnings` (normalmente o runEngine mais recente) e em `previaTotalFaturaPorCcusto` (ver calcularPreviaTotalFaturaPorCcusto). */
export async function salvarFatura(
  competencia: string,
  lines: CalculatedLine[],
  warnings: string[],
  previaTotalFaturaPorCcusto: PreviaTotalPorCcusto[],
): Promise<FaturaSalva> {
  await ensureSchema();
  await getDb()`
    INSERT INTO faturas_salvas (competencia, lines, warnings, salvo_em, previa_total_fatura)
    VALUES (${competencia}, ${JSON.stringify(lines)}, ${JSON.stringify(warnings)}, now(), ${JSON.stringify(previaTotalFaturaPorCcusto)})
    ON CONFLICT (competencia) DO UPDATE SET
      lines = excluded.lines, warnings = excluded.warnings, salvo_em = excluded.salvo_em, previa_total_fatura = excluded.previa_total_fatura
  `;
  return (await getFaturaSalva(competencia))!;
}

/** Descarta a foto salva — a tela volta a mostrar o cálculo ao vivo dessa competência. */
export async function descartarFaturaSalva(competencia: string): Promise<void> {
  await ensureSchema();
  await getDb()`DELETE FROM faturas_salvas WHERE competencia = ${competencia}`;
}

/** Quais das competências dadas têm foto salva — usado pra avisar antes de um reenvio de Movimentos apagar a foto junto (ver replaceMovimentosPorCompetencia). */
export async function listCompetenciasComFaturaSalva(competencias: string[]): Promise<Set<string>> {
  if (competencias.length === 0) return new Set();
  await ensureSchema();
  const rows = await getDb()<{ competencia: string }[]>`SELECT competencia FROM faturas_salvas WHERE competencia = ANY(${competencias})`;
  return new Set(rows.map((r) => r.competencia));
}
