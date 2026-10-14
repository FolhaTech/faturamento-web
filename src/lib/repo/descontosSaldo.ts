import { ensureSchema, getDb } from "../db";
import type { TipoSaldoFerias } from "../types";

/**
 * O que um desconto lançado na fatura de um colaborador pode ser: saldo de férias, saldo de 13º salário ou aviso prévio. Férias e
 * 13º têm saldo e provisão próprios (TipoSaldoFerias) e entram na Rescisão; o aviso prévio é só um valor digitado que reduz a fatura
 * daquela competência — não tem saldo nem provisão, então fica fora da Rescisão e dos acumulados.
 */
export type TipoDescontoSaldo = TipoSaldoFerias | "aviso";

export interface DescontoSaldo {
  matricula: number;
  competencia: string;
  tipo: TipoDescontoSaldo;
  valor: number;
  /**
   * false = o valor está guardado mas NÃO é cobrado na fatura (botão "Não" do aviso prévio no Faturamento) — o motor de cálculo
   * ignora (ver generateDescontoSaldoFeriasCharges em engine.ts). Só o aviso prévio fica assim; férias e 13º são sempre true.
   */
  aplicado: boolean;
}

/** Só os descontos de férias e 13º — os que entram na Rescisão (ver listDescontosSaldoPorMatricula). */
export type DescontoProvisao = DescontoSaldo & { tipo: TipoSaldoFerias };

interface Row {
  matricula: number;
  competencia: string;
  tipo: string;
  valor: number;
  aplicado?: boolean;
}

function toDescontoSaldo(row: Row): DescontoSaldo {
  return { matricula: row.matricula, competencia: row.competencia, tipo: row.tipo as TipoDescontoSaldo, valor: row.valor, aplicado: row.aplicado ?? true };
}

/**
 * Soma `valor` (negativo — crédito) ao desconto já lançado pra essa matrícula+competência+tipo
 * — salvar de novo pra mesma competência acumula em vez de substituir, igual ao comportamento
 * antigo de inserir uma linha avulsa nova a cada "Salvar" (ver descontoSaldoFerias.ts).
 * Salvar sempre deixa o lançamento aplicado (cobrado na fatura).
 */
export async function upsertDescontoSaldo(matricula: number, competencia: string, tipo: TipoDescontoSaldo, valor: number): Promise<void> {
  await ensureSchema();
  await getDb()`
    INSERT INTO descontos_saldo (matricula, competencia, tipo, valor)
    VALUES (${matricula}, ${competencia}, ${tipo}, ${valor})
    ON CONFLICT (matricula, competencia, tipo) DO UPDATE SET valor = descontos_saldo.valor + excluded.valor, aplicado = true
  `;
}

/**
 * Liga ("Sim") ou desliga ("Não") a cobrança do aviso prévio já lançado nessa matrícula+competência, SEM apagar o valor:
 * desligado ele fica guardado e fora da fatura, e o "Sim" volta a cobrá-lo. Devolve o valor do aviso prévio (positivo) —
 * 0 quando não há nenhum lançado nessa competência (aí não há o que ligar).
 */
export async function definirAvisoPrevioAplicado(matricula: number, competencia: string, aplicar: boolean): Promise<number> {
  await ensureSchema();
  const rows = await getDb()<{ valor: number }[]>`
    UPDATE descontos_saldo SET aplicado = ${aplicar}
    WHERE matricula = ${matricula} AND competencia = ${competencia} AND tipo = 'aviso'
    RETURNING valor
  `;
  return rows[0] ? Math.abs(rows[0].valor) : 0;
}

/**
 * Substitui (não soma) o desconto dessa matrícula+competência+tipo pelo `valorAbsoluto` exato —
 * usado pra EDITAR um lançamento já existente (ver RescisaoCard.tsx/DescontoLancadoTable.tsx),
 * ao contrário de upsertDescontoSaldo (que acumula, pro fluxo normal de "Salvar" em
 * SaldoFeriasCard). `valorAbsoluto` <= 0 apaga a linha em vez de gravar 0.
 */
export async function setDescontoSaldo(matricula: number, competencia: string, tipo: TipoDescontoSaldo, valorAbsoluto: number): Promise<void> {
  await ensureSchema();
  const sql = getDb();
  if (valorAbsoluto <= 0) {
    await sql`DELETE FROM descontos_saldo WHERE matricula = ${matricula} AND competencia = ${competencia} AND tipo = ${tipo}`;
    return;
  }
  await sql`
    INSERT INTO descontos_saldo (matricula, competencia, tipo, valor)
    VALUES (${matricula}, ${competencia}, ${tipo}, ${-valorAbsoluto})
    ON CONFLICT (matricula, competencia, tipo) DO UPDATE SET valor = excluded.valor, aplicado = true
  `;
}

/** Apaga os dois lançamentos (férias e 13º) dessa matrícula+competência — usado pra EXCLUIR uma linha inteira da Rescisão (ver DescontoLancadoTable.tsx). O aviso prévio da mesma competência não é da Rescisão e fica. */
export async function deleteDescontoSaldoPorCompetencia(matricula: number, competencia: string): Promise<void> {
  await ensureSchema();
  await getDb()`DELETE FROM descontos_saldo WHERE matricula = ${matricula} AND competencia = ${competencia} AND tipo IN ('ferias', 'terco')`;
}

/** Descontos lançados para qualquer das competências dadas — usado pelo motor de cálculo (ver generateDescontoSaldoFeriasCharges em engine.ts). */
export async function listDescontosSaldoPorCompetencias(competencias: string[]): Promise<DescontoSaldo[]> {
  if (competencias.length === 0) return [];
  await ensureSchema();
  const sql = getDb();
  const rows = await sql<Row[]>`SELECT * FROM descontos_saldo WHERE competencia = ANY(${competencias})`;
  return rows.map(toDescontoSaldo);
}

/** Descontos de saldo de vários colaboradores de uma vez (uma consulta só), em qualquer competência — usado na tela de Faturamento. */
export async function listDescontosSaldoPorMatriculas(matriculas: number[]): Promise<DescontoSaldo[]> {
  const unicos = [...new Set(matriculas)];
  if (unicos.length === 0) return [];
  await ensureSchema();
  const sql = getDb();
  const rows = await sql<Row[]>`SELECT * FROM descontos_saldo WHERE matricula IN ${sql(unicos)} ORDER BY competencia`;
  return rows.map(toDescontoSaldo);
}

/**
 * Todo desconto de saldo de férias e 13º já lançado pra essa matrícula, em qualquer competência — usado
 * pra abater da Rescisão (ver RescisaoCard.tsx): esse valor já foi pago/quitado com o colaborador
 * (reduziu a fatura do tomador naquele mês), então tem que sair do acumulado de Prov
 * Férias/13º, senão a Rescisão mostraria como "ainda devendo" um valor que já foi pago.
 * O aviso prévio não entra: não tem provisão pra abater.
 */
export async function listDescontosSaldoPorMatricula(matricula: number): Promise<DescontoProvisao[]> {
  await ensureSchema();
  const rows = await getDb()<Row[]>`SELECT * FROM descontos_saldo WHERE matricula = ${matricula} AND tipo IN ('ferias', 'terco') ORDER BY competencia`;
  return rows.map((row) => toDescontoSaldo(row) as DescontoProvisao);
}

/**
 * Quanto já foi lançado como desconto (férias, 13° salário e aviso prévio, separados) dessa matrícula
 * NESSA competência específica — cada mês tem seu próprio valor, sem se misturar com outros meses (ver
 * tela do colaborador). Valor sempre positivo pra exibição (o que fica gravado em
 * `descontos_saldo` é negativo, um crédito). 0 quando nada foi lançado ainda nesse mês.
 * `avisoAplicado` diz se o aviso prévio lançado está sendo cobrado na fatura (true quando não há aviso prévio).
 */
export interface DescontoNaCompetencia extends Record<TipoDescontoSaldo, number> {
  avisoAplicado: boolean;
}

export async function getDescontoSaldoPorMatriculaECompetencia(matricula: number, competencia: string): Promise<DescontoNaCompetencia> {
  await ensureSchema();
  const rows = await getDb()<Row[]>`SELECT * FROM descontos_saldo WHERE matricula = ${matricula} AND competencia = ${competencia}`;
  const porTipo: DescontoNaCompetencia = { ferias: 0, terco: 0, aviso: 0, avisoAplicado: true };
  for (const row of rows) {
    const d = toDescontoSaldo(row);
    porTipo[d.tipo] = Math.abs(d.valor);
    if (d.tipo === "aviso") porTipo.avisoAplicado = d.aplicado;
  }
  return porTipo;
}
