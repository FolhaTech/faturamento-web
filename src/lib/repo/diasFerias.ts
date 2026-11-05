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
  const resultado = new Map([...porMatricula].map(([matricula, registros]) => [matricula, diasGozadosPorMes(registros)]));
  const informados = await sql<{ matricula: number; mes: number; dias: number | null; adicionais: number }[]>`
    WITH anteriores AS (
      SELECT DISTINCT ON (matricula, mes) matricula, mes, dias FROM dias_ferias_informados
      WHERE matricula = ANY(${matriculas}) AND modo = 'substituir' ORDER BY matricula, mes, id DESC
    ), adicionais AS (
      SELECT d.matricula, d.mes, SUM(d.dias) AS dias FROM dias_ferias_informados d
      WHERE d.matricula = ANY(${matriculas}) AND d.modo = 'adicionar'
        AND NOT EXISTS (SELECT 1 FROM dias_ferias_informados r WHERE r.substitui_id = d.id)
      GROUP BY d.matricula, d.mes
    )
    SELECT COALESCE(a.matricula, b.matricula) AS matricula, COALESCE(a.mes, b.mes) AS mes,
      a.dias, COALESCE(b.dias, 0)::double precision AS adicionais
    FROM anteriores a FULL JOIN adicionais b ON a.matricula = b.matricula AND a.mes = b.mes
  `;
  for (const informado of informados) {
    if (informado.dias === null && informado.adicionais === 0) continue;
    const registros = resultado.get(informado.matricula) ?? [];
    const importado = registros.find((d) => d.mes === informado.mes);
    const ajustado = { mes: informado.mes, dias: (informado.dias ?? importado?.dias ?? 0) + informado.adicionais, manual: true, importados: importado?.dias ?? 0 };
    resultado.set(informado.matricula, [...registros.filter((d) => d.mes !== informado.mes), ajustado].sort((a, b) => b.mes - a.mes));
  }
  return resultado;
}
