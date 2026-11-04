import type { Sql, TransactionSql } from "postgres";
import { ensureSchema, getDb } from "../db";
import { diasGozadosPorMes, type DiasGozados } from "../calc/diasFerias";

export async function listarDiasGozados(matriculas: number[], conexao?: Sql | TransactionSql): Promise<Map<number, DiasGozados[]>> {
  if (!matriculas.length) return new Map();
  if (!conexao) await ensureSchema();
  const sql = conexao ?? getDb();
  const linhas = await sql<{ matricula: number; competencia: string; evento: string; forma: string | null; ref: number; cadastrado: boolean }[]>`
    SELECT m.matricula, m.competencia, m.evento, m.forma, m.ref,
      COALESCE(e.abate_saldo = 'ferias', false) OR COALESCE(m.abatimento_saldo_tipo = 'ferias', false) AS cadastrado
    FROM movimentos m LEFT JOIN encargos e ON e.codigo = m.codigo
    WHERE m.matricula = ANY(${matriculas}) AND m.tipo = 'P' AND m.ref > 0 AND m.ref <= 31
      AND (m.competencia LIKE '% (Folha)' OR (
        m.competencia ~ '^[0-9]{2}/[0-9]{4}$' AND NOT EXISTS (
          SELECT 1 FROM movimentos f WHERE f.matricula = m.matricula AND f.competencia = m.competencia || ' (Folha)'
        )
      ))
  `;
  const porMatricula = new Map<number, typeof linhas[number][]>();
  for (const linha of linhas) {
    const registros = porMatricula.get(linha.matricula) ?? [];
    registros.push(linha);
    porMatricula.set(linha.matricula, registros);
  }
  return new Map([...porMatricula].map(([matricula, registros]) => [matricula, diasGozadosPorMes(registros)]));
}
