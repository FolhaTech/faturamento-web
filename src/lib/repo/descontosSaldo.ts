import { ensureSchema, getDb } from "../db";
import type { TipoSaldoFerias } from "../types";

export interface DescontoSaldo {
  matricula: number;
  competencia: string;
  tipo: TipoSaldoFerias;
  valor: number;
}

interface Row {
  matricula: number;
  competencia: string;
  tipo: string;
  valor: number;
}

function toDescontoSaldo(row: Row): DescontoSaldo {
  return { matricula: row.matricula, competencia: row.competencia, tipo: row.tipo as TipoSaldoFerias, valor: row.valor };
}

/**
 * Soma `valor` (negativo — crédito) ao desconto já lançado pra essa matrícula+competência+tipo
 * — salvar de novo pra mesma competência acumula em vez de substituir, igual ao comportamento
 * antigo de inserir uma linha avulsa nova a cada "Salvar" (ver descontoSaldoFerias.ts).
 */
export async function upsertDescontoSaldo(matricula: number, competencia: string, tipo: TipoSaldoFerias, valor: number): Promise<void> {
  await ensureSchema();
  await getDb()`
    INSERT INTO descontos_saldo (matricula, competencia, tipo, valor)
    VALUES (${matricula}, ${competencia}, ${tipo}, ${valor})
    ON CONFLICT (matricula, competencia, tipo) DO UPDATE SET valor = descontos_saldo.valor + excluded.valor
  `;
}

/** Descontos lançados para qualquer das competências dadas — usado pelo motor de cálculo (ver generateDescontoSaldoFeriasCharges em engine.ts). */
export async function listDescontosSaldoPorCompetencias(competencias: string[]): Promise<DescontoSaldo[]> {
  if (competencias.length === 0) return [];
  await ensureSchema();
  const sql = getDb();
  const rows = await sql<Row[]>`SELECT * FROM descontos_saldo WHERE competencia = ANY(${competencias})`;
  return rows.map(toDescontoSaldo);
}
