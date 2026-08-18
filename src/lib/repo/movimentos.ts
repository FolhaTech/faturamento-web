import { randomUUID } from "node:crypto";
import { ensureSchema, getDb } from "../db";
import type { Movimento } from "../types";

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
