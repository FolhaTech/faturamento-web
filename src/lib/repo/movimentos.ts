import { randomUUID } from "node:crypto";
import { ensureSchema, getDb } from "../db";
import type { Movimento, TipoSaldoFerias } from "../types";

interface Row {
  id: string;
  codigo: number;
  matricula: number;
  nome: string;
  evento: string;
  competencia: string;
  valor: number;
  ref: number;
  tipo: string;
  forma: string | null;
  abatimento_ferias: number;
  abatimento_saldo_tipo: string | null;
}

function toMovimento(row: Row): Movimento {
  return {
    id: row.id,
    codigo: row.codigo,
    matricula: row.matricula,
    nome: row.nome,
    evento: row.evento,
    competencia: row.competencia,
    valor: row.valor,
    ref: row.ref,
    tipo: row.tipo as Movimento["tipo"],
    forma: row.forma,
    abatimentoFerias: row.abatimento_ferias,
    abatimentoSaldoTipo: row.abatimento_saldo_tipo as TipoSaldoFerias | null,
  };
}

export async function listMovimentosByCompetencia(competencia: string): Promise<Movimento[]> {
  await ensureSchema();
  const rows = await getDb()<Row[]>`SELECT * FROM movimentos WHERE competencia = ${competencia}`;
  return rows.map(toMovimento);
}

export async function listCompetencias(): Promise<string[]> {
  await ensureSchema();
  const rows = await getDb()<{ competencia: string }[]>`
    SELECT DISTINCT competencia FROM movimentos ORDER BY competencia DESC
  `;
  return rows.map((r) => r.competencia);
}

export async function countMovimentos(): Promise<number> {
  await ensureSchema();
  const [{ n }] = await getDb()<{ n: number }[]>`SELECT COUNT(*)::int as n FROM movimentos`;
  return n;
}

export interface MovimentoInput {
  codigo: number;
  matricula: number;
  nome: string;
  evento: string;
  competencia: string;
  valor: number;
  ref: number;
  tipo: Movimento["tipo"];
  forma: string | null;
  /** Ver Movimento.abatimentoFerias. Ausente = 0 (linha comum, sem abatimento). */
  abatimentoFerias?: number;
  /** Ver Movimento.abatimentoSaldoTipo. Ausente/null = nenhum abatimento. */
  abatimentoSaldoTipo?: TipoSaldoFerias | null;
}

/**
 * Soma de `abatimento_ferias` já aplicado, por matrícula e por tipo de saldo (férias/1/3),
 * nos lançamentos das competências dadas — chame ANTES de replaceMovimentosPorCompetencia
 * (que apaga essas linhas) para poder devolver esse valor ao saldo certo antes de recalcular
 * o abatimento do novo arquivo (ver abatimentoFerias.ts).
 */
export async function sumAbatimentoPorMatriculaETipo(
  competencias: string[],
): Promise<Record<TipoSaldoFerias, Map<number, number>>> {
  const resultado: Record<TipoSaldoFerias, Map<number, number>> = { ferias: new Map(), terco: new Map() };
  if (competencias.length === 0) return resultado;

  await ensureSchema();
  const sql = getDb();
  const rows = await sql<{ matricula: number; abatimento_saldo_tipo: string; total: number }[]>`
    SELECT matricula, abatimento_saldo_tipo, SUM(abatimento_ferias)::float as total FROM movimentos
    WHERE competencia IN ${sql(competencias)} AND abatimento_ferias != 0 AND abatimento_saldo_tipo IS NOT NULL
    GROUP BY matricula, abatimento_saldo_tipo
  `;
  for (const row of rows) {
    if (row.abatimento_saldo_tipo === "ferias" || row.abatimento_saldo_tipo === "terco") {
      resultado[row.abatimento_saldo_tipo].set(row.matricula, row.total);
    }
  }
  return resultado;
}

/**
 * Substitui todos os lançamentos das competências presentes em `linhas` —
 * reenviar o arquivo do mês atualiza em vez de duplicar os lançamentos.
 */
export async function replaceMovimentosPorCompetencia(linhas: MovimentoInput[]): Promise<number> {
  await ensureSchema();
  const sql = getDb();
  const competencias = [...new Set(linhas.map((l) => l.competencia))];

  await sql.begin(async (tx) => {
    for (const comp of competencias) {
      await tx`DELETE FROM movimentos WHERE competencia = ${comp}`;
    }
    if (linhas.length > 0) {
      await tx`
        INSERT INTO movimentos ${tx(
          linhas.map((l) => ({
            id: randomUUID(),
            codigo: l.codigo,
            matricula: l.matricula,
            nome: l.nome,
            evento: l.evento,
            competencia: l.competencia,
            valor: l.valor,
            ref: l.ref,
            tipo: l.tipo,
            forma: l.forma,
            abatimento_ferias: l.abatimentoFerias ?? 0,
            abatimento_saldo_tipo: l.abatimentoSaldoTipo ?? null,
          })),
          "id",
          "codigo",
          "matricula",
          "nome",
          "evento",
          "competencia",
          "valor",
          "ref",
          "tipo",
          "forma",
          "abatimento_ferias",
          "abatimento_saldo_tipo",
        )}
      `;
    }
  });

  return linhas.length;
}

export async function deleteCompetencia(competencia: string): Promise<void> {
  await ensureSchema();
  await getDb()`DELETE FROM movimentos WHERE competencia = ${competencia}`;
}
