import { ensureSchema, getDb } from "../db";

export interface ProvisaoMensal {
  matricula: number;
  competencia: string;
  provFerias: number;
  prov13: number;
  salvoEm: string;
}

interface Row {
  matricula: number;
  competencia: string;
  prov_ferias: number;
  prov_13: number;
  salvo_em: string;
}

function toProvisaoMensal(row: Row): ProvisaoMensal {
  return { matricula: row.matricula, competencia: row.competencia, provFerias: row.prov_ferias, prov13: row.prov_13, salvoEm: row.salvo_em };
}

/**
 * Grava a provisão de férias e de 13º que a Folha gerou pra cada matrícula numa competência —
 * substitui (não soma) o que já existia pra essa matrícula+competência, já que é sempre o
 * retrato mais recente da Folha (ver /api/movimentos). Matrículas com os dois valores em 0 não
 * geram linha (nada a guardar).
 */
export async function salvarProvisoesMensais(competencia: string, porMatricula: Map<number, { provFerias: number; prov13: number }>): Promise<void> {
  const entradas = [...porMatricula.entries()].filter(([, v]) => v.provFerias !== 0 || v.prov13 !== 0);
  if (entradas.length === 0) return;

  await ensureSchema();
  const sql = getDb();
  await sql`
    INSERT INTO provisoes_mensais ${sql(
      entradas.map(([matricula, v]) => ({ matricula, competencia, prov_ferias: v.provFerias, prov_13: v.prov13, salvo_em: new Date().toISOString() })),
      "matricula",
      "competencia",
      "prov_ferias",
      "prov_13",
      "salvo_em",
    )}
    ON CONFLICT (matricula, competencia) DO UPDATE SET
      prov_ferias = excluded.prov_ferias, prov_13 = excluded.prov_13, salvo_em = excluded.salvo_em
  `;
}

/** Histórico de provisão de vários colaboradores de uma vez (uma consulta só) — usado na tela de Faturamento. */
export async function listProvisoesMensaisPorMatriculas(matriculas: number[]): Promise<ProvisaoMensal[]> {
  const unicos = [...new Set(matriculas)];
  if (unicos.length === 0) return [];
  await ensureSchema();
  const sql = getDb();
  const rows = await sql<Row[]>`SELECT * FROM provisoes_mensais WHERE matricula IN ${sql(unicos)} ORDER BY competencia DESC`;
  return rows.map(toProvisaoMensal);
}

/** Histórico mês a mês da provisão de férias/13º de um colaborador — mais recente primeiro. Base pra somar o acumulado numa rescisão. */
export async function listProvisoesMensaisPorMatricula(matricula: number): Promise<ProvisaoMensal[]> {
  await ensureSchema();
  const rows = await getDb()<Row[]>`SELECT * FROM provisoes_mensais WHERE matricula = ${matricula} ORDER BY competencia DESC`;
  return rows.map(toProvisaoMensal);
}
