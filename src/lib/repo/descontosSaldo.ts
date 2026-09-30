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

/**
 * Substitui (não soma) o desconto dessa matrícula+competência+tipo pelo `valorAbsoluto` exato —
 * usado pra EDITAR um lançamento já existente (ver RescisaoCard.tsx/DescontoLancadoTable.tsx),
 * ao contrário de upsertDescontoSaldo (que acumula, pro fluxo normal de "Salvar" em
 * SaldoFeriasCard). `valorAbsoluto` <= 0 apaga a linha em vez de gravar 0.
 */
export async function setDescontoSaldo(matricula: number, competencia: string, tipo: TipoSaldoFerias, valorAbsoluto: number): Promise<void> {
  await ensureSchema();
  const sql = getDb();
  if (valorAbsoluto <= 0) {
    await sql`DELETE FROM descontos_saldo WHERE matricula = ${matricula} AND competencia = ${competencia} AND tipo = ${tipo}`;
    return;
  }
  await sql`
    INSERT INTO descontos_saldo (matricula, competencia, tipo, valor)
    VALUES (${matricula}, ${competencia}, ${tipo}, ${-valorAbsoluto})
    ON CONFLICT (matricula, competencia, tipo) DO UPDATE SET valor = excluded.valor
  `;
}

/** Apaga os dois lançamentos (férias e 13º) dessa matrícula+competência — usado pra EXCLUIR uma linha inteira da Rescisão (ver DescontoLancadoTable.tsx). */
export async function deleteDescontoSaldoPorCompetencia(matricula: number, competencia: string): Promise<void> {
  await ensureSchema();
  await getDb()`DELETE FROM descontos_saldo WHERE matricula = ${matricula} AND competencia = ${competencia}`;
}

interface DescontoSaldoLote {
  matricula: number;
  competencia: string;
  tipo: TipoSaldoFerias;
  valorAbsoluto: number;
}

/** Substitui (não soma) vários descontos de saldo de uma só vez — versão em lote de setDescontoSaldo. */
export async function setDescontosSaldoEmLote(entradas: DescontoSaldoLote[]): Promise<void> {
  if (entradas.length === 0) return;
  await ensureSchema();
  const sql = getDb();
  const paraInserir = entradas.filter((e) => e.valorAbsoluto > 0);
  const paraDeletar = entradas.filter((e) => e.valorAbsoluto <= 0);

  if (paraDeletar.length > 0) {
    const chaves = paraDeletar.map((e) => `(${e.matricula}, ${sql(e.competencia)}, ${sql(e.tipo)})`).join(",");
    await sql.unsafe(`DELETE FROM descontos_saldo WHERE (matricula, competencia, tipo) IN (${chaves})`);
  }

  if (paraInserir.length > 0) {
    await sql`
      INSERT INTO descontos_saldo (matricula, competencia, tipo, valor)
      ${sql(paraInserir.map((e) => ({ matricula: e.matricula, competencia: e.competencia, tipo: e.tipo, valor: -e.valorAbsoluto })))}
      ON CONFLICT (matricula, competencia, tipo) DO UPDATE SET valor = excluded.valor
    `;
  }
}

/** Descontos lançados para qualquer das competências dadas — usado pelo motor de cálculo (ver generateDescontoSaldoFeriasCharges em engine.ts). */
export async function listDescontosSaldoPorCompetencias(competencias: string[]): Promise<DescontoSaldo[]> {
  if (competencias.length === 0) return [];
  await ensureSchema();
  const sql = getDb();
  const rows = await sql<Row[]>`SELECT * FROM descontos_saldo WHERE competencia = ANY(${competencias})`;
  return rows.map(toDescontoSaldo);
}

/**
 * Todo desconto de saldo já lançado pra essa matrícula, em qualquer competência — usado pra
 * abater da Rescisão (ver RescisaoCard.tsx): esse valor já foi pago/quitado com o colaborador
 * (reduziu a fatura do tomador naquele mês), então tem que sair do acumulado de Prov
 * Férias/13º, senão a Rescisão mostraria como "ainda devendo" um valor que já foi pago.
 */
export async function listDescontosSaldoPorMatricula(matricula: number): Promise<DescontoSaldo[]> {
  await ensureSchema();
  const rows = await getDb()<Row[]>`SELECT * FROM descontos_saldo WHERE matricula = ${matricula} ORDER BY competencia`;
  return rows.map(toDescontoSaldo);
}

/**
 * Quanto já foi lançado como desconto (férias e 13° salário, separados) dessa matrícula NESSA
 * competência específica — cada mês tem seu próprio valor, sem se misturar com outros meses (ver
 * tela do colaborador). Valor sempre positivo pra exibição (o que fica gravado em
 * `descontos_saldo` é negativo, um crédito). 0 quando nada foi lançado ainda nesse mês.
 */
export async function getDescontoSaldoPorMatriculaECompetencia(matricula: number, competencia: string): Promise<{ ferias: number; terco: number }> {
  await ensureSchema();
  const rows = await getDb()<Row[]>`SELECT * FROM descontos_saldo WHERE matricula = ${matricula} AND competencia = ${competencia}`;
  const porTipo = { ferias: 0, terco: 0 };
  for (const row of rows) {
    const d = toDescontoSaldo(row);
    porTipo[d.tipo] = Math.abs(d.valor);
  }
  return porTipo;
}
